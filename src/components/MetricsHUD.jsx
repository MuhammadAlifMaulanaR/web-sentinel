import "./MetricsHUD.css";

export default function MetricsHUD({ metrics, alertCount, agents }) {
    const activeAgents = agents.filter(a => a.status === "active").length;
    const criticalRate = alertCount > 0 ? ((metrics.critical / alertCount) * 100).toFixed(1) : 0;

    const cards = [
        {
            label: "CRITICAL ALERTS",
            value: metrics.critical,
            color: "var(--red)",
            glow: "var(--red-glow)",
            icon: "⬡",
            trend: "+2",
            trendUp: true,
        },
        {
            label: "HIGH SEVERITY",
            value: metrics.high,
            color: "var(--amber)",
            glow: "rgba(255,170,0,0.12)",
            icon: "⬡",
            trend: "+5",
            trendUp: true,
        },
        {
            label: "TOTAL ALERTS",
            value: metrics.total,
            color: "var(--cyan)",
            glow: "var(--cyan-glow)",
            icon: "⬡",
            sub: `${criticalRate}% critical rate`,
        },
        {
            label: "ACTIVE AGENTS",
            value: activeAgents,
            color: "var(--green)",
            glow: "rgba(0,255,136,0.08)",
            icon: "⬡",
            sub: `${agents.length - activeAgents} offline`,
        },
    ];

    return (
        <div className="metrics-hud">
            {cards.map((card, i) => (
                <div
                    key={i}
                    className="metric-card"
                    style={{ "--accent": card.color, "--glow": card.glow }}
                >
                    <div className="metric-card-inner">
                        <div className="mc-header">
                            <span className="mc-label">{card.label}</span>
                            {card.trend && (
                                <span className={`mc-trend ${card.trendUp ? "up" : "down"}`}>
                                    {card.trendUp ? "▲" : "▼"} {card.trend}
                                </span>
                            )}
                        </div>

                        <div className="mc-value" style={{ color: card.color }}>
                            {card.value}
                            <span className="mc-value-blink" />
                        </div>

                        {card.sub && (
                            <div className="mc-sub">{card.sub}</div>
                        )}

                        <div className="mc-bar-track">
                            <div
                                className="mc-bar-fill"
                                style={{
                                    width: `${Math.min((card.value / Math.max(metrics.total, 1)) * 100, 100)}%`,
                                    background: card.color
                                }}
                            />
                        </div>
                    </div>

                    <div className="mc-corner-decoration">
                        <span className="corner c1" />
                        <span className="corner c2" />
                        <span className="corner c3" />
                        <span className="corner c4" />
                    </div>
                </div>
            ))}
        </div>
    );
}