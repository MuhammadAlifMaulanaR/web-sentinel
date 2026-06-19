import { useCallback, useEffect, useState } from "react";
import AgentsPanel from "./AgentsPanel";
import AgentStatsPanel from "./AgentStatsPanel";
import AlertsFeed from "./AlertsFeed";
import BlockedIpsPanel from "./BlockedIpsPanel";
import "./Dashboard.css";
import MetricsHUD from "./MetricsHUD";
import MitrePanel from "./MitrePanel";
import Sidebar from "./Sidebar";
import ThreatMap from "./ThreatMap";
import Topbar from "./Topbar";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const getToken = () => localStorage.getItem("sentinel_token");

const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });
    if (res.status === 401) {
        localStorage.removeItem("sentinel_token");
        window.location.reload();
        throw new Error("Session expired");
    }
    if (!res.ok) {
        let message = `API error ${res.status}`;
        try { const d = await res.json(); message = d?.detail || d?.error || message; } catch { }
        throw new Error(message);
    }
    return res.json();
};

function buildMetrics(alertList) {
    return alertList.reduce(
        (acc, a) => {
            const sev = a?.severity || "low";
            acc[sev] = (acc[sev] || 0) + 1;
            acc.total += 1;
            return acc;
        },
        { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    );
}

function normalizeAlert(raw) {
    if (!raw || typeof raw !== "object") return null;
    const level = Number(raw.level) || 0;
    let severity = "low";
    if (level >= 14) severity = "critical";
    else if (level >= 10) severity = "high";
    else if (level >= 7) severity = "medium";

    return {
        id: raw.id || `alert-${Date.now()}-${Math.random()}`,
        timestamp: raw.timestamp || new Date().toISOString(),
        rule: String(raw.rule || "Unknown Rule"),
        level, severity,
        tactic: String(raw.tactic || "Unknown"),
        technique: raw.technique || null,
        agent: String(raw.agent || "unknown"),
        agentId: raw.agentId || null,
        agentIp: raw.agentIp || null,
        srcIp: raw.srcIp || null,
        fullLog: raw.fullLog || null,
        srcGeo: raw.srcGeo?.name && raw.srcGeo.name !== "Unknown" ? raw.srcGeo : null,
        dstGeo: {
            name: import.meta.env.VITE_SYSTEM_NAME || "Protected System",
            lat: Number(import.meta.env.VITE_SYSTEM_LAT || -5.1477),
            lng: Number(import.meta.env.VITE_SYSTEM_LNG || 119.4327),
            code: "ID",
        },
        acknowledged: Boolean(raw.acknowledged),
        escalated: Boolean(raw.escalated),
        blocked: Boolean(raw.blocked),
    };
}

function normalizeAgent(raw) {
    return {
        id: raw.id || "000",
        name: String(raw.name || "unknown"),
        ip: raw.ip && raw.ip !== "any" ? raw.ip : raw.registerIP || "N/A",
        os: raw.os?.name || raw.os?.platform || String(raw.os || "Unknown OS"),
        status: String(raw.status || "").toLowerCase() === "active" ? "active" : "disconnected",
        lastKeepAlive: raw.lastKeepAlive ? new Date(raw.lastKeepAlive) : new Date(),
        alertCount: Number(raw.alertCount) || 0,
    };
}

export default function Dashboard({ user, onLogout }) {
    const [activeView, setActiveView] = useState("overview");
    const [alerts, setAlerts] = useState([]);
    const [alertTotal, setAlertTotal] = useState(0);
    const [metrics, setMetrics] = useState({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [agentStats, setAgentStats] = useState(null);
    const [blockedCount, setBlockedCount] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState("connecting");
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [error, setError] = useState(null);

    // ── Fetch alerts ──────────────────────────────────────────────────────────
    const fetchAlerts = useCallback(async (nextFrom = 0, append = false) => {
        try {
            const data = await apiFetch(`/api/alerts?limit=200&from=${nextFrom}&hours=24`);
            const normalized = (data.alerts || []).map(normalizeAlert).filter(Boolean);
            setAlerts(prev => {
                const merged = append ? [...prev, ...normalized] : normalized;
                setMetrics(buildMetrics(merged));
                return merged;
            });
            setAlertTotal(data.total || normalized.length);
            setConnectionStatus("connected");
            setLastUpdate(new Date());
            setError(null);
        } catch (err) {
            console.error("fetchAlerts:", err.message);
            setConnectionStatus("disconnected");
            setError(err.message);
        }
    }, []);

    // ── Fetch agents ──────────────────────────────────────────────────────────
    const fetchAgents = useCallback(async () => {
        try {
            const data = await apiFetch("/api/agents");
            const items = data?.data?.affected_items || data?.agents || [];
            setAgents(items.filter(a => a.id !== "000").map(normalizeAgent));
        } catch (err) {
            console.error("fetchAgents:", err.message);
        }
    }, []);

    // ── Fetch blocked IPs count for sidebar badge ─────────────────────────────
    const fetchBlockedCount = useCallback(async () => {
        try {
            const data = await apiFetch("/api/blocked-ips");
            const active = (data.blockedIps || []).filter(e => e.active).length;
            setBlockedCount(active);
        } catch { }
    }, []);

    // ── Agent stats ───────────────────────────────────────────────────────────
    const loadAgentStats = useCallback(async (agent) => {
        if (!agent?.name) return;
        setSelectedAgent(agent);
        setAgentStats(null);
        try {
            const data = await apiFetch(`/api/agents/${encodeURIComponent(agent.name)}/stats?hours=24`);
            setAgentStats(data);
        } catch {
            setAgentStats({ agent: agent.name, total: 0, timeline: [], severity: { critical: 0, high: 0, medium: 0, low: 0 }, topSourceIps: [], topRules: [] });
        }
    }, []);

    // ── Polling ───────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchAlerts();
        fetchAgents();
        fetchBlockedCount();
    }, [fetchAlerts, fetchAgents, fetchBlockedCount]);

    useEffect(() => {
        const a = setInterval(() => fetchAlerts(), 10000);
        const b = setInterval(fetchAgents, 30000);
        const c = setInterval(fetchBlockedCount, 15000);
        return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
    }, [fetchAlerts, fetchAgents, fetchBlockedCount]);

    // ── SOC actions ───────────────────────────────────────────────────────────
    const sendAction = useCallback(async (alert, action, extra = {}) => {
        if (!alert?.id) return;
        try {
            const result = await apiFetch(`/api/alerts/${encodeURIComponent(alert.id)}/actions`, {
                method: "POST",
                body: JSON.stringify({
                    action,
                    srcIp: alert.srcIp,
                    agent: alert.agent,
                    rule: alert.rule,
                    alertData: {
                        id: alert.id,
                        rule: alert.rule,
                        level: alert.level,
                        severity: alert.severity,
                        tactic: alert.tactic,
                        technique: alert.technique,
                        agent: alert.agent,
                        agentIp: alert.agentIp,
                        srcIp: alert.srcIp,
                        srcGeo: alert.srcGeo,
                        timestamp: alert.timestamp,
                        fullLog: alert.fullLog,
                    },
                    ...extra,
                }),
            });

            // Show email result toast for escalation
            if (action === "escalate" && result?.email) {
                const msg = result.email.sent
                    ? `✓ Escalation email sent (${result.email.messageId})`
                    : `⚠ Escalated but email failed: ${result.email.reason}`;
                console.info("[Escalate]", msg);
            }

            // Update local state
            setAlerts(prev => prev.map(a => {
                if (a.id !== alert.id) return a;
                return {
                    ...a,
                    acknowledged: action === "acknowledge" ? true : a.acknowledged,
                    escalated: action === "escalate" ? true : a.escalated,
                    blocked: action === "block" ? true : a.blocked,
                };
            }));

            // Refresh blocked count after block action
            if (action === "block") fetchBlockedCount();

            return result;
        } catch (err) {
            console.error("Action failed:", err.message);
            throw err;
        }
    }, [fetchBlockedCount]);

    const acknowledgeAlert = useCallback((a) => sendAction(a, "acknowledge"), [sendAction]);
    const investigateAlert = useCallback((a) => sendAction(a, "investigate"), [sendAction]);
    const blockIp = useCallback((a) => sendAction(a, "block"), [sendAction]);
    const escalateAlert = useCallback((a, note) => sendAction(a, "escalate", { note }), [sendAction]);

    return (
        <div className="dashboard-root">
            <Topbar
                user={user} onLogout={onLogout}
                connectionStatus={connectionStatus}
                lastUpdate={lastUpdate} metrics={metrics}
            />

            <div className="dashboard-body">
                <Sidebar
                    activeView={activeView} onNavigate={setActiveView}
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    metrics={metrics}
                    blockedCount={blockedCount}
                />

                <main className={`dashboard-content ${sidebarCollapsed ? "expanded" : ""}`}>
                    {error && (
                        <div className="error-banner-top">
                            <span>⚠ WAZUH: {error}</span>
                            <button onClick={() => { fetchAlerts(); fetchAgents(); }}>RETRY</button>
                        </div>
                    )}

                    {activeView === "overview" && (
                        <div className="overview-layout">
                            <MetricsHUD metrics={metrics} alertCount={alerts.length} agents={agents} />
                            <div className="overview-main">
                                <div className="map-container"><ThreatMap alerts={alerts} /></div>
                                <div className="feed-container">
                                    <AlertsFeed
                                        alerts={alerts.slice(0, 50)}
                                        onAcknowledge={acknowledgeAlert}
                                        onInvestigate={investigateAlert}
                                        onBlockIp={blockIp}
                                        onEscalate={escalateAlert}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === "threats" && (
                        <div className="single-panel-layout">
                            <AlertsFeed
                                alerts={alerts}
                                onAcknowledge={acknowledgeAlert}
                                onInvestigate={investigateAlert}
                                onBlockIp={blockIp}
                                onEscalate={escalateAlert}
                                fullMode
                                hasMore={alerts.length < alertTotal}
                                onLoadMore={() => fetchAlerts(alerts.length, true)}
                            />
                        </div>
                    )}

                    {activeView === "mitre" && (
                        <div className="single-panel-layout">
                            <MitrePanel alerts={alerts} />
                        </div>
                    )}

                    {activeView === "agents" && (
                        <div className="agents-layout">
                            <AgentsPanel agents={agents} selectedAgent={selectedAgent} onSelectAgent={loadAgentStats} />
                            <AgentStatsPanel stats={agentStats} selectedAgent={selectedAgent} />
                        </div>
                    )}

                    {activeView === "blocked" && (
                        <div className="single-panel-layout">
                            <BlockedIpsPanel />
                        </div>
                    )}

                    {activeView === "map" && (
                        <div className="single-panel-layout fullscreen-map">
                            <ThreatMap alerts={alerts} fullscreen />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}