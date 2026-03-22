import { useState, useEffect, useRef } from "react";
import AppShell from "@/components/AppShell";
import {
  MessageSquare, Bot, Send, Filter, Circle, Zap,
  Shield, Search as SearchIcon, Brain, Globe, Terminal, AlertTriangle
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   AGENT COMMS PAGE
   Live view of what Coco (main agent) and sub-agents are doing.
   Shows all inter-agent communication, tool calls, thinking
   traces, and system events in a unified real-time feed.

   Inspired by builderz-labs/mission-control agent-comms-panel:
   - Unified chronological feed from multiple sources
   - Category-based filtering (chat/tools/trace/system/safety)
   - Agent identity system with colors + emojis
   - Live session indicators
   - Message composer for sending commands

   MOCK DATA: All messages below are simulated. On real
   deployment, this should:
   1. Connect to OpenClaw Gateway via WebSocket for real-time feed
   2. Poll /api/agents/comms for historical messages
   3. Poll /api/sessions/transcript for gateway transcripts
   4. Poll /api/activities for system events
   Replace the MOCK_FEED_MESSAGES array and the generateMockMessage()
   function with actual API integrations.
   ────────────────────────────────────────────────────────────── */

/* ─── Agent identity system ─── */
interface AgentIdentity {
  name: string;
  emoji: string;
  color: string;
  role: string;
}

/* MOCK DATA: Agent identities — replace with data from
   GET /api/agents endpoint on real deployment */
const AGENTS: Record<string, AgentIdentity> = {
  coco:       { name: "Coco",       emoji: "🎃", color: "#FF9C00", role: "coordinator" },
  researcher: { name: "Researcher", emoji: "🔬", color: "#22d3ee", role: "research" },
  builder:    { name: "Builder",    emoji: "🛠️", color: "#60a5fa", role: "builder" },
  security:   { name: "SecOps",     emoji: "🛡️", color: "#f87171", role: "security" },
  scraper:    { name: "Scraper",    emoji: "🕷️", color: "#a78bfa", role: "data-collection" },
  monitor:    { name: "Monitor",    emoji: "📡", color: "#34d399", role: "monitoring" },
};

type FeedCategory = "chat" | "tools" | "trace" | "system" | "safety";

interface FeedMessage {
  id: string;
  timestamp: Date;
  agent: string;
  category: FeedCategory;
  content: string;
  target?: string;
}

const CATEGORY_COLORS: Record<FeedCategory, string> = {
  chat: "#a78bfa",
  tools: "#22d3ee",
  trace: "#94a3b8",
  system: "#64748b",
  safety: "#f87171",
};

const CATEGORY_ICONS: Record<FeedCategory, React.ElementType> = {
  chat: MessageSquare,
  tools: Terminal,
  trace: Brain,
  system: Globe,
  safety: AlertTriangle,
};

/* ──────────────────────────────────────────────────────────────
   MOCK FEED MESSAGES
   These simulate the live agent communication feed.
   On real deployment, replace with WebSocket subscription to
   the OpenClaw Gateway event stream.
   ────────────────────────────────────────────────────────────── */
function generateMockMessages(): FeedMessage[] {
  const now = Date.now();
  return [
    { id: "m1", timestamp: new Date(now - 300000), agent: "coco", category: "system", content: "System boot complete. All subsystems nominal." },
    { id: "m2", timestamp: new Date(now - 280000), agent: "coco", category: "chat", content: "Good morning. Initiating daily briefing sequence.", target: "all" },
    { id: "m3", timestamp: new Date(now - 260000), agent: "researcher", category: "tools", content: "tool_call: web_search(\"latest CVE advisories 2026-03-23\")" },
    { id: "m4", timestamp: new Date(now - 240000), agent: "researcher", category: "tools", content: "tool_result: Found 3 new critical CVEs — CVE-2026-1847 (OpenSSL), CVE-2026-1923 (Linux kernel), CVE-2026-2001 (Node.js)" },
    { id: "m5", timestamp: new Date(now - 220000), agent: "coco", category: "chat", content: "Researcher: summarize those CVEs and check if any affect our stack.", target: "researcher" },
    { id: "m6", timestamp: new Date(now - 200000), agent: "security", category: "trace", content: "Running port scan on local network... 192.168.1.0/24" },
    { id: "m7", timestamp: new Date(now - 180000), agent: "security", category: "tools", content: "tool_call: nmap -sV -p- 192.168.1.50" },
    { id: "m8", timestamp: new Date(now - 160000), agent: "security", category: "tools", content: "tool_result: 3 services detected — ssh:22, http:80, openclaw-gw:18789. No unexpected open ports." },
    { id: "m9", timestamp: new Date(now - 140000), agent: "monitor", category: "system", content: "CPU: 23% | MEM: 67% | DISK: 43% | Network: 151.8 KB/s ↓ / 34.2 KB/s ↑" },
    { id: "m10", timestamp: new Date(now - 120000), agent: "scraper", category: "tools", content: "tool_call: fetch_url(\"https://feeds.feedburner.com/TheHackersNews\")" },
    { id: "m11", timestamp: new Date(now - 100000), agent: "scraper", category: "chat", content: "Found 5 new security articles. Sending summaries to Coco.", target: "coco" },
    { id: "m12", timestamp: new Date(now - 80000), agent: "coco", category: "trace", content: "Thinking: Should I alert the user about CVE-2026-1923? It affects Linux kernel 6.x which we're running..." },
    { id: "m13", timestamp: new Date(now - 60000), agent: "coco", category: "chat", content: "⚠️ Alert: CVE-2026-1923 affects our kernel version. Recommending immediate patch.", target: "user" },
    { id: "m14", timestamp: new Date(now - 40000), agent: "builder", category: "tools", content: "tool_call: exec(\"git pull origin main && npm run build\")" },
    { id: "m15", timestamp: new Date(now - 30000), agent: "builder", category: "tools", content: "tool_result: Build complete. 0 errors, 2 warnings." },
    { id: "m16", timestamp: new Date(now - 20000), agent: "security", category: "safety", content: "BLOCKED: Injection attempt detected in incoming WhatsApp message from +974****3721. Rule: prompt-injection-v2" },
    { id: "m17", timestamp: new Date(now - 10000), agent: "coco", category: "system", content: "Daily briefing compiled. Sending to user via Telegram." },
    { id: "m18", timestamp: new Date(now - 5000), agent: "monitor", category: "system", content: "UFW blocked 47 connections in the last hour. Top source: 45.33.32.156 (CN)" },
  ];
}

/* ─── New mock message generator for live feed simulation ─── */
/* MOCK DATA: Remove this function and use WebSocket events instead */
const MOCK_LIVE_MESSAGES: Omit<FeedMessage, "id" | "timestamp">[] = [
  { agent: "coco", category: "trace", content: "Thinking: Checking scheduled operations queue..." },
  { agent: "monitor", category: "system", content: "Heartbeat: All 6 agents reporting nominal." },
  { agent: "researcher", category: "tools", content: "tool_call: web_search(\"OpenClaw changelog latest\")" },
  { agent: "security", category: "system", content: "UFW rule audit: 64 rules active. No anomalies." },
  { agent: "scraper", category: "tools", content: "tool_call: fetch_rss(\"https://www.exploit-db.com/rss.xml\")" },
  { agent: "coco", category: "chat", content: "Monitor: report current resource utilization.", target: "monitor" },
  { agent: "builder", category: "trace", content: "Checking repository state... last commit 2h ago." },
  { agent: "monitor", category: "system", content: "CPU: 31% | MEM: 71% | Network: 200 KB/s ↓ / 45 KB/s ↑" },
  { agent: "coco", category: "chat", content: "All systems stable. Next scheduled task in 12 minutes." },
];

export default function AgentComms() {
  const [messages, setMessages] = useState<FeedMessage[]>(generateMockMessages);
  const [filter, setFilter] = useState<FeedCategory | "all">("all");
  const [composerText, setComposerText] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<string>("coco");
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  /* MOCK DATA: Simulate live messages arriving every few seconds.
     Replace with WebSocket subscription to Gateway event stream. */
  useEffect(() => {
    const interval = setInterval(() => {
      const template = MOCK_LIVE_MESSAGES[Math.floor(Math.random() * MOCK_LIVE_MESSAGES.length)];
      const newMsg: FeedMessage = {
        ...template,
        id: `live-${Date.now()}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMsg]);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  const filtered = filter === "all" ? messages : messages.filter(m => m.category === filter);

  const categoryCounts = {
    all: messages.length,
    chat: messages.filter(m => m.category === "chat").length,
    tools: messages.filter(m => m.category === "tools").length,
    trace: messages.filter(m => m.category === "trace").length,
    system: messages.filter(m => m.category === "system").length,
    safety: messages.filter(m => m.category === "safety").length,
  };

  const sendMessage = () => {
    if (!composerText.trim()) return;
    const msg: FeedMessage = {
      id: `user-${Date.now()}`,
      timestamp: new Date(),
      agent: "user",
      category: "chat",
      content: composerText,
      target: selectedTarget,
    };
    setMessages(prev => [...prev, msg]);
    setComposerText("");
  };

  const formatTime = (d: Date) => d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <AppShell>
      <div className="flex-1 p-2 h-full overflow-hidden flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} style={{ color: "#00FF9C" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "#00FF9C" }}>
              AGENT COMMS // LIVE FEED
            </span>
            <div className="flex items-center gap-1 ml-3">
              <Circle size={6} fill="#00FF9C" style={{ color: "#00FF9C" }} />
              <span className="text-[8px] tracking-wider" style={{ color: "rgba(0,255,156,0.5)" }}>LIVE</span>
            </div>
          </div>
          {/* Connection mode indicators */}
          <div className="flex items-center gap-2">
            {/* MOCK DATA: Replace with actual connection status */}
            <span className="text-[8px] px-1.5 py-0.5" style={{ border: "1px solid rgba(0,255,156,0.2)", color: "rgba(0,255,156,0.5)" }}>
              GATEWAY
            </span>
            <span className="text-[8px] px-1.5 py-0.5" style={{ border: "1px solid rgba(0,180,255,0.2)", color: "rgba(0,180,255,0.5)" }}>
              SSE
            </span>
          </div>
        </div>

        {/* Online Agents Bar */}
        <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto pb-1">
          <span className="text-[8px] tracking-widest flex-shrink-0" style={{ color: "rgba(0,255,156,0.3)" }}>AGENTS:</span>
          {Object.entries(AGENTS).map(([key, agent]) => (
            <button
              key={key}
              onClick={() => setSelectedTarget(key)}
              className="flex items-center gap-1 px-2 py-0.5 transition-all flex-shrink-0"
              style={{
                border: `1px solid ${selectedTarget === key ? agent.color + "80" : "rgba(0,255,156,0.1)"}`,
                background: selectedTarget === key ? agent.color + "15" : "transparent",
              }}
              data-testid={`agent-chip-${key}`}
            >
              <span className="text-xs">{agent.emoji}</span>
              <span className="text-[9px] font-bold" style={{ color: agent.color }}>{agent.name}</span>
              <Circle size={4} fill="#00FF9C" style={{ color: "#00FF9C" }} />
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          <Filter size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
          {(["all", "chat", "tools", "trace", "system", "safety"] as const).map((cat) => {
            const isActive = filter === cat;
            const color = cat === "all" ? "#00FF9C" : CATEGORY_COLORS[cat as FeedCategory];
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className="flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-wider transition-all"
                style={{
                  border: `1px solid ${isActive ? color + "60" : "rgba(255,255,255,0.05)"}`,
                  background: isActive ? color + "15" : "transparent",
                  color: isActive ? color : "rgba(255,255,255,0.3)",
                }}
                data-testid={`filter-${cat}`}
              >
                {cat.toUpperCase()}
                <span className="text-[7px] opacity-60">{categoryCounts[cat]}</span>
              </button>
            );
          })}
        </div>

        {/* Feed */}
        <div
          ref={feedRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 font-mono text-[11px] space-y-0.5 p-2"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(0,255,156,0.08)",
          }}
        >
          {filtered.map((msg) => {
            const agent = msg.agent === "user" ? { name: "You", emoji: "👤", color: "#00FF9C", role: "operator" } : (AGENTS[msg.agent] || { name: msg.agent, emoji: "🤖", color: "#94a3b8", role: "unknown" });
            const catColor = CATEGORY_COLORS[msg.category];
            return (
              <div key={msg.id} className="flex items-start gap-2 py-0.5 hover:bg-[rgba(0,255,156,0.02)]">
                <span style={{ color: "rgba(0,255,156,0.3)" }}>[{formatTime(msg.timestamp)}]</span>
                <span
                  className="text-[8px] px-1 py-0.5 flex-shrink-0 uppercase tracking-wider"
                  style={{ color: catColor, border: `1px solid ${catColor}30`, minWidth: "40px", textAlign: "center" }}
                >
                  {msg.category}
                </span>
                <span className="flex-shrink-0" style={{ color: agent.color }}>
                  {agent.emoji} {agent.name}:
                </span>
                <span style={{ color: msg.category === "safety" ? "#f87171" : "rgba(0,255,156,0.7)" }}>
                  {msg.target && <span className="text-[9px]" style={{ color: "rgba(0,180,255,0.5)" }}>→{msg.target} </span>}
                  {msg.content}
                </span>
              </div>
            );
          })}

          {/* Scroll-to-latest button */}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
              }}
              className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] tracking-wider z-10"
              style={{
                background: "rgba(0,0,0,0.9)",
                border: "1px solid rgba(0,255,156,0.3)",
                color: "#00FF9C",
              }}
            >
              ↓ SCROLL TO LATEST
            </button>
          )}
        </div>

        {/* Composer */}
        <div
          className="flex items-center gap-2 flex-shrink-0 p-2"
          style={{
            border: "1px solid rgba(0,255,156,0.1)",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <span className="text-[9px] flex-shrink-0" style={{ color: "rgba(0,255,156,0.4)" }}>
            →{AGENTS[selectedTarget]?.name || selectedTarget}:
          </span>
          <input
            value={composerText}
            onChange={e => setComposerText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            placeholder="Send command to agent..."
            className="flex-1 bg-transparent text-[11px] outline-none"
            style={{ color: "#00FF9C", caretColor: "#00FF9C" }}
            data-testid="agent-comms-input"
          />
          <button
            onClick={sendMessage}
            className="flex items-center gap-1 px-3 py-1 text-[9px] tracking-wider"
            style={{
              border: "1px solid rgba(0,255,156,0.3)",
              color: "#00FF9C",
              background: "rgba(0,255,156,0.05)",
            }}
            data-testid="agent-comms-send"
          >
            <Send size={10} /> SEND
          </button>
        </div>
      </div>
    </AppShell>
  );
}
