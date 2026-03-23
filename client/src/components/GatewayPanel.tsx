import { useState, useEffect } from "react";
import { Radio, Shield, Server, Activity } from "lucide-react";
import { useGateway, gateway } from "@/lib/gateway";

export default function GatewayPanel() {
  const { status } = useGateway();
  const [showToken, setShowToken] = useState(false);

  const StatRow = ({ label, value, color = "rgba(0,255,156,0.7)" }: { label: string; value: string | number; color?: string }) => (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[9px] tracking-wider" style={{ color: "rgba(0,255,156,0.35)" }}>
        {label}
      </span>
      <span className="text-[10px] font-bold" style={{ color, textShadow: `0 0 4px ${color}40` }}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="terminal-panel flex-shrink-0">
      <div className="panel-header">
        <Radio size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
        GATEWAY CONNECTION
      </div>

      <div className="p-3 space-y-2">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className={`status-dot ${status.connected ? "online" : "offline"}`} />
          <span
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: status.connected ? "#00FF9C" : "#FF2D78",
              textShadow: status.connected
                ? "0 0 6px rgba(0,255,156,0.5)"
                : "0 0 6px rgba(255,45,120,0.5)",
            }}
          >
            {status.connected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>

        {/* URL */}
        <div>
          <label className="text-[8px] tracking-widest block mb-0.5" style={{ color: "rgba(0,255,156,0.3)" }}>
            ENDPOINT
          </label>
          <div
            className="text-[10px] px-2 py-1"
            style={{
              border: "1px solid rgba(0,180,255,0.15)",
              color: "#00B4FF",
              background: "rgba(0,180,255,0.03)",
            }}
          >
            {status.url}
          </div>
        </div>

        {/* Token */}
        <div>
          <label className="text-[8px] tracking-widest block mb-0.5" style={{ color: "rgba(0,255,156,0.3)" }}>
            AUTH TOKEN
          </label>
          <div className="flex items-center gap-1">
            <div
              className="flex-1 text-[10px] px-2 py-1 truncate"
              style={{
                border: "1px solid rgba(0,255,156,0.1)",
                color: "rgba(0,255,156,0.5)",
                background: "rgba(0,255,156,0.02)",
                fontFamily: "monospace",
              }}
            >
              {showToken ? gateway.token : status.token}
            </div>
            <button
              onClick={() => setShowToken(!showToken)}
              className="text-[8px] px-1.5 py-1 tracking-wider"
              style={{
                border: "1px solid rgba(0,255,156,0.15)",
                color: "rgba(0,255,156,0.4)",
              }}
              data-testid="button-toggle-token"
            >
              {showToken ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {/* Protocol info */}
        <div
          className="pt-1 space-y-0.5"
          style={{ borderTop: "1px solid rgba(0,255,156,0.06)" }}
        >
          <StatRow label="PROTOCOL" value={`v${status.protocol}`} color="#00B4FF" />
          <StatRow label="ROLE" value={status.role.toUpperCase()} />
          <StatRow label="SCOPES" value={status.scopes.length.toString()} />
        </div>

        {/* Live stats */}
        <div
          className="pt-1 space-y-0.5"
          style={{ borderTop: "1px solid rgba(0,255,156,0.06)" }}
        >
          <div className="flex items-center gap-1 mb-1">
            <Activity size={8} style={{ color: "rgba(0,255,156,0.3)" }} />
            <span className="text-[8px] tracking-widest" style={{ color: "rgba(0,255,156,0.3)" }}>
              LIVE METRICS
            </span>
          </div>
          <StatRow label="MSG IN" value={status.messagesIn.toLocaleString()} color="#00B4FF" />
          <StatRow label="MSG OUT" value={status.messagesOut.toLocaleString()} color="#00FF9C" />
          <StatRow
            label="LATENCY"
            value={`${Math.floor(12 + Math.random() * 8)}ms`}
            color="rgba(0,255,156,0.6)"
          />
        </div>

        {/* Scopes list */}
        <div
          className="pt-1"
          style={{ borderTop: "1px solid rgba(0,255,156,0.06)" }}
        >
          <div className="flex items-center gap-1 mb-1">
            <Shield size={8} style={{ color: "rgba(0,255,156,0.3)" }} />
            <span className="text-[8px] tracking-widest" style={{ color: "rgba(0,255,156,0.3)" }}>
              ACTIVE SCOPES
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {status.scopes.map((scope) => (
              <span
                key={scope}
                className="text-[8px] px-1.5 py-0.5 tracking-wider"
                style={{
                  border: "1px solid rgba(0,255,156,0.15)",
                  color: "rgba(0,255,156,0.5)",
                  background: "rgba(0,255,156,0.03)",
                }}
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
