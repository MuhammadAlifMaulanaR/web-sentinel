import { useCallback, useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import LoginPage from "./components/LoginPage";
import "./styles/global.css";

const SESSION_TIMEOUT = 5 * 60 * 1000;

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function isTokenValid(token) {
  const payload = parseJwt(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("sentinel_token");

    if (token && isTokenValid(token)) {
      const payload = parseJwt(token);
      setUser({
        username: payload.username || "admin",
        role: payload.role || "SOC_ANALYST",
      });
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem("sentinel_token");
    }
  }, []);

  const handleLogin = (userData) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setUser(userData);
      setIsAuthenticated(true);
      setIsTransitioning(false);
    }, 800);
  };

  const handleLogout = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("sentinel_token");
      setIsTransitioning(false);
    }, 600);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let timer;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout();
      }, SESSION_TIMEOUT);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, handleLogout]);

  return (
    <div className={`app-root ${isTransitioning ? "transitioning" : ""}`}>
      {!isAuthenticated ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}