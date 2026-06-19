import { useEffect, useRef, useState } from "react";
import "./LoginPage.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.3 + 0.1,
    opacity: Math.random() * 0.5 + 0.1,
}));

export default function LoginPage({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState("idle"); // idle | loading | error | success
    const [errorMsg, setErrorMsg] = useState("");
    const [bootLines, setBootLines] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [scanAngle, setScanAngle] = useState(0);
    const animRef = useRef(null);

    const BOOT_SEQUENCE = [
        "SENTINEL SECURITY OPS v2.4.1",
        "Initializing cryptographic modules...",
        "Loading MITRE ATT&CK framework... OK",
        "Connecting to Wazuh Indexer... OK",
        "GeoIP threat intelligence... LOADED",
        "JWT authentication engine... READY",
        "Defense-in-Depth protocols... ACTIVE",
        "All systems nominal. AWAITING OPERATOR.",
    ];

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            if (i < BOOT_SEQUENCE.length) {
                setBootLines((prev) => [...prev, BOOT_SEQUENCE[i]]);
                i++;
            } else {
                clearInterval(interval);
                setTimeout(() => setShowForm(true), 400);
            }
        }, 220);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let angle = 0;
        const animate = () => {
            angle = (angle + 0.5) % 360;
            setScanAngle(angle);
            animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animRef.current);
    }, []);

    const handleSubmit = async () => {
        if (!username || !password) {
            setErrorMsg("CREDENTIALS REQUIRED");
            setStatus("error");
            return;
        }

        setStatus("loading");
        setErrorMsg("");

        // Simulate auth — replace with actual API call
        // POST /api/auth/login { username, password }
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Login failed');
            }

            const data = await res.json();
            localStorage.setItem('sentinel_token', data.token);
            setStatus("success");
            setTimeout(() => onLogin({ username: data.username, role: data.role }), 800);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err.message || "AUTHENTICATION FAILED — ACCESS DENIED");
        }
    };

    const radarX = 50 + 44 * Math.cos((scanAngle * Math.PI) / 180);
    const radarY = 50 + 44 * Math.sin((scanAngle * Math.PI) / 180);

    return (
        <div className="login-root">
            {/* Animated background grid */}
            <div className="login-bg-grid" />
            <div className="login-scanline" />

            {/* Floating particles */}
            {PARTICLES.map((p) => (
                <div
                    key={p.id}
                    className="particle"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        opacity: p.opacity,
                        animationDuration: `${6 + p.speed * 20}s`,
                        animationDelay: `${-p.speed * 30}s`,
                    }}
                />
            ))}

            <div className="login-container">
                {/* Left panel — Radar */}
                <div className="login-visual-panel">
                    <div className="radar-wrapper">
                        <svg viewBox="0 0 100 100" className="radar-svg">
                            <defs>
                                <radialGradient id="radarGrad" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="rgba(0,200,255,0.05)" />
                                    <stop offset="100%" stopColor="transparent" />
                                </radialGradient>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>

                            {/* Grid rings */}
                            {[10, 22, 34, 44].map((r) => (
                                <circle key={r} cx="50" cy="50" r={r}
                                    fill="none" stroke="rgba(0,200,255,0.1)" strokeWidth="0.3" />
                            ))}

                            {/* Cross-hairs */}
                            <line x1="50" y1="6" x2="50" y2="94" stroke="rgba(0,200,255,0.08)" strokeWidth="0.3" />
                            <line x1="6" y1="50" x2="94" y2="50" stroke="rgba(0,200,255,0.08)" strokeWidth="0.3" />
                            <line x1="19" y1="19" x2="81" y2="81" stroke="rgba(0,200,255,0.05)" strokeWidth="0.3" />
                            <line x1="81" y1="19" x2="19" y2="81" stroke="rgba(0,200,255,0.05)" strokeWidth="0.3" />

                            {/* Sweep gradient */}
                            <defs>
                                <linearGradient id="sweepGrad" x1="50%" y1="50%" x2={`${radarX}%`} y2={`${radarY}%`} gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="rgba(0,200,255,0.5)" />
                                    <stop offset="100%" stopColor="transparent" />
                                </linearGradient>
                            </defs>

                            {/* Sweep line */}
                            <line
                                x1="50" y1="50"
                                x2={radarX} y2={radarY}
                                stroke="rgba(0,200,255,0.9)"
                                strokeWidth="0.6"
                                filter="url(#glow)"
                            />

                            {/* Sweep trail (pie wedge sim) */}
                            <path
                                d={`M 50 50 L ${50 + 44 * Math.cos(((scanAngle - 40) * Math.PI) / 180)} ${50 + 44 * Math.sin(((scanAngle - 40) * Math.PI) / 180)} A 44 44 0 0 1 ${radarX} ${radarY} Z`}
                                fill="rgba(0,200,255,0.04)"
                            />

                            {/* Blips */}
                            {[
                                { cx: 34, cy: 28, r: 1.2, color: "#ff3366" },
                                { cx: 68, cy: 42, r: 0.9, color: "#ffaa00" },
                                { cx: 55, cy: 65, r: 1.5, color: "#ff3366" },
                                { cx: 28, cy: 58, r: 0.8, color: "#00ff88" },
                                { cx: 72, cy: 70, r: 1.0, color: "#ffaa00" },
                            ].map((b, i) => (
                                <g key={i}>
                                    <circle cx={b.cx} cy={b.cy} r={b.r + 2} fill="none"
                                        stroke={b.color} strokeWidth="0.3" opacity="0.3"
                                        style={{ animation: `ripple 2s ease-out ${i * 0.4}s infinite` }} />
                                    <circle cx={b.cx} cy={b.cy} r={b.r}
                                        fill={b.color} filter="url(#glow)" opacity="0.9" />
                                </g>
                            ))}

                            {/* Center dot */}
                            <circle cx="50" cy="50" r="1.5" fill="var(--cyan)" filter="url(#glow)" />
                        </svg>

                        <div className="radar-label">THREAT DETECTION ACTIVE</div>
                        <div className="radar-stats">
                            <span className="stat-item text-red">5 THREATS</span>
                            <span className="stat-sep">|</span>
                            <span className="stat-item text-amber">3 WARNINGS</span>
                            <span className="stat-sep">|</span>
                            <span className="stat-item text-green">LIVE</span>
                        </div>
                    </div>

                    {/* Decorative hex grid */}
                    <div className="hex-decoration">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="hex-cell" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                    </div>
                </div>

                {/* Right panel — Login form */}
                <div className="login-form-panel">
                    {/* Logo */}
                    <div className="brand-header">
                        <div className="brand-icon">
                            <svg viewBox="0 0 48 48" fill="none">
                                <polygon points="24,4 44,14 44,34 24,44 4,34 4,14"
                                    stroke="var(--cyan)" strokeWidth="1.5" fill="rgba(0,200,255,0.05)" />
                                <polygon points="24,12 36,18 36,30 24,36 12,30 12,18"
                                    stroke="var(--cyan)" strokeWidth="0.8" fill="rgba(0,200,255,0.03)" opacity="0.6" />
                                <text x="24" y="29" textAnchor="middle" fontFamily="Orbitron"
                                    fontSize="12" fill="var(--cyan)" fontWeight="700">S</text>
                            </svg>
                        </div>
                        <div className="brand-text">
                            <h1 className="brand-name">SENTINEL</h1>
                            <p className="brand-sub">SECURITY OPERATIONS CENTER</p>
                        </div>
                    </div>

                    {/* Boot sequence */}
                    <div className="boot-terminal">
                        {bootLines.map((line, i) => (
                            <div key={i} className="boot-line" style={{ animationDelay: `${i * 0.05}s` }}>
                                <span className="boot-prefix">›</span> {line}
                            </div>
                        ))}
                        {bootLines.length < BOOT_SEQUENCE.length && (
                            <span className="cursor-blink">█</span>
                        )}
                    </div>

                    {/* Auth form */}
                    {showForm && (
                        <div className="auth-form">
                            <div className="form-divider">
                                <span className="divider-text">OPERATOR AUTHENTICATION</span>
                            </div>

                            <div className="input-group">
                                <label className="input-label">IDENTIFIER</label>
                                <div className={`input-wrapper ${username ? "has-value" : ""}`}>
                                    <span className="input-icon">⬡</span>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                        placeholder="USERNAME"
                                        className="sentinel-input"
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">ACCESS CODE</label>
                                <div className={`input-wrapper ${password ? "has-value" : ""}`}>
                                    <span className="input-icon">◈</span>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                        placeholder="PASSWORD"
                                        className="sentinel-input"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            {status === "error" && (
                                <div className="error-banner">
                                    <span className="error-icon">⚠</span>
                                    {errorMsg}
                                </div>
                            )}

                            <button
                                className={`login-btn ${status}`}
                                onClick={handleSubmit}
                                disabled={status === "loading" || status === "success"}
                            >
                                {status === "loading" && (
                                    <span className="btn-spinner" />
                                )}
                                {status === "success" ? (
                                    <span className="text-green">ACCESS GRANTED ✓</span>
                                ) : status === "loading" ? (
                                    "AUTHENTICATING..."
                                ) : (
                                    "INITIATE ACCESS"
                                )}
                                <span className="btn-corner tl" />
                                <span className="btn-corner tr" />
                                <span className="btn-corner bl" />
                                <span className="btn-corner br" />
                            </button>

                            <div className="security-notice">
                                <span>🔒 AES-256 · JWT · bcrypt</span>
                                <span>Rate Limited · Audit Logged</span>
                            </div>
                        </div>
                    )}

                    <div className="login-footer">
                        <span>SENTINEL v2.4.1</span>
                        <span>·</span>
                        <span>WAZUH 4.7.5</span>
                        <span>·</span>
                        <span className="text-green">SYSTEM NOMINAL</span>
                    </div>
                </div>
            </div>
        </div>
    );
}