import { useCallback, useEffect, useState } from "react";
import "./TelegramStatusBadge.css";

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
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
};

export default function TelegramStatusBadge() {
    const [status, setStatus] = useState(null);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const fetchStatus = useCallback(async () => {
        try {
            const data = await apiFetch("/api/telegram/status");
            setStatus(data);
        } catch {
            setStatus({ configured: false });
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await apiFetch("/api/telegram/test", { method: "POST" });
            setTestResult(result);
        } catch (err) {
            setTestResult({ ok: false, reason: err.message });
        } finally {
            setTesting(false);
            setTimeout(() => setTestResult(null), 5000);
        }
    };

    if (!status) return null;

    return (
        <div className="tg-status-widget">
            <div className="tg-status-row">
                <span className="tg-icon">✈️</span>
                <span className="tg-label">TELEGRAM</span>
                <span className={`tg-dot ${status.configured ? "active" : "inactive"}`} />
                <span className={`tg-state ${status.configured ? "text-green" : "text-muted"}`}>
                    {status.configured ? "CONFIGURED" : "NOT SET UP"}
                </span>
            </div>

            {status.configured && (
                <>
                    <div className="tg-sub-row">
                        <span className="tg-sub-label">AUTO CRITICAL</span>
                        <span className={status.autoNotifyCritical ? "text-green" : "text-muted"}>
                            {status.autoNotifyCritical ? "ON" : "OFF"}
                        </span>
                    </div>
                    <div className="tg-sub-row">
                        <span className="tg-sub-label">AUTO HIGH</span>
                        <span className={status.autoNotifyHigh ? "text-green" : "text-muted"}>
                            {status.autoNotifyHigh ? "ON" : "OFF"}
                        </span>
                    </div>
                    <button className="tg-test-btn" onClick={handleTest} disabled={testing}>
                        {testing ? "SENDING..." : "SEND TEST MESSAGE"}
                    </button>
                    {testResult && (
                        <div className={`tg-test-result ${testResult.ok ? "success" : "error"}`}>
                            {testResult.ok ? "✓ Test message sent!" : `✗ ${testResult.reason}`}
                        </div>
                    )}
                </>
            )}

            {!status.configured && (
                <div className="tg-setup-hint">
                    Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in backend/.env
                </div>
            )}
        </div>
    );
}