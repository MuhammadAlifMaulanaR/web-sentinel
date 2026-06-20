import { useEffect, useState } from "react";
import logo from "../assets/LOGO_SENTINEL-1.png";
import "./Topbar.css";

export default function Topbar({ user, onLogout, connectionStatus, lastUpdate, metrics }) {
    const [time, setTime] = useState(new Date());
    const [threatLevel, setThreatLevel] = useState("HIGH");

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (metrics.critical > 5) setThreatLevel("CRITICAL");
        else if (metrics.critical > 2 || metrics.high > 10) setThreatLevel("HIGH");
        else if (metrics.high > 5) setThreatLevel("ELEVATED");
        else setThreatLevel("GUARDED");
    }, [metrics]);

    const threatColors = {
        CRITICAL: "var(--red)",
        HIGH: "var(--amber)",
        ELEVATED: "#ffdd44",
        GUARDED: "var(--green)",
    };

    return (
        <header className="topbar">
            {/* Logo */}
            <div className="topbar-brand">
                <div className="brand-hex">
                    <img src={logo} alt="Sentinel web logo" className="topbar-logo" />
                    {/* <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
                        <polygon points="16,2 30,9 30,23 16,30 2,23 2,9"
                            stroke="var(--cyan)" strokeWidth="1.5" fill="rgba(0,200,255,0.08)" />
                        <text x="16" y="21" textAnchor="middle" fontFamily="Orbitron"
                            fontSize="10" fill="var(--cyan)" fontWeight="900">S</text>
                    </svg> */}
                </div>
                <div>
                    <div className="brand-title">SENTINEL</div>
                    <div className="brand-tagline">SECURITY OPS CENTER</div>
                </div>
            </div>

            {/* Center HUD metrics */}
            <div className="topbar-hud">
                <div className="hud-metric critical">
                    <span className="hud-value">{metrics.critical}</span>
                    <span className="hud-label">CRITICAL</span>
                    <div className="hud-bar" style={{ width: `${Math.min((metrics.critical / 20) * 100, 100)}%`, background: "var(--red)" }} />
                </div>
                <div className="hud-divider" />
                <div className="hud-metric high">
                    <span className="hud-value">{metrics.high}</span>
                    <span className="hud-label">HIGH</span>
                    <div className="hud-bar" style={{ width: `${Math.min((metrics.high / 20) * 100, 100)}%`, background: "var(--amber)" }} />
                </div>
                <div className="hud-divider" />
                <div className="hud-metric medium">
                    <span className="hud-value">{metrics.medium}</span>
                    <span className="hud-label">MEDIUM</span>
                    <div className="hud-bar" style={{ width: `${Math.min((metrics.medium / 20) * 100, 100)}%`, background: "#ffdd44" }} />
                </div>
                <div className="hud-divider" />
                <div className="hud-metric total">
                    <span className="hud-value">{metrics.total}</span>
                    <span className="hud-label">TOTAL</span>
                </div>

                <div className="threat-level-badge" style={{ borderColor: threatColors[threatLevel], color: threatColors[threatLevel] }}>
                    <span className="tl-dot" style={{ background: threatColors[threatLevel] }} />
                    THREAT LEVEL: {threatLevel}
                </div>
            </div>

            {/* Right status area */}
            <div className="topbar-right">
                {/* Time */}
                <div className="system-clock">
                    <div className="clock-time">{time.toLocaleTimeString("en-US", { hour12: false })}</div>
                    <div className="clock-date">{time.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</div>
                </div>

                {/* Connection status */}
                <div className={`conn-status ${connectionStatus}`}>
                    <div className="conn-dot" />
                    <span>WAZUH {connectionStatus.toUpperCase()}</span>
                </div>

                {/* User info */}
                <div className="user-menu">
                    <div className="user-avatar">{user?.username?.[0]?.toUpperCase() || "O"}</div>
                    <div className="user-info">
                        <div className="user-name">{user?.username || "OPERATOR"}</div>
                        <div className="user-role">{user?.role || "SOC_ANALYST"}</div>
                    </div>
                    <button className="logout-btn" onClick={onLogout} title="Logout">⏻</button>
                </div>
            </div>
        </header>
    );
}