import { useCallback, useMemo, useState } from "react";
import "./AlertsFeed.css";

// ─── Modal: Investigate ────────────────────────────────────────────────────────
function InvestigateModal({ alert, onClose }) {
    if (!alert) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <span className="modal-icon">🔍</span>
                        INVESTIGATE ALERT
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="investigate-grid">
                        <div className="inv-section">
                            <div className="inv-section-title">ALERT DETAILS</div>
                            <div className="inv-row"><span className="inv-key">Rule</span><span className="inv-val">{alert.rule}</span></div>
                            <div className="inv-row"><span className="inv-key">Level</span><span className="inv-val text-cyan">{alert.level}</span></div>
                            <div className="inv-row"><span className="inv-key">Severity</span><span className={`inv-val sev-${alert.severity}`}>{alert.severity?.toUpperCase()}</span></div>
                            <div className="inv-row"><span className="inv-key">Timestamp</span><span className="inv-val">{new Date(alert.timestamp).toLocaleString()}</span></div>
                            <div className="inv-row"><span className="inv-key">Tactic</span><span className="inv-val text-amber">{alert.tactic}</span></div>
                            <div className="inv-row"><span className="inv-key">Technique</span><span className="inv-val">{alert.technique || "N/A"}</span></div>
                        </div>
                        <div className="inv-section">
                            <div className="inv-section-title">SOURCE / AGENT</div>
                            <div className="inv-row"><span className="inv-key">Agent</span><span className="inv-val text-green">{alert.agent}</span></div>
                            <div className="inv-row"><span className="inv-key">Agent IP</span><span className="inv-val">{alert.agentIp || "N/A"}</span></div>
                            <div className="inv-row"><span className="inv-key">Source IP</span><span className="inv-val text-red">{alert.srcIp || "N/A"}</span></div>
                            <div className="inv-row"><span className="inv-key">Country</span><span className="inv-val">{alert.srcGeo?.name || "Unknown"} [{alert.srcGeo?.code || "XX"}]</span></div>
                            <div className="inv-row"><span className="inv-key">Alert ID</span><span className="inv-val mono" style={{ fontSize: "9px" }}>{alert.id}</span></div>
                        </div>
                    </div>
                    {alert.fullLog && (
                        <div className="inv-section" style={{ marginTop: 12 }}>
                            <div className="inv-section-title">FULL LOG</div>
                            <pre className="inv-log">{alert.fullLog}</pre>
                        </div>
                    )}
                    <div className="modal-actions">
                        {alert.srcIp && (
                            <a
                                href={`https://www.virustotal.com/gui/ip-address/${alert.srcIp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-btn investigate"
                            >
                                CHECK ON VIRUSTOTAL ↗
                            </a>
                        )}
                        {alert.srcIp && (
                            <a
                                href={`https://www.abuseipdb.com/check/${alert.srcIp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-btn escalate"
                            >
                                CHECK ABUSEIPDB ↗
                            </a>
                        )}
                        <button className="action-btn ack" onClick={onClose}>CLOSE</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Block IP ───────────────────────────────────────────────────────────
function BlockIpModal({ alert, onConfirm, onClose }) {
    if (!alert) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <span className="modal-icon">🚫</span>
                        BLOCK IP ADDRESS
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="block-warning">
                        <div className="warning-icon">⚠</div>
                        <div>
                            <div style={{ color: "var(--amber)", fontWeight: 700, marginBottom: 4 }}>CONFIRM BLOCK ACTION</div>
                            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                                You are about to request a block on:
                            </div>
                        </div>
                    </div>
                    <div className="block-ip-display">{alert.srcIp}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
                        Origin: {alert.srcGeo?.name || "Unknown"} · Rule: {alert.rule}
                    </div>
                    <div className="block-note">
                        This will send a block request to the backend. To enforce at firewall level,
                        configure Wazuh Active Response on the agent.
                    </div>
                    <div className="modal-actions">
                        <button className="action-btn block" onClick={() => { onConfirm(alert); onClose(); }}>
                            CONFIRM BLOCK
                        </button>
                        <button className="action-btn ack" onClick={onClose}>CANCEL</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Escalate ──────────────────────────────────────────────────────────
function EscalateModal({ alert, onConfirm, onClose }) {
    const [note, setNote] = useState("");
    if (!alert) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <span className="modal-icon">📡</span>
                        ESCALATE ALERT
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: 12 }}>
                        <div className="inv-row"><span className="inv-key">Rule</span><span className="inv-val">{alert.rule}</span></div>
                        <div className="inv-row"><span className="inv-key">Severity</span><span className={`inv-val sev-${alert.severity}`}>{alert.severity?.toUpperCase()}</span></div>
                        <div className="inv-row"><span className="inv-key">Agent</span><span className="inv-val text-green">{alert.agent}</span></div>
                    </div>
                    <label className="inv-section-title">ESCALATION NOTE</label>
                    <textarea
                        className="escalate-note"
                        placeholder="Describe the escalation reason..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={4}
                    />
                    <div className="modal-actions">
                        <button
                            className="action-btn escalate"
                            onClick={() => { onConfirm(alert, note); onClose(); }}
                        >
                            ESCALATE TO TIER 2
                        </button>
                        <button className="action-btn ack" onClick={onClose}>CANCEL</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main AlertsFeed ──────────────────────────────────────────────────────────
export default function AlertsFeed({
    alerts = [],
    onAcknowledge,
    onInvestigate,
    onBlockIp,
    onEscalate,
    fullMode,
    onLoadMore,
    hasMore,
}) {
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [modal, setModal] = useState(null); // null | { type, alert }

    // ─── Safe search filter — prevents black screen crash ─────────────────────
    const filtered = useMemo(() => {
        try {
            const keyword = String(search ?? "").trim().toLowerCase();

            return alerts
                .filter(a => {
                    if (!a || typeof a !== "object") return false;
                    return filter === "all" || a.severity === filter;
                })
                .filter(a => {
                    if (!keyword) return true;
                    try {
                        const fields = [
                            String(a.rule ?? ""),
                            String(a.agent ?? ""),
                            String(a.srcIp ?? ""),
                            String(a.tactic ?? ""),
                            String(a.srcGeo?.name ?? ""),
                            String(a.level ?? ""),
                        ].join(" ").toLowerCase();
                        return fields.includes(keyword);
                    } catch {
                        return false;
                    }
                });
        } catch (err) {
            console.error("AlertsFeed filter error:", err);
            return alerts;
        }
    }, [alerts, filter, search]);

    const formatTime = useCallback((iso) => {
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return "--:--:--";
            return d.toLocaleTimeString("en-GB", { hour12: false });
        } catch {
            return "--:--:--";
        }
    }, []);

    const handleSearchChange = useCallback((e) => {
        try {
            setSearch(e.target.value ?? "");
        } catch {
            setSearch("");
        }
    }, []);

    const openModal = useCallback((type, alert, e) => {
        e?.stopPropagation();
        setModal({ type, alert });
    }, []);

    const closeModal = useCallback(() => setModal(null), []);

    const unackedCount = useMemo(
        () => alerts.filter(a => a && !a.acknowledged).length,
        [alerts]
    );

    return (
        <>
            {/* ── Modals ── */}
            {modal?.type === "investigate" && (
                <InvestigateModal alert={modal.alert} onClose={closeModal} />
            )}
            {modal?.type === "block" && (
                <BlockIpModal
                    alert={modal.alert}
                    onConfirm={(a) => onBlockIp?.(a)}
                    onClose={closeModal}
                />
            )}
            {modal?.type === "escalate" && (
                <EscalateModal
                    alert={modal.alert}
                    onConfirm={(a, note) => onEscalate?.(a, note)}
                    onClose={closeModal}
                />
            )}

            <div className="alerts-feed panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon" />
                        ALERT FEED
                        {unackedCount > 0 && (
                            <span className="feed-count">{unackedCount}</span>
                        )}
                    </div>
                    <span className="mono text-muted" style={{ fontSize: "9px" }}>
                        {filtered.length}/{alerts.length} SHOWN
                    </span>
                </div>

                <div className="feed-toolbar">
                    <input
                        className="feed-search"
                        placeholder="Search rules, IPs, agents, tactics..."
                        value={search}
                        onChange={handleSearchChange}
                    />
                    <div className="feed-filters">
                        {["all", "critical", "high", "medium", "low"].map(f => (
                            <button
                                key={f}
                                className={`filter-btn ${filter === f ? "active" : ""} ${f}`}
                                onClick={() => setFilter(f)}
                            >
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="panel-body">
                    {filtered.length === 0 ? (
                        <div className="feed-empty">
                            <span className="mono text-muted" style={{ fontSize: "11px" }}>
                                {search ? `NO RESULTS FOR "${search}"` : "NO ALERTS MATCHING FILTER"}
                            </span>
                        </div>
                    ) : (
                        filtered.map((alert, idx) => {
                            if (!alert?.id) return null;
                            const isSelected = selectedAlert?.id === alert.id;
                            return (
                                <div
                                    key={alert.id}
                                    className={`alert-row ${alert.severity ?? "low"} ${alert.acknowledged ? "acked" : ""} ${isSelected ? "selected" : ""}`}
                                    onClick={() => setSelectedAlert(isSelected ? null : alert)}
                                    style={{ animationDelay: `${Math.min(idx, 20) * 0.02}s` }}
                                >
                                    <div className="alert-row-main">
                                        <span className={`sev-dot ${alert.severity ?? "low"}`} />
                                        <div className="alert-row-content">
                                            <div className="alert-rule-line">
                                                <span className="alert-rule">{alert.rule ?? "Unknown"}</span>
                                                <div className="alert-badges">
                                                    {alert.acknowledged && <span className="badge acked-badge">ACK</span>}
                                                    {alert.escalated && <span className="badge escalated-badge">ESC</span>}
                                                    {alert.blocked && <span className="badge blocked-badge">BLK</span>}
                                                    <span className="alert-level">LVL {alert.level ?? 0}</span>
                                                </div>
                                            </div>
                                            <div className="alert-meta-line">
                                                <span className="alert-agent">⬡ {alert.agent ?? "?"}</span>
                                                <span className="alert-sep">·</span>
                                                <span className="alert-src">{alert.srcIp ?? "N/A"}</span>
                                                <span className="alert-sep">·</span>
                                                <span className="alert-geo">{alert.srcGeo?.name ?? "Unknown"}</span>
                                            </div>
                                        </div>
                                        <div className="alert-row-right">
                                            <span className="alert-time">{formatTime(alert.timestamp)}</span>
                                            {!alert.acknowledged && (
                                                <button
                                                    className="ack-btn"
                                                    onClick={e => { e.stopPropagation(); onAcknowledge?.(alert); }}
                                                    title="Acknowledge"
                                                >✓</button>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="alert-details">
                                            <div className="detail-grid">
                                                <div className="detail-item">
                                                    <span className="detail-key">TACTIC</span>
                                                    <span className="detail-val text-amber">{alert.tactic ?? "Unknown"}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-key">SEVERITY</span>
                                                    <span className={`detail-val sev-${alert.severity}`}>{alert.severity?.toUpperCase()}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-key">SOURCE IP</span>
                                                    <span className="detail-val text-cyan">{alert.srcIp ?? "N/A"}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-key">ORIGIN</span>
                                                    <span className="detail-val">{alert.srcGeo?.name ?? "Unknown"} [{alert.srcGeo?.code ?? "XX"}]</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-key">AGENT</span>
                                                    <span className="detail-val">{alert.agent ?? "?"}</span>
                                                </div>
                                                <div className="detail-item">
                                                    <span className="detail-key">RULE LEVEL</span>
                                                    <span className="detail-val text-cyan">{alert.level ?? 0}</span>
                                                </div>
                                            </div>
                                            <div className="detail-actions">
                                                <button
                                                    className="action-btn investigate"
                                                    onClick={e => { openModal("investigate", alert, e); onInvestigate?.(alert); }}
                                                >
                                                    🔍 INVESTIGATE
                                                </button>
                                                <button
                                                    className="action-btn block"
                                                    disabled={!alert.srcIp || alert.blocked}
                                                    onClick={e => openModal("block", alert, e)}
                                                >
                                                    {alert.blocked ? "✓ BLOCKED" : "🚫 BLOCK IP"}
                                                </button>
                                                <button
                                                    className="action-btn escalate"
                                                    disabled={alert.escalated}
                                                    onClick={e => openModal("escalate", alert, e)}
                                                >
                                                    {alert.escalated ? "✓ ESCALATED" : "📡 ESCALATE"}
                                                </button>
                                                {!alert.acknowledged && (
                                                    <button
                                                        className="action-btn ack"
                                                        onClick={e => { e.stopPropagation(); onAcknowledge?.(alert); }}
                                                    >
                                                        ✓ ACKNOWLEDGE
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {fullMode && hasMore && (
                        <div style={{ padding: "14px", textAlign: "center" }}>
                            <button className="action-btn investigate" onClick={onLoadMore}>
                                ↓ LOAD MORE ALERTS
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}