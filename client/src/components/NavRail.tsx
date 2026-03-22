import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Sword, Shield, Radar, Bot, Settings,
  Activity, Building2, FileCode, HeartPulse,
  ChevronLeft, ChevronRight, MessageSquare
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   NAV GROUPS & ITEMS
   Grouped into sections matching builderz-labs/mission-control 
   pattern: core, observe, admin.
   ────────────────────────────────────────────────────────────── */
interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  shortLabel: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "core",
    label: "",
    items: [
      { path: "/", icon: LayoutDashboard, label: "DASHBOARD", shortLabel: "DASH" },
      { path: "/agent-comms", icon: MessageSquare, label: "AGENT COMMS", shortLabel: "COMMS" },
      { path: "/office", icon: Building2, label: "PIXEL OFFICE", shortLabel: "OFFICE" },
    ],
  },
  {
    id: "observe",
    label: "OBSERVE",
    items: [
      { path: "/weapons", icon: Sword, label: "WEAPON VAULT", shortLabel: "WEAP" },
      { path: "/firewall", icon: Shield, label: "FIREWALL", shortLabel: "FW" },
      { path: "/threat-intel", icon: Radar, label: "THREAT INTEL", shortLabel: "THRT" },
    ],
  },
  {
    id: "admin",
    label: "ADMIN",
    items: [
      { path: "/security", icon: HeartPulse, label: "SECURITY & HEALTH", shortLabel: "SEC" },
      { path: "/config", icon: FileCode, label: "CONFIG EDITOR", shortLabel: "CONF" },
      { path: "/settings", icon: Settings, label: "SETTINGS", shortLabel: "SET" },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────
   COLLAPSIBLE/EXPANDABLE NAVRAIL
   Toggle between w-[200px] (expanded) and w-[52px] (collapsed)
   Keyboard shortcut: [ key toggles
   ────────────────────────────────────────────────────────────── */
export default function NavRail() {
  const [location, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  // Keyboard shortcut: "[" to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "[" && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setExpanded(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="flex flex-col flex-shrink-0 transition-all duration-200 ease-in-out overflow-hidden"
      style={{
        width: expanded ? "200px" : "52px",
        background: "rgba(5,5,8,0.98)",
        borderRight: "1px solid rgba(0,255,156,0.1)",
      }}
    >
      {/* ─── HEADER: Logo + Collapse Toggle ─── */}
      <div
        className="flex items-center justify-between px-2 py-3"
        style={{ borderBottom: "1px solid rgba(0,255,156,0.08)" }}
      >
        <div
          className="flex items-center gap-2 cursor-pointer flex-shrink-0"
          onClick={() => setLocation("/")}
          title="OPENCLAW // MISSION CONTROL"
        >
          {/* ─── Coco 🎃 Agent Branding ─── */}
          <div
            className="flex items-center justify-center w-8 h-8 text-base flex-shrink-0"
            style={{
              border: "1px solid rgba(0,255,156,0.2)",
              borderRadius: "2px",
              background: "rgba(0,255,156,0.03)",
            }}
          >
            🎃
          </div>
          {expanded && (
            <span
              className="text-[10px] font-bold tracking-widest whitespace-nowrap glow-text"
              style={{ color: "#00FF9C" }}
            >
              COCO
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center w-6 h-6 transition-all flex-shrink-0"
          style={{
            border: "1px solid rgba(0,255,156,0.15)",
            background: "rgba(0,255,156,0.03)",
            borderRadius: "2px",
          }}
          title={expanded ? "Collapse sidebar ( [ )" : "Expand sidebar ( [ )"}
          data-testid="nav-toggle"
        >
          {expanded ? (
            <ChevronLeft size={12} style={{ color: "rgba(0,255,156,0.5)" }} />
          ) : (
            <ChevronRight size={12} style={{ color: "rgba(0,255,156,0.5)" }} />
          )}
        </button>
      </div>

      {/* ─── NAV GROUPS ─── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {NAV_GROUPS.map((group) => {
          const isCollapsed = collapsedGroups.includes(group.id);
          return (
            <div key={group.id} className="mb-1">
              {/* Group header (only if has label and sidebar expanded) */}
              {group.label && expanded && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-left"
                  style={{ color: "rgba(0,255,156,0.3)" }}
                >
                  <span className="text-[7px] tracking-[0.2em] font-bold">{group.label}</span>
                  <ChevronRight
                    size={8}
                    className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                    style={{ color: "rgba(0,255,156,0.2)" }}
                  />
                </button>
              )}

              {/* Group divider in collapsed mode */}
              {group.label && !expanded && (
                <div className="mx-3 my-1.5 h-px" style={{ background: "rgba(0,255,156,0.08)" }} />
              )}

              {/* Items */}
              <div
                className="transition-all duration-200 overflow-hidden"
                style={{
                  maxHeight: isCollapsed && expanded ? 0 : 500,
                  opacity: isCollapsed && expanded ? 0 : 1,
                }}
              >
                {group.items.map((item) => {
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.path}
                      onClick={() => setLocation(item.path)}
                      className={`flex items-center w-full transition-all group relative ${expanded ? "px-3 py-2 gap-2.5" : "justify-center py-2 px-0"}`}
                      style={{
                        background: isActive ? "rgba(0,255,156,0.06)" : "transparent",
                        borderRadius: "0",
                      }}
                      title={!expanded ? item.label : undefined}
                      data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-1 bottom-1 w-[2px]"
                          style={{
                            background: "#00FF9C",
                            boxShadow: "0 0 6px #00FF9C",
                          }}
                        />
                      )}

                      <Icon
                        size={15}
                        style={{
                          color: isActive ? "#00FF9C" : "rgba(0,255,156,0.35)",
                          filter: isActive ? "drop-shadow(0 0 4px rgba(0,255,156,0.5))" : "none",
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      />

                      {/* Label (expanded mode only) */}
                      {expanded && (
                        <span
                          className="text-[9px] tracking-wider whitespace-nowrap"
                          style={{
                            color: isActive ? "#00FF9C" : "rgba(0,255,156,0.4)",
                            textShadow: isActive ? "0 0 6px rgba(0,255,156,0.3)" : "none",
                          }}
                        >
                          {item.label}
                        </span>
                      )}

                      {/* Short label (collapsed mode only) */}
                      {!expanded && (
                        <span
                          className="sr-only"
                        >
                          {item.shortLabel}
                        </span>
                      )}

                      {/* Tooltip (collapsed mode only, on hover) */}
                      {!expanded && (
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
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── BOTTOM: System Status ─── */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(0,255,156,0.08)" }}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: "#00FF9C",
            boxShadow: "0 0 6px #00FF9C",
            animation: "status-pulse 2s ease-in-out infinite",
          }}
        />
        {expanded && (
          <span className="text-[7px] tracking-widest" style={{ color: "rgba(0,255,156,0.3)" }}>
            SYSTEM ONLINE
          </span>
        )}
      </div>
    </div>
  );
}
