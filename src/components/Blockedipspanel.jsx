import { useCallback, useEffect, useState } from "react";
import "./BlockedIpsPanel.css";

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
    if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `API error ${res.status}`);
    }
    return res.json();
};

function formatDateTime(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
            hour12: false,
        });
    } catch { return iso; }
}

function TimeSince({ iso }) {
    const [label, setLabel] = useState("");
    useEffect(() => {
        const compute = () => {
            if (!iso) { setLabel("—"); return; }
            const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
            if (diff < 60) setLabel(`${diff}s ago`);
            else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m ago`);
            else if (diff < 86400) setLabel(`${Math.floor(diff / 3600)}h ago`);
            else setLabel(`${Math.floor(diff / 86400)}d ago`);
        };
        compute();
        const t = setInterval(compute, 10000);
        return () => clearInterval(t);
    }, [iso]);
    return <span>{label}</span>;
}

// ── Confirm unblock modal ──────────────────────────────────────────────────────
function UnblockModal({ entry, onConfirm, onClose }) {
    if (!entry) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <span className="modal-icon">🔓</span>
                        UNBLOCK IP ADDRESS
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="unblock-warning">
                        <div className="warning-icon">⚠</div>
                        <div>
                            <div style={{ color: "var(--amber)", fontWeight: 700, marginBottom: 4 }}>
                                CONFIRM UNBLOCK
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                                This will remove the firewall block for:
                            </div>
                        </div>
                    </div>
                    <div className="block-ip-display">{entry.ip}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
                        Blocked: {formatDateTime(entry.blockedAt)} · By: {entry.blockedBy}
                    </div>
                    <div className="block-note">
                        Wazuh Active Response will be sent to remove the iptables rule on the agent.
                        The IP will be removed from the Sentinel block list.
                    </div>
                    <div className="modal-actions">
                        <button className="action-btn block" onClick={() => { onConfirm(entry.ip); onClose(); }}>
                            CONFIRM UNBLOCK
                        </button>
                        <button className="action-btn ack" onClick={onClose}>CANCEL</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BlockedIpsPanel() {
    const [blockedIps, setBlockedIps] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("active"); // "active" | "all"
    const [search, setSearch] = useState("");
    const [unblockTarget, setUnblockTarget] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);

    const showToast = (msg, type = "success") => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3500);
    };

    const fetchBlockedIps = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiFetch("/api/blocked-ips");
            setBlockedIps(data.blockedIps || []);
            setTotal(data.total || 0);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBlockedIps();
        const t = setInterval(fetchBlockedIps, 30000);
        return () => clearInterval(t);
    }, [fetchBlockedIps]);

    const handleUnblock = useCallback(async (ip) => {
        try {
            await apiFetch(`/api/blocked-ips/${encodeURIComponent(ip)}`, { method: "DELETE" });
            showToast(`✓ IP ${ip} successfully unblocked`);
            fetchBlockedIps();
        } catch (err) {
            showToast(`✗ Unblock failed: ${err.message}`, "error");
        }
    }, [fetchBlockedIps]);

    const filtered = blockedIps
        .filter(e => filter === "all" || e.active)
        .filter(e => {
            if (!search) return true;
            const kw = search.toLowerCase();
            return (
                String(e.ip || "").includes(kw) ||
                String(e.rule || "").toLowerCase().includes(kw) ||
                String(e.agent || "").toLowerCase().includes(kw) ||
                String(e.blockedBy || "").toLowerCase().includes(kw)
            );
        });

    const activeCount = blockedIps.filter(e => e.active).length;
    const inactiveCount = blockedIps.filter(e => !e.active).length;

    return (
        <>
            {unblockTarget && (
                <UnblockModal
                    entry={unblockTarget}
                    onConfirm={handleUnblock}
                    onClose={() => setUnblockTarget(null)}
                />
            )}

            {toastMsg && (
                <div className={`bip-toast ${toastMsg.type}`}>
                    {toastMsg.msg}
                </div>
            )}

            <div className="blocked-ips-panel panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon" />
                        BLOCKED IP ADDRESSES
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="mono text-red" style={{ fontSize: 9 }}>
                            {activeCount} ACTIVE BLOCKS
                        </span>
                        {inactiveCount > 0 && (
                            <span className="mono text-muted" style={{ fontSize: 9 }}>
                                {inactiveCount} UNBLOCKED
                            </span>
                        )}
                        <button className="bip-refresh-btn" onClick={fetchBlockedIps} title="Refresh">↻</button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bip-toolbar">
                    <input
                        className="feed-search"
                        placeholder="Search IP, rule, agent..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className="feed-filters">
                        <button
                            className={`filter-btn ${filter === "active" ? "active critical" : ""}`}
                            onClick={() => setFilter("active")}
                        >ACTIVE</button>
                        <button
                            className={`filter-btn ${filter === "all" ? "active all" : ""}`}
                            onClick={() => setFilter("all")}
                        >ALL</button>
                    </div>
                </div>

                {/* Info box */}
                <div className="bip-info-box">
                    <span className="bip-info-icon">ℹ</span>
                    <span>
                        Block requests are sent via <strong>Wazuh Active Response</strong> (firewall-drop).
                        The IP is blocked at the <strong>agent's iptables</strong> level.
                        Column <em>Wazuh OK</em> shows whether the command was accepted by Wazuh.
                    </span>
                </div>

                <div className="panel-body">
                    {loading && (
                        <div className="bip-loading">
                            <div className="stats-loading-ring" />
                            <span className="mono text-muted" style={{ fontSize: 10 }}>LOADING...</span>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="bip-error">
                            <span>⚠ {error}</span>
                            <button onClick={fetchBlockedIps}>RETRY</button>
                        </div>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <div className="bip-empty">
                            <div className="bip-empty-icon">🛡</div>
                            <div className="mono text-muted" style={{ fontSize: 11, letterSpacing: 2 }}>
                                {filter === "active" ? "NO ACTIVE BLOCKS" : "NO BLOCKED IPs RECORDED"}
                            </div>
                            <div className="mono text-muted" style={{ fontSize: 9, marginTop: 6 }}>
                                Block an IP from the Alert Feed to see it here
                            </div>
                        </div>
                    )}

                    {!loading && filtered.length > 0 && (
                        <div className="bip-table-wrapper">
                            <table className="bip-table">
                                <thead>
                                    <tr>
                                        <th>STATUS</th>
                                        <th>IP ADDRESS</th>
                                        <th>RULE</th>
                                        <th>AGENT</th>
                                        <th>BLOCKED BY</th>
                                        <th>BLOCKED AT</th>
                                        <th>AGE</th>
                                        <th>WAZUH AR</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(entry => (
                                        <tr key={entry.ip + entry.blockedAt}
                                            className={entry.active ? "row-active" : "row-inactive"}>
                                            <td>
                                                <span className={`bip-status-dot ${entry.active ? "active" : "inactive"}`} />
                                                <span className={`bip-status-label ${entry.active ? "text-red" : "text-muted"}`}>
                                                    {entry.active ? "BLOCKED" : "CLEARED"}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="bip-ip">{entry.ip}</span>
                                            </td>
                                            <td>
                                                <span className="bip-rule" title={entry.rule}>
                                                    {entry.rule?.length > 40
                                                        ? entry.rule.substring(0, 40) + "..."
                                                        : entry.rule || "—"}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="mono text-green" style={{ fontSize: 10 }}>
                                                    {entry.agent || "—"}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="mono" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                                                    {entry.blockedBy || "—"}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
                                                    {formatDateTime(entry.blockedAt)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="mono text-amber" style={{ fontSize: 10 }}>
                                                    <TimeSince iso={entry.blockedAt} />
                                                </span>
                                            </td>
                                            <td>
                                                {entry.wazuhSuccess === true && (
                                                    <span className="bip-badge success">✓ SENT</span>
                                                )}
                                                {entry.wazuhSuccess === false && (
                                                    <span className="bip-badge failed">✗ FAILED</span>
                                                )}
                                                {entry.wazuhSuccess === undefined && (
                                                    <span className="bip-badge unknown">— N/A</span>
                                                )}
                                            </td>
                                            <td>
                                                {entry.active ? (
                                                    <button
                                                        className="bip-unblock-btn"
                                                        onClick={() => setUnblockTarget(entry)}
                                                    >
                                                        UNBLOCK
                                                    </button>
                                                ) : (
                                                    <span className="mono text-muted" style={{ fontSize: 9 }}>
                                                        {entry.unblockedAt
                                                            ? `Cleared ${formatDateTime(entry.unblockedAt)}`
                                                            : "—"}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer summary */}
                {blockedIps.length > 0 && (
                    <div className="bip-footer">
                        <span>Total recorded: <strong>{total}</strong></span>
                        <span>Active blocks: <strong className="text-red">{activeCount}</strong></span>
                        <span>Cleared: <strong className="text-muted">{inactiveCount}</strong></span>
                        <span className="mono text-muted" style={{ fontSize: 9 }}>
                            Auto-refresh every 30s
                        </span>
                    </div>
                )}
            </div>
        </>
    );
}