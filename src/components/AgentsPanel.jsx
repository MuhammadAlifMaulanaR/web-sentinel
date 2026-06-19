import "./AgentsPanel.css";

export default function AgentsPanel({ agents = [], selectedAgent, onSelectAgent }) {
    const formatKeepAlive = (date) => {
        const diff = Math.floor((Date.now() - new Date(date)) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    };

    return (
        <div className="agents-panel panel">
            <div className="panel-header">
                <div className="panel-title">
                    <div className="panel-title-icon" />
                    MONITORED AGENTS
                </div>

                <div className="agents-summary">
                    <span className="text-green" style={{ fontSize: "9px", fontFamily: "var(--font-mono)" }}>
                        {agents.filter(a => a.status === "active").length} ACTIVE
                    </span>
                    <span className="text-muted" style={{ fontSize: "9px", fontFamily: "var(--font-mono)", margin: "0 6px" }}>|</span>
                    <span className="text-red" style={{ fontSize: "9px", fontFamily: "var(--font-mono)" }}>
                        {agents.filter(a => a.status !== "active").length} OFFLINE
                    </span>
                </div>
            </div>

            <div className="panel-body">
                {agents.length === 0 ? (
                    <div className="mono text-muted" style={{ padding: "20px", fontSize: "12px" }}>
                        NO AGENTS DETECTED
                    </div>
                ) : (
                    <div className="agents-grid">
                        {agents.map((agent) => (
                            <div
                                key={agent.id}
                                className={`agent-card ${agent.status} ${selectedAgent?.id === agent.id ? "selected" : ""}`}
                                onClick={() => onSelectAgent?.(agent)}
                            >
                                <div className="agent-card-header">
                                    <div className="agent-status-indicator">
                                        <div className={`agent-status-dot ${agent.status}`} />
                                        <span className={`agent-status-label ${agent.status === "active" ? "text-green" : "text-red"}`}>
                                            {agent.status.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="agent-id mono text-muted" style={{ fontSize: "9px" }}>
                                        #{agent.id}
                                    </div>
                                </div>

                                <div className="agent-name">{agent.name}</div>
                                <div className="agent-ip text-cyan mono">{agent.ip}</div>
                                <div className="agent-os text-muted">{agent.os}</div>

                                <div className="agent-metrics">
                                    <div className="agent-metric">
                                        <span className="am-label">ALERTS</span>
                                        <span className={`am-value ${agent.alertCount > 0 ? "text-amber" : "text-green"}`}>
                                            {agent.alertCount}
                                        </span>
                                    </div>

                                    <div className="agent-metric">
                                        <span className="am-label">LAST SEEN</span>
                                        <span className="am-value">{formatKeepAlive(agent.lastKeepAlive)}</span>
                                    </div>
                                </div>

                                {agent.alertCount > 0 && (
                                    <div className="agent-alert-bar">
                                        <div
                                            className="agent-alert-fill"
                                            style={{ width: `${Math.min((agent.alertCount / 20) * 100, 100)}%` }}
                                        />
                                    </div>
                                )}

                                <div className="agent-card-corner" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}