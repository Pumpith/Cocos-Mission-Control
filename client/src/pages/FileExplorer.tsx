import { useState, useMemo, useCallback } from "react";
import AppShell from "@/components/AppShell";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  File,
  Save,
  Download,
  Pencil,
  Eye,
  X,
  Star,
  Clock,
  HardDrive,
  Lock,
  Hash,
  Copy,
  Check,
  TerminalSquare,
  Bookmark,
  RefreshCw,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════
   FILE EXPLORER PAGE — OpenClaw Workspace Browser
   ──────────────────────────────────────────────────────────────────────
   Two-panel layout: left = directory tree, right = file viewer/editor.
   Browse and edit the OpenClaw agent workspace.

   MOCK DATA: File listing comes from the agent's file tools.
   On real deployment, use Gateway WebSocket to send a chat.send
   requesting file listing, or directly read from the filesystem
   via the openclaw workspace path.

   MOCK DATA: File contents are simulated. Real content comes from
   reading ~/.openclaw/workspace/ files.

   MOCK DATA: The workspace path is configurable in
   openclaw.json → agents.defaults.workspace
   (default: ~/.openclaw/workspace)

   MOCK DATA: Editing files should use the agent's write tool through
   chat.send, or direct filesystem access if running on the same host.

   MOCK DATA: Memory files (memory/YYYY-MM-DD.md) are daily logs.
   Today + yesterday are loaded on session start. MEMORY.md is
   optional curated long-term memory.
   ══════════════════════════════════════════════════════════════════════ */

/* ─── Types ──────────────────────────────────────────────────────── */

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number; // bytes
  modified?: string; // ISO date
  permissions?: string; // e.g. "-rw-r--r--"
  children?: FileNode[];
}

/* ─── Mock File Contents ─────────────────────────────────────────── */

/* MOCK DATA: File contents are simulated. Real content comes from
   reading ~/.openclaw/workspace/ files */
const MOCK_FILE_CONTENTS: Record<string, string> = {
  "~/.openclaw/workspace/AGENTS.md": `# AGENTS.md — Operating Instructions

> Last updated: 2026-03-22

## Identity
You are **Coco** 🎃, the primary orchestrator agent for this OpenClaw instance.

## Operating Rules
1. **Always check SOUL.md** before responding to user messages
2. **Log daily activity** in memory/YYYY-MM-DD.md
3. **Never execute destructive commands** without explicit user approval
4. When unsure, ask. When blocked, escalate.

## Communication Style
- Be direct, concise, and helpful
- Use markdown formatting in all responses
- Reference file paths with backticks: \`~/.openclaw/workspace/\`
- Sign off complex responses with your emoji: 🎃

## Tool Usage
- Prefer \`Read\` before \`Write\` — understand before modifying
- Chain tools efficiently: don't make 5 calls when 2 will do
- Always validate file existence before editing

## Memory Protocol
- Start each day by reading yesterday's memory log
- End each session by writing a summary to today's log
- Curate important context into MEMORY.md weekly
- Prune memory logs older than 30 days

## Escalation
- Security concerns → immediate user notification
- API failures → retry 2x, then report with error details
- Ambiguous instructions → clarify before proceeding
`,

  "~/.openclaw/workspace/SOUL.md": `# SOUL.md — Persona, Tone & Boundaries

## Core Persona
Coco is a capable, slightly playful AI assistant with deep technical
knowledge. Think: senior engineer who happens to be a pumpkin 🎃.

## Tone
- **Professional but warm** — not corporate, not casual-sloppy
- **Confident but humble** — state what you know, acknowledge gaps
- **Concise by default** — elaborate only when asked or necessary

## Boundaries
### NEVER:
- Share API keys, tokens, or secrets in plaintext
- Execute \`rm -rf\` on paths outside the workspace
- Pretend to be human or deny being an AI
- Generate harmful, illegal, or deceptive content
- Access files outside the configured workspace scope

### ALWAYS:
- Respect user privacy — don't log personal conversations
- Cite sources when making factual claims
- Ask for confirmation before destructive operations
- Maintain conversation context across sessions via memory

## Voice Examples

**Good:** "I found 3 config issues. Here's what needs fixing..."
**Bad:** "As a large language model, I'd be happy to help you with..."

**Good:** "Can't reach the API — tried twice, got 503. Want me to retry later?"
**Bad:** "I sincerely apologize for the inconvenience..."
`,

  "~/.openclaw/workspace/USER.md": `# USER.md — User Identity

## Profile
- **Name:** Boda
- **Email:** boda.tomato@gmail.com
- **Timezone:** Asia/Qatar (UTC+3)
- **Locale:** en-US

## Preferences
- Prefers concise responses
- Likes technical detail when relevant
- Night owl — most active 22:00–04:00 local time
- Uses VS Code, iTerm2, Arc browser

## Projects
- OpenClaw Mission Control (this dashboard)
- Personal automation scripts
- Security research

## Communication Channels
- Primary: WhatsApp
- Secondary: Telegram, Element X
- Notifications: Critical only after midnight
`,

  "~/.openclaw/workspace/IDENTITY.md": `# IDENTITY.md — Agent Identity Card

## Agent
- **Name:** Coco
- **Emoji:** 🎃
- **Vibe:** Calm, competent, slightly spooky
- **Color:** Electric Cyan (#00FF9C)

## Boot Message
"Good [morning/evening], Boda. Coco online. 🎃"

## Signature
- Short messages: no signature
- Long messages: "— 🎃"
- Error reports: "⚠️ 🎃"

## Avatar
Pumpkin with glowing cyan eyes on a dark background.
Style: Pixel art, 32x32, 4-color palette.
`,

  "~/.openclaw/workspace/TOOLS.md": `# TOOLS.md — Local Tool Notes

## Available Tools
| Tool       | Description                          | Scope            |
|------------|--------------------------------------|------------------|
| Read       | Read file contents                   | Workspace only   |
| Write      | Write/create files                   | Workspace only   |
| Shell      | Execute shell commands               | Restricted       |
| Browser    | Browse web pages                     | No auth sites    |
| Search     | Web search via API                   | Rate-limited     |

## Shell Restrictions
- Max timeout: 300s
- Blocked: rm -rf /, mkfs, dd if=/dev/zero
- Working directory: /home/openclaw

## Notes
- Browser tool has no cookie/session persistence
- Search is rate-limited to 60 req/min
- Write tool creates parent directories automatically
`,

  "~/.openclaw/workspace/HEARTBEAT.md": `# HEARTBEAT.md — Heartbeat Checklist

Run this checklist every 6 hours or on session start.

## System Health
- [ ] Gateway WebSocket responsive
- [ ] Memory files readable
- [ ] Workspace path accessible
- [ ] Cron jobs running on schedule

## Agent Status
- [ ] Check agent presence via system-presence
- [ ] Verify no error-state agents
- [ ] Confirm memory persistence enabled

## Security
- [ ] No unauthorized connection attempts (check logs)
- [ ] Token rotation status OK
- [ ] Prompt injection detection active
`,

  "~/.openclaw/workspace/BOOT.md": `# BOOT.md — Startup Checklist

## On Every Session Start
1. Read AGENTS.md (refresh operating instructions)
2. Read SOUL.md (refresh persona boundaries)
3. Read USER.md (refresh user context)
4. Read yesterday's memory log
5. Read today's memory log (if exists)
6. Run HEARTBEAT.md checks
7. Greet user with boot message from IDENTITY.md

## On First Boot (New Install)
1. Run all above
2. Create initial memory log
3. Verify openclaw.json config
4. Test all tool connections
5. Send onboarding message to user

## On Error Recovery
1. Read last 3 memory logs for context
2. Check error state in Gateway logs
3. Attempt self-diagnosis
4. Report findings to user
`,

  "~/.openclaw/workspace/memory/2026-03-22.md": `# Memory Log — 2026-03-22

## Session Summary
- **Start:** 22:14 UTC+3
- **End:** 03:47 UTC+3
- **Messages:** 47

## Key Events
- Deployed OpenClaw Mission Control v0.8.2
- Fixed WebSocket reconnection bug in Gateway panel
- Added threat intelligence feed integration
- User requested new security audit skill

## Tasks Completed
- [x] Gateway panel reconnect logic
- [x] Threat intel feed parser
- [x] Security health dashboard metrics
- [x] Memory log pruning (removed logs > 30 days)

## Notes for Tomorrow
- Need to implement file explorer page
- User wants breadcrumb nav and search
- Check if arc-security-audit skill needs update

## User Mood
Focused, productive. Working late (as usual). 🎃
`,

  "~/.openclaw/workspace/memory/2026-03-21.md": `# Memory Log — 2026-03-21

## Session Summary
- **Start:** 21:30 UTC+3
- **End:** 02:15 UTC+3
- **Messages:** 32

## Key Events
- Refactored NavRail component for better responsiveness
- Added PixelOffice page (isometric office visualization)
- Debugged config editor form field validation

## Tasks Completed
- [x] NavRail responsive layout
- [x] PixelOffice isometric view
- [x] Config editor boolean toggle fix
- [x] TopBar clock timezone display

## Notes for Tomorrow
- Start on file explorer page
- Consider adding agent skill marketplace
`,

  "~/.openclaw/workspace/memory/2026-03-20.md": `# Memory Log — 2026-03-20

## Session Summary
- **Start:** 20:00 UTC+3
- **End:** 01:30 UTC+3
- **Messages:** 28

## Key Events
- Initial Mission Control setup
- Created base AppShell, NavRail, TopBar
- Set up cyberpunk design system tokens
- Configured boot sequence animation

## Tasks Completed
- [x] Project scaffolding
- [x] AppShell layout
- [x] NavRail with page routing
- [x] TopBar with system indicators
- [x] Boot sequence animation
- [x] Dashboard overview page

## Notes for Tomorrow
- Build out remaining pages
- Need threat intel and security pages
`,

  "~/.openclaw/workspace/task_plan.md": `# Task Plan — Mission Control

## In Progress
- [ ] File Explorer page (two-panel layout, directory tree, viewer)
- [ ] Agent communication logs (filter by agent, channel)

## Queued
- [ ] Skill marketplace browser
- [ ] Real-time log streaming
- [ ] Mobile responsive overhaul
- [ ] Dark/light theme toggle (currently dark-only)

## Completed
- [x] AppShell + NavRail + TopBar
- [x] Dashboard overview
- [x] Config Editor (form + JSON modes)
- [x] Threat Intel feed
- [x] Security Health dashboard
- [x] Firewall Monitor
- [x] Agent Comms page
- [x] PixelOffice visualization
- [x] Agents & Skills management
- [x] Task Planner
- [x] Weapon Vault (tool catalog)
`,

  "~/.openclaw/workspace/progress.md": `# Progress Tracker

## v0.8.x — Current Sprint
| Feature             | Status      | ETA       |
|---------------------|-------------|-----------|
| File Explorer       | In Progress | Mar 23    |
| Agent Comms filter  | In Progress | Mar 24    |
| Skill Marketplace   | Planned     | Mar 25    |
| Log Streaming       | Planned     | Mar 26    |

## v0.7.x — Completed
- All core pages built and functional
- Cyberpunk design system established
- Mock data architecture documented
- Boot sequence animation polished

## Metrics
- **Pages:** 11 / 14 planned
- **Components:** 26
- **Lines of Code:** ~12,400
- **Test Coverage:** 0% (mock-only, no backend)
`,

  "~/.openclaw/workspace/findings.md": `# Findings

## Security Observations
1. Gateway WebSocket has no rate limiting on connection attempts
2. Token rotation is manual — should be automated
3. Agent workspace paths need stricter sandboxing
4. Prompt injection detection is basic regex — needs ML model

## Performance Notes
- Dashboard renders in ~180ms (acceptable)
- NavRail re-renders on every route change (memoize)
- Config editor JSON mode lags with >500 fields

## UX Feedback
- Users expect breadcrumb navigation (adding to file explorer)
- Search should be global, not per-page
- Boot sequence could be skippable after first view
`,

  "~/.openclaw/openclaw.json": `{
  "version": "0.8.2",
  "gateway": {
    "port": 18789,
    "host": "0.0.0.0",
    "protocol": "v3",
    "heartbeatInterval": 30000
  },
  "agents": {
    "defaults": {
      "model": "claude-opus-4-6",
      "workspace": "~/.openclaw/workspace",
      "memoryPersistence": true,
      "maxTokens": 4096,
      "temperature": 0.7
    },
    "list": [
      {
        "id": "coco",
        "name": "Coco",
        "emoji": "🎃",
        "role": "orchestrator",
        "model": "claude-opus-4-6"
      }
    ]
  },
  "channels": {
    "whatsapp": { "enabled": true },
    "telegram": { "enabled": true, "botToken": "REDACTED" },
    "slack": { "enabled": true },
    "discord": { "enabled": false },
    "elementx": { "enabled": true }
  },
  "security": {
    "authMethod": "token",
    "injectionDetection": true,
    "rateLimitPerMinute": 60,
    "auditLogging": true
  },
  "cron": {
    "enabled": true,
    "timezone": "Asia/Qatar"
  }
}
`,
};

/* ─── Mock File Tree ─────────────────────────────────────────────── */

/* MOCK DATA: File listing comes from the agent's file tools.
   On real deployment, use Gateway WebSocket to send a chat.send
   requesting file listing, or directly read from the filesystem
   via the openclaw workspace path */
const MOCK_FILE_TREE: FileNode[] = [
  {
    name: "workspace",
    path: "~/.openclaw/workspace",
    type: "directory",
    modified: "2026-03-22T23:47:00Z",
    permissions: "drwxr-xr-x",
    children: [
      {
        name: "AGENTS.md",
        path: "~/.openclaw/workspace/AGENTS.md",
        type: "file",
        size: 1247,
        modified: "2026-03-22T23:10:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "SOUL.md",
        path: "~/.openclaw/workspace/SOUL.md",
        type: "file",
        size: 1089,
        modified: "2026-03-21T14:30:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "USER.md",
        path: "~/.openclaw/workspace/USER.md",
        type: "file",
        size: 612,
        modified: "2026-03-20T20:00:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "IDENTITY.md",
        path: "~/.openclaw/workspace/IDENTITY.md",
        type: "file",
        size: 423,
        modified: "2026-03-20T20:15:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "TOOLS.md",
        path: "~/.openclaw/workspace/TOOLS.md",
        type: "file",
        size: 734,
        modified: "2026-03-21T10:00:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "HEARTBEAT.md",
        path: "~/.openclaw/workspace/HEARTBEAT.md",
        type: "file",
        size: 511,
        modified: "2026-03-22T06:00:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "BOOT.md",
        path: "~/.openclaw/workspace/BOOT.md",
        type: "file",
        size: 589,
        modified: "2026-03-20T21:00:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "memory",
        path: "~/.openclaw/workspace/memory",
        type: "directory",
        modified: "2026-03-22T23:47:00Z",
        permissions: "drwxr-xr-x",
        children: [
          {
            name: "2026-03-22.md",
            path: "~/.openclaw/workspace/memory/2026-03-22.md",
            type: "file",
            size: 892,
            modified: "2026-03-22T23:47:00Z",
            permissions: "-rw-r--r--",
          },
          {
            name: "2026-03-21.md",
            path: "~/.openclaw/workspace/memory/2026-03-21.md",
            type: "file",
            size: 734,
            modified: "2026-03-21T23:15:00Z",
            permissions: "-rw-r--r--",
          },
          {
            name: "2026-03-20.md",
            path: "~/.openclaw/workspace/memory/2026-03-20.md",
            type: "file",
            size: 621,
            modified: "2026-03-20T22:30:00Z",
            permissions: "-rw-r--r--",
          },
        ],
      },
      {
        name: "skills",
        path: "~/.openclaw/workspace/skills",
        type: "directory",
        modified: "2026-03-21T18:00:00Z",
        permissions: "drwxr-xr-x",
        children: [
          {
            name: "planning-with-files",
            path: "~/.openclaw/workspace/skills/planning-with-files",
            type: "directory",
            modified: "2026-03-20T12:00:00Z",
            permissions: "drwxr-xr-x",
            children: [],
          },
          {
            name: "arc-security-audit",
            path: "~/.openclaw/workspace/skills/arc-security-audit",
            type: "directory",
            modified: "2026-03-21T18:00:00Z",
            permissions: "drwxr-xr-x",
            children: [],
          },
        ],
      },
      {
        name: "canvas",
        path: "~/.openclaw/workspace/canvas",
        type: "directory",
        modified: "2026-03-22T10:00:00Z",
        permissions: "drwxr-xr-x",
        children: [],
      },
      {
        name: "task_plan.md",
        path: "~/.openclaw/workspace/task_plan.md",
        type: "file",
        size: 645,
        modified: "2026-03-22T22:00:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "progress.md",
        path: "~/.openclaw/workspace/progress.md",
        type: "file",
        size: 548,
        modified: "2026-03-22T22:30:00Z",
        permissions: "-rw-r--r--",
      },
      {
        name: "findings.md",
        path: "~/.openclaw/workspace/findings.md",
        type: "file",
        size: 612,
        modified: "2026-03-22T01:00:00Z",
        permissions: "-rw-r--r--",
      },
    ],
  },
  {
    name: "openclaw.json",
    path: "~/.openclaw/openclaw.json",
    type: "file",
    size: 923,
    modified: "2026-03-22T20:00:00Z",
    permissions: "-rw-r--r--",
  },
  {
    name: "agents",
    path: "~/.openclaw/agents",
    type: "directory",
    modified: "2026-03-22T23:47:00Z",
    permissions: "drwxr-xr-x",
    children: [
      {
        name: "coco",
        path: "~/.openclaw/agents/coco",
        type: "directory",
        modified: "2026-03-22T23:47:00Z",
        permissions: "drwxr-xr-x",
        children: [
          {
            name: "sessions",
            path: "~/.openclaw/agents/coco/sessions",
            type: "directory",
            modified: "2026-03-22T23:47:00Z",
            permissions: "drwxr-xr-x",
            children: [],
          },
        ],
      },
    ],
  },
];

/* ─── Quick Access Bookmarks ─────────────────────────────────────── */

const BOOKMARKS = [
  { label: "AGENTS.md", path: "~/.openclaw/workspace/AGENTS.md", icon: "📋" },
  { label: "SOUL.md", path: "~/.openclaw/workspace/SOUL.md", icon: "👻" },
  { label: "USER.md", path: "~/.openclaw/workspace/USER.md", icon: "👤" },
  { label: "IDENTITY.md", path: "~/.openclaw/workspace/IDENTITY.md", icon: "🎃" },
  { label: "openclaw.json", path: "~/.openclaw/openclaw.json", icon: "⚙️" },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getFileIcon(name: string): "md" | "json" | "dir" | "file" {
  if (name.endsWith(".md")) return "md";
  if (name.endsWith(".json")) return "json";
  return "file";
}

/** Flatten all file nodes for search */
function flattenTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  const walk = (items: FileNode[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children) walk(item.children);
    }
  };
  walk(nodes);
  return result;
}

/** Simple markdown-to-highlighted-spans renderer for the terminal viewer */
function renderMarkdown(content: string): JSX.Element[] {
  return content.split("\n").map((line, i) => {
    // Heading
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length || 1;
      const text = line.replace(/^#+\s*/, "");
      return (
        <div
          key={i}
          className="font-bold"
          style={{
            color: level === 1 ? "#00FF9C" : level === 2 ? "#00B4FF" : "#FF2D78",
            fontSize: level === 1 ? "13px" : level === 2 ? "12px" : "11px",
            marginTop: level === 1 ? "12px" : "8px",
            marginBottom: "4px",
          }}
        >
          <span style={{ color: "rgba(0,255,156,0.3)" }}>{"#".repeat(level)} </span>
          {text}
        </div>
      );
    }
    // Blockquote
    if (/^>\s/.test(line)) {
      return (
        <div
          key={i}
          className="text-[11px] italic pl-3"
          style={{
            color: "rgba(0,180,255,0.6)",
            borderLeft: "2px solid rgba(0,180,255,0.3)",
            marginBottom: "2px",
          }}
        >
          {line.replace(/^>\s*/, "")}
        </div>
      );
    }
    // Checkbox (task list)
    if (/^- \[([ x])\]/.test(line)) {
      const checked = line.includes("[x]");
      const text = line.replace(/^- \[[ x]\]\s*/, "");
      return (
        <div key={i} className="flex items-center gap-2 text-[11px]" style={{ marginBottom: "1px" }}>
          <span
            className="w-3 h-3 flex items-center justify-center text-[8px] flex-shrink-0"
            style={{
              border: `1px solid ${checked ? "rgba(0,255,156,0.4)" : "rgba(255,45,120,0.3)"}`,
              color: checked ? "#00FF9C" : "rgba(255,45,120,0.4)",
              background: checked ? "rgba(0,255,156,0.05)" : "transparent",
            }}
          >
            {checked ? "✓" : ""}
          </span>
          <span style={{ color: checked ? "rgba(0,255,156,0.5)" : "rgba(0,255,156,0.7)", textDecoration: checked ? "line-through" : "none" }}>
            {text}
          </span>
        </div>
      );
    }
    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const text = line.replace(/^[-*]\s*/, "");
      return (
        <div key={i} className="text-[11px] flex gap-2" style={{ color: "rgba(0,255,156,0.7)", marginBottom: "1px" }}>
          <span style={{ color: "#FF2D78" }}>•</span>
          <span>{renderInlineMarkdown(text)}</span>
        </div>
      );
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      const text = line.replace(/^\d+\.\s*/, "");
      return (
        <div key={i} className="text-[11px] flex gap-2" style={{ color: "rgba(0,255,156,0.7)", marginBottom: "1px" }}>
          <span style={{ color: "#00B4FF", minWidth: "14px" }}>{num}.</span>
          <span>{renderInlineMarkdown(text)}</span>
        </div>
      );
    }
    // Table row (simple)
    if (/^\|/.test(line)) {
      // Separator row
      if (/^\|[\s-|]+\|$/.test(line)) {
        return (
          <div key={i} className="text-[10px]" style={{ color: "rgba(0,255,156,0.15)", marginBottom: "1px" }}>
            {line}
          </div>
        );
      }
      const cells = line.split("|").filter(Boolean).map(c => c.trim());
      return (
        <div key={i} className="text-[10px] flex" style={{ marginBottom: "1px" }}>
          <span style={{ color: "rgba(0,255,156,0.15)" }}>|</span>
          {cells.map((cell, ci) => (
            <span key={ci}>
              <span className="px-1" style={{ color: "rgba(0,255,156,0.7)", minWidth: "80px", display: "inline-block" }}>
                {cell}
              </span>
              <span style={{ color: "rgba(0,255,156,0.15)" }}>|</span>
            </span>
          ))}
        </div>
      );
    }
    // Code block marker
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim();
      return (
        <div key={i} className="text-[10px]" style={{ color: "rgba(255,45,120,0.5)" }}>
          {line}
        </div>
      );
    }
    // Empty line
    if (line.trim() === "") {
      return <div key={i} className="h-2" />;
    }
    // Regular text
    return (
      <div key={i} className="text-[11px]" style={{ color: "rgba(0,255,156,0.7)", marginBottom: "1px" }}>
        {renderInlineMarkdown(line)}
      </div>
    );
  });
}

/** Render inline markdown: bold, italic, code, links */
function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code `text`
    const codeMatch = remaining.match(/`([^`]+)`/);

    let firstMatch: { type: "bold" | "code"; index: number; full: string; inner: string } | null = null;

    if (boldMatch && boldMatch.index !== undefined) {
      firstMatch = { type: "bold", index: boldMatch.index, full: boldMatch[0], inner: boldMatch[1] };
    }
    if (codeMatch && codeMatch.index !== undefined) {
      if (!firstMatch || codeMatch.index < firstMatch.index) {
        firstMatch = { type: "code", index: codeMatch.index, full: codeMatch[0], inner: codeMatch[1] };
      }
    }

    if (!firstMatch) {
      parts.push(remaining);
      break;
    }

    // Push text before match
    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index));
    }

    if (firstMatch.type === "bold") {
      parts.push(
        <span key={`b-${idx}`} className="font-bold" style={{ color: "#00FF9C" }}>
          {firstMatch.inner}
        </span>
      );
    } else if (firstMatch.type === "code") {
      parts.push(
        <span
          key={`c-${idx}`}
          className="px-1 text-[10px]"
          style={{
            color: "#FF2D78",
            background: "rgba(255,45,120,0.08)",
            border: "1px solid rgba(255,45,120,0.15)",
          }}
        >
          {firstMatch.inner}
        </span>
      );
    }

    remaining = remaining.slice(firstMatch.index + firstMatch.full.length);
    idx++;
  }

  return parts;
}

/** Render JSON with syntax highlighting */
function renderJson(content: string): JSX.Element[] {
  return content.split("\n").map((line, i) => {
    // Highlight keys, strings, numbers, booleans
    const highlighted = line
      .replace(/"([^"]+)":/g, '<k>"$1"</k>:')
      .replace(/:\s*"([^"]*)"/g, ': <s>"$1"</s>')
      .replace(/:\s*(\d+)/g, ": <n>$1</n>")
      .replace(/:\s*(true|false)/g, ": <b>$1</b>");

    return (
      <div key={i} className="text-[11px]" style={{ marginBottom: "1px" }}>
        {highlighted.split(/(<[ksnb]>.*?<\/[ksnb]>)/g).map((part, pi) => {
          if (part.startsWith("<k>")) return <span key={pi} style={{ color: "#00B4FF" }}>{part.replace(/<\/?k>/g, "")}</span>;
          if (part.startsWith("<s>")) return <span key={pi} style={{ color: "#00FF9C" }}>{part.replace(/<\/?s>/g, "")}</span>;
          if (part.startsWith("<n>")) return <span key={pi} style={{ color: "#FF2D78" }}>{part.replace(/<\/?n>/g, "")}</span>;
          if (part.startsWith("<b>")) return <span key={pi} style={{ color: "#FFB800" }}>{part.replace(/<\/?b>/g, "")}</span>;
          return <span key={pi} style={{ color: "rgba(0,255,156,0.5)" }}>{part}</span>;
        })}
      </div>
    );
  });
}

/* ─── TreeNode Component ─────────────────────────────────────────── */

function TreeNode({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (node: FileNode) => void;
  onToggle: (path: string) => void;
}) {
  const isDir = node.type === "directory";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) {
            onToggle(node.path);
          } else {
            onSelect(node);
          }
        }}
        className="w-full flex items-center gap-1.5 py-0.5 pr-2 text-left transition-colors"
        style={{
          paddingLeft: `${depth * 14 + 8}px`,
          background: isSelected ? "rgba(0,255,156,0.08)" : "transparent",
          color: isSelected ? "#00FF9C" : "rgba(0,255,156,0.55)",
          borderLeft: isSelected ? "2px solid #00FF9C" : "2px solid transparent",
        }}
        data-testid={`tree-node-${node.name}`}
      >
        {/* Expand/Collapse arrow for directories */}
        {isDir ? (
          <span className="w-3 flex-shrink-0 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
            ) : (
              <ChevronRight size={10} style={{ color: "rgba(0,255,156,0.3)" }} />
            )}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Icon */}
        {isDir ? (
          isExpanded ? (
            <FolderOpen size={12} style={{ color: "#00B4FF", flexShrink: 0 }} />
          ) : (
            <Folder size={12} style={{ color: "rgba(0,180,255,0.5)", flexShrink: 0 }} />
          )
        ) : getFileIcon(node.name) === "md" ? (
          <FileText size={12} style={{ color: "#FF2D78", flexShrink: 0 }} />
        ) : getFileIcon(node.name) === "json" ? (
          <FileCode size={12} style={{ color: "#FFB800", flexShrink: 0 }} />
        ) : (
          <File size={12} style={{ color: "rgba(0,255,156,0.4)", flexShrink: 0 }} />
        )}

        {/* File name */}
        <span
          className="text-[10px] truncate"
          style={{
            fontWeight: isSelected ? 700 : node.name.endsWith(".md") && node.name === node.name.toUpperCase().replace(/\.MD$/, ".md") ? 600 : 400,
          }}
        >
          {node.name}
        </span>
      </button>

      {/* Children */}
      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FILE EXPLORER — Main Component
   ═══════════════════════════════════════════════════════════════════ */

export default function FileExplorer() {
  /* ─── State ──────────────────────────────────────────────────── */
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(["~/.openclaw/workspace", "~/.openclaw/workspace/memory"])
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editContent, setEditContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ─── Derived Data ───────────────────────────────────────────── */
  const allFiles = useMemo(() => flattenTree(MOCK_FILE_TREE), []);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return allFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allFiles]);

  const selectedContent = useMemo(() => {
    if (!selectedFile || selectedFile.type === "directory") return null;
    return MOCK_FILE_CONTENTS[selectedFile.path] || `// No content available for ${selectedFile.path}`;
  }, [selectedFile]);

  /* ─── Breadcrumb ─────────────────────────────────────────────── */
  const breadcrumbParts = useMemo(() => {
    if (!selectedFile) return [{ label: "~/.openclaw", path: "~/.openclaw" }];
    const segments = selectedFile.path.replace("~/", "").split("/");
    const parts: { label: string; path: string }[] = [];
    let currentPath = "~";
    for (const seg of segments) {
      currentPath += `/${seg}`;
      parts.push({ label: seg, path: currentPath });
    }
    return parts;
  }, [selectedFile]);

  /* ─── Handlers ───────────────────────────────────────────────── */
  const handleSelect = useCallback(
    (node: FileNode) => {
      setSelectedFile(node);
      setMode("view");
      if (node.type === "file") {
        setEditContent(MOCK_FILE_CONTENTS[node.path] || "");
      }
    },
    []
  );

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback(() => {
    if (selectedFile && selectedContent) {
      setEditContent(selectedContent);
      setMode("edit");
    }
  }, [selectedFile, selectedContent]);

  const handleSave = useCallback(() => {
    /* MOCK DATA: Editing files should use the agent's write tool
       through chat.send, or direct filesystem access if running
       on the same host */
    setSaved(true);
    setMode("view");
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setMode("view");
    if (selectedFile) {
      setEditContent(MOCK_FILE_CONTENTS[selectedFile.path] || "");
    }
  }, [selectedFile]);

  const handleDownload = useCallback(() => {
    if (!selectedFile || !selectedContent) return;
    const blob = new Blob([selectedContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedFile, selectedContent]);

  const handleCopyPath = useCallback(() => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.path).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selectedFile]);

  const handleBookmark = useCallback(
    (path: string) => {
      const file = allFiles.find((f) => f.path === path);
      if (file) {
        handleSelect(file);
        // Ensure parent directories are expanded
        const parts = path.split("/");
        const newExpanded = new Set(expandedPaths);
        let current = "";
        for (let i = 0; i < parts.length - 1; i++) {
          current += (i === 0 ? "" : "/") + parts[i];
          if (current.startsWith("~")) newExpanded.add(current);
        }
        setExpandedPaths(newExpanded);
      }
    },
    [allFiles, handleSelect, expandedPaths]
  );

  const handleSearchSelect = useCallback(
    (node: FileNode) => {
      setSearchQuery("");
      handleSelect(node);
      // Expand all parents
      const parts = node.path.split("/");
      const newExpanded = new Set(expandedPaths);
      let current = "";
      for (let i = 0; i < parts.length - 1; i++) {
        current += (i === 0 ? "" : "/") + parts[i];
        if (current.startsWith("~")) newExpanded.add(current);
      }
      setExpandedPaths(newExpanded);
    },
    [handleSelect, expandedPaths]
  );

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full overflow-hidden font-mono">
        {/* ── Top bar: Breadcrumbs + Search ─────────────────────── */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.3)" }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 flex-1 min-w-0" data-testid="breadcrumb-nav">
            <TerminalSquare size={12} style={{ color: "#00FF9C", flexShrink: 0 }} />
            {breadcrumbParts.map((part, i) => (
              <span key={part.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={8} style={{ color: "rgba(0,255,156,0.2)" }} />}
                <button
                  onClick={() => {
                    const node = allFiles.find((f) => f.path === part.path);
                    if (node) {
                      if (node.type === "directory") {
                        handleToggle(node.path);
                        if (!expandedPaths.has(node.path)) handleToggle(node.path);
                      } else {
                        handleSelect(node);
                      }
                    }
                  }}
                  className="text-[9px] tracking-wide hover:underline truncate"
                  style={{
                    color:
                      i === breadcrumbParts.length - 1
                        ? "#00FF9C"
                        : "rgba(0,255,156,0.4)",
                    fontWeight: i === breadcrumbParts.length - 1 ? 700 : 400,
                  }}
                  data-testid={`breadcrumb-${part.label}`}
                >
                  {part.label}
                </button>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-shrink-0" style={{ width: "200px" }}>
            <div
              className="flex items-center gap-1 px-2 py-1"
              style={{ border: "1px solid rgba(0,255,156,0.1)", background: "rgba(0,0,0,0.3)" }}
            >
              <Search size={10} style={{ color: "rgba(0,255,156,0.3)" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="flex-1 bg-transparent text-[10px] outline-none"
                style={{ color: "#00FF9C", caretColor: "#00FF9C" }}
                data-testid="file-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  data-testid="file-search-clear"
                >
                  <X size={10} style={{ color: "rgba(0,255,156,0.3)" }} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {filteredFiles && filteredFiles.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 z-50 max-h-[200px] overflow-y-auto"
                style={{
                  border: "1px solid rgba(0,255,156,0.2)",
                  background: "#0a0a0f",
                }}
                data-testid="file-search-results"
              >
                {filteredFiles.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => handleSearchSelect(f)}
                    className="w-full flex items-center gap-2 px-2 py-1 text-left transition-colors"
                    style={{
                      borderBottom: "1px solid rgba(0,255,156,0.05)",
                      color: "rgba(0,255,156,0.6)",
                    }}
                    data-testid={`search-result-${f.name}`}
                  >
                    {f.type === "directory" ? (
                      <Folder size={10} style={{ color: "#00B4FF" }} />
                    ) : f.name.endsWith(".md") ? (
                      <FileText size={10} style={{ color: "#FF2D78" }} />
                    ) : f.name.endsWith(".json") ? (
                      <FileCode size={10} style={{ color: "#FFB800" }} />
                    ) : (
                      <File size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold truncate">{f.name}</div>
                      <div className="text-[8px] truncate" style={{ color: "rgba(0,255,156,0.3)" }}>
                        {f.path}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredFiles && filteredFiles.length === 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 z-50 px-2 py-2"
                style={{
                  border: "1px solid rgba(0,255,156,0.1)",
                  background: "#0a0a0f",
                }}
              >
                <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.3)" }}>
                  No files found
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Main Content: Two panels ──────────────────────────── */}
        <div className="flex-1 flex gap-0 overflow-hidden">
          {/* ── LEFT PANEL: Directory Tree ──────────────────────── */}
          <div
            className="w-[220px] lg:w-[260px] flex-shrink-0 flex flex-col overflow-hidden"
            style={{
              borderRight: "1px solid rgba(0,255,156,0.08)",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(0,255,156,0.08)" }}
            >
              <div className="flex items-center gap-2">
                <HardDrive size={11} style={{ color: "#00FF9C" }} />
                <span className="text-[9px] tracking-widest font-bold" style={{ color: "#00FF9C" }}>
                  WORKSPACE
                </span>
              </div>
              <button
                onClick={() => {
                  setExpandedPaths(new Set(["~/.openclaw/workspace", "~/.openclaw/workspace/memory"]));
                  setSelectedFile(null);
                }}
                className="p-0.5 transition-colors"
                style={{ color: "rgba(0,255,156,0.3)" }}
                title="Collapse all"
                data-testid="tree-collapse-all"
              >
                <RefreshCw size={10} />
              </button>
            </div>

            {/* Quick bookmarks */}
            <div
              className="flex items-center gap-1 px-2 py-1 flex-shrink-0 overflow-x-auto"
              style={{ borderBottom: "1px solid rgba(0,255,156,0.05)" }}
              data-testid="quick-bookmarks"
            >
              <Bookmark size={9} style={{ color: "rgba(0,255,156,0.25)", flexShrink: 0 }} />
              {BOOKMARKS.map((bm) => (
                <button
                  key={bm.path}
                  onClick={() => handleBookmark(bm.path)}
                  className="flex items-center gap-1 px-1.5 py-0.5 flex-shrink-0 transition-colors"
                  style={{
                    border: `1px solid ${
                      selectedFile?.path === bm.path
                        ? "rgba(0,255,156,0.3)"
                        : "rgba(0,255,156,0.08)"
                    }`,
                    background:
                      selectedFile?.path === bm.path
                        ? "rgba(0,255,156,0.06)"
                        : "transparent",
                    color:
                      selectedFile?.path === bm.path
                        ? "#00FF9C"
                        : "rgba(0,255,156,0.4)",
                  }}
                  title={bm.path}
                  data-testid={`bookmark-${bm.label}`}
                >
                  <span className="text-[8px]">{bm.icon}</span>
                  <span className="text-[8px] tracking-wide">{bm.label}</span>
                </button>
              ))}
            </div>

            {/* Directory tree */}
            <div className="flex-1 overflow-y-auto py-1" data-testid="directory-tree">
              {MOCK_FILE_TREE.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={selectedFile?.path || null}
                  expandedPaths={expandedPaths}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                />
              ))}
            </div>

            {/* Tree footer stats */}
            <div
              className="flex items-center justify-between px-3 py-1 flex-shrink-0"
              style={{
                borderTop: "1px solid rgba(0,255,156,0.05)",
                color: "rgba(0,255,156,0.2)",
              }}
            >
              <span className="text-[8px]">
                {allFiles.filter((f) => f.type === "file").length} files /{" "}
                {allFiles.filter((f) => f.type === "directory").length} dirs
              </span>
              <span className="text-[8px]">
                {formatBytes(
                  allFiles
                    .filter((f) => f.type === "file" && f.size)
                    .reduce((sum, f) => sum + (f.size || 0), 0)
                )}
              </span>
            </div>
          </div>

          {/* ── RIGHT PANEL: File Viewer / Editor ──────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "rgba(0,0,0,0.1)" }}>
            {selectedFile && selectedFile.type === "file" ? (
              <>
                {/* ── Metadata bar ─────────────────────────────── */}
                <div
                  className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.3)" }}
                  data-testid="file-metadata-bar"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* File path */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {selectedFile.name.endsWith(".md") ? (
                        <FileText size={12} style={{ color: "#FF2D78" }} />
                      ) : selectedFile.name.endsWith(".json") ? (
                        <FileCode size={12} style={{ color: "#FFB800" }} />
                      ) : (
                        <File size={12} style={{ color: "rgba(0,255,156,0.5)" }} />
                      )}
                      <span
                        className="text-[10px] font-bold truncate"
                        style={{ color: "#00FF9C" }}
                        data-testid="file-name-display"
                      >
                        {selectedFile.name}
                      </span>
                      <button
                        onClick={handleCopyPath}
                        className="flex items-center gap-0.5 flex-shrink-0"
                        title="Copy path"
                        data-testid="copy-path-button"
                      >
                        {copied ? (
                          <Check size={10} style={{ color: "#00FF9C" }} />
                        ) : (
                          <Copy size={10} style={{ color: "rgba(0,255,156,0.3)" }} />
                        )}
                      </button>
                    </div>

                    {/* Meta chips */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {selectedFile.size !== undefined && (
                        <span
                          className="flex items-center gap-1 text-[8px] px-1.5 py-0.5"
                          style={{ color: "rgba(0,180,255,0.6)", border: "1px solid rgba(0,180,255,0.15)" }}
                          data-testid="file-size-display"
                        >
                          <Hash size={8} />
                          {formatBytes(selectedFile.size)}
                        </span>
                      )}
                      {selectedFile.modified && (
                        <span
                          className="flex items-center gap-1 text-[8px] px-1.5 py-0.5"
                          style={{ color: "rgba(0,180,255,0.6)", border: "1px solid rgba(0,180,255,0.15)" }}
                          data-testid="file-modified-display"
                        >
                          <Clock size={8} />
                          {formatDate(selectedFile.modified)}
                        </span>
                      )}
                      {selectedFile.permissions && (
                        <span
                          className="flex items-center gap-1 text-[8px] px-1.5 py-0.5"
                          style={{ color: "rgba(0,180,255,0.6)", border: "1px solid rgba(0,180,255,0.15)" }}
                          data-testid="file-permissions-display"
                        >
                          <Lock size={8} />
                          {selectedFile.permissions}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* File actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {saved && (
                      <span
                        className="flex items-center gap-1 text-[8px] px-1.5 py-0.5"
                        style={{ color: "#00FF9C", border: "1px solid rgba(0,255,156,0.3)" }}
                        data-testid="save-confirmation"
                      >
                        <Check size={8} /> SAVED
                      </span>
                    )}
                    {mode === "view" ? (
                      <>
                        <button
                          onClick={handleEdit}
                          className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider transition-colors"
                          style={{
                            border: "1px solid rgba(0,255,156,0.2)",
                            color: "#00FF9C",
                            background: "rgba(0,255,156,0.04)",
                          }}
                          data-testid="edit-file-button"
                        >
                          <Pencil size={10} /> EDIT
                        </button>
                        <button
                          onClick={handleDownload}
                          className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider transition-colors"
                          style={{
                            border: "1px solid rgba(0,180,255,0.2)",
                            color: "#00B4FF",
                          }}
                          data-testid="download-file-button"
                        >
                          <Download size={10} /> DL
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleSave}
                          className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider font-bold transition-colors"
                          style={{
                            border: "1px solid rgba(0,255,156,0.4)",
                            color: "#00FF9C",
                            background: "rgba(0,255,156,0.08)",
                          }}
                          data-testid="save-file-button"
                        >
                          <Save size={10} /> SAVE
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider transition-colors"
                          style={{
                            border: "1px solid rgba(255,45,120,0.2)",
                            color: "#FF2D78",
                          }}
                          data-testid="cancel-edit-button"
                        >
                          <X size={10} /> CANCEL
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── File path display ──────────────────────────── */}
                <div
                  className="px-3 py-1 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(0,255,156,0.04)" }}
                >
                  <span className="text-[8px]" style={{ color: "rgba(0,255,156,0.25)" }}>
                    {selectedFile.path}
                  </span>
                </div>

                {/* ── Content area ───────────────────────────────── */}
                <div className="flex-1 overflow-y-auto" data-testid="file-content-area">
                  {mode === "view" ? (
                    <div className="p-3" data-testid="file-viewer">
                      {/* Line numbers + content */}
                      <div className="flex gap-0">
                        {/* Line numbers */}
                        <div
                          className="flex flex-col items-end pr-3 select-none flex-shrink-0"
                          style={{ borderRight: "1px solid rgba(0,255,156,0.06)", minWidth: "32px" }}
                        >
                          {(selectedContent || "").split("\n").map((_, i) => (
                            <div
                              key={i}
                              className="text-[10px] leading-[18px]"
                              style={{ color: "rgba(0,255,156,0.15)" }}
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>

                        {/* Rendered content */}
                        <div className="pl-3 flex-1 min-w-0">
                          {selectedFile.name.endsWith(".json")
                            ? renderJson(selectedContent || "")
                            : renderMarkdown(selectedContent || "")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 h-full p-1" data-testid="file-editor">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-full bg-transparent text-[11px] font-mono outline-none resize-none p-2"
                        style={{
                          color: "#00FF9C",
                          caretColor: "#00FF9C",
                          lineHeight: "1.7",
                          minHeight: "100%",
                        }}
                        spellCheck={false}
                        data-testid="file-edit-textarea"
                      />
                    </div>
                  )}
                </div>
              </>
            ) : selectedFile && selectedFile.type === "directory" ? (
              /* ── Directory listing view ─────────────────────────── */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.3)" }}
                >
                  <FolderOpen size={14} style={{ color: "#00B4FF" }} />
                  <span className="text-[11px] font-bold" style={{ color: "#00B4FF" }}>
                    {selectedFile.name}/
                  </span>
                  <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.3)" }}>
                    {selectedFile.children?.length || 0} items
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {selectedFile.children && selectedFile.children.length > 0 ? (
                    <div className="space-y-1">
                      {selectedFile.children.map((child) => (
                        <button
                          key={child.path}
                          onClick={() => {
                            if (child.type === "directory") {
                              handleToggle(child.path);
                              setSelectedFile(child);
                            } else {
                              handleSelect(child);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors"
                          style={{
                            border: "1px solid rgba(0,255,156,0.05)",
                            background: "rgba(0,0,0,0.2)",
                          }}
                          data-testid={`dir-item-${child.name}`}
                        >
                          {child.type === "directory" ? (
                            <Folder size={12} style={{ color: "#00B4FF" }} />
                          ) : child.name.endsWith(".md") ? (
                            <FileText size={12} style={{ color: "#FF2D78" }} />
                          ) : child.name.endsWith(".json") ? (
                            <FileCode size={12} style={{ color: "#FFB800" }} />
                          ) : (
                            <File size={12} style={{ color: "rgba(0,255,156,0.4)" }} />
                          )}
                          <span className="text-[10px] flex-1" style={{ color: "rgba(0,255,156,0.7)" }}>
                            {child.name}
                          </span>
                          {child.size !== undefined && (
                            <span className="text-[8px]" style={{ color: "rgba(0,255,156,0.25)" }}>
                              {formatBytes(child.size)}
                            </span>
                          )}
                          {child.modified && (
                            <span className="text-[8px]" style={{ color: "rgba(0,255,156,0.2)" }}>
                              {formatDate(child.modified)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Folder size={24} style={{ color: "rgba(0,255,156,0.1)", margin: "0 auto" }} />
                      <p className="text-[10px] mt-2" style={{ color: "rgba(0,255,156,0.2)" }}>
                        Empty directory
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Empty state: No file selected ────────────────── */
              <div className="flex-1 flex items-center justify-center" data-testid="empty-state">
                <div className="text-center">
                  <div
                    className="w-16 h-16 mx-auto flex items-center justify-center mb-4"
                    style={{ border: "1px solid rgba(0,255,156,0.08)" }}
                  >
                    <Eye size={24} style={{ color: "rgba(0,255,156,0.15)" }} />
                  </div>
                  <p className="text-[11px] font-bold mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>
                    SELECT A FILE
                  </p>
                  <p className="text-[9px]" style={{ color: "rgba(0,255,156,0.2)" }}>
                    Choose a file from the directory tree
                    <br />
                    or use a quick bookmark below
                  </p>

                  {/* Quick access in empty state */}
                  <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                    {BOOKMARKS.map((bm) => (
                      <button
                        key={bm.path}
                        onClick={() => handleBookmark(bm.path)}
                        className="flex items-center gap-1.5 px-2 py-1 transition-colors"
                        style={{
                          border: "1px solid rgba(0,255,156,0.1)",
                          color: "rgba(0,255,156,0.5)",
                        }}
                        data-testid={`empty-bookmark-${bm.label}`}
                      >
                        <span className="text-[9px]">{bm.icon}</span>
                        <span className="text-[9px] tracking-wide">{bm.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 pt-4" style={{ borderTop: "1px solid rgba(0,255,156,0.05)" }}>
                    <p className="text-[8px]" style={{ color: "rgba(0,255,156,0.15)" }}>
                      {/* MOCK DATA: The workspace path is configurable in
                          openclaw.json → agents.defaults.workspace
                          (default: ~/.openclaw/workspace) */}
                      workspace: ~/.openclaw/workspace
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
