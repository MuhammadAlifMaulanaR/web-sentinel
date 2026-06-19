/**
 * SENTINEL SOC — Telegram Bot Integration
 */
import https from "https";

// ─── HTML escape ──────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ─── Core send ────────────────────────────────────────────────────────────────
export async function sendTelegram(botToken, chatId, text) {
    if (!botToken || !chatId) {
        return { ok: false, reason: "Telegram not configured" };
    }

    return new Promise((resolve) => {
        const body = JSON.stringify({
            chat_id: String(chatId),
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
        });

        const req = https.request({
            hostname: "api.telegram.org",
            path: `/bot${botToken}/sendMessage`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    if (json.ok) resolve({ ok: true, messageId: json.result?.message_id });
                    else resolve({ ok: false, reason: json.description || "Telegram API error" });
                } catch {
                    resolve({ ok: false, reason: "Invalid JSON from Telegram" });
                }
            });
        });

        req.on("error", err => resolve({ ok: false, reason: err.message }));
        req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, reason: "Timeout" }); });
        req.write(body);
        req.end();
    });
}

// ─── Message templates ────────────────────────────────────────────────────────
const SEV_EMOJI = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
const timeWITA = (iso) => new Date(iso || Date.now())
    .toLocaleString("en-GB", { hour12: false, timeZone: "Asia/Makassar" });

export function msgNewAlert(alert, systemName) {
    const e = SEV_EMOJI[alert.severity] || "⚪";
    return `${e} <b>[${(alert.severity || "?").toUpperCase()}] NEW ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━
🔔 <b>Rule:</b> ${escHtml(alert.rule)}
📊 <b>Level:</b> <code>${alert.level}/15</code>
⚔️ <b>Tactic:</b> ${escHtml(alert.tactic)}
🖥 <b>Agent:</b> <code>${escHtml(alert.agent)}</code>
🌐 <b>Src IP:</b> <code>${escHtml(alert.srcIp || "N/A")}</code>
📍 <b>Origin:</b> ${escHtml(alert.srcGeo?.name || "Unknown")} [${escHtml(alert.srcGeo?.code || "XX")}]
🕒 <b>Time:</b> ${timeWITA(alert.timestamp)} WITA
━━━━━━━━━━━━━━━━━━━━━━━━
🛡 <i>${escHtml(systemName)}</i>`;
}

export function msgEscalation(alert, note, operator, systemName) {
    return `📡 <b>[ESCALATION] ALERT → TIER 2</b>
━━━━━━━━━━━━━━━━━━━━━━━━
🔔 <b>Rule:</b> ${escHtml(alert.rule)}
⚠️ <b>Severity:</b> ${(alert.severity || "?").toUpperCase()} — Level ${alert.level}/15
⚔️ <b>Tactic:</b> ${escHtml(alert.tactic)}
🖥 <b>Agent:</b> <code>${escHtml(alert.agent)}</code>
🌐 <b>Src IP:</b> <code>${escHtml(alert.srcIp || "N/A")}</code>
👤 <b>Escalated by:</b> ${escHtml(operator)}
🕒 <b>Time:</b> ${timeWITA(null)} WITA
${note ? `📝 <b>Note:</b> ${escHtml(note)}` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━
🛡 <i>${escHtml(systemName)}</i>`;
}

export function msgBlockIp(ip, alert, operator, wazuhOk, systemName) {
    return `🚫 <b>[BLOCK] IP BLOCKED</b>
━━━━━━━━━━━━━━━━━━━━━━━━
🌐 <b>IP:</b> <code>${escHtml(ip)}</code>
🔔 <b>Rule:</b> ${escHtml(alert?.rule || "Manual")}
🖥 <b>Agent:</b> <code>${escHtml(alert?.agent || "N/A")}</code>
👤 <b>Blocked by:</b> ${escHtml(operator)}
🔧 <b>Wazuh AR:</b> ${wazuhOk ? "✅ Sent" : "⚠️ Failed"}
🕒 <b>Time:</b> ${timeWITA(null)} WITA
━━━━━━━━━━━━━━━━━━━━━━━━
🛡 <i>${escHtml(systemName)}</i>`;
}

export function msgCritical(alert, systemName) {
    return `🚨 <b>CRITICAL — IMMEDIATE ACTION REQUIRED</b>
━━━━━━━━━━━━━━━━━━━━━━━━
🔔 <b>Rule:</b> ${escHtml(alert.rule)}
📊 <b>Level:</b> <code>${alert.level}/15</code>
⚔️ <b>Tactic:</b> ${escHtml(alert.tactic)}
🖥 <b>Agent:</b> <code>${escHtml(alert.agent)}</code>
🌐 <b>Src IP:</b> <code>${escHtml(alert.srcIp || "N/A")}</code>
📍 <b>Origin:</b> ${escHtml(alert.srcGeo?.name || "Unknown")}
🕒 <b>Time:</b> ${timeWITA(alert.timestamp)} WITA
━━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>Login to Sentinel SOC immediately!</b>
🛡 <i>${escHtml(systemName)}</i>`;
}

export function msgUnblock(ip, operator, systemName) {
    return `🔓 <b>[UNBLOCK] IP REMOVED FROM BLOCKLIST</b>
━━━━━━━━━━━━━━━━━━━━━━━━
🌐 <b>IP:</b> <code>${escHtml(ip)}</code>
👤 <b>Unblocked by:</b> ${escHtml(operator)}
🕒 <b>Time:</b> ${timeWITA(null)} WITA
━━━━━━━━━━━━━━━━━━━━━━━━
🛡 <i>${escHtml(systemName)}</i>`;
}