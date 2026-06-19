import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import fs from "fs/promises";
import helmet from "helmet";
import http from "http";
import https from "https";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import {
    msgBlockIp,
    msgCritical,
    msgEscalation,
    msgNewAlert,
    msgUnblock,
    sendTelegram,
} from "./telegram.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACTIONS_FILE = path.join(__dirname, "data", "alert_actions.json");
const BLOCKED_IPS_FILE = path.join(__dirname, "data", "blocked_ips.json");
const NOTIFIED_FILE = path.join(__dirname, "data", "notified_alerts.json");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Config ───────────────────────────────────────────────────────────────────
const requiredEnv = (key) => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
};

const CONFIG = {
    wazuhHost: requiredEnv("WAZUH_HOST"),
    wazuhPort: process.env.WAZUH_PORT || "55000",
    wazuhUser: requiredEnv("WAZUH_API_USER"),
    wazuhPass: requiredEnv("WAZUH_API_PASS"),

    indexerHost: requiredEnv("INDEXER_HOST"),
    indexerPort: process.env.INDEXER_PORT || "9200",
    indexerUser: requiredEnv("INDEXER_USER"),
    indexerPass: requiredEnv("INDEXER_PASS"),

    jwtSecret: requiredEnv("JWT_SECRET"),
    jwtExpiry: process.env.JWT_EXPIRY || "5m",
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12"),

    telegramEnabled: String(process.env.TELEGRAM_ENABLED || "false") === "true",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
    telegramNotifyCritical: String(process.env.TELEGRAM_NOTIFY_CRITICAL || "true") === "true",
    telegramNotifyHigh: String(process.env.TELEGRAM_NOTIFY_HIGH || "false") === "true",
    telegramNotifyEscalate: String(process.env.TELEGRAM_NOTIFY_ESCALATE || "true") === "true",
    telegramNotifyBlock: String(process.env.TELEGRAM_NOTIFY_BLOCK || "true") === "true",
};

// ─── Persistent Storage ───────────────────────────────────────────────────────
async function ensureDataDir() { await fs.mkdir(path.join(__dirname, "data"), { recursive: true }); }
async function loadJSON(fp, fb = {}) { try { return JSON.parse(await fs.readFile(fp, "utf-8")); } catch { return fb; } }
async function saveJSON(fp, data) { await fs.writeFile(fp, JSON.stringify(data, null, 2), "utf-8"); }

let ALERT_ACTIONS = {};
let BLOCKED_IPS = {};
let NOTIFIED_IDS = {}; // { alertId: true } — supaya gak kirim alert sama 2x ke Telegram

async function initStorage() {
    await ensureDataDir();
    ALERT_ACTIONS = await loadJSON(ACTIONS_FILE, {});
    BLOCKED_IPS = await loadJSON(BLOCKED_IPS_FILE, {});
    NOTIFIED_IDS = await loadJSON(NOTIFIED_FILE, {});

    // Cleanup notified IDs lebih dari 48 jam supaya file tidak terus membesar
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    Object.keys(NOTIFIED_IDS).forEach(id => {
        if (NOTIFIED_IDS[id] < cutoff) delete NOTIFIED_IDS[id];
    });

    console.log(`[Storage] ${Object.keys(ALERT_ACTIONS).length} actions, ${Object.keys(BLOCKED_IPS).length} blocked IPs, ${Object.keys(NOTIFIED_IDS).length} notified`);
}

// ─── Email ────────────────────────────────────────────────────────────────────
let mailer = null;

function initMailer() {
    if (!CONFIG.smtpUser || !CONFIG.smtpPass) {
        console.warn("[Email] SMTP not configured — escalation emails disabled");
        return;
    }
    mailer = nodemailer.createTransport({
        host: CONFIG.smtpHost,
        port: CONFIG.smtpPort,
        secure: CONFIG.smtpPort === 465,
        auth: { user: CONFIG.smtpUser, pass: CONFIG.smtpPass },
    });
    mailer.verify((err) => {
        if (err) console.error("[Email] SMTP verify failed:", err.message);
        else console.log("[Email] SMTP ready ✓");
    });
}

async function sendEscalationEmail(alert, note, operatorName) {
    if (!mailer || !CONFIG.escalateTo) return { sent: false, reason: "SMTP not configured" };

    const sevColors = {
        critical: "#ff3366",
        high: "#ffaa00",
        medium: "#ffdd44",
        low: "#00ff88",
    };
    const color = sevColors[alert.severity] || "#00c8ff";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#020810;color:#e2f4ff;font-family:'Courier New',monospace;padding:0;margin:0;">
  <div style="max-width:640px;margin:0 auto;background:#060e18;border:1px solid rgba(0,200,255,0.3);border-radius:8px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#020810,#040c18);padding:20px 24px;border-bottom:2px solid ${color};">
      <div style="display:flex;align-items:center;gap:12px;"> 

        <div style="font-family:monospace;font-size:22px;font-weight:900;color:#00c8ff;letter-spacing:6px;">SENTINEL</div>
        <div style="font-size:10px;letter-spacing:3px;color:rgba(180,220,255,0.5);">SECURITY OPERATIONS CENTER</div>
      </div>
      <div style="margin-top:8px;font-size:11px;letter-spacing:2px;color:${color};">⚡ ALERT ESCALATION — TIER 2</div>
    </div>

    <!-- Severity badge -->
    <div style="padding:16px 24px;border-bottom:1px solid rgba(0,200,255,0.08);">
      <span style="background:${color}22;border:1px solid ${color}66;color:${color};
        font-size:10px;font-weight:700;letter-spacing:3px;padding:4px 12px;border-radius:3px;">
        ${alert.severity?.toUpperCase()} SEVERITY
      </span>
      <span style="margin-left:12px;font-size:10px;letter-spacing:1px;color:rgba(180,220,255,0.5);">
        ${new Date(alert.timestamp || Date.now()).toLocaleString("en-GB", { timeZone: "Asia/Makassar" })} WITA
      </span>
    </div>

    <!-- Alert details -->
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;">
        ${[
            ["RULE", alert.rule],
            ["LEVEL", `${alert.level} / 15`],
            ["TACTIC", alert.tactic],
            ["TECHNIQUE", alert.technique || "N/A"],
            ["AGENT", alert.agent],
            ["SOURCE IP", alert.srcIp || "N/A"],
            ["ORIGIN", alert.srcGeo ? `${alert.srcGeo.name} [${alert.srcGeo.code}]` : "Unknown"],
            ["ALERT ID", alert.id],
            ["ESCALATED BY", operatorName],
        ].map(([k, v]) => `
          <tr style="border-bottom:1px solid rgba(0,200,255,0.06);">
            <td style="padding:7px 0;font-size:9px;letter-spacing:2px;color:rgba(120,170,210,0.5);width:130px;">${k}</td>
            <td style="padding:7px 0;font-size:11px;color:#e2f4ff;">${v}</td>
          </tr>
        `).join("")}
      </table>

      ${note ? `
      <div style="margin-top:16px;padding:12px;background:rgba(0,200,255,0.05);
        border-left:3px solid #00c8ff;border-radius:0 4px 4px 0;">
        <div style="font-size:9px;letter-spacing:2px;color:rgba(120,170,210,0.5);margin-bottom:6px;">OPERATOR NOTE</div>
        <div style="font-size:12px;color:#e2f4ff;line-height:1.6;">${note}</div>
      </div>` : ""}

      ${alert.fullLog ? `
      <div style="margin-top:16px;">
        <div style="font-size:9px;letter-spacing:2px;color:rgba(120,170,210,0.5);margin-bottom:6px;">FULL LOG</div>
        <pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(0,200,255,0.1);
          border-radius:4px;padding:10px;font-size:9px;color:rgba(180,220,255,0.7);
          overflow:auto;white-space:pre-wrap;word-break:break-all;max-height:200px;">${alert.fullLog.substring(0, 1000)}${alert.fullLog.length > 1000 ? "\n... [truncated]" : ""}</pre>
      </div>` : ""}
    </div>

    <!-- Footer -->
    <div style="padding:12px 24px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(0,200,255,0.08);
      font-size:9px;letter-spacing:1px;color:rgba(120,170,210,0.4);display:flex;justify-content:space-between;">
      <span>Sentinel SOC v2.4.1</span>
      <span>Auto-generated — Do not reply</span>
    </div>
  </div>
</body>
</html>`;

    try {
        const info = await mailer.sendMail({
            from: `"Sentinel SOC" <${CONFIG.smtpUser}>`,
            to: CONFIG.escalateTo, cc: CONFIG.escalateCc || undefined,
            subject: `[SENTINEL] ${alert.severity?.toUpperCase()} ALERT ESCALATED — ${alert.rule}`,
            html,
        });
        return { sent: true, messageId: info.messageId };
    } catch (err) {
        return { sent: false, reason: err.message };
    }
}

// ─── Telegram wrapper ─────────────────────────────────────────────────────────
async function tgSend(text) {
    if (!CONFIG.tgBotToken || !CONFIG.tgChatId) return { ok: false, reason: "Telegram not configured" };
    return sendTelegram(CONFIG.tgBotToken, CONFIG.tgChatId, text);
}

// ─── Users ────────────────────────────────────────────────────────────────────
const USERS = new Map();
(async () => {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "SentinelSOC2024!", CONFIG.bcryptRounds);
    USERS.set("admin", { username: "admin", passwordHash: hash, role: "SOC_ANALYST" });
})();
const loginAttempts = new Map();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true });

const authenticate = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
    try { req.user = jwt.verify(auth.slice(7), CONFIG.jwtSecret); next(); }
    catch { res.status(401).json({ error: "Invalid or expired token" }); }
};

// ─── HTTP/HTTPS Helper ────────────────────────────────────────────────────────
const makeRequest = (baseUrl, port, path, method = "GET", body = null, authHeader = null) => {
    return new Promise((resolve, reject) => {
        const isHttps = baseUrl.startsWith("https");
        const hostname = baseUrl.replace(/https?:\/\//, "").split(":")[0];
        const opts = { hostname, port: parseInt(port), path, method, headers: { "Content-Type": "application/json" }, rejectUnauthorized: false, timeout: 10000 };
        if (authHeader) opts.headers["Authorization"] = authHeader;
        const protocol = isHttps ? https : http;
        const req = protocol.request(opts, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data: {} }); } });
        });
        req.setTimeout(10000, () => { req.destroy(); reject(new Error("Request timeout")); });
        req.on("error", reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const indexerAuth = () => "Basic " + Buffer.from(`${CONFIG.indexerUser}:${CONFIG.indexerPass}`).toString("base64");
const indexerReq = (path, method = "GET", body = null) => makeRequest(CONFIG.indexerHost, CONFIG.indexerPort, path, method, body, indexerAuth());

let wazuhToken = null, wazuhTokenExpiry = 0;
const getWazuhToken = async () => {
    if (wazuhToken && Date.now() < wazuhTokenExpiry) return wazuhToken;
    const auth = "Basic " + Buffer.from(`${CONFIG.wazuhUser}:${CONFIG.wazuhPass}`).toString("base64");
    const result = await makeRequest(CONFIG.wazuhHost, CONFIG.wazuhPort, "/security/user/authenticate", "POST", {}, auth);
    if (result.data?.data?.token) { wazuhToken = result.data.data.token; wazuhTokenExpiry = Date.now() + 14 * 60 * 1000; return wazuhToken; }
    throw new Error("Cannot authenticate with Wazuh Manager API");
};
const wazuhReq = async (path, method = "GET", body = null) => makeRequest(CONFIG.wazuhHost, CONFIG.wazuhPort, path, method, body, `Bearer ${await getWazuhToken()}`);

const isPrivateIp = (ip = "") => ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || ip === "127.0.0.1" || ip === "::1";
const severityToRange = (s) => ({ critical: { gte: 14 }, high: { gte: 10, lte: 13 }, medium: { gte: 7, lte: 9 }, low: { lte: 6 } }[s] || null);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/health", (req, res) => res.json({ status: "ok", version: "2.5.0", timestamp: new Date().toISOString() }));

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", authLimiter,
    body("username").trim().isLength({ min: 1, max: 50 }).escape(),
    body("password").isLength({ min: 1, max: 128 }),
    async (req, res) => {
        if (!validationResult(req).isEmpty()) return res.status(400).json({ error: "Invalid input" });
        const ip = req.ip;
        const lock = loginAttempts.get(ip);
        if (lock?.lockedUntil > Date.now()) return res.status(429).json({ error: "Too many attempts. Wait 15 minutes." });

        const { username, password } = req.body;
        const user = USERS.get(username);
        const dummy = "$2b$12$invalidhashfortimingprotection000000000000000000000000";
        const valid = await bcrypt.compare(password, user?.passwordHash || dummy);

        if (!valid || !user) {
            const a = loginAttempts.get(ip) || { count: 0 };
            a.count++;
            if (a.count >= 5) { a.lockedUntil = Date.now() + 15 * 60 * 1000; a.count = 0; }
            loginAttempts.set(ip, a);
            return res.status(401).json({ error: "Invalid credentials" });
        }
        loginAttempts.delete(ip);
        const token = jwt.sign({ username: user.username, role: user.role }, CONFIG.jwtSecret, { expiresIn: CONFIG.jwtExpiry });
        res.json({ token, username: user.username, role: user.role });
    }
);

// ─── Alerts ───────────────────────────────────────────────────────────────────
app.get("/api/alerts", authenticate, async (req, res) => {
    const { limit = 200, from = 0, hours = 24, search = "", agent = "", severity = "" } = req.query;
    const size = Math.min(Math.max(parseInt(limit) || 200, 1), 1000);
    const offset = Math.max(parseInt(from) || 0, 0);
    const range = severityToRange(String(severity).toLowerCase());

    const must = [{ range: { timestamp: { gte: `now-${parseInt(hours) || 24}h` } } }];
    if (agent) must.push({ term: { "agent.name": agent } });
    if (range) must.push({ range: { "rule.level": range } });
    if (search) must.push({ simple_query_string: { query: `${search}*`, fields: ["rule.description", "agent.name", "data.srcip", "rule.mitre.tactic"], default_operator: "and" } });

    const query = {
        size, from: offset, track_total_hits: true,
        sort: [{ timestamp: { order: "desc" } }],
        query: { bool: { must } },
        _source: ["timestamp", "rule.description", "rule.level", "rule.mitre.tactic", "rule.mitre.technique",
            "agent.name", "agent.id", "agent.ip", "data.srcip", "data.dstuser",
            "GeoLocation.country_name", "GeoLocation.country_code2",
            "GeoLocation.location.lat", "GeoLocation.location.lon", "full_log"],
    };

    try {
        const result = await indexerReq("/wazuh-alerts-*/_search", "POST", query);
        if (result.status < 200 || result.status >= 300) return res.status(503).json({ error: "Indexer error", status: result.status });

        const alerts = (result.data?.hits?.hits || []).map(h => {
            const s = h._source || {};
            const level = s.rule?.level || 0;
            let sev = "low";
            if (level >= 14) sev = "critical"; else if (level >= 10) sev = "high"; else if (level >= 7) sev = "medium";
            const action = ALERT_ACTIONS[h._id] || {};
            return {
                id: h._id, timestamp: s.timestamp, rule: s.rule?.description || "Unknown Rule",
                level, severity: sev,
                tactic: s.rule?.mitre?.tactic?.[0] || "Unknown",
                technique: s.rule?.mitre?.technique?.[0] || null,
                agent: s.agent?.name || "unknown", agentId: s.agent?.id || null, agentIp: s.agent?.ip || null,
                srcIp: s.data?.srcip || null, fullLog: s.full_log || null,
                srcGeo: s.GeoLocation?.country_name ? {
                    name: s.GeoLocation.country_name, code: s.GeoLocation.country_code2 || "XX",
                    lat: Number(s.GeoLocation.location?.lat || 0), lng: Number(s.GeoLocation.location?.lon || 0),
                } : null,
                acknowledged: !!action.acknowledged, escalated: !!action.escalated, blocked: !!action.blocked,
            };
        });

        // ─── Auto Telegram notify untuk alert baru (critical/high) ───────────
        for (const alert of alerts) {
            const shouldNotify =
                (alert.severity === "critical" && CONFIG.tgAutoNotifyCritical) ||
                (alert.severity === "high" && CONFIG.tgAutoNotifyHigh);

            if (shouldNotify && !NOTIFIED_IDS[alert.id]) {
                NOTIFIED_IDS[alert.id] = Date.now();
                const msg = alert.severity === "critical"
                    ? msgCritical(alert, CONFIG.systemName)
                    : msgNewAlert(alert, CONFIG.systemName);
                tgSend(msg).then(r => {
                    if (!r.ok) console.warn(`[Telegram] Auto-notify failed for ${alert.id}: ${r.reason}`);
                });
            }
        }
        // Save notified IDs occasionally (fire and forget)
        saveJSON(NOTIFIED_FILE, NOTIFIED_IDS).catch(() => { });

        res.json({ alerts, total: result.data?.hits?.total?.value || 0, limit: size, from: offset });
    } catch (err) {
        console.error("[/api/alerts]", err.message);
        res.status(503).json({ error: "Wazuh Indexer unreachable", detail: err.message });
    }
});

// ─── Alert Actions ────────────────────────────────────────────────────────────
app.post("/api/alerts/:id/actions", authenticate, async (req, res) => {
    const { id } = req.params;
    const { action, srcIp, agent, rule, note, alertData } = req.body || {};

    if (!["acknowledge", "escalate", "block", "investigate"].includes(action))
        return res.status(400).json({ error: "Invalid action" });

    const current = ALERT_ACTIONS[id] || {};
    const operator = req.user?.username || "unknown";
    const now = new Date().toISOString();
    const updated = { ...current, alertId: id, srcIp, agent, rule, updatedBy: operator, updatedAt: now };

    if (action === "acknowledge") {
        updated.acknowledged = true; updated.acknowledgedAt = now; updated.acknowledgedBy = operator;
    }

    if (action === "investigate") {
        updated.investigated = true; updated.investigatedAt = now; updated.investigatedBy = operator;
    }

    if (action === "escalate") {
        updated.escalated = true; updated.escalatedAt = now; updated.escalatedBy = operator; updated.escalateNote = note || "";

        const fullAlert = { id, srcIp, agent, rule, ...alertData };

        const [emailResult, tgResult] = await Promise.all([
            sendEscalationEmail(fullAlert, note, operator),
            tgSend(msgEscalation(fullAlert, note, operator, CONFIG.systemName)),
        ]);

        updated.emailSent = emailResult.sent;
        updated.emailMessageId = emailResult.messageId || null;
        updated.emailError = emailResult.reason || null;
        updated.telegramSent = tgResult.ok;
        updated.telegramError = tgResult.reason || null;

        ALERT_ACTIONS[id] = updated;
        await saveJSON(ACTIONS_FILE, ALERT_ACTIONS);

        return res.json({ ok: true, action, state: updated, email: emailResult, telegram: tgResult });
    }

    if (action === "block") {
        if (!srcIp) return res.status(400).json({ error: "Source IP is required" });
        if (isPrivateIp(srcIp)) return res.status(400).json({ error: "Cannot block private/internal IP" });

        updated.blocked = true; updated.blockedAt = now; updated.blockedBy = operator; updated.blockedIp = srcIp;

        let wazuhBlockResult = null;
        try {
            const arPayload = {
                command: "firewall-drop",
                arguments: ["-", "null", "180"],
                alert: { data: { srcip: srcIp }, rule: { id: "100001", level: 15, description: `Sentinel Manual Block: ${rule || "Unknown"}` } },
            };
            const arPath = agent ? `/active-response?agents_list=${encodeURIComponent(agent)}` : "/active-response";
            const result = await wazuhReq(arPath, "PUT", arPayload);
            wazuhBlockResult = { success: result.status >= 200 && result.status < 300, status: result.status, data: result.data };
        } catch (err) {
            wazuhBlockResult = { success: false, error: err.message };
        }
        updated.wazuhBlockResult = wazuhBlockResult;

        BLOCKED_IPS[srcIp] = {
            ip: srcIp, blockedAt: now, blockedBy: operator, alertId: id,
            rule: rule || "Unknown", agent: agent || "Unknown",
            wazuhSuccess: wazuhBlockResult?.success || false, active: true,
        };
        await saveJSON(BLOCKED_IPS_FILE, BLOCKED_IPS);

        // Telegram notify
        const tgResult = await tgSend(msgBlockIp(srcIp, { rule, agent }, operator, wazuhBlockResult?.success, CONFIG.systemName));
        updated.telegramSent = tgResult.ok;

        ALERT_ACTIONS[id] = updated;
        await saveJSON(ACTIONS_FILE, ALERT_ACTIONS);

        return res.json({ ok: true, action, state: updated, wazuh: wazuhBlockResult, telegram: tgResult });
    }

    ALERT_ACTIONS[id] = updated;
    await saveJSON(ACTIONS_FILE, ALERT_ACTIONS);
    res.json({ ok: true, action, state: updated });
});

// ─── Blocked IPs ──────────────────────────────────────────────────────────────
app.get("/api/blocked-ips", authenticate, async (req, res) => {
    const list = Object.values(BLOCKED_IPS).sort((a, b) => new Date(b.blockedAt) - new Date(a.blockedAt));
    res.json({ blockedIps: list, total: list.length });
});

app.delete("/api/blocked-ips/:ip", authenticate, async (req, res) => {
    const ip = decodeURIComponent(req.params.ip);
    if (!BLOCKED_IPS[ip]) return res.status(404).json({ error: "IP not found in block list" });

    try {
        await wazuhReq("/active-response", "DELETE", { command: "firewall-drop", arguments: ["-", "null", "0"], alert: { data: { srcip: ip } } });
    } catch (err) { console.warn("[Unblock] Wazuh AR failed:", err.message); }

    BLOCKED_IPS[ip].active = false;
    BLOCKED_IPS[ip].unblockedAt = new Date().toISOString();
    BLOCKED_IPS[ip].unblockedBy = req.user?.username;
    await saveJSON(BLOCKED_IPS_FILE, BLOCKED_IPS);

    tgSend(msgUnblock(ip, req.user?.username, CONFIG.systemName)).catch(() => { });

    res.json({ ok: true, ip, unblocked: true });
});

// ─── Agents ───────────────────────────────────────────────────────────────────
app.get("/api/agents", authenticate, async (req, res) => {
    try {
        const result = await wazuhReq("/agents?limit=100");
        if (result.status < 200 || result.status >= 300) return res.status(503).json({ error: "Wazuh Manager error", status: result.status });

        const items = result.data?.data?.affected_items || [];
        const agentAlertCounts = {};
        try {
            const agg = await indexerReq("/wazuh-alerts-*/_search", "POST", {
                size: 0, query: { range: { timestamp: { gte: "now-24h" } } },
                aggs: { by_agent: { terms: { field: "agent.name", size: 100 } } },
            });
            (agg.data?.aggregations?.by_agent?.buckets || []).forEach(b => { agentAlertCounts[b.key] = b.doc_count; });
        } catch { }

        const agents = items.map(a => ({
            id: a.id || "N/A", name: a.name || "unknown",
            ip: a.ip && a.ip !== "any" ? a.ip : a.registerIP && a.registerIP !== "any" ? a.registerIP : "N/A",
            os: a.os?.name || a.os?.platform || a.os?.uname || "Unknown",
            status: String(a.status || "").toLowerCase() === "active" ? "active" : "disconnected",
            lastKeepAlive: a.lastKeepAlive || a.dateAdd || new Date().toISOString(),
            alertCount: agentAlertCounts[a.name] || 0,
        }));

        res.json({ agents, total: agents.length });
    } catch (err) {
        console.error("[/api/agents]", err.message);
        res.status(503).json({ error: "Wazuh Manager unreachable", detail: err.message });
    }
});

app.get("/api/agents/:agentName/stats", authenticate, async (req, res) => {
    const { agentName } = req.params;
    const { hours = 24 } = req.query;
    const query = {
        size: 0, track_total_hits: true,
        query: { bool: { must: [{ term: { "agent.name": agentName } }, { range: { timestamp: { gte: `now-${parseInt(hours) || 24}h` } } }] } },
        aggs: {
            timeline: { date_histogram: { field: "timestamp", fixed_interval: "30m", min_doc_count: 0 } },
            severity: { filters: { filters: { critical: { range: { "rule.level": { gte: 14 } } }, high: { range: { "rule.level": { gte: 10, lte: 13 } } }, medium: { range: { "rule.level": { gte: 7, lte: 9 } } }, low: { range: { "rule.level": { lte: 6 } } } } } },
            top_source_ips: { terms: { field: "data.srcip", size: 10 } },
            top_rules: { terms: { field: "rule.description", size: 10 } },
        },
    };
    try {
        const result = await indexerReq("/wazuh-alerts-*/_search", "POST", query);
        const aggs = result.data?.aggregations || {};
        res.json({
            agent: agentName, total: result.data?.hits?.total?.value || 0,
            timeline: (aggs.timeline?.buckets || []).map(b => ({ time: b.key_as_string, count: b.doc_count })),
            severity: { critical: aggs.severity?.buckets?.critical?.doc_count || 0, high: aggs.severity?.buckets?.high?.doc_count || 0, medium: aggs.severity?.buckets?.medium?.doc_count || 0, low: aggs.severity?.buckets?.low?.doc_count || 0 },
            topSourceIps: (aggs.top_source_ips?.buckets || []).map(b => ({ ip: b.key, count: b.doc_count })),
            topRules: (aggs.top_rules?.buckets || []).map(b => ({ rule: b.key, count: b.doc_count })),
        });
    } catch (err) {
        res.status(503).json({ error: "Agent stats unavailable", detail: err.message });
    }
});

// ─── Wazuh status ─────────────────────────────────────────────────────────────
app.get("/api/wazuh/status", authenticate, async (req, res) => {
    const status = { indexer: false, manager: false };
    try { await indexerReq("/_cluster/health"); status.indexer = true; } catch { }
    try { await wazuhReq("/"); status.manager = true; } catch { }
    res.json(status);
});

// ─── Telegram test endpoint ────────────────────────────────────────────────────
app.post("/api/telegram/test", authenticate, async (req, res) => {
    const result = await tgSend(`🧪 <b>Test Notification</b>\n\nSentinel SOC Telegram integration is working correctly! ✅\n\nSent by: ${req.user?.username}`);
    res.json(result);
});

app.get("/api/telegram/status", authenticate, (req, res) => {
    res.json({
        configured: !!(CONFIG.tgBotToken && CONFIG.tgChatId),
        autoNotifyCritical: CONFIG.tgAutoNotifyCritical,
        autoNotifyHigh: CONFIG.tgAutoNotifyHigh,
    });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
await initStorage();
initMailer();

app.listen(PORT, () => {
    console.log(`
  ┌────────────────────────────────────────────────────┐
  │  SENTINEL SOC Backend v2.5.0                       │
  │  Port      : ${PORT}                                   │
  │  Wazuh     : ${CONFIG.wazuhHost}        │
  │  Indexer   : ${CONFIG.indexerHost}      │
  │  Email     : ${CONFIG.smtpUser || "NOT CONFIGURED"}│
  │  Telegram  : ${CONFIG.tgBotToken ? "CONFIGURED ✓" : "NOT CONFIGURED"}│
  │  Auto-Crit : ${CONFIG.tgAutoNotifyCritical ? "ON" : "OFF"}                                 │
  └────────────────────────────────────────────────────┘
  `);
});