import { useState, useMemo, useCallback } from "react";
import AppShell from "@/components/AppShell";
import {
  ListTodo, Plus, Filter, X, Clock, Zap, Bot, ChevronRight,
  CheckCircle2, AlertTriangle, Circle, Timer, Layers, Brain,
  Activity, BarChart3, DollarSign, ChevronDown, ArrowUpRight,
  Play, Pause, Lock, FileText, Hash, Cpu, Loader2, Search
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   TASK PLANNER PAGE — Kanban-style mission board
   Tracks all tasks dispatched to agents, with real-time
   progress, token usage, and sub-step tracking.

   Inspired by builderz-labs/mission-control task-planner:
   - Kanban columns for lifecycle stages
   - Per-task token accounting & cost estimation
   - Sub-step progress from workspace files
   - Agent assignment with identity emojis
   - Priority color coding (critical → low)

   MOCK DATA: Tasks should come from Gateway WebSocket events.
   The gateway tracks task lifecycle via session state.
   ────────────────────────────────────────────────────────────── */

/* ─── Types ──────────────────────────────────────────────────── */
type TaskStatus = "QUEUED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
type TaskPriority = "critical" | "high" | "medium" | "low";

interface SubStep {
  id: string;
  label: string;
  done: boolean;
}

interface AgentLog {
  timestamp: Date;
  message: string;
  type: "info" | "tool" | "thinking" | "error";
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  agentId: string;
  model: string;
  tokensUsed: number;
  tokenBudget: number;
  timeElapsedMin: number;
  timeEstimateMin: number;
  subSteps: SubStep[];
  dependencies: string[];
  createdAt: Date;
  logs: AgentLog[];
}

/* ─── Agent identity system ──────────────────────────────────── */
interface AgentIdentity {
  name: string;
  emoji: string;
  color: string;
}

/* MOCK DATA: If Gateway is not connected, Coco monitors tasks by
   reading progress.md and task_plan.md from the workspace
   (planning-with-files skill pattern) */
const AGENTS: Record<string, AgentIdentity> = {
  coco:       { name: "Coco",       emoji: "🎃", color: "#FF9C00" },
  researcher: { name: "Researcher", emoji: "🔬", color: "#22d3ee" },
  builder:    { name: "Builder",    emoji: "🛠️", color: "#60a5fa" },
  security:   { name: "SecOps",     emoji: "🛡️", color: "#f87171" },
  scraper:    { name: "Scraper",    emoji: "🕷️", color: "#a78bfa" },
  monitor:    { name: "Monitor",    emoji: "📡", color: "#34d399" },
};

/* ─── Priority styling ───────────────────────────────────────── */
const PRIORITY_CONFIG: Record<TaskPriority, { color: string; bg: string; label: string }> = {
  critical: { color: "#FF2D78", bg: "rgba(255,45,120,0.12)", label: "CRITICAL" },
  high:     { color: "#FF9C00", bg: "rgba(255,156,0,0.10)",  label: "HIGH" },
  medium:   { color: "#00B4FF", bg: "rgba(0,180,255,0.10)",  label: "MEDIUM" },
  low:      { color: "rgba(0,255,156,0.5)", bg: "rgba(0,255,156,0.05)", label: "LOW" },
};

/* ─── Status column configuration ─────────────────────────────── */
const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string; icon: React.ElementType }[] = [
  { key: "QUEUED",      label: "QUEUED",       color: "rgba(0,255,156,0.4)", icon: Clock },
  { key: "IN_PROGRESS", label: "IN PROGRESS",  color: "#00B4FF",             icon: Play },
  { key: "BLOCKED",     label: "BLOCKED",       color: "#FF2D78",             icon: Lock },
  { key: "COMPLETED",   label: "COMPLETED",     color: "#00FF9C",             icon: CheckCircle2 },
];

/* ──────────────────────────────────────────────────────────────
   MOCK TASK DATA
   MOCK DATA: Token usage per task comes from /usage cost command
   data, aggregated from session logs in
   ~/.openclaw/agents/<agentId>/sessions/
   ────────────────────────────────────────────────────────────── */
const now = new Date();
const ago = (mins: number) => new Date(now.getTime() - mins * 60_000);

/* MOCK DATA: Sub-step progress tracked in workspace files:
   task_plan.md (plan), progress.md (status updates),
   findings.md (results) */
const MOCK_TASKS: Task[] = [
  {
    id: "t-001",
    title: "Enumerate target subdomains",
    description: "Run amass + subfinder against target domain. Cross-reference with certificate transparency logs and DNS brute-force. Output consolidated list to findings.md.",
    status: "COMPLETED",
    priority: "high",
    agentId: "researcher",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 42_800,
    tokenBudget: 50_000,
    timeElapsedMin: 23,
    timeEstimateMin: 30,
    subSteps: [
      { id: "s1", label: "Run amass enumeration", done: true },
      { id: "s2", label: "Run subfinder scan", done: true },
      { id: "s3", label: "Query CT logs", done: true },
      { id: "s4", label: "DNS brute-force", done: true },
      { id: "s5", label: "Deduplicate & validate", done: true },
      { id: "s6", label: "Write findings.md", done: true },
    ],
    dependencies: [],
    createdAt: ago(55),
    logs: [
      { timestamp: ago(54), message: "Starting subdomain enumeration pipeline", type: "info" },
      { timestamp: ago(50), message: "tool_call: amass enum -d target.com -passive", type: "tool" },
      { timestamp: ago(40), message: "Amass found 147 subdomains. Running subfinder for comparison...", type: "thinking" },
      { timestamp: ago(35), message: "tool_call: subfinder -d target.com -silent", type: "tool" },
      { timestamp: ago(28), message: "Merged results: 203 unique subdomains. Writing to findings.md", type: "info" },
    ],
  },
  {
    id: "t-002",
    title: "Port scan discovered hosts",
    description: "Nmap SYN scan on top 1000 ports across all enumerated subdomains. Identify open services, version detection where possible. Feed results to vuln scanner.",
    status: "IN_PROGRESS",
    priority: "high",
    agentId: "security",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 18_200,
    tokenBudget: 40_000,
    timeElapsedMin: 12,
    timeEstimateMin: 25,
    subSteps: [
      { id: "s1", label: "Parse subdomain list from findings.md", done: true },
      { id: "s2", label: "Resolve IPs and deduplicate", done: true },
      { id: "s3", label: "Run nmap SYN scan (batch 1/3)", done: true },
      { id: "s4", label: "Run nmap SYN scan (batch 2/3)", done: false },
      { id: "s5", label: "Run nmap SYN scan (batch 3/3)", done: false },
      { id: "s6", label: "Service version detection", done: false },
      { id: "s7", label: "Generate port scan report", done: false },
    ],
    dependencies: ["t-001"],
    createdAt: ago(30),
    logs: [
      { timestamp: ago(29), message: "Loaded 203 subdomains from findings.md", type: "info" },
      { timestamp: ago(25), message: "Resolved to 89 unique IPs", type: "thinking" },
      { timestamp: ago(22), message: "tool_call: nmap -sS -T4 --top-ports 1000 -iL batch1.txt", type: "tool" },
      { timestamp: ago(15), message: "Batch 1 complete: 34 hosts scanned, 127 open ports found", type: "info" },
    ],
  },
  {
    id: "t-003",
    title: "Vulnerability assessment on open services",
    description: "Run nuclei templates against discovered services. Focus on critical and high severity CVEs. Cross-reference with exploit-db.",
    status: "QUEUED",
    priority: "critical",
    agentId: "security",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 0,
    tokenBudget: 60_000,
    timeElapsedMin: 0,
    timeEstimateMin: 45,
    subSteps: [
      { id: "s1", label: "Load port scan results", done: false },
      { id: "s2", label: "Select nuclei templates", done: false },
      { id: "s3", label: "Run nuclei scan", done: false },
      { id: "s4", label: "Cross-reference exploit-db", done: false },
      { id: "s5", label: "Triage and prioritize findings", done: false },
      { id: "s6", label: "Generate vuln report", done: false },
    ],
    dependencies: ["t-002"],
    createdAt: ago(28),
    logs: [],
  },
  {
    id: "t-004",
    title: "OSINT on target organization",
    description: "Gather publicly available information: employee lists, tech stack, social media presence, leaked credentials. Use theHarvester, LinkedIn scraping, and breach databases.",
    status: "IN_PROGRESS",
    priority: "medium",
    agentId: "scraper",
    model: "gpt-4o",
    tokensUsed: 31_400,
    tokenBudget: 45_000,
    timeElapsedMin: 18,
    timeEstimateMin: 35,
    subSteps: [
      { id: "s1", label: "Run theHarvester (email enum)", done: true },
      { id: "s2", label: "LinkedIn employee mapping", done: true },
      { id: "s3", label: "Tech stack fingerprinting", done: true },
      { id: "s4", label: "Check breach databases", done: false },
      { id: "s5", label: "Social media analysis", done: false },
      { id: "s6", label: "Compile OSINT dossier", done: false },
    ],
    dependencies: [],
    createdAt: ago(40),
    logs: [
      { timestamp: ago(39), message: "Starting OSINT collection pipeline", type: "info" },
      { timestamp: ago(35), message: "tool_call: theHarvester -d target.com -b all", type: "tool" },
      { timestamp: ago(30), message: "Found 47 email addresses. Mapping org structure...", type: "thinking" },
      { timestamp: ago(22), message: "Tech stack identified: React, Node.js, AWS, PostgreSQL", type: "info" },
    ],
  },
  {
    id: "t-005",
    title: "Deploy monitoring infrastructure",
    description: "Set up continuous monitoring on target: DNS changes, cert transparency, new subdomain alerts, port change detection. Configure alerting to Coco via webhook.",
    status: "BLOCKED",
    priority: "medium",
    agentId: "monitor",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 8_600,
    tokenBudget: 30_000,
    timeElapsedMin: 7,
    timeEstimateMin: 20,
    subSteps: [
      { id: "s1", label: "Configure DNS monitor", done: true },
      { id: "s2", label: "Set up CT log watcher", done: true },
      { id: "s3", label: "Deploy port change scanner", done: false },
      { id: "s4", label: "Configure webhook alerting", done: false },
      { id: "s5", label: "Verify alert pipeline", done: false },
    ],
    dependencies: ["t-001"],
    createdAt: ago(20),
    logs: [
      { timestamp: ago(19), message: "DNS monitor configured for target.com", type: "info" },
      { timestamp: ago(15), message: "CT log watcher active. Waiting for port scan results to configure change detection...", type: "thinking" },
      { timestamp: ago(10), message: "BLOCKED: Port change scanner requires port scan baseline from t-002", type: "error" },
    ],
  },
  {
    id: "t-006",
    title: "Generate phishing campaign templates",
    description: "Create social engineering templates based on OSINT data. Prepare email templates, landing page clones, and payload delivery mechanisms for authorized test.",
    status: "QUEUED",
    priority: "low",
    agentId: "builder",
    model: "gpt-4o",
    tokensUsed: 0,
    tokenBudget: 35_000,
    timeElapsedMin: 0,
    timeEstimateMin: 40,
    subSteps: [
      { id: "s1", label: "Analyze OSINT for pretexts", done: false },
      { id: "s2", label: "Draft email templates (3 variants)", done: false },
      { id: "s3", label: "Clone target login page", done: false },
      { id: "s4", label: "Set up payload delivery", done: false },
      { id: "s5", label: "QA and authorization review", done: false },
    ],
    dependencies: ["t-004"],
    createdAt: ago(15),
    logs: [],
  },
  {
    id: "t-007",
    title: "Wireless network reconnaissance",
    description: "Survey wireless networks in target vicinity. Identify SSIDs, encryption types, hidden networks, and potential rogue APs. Requires physical proximity.",
    status: "QUEUED",
    priority: "medium",
    agentId: "security",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 0,
    tokenBudget: 20_000,
    timeElapsedMin: 0,
    timeEstimateMin: 30,
    subSteps: [
      { id: "s1", label: "Configure wireless adapter (monitor mode)", done: false },
      { id: "s2", label: "Run airodump-ng scan", done: false },
      { id: "s3", label: "Identify target networks", done: false },
      { id: "s4", label: "Check for WPS vulnerabilities", done: false },
      { id: "s5", label: "Document findings", done: false },
    ],
    dependencies: [],
    createdAt: ago(12),
    logs: [],
  },
  {
    id: "t-008",
    title: "Web application fuzzing",
    description: "Fuzz discovered web endpoints for hidden paths, parameters, and potential injection points. Use ffuf and custom wordlists.",
    status: "IN_PROGRESS",
    priority: "high",
    agentId: "builder",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 24_100,
    tokenBudget: 55_000,
    timeElapsedMin: 15,
    timeEstimateMin: 40,
    subSteps: [
      { id: "s1", label: "Enumerate web endpoints from nmap", done: true },
      { id: "s2", label: "Directory brute-force with ffuf", done: true },
      { id: "s3", label: "Parameter discovery", done: false },
      { id: "s4", label: "SQL injection point testing", done: false },
      { id: "s5", label: "XSS vector testing", done: false },
      { id: "s6", label: "API endpoint enumeration", done: false },
      { id: "s7", label: "Compile fuzzing report", done: false },
    ],
    dependencies: ["t-002"],
    createdAt: ago(25),
    logs: [
      { timestamp: ago(24), message: "Loading web endpoints from port scan results", type: "info" },
      { timestamp: ago(20), message: "tool_call: ffuf -w common.txt -u FUZZ -mc 200,301,302,403", type: "tool" },
      { timestamp: ago(14), message: "Found 23 hidden paths including /admin, /api/v2, /debug", type: "info" },
      { timestamp: ago(10), message: "Starting parameter discovery on key endpoints...", type: "thinking" },
    ],
  },
  {
    id: "t-009",
    title: "Credential stuffing preparation",
    description: "Compile credential lists from breach data and OSINT. Test against discovered login endpoints. Enforce rate limiting to avoid lockouts.",
    status: "BLOCKED",
    priority: "high",
    agentId: "scraper",
    model: "gpt-4o",
    tokensUsed: 5_300,
    tokenBudget: 25_000,
    timeElapsedMin: 5,
    timeEstimateMin: 20,
    subSteps: [
      { id: "s1", label: "Extract credentials from breach data", done: true },
      { id: "s2", label: "Generate password variations", done: false },
      { id: "s3", label: "Map login endpoints", done: false },
      { id: "s4", label: "Configure rate-limited testing", done: false },
      { id: "s5", label: "Run credential test", done: false },
    ],
    dependencies: ["t-004", "t-008"],
    createdAt: ago(18),
    logs: [
      { timestamp: ago(17), message: "Extracted 312 potential credentials from breach data", type: "info" },
      { timestamp: ago(12), message: "BLOCKED: Waiting for web app fuzzing to complete login endpoint mapping", type: "error" },
    ],
  },
  {
    id: "t-010",
    title: "Compile executive summary report",
    description: "Aggregate all findings into an executive-ready penetration test report. Include risk ratings, remediation recommendations, and evidence screenshots.",
    status: "QUEUED",
    priority: "low",
    agentId: "coco",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 0,
    tokenBudget: 80_000,
    timeElapsedMin: 0,
    timeEstimateMin: 60,
    subSteps: [
      { id: "s1", label: "Collect all task findings", done: false },
      { id: "s2", label: "Categorize by risk level", done: false },
      { id: "s3", label: "Write executive summary", done: false },
      { id: "s4", label: "Draft remediation roadmap", done: false },
      { id: "s5", label: "Attach evidence & screenshots", done: false },
      { id: "s6", label: "Final review & formatting", done: false },
    ],
    dependencies: ["t-003", "t-006", "t-009"],
    createdAt: ago(10),
    logs: [],
  },
  {
    id: "t-011",
    title: "Network traffic analysis",
    description: "Capture and analyze network traffic for the target environment. Identify protocols, unencrypted data, and potential MitM opportunities.",
    status: "COMPLETED",
    priority: "medium",
    agentId: "monitor",
    model: "claude-sonnet-4-20250514",
    tokensUsed: 19_500,
    tokenBudget: 25_000,
    timeElapsedMin: 16,
    timeEstimateMin: 20,
    subSteps: [
      { id: "s1", label: "Configure packet capture", done: true },
      { id: "s2", label: "Capture 15-min sample", done: true },
      { id: "s3", label: "Protocol analysis", done: true },
      { id: "s4", label: "Identify unencrypted data", done: true },
      { id: "s5", label: "Write traffic analysis report", done: true },
    ],
    dependencies: [],
    createdAt: ago(45),
    logs: [
      { timestamp: ago(44), message: "Starting packet capture on eth0", type: "info" },
      { timestamp: ago(40), message: "tool_call: tcpdump -i eth0 -w capture.pcap -c 100000", type: "tool" },
      { timestamp: ago(30), message: "Captured 87,432 packets. Running analysis...", type: "thinking" },
      { timestamp: ago(28), message: "Found 3 services transmitting credentials in cleartext", type: "info" },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────
   HELPER FUNCTIONS
   ────────────────────────────────────────────────────────────── */
function formatTime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTimestamp(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function estimateCost(tokens: number): string {
  // Rough estimate: ~$3 per 1M tokens average
  return `$${((tokens / 1_000_000) * 3).toFixed(2)}`;
}

/* ──────────────────────────────────────────────────────────────
   TASK PLANNER COMPONENT
   ────────────────────────────────────────────────────────────── */
export default function TaskPlanner() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  /* ─── New task form state ──────────────────────────────────── */
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newAgent, setNewAgent] = useState("coco");
  const [newDeps, setNewDeps] = useState("");

  /* ─── Computed statistics ──────────────────────────────────── */
  const stats = useMemo(() => {
    const total = MOCK_TASKS.length;
    const inProgress = MOCK_TASKS.filter(t => t.status === "IN_PROGRESS").length;
    const completed = MOCK_TASKS.filter(t => t.status === "COMPLETED").length;
    const totalTokens = MOCK_TASKS.reduce((s, t) => s + t.tokensUsed, 0);
    const totalCost = (totalTokens / 1_000_000) * 3;
    const blocked = MOCK_TASKS.filter(t => t.status === "BLOCKED").length;
    return { total, inProgress, completed, blocked, totalTokens, totalCost };
  }, []);

  /* ─── Filtered tasks ───────────────────────────────────────── */
  const filteredTasks = useMemo(() => {
    return MOCK_TASKS.filter(task => {
      if (filterAgent !== "all" && task.agentId !== filterAgent) return false;
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (filterStatus !== "all" && task.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          task.title.toLowerCase().includes(q) ||
          task.description.toLowerCase().includes(q) ||
          task.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filterAgent, filterPriority, filterStatus, searchQuery]);

  /* ─── Group tasks by status for columns ────────────────────── */
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      QUEUED: [], IN_PROGRESS: [], BLOCKED: [], COMPLETED: [],
    };
    filteredTasks.forEach(t => grouped[t.status].push(t));
    return grouped;
  }, [filteredTasks]);

  /* MOCK DATA: Real task creation sends a chat.send message to
     the Gateway with the task description, and Coco creates
     the task_plan.md */
  const handleCreateTask = useCallback(() => {
    // In real deployment, this would send a chat.send message to the Gateway
    setShowNewTask(false);
    setNewTitle("");
    setNewDesc("");
    setNewPriority("medium");
    setNewAgent("coco");
    setNewDeps("");
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col h-full overflow-hidden font-mono" style={{ background: "#050508" }}>

        {/* ─── STATISTICS BAR ─────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-4 py-2 flex items-center gap-4 flex-wrap"
          style={{ borderBottom: "1px solid rgba(0,255,156,0.1)", background: "rgba(0,255,156,0.02)" }}
        >
          {/* Page title */}
          <div className="flex items-center gap-2 mr-4">
            <ListTodo size={14} style={{ color: "#00FF9C" }} />
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: "#00FF9C", textShadow: "0 0 8px rgba(0,255,156,0.3)" }}
              data-testid="text-page-title"
            >
              TASK PLANNER
            </span>
          </div>

          {/* Stats chips */}
          <StatChip
            label="TOTAL"
            value={String(stats.total)}
            color="#00FF9C"
            testId="stat-total-tasks"
          />
          <StatChip
            label="ACTIVE"
            value={String(stats.inProgress)}
            color="#00B4FF"
            testId="stat-active-tasks"
          />
          <StatChip
            label="BLOCKED"
            value={String(stats.blocked)}
            color="#FF2D78"
            testId="stat-blocked-tasks"
          />
          <StatChip
            label="DONE TODAY"
            value={String(stats.completed)}
            color="#00FF9C"
            testId="stat-completed-tasks"
          />
          <StatChip
            label="TOKENS"
            value={formatTokens(stats.totalTokens)}
            color="#a78bfa"
            icon={<Zap size={9} />}
            testId="stat-total-tokens"
          />
          <StatChip
            label="EST. COST"
            value={`$${stats.totalCost.toFixed(2)}`}
            color="#FF9C00"
            icon={<DollarSign size={9} />}
            testId="stat-estimated-cost"
          />

          {/* Spacer */}
          <div className="flex-1" />

          {/* New Task button */}
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider px-3 py-1.5 transition-all"
            style={{
              color: "#00FF9C",
              border: "1px solid rgba(0,255,156,0.3)",
              background: "rgba(0,255,156,0.05)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,156,0.3)";
              e.currentTarget.style.background = "rgba(0,255,156,0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.background = "rgba(0,255,156,0.05)";
            }}
            data-testid="button-new-task"
          >
            <Plus size={12} /> NEW TASK
          </button>
        </div>

        {/* ─── FILTER BAR ─────────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-4 py-1.5 flex items-center gap-3 flex-wrap"
          style={{ borderBottom: "1px solid rgba(0,255,156,0.06)" }}
        >
          <Filter size={11} style={{ color: "rgba(0,255,156,0.3)" }} />
          <span className="text-[9px] tracking-widest" style={{ color: "rgba(0,255,156,0.3)" }}>
            FILTERS
          </span>

          {/* Search */}
          <div className="flex items-center gap-1 px-2 py-0.5" style={{ border: "1px solid rgba(0,255,156,0.1)" }}>
            <Search size={10} style={{ color: "rgba(0,255,156,0.3)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent text-[10px] outline-none w-28"
              style={{ color: "#00FF9C", caretColor: "#00FF9C" }}
              data-testid="input-search-tasks"
            />
          </div>

          {/* Agent filter */}
          <FilterSelect
            value={filterAgent}
            onChange={setFilterAgent}
            options={[
              { value: "all", label: "All Agents" },
              ...Object.entries(AGENTS).map(([k, a]) => ({ value: k, label: `${a.emoji} ${a.name}` })),
            ]}
            testId="select-filter-agent"
          />

          {/* Priority filter */}
          <FilterSelect
            value={filterPriority}
            onChange={setFilterPriority}
            options={[
              { value: "all", label: "All Priorities" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
            testId="select-filter-priority"
          />

          {/* Status filter */}
          <FilterSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "QUEUED", label: "Queued" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "BLOCKED", label: "Blocked" },
              { value: "COMPLETED", label: "Completed" },
            ]}
            testId="select-filter-status"
          />

          {(filterAgent !== "all" || filterPriority !== "all" || filterStatus !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setFilterAgent("all");
                setFilterPriority("all");
                setFilterStatus("all");
                setSearchQuery("");
              }}
              className="text-[9px] tracking-wider px-2 py-0.5"
              style={{ color: "rgba(255,45,120,0.5)", border: "1px solid rgba(255,45,120,0.15)" }}
              data-testid="button-clear-filters"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* ─── KANBAN BOARD ───────────────────────────────────── */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
          <div className="flex gap-3 h-full min-w-max">
            {STATUS_COLUMNS.map(col => {
              const tasks = tasksByStatus[col.key];
              const ColIcon = col.icon;
              return (
                <div
                  key={col.key}
                  className="flex flex-col w-[300px] flex-shrink-0 h-full"
                  style={{
                    border: "1px solid rgba(0,255,156,0.08)",
                    background: "rgba(0,255,156,0.01)",
                  }}
                  data-testid={`column-${col.key.toLowerCase().replace("_", "-")}`}
                >
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                    style={{ borderBottom: `1px solid ${col.color}20` }}
                  >
                    <div className="flex items-center gap-2">
                      <ColIcon size={12} style={{ color: col.color }} />
                      <span
                        className="text-[10px] font-bold tracking-widest"
                        style={{ color: col.color }}
                      >
                        {col.label}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5"
                      style={{
                        color: col.color,
                        background: `${col.color}15`,
                        border: `1px solid ${col.color}30`,
                      }}
                    >
                      {tasks.length}
                    </span>
                  </div>

                  {/* Task cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {tasks.length === 0 && (
                      <div
                        className="text-[10px] text-center py-6 italic"
                        style={{ color: "rgba(0,255,156,0.15)" }}
                      >
                        No tasks
                      </div>
                    )}
                    {tasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => setSelectedTask(task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── TASK DETAIL PANEL (slide-in) ──────────────────── */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
          />
        )}

        {/* ─── NEW TASK MODAL ────────────────────────────────── */}
        {showNewTask && (
          <NewTaskModal
            title={newTitle}
            setTitle={setNewTitle}
            desc={newDesc}
            setDesc={setNewDesc}
            priority={newPriority}
            setPriority={setNewPriority}
            agent={newAgent}
            setAgent={setNewAgent}
            deps={newDeps}
            setDeps={setNewDeps}
            onClose={() => setShowNewTask(false)}
            onCreate={handleCreateTask}
          />
        )}
      </div>

      {/* Inline styles for custom scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,255,156,0.15); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,255,156,0.3); }
      `}</style>
    </AppShell>
  );
}


/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ─── Statistics chip ────────────────────────────────────────── */
function StatChip({ label, value, color, icon, testId }: {
  label: string;
  value: string;
  color: string;
  icon?: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5"
      style={{ border: `1px solid ${color}20`, background: `${color}08` }}
      data-testid={testId}
    >
      {icon && <span style={{ color }}>{icon}</span>}
      <span className="text-[8px] tracking-widest" style={{ color: `${color}80` }}>
        {label}
      </span>
      <span className="text-[11px] font-bold" style={{ color, textShadow: `0 0 6px ${color}40` }}>
        {value}
      </span>
    </div>
  );
}


/* ─── Filter dropdown ────────────────────────────────────────── */
function FilterSelect({ value, onChange, options, testId }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testId: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-transparent text-[10px] font-mono outline-none cursor-pointer px-2 py-0.5"
      style={{
        color: "#00FF9C",
        border: "1px solid rgba(0,255,156,0.15)",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%2300FF9C' stroke-opacity='0.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 6px center",
        paddingRight: "18px",
      }}
      data-testid={testId}
    >
      {options.map(opt => (
        <option
          key={opt.value}
          value={opt.value}
          style={{ background: "#0a0a0f", color: "#00FF9C" }}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}


/* ─── Task card ──────────────────────────────────────────────── */
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const agent = AGENTS[task.agentId] || AGENTS.coco;
  const prio = PRIORITY_CONFIG[task.priority];
  const doneSteps = task.subSteps.filter(s => s.done).length;
  const totalSteps = task.subSteps.length;
  const progressPct = totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 transition-all group"
      style={{
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(0,255,156,0.08)",
        borderRadius: "1px",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.border = "1px solid rgba(0,255,156,0.2)";
        e.currentTarget.style.background = "rgba(0,255,156,0.03)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = "1px solid rgba(0,255,156,0.08)";
        e.currentTarget.style.background = "rgba(0,0,0,0.4)";
      }}
      data-testid={`card-task-${task.id}`}
    >
      {/* Top row: ID + Priority */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] tracking-wider" style={{ color: "rgba(0,255,156,0.3)" }}>
          {task.id.toUpperCase()}
        </span>
        <span
          className="text-[8px] font-bold tracking-wider px-1.5 py-0.5"
          style={{ color: prio.color, background: prio.bg, border: `1px solid ${prio.color}30` }}
          data-testid={`badge-priority-${task.id}`}
        >
          {prio.label}
        </span>
      </div>

      {/* Title */}
      <div
        className="text-[11px] font-bold leading-tight mb-1.5"
        style={{ color: "rgba(0,255,156,0.85)" }}
        data-testid={`text-task-title-${task.id}`}
      >
        {task.title}
      </div>

      {/* Description snippet */}
      <div
        className="text-[9px] leading-relaxed mb-2 line-clamp-2"
        style={{ color: "rgba(0,255,156,0.35)" }}
      >
        {task.description}
      </div>

      {/* Agent + Model row */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[9px] flex items-center gap-1 px-1.5 py-0.5"
          style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}25` }}
        >
          <span>{agent.emoji}</span>
          <span style={{ color: agent.color, fontSize: "8px", fontWeight: 600 }}>{agent.name}</span>
        </span>
        <span className="text-[8px] flex items-center gap-0.5" style={{ color: "rgba(0,180,255,0.5)" }}>
          <Cpu size={8} />
          {task.model.split("-").slice(0, 2).join("-")}
        </span>
      </div>

      {/* Sub-step progress bar */}
      <div className="mb-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[8px] tracking-wider" style={{ color: "rgba(0,255,156,0.3)" }}>
            STEPS
          </span>
          <span className="text-[9px] font-bold" style={{ color: "rgba(0,255,156,0.6)" }}>
            {doneSteps}/{totalSteps}
          </span>
        </div>
        <div style={{ height: 2, background: "rgba(0,255,156,0.08)", borderRadius: "1px" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: task.status === "COMPLETED" ? "#00FF9C" :
                          task.status === "BLOCKED" ? "#FF2D78" : "#00B4FF",
              borderRadius: "1px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Bottom row: tokens + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 text-[8px]" style={{ color: "rgba(167,139,250,0.5)" }}>
          <Zap size={8} />
          <span>{formatTokens(task.tokensUsed)}</span>
          <span style={{ color: "rgba(167,139,250,0.25)" }}>/ {formatTokens(task.tokenBudget)}</span>
        </div>
        <div className="flex items-center gap-0.5 text-[8px]" style={{ color: "rgba(0,180,255,0.4)" }}>
          <Timer size={8} />
          <span>{formatTime(task.timeElapsedMin)}</span>
          <span style={{ color: "rgba(0,180,255,0.2)" }}>/ {formatTime(task.timeEstimateMin)}</span>
        </div>
      </div>

      {/* Created timestamp */}
      <div className="mt-1.5 flex items-center gap-1 text-[7px]" style={{ color: "rgba(0,255,156,0.15)" }}>
        <Clock size={7} />
        Created {formatTimestamp(task.createdAt)}
      </div>
    </button>
  );
}


/* ─── Task Detail Panel ──────────────────────────────────────── */
function TaskDetailPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  const agent = AGENTS[task.agentId] || AGENTS.coco;
  const prio = PRIORITY_CONFIG[task.priority];
  const doneSteps = task.subSteps.filter(s => s.done).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
      data-testid="overlay-task-detail"
    >
      <div
        className="w-full max-w-lg h-full overflow-y-auto custom-scrollbar"
        style={{
          background: "#0a0a0f",
          borderLeft: "1px solid rgba(0,255,156,0.15)",
          animation: "slideInRight 0.2s ease-out",
        }}
        onClick={e => e.stopPropagation()}
        data-testid="panel-task-detail"
      >
        {/* Panel header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
          style={{
            background: "#0a0a0f",
            borderBottom: "1px solid rgba(0,255,156,0.1)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-widest" style={{ color: "rgba(0,255,156,0.3)" }}>
              //
            </span>
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: "#00FF9C", textShadow: "0 0 6px rgba(0,255,156,0.4)" }}
            >
              TASK DETAIL
            </span>
            <span className="text-[9px] tracking-wider" style={{ color: "rgba(0,255,156,0.25)" }}>
              {task.id.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 transition-colors"
            style={{ color: "rgba(255,45,120,0.5)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#FF2D78")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,45,120,0.5)")}
            data-testid="button-close-detail"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Title & Priority ── */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2
                className="text-sm font-bold leading-tight"
                style={{ color: "rgba(0,255,156,0.9)" }}
                data-testid="text-detail-title"
              >
                {task.title}
              </h2>
              <span
                className="text-[9px] font-bold tracking-wider px-2 py-0.5 flex-shrink-0"
                style={{ color: prio.color, background: prio.bg, border: `1px solid ${prio.color}30` }}
              >
                {prio.label}
              </span>
            </div>
            <p
              className="text-[10px] leading-relaxed"
              style={{ color: "rgba(0,255,156,0.45)" }}
              data-testid="text-detail-description"
            >
              {task.description}
            </p>
          </div>

          {/* ── Meta info grid ── */}
          <div
            className="grid grid-cols-2 gap-2 p-3"
            style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.3)" }}
          >
            <MetaItem label="AGENT" value={`${agent.emoji} ${agent.name}`} color={agent.color} testId="detail-agent" />
            <MetaItem label="MODEL" value={task.model} color="#00B4FF" testId="detail-model" />
            <MetaItem label="STATUS" value={task.status.replace("_", " ")} color={
              task.status === "COMPLETED" ? "#00FF9C" :
              task.status === "BLOCKED" ? "#FF2D78" :
              task.status === "IN_PROGRESS" ? "#00B4FF" : "rgba(0,255,156,0.4)"
            } testId="detail-status" />
            <MetaItem label="CREATED" value={formatTimestamp(task.createdAt)} color="rgba(0,255,156,0.5)" testId="detail-created" />
            <MetaItem label="TOKENS" value={`${formatTokens(task.tokensUsed)} / ${formatTokens(task.tokenBudget)}`} color="#a78bfa" testId="detail-tokens" />
            <MetaItem label="TIME" value={`${formatTime(task.timeElapsedMin)} / ${formatTime(task.timeEstimateMin)}`} color="#00B4FF" testId="detail-time" />
            <MetaItem label="EST. COST" value={estimateCost(task.tokensUsed)} color="#FF9C00" testId="detail-cost" />
            <MetaItem label="PROGRESS" value={`${doneSteps}/${task.subSteps.length} steps`} color="#00FF9C" testId="detail-progress" />
          </div>

          {/* ── Dependencies ── */}
          {task.dependencies.length > 0 && (
            <div>
              <SectionHeader label="DEPENDENCIES" icon={<Layers size={10} />} />
              <div className="flex flex-wrap gap-1 mt-1">
                {task.dependencies.map(dep => {
                  const depTask = MOCK_TASKS.find(t => t.id === dep);
                  return (
                    <span
                      key={dep}
                      className="text-[9px] px-2 py-0.5 flex items-center gap-1"
                      style={{
                        border: "1px solid rgba(0,180,255,0.15)",
                        color: depTask?.status === "COMPLETED" ? "#00FF9C" : "#00B4FF",
                        background: depTask?.status === "COMPLETED" ? "rgba(0,255,156,0.05)" : "rgba(0,180,255,0.05)",
                      }}
                      data-testid={`dep-${dep}`}
                    >
                      {depTask?.status === "COMPLETED" ? <CheckCircle2 size={8} /> : <Clock size={8} />}
                      {dep.toUpperCase()}
                      {depTask && (
                        <span style={{ color: "rgba(0,255,156,0.3)", fontSize: "7px" }}>
                          ({depTask.title.slice(0, 20)}...)
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Sub-steps ── */}
          <div>
            <SectionHeader
              label={`SUB-STEPS (${doneSteps}/${task.subSteps.length})`}
              icon={<CheckCircle2 size={10} />}
            />
            <div className="space-y-1 mt-1">
              {task.subSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 px-2 py-1"
                  style={{
                    background: step.done ? "rgba(0,255,156,0.03)" : "transparent",
                    borderLeft: `2px solid ${step.done ? "#00FF9C" : "rgba(0,255,156,0.1)"}`,
                  }}
                  data-testid={`substep-${task.id}-${step.id}`}
                >
                  {step.done ? (
                    <CheckCircle2 size={10} style={{ color: "#00FF9C", flexShrink: 0 }} />
                  ) : (
                    <Circle size={10} style={{ color: "rgba(0,255,156,0.15)", flexShrink: 0 }} />
                  )}
                  <span
                    className="text-[10px]"
                    style={{
                      color: step.done ? "rgba(0,255,156,0.6)" : "rgba(0,255,156,0.3)",
                      textDecoration: step.done ? "line-through" : "none",
                      textDecorationColor: "rgba(0,255,156,0.2)",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Token consumption bar ── */}
          <div>
            <SectionHeader label="TOKEN CONSUMPTION" icon={<Zap size={10} />} />
            <div className="mt-1 p-2" style={{ border: "1px solid rgba(167,139,250,0.1)", background: "rgba(167,139,250,0.03)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px]" style={{ color: "rgba(167,139,250,0.5)" }}>
                  {formatTokens(task.tokensUsed)} tokens used
                </span>
                <span className="text-[9px]" style={{ color: "rgba(167,139,250,0.3)" }}>
                  {formatTokens(task.tokenBudget)} budget
                </span>
              </div>
              <div style={{ height: 4, background: "rgba(167,139,250,0.1)", borderRadius: "1px" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min((task.tokensUsed / task.tokenBudget) * 100, 100)}%`,
                    background: (task.tokensUsed / task.tokenBudget) > 0.9 ? "#FF2D78" :
                                (task.tokensUsed / task.tokenBudget) > 0.7 ? "#FF9C00" : "#a78bfa",
                    borderRadius: "1px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[8px]" style={{ color: "rgba(255,156,0,0.4)" }}>
                  Est. cost: {estimateCost(task.tokensUsed)}
                </span>
                <span className="text-[8px]" style={{ color: "rgba(167,139,250,0.3)" }}>
                  {((task.tokensUsed / task.tokenBudget) * 100).toFixed(0)}% of budget
                </span>
              </div>
            </div>
          </div>

          {/* ── Agent logs ── */}
          <div>
            <SectionHeader label="AGENT LOGS" icon={<FileText size={10} />} />
            {task.logs.length === 0 ? (
              <div
                className="text-[10px] py-4 text-center italic"
                style={{ color: "rgba(0,255,156,0.15)" }}
              >
                No logs yet — task is queued
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                {task.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 px-2 py-1"
                    style={{
                      background: log.type === "error" ? "rgba(255,45,120,0.03)" : "transparent",
                      borderLeft: `2px solid ${
                        log.type === "error" ? "#FF2D78" :
                        log.type === "tool" ? "#00B4FF" :
                        log.type === "thinking" ? "#a78bfa" :
                        "rgba(0,255,156,0.2)"
                      }`,
                    }}
                    data-testid={`log-entry-${task.id}-${idx}`}
                  >
                    <span className="text-[7px] flex-shrink-0 mt-0.5" style={{ color: "rgba(0,255,156,0.2)" }}>
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span
                      className="text-[9px] leading-relaxed"
                      style={{
                        color:
                          log.type === "error" ? "rgba(255,45,120,0.7)" :
                          log.type === "tool" ? "rgba(0,180,255,0.6)" :
                          log.type === "thinking" ? "rgba(167,139,250,0.5)" :
                          "rgba(0,255,156,0.5)",
                        fontFamily: log.type === "tool" ? "monospace" : undefined,
                      }}
                    >
                      {log.type === "tool" && <span style={{ color: "#00B4FF", marginRight: 4 }}>$</span>}
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}


/* ─── Meta info item ─────────────────────────────────────────── */
function MetaItem({ label, value, color, testId }: {
  label: string;
  value: string;
  color: string;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <span className="text-[7px] tracking-widest block" style={{ color: "rgba(0,255,156,0.25)" }}>
        {label}
      </span>
      <span className="text-[10px] font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}


/* ─── Section header ─────────────────────────────────────────── */
function SectionHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid rgba(0,255,156,0.06)" }}>
      <span style={{ color: "#00FF9C" }}>{icon}</span>
      <span className="text-[9px] font-bold tracking-widest" style={{ color: "rgba(0,255,156,0.5)" }}>
        {label}
      </span>
    </div>
  );
}


/* ─── New Task Modal ─────────────────────────────────────────── */
/* MOCK DATA: Real task creation sends a chat.send message to the
   Gateway with the task description, and Coco creates the
   task_plan.md */
function NewTaskModal({
  title, setTitle, desc, setDesc, priority, setPriority,
  agent, setAgent, deps, setDeps, onClose, onCreate,
}: {
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  priority: TaskPriority;
  setPriority: (v: TaskPriority) => void;
  agent: string;
  setAgent: (v: string) => void;
  deps: string;
  setDeps: (v: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      data-testid="overlay-new-task"
    >
      <div
        className="w-full max-w-md p-5"
        style={{
          background: "#0a0a0f",
          border: "1px solid rgba(0,255,156,0.2)",
          boxShadow: "0 0 30px rgba(0,255,156,0.08), 0 0 60px rgba(0,0,0,0.5)",
        }}
        onClick={e => e.stopPropagation()}
        data-testid="modal-new-task"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-widest" style={{ color: "rgba(0,255,156,0.4)" }}>
              //
            </span>
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: "#00FF9C", textShadow: "0 0 6px rgba(0,255,156,0.4)" }}
            >
              NEW TASK
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 transition-colors"
            style={{ color: "rgba(255,45,120,0.5)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#FF2D78")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,45,120,0.5)")}
            data-testid="button-close-new-task"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>
              TASK TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Scan target web application"
              className="w-full bg-transparent text-[11px] font-mono outline-none px-2 py-1.5"
              style={{
                color: "#00FF9C",
                border: "1px solid rgba(0,255,156,0.15)",
                caretColor: "#00FF9C",
              }}
              data-testid="input-new-task-title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>
              DESCRIPTION
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe the objective, constraints, and expected outputs..."
              rows={4}
              className="w-full bg-transparent text-[11px] font-mono outline-none px-2 py-1.5 resize-none"
              style={{
                color: "rgba(0,255,156,0.7)",
                border: "1px solid rgba(0,255,156,0.1)",
                caretColor: "#00FF9C",
              }}
              data-testid="input-new-task-description"
            />
          </div>

          {/* Priority + Agent row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>
                PRIORITY
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-transparent text-[11px] font-mono outline-none px-2 py-1.5 cursor-pointer"
                style={{
                  color: PRIORITY_CONFIG[priority].color,
                  border: `1px solid ${PRIORITY_CONFIG[priority].color}30`,
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%2300FF9C' stroke-opacity='0.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
                data-testid="select-new-task-priority"
              >
                <option value="critical" style={{ background: "#0a0a0f", color: "#FF2D78" }}>Critical</option>
                <option value="high" style={{ background: "#0a0a0f", color: "#FF9C00" }}>High</option>
                <option value="medium" style={{ background: "#0a0a0f", color: "#00B4FF" }}>Medium</option>
                <option value="low" style={{ background: "#0a0a0f", color: "#00FF9C" }}>Low</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>
                ASSIGNED AGENT
              </label>
              <select
                value={agent}
                onChange={e => setAgent(e.target.value)}
                className="w-full bg-transparent text-[11px] font-mono outline-none px-2 py-1.5 cursor-pointer"
                style={{
                  color: AGENTS[agent]?.color || "#00FF9C",
                  border: `1px solid ${AGENTS[agent]?.color || "#00FF9C"}30`,
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%2300FF9C' stroke-opacity='0.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
                data-testid="select-new-task-agent"
              >
                {Object.entries(AGENTS).map(([id, a]) => (
                  <option key={id} value={id} style={{ background: "#0a0a0f", color: a.color }}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>
              DEPENDENCIES (comma-separated task IDs)
            </label>
            <input
              type="text"
              value={deps}
              onChange={e => setDeps(e.target.value)}
              placeholder="e.g. t-001, t-002"
              className="w-full bg-transparent text-[11px] font-mono outline-none px-2 py-1.5"
              style={{
                color: "#00B4FF",
                border: "1px solid rgba(0,180,255,0.15)",
                caretColor: "#00B4FF",
              }}
              data-testid="input-new-task-dependencies"
            />
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-2 mt-4 pt-3"
          style={{ borderTop: "1px solid rgba(0,255,156,0.08)" }}
        >
          <button
            onClick={onClose}
            className="text-[10px] tracking-wider px-3 py-1.5"
            style={{
              border: "1px solid rgba(255,45,120,0.2)",
              color: "rgba(255,45,120,0.5)",
            }}
            data-testid="button-cancel-new-task"
          >
            CANCEL
          </button>
          <button
            onClick={onCreate}
            className="text-[10px] tracking-wider px-4 py-1.5 font-bold transition-all"
            style={{
              border: "1px solid rgba(0,255,156,0.4)",
              color: "#00FF9C",
              background: "rgba(0,255,156,0.05)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,156,0.3)";
              e.currentTarget.style.background = "rgba(0,255,156,0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.background = "rgba(0,255,156,0.05)";
            }}
            data-testid="button-submit-new-task"
          >
            CREATE TASK
          </button>
        </div>
      </div>
    </div>
  );
}
