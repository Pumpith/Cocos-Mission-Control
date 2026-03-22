import { useState, useEffect } from "react";
import { Wifi, WifiOff, Clock, Timer } from "lucide-react";

// Hardcoded start time: 4 days, 12 hours ago
const UPTIME_START = Date.now() - (4 * 24 * 60 * 60 * 1000) - (12 * 60 * 60 * 1000) - (37 * 60 * 1000);

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour12: false });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatUptime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60) % 60;
  const hours = Math.floor(seconds / 3600) % 24;
  const days = Math.floor(seconds / 86400);
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export default function TopBar() {
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const uptime = now.getTime() - UPTIME_START;

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b"
      style={{
        borderColor: "rgba(0,255,156,0.15)",
        background: "rgba(5,5,8,0.98)",
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <span className="text-2xl" role="img" aria-label="lobster">🦞</span>
        <div>
          <span
            className="text-sm font-bold tracking-widest glow-text"
            style={{ color: "#00FF9C" }}
          >
            OPENCLAW
          </span>
          <span
            className="text-sm font-light tracking-widest ml-2"
            style={{ color: "rgba(0,255,156,0.4)" }}
          >
            // MISSION CONTROL
          </span>
        </div>
      </div>

      {/* Center: Clock */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Clock size={12} style={{ color: "rgba(0,255,156,0.5)" }} />
          <span
            className="text-xs tracking-wider"
            style={{ color: "rgba(0,255,156,0.7)" }}
          >
            {formatDate(now)}
          </span>
          <span
            className="text-sm font-bold glow-text blink-cursor"
            style={{ color: "#00FF9C" }}
          >
            {formatTime(now)}
          </span>
        </div>

        <div
          className="h-4 w-px"
          style={{ background: "rgba(0,255,156,0.15)" }}
        />

        <div className="flex items-center gap-2">
          <Timer size={12} style={{ color: "rgba(0,255,156,0.5)" }} />
          <span
            className="text-[10px] tracking-widest"
            style={{ color: "rgba(0,255,156,0.5)" }}
          >
            UPTIME:
          </span>
          <span
            className="text-xs font-bold"
            style={{ color: "#00B4FF", textShadow: "0 0 6px rgba(0,180,255,0.5)" }}
          >
            {formatUptime(uptime)}
          </span>
        </div>
      </div>

      {/* Right: Status */}
      <button
        onClick={() => setOnline(!online)}
        className="flex items-center gap-2 px-3 py-1 transition-all"
        style={{
          border: `1px solid ${online ? "rgba(0,255,156,0.3)" : "rgba(255,45,120,0.3)"}`,
          background: online ? "rgba(0,255,156,0.05)" : "rgba(255,45,120,0.05)",
        }}
        data-testid="status-toggle"
      >
        <div className={`status-dot ${online ? "online" : "offline"}`} />
        {online ? (
          <Wifi size={12} style={{ color: "#00FF9C" }} />
        ) : (
          <WifiOff size={12} style={{ color: "#FF2D78" }} />
        )}
        <span
          className="text-[10px] font-bold tracking-widest"
          style={{
            color: online ? "#00FF9C" : "#FF2D78",
            textShadow: online
              ? "0 0 6px rgba(0,255,156,0.5)"
              : "0 0 6px rgba(255,45,120,0.5)",
          }}
        >
          {online ? "AGENT ONLINE" : "AGENT OFFLINE"}
        </span>
      </button>
    </div>
  );
}
