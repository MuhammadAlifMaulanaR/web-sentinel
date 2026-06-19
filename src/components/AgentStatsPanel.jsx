import { useMemo } from "react";
import "./AgentStatsPanel.css";

const SEV_COLORS = {
    critical: "#ff3366",
    high: "#ffaa00",
    medium: "#ffdd44",
    low: "#00ff88",
};

function MiniSparkline({ data = [], color = "var(--cyan)" }) {
    if (!data.length) return null;
    const max = Math.max(...data.map(d => d.count), 1);
    const W = 600, H = 80;
    const step = W / Math.max(data.length - 1, 1);

    const points = data.map((d, i) => ({
        x: i * step,
        y: H - (d.count / max) * (H - 8),
    }));

    const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
    const area = `M ${points[0]?.x ?? 0},${H} ` +
        points.map(p => `L ${p.x},${p.y}`).join(" ") +
        ` L ${points[points.length - 1]?.x ?? W},${H} Z`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="sparkline-svg" preserveAspectRatio="none">
            <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={area} fill="url(#sparkGrad)" />
            <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
                data[i]?.count > 0 && (
                    <circle key={i} cx={p.x} cy={p.y} r="2.5"
                        fill={color} opacity="0.8" />
                )
            ))}
        </svg>
    );
}

function SeverityDonut({ severity = {} }) {
    const total = Object.values(severity).reduce((a, b) => a + b, 0);
    if (!total) return (
        <div className="donut-empty">
            <span className="mono text-muted" style={{ fontSize: 10 }}>NO DATA</span>
        </div>
    );

    const entries = Object.entries(SEV_COLORS);
    let cumulative = 0;
    const R = 40, CX = 50, CY = 50, STROKE = 12;
    const circumference = 2 * Math.PI * R;

    const slices = entries.map(([key, color]) => {
        const count = severity[key] || 0;
        const pct = count / total;
        const dash = pct * circumference;
        const offset = circumference - cumulative * circumference;
        cumulative += pct;
        return { key, color, count, dash, offset };
    });

    return (
        <div className="donut-wrapper">
            <svg viewBox="0 0 100 100" className="donut-svg">
                <circle cx={CX} cy={CY} r={R} fill="none"
                    stroke="rgba(255,255,255,0.04)" strokeWidth={STROKE} />
                {slices.map(s => s.count > 0 && (
                    <circle key={s.key} cx={CX} cy={CY} r={R}
                        fill="none" stroke={s.color} strokeWidth={STROKE}
                        strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                        strokeDashoffset={s.offset}
                        style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }}
                    />
                ))}
                <text x={CX} y={CY - 4} textAnchor="middle"
                    fontFamily="Orbitron" fontSize="14" fill="var(--cyan)" fontWeight="700">
                    {total}
                </text>
                <text x={CX} y={CY + 10} textAnchor="middle"
                    fontFamily="Share Tech Mono" fontSize="6" fill="rgba(180,220,255,0.5)">
                    TOTAL
                </text>
            </svg>
            <div className="donut-legend">
                {entries.map(([key, color]) => (
                    <div key={key} className="donut-legend-row">
                        <span className="donut-dot" style={{ background: color }} />
                        <span className="donut-key">{key.toUpperCase()}</span>
                        <span className="donut-val" style={{ color }}>{severity[key] || 0}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function AgentStatsPanel({ stats, selectedAgent }) {
    const timelineData = useMemo(() => stats?.timeline || [], [stats]);
    const topRules = useMemo(() => (stats?.topRules || []).slice(0, 5), [stats]);
    const topIps = useMemo(() => (stats?.topSourceIps || []).slice(0, 5), [stats]);
    const maxIpCount = useMemo(() => Math.max(...topIps.map(i => i.count), 1), [topIps]);

    if (!selectedAgent) {
        return (
            <div className="panel agent-stats-panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon" />
                        AGENT ANALYTICS
                    </div>
                </div>
                <div className="stats-empty">
                    <div className="stats-empty-icon">◈</div>
                    <div className="mono text-muted" style={{ fontSize: 11, letterSpacing: 2 }}>
                        SELECT AN AGENT TO VIEW ANALYTICS
                    </div>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="panel agent-stats-panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon" />
                        AGENT ANALYTICS — {selectedAgent.name}
                    </div>
                </div>
                <div className="stats-empty">
                    <div className="stats-loading-ring" />
                    <div className="mono text-muted" style={{ fontSize: 11, letterSpacing: 2, marginTop: 12 }}>
                        LOADING...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="panel agent-stats-panel">
            <div className="panel-header">
                <div className="panel-title">
                    <div className="panel-title-icon" />
                    ANALYTICS — <span className="text-cyan" style={{ marginLeft: 4 }}>{selectedAgent.name}</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span className="mono text-muted" style={{ fontSize: 9 }}>24H WINDOW</span>
                    <span className="mono text-cyan" style={{ fontSize: 11, fontWeight: 700 }}>
                        {stats.total} EVENTS
                    </span>
                </div>
            </div>

            <div className="panel-body agent-stats-body">

                {/* ── Severity donut + timeline ── */}
                <div className="stats-top-row">
                    <div className="stats-section donut-section">
                        <div className="stats-section-title">SEVERITY BREAKDOWN</div>
                        <SeverityDonut severity={stats.severity} />
                    </div>

                    <div className="stats-section timeline-section">
                        <div className="stats-section-title">
                            ALERT TIMELINE (30min intervals)
                        </div>
                        {timelineData.length > 0 ? (
                            <>
                                <MiniSparkline data={timelineData} color="var(--cyan)" />
                                <div className="timeline-labels">
                                    <span>{timelineData[0]?.time ? new Date(timelineData[0].time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                    <span>{timelineData[Math.floor(timelineData.length / 2)]?.time ? new Date(timelineData[Math.floor(timelineData.length / 2)].time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                    <span>{timelineData[timelineData.length - 1]?.time ? new Date(timelineData[timelineData.length - 1].time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                </div>
                            </>
                        ) : (
                            <div className="mono text-muted" style={{ fontSize: 10, padding: 20, textAlign: "center" }}>
                                NO TIMELINE DATA
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Top source IPs ── */}
                <div className="stats-section">
                    <div className="stats-section-title">TOP SOURCE IPs</div>
                    {topIps.length === 0 ? (
                        <div className="mono text-muted" style={{ fontSize: 10, padding: "8px 0" }}>NO SOURCE IP DATA</div>
                    ) : (
                        topIps.map((item, i) => (
                            <div key={item.ip} className="top-row">
                                <span className="top-rank">#{i + 1}</span>
                                <span className="top-label text-cyan mono">{item.ip}</span>
                                <div className="top-bar-track">
                                    <div className="top-bar-fill"
                                        style={{ width: `${(item.count / maxIpCount) * 100}%`, background: "var(--red)" }} />
                                </div>
                                <span className="top-count">{item.count}</span>
                            </div>
                        ))
                    )}
                </div>

                {/* ── Top rules ── */}
                <div className="stats-section">
                    <div className="stats-section-title">TOP TRIGGERED RULES</div>
                    {topRules.length === 0 ? (
                        <div className="mono text-muted" style={{ fontSize: 10, padding: "8px 0" }}>NO RULE DATA</div>
                    ) : (
                        topRules.map((item, i) => {
                            const maxCount = Math.max(...topRules.map(r => r.count), 1);
                            return (
                                <div key={item.rule} className="top-row">
                                    <span className="top-rank">#{i + 1}</span>
                                    <span className="top-label">{item.rule}</span>
                                    <div className="top-bar-track">
                                        <div className="top-bar-fill"
                                            style={{ width: `${(item.count / maxCount) * 100}%`, background: "var(--amber)" }} />
                                    </div>
                                    <span className="top-count">{item.count}</span>
                                </div>
                            );
                        })
                    )}
                </div>

            </div>
        </div>
    );
}