import { useMemo } from "react";
import "./MitrePanel.css";

const MITRE_TACTICS = [
    { id: "TA0001", name: "Initial Access", short: "INIT" },
    { id: "TA0002", name: "Execution", short: "EXEC" },
    { id: "TA0003", name: "Persistence", short: "PERS" },
    { id: "TA0004", name: "Privilege Escalation", short: "PRIV" },
    { id: "TA0005", name: "Defense Evasion", short: "DFEV" },
    { id: "TA0006", name: "Credential Access", short: "CRED" },
    { id: "TA0007", name: "Discovery", short: "DISC" },
    { id: "TA0008", name: "Lateral Movement", short: "LATM" },
    { id: "TA0009", name: "Collection", short: "COLL" },
    { id: "TA0010", name: "Exfiltration", short: "EXFL" },
    { id: "TA0011", name: "Command and Control", short: "C2" },
];

export default function MitrePanel({ alerts }) {
    const tacticCounts = useMemo(() => {
        const counts = {};
        alerts.forEach(a => {
            const key = a.tactic;
            if (!counts[key]) counts[key] = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
            counts[key].total++;
            counts[key][a.severity]++;
        });
        return counts;
    }, [alerts]);

    const maxCount = Math.max(...Object.values(tacticCounts).map(c => c.total), 1);

    return (
        <div className="mitre-panel panel">
            <div className="panel-header">
                <div className="panel-title">
                    <div className="panel-title-icon" />
                    MITRE ATT&CK COVERAGE
                </div>
                <span className="mono" style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                    {Object.keys(tacticCounts).length} TACTICS OBSERVED
                </span>
            </div>

            <div className="panel-body">
                <div className="mitre-matrix">
                    {MITRE_TACTICS.map((tactic) => {
                        const counts = tacticCounts[tactic.name] || null;
                        const intensity = counts ? counts.total / maxCount : 0;
                        const hasCritical = counts?.critical > 0;

                        return (
                            <div
                                key={tactic.id}
                                className={`tactic-cell ${counts ? "active" : "inactive"} ${hasCritical ? "has-critical" : ""}`}
                                style={{ "--intensity": intensity }}
                            >
                                <div className="tactic-id">{tactic.id}</div>
                                <div className="tactic-name">{tactic.name}</div>

                                {counts ? (
                                    <div className="tactic-stats">
                                        <div className="tactic-total">{counts.total}</div>
                                        <div className="tactic-breakdown">
                                            {counts.critical > 0 && <span className="tb-dot critical">{counts.critical}</span>}
                                            {counts.high > 0 && <span className="tb-dot high">{counts.high}</span>}
                                            {counts.medium > 0 && <span className="tb-dot medium">{counts.medium}</span>}
                                            {counts.low > 0 && <span className="tb-dot low">{counts.low}</span>}
                                        </div>
                                        <div className="tactic-heat-bar">
                                            <div className="tactic-heat-fill" style={{ height: `${intensity * 100}%` }} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="tactic-no-data">NO DATA</div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Summary table */}
                <div className="mitre-summary">
                    <div className="summary-header">
                        <span>TACTIC</span>
                        <span>TOTAL</span>
                        <span>CRITICAL</span>
                        <span>HIGH</span>
                        <span>MEDIUM</span>
                    </div>
                    {MITRE_TACTICS.filter(t => tacticCounts[t.name]).map(tactic => {
                        const c = tacticCounts[tactic.name];
                        return (
                            <div key={tactic.id} className="summary-row">
                                <span className="mono" style={{ fontSize: "10px" }}>{tactic.name}</span>
                                <span className="mono text-cyan" style={{ fontSize: "11px" }}>{c.total}</span>
                                <span className="mono sev-critical">{c.critical}</span>
                                <span className="mono sev-high">{c.high}</span>
                                <span className="mono sev-medium">{c.medium}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}