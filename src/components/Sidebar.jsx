import "./Sidebar.css";
import TelegramStatusBadge from "./TelegramStatusBadge";

const NAV_ITEMS = [
    { id: "overview", icon: "⬡", label: "OVERVIEW", sub: "Main Dashboard" },
    { id: "map", icon: "◎", label: "THREAT MAP", sub: "GeoIP Visualization" },
    { id: "threats", icon: "⚡", label: "ALERTS", sub: "Alert Feed", badge: "critical" },
    { id: "mitre", icon: "⊞", label: "MITRE ATT&CK", sub: "Tactic Matrix" },
    { id: "agents", icon: "◈", label: "AGENTS", sub: "Monitored Hosts" },
    { id: "blocked", icon: "🚫", label: "BLOCKED IPs", sub: "Firewall Blocks", badge: "blocked" },
];

export default function Sidebar({ activeView, onNavigate, collapsed, onToggle, metrics, blockedCount = 0 }) {
    return (
        <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => {
                    const badgeVal = item.badge === "critical"
                        ? metrics.critical
                        : item.badge === "blocked"
                            ? blockedCount
                            : 0;

                    return (
                        <button
                            key={item.id}
                            className={`nav-item ${activeView === item.id ? "active" : ""}`}
                            onClick={() => onNavigate(item.id)}
                            title={collapsed ? item.label : ""}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {!collapsed && (
                                <div className="nav-text">
                                    <span className="nav-label">{item.label}</span>
                                    <span className="nav-sub">{item.sub}</span>
                                </div>
                            )}
                            {badgeVal > 0 && (
                                <span className={`nav-badge ${item.badge === "blocked" ? "amber" : "critical"}`}>
                                    {badgeVal}
                                </span>
                            )}
                            {activeView === item.id && <span className="nav-active-bar" />}
                        </button>
                    );
                })}
            </nav>

            {!collapsed && (
                <div className="sidebar-footer">
                    <div className="sys-status">
                        <div className="sys-status-row">
                            <span className="text-muted mono" style={{ fontSize: "9px" }}>WAZUH INDEXER</span>
                            <span className="text-green" style={{ fontSize: "9px" }}>● ONLINE</span>
                        </div>
                        <div className="sys-status-row">
                            <span className="text-muted mono" style={{ fontSize: "9px" }}>ACTIVE RESPONSE</span>
                            <span className="text-green" style={{ fontSize: "9px" }}>● READY</span>
                        </div>
                        <div className="sys-status-row">
                            <span className="text-muted mono" style={{ fontSize: "9px" }}>EMAIL ESCALATION</span>
                            <span className="text-green" style={{ fontSize: "9px" }}>● ACTIVE</span>
                        </div>
                    </div>
                    <TelegramStatusBadge />
                </div>
            )}

            <button className="sidebar-toggle" onClick={onToggle}>
                <span style={{
                    transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                    display: "inline-block",
                    transition: "transform 0.3s"
                }}>‹</span>
            </button>
        </aside>
    );
}