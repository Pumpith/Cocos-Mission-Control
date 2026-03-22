import { useLocation } from "wouter";
import {
  LayoutDashboard, Sword, Shield, Radar,
  Settings, Brain, Activity
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/", icon: LayoutDashboard, label: "DASHBOARD", shortLabel: "DASH" },
  { path: "/weapons", icon: Sword, label: "WEAPON VAULT", shortLabel: "WEAP" },
  { path: "/firewall", icon: Shield, label: "FIREWALL", shortLabel: "FW" },
  { path: "/threat-intel", icon: Radar, label: "THREAT INTEL", shortLabel: "THRT" },
];

export default function NavRail() {
  const [location, setLocation] = useLocation();

  return (
    <div
      className="flex flex-col items-center py-2 gap-1 flex-shrink-0"
      style={{
        width: "52px",
        background: "rgba(5,5,8,0.98)",
        borderRight: "1px solid rgba(0,255,156,0.1)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center w-9 h-9 mb-2 text-lg cursor-pointer"
        style={{
          border: "1px solid rgba(0,255,156,0.2)",
          borderRadius: "2px",
          background: "rgba(0,255,156,0.03)",
        }}
        onClick={() => setLocation("/")}
        title="OPENCLAW // MISSION CONTROL"
      >
        🦞
      </div>

      {/* Divider */}
      <div className="w-6 h-px mb-1" style={{ background: "rgba(0,255,156,0.1)" }} />

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
        const Icon = item.icon;

        return (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className="flex flex-col items-center justify-center w-10 h-10 transition-all group relative"
            style={{
              border: `1px solid ${isActive ? "rgba(0,255,156,0.35)" : "transparent"}`,
              background: isActive ? "rgba(0,255,156,0.06)" : "transparent",
              borderRadius: "2px",
            }}
            title={item.label}
            data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
          >
            <Icon
              size={16}
              style={{
                color: isActive ? "#00FF9C" : "rgba(0,255,156,0.35)",
                filter: isActive ? "drop-shadow(0 0 4px rgba(0,255,156,0.5))" : "none",
                transition: "all 0.2s",
              }}
            />
            <span
              className="text-[7px] tracking-wider mt-0.5"
              style={{
                color: isActive ? "#00FF9C" : "rgba(0,255,156,0.25)",
              }}
            >
              {item.shortLabel}
            </span>

            {/* Active indicator */}
            {isActive && (
              <div
                className="absolute left-0 top-2 bottom-2 w-[2px]"
                style={{
                  background: "#00FF9C",
                  boxShadow: "0 0 6px #00FF9C",
                }}
              />
            )}

            {/* Tooltip */}
            <div
              className="absolute left-full ml-2 px-2 py-1 text-[9px] tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
              style={{
                background: "#0a0a0f",
                border: "1px solid rgba(0,255,156,0.3)",
                color: "#00FF9C",
                boxShadow: "0 0 12px rgba(0,255,156,0.1)",
              }}
            >
              {item.label}
            </div>
          </button>
        );
      })}

      {/* Bottom spacer */}
      <div className="flex-1" />

      {/* System status */}
      <div className="flex flex-col items-center gap-1 mb-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: "#00FF9C",
            boxShadow: "0 0 6px #00FF9C",
            animation: "status-pulse 2s ease-in-out infinite",
          }}
        />
        <span className="text-[6px] tracking-widest" style={{ color: "rgba(0,255,156,0.3)" }}>
          SYS
        </span>
      </div>
    </div>
  );
}
