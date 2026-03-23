import { useState, useMemo, useCallback, useEffect } from "react";
import AppShell from "@/components/AppShell";
import {
  Search,
  Bot,
  Cpu,
  Brain,
  Plus,
  X,
  ChevronRight,
  Package,
  Download,
  Clock,
  HardDrive,
  Terminal,
  Code,
  Globe,
  Radio,
  Eye,
  Lock,
  Workflow,
  FileCode,
  ArrowLeft,
  FolderOpen,
} from "lucide-react";
import { fetchAgents, type Agent } from "@/lib/gateway";

type AgentStatus = "active" | "idle" | "error";

interface AgentDetail extends Agent {
  description: string;
  installedSkills: string[];
  activeSessions: { id: string; task: string; started: string }[];
  memoryFiles: { name: string; sizeMB: number; modified: string }[];
}

const DEFAULT_AGENTS: AgentDetail[] = [
  {
    id: "main",
    name: "B1GHER0",
    emoji: "🤖",
    model: "minimax/MiniMax-M2.5",
    status: "active",
    role: "Primary Orchestrator",
    description: "Main agent. Orchestrates all sub-agents.",
    skillsCount: 0,
    sessionsCount: 0,
    memoryUsageMB: 0,
    memoryCapMB: 2048,
    installedSkills: [],
    activeSessions: [],
    memoryFiles: [],
    uptime: "0d 0h 0m",
  },
];

/* ══════════════════════════════════════════════════════════════════════
   MOCK DATA — SKILLS
   ──────────────────────────────────────────────────────────────────────
   In production, installed skills are read from:
   1. Local workspace: skills/ directory (workspace skills)
   2. Managed skills: `openclaw skills list` CLI command
   3. Bundled skills: shipped with the OpenClaw installation
   
   Skills installed via ClawHub use the command:
     npx clawhub@latest install <skill-name>
   This installs to ~/.openclaw/skills/
   
   ClawHub is the package registry for OpenClaw skills — similar to npm
   for Node packages. Skills can be searched via:
     npx clawhub@latest search <query>
   ══════════════════════════════════════════════════════════════════════ */

type SkillCategory =
  | "security"
  | "automation"
  | "coding"
  | "research"
  | "communication"
  | "monitoring";

type SkillSource = "clawhub" | "workspace" | "bundled";

interface Skill {
  id: string;
  name: string;
  version: string;
  source: SkillSource;
  category: SkillCategory;
  description: string;
  installedDate: string;
  author: string;
  usedByAgents: string[];
}

/* MOCK DATA: Replace with data from `openclaw skills list` CLI command
   and skills/ directory scan. Bundled skills come pre-installed. */
const SKILLS: Skill[] = [
  {
    id: "sk-001",
    name: "core-orchestration",
    version: "2.4.1",
    source: "bundled",
    category: "automation",
    description: "Central task routing, agent coordination, and workflow management engine.",
    installedDate: "2026-03-09",
    author: "openclaw-team",
    usedByAgents: ["Coco"],
  },
  {
    id: "sk-002",
    name: "memory-management",
    version: "1.8.0",
    source: "bundled",
    category: "automation",
    description: "Long-term memory persistence, context window optimization, and memory compaction.",
    installedDate: "2026-03-09",
    author: "openclaw-team",
    usedByAgents: ["Coco"],
  },
  {
    id: "sk-003",
    name: "web-research",
    version: "3.1.2",
    source: "clawhub",
    category: "research",
    description: "Deep web search, content extraction, source verification, and citation generation.",
    installedDate: "2026-03-10",
    author: "claw-community",
    usedByAgents: ["Coco", "Researcher"],
  },
  {
    id: "sk-004",
    name: "firewall-management",
    version: "2.0.4",
    source: "clawhub",
    category: "security",
    description: "UFW/iptables rule management, port monitoring, and traffic analysis automation.",
    installedDate: "2026-03-11",
    author: "secops-labs",
    usedByAgents: ["SecOps"],
  },
  {
    id: "sk-005",
    name: "code-generation",
    version: "4.2.0",
    source: "clawhub",
    category: "coding",
    description: "Multi-language code generation with AST-aware context and test scaffolding.",
    installedDate: "2026-03-10",
    author: "claw-community",
    usedByAgents: ["Builder"],
  },
  {
    id: "sk-006",
    name: "vuln-scanner",
    version: "1.5.3",
    source: "clawhub",
    category: "security",
    description: "Automated vulnerability scanning using Nmap, OpenVAS, and custom heuristics.",
    installedDate: "2026-03-12",
    author: "secops-labs",
    usedByAgents: ["SecOps"],
  },
  {
    id: "sk-007",
    name: "osint-collector",
    version: "2.3.1",
    source: "clawhub",
    category: "research",
    description: "Open-source intelligence gathering from social media, forums, paste sites, and dark web.",
    installedDate: "2026-03-11",
    author: "recon-forge",
    usedByAgents: ["Researcher"],
  },
  {
    id: "sk-008",
    name: "shell-exec",
    version: "1.2.0",
    source: "bundled",
    category: "automation",
    description: "Sandboxed shell command execution with output capture and timeout management.",
    installedDate: "2026-03-09",
    author: "openclaw-team",
    usedByAgents: ["Coco", "Builder"],
  },
  {
    id: "sk-009",
    name: "git-ops",
    version: "2.1.0",
    source: "bundled",
    category: "coding",
    description: "Git repository management — clone, commit, branch, merge, PR creation automation.",
    installedDate: "2026-03-09",
    author: "openclaw-team",
    usedByAgents: ["Coco", "Builder"],
  },
  {
    id: "sk-010",
    name: "system-metrics",
    version: "1.4.2",
    source: "clawhub",
    category: "monitoring",
    description: "CPU, RAM, disk, and network metrics collection with time-series storage.",
    installedDate: "2026-03-12",
    author: "claw-community",
    usedByAgents: ["Monitor"],
  },
  {
    id: "sk-011",
    name: "agent-comms",
    version: "1.0.3",
    source: "bundled",
    category: "communication",
    description: "Inter-agent messaging protocol, event bus, and broadcast channel management.",
    installedDate: "2026-03-09",
    author: "openclaw-team",
    usedByAgents: ["Coco"],
  },
  {
    id: "sk-012",
    name: "threat-intel-feed",
    version: "2.7.0",
    source: "clawhub",
    category: "security",
    description: "Aggregates CVE feeds, threat advisories, and IOC databases. Auto-correlates with local assets.",
    installedDate: "2026-03-13",
    author: "secops-labs",
    usedByAgents: ["SecOps", "Researcher"],
  },
  {
    id: "sk-013",
    name: "web-scraper",
    version: "3.0.1",
    source: "clawhub",
    category: "automation",
    description: "Headless browser automation, DOM extraction, and structured data output with proxy support.",
    installedDate: "2026-03-14",
    author: "claw-community",
    usedByAgents: ["Scraper"],
  },
  {
    id: "sk-014",
    name: "alert-engine",
    version: "1.3.0",
    source: "clawhub",
    category: "monitoring",
    description: "Rule-based alerting system with escalation chains, cooldowns, and notification routing.",
    installedDate: "2026-03-12",
    author: "claw-community",
    usedByAgents: ["Monitor"],
  },
  {
    id: "sk-015",
    name: "incident-response",
    version: "1.1.2",
    source: "workspace",
    category: "security",
    description: "Custom IR playbooks — automated containment, evidence collection, and timeline generation.",
    installedDate: "2026-03-15",
    author: "local",
    usedByAgents: ["SecOps"],
  },
  {
    id: "sk-016",
    name: "docker-ops",
    version: "2.0.0",
    source: "clawhub",
    category: "coding",
    description: "Docker container management — build, run, compose, and registry operations.",
    installedDate: "2026-03-11",
    author: "claw-community",
    usedByAgents: ["Builder"],
  },
  {
    id: "sk-017",
    name: "log-analysis",
    version: "1.6.1",
    source: "clawhub",
    category: "monitoring",
    description: "Structured and unstructured log parsing, anomaly detection, and pattern extraction.",
    installedDate: "2026-03-13",
    author: "secops-labs",
    usedByAgents: ["SecOps", "Monitor"],
  },
  {
    id: "sk-018",
    name: "news-monitor",
    version: "1.2.0",
    source: "workspace",
    category: "research",
    description: "Custom news aggregation — tracks specified topics, entities, and threat actors across RSS feeds.",
    installedDate: "2026-03-16",
    author: "local",
    usedByAgents: ["Researcher"],
  },
  {
    id: "sk-019",
    name: "proxy-rotation",
    version: "1.0.5",
    source: "clawhub",
    category: "automation",
    description: "Residential and datacenter proxy pool management with health checks and auto-rotation.",
    installedDate: "2026-03-14",
    author: "claw-community",
    usedByAgents: ["Scraper"],
  },
  {
    id: "sk-020",
    name: "network-monitor",
    version: "2.2.0",
    source: "clawhub",
    category: "monitoring",
    description: "Real-time network traffic analysis, bandwidth monitoring, and connection tracking.",
    installedDate: "2026-03-12",
    author: "claw-community",
    usedByAgents: ["Monitor"],
  },
];

/* ══════════════════════════════════════════════════════════════════════
   MOCK DATA — CLAWHUB SEARCH RESULTS
   ──────────────────────────────────────────────────────────────────────
   In production, ClawHub search is performed via:
     npx clawhub@latest search <query>
   And installation via:
     npx clawhub@latest install <skill-name>
   This installs the skill to ~/.openclaw/skills/<skill-name>/
   ══════════════════════════════════════════════════════════════════════ */

interface ClawHubResult {
  name: string;
  version: string;
  description: string;
  downloads: number;
  category: SkillCategory;
}

const CLAWHUB_RESULTS: ClawHubResult[] = [
  { name: "steganography-toolkit", version: "1.0.2", description: "Hide and extract data in images, audio, and video files.", downloads: 2340, category: "security" },
  { name: "social-engineering", version: "0.9.1", description: "Phishing simulation, pretexting templates, and awareness training.", downloads: 5120, category: "security" },
  { name: "kubernetes-ops", version: "2.1.0", description: "K8s cluster management — deploy, scale, monitor pods and services.", downloads: 8900, category: "coding" },
  { name: "slack-integration", version: "1.4.0", description: "Send messages, manage channels, and automate Slack workflows.", downloads: 12400, category: "communication" },
  { name: "pdf-extraction", version: "2.0.3", description: "Extract text, tables, and images from PDF documents with OCR support.", downloads: 7800, category: "research" },
  { name: "cron-scheduler", version: "1.2.1", description: "Schedule recurring tasks with cron syntax and failure retry logic.", downloads: 6300, category: "automation" },
  { name: "malware-sandbox", version: "0.8.0", description: "Isolated malware analysis with behavioral monitoring and IOC extraction.", downloads: 3200, category: "security" },
  { name: "grafana-bridge", version: "1.1.0", description: "Export metrics to Grafana dashboards and manage alert rules.", downloads: 4100, category: "monitoring" },
];

// ─── Constants ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<AgentStatus, string> = {
  active: "#00FF9C",
  idle: "#00B4FF",
  error: "#FF2D78",
};

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  security: "#FF2D78",
  automation: "#00FF9C",
  coding: "#00B4FF",
  research: "#00FFD1",
  communication: "#00B4FF",
  monitoring: "#00FF9C",
};

const CATEGORY_ICONS: Record<SkillCategory, React.ElementType> = {
  security: Lock,
  automation: Workflow,
  coding: Code,
  research: Globe,
  communication: Radio,
  monitoring: Eye,
};

const SOURCE_COLORS: Record<SkillSource, string> = {
  clawhub: "#00B4FF",
  workspace: "#00FF9C",
  bundled: "rgba(0,255,156,0.5)",
};

const ALL_CATEGORIES: SkillCategory[] = [
  "security",
  "automation",
  "coding",
  "research",
  "communication",
  "monitoring",
];

// ─── Main Component ─────────────────────────────────────────────────
type TabId = "AGENTS" | "SKILLS";

export default function AgentsSkills() {
  const [activeTab, setActiveTab] = useState<TabId>("AGENTS");

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {/* ── Tab Bar ─────────────────────────────────────────── */}
        <div
          style={{
            padding: "12px 16px 0",
            borderBottom: "1px solid rgba(0,255,156,0.15)",
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-end",
            gap: 0,
          }}
        >
          {(["AGENTS", "SKILLS"] as TabId[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                data-testid={`tab-${tab.toLowerCase()}`}
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  padding: "8px 20px 10px",
                  background: isActive ? "rgba(0,255,156,0.05)" : "transparent",
                  border: "1px solid",
                  borderColor: isActive
                    ? "rgba(0,255,156,0.2) rgba(0,255,156,0.2) transparent rgba(0,255,156,0.2)"
                    : "transparent transparent rgba(0,255,156,0.15) transparent",
                  borderBottom: isActive ? "1px solid #050508" : "1px solid rgba(0,255,156,0.15)",
                  marginBottom: -1,
                  color: isActive ? "#00FF9C" : "rgba(0,255,156,0.35)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textShadow: isActive ? "0 0 10px rgba(0,255,156,0.5)" : "none",
                  borderRadius: "2px 2px 0 0",
                }}
              >
                {tab === "AGENTS" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bot size={13} /> AGENTS
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Package size={13} /> SKILLS
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ─────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "AGENTS" ? <AgentsTab /> : <SkillsTab />}
        </div>
      </div>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  AGENTS TAB
// ═════════════════════════════════════════════════════════════════════

function AgentsTab() {
  const [agents, setAgents] = useState<AgentDetail[]>(DEFAULT_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents().then((realAgents) => {
      const detailed = realAgents.map(a => ({
        ...a,
        description: `${a.name} agent - ${a.role}`,
        installedSkills: [],
        activeSessions: [],
        memoryFiles: [],
      }));
      setAgents(detailed);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  if (selectedAgent) {
    return (
      <AgentDetailView
        agent={selectedAgent}
        onBack={() => setSelectedAgent(null)}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          borderBottom: "1px solid rgba(0,255,156,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Cpu size={14} color="#00FF9C" />
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "rgba(0,255,156,0.5)",
            }}
          >
            {loading ? "LOADING..." : `${agents.length} REGISTERED • ${agents.filter((a) => a.status === "active").length} ACTIVE • ${agents.filter((a) => a.status === "error").length} ERROR`}
          </span>
        </div>
        <button
          onClick={() => setShowNewAgentModal(true)}
          data-testid="button-request-new-agent"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.12em",
            padding: "6px 14px",
            background: "rgba(0,180,255,0.08)",
            border: "1px solid rgba(0,180,255,0.3)",
            color: "#00B4FF",
            cursor: "pointer",
            transition: "all 0.2s",
            borderRadius: 2,
          }}
        >
          <Plus size={11} />
          REQUEST NEW AGENT
        </button>
      </div>

      {/* ── Agent Grid ─────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 10,
          }}
        >
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isPrimary={agent.id === "main"}
              onClick={() => setSelectedAgent(agent)}
            />
          ))}
        </div>
      </div>

      {/* ── New Agent Modal ────────────────────────────────── */}
      {showNewAgentModal && (
        <NewAgentModal onClose={() => setShowNewAgentModal(false)} />
      )}
    </div>
  );
}

// ─── Agent Card ─────────────────────────────────────────────────────
function AgentCard({
  agent,
  isPrimary,
  onClick,
}: {
  agent: AgentDetail;
  isPrimary: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[agent.status];
  const memoryPercent = Math.round((agent.memoryUsageMB / agent.memoryCapMB) * 100);

  return (
    <div
      className="terminal-panel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      data-testid={`card-agent-${agent.id}`}
      style={{
        padding: 0,
        cursor: "pointer",
        transition: "all 0.25s",
        borderColor: isPrimary
          ? hovered
            ? "rgba(0,255,156,0.5)"
            : "rgba(0,255,156,0.3)"
          : hovered
            ? `${statusColor}50`
            : undefined,
        boxShadow: isPrimary
          ? `0 0 20px rgba(0,255,156,0.12), inset 0 0 20px rgba(0,255,156,0.03)${hovered ? ", 0 0 30px rgba(0,255,156,0.2)" : ""}`
          : hovered
            ? `0 0 16px ${statusColor}18`
            : undefined,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Primary agent glow line */}
      {isPrimary && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, #00FF9C, transparent)",
            boxShadow: "0 0 10px #00FF9C",
          }}
        />
      )}

      {/* Card header */}
      <div
        style={{
          padding: "12px 14px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Emoji avatar */}
          <div
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              border: `1px solid ${isPrimary ? "rgba(0,255,156,0.3)" : "rgba(0,255,156,0.12)"}`,
              borderRadius: 2,
              background: isPrimary ? "rgba(0,255,156,0.05)" : "rgba(0,255,156,0.02)",
              flexShrink: 0,
            }}
          >
            {agent.emoji}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#00FF9C",
                  letterSpacing: "0.08em",
                  textShadow: hovered || isPrimary ? "0 0 8px rgba(0,255,156,0.5)" : "none",
                }}
              >
                {agent.name}
              </span>
              {isPrimary && (
                <span
                  style={{
                    fontSize: 7,
                    letterSpacing: "0.15em",
                    padding: "1px 6px",
                    border: "1px solid rgba(0,255,156,0.3)",
                    color: "#00FF9C",
                    background: "rgba(0,255,156,0.08)",
                    fontWeight: 700,
                  }}
                >
                  PRIMARY
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 8,
                color: "rgba(0,255,156,0.35)",
                letterSpacing: "0.06em",
                marginTop: 2,
              }}
            >
              {agent.id}
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: agent.status === "active" ? "status-pulse 2s ease-in-out infinite" : undefined,
            }}
          />
          <span
            style={{
              fontSize: 8,
              letterSpacing: "0.12em",
              color: statusColor,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            {agent.status}
          </span>
        </div>
      </div>

      {/* Role & Model */}
      <div style={{ padding: "0 14px 6px" }}>
        <div
          style={{
            fontSize: 9,
            color: "rgba(0,255,156,0.5)",
            letterSpacing: "0.04em",
            lineHeight: 1.4,
          }}
        >
          {agent.role}
        </div>
        <div
          style={{
            fontSize: 8,
            color: "rgba(0,180,255,0.6)",
            letterSpacing: "0.06em",
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Brain size={9} color="rgba(0,180,255,0.5)" />
          {agent.model}
        </div>
      </div>

      {/* Memory bar */}
      <div style={{ padding: "4px 14px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 7, color: "rgba(0,255,156,0.3)", letterSpacing: "0.1em" }}>
            MEMORY
          </span>
          <span
            style={{
              fontSize: 7,
              color: memoryPercent > 80 ? "#FF2D78" : "rgba(0,255,156,0.4)",
              letterSpacing: "0.06em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {agent.memoryUsageMB}MB / {agent.memoryCapMB}MB
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 3,
            background: "rgba(0,255,156,0.06)",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${memoryPercent}%`,
              height: "100%",
              background:
                memoryPercent > 80
                  ? "#FF2D78"
                  : memoryPercent > 50
                    ? "#00B4FF"
                    : "#00FF9C",
              boxShadow:
                memoryPercent > 80
                  ? "0 0 6px rgba(255,45,120,0.5)"
                  : "0 0 4px rgba(0,255,156,0.3)",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* Footer stats */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid rgba(0,255,156,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 8,
          color: "rgba(0,255,156,0.3)",
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Package size={9} />
          {agent.skillsCount} SKILLS
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Terminal size={9} />
          {agent.sessionsCount} SESSIONS
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={9} color={hovered ? "#00FF9C" : "rgba(0,255,156,0.2)"} />
        </span>
      </div>
    </div>
  );
}

// ─── Agent Detail View ──────────────────────────────────────────────
function AgentDetailView({
  agent,
  onBack,
}: {
  agent: AgentDetail;
  onBack: () => void;
}) {
  const statusColor = STATUS_COLORS[agent.status];
  const memoryPercent = Math.round((agent.memoryUsageMB / agent.memoryCapMB) * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Detail Header ──────────────────────────────────── */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(0,255,156,0.15)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          data-testid="button-agent-detail-back"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            letterSpacing: "0.1em",
            padding: "5px 10px",
            background: "rgba(0,255,156,0.04)",
            border: "1px solid rgba(0,255,156,0.15)",
            color: "#00FF9C",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          <ArrowLeft size={11} />
          BACK
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <span style={{ fontSize: 22 }}>{agent.emoji}</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#00FF9C",
                  letterSpacing: "0.1em",
                  textShadow: "0 0 10px rgba(0,255,156,0.5)",
                }}
              >
                {agent.name}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 8,
                  letterSpacing: "0.1em",
                  color: statusColor,
                  fontWeight: 600,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: statusColor,
                    boxShadow: `0 0 6px ${statusColor}`,
                  }}
                />
                {agent.status.toUpperCase()}
              </div>
            </div>
            <span
              style={{
                fontSize: 9,
                color: "rgba(0,255,156,0.4)",
                letterSpacing: "0.06em",
              }}
            >
              {agent.id} • {agent.role}
            </span>
          </div>
        </div>
      </div>

      {/* ── Detail Content ─────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          alignContent: "start",
        }}
      >
        {/* Config Panel */}
        <div className="terminal-panel" style={{ margin: 0 }}>
          <div className="panel-header">
            <FileCode size={10} /> CONFIGURATION
          </div>
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            <ConfigRow label="AGENT ID" value={agent.id} />
            <ConfigRow label="MODEL" value={agent.model} valueColor="#00B4FF" />
            <ConfigRow label="ROLE" value={agent.role} />
            <ConfigRow label="STATUS" value={agent.status.toUpperCase()} valueColor={statusColor} />
            <ConfigRow label="UPTIME" value={agent.uptime} />
            <ConfigRow label="MEMORY" value={`${agent.memoryUsageMB}MB / ${agent.memoryCapMB}MB (${memoryPercent}%)`} valueColor={memoryPercent > 80 ? "#FF2D78" : undefined} />
          </div>
          <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(0,255,156,0.07)" }}>
            <div
              style={{
                fontSize: 8,
                color: "rgba(0,255,156,0.3)",
                letterSpacing: "0.06em",
                lineHeight: 1.6,
              }}
            >
              {agent.description}
            </div>
          </div>
        </div>

        {/* Active Sessions Panel */}
        <div className="terminal-panel" style={{ margin: 0 }}>
          <div className="panel-header">
            <Terminal size={10} /> ACTIVE SESSIONS ({agent.activeSessions.length})
          </div>
          <div style={{ padding: "6px 0" }}>
            {agent.activeSessions.length === 0 ? (
              <div
                style={{
                  padding: "20px 12px",
                  textAlign: "center",
                  fontSize: 9,
                  color: "rgba(0,255,156,0.2)",
                  letterSpacing: "0.1em",
                }}
              >
                NO ACTIVE SESSIONS
              </div>
            ) : (
              agent.activeSessions.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(0,255,156,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, color: "#00FF9C", fontWeight: 600, letterSpacing: "0.06em" }}>
                      {sess.id}
                    </span>
                    <span style={{ fontSize: 7, color: "rgba(0,255,156,0.3)", letterSpacing: "0.06em" }}>
                      {sess.started}
                    </span>
                  </div>
                  <span style={{ fontSize: 8, color: "rgba(0,255,156,0.45)", letterSpacing: "0.04em" }}>
                    {sess.task}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Installed Skills Panel */}
        <div className="terminal-panel" style={{ margin: 0 }}>
          <div className="panel-header">
            <Package size={10} /> INSTALLED SKILLS ({agent.installedSkills.length})
          </div>
          <div style={{ padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 4 }}>
            {agent.installedSkills.map((skill) => (
              <span
                key={skill}
                style={{
                  fontSize: 8,
                  letterSpacing: "0.06em",
                  padding: "3px 8px",
                  border: "1px solid rgba(0,180,255,0.2)",
                  color: "rgba(0,180,255,0.7)",
                  background: "rgba(0,180,255,0.04)",
                  borderRadius: 2,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Memory Files Panel */}
        <div className="terminal-panel" style={{ margin: 0 }}>
          <div className="panel-header">
            <HardDrive size={10} /> MEMORY FILES ({agent.memoryFiles.length})
          </div>
          <div style={{ padding: "6px 0" }}>
            {agent.memoryFiles.map((file) => (
              <div
                key={file.name}
                style={{
                  padding: "6px 12px",
                  borderBottom: "1px solid rgba(0,255,156,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FolderOpen size={9} color="rgba(0,255,156,0.35)" />
                  <span style={{ fontSize: 9, color: "#00FF9C", letterSpacing: "0.04em" }}>
                    {file.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 8, color: "rgba(0,255,156,0.3)", fontVariantNumeric: "tabular-nums" }}>
                    {file.sizeMB}MB
                  </span>
                  <span style={{ fontSize: 7, color: "rgba(0,255,156,0.2)", fontVariantNumeric: "tabular-nums" }}>
                    {file.modified}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Config Row ─────────────────────────────────────────────────────
function ConfigRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 8, color: "rgba(0,255,156,0.35)", letterSpacing: "0.1em" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 9,
          color: valueColor || "#00FF9C",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textAlign: "right",
          maxWidth: "60%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── New Agent Modal ────────────────────────────────────────────────
/* MOCK: Agent creation form. In production, this would:
   1. Write a new entry to ~/.openclaw/openclaw.json → agents.list[]
   2. Trigger Gateway restart via API: POST /api/gateway/restart
   3. The new agent becomes available after Gateway re-initialization
   Real API endpoint: POST /api/agents/create → updates config + restarts */
function NewAgentModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    model: "claude-sonnet-4-20250514",
    description: "",
  });

  const handleSubmit = useCallback(() => {
    /* MOCK: In production, POST to /api/agents/create with formData,
       which writes to openclaw.json and triggers gateway restart. */
    alert(
      `[MOCK] Agent creation request submitted:\n${JSON.stringify(formData, null, 2)}\n\nIn production, this writes to ~/.openclaw/openclaw.json and restarts the Gateway.`
    );
    onClose();
  }, [formData, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          background: "#0a0a0f",
          border: "1px solid rgba(0,255,156,0.2)",
          borderRadius: 2,
          boxShadow: "0 0 40px rgba(0,255,156,0.08), 0 0 80px rgba(0,0,0,0.6)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(0,255,156,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={13} color="#00B4FF" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#00FF9C",
              }}
            >
              REQUEST NEW AGENT
            </span>
          </div>
          <button
            onClick={onClose}
            data-testid="button-close-new-agent-modal"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(0,255,156,0.4)",
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField
            label="AGENT NAME"
            testId="input-agent-name"
            value={formData.name}
            onChange={(v) => setFormData((p) => ({ ...p, name: v }))}
            placeholder="e.g., Analyst"
          />
          <FormField
            label="ROLE"
            testId="input-agent-role"
            value={formData.role}
            onChange={(v) => setFormData((p) => ({ ...p, role: v }))}
            placeholder="e.g., Data Analyst"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              style={{
                fontSize: 8,
                letterSpacing: "0.12em",
                color: "rgba(0,255,156,0.4)",
                fontWeight: 600,
              }}
            >
              MODEL
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData((p) => ({ ...p, model: e.target.value }))}
              data-testid="select-agent-model"
              style={{
                width: "100%",
                background: "rgba(0,255,156,0.03)",
                border: "1px solid rgba(0,255,156,0.15)",
                color: "#00FF9C",
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                padding: "8px 10px",
                outline: "none",
                borderRadius: 2,
                letterSpacing: "0.04em",
              }}
            >
              <option value="claude-opus-4-6">claude-opus-4-6</option>
              <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
              <option value="claude-haiku-4-20250414">claude-haiku-4-20250414</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            </select>
          </div>
          <FormField
            label="DESCRIPTION"
            testId="input-agent-description"
            value={formData.description}
            onChange={(v) => setFormData((p) => ({ ...p, description: v }))}
            placeholder="What will this agent do?"
            multiline
          />
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(0,255,156,0.1)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            data-testid="button-cancel-new-agent"
            style={{
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              letterSpacing: "0.1em",
              padding: "6px 16px",
              background: "transparent",
              border: "1px solid rgba(0,255,156,0.15)",
              color: "rgba(0,255,156,0.4)",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            data-testid="button-submit-new-agent"
            style={{
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.12em",
              padding: "6px 20px",
              background: "rgba(0,180,255,0.1)",
              border: "1px solid rgba(0,180,255,0.4)",
              color: "#00B4FF",
              cursor: "pointer",
              borderRadius: 2,
              boxShadow: "0 0 10px rgba(0,180,255,0.15)",
            }}
          >
            SUBMIT REQUEST
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Field ─────────────────────────────────────────────────────
function FormField({
  label,
  testId,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  testId: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const shared = {
    width: "100%",
    background: "rgba(0,255,156,0.03)",
    border: "1px solid rgba(0,255,156,0.15)",
    color: "#00FF9C",
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    padding: "8px 10px",
    outline: "none" as const,
    borderRadius: 2,
    letterSpacing: "0.04em",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        style={{
          fontSize: 8,
          letterSpacing: "0.12em",
          color: "rgba(0,255,156,0.4)",
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={testId}
          rows={3}
          style={{ ...shared, resize: "vertical" as const }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={testId}
          style={shared}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SKILLS TAB
// ═════════════════════════════════════════════════════════════════════

function SkillsTab() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<SkillCategory | "ALL">("ALL");
  const [showClawHub, setShowClawHub] = useState(false);

  const filteredSkills = useMemo(() => {
    return SKILLS.filter((s) => {
      const matchesCat = activeCategory === "ALL" || s.category === activeCategory;
      const matchesSearch =
        search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.author.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [search, activeCategory]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Skills Header ──────────────────────────────────── */}
      <div
        style={{
          padding: "12px 16px 10px",
          borderBottom: "1px solid rgba(0,255,156,0.08)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 10,
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: "0 1 360px" }}>
            <Search
              size={13}
              color="rgba(0,255,156,0.4)"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              placeholder="// SEARCH INSTALLED SKILLS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-skills"
              style={{
                width: "100%",
                background: "rgba(0,255,156,0.03)",
                border: "1px solid rgba(0,255,156,0.15)",
                color: "#00FF9C",
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em",
                padding: "7px 12px 7px 32px",
                outline: "none",
                borderRadius: 2,
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 9,
                color: "rgba(0,255,156,0.4)",
                letterSpacing: "0.08em",
              }}
            >
              {filteredSkills.length} / {SKILLS.length}
            </span>
            <button
              onClick={() => setShowClawHub(true)}
              data-testid="button-install-from-clawhub"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                letterSpacing: "0.12em",
                padding: "6px 14px",
                background: "rgba(0,180,255,0.08)",
                border: "1px solid rgba(0,180,255,0.3)",
                color: "#00B4FF",
                cursor: "pointer",
                transition: "all 0.2s",
                borderRadius: 2,
              }}
            >
              <Download size={11} />
              INSTALL FROM CLAWHUB
            </button>
          </div>
        </div>

        {/* ── Category filter pills ────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 4,
            overflowX: "auto",
            flexWrap: "nowrap",
            paddingBottom: 2,
          }}
        >
          <CategoryPill
            label="ALL"
            color="#00FF9C"
            isActive={activeCategory === "ALL"}
            onClick={() => setActiveCategory("ALL")}
            count={SKILLS.length}
          />
          {ALL_CATEGORIES.map((cat) => {
            const count = SKILLS.filter((s) => s.category === cat).length;
            return (
              <CategoryPill
                key={cat}
                label={cat.toUpperCase()}
                color={CATEGORY_COLORS[cat]}
                isActive={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* ── Skills Grid ────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
        }}
      >
        {filteredSkills.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 8,
              color: "rgba(0,255,156,0.3)",
              fontSize: 12,
              letterSpacing: "0.1em",
            }}
          >
            <Package size={24} />
            <span>NO MATCHING SKILLS FOUND</span>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 8,
            }}
          >
            {filteredSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        )}
      </div>

      {/* ── ClawHub Panel ──────────────────────────────────── */}
      {showClawHub && <ClawHubPanel onClose={() => setShowClawHub(false)} />}
    </div>
  );
}

// ─── Category Pill ──────────────────────────────────────────────────
function CategoryPill({
  label,
  color,
  isActive,
  onClick,
  count,
}: {
  label: string;
  color: string;
  isActive: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`filter-category-${label.toLowerCase()}`}
      style={{
        flexShrink: 0,
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.1em",
        padding: "4px 10px",
        background: isActive ? `${color}12` : "transparent",
        border: `1px solid ${isActive ? color : "rgba(0,255,156,0.12)"}`,
        color: isActive ? color : "rgba(0,255,156,0.4)",
        cursor: "pointer",
        transition: "all 0.2s",
        textTransform: "uppercase",
        borderRadius: 2,
        boxShadow: isActive ? `0 0 8px ${color}30` : "none",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 7,
          opacity: 0.6,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Skill Card ─────────────────────────────────────────────────────
function SkillCard({ skill }: { skill: Skill }) {
  const [hovered, setHovered] = useState(false);
  const catColor = CATEGORY_COLORS[skill.category];
  const sourceColor = SOURCE_COLORS[skill.source];
  const CatIcon = CATEGORY_ICONS[skill.category];

  return (
    <div
      className="terminal-panel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`card-skill-${skill.id}`}
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        cursor: "default",
        transition: "all 0.2s",
        borderColor: hovered ? `${catColor}40` : undefined,
        boxShadow: hovered ? `0 0 14px ${catColor}15` : undefined,
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "10px 12px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CatIcon size={13} color={catColor} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#00FF9C",
              letterSpacing: "0.06em",
              textShadow: hovered ? "0 0 8px rgba(0,255,156,0.4)" : "none",
            }}
          >
            {skill.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 7,
              letterSpacing: "0.1em",
              padding: "2px 6px",
              border: `1px solid ${catColor}30`,
              color: catColor,
              background: `${catColor}08`,
              textTransform: "uppercase",
            }}
          >
            {skill.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          padding: "0 12px 8px",
          fontSize: 9,
          lineHeight: 1.5,
          color: "rgba(0,255,156,0.45)",
          letterSpacing: "0.04em",
          flex: 1,
        }}
      >
        {skill.description}
      </div>

      {/* Used by agents */}
      {skill.usedByAgents.length > 0 && (
        <div style={{ padding: "0 12px 8px", display: "flex", alignItems: "center", gap: 4 }}>
          <Bot size={8} color="rgba(0,255,156,0.3)" />
          <span style={{ fontSize: 7, color: "rgba(0,255,156,0.3)", letterSpacing: "0.06em" }}>
            {skill.usedByAgents.join(" • ")}
          </span>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: "7px 12px",
          borderTop: "1px solid rgba(0,255,156,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 8,
          color: "rgba(0,255,156,0.3)",
          letterSpacing: "0.06em",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              color: sourceColor,
              fontWeight: 600,
              fontSize: 7,
              letterSpacing: "0.1em",
              padding: "1px 5px",
              border: `1px solid ${sourceColor}30`,
              background: `${sourceColor}08`,
              textTransform: "uppercase",
            }}
          >
            {skill.source}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>v{skill.version}</span>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
          <Clock size={8} />
          {skill.installedDate}
        </span>
      </div>
    </div>
  );
}

// ─── ClawHub Panel ──────────────────────────────────────────────────
/* MOCK: ClawHub is the package registry for OpenClaw skills.
   Real search: npx clawhub@latest search <query>
   Real install: npx clawhub@latest install <skill-name>
   Installed to: ~/.openclaw/skills/<skill-name>/ */
function ClawHubPanel({ onClose }: { onClose: () => void }) {
  const [hubSearch, setHubSearch] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);

  const filteredResults = useMemo(() => {
    if (hubSearch === "") return CLAWHUB_RESULTS;
    return CLAWHUB_RESULTS.filter(
      (r) =>
        r.name.toLowerCase().includes(hubSearch.toLowerCase()) ||
        r.description.toLowerCase().includes(hubSearch.toLowerCase())
    );
  }, [hubSearch]);

  const handleInstall = useCallback((skillName: string) => {
    setInstalling(skillName);
    /* MOCK: In production, this executes:
       npx clawhub@latest install <skillName>
       which installs to ~/.openclaw/skills/<skillName>/
       Then reloads the skill list. */
    setTimeout(() => {
      setInstalling(null);
      alert(
        `[MOCK] Skill installed!\n\nCommand: npx clawhub@latest install ${skillName}\nInstalled to: ~/.openclaw/skills/${skillName}/\n\nIn production, the skill list would refresh automatically.`
      );
    }, 1500);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxHeight: "80vh",
          background: "#0a0a0f",
          border: "1px solid rgba(0,180,255,0.25)",
          borderRadius: 2,
          boxShadow: "0 0 40px rgba(0,180,255,0.08), 0 0 80px rgba(0,0,0,0.6)",
          fontFamily: "'JetBrains Mono', monospace",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(0,180,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={13} color="#00B4FF" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#00B4FF",
                textShadow: "0 0 10px rgba(0,180,255,0.4)",
              }}
            >
              CLAWHUB REGISTRY
            </span>
          </div>
          <button
            onClick={onClose}
            data-testid="button-close-clawhub-panel"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(0,180,255,0.4)",
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,180,255,0.08)", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <Search
              size={13}
              color="rgba(0,180,255,0.4)"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              placeholder="// SEARCH CLAWHUB..."
              value={hubSearch}
              onChange={(e) => setHubSearch(e.target.value)}
              data-testid="input-search-clawhub"
              style={{
                width: "100%",
                background: "rgba(0,180,255,0.03)",
                border: "1px solid rgba(0,180,255,0.15)",
                color: "#00B4FF",
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em",
                padding: "8px 12px 8px 32px",
                outline: "none",
                borderRadius: 2,
              }}
            />
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 7,
              color: "rgba(0,180,255,0.3)",
              letterSpacing: "0.08em",
            }}
          >
            CLI: npx clawhub@latest search {"<query>"} • npx clawhub@latest install {"<skill-name>"}
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredResults.length === 0 ? (
            <div
              style={{
                padding: "30px 16px",
                textAlign: "center",
                fontSize: 10,
                color: "rgba(0,180,255,0.3)",
                letterSpacing: "0.1em",
              }}
            >
              NO RESULTS — TRY A DIFFERENT SEARCH
            </div>
          ) : (
            filteredResults.map((result) => (
              <div
                key={result.name}
                data-testid={`clawhub-result-${result.name}`}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(0,180,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#00B4FF",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {result.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        color: "rgba(0,180,255,0.4)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      v{result.version}
                    </span>
                    <span
                      style={{
                        fontSize: 7,
                        padding: "1px 5px",
                        border: `1px solid ${CATEGORY_COLORS[result.category]}30`,
                        color: CATEGORY_COLORS[result.category],
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {result.category}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: "rgba(0,180,255,0.4)",
                      letterSpacing: "0.04em",
                      lineHeight: 1.5,
                    }}
                  >
                    {result.description}
                  </div>
                  <div
                    style={{
                      fontSize: 7,
                      color: "rgba(0,180,255,0.25)",
                      letterSpacing: "0.06em",
                      marginTop: 3,
                    }}
                  >
                    ↓ {result.downloads.toLocaleString()} downloads
                  </div>
                </div>
                <button
                  onClick={() => handleInstall(result.name)}
                  disabled={installing === result.name}
                  data-testid={`button-install-${result.name}`}
                  style={{
                    flexShrink: 0,
                    fontSize: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    padding: "5px 12px",
                    background:
                      installing === result.name
                        ? "rgba(0,255,156,0.08)"
                        : "rgba(0,180,255,0.08)",
                    border: `1px solid ${installing === result.name ? "rgba(0,255,156,0.3)" : "rgba(0,180,255,0.3)"}`,
                    color: installing === result.name ? "#00FF9C" : "#00B4FF",
                    cursor: installing === result.name ? "wait" : "pointer",
                    borderRadius: 2,
                    transition: "all 0.2s",
                    boxShadow:
                      installing === result.name
                        ? "0 0 8px rgba(0,255,156,0.2)"
                        : "none",
                    minWidth: 80,
                    textAlign: "center",
                  }}
                >
                  {installing === result.name ? "INSTALLING..." : "INSTALL"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
