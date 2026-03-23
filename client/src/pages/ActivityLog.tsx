import { useState, useMemo, useRef, useEffect } from "react";
import AppShell from "@/components/AppShell";
import {
  MessageSquare, Terminal, ShieldCheck, ShieldAlert, Package,
  Settings, Wifi, WifiOff, AlertTriangle, Search, Download,
  ChevronDown, ChevronUp, Filter, X, Clock, User, Bot, Server,
  Circle, Activity, Lock, Eye, Radio, Calendar
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   ACTIVITY LOG PAGE
   Full timeline / audit log of all system activity: chat,
   exec, approvals, skill installs, config changes, gateway
   events, errors, and security events.

   MOCK DATA: Activity events come from Gateway WebSocket event
   stream. Each event has type, actor, timestamp, and payload.

   MOCK DATA: On real deployment, subscribe to all gateway events
   and log them. Events include: chat.response, exec.approval.
   requested, exec.approval.resolve, connect, disconnect, etc.

   MOCK DATA: Historical events can be loaded from session logs
   in ~/.openclaw/agents/<agentId>/sessions/
   ────────────────────────────────────────────────────────────── */

/* ──────────────────── TYPES ──────────────────── */

type EventType =
  | "chat"
  | "exec"
  | "approval"
  | "skill"
  | "config"
  | "system"
  | "error"
  | "security";

type ActorType = "user" | "agent" | "system";

interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  actor: ActorType;
  actorLabel: string;
  description: string;
  details?: string;
}

/* ──────────────────── EVENT TYPE CONFIG ──────────────────── */

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; icon: React.ElementType; color: string; bgAlpha: string }
> = {
  chat:     { label: "CHAT",     icon: MessageSquare,  color: "#a78bfa", bgAlpha: "rgba(167,139,250,0.12)" },
  exec:     { label: "EXEC",     icon: Terminal,        color: "#22d3ee", bgAlpha: "rgba(34,211,238,0.12)" },
  approval: { label: "APPROVE",  icon: ShieldCheck,     color: "#00FF9C", bgAlpha: "rgba(0,255,156,0.12)" },
  skill:    { label: "SKILL",    icon: Package,         color: "#60a5fa", bgAlpha: "rgba(96,165,250,0.12)" },
  config:   { label: "CONFIG",   icon: Settings,        color: "#fbbf24", bgAlpha: "rgba(251,191,36,0.12)" },
  system:   { label: "SYSTEM",   icon: Wifi,            color: "#64748b", bgAlpha: "rgba(100,116,139,0.12)" },
  error:    { label: "ERROR",    icon: AlertTriangle,   color: "#ef4444", bgAlpha: "rgba(239,68,68,0.12)" },
  security: { label: "SECURITY", icon: Lock,            color: "#FF2D78", bgAlpha: "rgba(255,45,120,0.12)" },
};

const ACTOR_ICONS: Record<ActorType, React.ElementType> = {
  user: User,
  agent: Bot,
  system: Server,
};

/* ──────────────────── MOCK DATA ──────────────────── */

/* MOCK DATA: Activity events come from Gateway WebSocket event
   stream. Each event has type, actor, timestamp, and payload. */
function generateMockEvents(): ActivityEvent[] {
  const now = Date.now();
  const h = (hours: number) => new Date(now - hours * 3600000);
  const m = (minutes: number) => new Date(now - minutes * 60000);

  return [
    // ── Recent events (within the last hour) ──
    {
      id: "evt-001", timestamp: m(2), type: "chat", actor: "user", actorLabel: "boda",
      description: "Sent message: \"Check the latest CVE advisories for our stack\"",
      details: "Session: sess_92f1. Channel: web-ui. Length: 58 chars.",
    },
    {
      id: "evt-002", timestamp: m(2), type: "chat", actor: "agent", actorLabel: "Coco",
      description: "Responded with 3 relevant CVE advisories affecting Node.js and Linux kernel",
      details: "Tokens: 847 input / 1,243 output. Model: claude-sonnet-4-20250514. Latency: 2.3s.",
    },
    {
      id: "evt-003", timestamp: m(8), type: "exec", actor: "agent", actorLabel: "Builder",
      description: "Executed: npm audit --production",
      details: "Exit code: 0. Runtime: 4.2s. Found 0 critical, 2 moderate vulnerabilities.",
    },
    {
      id: "evt-004", timestamp: m(12), type: "approval", actor: "user", actorLabel: "boda",
      description: "Approved exec request: git pull origin main",
      details: "Request ID: req_7f2a. Agent: Builder. Wait time: 34s.",
    },
    {
      id: "evt-005", timestamp: m(12), type: "exec", actor: "agent", actorLabel: "Builder",
      description: "Requested approval for: git pull origin main",
      details: "Command risk level: medium. Requires user approval per exec policy.",
    },
    {
      id: "evt-006", timestamp: m(18), type: "security", actor: "system", actorLabel: "Gateway",
      description: "Blocked connection attempt from 185.220.101.42",
      details: "Reason: IP in threat blocklist (Tor exit node). Attempt count: 3 in last hour.",
    },
    {
      id: "evt-007", timestamp: m(25), type: "system", actor: "system", actorLabel: "Gateway",
      description: "Agent \"Monitor\" reconnected after heartbeat timeout",
      details: "Downtime: 12s. Reason: network jitter. Auto-reconnect successful.",
    },
    {
      id: "evt-008", timestamp: m(35), type: "error", actor: "agent", actorLabel: "Scraper",
      description: "Failed to fetch https://api.threatfeed.io/v2/indicators — HTTP 503",
      details: "Retry 3/3 exhausted. Error: Service Unavailable. Will retry in 15m.",
    },
    {
      id: "evt-009", timestamp: m(42), type: "skill", actor: "agent", actorLabel: "Coco",
      description: "Installed skill: web-research@2.1.0",
      details: "Source: openclaw-registry. Size: 24KB. Dependencies: fetch-utils@1.3.2.",
    },
    {
      id: "evt-010", timestamp: m(55), type: "config", actor: "user", actorLabel: "boda",
      description: "Updated config: approval.autoApproveReadOnly = true",
      details: "Previous value: false. File: ~/.openclaw/config.yaml. Requires gateway restart: no.",
    },

    // ── 1-4 hours ago ──
    {
      id: "evt-011", timestamp: h(1.2), type: "chat", actor: "user", actorLabel: "boda",
      description: "Sent message: \"Run the daily security scan\"",
    },
    {
      id: "evt-012", timestamp: h(1.2), type: "chat", actor: "agent", actorLabel: "Coco",
      description: "Delegated security scan to SecOps agent",
      details: "Delegation via agent-to-agent message. Task ID: task_8a3f.",
    },
    {
      id: "evt-013", timestamp: h(1.5), type: "exec", actor: "agent", actorLabel: "SecOps",
      description: "Executed: nmap -sV -p 1-1024 192.168.1.0/24",
      details: "Exit code: 0. Runtime: 47.8s. Hosts scanned: 12. Auto-approved: yes (read-only).",
    },
    {
      id: "evt-014", timestamp: h(2), type: "security", actor: "system", actorLabel: "Gateway",
      description: "Auth token refreshed for web-ui session",
      details: "Token ID: tok_f29e. Expiry extended to +24h. IP: 127.0.0.1.",
    },
    {
      id: "evt-015", timestamp: h(2.5), type: "system", actor: "system", actorLabel: "Gateway",
      description: "Agent \"Researcher\" connected via WebSocket",
      details: "Agent ID: agent_researcher. Protocol: wss. Session: sess_71ab.",
    },
    {
      id: "evt-016", timestamp: h(3), type: "approval", actor: "user", actorLabel: "boda",
      description: "Denied exec request: rm -rf /tmp/build-cache/*",
      details: "Request ID: req_3e1c. Agent: Builder. Reason: path too broad, use targeted cleanup.",
    },
    {
      id: "evt-017", timestamp: h(3.5), type: "error", actor: "system", actorLabel: "Gateway",
      description: "WebSocket connection dropped: Agent \"Scraper\"",
      details: "Error: EPIPE — broken pipe. Agent was idle for 180s. Will attempt reconnect.",
    },
    {
      id: "evt-018", timestamp: h(4), type: "skill", actor: "agent", actorLabel: "Coco",
      description: "Updated skill: code-analysis@1.8.0 → 1.9.2",
      details: "Changelog: Added TypeScript 5.4 support, fixed false-positive detection in async flows.",
    },

    // ── 4-12 hours ago ──
    {
      id: "evt-019", timestamp: h(5), type: "config", actor: "user", actorLabel: "boda",
      description: "Updated config: models.primary = claude-sonnet-4-20250514",
      details: "Previous value: claude-3-5-sonnet-20241022. File: ~/.openclaw/config.yaml.",
    },
    {
      id: "evt-020", timestamp: h(6), type: "system", actor: "system", actorLabel: "Gateway",
      description: "Gateway process started — PID 1847",
      details: "Version: 0.14.2. Config loaded from ~/.openclaw/config.yaml. Port: 18789.",
    },
    {
      id: "evt-021", timestamp: h(6), type: "system", actor: "system", actorLabel: "Gateway",
      description: "All 6 agents registered and connected",
      details: "Agents: Coco, Researcher, Builder, SecOps, Scraper, Monitor. Fleet healthy.",
    },
    {
      id: "evt-022", timestamp: h(8), type: "security", actor: "system", actorLabel: "Firewall",
      description: "Rate limit triggered: 50 requests/min from 10.0.0.15",
      details: "Rule: gateway.rateLimit.perMinute = 50. Client temporarily blocked for 60s.",
    },
    {
      id: "evt-023", timestamp: h(10), type: "exec", actor: "agent", actorLabel: "Monitor",
      description: "Executed: df -h && free -m && uptime",
      details: "Exit code: 0. Runtime: 0.3s. Auto-approved: yes (read-only, monitoring agent).",
    },
    {
      id: "evt-024", timestamp: h(12), type: "chat", actor: "agent", actorLabel: "Coco",
      description: "Sent daily briefing summary to user via Discord channel",
      details: "Channel: #openclaw-alerts. Content: 3 CVEs, 0 incidents, system health 94%.",
    },

    // ── 12-24 hours ago ──
    {
      id: "evt-025", timestamp: h(14), type: "error", actor: "agent", actorLabel: "Researcher",
      description: "Model rate limit exceeded — 429 Too Many Requests",
      details: "Model: claude-sonnet-4-20250514. Retry-After: 30s. Queued for retry.",
    },
    {
      id: "evt-026", timestamp: h(16), type: "security", actor: "system", actorLabel: "Gateway",
      description: "Failed SSH key authentication attempt — user root",
      details: "Source IP: 203.0.113.42. Key fingerprint: SHA256:x7Kf...9pLm. Attempt denied.",
    },
    {
      id: "evt-027", timestamp: h(18), type: "skill", actor: "agent", actorLabel: "Coco",
      description: "Installed skill: discord-bridge@1.0.3",
      details: "Source: openclaw-registry. Enables Discord channel integration for alerts.",
    },
    {
      id: "evt-028", timestamp: h(20), type: "approval", actor: "user", actorLabel: "boda",
      description: "Approved exec request: docker compose up -d monitoring-stack",
      details: "Request ID: req_a912. Agent: Builder. Container: prometheus + grafana.",
    },
    {
      id: "evt-029", timestamp: h(22), type: "system", actor: "system", actorLabel: "Gateway",
      description: "Scheduled cron job executed: daily-backup",
      details: "Job: backup ~/.openclaw/data to /mnt/backups. Duration: 8.4s. Size: 142MB.",
    },
    {
      id: "evt-030", timestamp: h(23.5), type: "config", actor: "user", actorLabel: "boda",
      description: "Updated config: security.blocklist added 185.220.101.0/24",
      details: "Reason: repeated malicious connection attempts. Applied immediately.",
    },
  ];
}

/* ──────────────────── HELPERS ──────────────────── */

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/* ──────────────────── COMPONENTS ──────────────────── */

/* ── Type filter pill ── */
function TypePill({
  type,
  active,
  onClick,
}: {
  type: EventType;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = EVENT_TYPE_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <button
      data-testid={`filter-type-${type}`}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition-all duration-150 rounded-sm border"
      style={{
        borderColor: active ? cfg.color : "rgba(255,255,255,0.06)",
        background: active ? cfg.bgAlpha : "transparent",
        color: active ? cfg.color : "rgba(255,255,255,0.3)",
      }}
    >
      <Icon size={11} />
      {cfg.label}
    </button>
  );
}

/* ── Actor filter pill ── */
function ActorPill({
  actor,
  active,
  onClick,
}: {
  actor: ActorType;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = ACTOR_ICONS[actor];
  const color = actor === "user" ? "#00FF9C" : actor === "agent" ? "#00B4FF" : "#64748b";

  return (
    <button
      data-testid={`filter-actor-${actor}`}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition-all duration-150 rounded-sm border"
      style={{
        borderColor: active ? color : "rgba(255,255,255,0.06)",
        background: active ? `${color}15` : "transparent",
        color: active ? color : "rgba(255,255,255,0.3)",
      }}
    >
      <Icon size={11} />
      {actor}
    </button>
  );
}

/* ── Single event row ── */
function EventRow({ event }: { event: ActivityEvent }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVENT_TYPE_CONFIG[event.type];
  const Icon = cfg.icon;
  const ActorIcon = ACTOR_ICONS[event.actor];

  return (
    <div
      data-testid={`event-row-${event.id}`}
      className="group relative border-b transition-colors duration-100"
      style={{ borderColor: "rgba(0,255,156,0.06)" }}
    >
      {/* Timeline dot */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px]"
        style={{ background: `linear-gradient(180deg, ${cfg.color}40 0%, transparent 100%)` }}
      />

      <div
        className="flex items-start gap-3 pl-4 pr-3 py-2.5 cursor-pointer hover:bg-white/[0.02]"
        onClick={() => event.details && setExpanded(!expanded)}
        data-testid={`event-toggle-${event.id}`}
      >
        {/* Timestamp column */}
        <div className="flex-shrink-0 w-[72px] pt-0.5">
          <span
            className="font-mono text-[10px] leading-tight block"
            style={{ color: "rgba(255,255,255,0.35)" }}
            title={formatFullTimestamp(event.timestamp)}
          >
            {formatTimestamp(event.timestamp)}
          </span>
        </div>

        {/* Type badge */}
        <div
          className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-mono text-[9px] tracking-widest uppercase"
          style={{
            background: cfg.bgAlpha,
            color: cfg.color,
            border: `1px solid ${cfg.color}30`,
          }}
        >
          <Icon size={10} />
          {cfg.label}
        </div>

        {/* Actor badge */}
        <div
          className="flex-shrink-0 flex items-center gap-1 font-mono text-[10px]"
          style={{
            color:
              event.actor === "user"
                ? "#00FF9C"
                : event.actor === "agent"
                ? "#00B4FF"
                : "#64748b",
          }}
        >
          <ActorIcon size={10} />
          <span>{event.actorLabel}</span>
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <span
            className="font-mono text-[11px] leading-relaxed block truncate"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            {event.description}
          </span>
        </div>

        {/* Expand indicator */}
        {event.details && (
          <div className="flex-shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        )}
      </div>

      {/* Expandable details */}
      {expanded && event.details && (
        <div
          className="pl-[88px] pr-4 pb-3 font-mono text-[10px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.4)" }}
          data-testid={`event-details-${event.id}`}
        >
          <div
            className="px-3 py-2 rounded-sm border"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "rgba(0,255,156,0.08)",
            }}
          >
            {event.details}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   MAIN PAGE
   ────────────────────────────────────────────────────────────── */

const ALL_EVENT_TYPES: EventType[] = [
  "chat",
  "exec",
  "approval",
  "skill",
  "config",
  "system",
  "error",
  "security",
];

const ALL_ACTOR_TYPES: ActorType[] = ["user", "agent", "system"];

export default function ActivityLog() {
  /* ── State ── */
  const [events] = useState<ActivityEvent[]>(() =>
    generateMockEvents().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  );
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(ALL_EVENT_TYPES));
  const [activeActors, setActiveActors] = useState<Set<ActorType>>(new Set(ALL_ACTOR_TYPES));
  const [searchText, setSearchText] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Live mode blink ── */
  const [liveBlink, setLiveBlink] = useState(true);
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setLiveBlink((b) => !b), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  /* ── Filtering ── */
  const filteredEvents = useMemo(() => {
    const lowerSearch = searchText.toLowerCase();
    return events.filter((e) => {
      if (!activeTypes.has(e.type)) return false;
      if (!activeActors.has(e.actor)) return false;
      if (
        searchText &&
        !e.description.toLowerCase().includes(lowerSearch) &&
        !e.actorLabel.toLowerCase().includes(lowerSearch) &&
        !(e.details && e.details.toLowerCase().includes(lowerSearch))
      )
        return false;
      return true;
    });
  }, [events, activeTypes, activeActors, searchText]);

  /* ── Toggle helpers ── */
  function toggleType(type: EventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleActor(actor: ActorType) {
    setActiveActors((prev) => {
      const next = new Set(prev);
      if (next.has(actor)) {
        next.delete(actor);
      } else {
        next.add(actor);
      }
      return next;
    });
  }

  function clearAllFilters() {
    setActiveTypes(new Set(ALL_EVENT_TYPES));
    setActiveActors(new Set(ALL_ACTOR_TYPES));
    setSearchText("");
  }

  const hasActiveFilters =
    activeTypes.size !== ALL_EVENT_TYPES.length ||
    activeActors.size !== ALL_ACTOR_TYPES.length ||
    searchText.length > 0;

  /* ── Stats bar ── */
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }, [events]);

  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div
          className="flex-shrink-0 px-4 pt-4 pb-2 border-b"
          style={{ borderColor: "rgba(0,255,156,0.1)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Activity size={16} style={{ color: "#00FF9C" }} />
              <h1
                className="font-mono text-sm tracking-widest uppercase"
                style={{ color: "#00FF9C" }}
              >
                Activity Log
              </h1>
              <span
                className="font-mono text-[10px]"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {filteredEvents.length}/{events.length} events
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <button
                data-testid="toggle-live"
                onClick={() => setIsLive(!isLive)}
                className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wider uppercase rounded-sm border transition-all duration-150"
                style={{
                  borderColor: isLive ? "rgba(0,255,156,0.3)" : "rgba(255,255,255,0.08)",
                  background: isLive ? "rgba(0,255,156,0.08)" : "transparent",
                  color: isLive ? "#00FF9C" : "rgba(255,255,255,0.3)",
                }}
              >
                <Circle
                  size={7}
                  fill={isLive && liveBlink ? "#00FF9C" : "transparent"}
                  style={{ color: isLive ? "#00FF9C" : "rgba(255,255,255,0.2)" }}
                />
                LIVE
              </button>

              {/* Filter toggle */}
              <button
                data-testid="toggle-filters"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wider uppercase rounded-sm border transition-all duration-150"
                style={{
                  borderColor: showFilters
                    ? "rgba(0,180,255,0.3)"
                    : "rgba(255,255,255,0.08)",
                  background: showFilters
                    ? "rgba(0,180,255,0.08)"
                    : "transparent",
                  color: showFilters ? "#00B4FF" : "rgba(255,255,255,0.3)",
                }}
              >
                <Filter size={10} />
                Filters
              </button>

              {/* Export mock */}
              <button
                data-testid="export-log"
                onClick={() => {
                  /* MOCK: In production, export to CSV/JSON from session logs */
                }}
                className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wider uppercase rounded-sm border transition-all duration-150"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                <Download size={10} />
                Export
              </button>
            </div>
          </div>

          {/* ── Stats ribbon ── */}
          <div className="flex items-center gap-4 mb-2 overflow-x-auto">
            {ALL_EVENT_TYPES.map((type) => {
              const cfg = EVENT_TYPE_CONFIG[type];
              return (
                <div
                  key={type}
                  className="flex items-center gap-1.5 font-mono text-[10px] flex-shrink-0"
                  style={{ color: cfg.color }}
                >
                  <cfg.icon size={10} style={{ opacity: 0.6 }} />
                  <span style={{ opacity: 0.6 }}>{cfg.label}</span>
                  <span className="font-bold">{typeCounts[type] || 0}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Filter bar ── */}
        {showFilters && (
          <div
            className="flex-shrink-0 px-4 py-3 border-b space-y-2.5"
            style={{
              borderColor: "rgba(0,255,156,0.06)",
              background: "rgba(255,255,255,0.01)",
            }}
          >
            {/* Search */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-sm border"
                style={{
                  borderColor: "rgba(0,255,156,0.15)",
                  background: "rgba(0,0,0,0.4)",
                }}
              >
                <Search size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  data-testid="search-input"
                  type="text"
                  placeholder="Search events..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="flex-1 bg-transparent font-mono text-[11px] outline-none placeholder:text-white/20"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                />
                {searchText && (
                  <button
                    data-testid="clear-search"
                    onClick={() => setSearchText("")}
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {hasActiveFilters && (
                <button
                  data-testid="clear-all-filters"
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2 py-1.5 font-mono text-[10px] tracking-wider uppercase rounded-sm border transition-all"
                  style={{
                    borderColor: "rgba(255,45,120,0.3)",
                    color: "#FF2D78",
                    background: "rgba(255,45,120,0.08)",
                  }}
                >
                  <X size={10} />
                  Clear
                </button>
              )}
            </div>

            {/* Type pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-mono text-[9px] tracking-widest uppercase mr-1"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                Type
              </span>
              {ALL_EVENT_TYPES.map((type) => (
                <TypePill
                  key={type}
                  type={type}
                  active={activeTypes.has(type)}
                  onClick={() => toggleType(type)}
                />
              ))}
            </div>

            {/* Actor pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-mono text-[9px] tracking-widest uppercase mr-1"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                Actor
              </span>
              {ALL_ACTOR_TYPES.map((actor) => (
                <ActorPill
                  key={actor}
                  actor={actor}
                  active={activeActors.has(actor)}
                  onClick={() => toggleActor(actor)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          data-testid="event-timeline"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#00FF9C20 transparent" }}
        >
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
              <Eye size={24} style={{ color: "rgba(255,255,255,0.2)" }} />
              <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                No events match current filters
              </span>
            </div>
          ) : (
            <div>
              {filteredEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}

              {/* End marker */}
              <div
                className="flex items-center justify-center py-6 gap-2 font-mono text-[10px]"
                style={{ color: "rgba(255,255,255,0.15)" }}
              >
                <Clock size={10} />
                <span>End of log — {events.length} total events in last 24h</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom status bar ── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-t"
          style={{
            borderColor: "rgba(0,255,156,0.08)",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[9px] tracking-wider uppercase"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              {isLive ? (
                <span className="flex items-center gap-1.5">
                  <Radio size={9} style={{ color: "#00FF9C" }} />
                  <span style={{ color: "#00FF9C" }}>Streaming</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Circle size={9} style={{ color: "rgba(255,255,255,0.2)" }} />
                  Paused
                </span>
              )}
            </span>
          </div>
          <span
            className="font-mono text-[9px]"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            {/* MOCK DATA: Historical events can be loaded from session logs in ~/.openclaw/agents/&lt;agentId&gt;/sessions/ */}
            Source: Gateway Event Stream · ws://localhost:18789/events
          </span>
        </div>
      </div>
    </AppShell>
  );
}
