import { useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Coins, Cpu, TrendingUp, Zap, Database, BarChart3, Bot,
  Clock, DollarSign, Settings, AlertTriangle, Save,
  Activity, CircleDot, Server, Gauge, Layers, Hash,
  ChevronDown, ChevronUp, Eye, Sliders
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   TOKEN USAGE PAGE
   Tracks token consumption, model costs, per-agent breakdowns,
   and budget alerts for the OpenClaw system.

   Data sources in production:
   - /usage cost command reading session logs
   - Gateway WebSocket events for real-time streaming
   - openclaw.json model pricing config
   - Session logs in ~/.openclaw/agents/<agentId>/sessions/
   ────────────────────────────────────────────────────────────── */

/* ──────────────────── TYPES ──────────────────── */

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  cacheReadCostPer1M: number;
  totalTokensUsed: number;
  totalCost: number;
  status: "active" | "standby" | "offline";
}

interface DayUsage {
  label: string;
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  cost: number;
}

interface AgentBreakdown {
  id: string;
  name: string;
  emoji: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  estimatedCost: number;
  sessions: number;
}

interface Session {
  id: string;
  agent: string;
  agentEmoji: string;
  model: string;
  duration: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: "active" | "completed";
}

interface CostSettings {
  dailyBudget: number;
  weeklyBudget: number;
  alertThreshold: number;
  alertsEnabled: boolean;
  modelOverrides: Record<string, { input: number; output: number }>;
}

/* ──────────────────── MOCK DATA ──────────────────── */

/* MOCK DATA: Token usage comes from /usage cost command which reads session logs in ~/.openclaw/agents/<agentId>/sessions/ */
const MOCK_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-6",
    name: "claude-opus-4-6",
    provider: "anthropic",
    providerLabel: "Anthropic",
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    cacheReadCostPer1M: 1.50,
    totalTokensUsed: 284_720,
    totalCost: 18.47,
    status: "active",
  },
  {
    id: "claude-sonnet-4-6",
    name: "claude-sonnet-4-6",
    provider: "anthropic",
    providerLabel: "Anthropic",
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    cacheReadCostPer1M: 0.30,
    totalTokensUsed: 1_482_350,
    totalCost: 12.36,
    status: "active",
  },
  {
    id: "gpt-4o",
    name: "gpt-4o",
    provider: "openai",
    providerLabel: "OpenAI",
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    cacheReadCostPer1M: 1.25,
    totalTokensUsed: 523_100,
    totalCost: 4.28,
    status: "standby",
  },
  {
    id: "gpt-4o-mini",
    name: "gpt-4o-mini",
    provider: "openai",
    providerLabel: "OpenAI",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    cacheReadCostPer1M: 0.075,
    totalTokensUsed: 3_241_600,
    totalCost: 1.62,
    status: "standby",
  },
  /* MOCK DATA: For local models (LM Studio/Ollama), cost is $0 but tokens are still tracked for context window management */
  {
    id: "local-qwen-32b",
    name: "local/qwen-32b",
    provider: "local/lm-studio",
    providerLabel: "LM Studio",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    cacheReadCostPer1M: 0,
    totalTokensUsed: 6_847_200,
    totalCost: 0,
    status: "active",
  },
  {
    id: "local-llama-70b",
    name: "local/llama-3.3-70b",
    provider: "local/lm-studio",
    providerLabel: "LM Studio",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    cacheReadCostPer1M: 0,
    totalTokensUsed: 2_156_800,
    totalCost: 0,
    status: "offline",
  },
  {
    id: "local-deepseek-r1",
    name: "local/deepseek-r1-14b",
    provider: "local/ollama",
    providerLabel: "Ollama",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    cacheReadCostPer1M: 0,
    totalTokensUsed: 892_300,
    totalCost: 0,
    status: "active",
  },
];

/* MOCK DATA: Model pricing config is in openclaw.json → models.providers.<provider>.models[].cost with fields: input, output, cacheRead, cacheWrite (USD per 1M tokens) */
const MOCK_DAILY_USAGE: DayUsage[] = [
  { label: "Mon", date: "2026-03-17", inputTokens: 1_840_000, outputTokens: 620_000, cacheTokens: 3_200_000, cost: 8.12 },
  { label: "Tue", date: "2026-03-18", inputTokens: 2_100_000, outputTokens: 890_000, cacheTokens: 2_800_000, cost: 11.47 },
  { label: "Wed", date: "2026-03-19", inputTokens: 1_520_000, outputTokens: 480_000, cacheTokens: 4_100_000, cost: 6.34 },
  { label: "Thu", date: "2026-03-20", inputTokens: 2_840_000, outputTokens: 1_120_000, cacheTokens: 3_600_000, cost: 14.92 },
  { label: "Fri", date: "2026-03-21", inputTokens: 3_200_000, outputTokens: 1_450_000, cacheTokens: 2_900_000, cost: 18.63 },
  { label: "Sat", date: "2026-03-22", inputTokens: 980_000, outputTokens: 310_000, cacheTokens: 5_200_000, cost: 3.21 },
  { label: "Sun", date: "2026-03-23", inputTokens: 1_640_000, outputTokens: 720_000, cacheTokens: 4_400_000, cost: 9.84 },
];

/* MOCK DATA: Per-agent breakdown aggregated from session logs. Each session records input_tokens, output_tokens per response */
const MOCK_AGENTS: AgentBreakdown[] = [
  { id: "a1", name: "Coco", emoji: "🐱", model: "claude-sonnet-4-6", inputTokens: 842_100, outputTokens: 312_400, cacheReadTokens: 1_840_000, estimatedCost: 7.82, sessions: 48 },
  { id: "a2", name: "Sentinel", emoji: "🛡️", model: "claude-opus-4-6", inputTokens: 184_200, outputTokens: 62_400, cacheReadTokens: 520_000, estimatedCost: 7.44, sessions: 12 },
  { id: "a3", name: "Archon", emoji: "🏗️", model: "local/qwen-32b", inputTokens: 4_200_000, outputTokens: 1_840_000, cacheReadTokens: 0, estimatedCost: 0, sessions: 156 },
  { id: "a4", name: "Scout", emoji: "🔍", model: "gpt-4o", inputTokens: 423_600, outputTokens: 189_200, cacheReadTokens: 680_000, estimatedCost: 3.12, sessions: 34 },
  { id: "a5", name: "Forge", emoji: "⚒️", model: "local/deepseek-r1-14b", inputTokens: 612_000, outputTokens: 280_300, cacheReadTokens: 0, estimatedCost: 0, sessions: 87 },
  { id: "a6", name: "Nexus", emoji: "🔗", model: "claude-sonnet-4-6", inputTokens: 640_250, outputTokens: 198_400, cacheReadTokens: 1_420_000, estimatedCost: 4.54, sessions: 29 },
  { id: "a7", name: "Phantom", emoji: "👻", model: "gpt-4o-mini", inputTokens: 2_841_600, outputTokens: 400_000, cacheReadTokens: 1_200_000, estimatedCost: 0.67, sessions: 210 },
];

/* MOCK DATA: Real-time token streaming comes from Gateway WebSocket events during active chat sessions */
const MOCK_SESSIONS: Session[] = [
  { id: "ses_a8f3c2", agent: "Coco", agentEmoji: "🐱", model: "claude-sonnet-4-6", duration: "ongoing", inputTokens: 24_800, outputTokens: 8_400, cost: 0.20, status: "active" },
  { id: "ses_b1d4e7", agent: "Sentinel", agentEmoji: "🛡️", model: "claude-opus-4-6", duration: "12m 34s", inputTokens: 18_200, outputTokens: 6_100, cost: 0.73, status: "completed" },
  { id: "ses_c9e2f1", agent: "Archon", agentEmoji: "🏗️", model: "local/qwen-32b", duration: "45m 12s", inputTokens: 142_000, outputTokens: 68_400, cost: 0, status: "completed" },
  { id: "ses_d3a7b8", agent: "Coco", agentEmoji: "🐱", model: "claude-sonnet-4-6", duration: "8m 22s", inputTokens: 12_400, outputTokens: 4_200, cost: 0.10, status: "completed" },
  { id: "ses_e5f1c4", agent: "Scout", agentEmoji: "🔍", model: "gpt-4o", duration: "3m 48s", inputTokens: 8_600, outputTokens: 3_200, cost: 0.05, status: "completed" },
  { id: "ses_f7a2d9", agent: "Phantom", agentEmoji: "👻", model: "gpt-4o-mini", duration: "22m 15s", inputTokens: 84_200, outputTokens: 12_000, cost: 0.02, status: "completed" },
  { id: "ses_g2b8e3", agent: "Forge", agentEmoji: "⚒️", model: "local/deepseek-r1-14b", duration: "ongoing", inputTokens: 32_600, outputTokens: 14_800, cost: 0, status: "active" },
  { id: "ses_h4c1f6", agent: "Nexus", agentEmoji: "🔗", model: "claude-sonnet-4-6", duration: "5m 41s", inputTokens: 9_800, outputTokens: 3_600, cost: 0.07, status: "completed" },
  { id: "ses_i6d3a2", agent: "Archon", agentEmoji: "🏗️", model: "local/qwen-32b", duration: "1h 12m", inputTokens: 286_000, outputTokens: 124_000, cost: 0, status: "completed" },
  { id: "ses_j8e5b7", agent: "Coco", agentEmoji: "🐱", model: "claude-sonnet-4-6", duration: "15m 08s", inputTokens: 28_400, outputTokens: 9_800, cost: 0.23, status: "completed" },
];

/* MOCK DATA: Cache hit rate and cache costs only apply to API providers (Anthropic, OpenAI). Local models don't have caching. */

/* ──────────────────── HELPERS ──────────────────── */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatCost(n: number): string {
  return "$" + n.toFixed(2);
}

/* ──────────────────── COMPONENTS ──────────────────── */

/* ---------- Section Header ---------- */
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="panel-header">
      <Icon size={12} style={{ color: "var(--cyan)" }} />
      <span>{label}</span>
    </div>
  );
}

/* ---------- Stat Card ---------- */
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "var(--cyan)",
  testId,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  testId: string;
}) {
  return (
    <div className="terminal-panel p-3 flex-1 min-w-[140px]" data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <span
          style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(0,255,156,0.5)" }}
          className="uppercase"
        >
          {label}
        </span>
      </div>
      <div
        className="glow-text font-bold"
        style={{ fontSize: 20, color }}
        data-testid={`${testId}-value`}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: "rgba(0,255,156,0.35)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ---------- Status Badge ---------- */
function StatusBadge({ status }: { status: "active" | "standby" | "offline" | "completed" }) {
  const map = {
    active: { bg: "rgba(0,255,156,0.12)", color: "#00FF9C", border: "rgba(0,255,156,0.3)", label: "ACTIVE" },
    standby: { bg: "rgba(0,180,255,0.12)", color: "#00B4FF", border: "rgba(0,180,255,0.3)", label: "STANDBY" },
    offline: { bg: "rgba(255,45,120,0.12)", color: "#FF2D78", border: "rgba(255,45,120,0.3)", label: "OFFLINE" },
    completed: { bg: "rgba(0,255,156,0.08)", color: "rgba(0,255,156,0.5)", border: "rgba(0,255,156,0.15)", label: "DONE" },
  };
  const s = map[status];
  return (
    <span
      style={{
        fontSize: 8,
        letterSpacing: "0.12em",
        padding: "2px 6px",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  );
}

/* ---------- Model Table ---------- */
function ModelTable({ models }: { models: ModelInfo[] }) {
  const [sortField, setSortField] = useState<"totalCost" | "totalTokensUsed">("totalCost");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...models].sort((a, b) => {
    const va = a[sortField];
    const vb = b[sortField];
    return sortAsc ? va - vb : vb - va;
  });

  const toggleSort = (field: "totalCost" | "totalTokensUsed") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const SortIcon = sortAsc ? ChevronUp : ChevronDown;

  return (
    <div className="terminal-panel" data-testid="model-table">
      <SectionHeader icon={Cpu} label="INSTALLED MODELS" />
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,255,156,0.1)" }}>
              {["Model", "Provider", "Input/1M", "Output/1M", "Cache Rd/1M", ""].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 8,
                    letterSpacing: "0.12em",
                    color: "rgba(0,255,156,0.4)",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
              <th
                style={{
                  padding: "8px 10px",
                  textAlign: "right",
                  fontSize: 8,
                  letterSpacing: "0.12em",
                  color: "rgba(0,255,156,0.4)",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleSort("totalTokensUsed")}
                data-testid="sort-total-tokens"
              >
                <span className="inline-flex items-center gap-1">
                  Tokens Used
                  {sortField === "totalTokensUsed" && <SortIcon size={10} />}
                </span>
              </th>
              <th
                style={{
                  padding: "8px 10px",
                  textAlign: "right",
                  fontSize: 8,
                  letterSpacing: "0.12em",
                  color: "rgba(0,255,156,0.4)",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleSort("totalCost")}
                data-testid="sort-total-cost"
              >
                <span className="inline-flex items-center gap-1">
                  Total Cost
                  {sortField === "totalCost" && <SortIcon size={10} />}
                </span>
              </th>
              <th
                style={{
                  padding: "8px 10px",
                  textAlign: "center",
                  fontSize: 8,
                  letterSpacing: "0.12em",
                  color: "rgba(0,255,156,0.4)",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr
                key={m.id}
                style={{ borderBottom: "1px solid rgba(0,255,156,0.05)" }}
                className="hover:bg-[rgba(0,255,156,0.03)] transition-colors"
                data-testid={`model-row-${m.id}`}
              >
                <td style={{ padding: "8px 10px", color: "#00FF9C", fontWeight: 600 }}>
                  {m.name}
                </td>
                <td style={{ padding: "8px 10px", color: "rgba(0,180,255,0.7)" }}>
                  {m.providerLabel}
                </td>
                <td style={{ padding: "8px 10px", color: "rgba(0,255,156,0.6)" }}>
                  {m.inputCostPer1M === 0 ? (
                    <span style={{ color: "rgba(0,255,156,0.3)" }}>FREE</span>
                  ) : (
                    formatCost(m.inputCostPer1M)
                  )}
                </td>
                <td style={{ padding: "8px 10px", color: "rgba(0,255,156,0.6)" }}>
                  {m.outputCostPer1M === 0 ? (
                    <span style={{ color: "rgba(0,255,156,0.3)" }}>FREE</span>
                  ) : (
                    formatCost(m.outputCostPer1M)
                  )}
                </td>
                <td style={{ padding: "8px 10px", color: "rgba(0,255,156,0.6)" }}>
                  {m.cacheReadCostPer1M === 0 ? (
                    <span style={{ color: "rgba(0,255,156,0.3)" }}>—</span>
                  ) : (
                    formatCost(m.cacheReadCostPer1M)
                  )}
                </td>
                <td style={{ padding: "8px 10px" }} />
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#00B4FF" }}>
                  {formatTokens(m.totalTokensUsed)}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    color: m.totalCost > 0 ? "#FF2D78" : "rgba(0,255,156,0.3)",
                    fontWeight: m.totalCost > 0 ? 600 : 400,
                  }}
                >
                  {m.totalCost > 0 ? formatCost(m.totalCost) : "$0.00"}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>
                  <StatusBadge status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Usage Timeline (CSS bars) ---------- */
function UsageTimeline({ days }: { days: DayUsage[] }) {
  const maxTokens = Math.max(...days.map((d) => d.inputTokens + d.outputTokens + d.cacheTokens));

  return (
    <div className="terminal-panel" data-testid="usage-timeline">
      <SectionHeader icon={BarChart3} label="TOKEN USAGE — LAST 7 DAYS" />
      <div className="p-3 space-y-2">
        {days.map((d) => {
          const total = d.inputTokens + d.outputTokens + d.cacheTokens;
          const pctInput = (d.inputTokens / maxTokens) * 100;
          const pctOutput = (d.outputTokens / maxTokens) * 100;
          const pctCache = (d.cacheTokens / maxTokens) * 100;

          return (
            <div key={d.date} className="flex items-center gap-3" data-testid={`usage-day-${d.label.toLowerCase()}`}>
              {/* Day label */}
              <span
                style={{
                  width: 32,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "rgba(0,255,156,0.5)",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {d.label}
              </span>

              {/* Bar container */}
              <div
                style={{
                  flex: 1,
                  height: 16,
                  background: "rgba(0,255,156,0.03)",
                  border: "1px solid rgba(0,255,156,0.08)",
                  display: "flex",
                  overflow: "hidden",
                }}
              >
                {/* Input tokens bar */}
                <div
                  style={{
                    width: `${pctInput}%`,
                    background: "rgba(0,255,156,0.5)",
                    transition: "width 0.6s ease",
                  }}
                  title={`Input: ${formatTokens(d.inputTokens)}`}
                />
                {/* Output tokens bar */}
                <div
                  style={{
                    width: `${pctOutput}%`,
                    background: "rgba(255,45,120,0.6)",
                    transition: "width 0.6s ease",
                  }}
                  title={`Output: ${formatTokens(d.outputTokens)}`}
                />
                {/* Cache tokens bar */}
                <div
                  style={{
                    width: `${pctCache}%`,
                    background: "rgba(0,180,255,0.35)",
                    transition: "width 0.6s ease",
                  }}
                  title={`Cache: ${formatTokens(d.cacheTokens)}`}
                />
              </div>

              {/* Stats */}
              <div
                style={{
                  width: 90,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 9, color: "#00B4FF" }}>
                  {formatTokens(total)}
                </span>
                <span style={{ fontSize: 8, color: "rgba(255,45,120,0.7)" }}>
                  {formatCost(d.cost)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2" style={{ borderTop: "1px solid rgba(0,255,156,0.06)" }}>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 6, background: "rgba(0,255,156,0.5)" }} />
            <span style={{ fontSize: 8, color: "rgba(0,255,156,0.4)" }}>INPUT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 6, background: "rgba(255,45,120,0.6)" }} />
            <span style={{ fontSize: 8, color: "rgba(0,255,156,0.4)" }}>OUTPUT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 6, background: "rgba(0,180,255,0.35)" }} />
            <span style={{ fontSize: 8, color: "rgba(0,255,156,0.4)" }}>CACHE READ</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Agent Breakdown ---------- */
function AgentBreakdownTable({ agents }: { agents: AgentBreakdown[] }) {
  return (
    <div className="terminal-panel" data-testid="agent-breakdown">
      <SectionHeader icon={Bot} label="PER-AGENT TOKEN BREAKDOWN" />
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,255,156,0.1)" }}>
              {["Agent", "Model", "Input Tok", "Output Tok", "Cache Tok", "Est. Cost", "Sessions"].map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "8px 10px",
                      textAlign: i >= 2 ? "right" : "left",
                      fontSize: 8,
                      letterSpacing: "0.12em",
                      color: "rgba(0,255,156,0.4)",
                      textTransform: "uppercase",
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr
                key={a.id}
                style={{ borderBottom: "1px solid rgba(0,255,156,0.05)" }}
                className="hover:bg-[rgba(0,255,156,0.03)] transition-colors"
                data-testid={`agent-row-${a.id}`}
              >
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ marginRight: 6 }}>{a.emoji}</span>
                  <span style={{ color: "#00FF9C", fontWeight: 600 }}>{a.name}</span>
                </td>
                <td style={{ padding: "8px 10px", color: "rgba(0,180,255,0.7)", fontSize: 9 }}>
                  {a.model}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "rgba(0,255,156,0.6)" }}>
                  {formatTokens(a.inputTokens)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "rgba(255,45,120,0.6)" }}>
                  {formatTokens(a.outputTokens)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "rgba(0,180,255,0.5)" }}>
                  {a.cacheReadTokens > 0 ? formatTokens(a.cacheReadTokens) : "—"}
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    color: a.estimatedCost > 0 ? "#FF2D78" : "rgba(0,255,156,0.3)",
                    fontWeight: a.estimatedCost > 0 ? 600 : 400,
                  }}
                >
                  {formatCost(a.estimatedCost)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "rgba(0,255,156,0.5)" }}>
                  {a.sessions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Recent Sessions ---------- */
function RecentSessions({ sessions }: { sessions: Session[] }) {
  return (
    <div className="terminal-panel" data-testid="recent-sessions">
      <SectionHeader icon={Clock} label="RECENT SESSIONS" />
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,255,156,0.1)" }}>
              {["Session ID", "Agent", "Model", "Duration", "Tokens (I/O)", "Cost", "Status"].map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "8px 10px",
                      textAlign: i >= 4 ? "right" : "left",
                      fontSize: 8,
                      letterSpacing: "0.12em",
                      color: "rgba(0,255,156,0.4)",
                      textTransform: "uppercase",
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                style={{ borderBottom: "1px solid rgba(0,255,156,0.05)" }}
                className="hover:bg-[rgba(0,255,156,0.03)] transition-colors"
                data-testid={`session-row-${s.id}`}
              >
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ color: "rgba(0,255,156,0.5)", fontFamily: "monospace" }}>
                    <Hash size={9} className="inline mr-1" style={{ color: "rgba(0,255,156,0.3)" }} />
                    {s.id.replace("ses_", "")}
                  </span>
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ marginRight: 4 }}>{s.agentEmoji}</span>
                  <span style={{ color: "#00FF9C" }}>{s.agent}</span>
                </td>
                <td style={{ padding: "8px 10px", color: "rgba(0,180,255,0.7)", fontSize: 9 }}>
                  {s.model}
                </td>
                <td style={{ padding: "8px 10px", color: "rgba(0,255,156,0.5)" }}>
                  {s.status === "active" ? (
                    <span className="inline-flex items-center gap-1">
                      <CircleDot size={9} className="animate-pulse" style={{ color: "#00FF9C" }} />
                      <span style={{ color: "#00FF9C" }}>live</span>
                    </span>
                  ) : (
                    s.duration
                  )}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  <span style={{ color: "rgba(0,255,156,0.6)" }}>{formatTokens(s.inputTokens)}</span>
                  <span style={{ color: "rgba(0,255,156,0.2)", margin: "0 3px" }}>/</span>
                  <span style={{ color: "rgba(255,45,120,0.6)" }}>{formatTokens(s.outputTokens)}</span>
                </td>
                <td
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    color: s.cost > 0 ? "#FF2D78" : "rgba(0,255,156,0.3)",
                    fontWeight: s.cost > 0 ? 600 : 400,
                  }}
                >
                  {formatCost(s.cost)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Cost Settings Panel ---------- */
function CostSettingsPanel() {
  const [settings, setSettings] = useState<CostSettings>({
    dailyBudget: 25.0,
    weeklyBudget: 150.0,
    alertThreshold: 80,
    alertsEnabled: true,
    modelOverrides: {},
  });
  const [expanded, setExpanded] = useState(false);

  const todayCost = MOCK_DAILY_USAGE[MOCK_DAILY_USAGE.length - 1].cost;
  const weekCost = MOCK_DAILY_USAGE.reduce((s, d) => s + d.cost, 0);
  const dailyPct = Math.min((todayCost / settings.dailyBudget) * 100, 100);
  const weeklyPct = Math.min((weekCost / settings.weeklyBudget) * 100, 100);

  return (
    <div className="terminal-panel" data-testid="cost-settings">
      <div
        className="panel-header cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        data-testid="toggle-cost-settings"
      >
        <Settings size={12} style={{ color: "var(--cyan)" }} />
        <span className="flex-1">COST SETTINGS & BUDGET ALERTS</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </div>

      {/* Budget progress bars (always visible) */}
      <div className="p-3 space-y-3">
        {/* Daily Budget */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>
              DAILY BUDGET
            </span>
            <span style={{ fontSize: 9 }}>
              <span style={{ color: dailyPct >= 80 ? "#FF2D78" : "#00FF9C" }}>
                {formatCost(todayCost)}
              </span>
              <span style={{ color: "rgba(0,255,156,0.3)" }}> / {formatCost(settings.dailyBudget)}</span>
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "rgba(0,255,156,0.05)",
              border: "1px solid rgba(0,255,156,0.08)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${dailyPct}%`,
                background:
                  dailyPct >= 90
                    ? "#FF2D78"
                    : dailyPct >= 70
                    ? "rgba(255,180,0,0.7)"
                    : "#00FF9C",
                transition: "width 0.4s ease",
              }}
              data-testid="daily-budget-bar"
            />
          </div>
        </div>

        {/* Weekly Budget */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>
              WEEKLY BUDGET
            </span>
            <span style={{ fontSize: 9 }}>
              <span style={{ color: weeklyPct >= 80 ? "#FF2D78" : "#00FF9C" }}>
                {formatCost(weekCost)}
              </span>
              <span style={{ color: "rgba(0,255,156,0.3)" }}> / {formatCost(settings.weeklyBudget)}</span>
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "rgba(0,255,156,0.05)",
              border: "1px solid rgba(0,255,156,0.08)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${weeklyPct}%`,
                background:
                  weeklyPct >= 90
                    ? "#FF2D78"
                    : weeklyPct >= 70
                    ? "rgba(255,180,0,0.7)"
                    : "#00FF9C",
                transition: "width 0.4s ease",
              }}
              data-testid="weekly-budget-bar"
            />
          </div>
        </div>

        {/* Alert threshold indicator */}
        {settings.alertsEnabled && (dailyPct >= settings.alertThreshold || weeklyPct >= settings.alertThreshold) && (
          <div
            className="flex items-center gap-2 p-2"
            style={{
              background: "rgba(255,45,120,0.08)",
              border: "1px solid rgba(255,45,120,0.2)",
              fontSize: 9,
            }}
            data-testid="budget-alert"
          >
            <AlertTriangle size={12} style={{ color: "#FF2D78", flexShrink: 0 }} />
            <span style={{ color: "#FF2D78" }}>
              Budget alert: Spending has exceeded {settings.alertThreshold}% of{" "}
              {dailyPct >= settings.alertThreshold ? "daily" : "weekly"} limit
            </span>
          </div>
        )}
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div
          className="p-3 space-y-3"
          style={{ borderTop: "1px solid rgba(0,255,156,0.08)" }}
        >
          {/* Budget inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", letterSpacing: "0.1em" }}
                className="block mb-1 uppercase"
              >
                Daily Limit (USD)
              </label>
              <input
                type="number"
                value={settings.dailyBudget}
                onChange={(e) =>
                  setSettings({ ...settings, dailyBudget: parseFloat(e.target.value) || 0 })
                }
                className="w-full p-1.5"
                style={{
                  fontSize: 11,
                  background: "rgba(0,255,156,0.03)",
                  border: "1px solid rgba(0,255,156,0.15)",
                  color: "#00FF9C",
                  fontFamily: "monospace",
                  outline: "none",
                }}
                data-testid="input-daily-budget"
              />
            </div>
            <div>
              <label
                style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", letterSpacing: "0.1em" }}
                className="block mb-1 uppercase"
              >
                Weekly Limit (USD)
              </label>
              <input
                type="number"
                value={settings.weeklyBudget}
                onChange={(e) =>
                  setSettings({ ...settings, weeklyBudget: parseFloat(e.target.value) || 0 })
                }
                className="w-full p-1.5"
                style={{
                  fontSize: 11,
                  background: "rgba(0,255,156,0.03)",
                  border: "1px solid rgba(0,255,156,0.15)",
                  color: "#00FF9C",
                  fontFamily: "monospace",
                  outline: "none",
                }}
                data-testid="input-weekly-budget"
              />
            </div>
          </div>

          {/* Alert threshold */}
          <div>
            <label
              style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", letterSpacing: "0.1em" }}
              className="block mb-1 uppercase"
            >
              Alert Threshold (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={settings.alertThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, alertThreshold: parseInt(e.target.value) })
                }
                className="flex-1"
                style={{ accentColor: "#00FF9C" }}
                data-testid="input-alert-threshold"
              />
              <span style={{ fontSize: 11, color: "#00FF9C", width: 36, textAlign: "right" }}>
                {settings.alertThreshold}%
              </span>
            </div>
          </div>

          {/* Enable alerts toggle */}
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>
              BUDGET ALERTS
            </span>
            <div
              className={`claw-switch ${settings.alertsEnabled ? "on" : ""}`}
              onClick={() => setSettings({ ...settings, alertsEnabled: !settings.alertsEnabled })}
              data-testid="toggle-alerts"
            />
          </div>

          {/* Model cost overrides section */}
          <div style={{ borderTop: "1px solid rgba(0,255,156,0.06)", paddingTop: 12 }}>
            <div className="flex items-center gap-2 mb-2">
              <Sliders size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
              <span
                style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", letterSpacing: "0.1em" }}
                className="uppercase"
              >
                Model Cost Overrides
              </span>
            </div>
            <div
              style={{ fontSize: 9, color: "rgba(0,255,156,0.3)", lineHeight: 1.6, padding: "4px 0" }}
            >
              {/* MOCK DATA: Model pricing config is in openclaw.json → models.providers.&lt;provider&gt;.models[].cost */}
              Override default pricing for custom provider agreements. Edit in{" "}
              <span style={{ color: "#00B4FF" }}>openclaw.json</span> →{" "}
              <span style={{ color: "rgba(0,255,156,0.5)" }}>
                models.providers.&lt;provider&gt;.models[].cost
              </span>
            </div>
            {MOCK_MODELS.filter((m) => m.inputCostPer1M > 0).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 py-1.5"
                style={{ borderBottom: "1px solid rgba(0,255,156,0.04)" }}
              >
                <span style={{ fontSize: 9, color: "rgba(0,255,156,0.6)", width: 140, flexShrink: 0 }}>
                  {m.name}
                </span>
                <span style={{ fontSize: 8, color: "rgba(0,255,156,0.3)" }}>IN:</span>
                <span style={{ fontSize: 9, color: "#00FF9C" }}>${m.inputCostPer1M}</span>
                <span style={{ fontSize: 8, color: "rgba(0,255,156,0.3)", marginLeft: 8 }}>OUT:</span>
                <span style={{ fontSize: 9, color: "#FF2D78" }}>${m.outputCostPer1M}</span>
              </div>
            ))}
          </div>

          {/* Save button */}
          <button
            className="w-full flex items-center justify-center gap-2 p-2 mt-2"
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "rgba(0,255,156,0.08)",
              border: "1px solid rgba(0,255,156,0.25)",
              color: "#00FF9C",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,156,0.15)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,156,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,156,0.08)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,156,0.25)";
            }}
            data-testid="button-save-settings"
          >
            <Save size={12} />
            Save Cost Settings
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── MAIN PAGE ──────────────────── */

export default function TokenUsage() {
  /* Compute top-level stats from mock data */
  const todayUsage = MOCK_DAILY_USAGE[MOCK_DAILY_USAGE.length - 1];
  const todayTotalTokens = todayUsage.inputTokens + todayUsage.outputTokens + todayUsage.cacheTokens;
  const todayCost = todayUsage.cost;
  const totalSessions = MOCK_AGENTS.reduce((s, a) => s + a.sessions, 0);
  const avgCostPerMessage = todayCost / (totalSessions > 0 ? Math.ceil(totalSessions / 7) : 1);
  const activeModel = MOCK_MODELS.find((m) => m.status === "active" && m.provider !== "local/lm-studio" && m.provider !== "local/ollama");

  /* MOCK DATA: Cache hit rate and cache costs only apply to API providers (Anthropic, OpenAI). Local models don't have caching. */
  const totalCacheTokens = MOCK_DAILY_USAGE.reduce((s, d) => s + d.cacheTokens, 0);
  const totalInputTokens = MOCK_DAILY_USAGE.reduce((s, d) => s + d.inputTokens, 0);
  const cacheHitRate = ((totalCacheTokens / (totalCacheTokens + totalInputTokens)) * 100).toFixed(1);

  return (
    <AppShell>
      <div className="flex-1 p-3 h-full overflow-y-auto space-y-3" data-testid="token-usage-page">
        {/* ── PAGE TITLE ── */}
        <div className="flex items-center gap-2 mb-1">
          <Coins size={16} style={{ color: "#00FF9C" }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#00FF9C",
              textTransform: "uppercase",
            }}
          >
            Token Usage & Cost Tracking
          </span>
          <span style={{ fontSize: 9, color: "rgba(0,255,156,0.25)", marginLeft: "auto" }}>
            {/* MOCK DATA: Real-time token streaming comes from Gateway WebSocket events during active chat sessions */}
            LIVE · GATEWAY WS
          </span>
          <CircleDot size={8} className="animate-pulse" style={{ color: "#00FF9C" }} />
        </div>

        {/* ── TOP STATS ROW ── */}
        <div className="flex flex-wrap gap-2" data-testid="top-stats">
          <StatCard
            icon={Layers}
            label="Tokens Today"
            value={formatTokens(todayTotalTokens)}
            sub={`${formatTokens(todayUsage.inputTokens)} in / ${formatTokens(todayUsage.outputTokens)} out`}
            testId="stat-tokens-today"
          />
          <StatCard
            icon={DollarSign}
            label="Cost Today"
            value={formatCost(todayCost)}
            sub={`Avg ${formatCost(avgCostPerMessage)}/msg`}
            color="#FF2D78"
            testId="stat-cost-today"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Cost/Message"
            value={formatCost(avgCostPerMessage)}
            sub="across all agents"
            color="#00B4FF"
            testId="stat-avg-cost"
          />
          <StatCard
            icon={Cpu}
            label="Active Model"
            value={activeModel?.name || "—"}
            sub={activeModel?.providerLabel}
            testId="stat-active-model"
          />
          <StatCard
            icon={Database}
            label="Cache Hit Rate"
            value={`${cacheHitRate}%`}
            sub="API providers only"
            color="#00B4FF"
            testId="stat-cache-rate"
          />
        </div>

        {/* ── MODEL TABLE ── */}
        <ModelTable models={MOCK_MODELS} />

        {/* ── USAGE TIMELINE + COST SETTINGS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
          <UsageTimeline days={MOCK_DAILY_USAGE} />
          <CostSettingsPanel />
        </div>

        {/* ── AGENT BREAKDOWN ── */}
        <AgentBreakdownTable agents={MOCK_AGENTS} />

        {/* ── RECENT SESSIONS ── */}
        <RecentSessions sessions={MOCK_SESSIONS} />

        {/* ── FOOTER NOTE ── */}
        <div
          className="text-center py-2"
          style={{ fontSize: 8, color: "rgba(0,255,156,0.15)", letterSpacing: "0.08em" }}
        >
          {/* MOCK DATA: For local models (LM Studio/Ollama), cost is $0 but tokens are still tracked for context window management */}
          Token data sourced from session logs · Local model costs are $0 · Cache metrics apply to API providers only
        </div>
      </div>
    </AppShell>
  );
}
