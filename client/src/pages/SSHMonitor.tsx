import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import {
  Terminal,
  Shield,
  ShieldCheck,
  Users,
  AlertTriangle,
  Activity,
  Globe,
  Key,
  Lock,
  Monitor,
  Server,
  Skull,
  ChevronDown,
  ChevronRight,
  Laptop,
  Smartphone,
  Ban,
  Network,
  ArrowUpRight,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════
   SSH TRAFFIC MONITOR PAGE
   ══════════════════════════════════════════════════════════════════════

   A comprehensive SSH monitoring dashboard providing:
   1. Real-time active session tracking with kill capabilities
   2. Authentication log timeline (accept/reject events)
   3. Tailscale peer network visibility
   4. Connection statistics and GeoIP distribution
   5. Defensive stats (fail2ban, UFW)
   6. Read-only sshd_config quick view

   ARCHITECTURE NOTES:
   - All data below is MOCK — see individual block comments for
     production replacement instructions.
   - In production, the Gateway API would proxy system commands
     (journalctl, who, ss, tailscale status) and return structured JSON.
   - Auth log parsing would use `journalctl -u sshd -o json`.
   - Tailscale peer data would come from `tailscale status --json`.
   - Session data from `who -u` cross-referenced with `ss -tnp`.
   ══════════════════════════════════════════════════════════════════════ */

// ─── Design System Constants ──────────────────────────────────────────
// These match the project-wide cyberpunk palette defined in index.css.
// Using short variable names for inline style readability.
const CYAN = "#00FF9C";        // Primary accent — active states, success
const BLUE = "#00B4FF";        // Tertiary accent — secondary info, Tailscale
const MAGENTA = "#FF2D78";     // Warning/danger — failed auth, kill actions
const YELLOW = "#FFD93D";      // Caution — WAN connections, password auth
const BORDER = "rgba(0,255,156,0.15)";   // Standard panel border
const BORDER_HOVER = "rgba(0,255,156,0.35)"; // Border on hover
const FONT = "'JetBrains Mono', monospace";  // Monospace everywhere
const LBL = "rgba(0,255,156,0.4)";    // Label/muted text color
const DIM = "rgba(0,255,156,0.6)";    // Secondary text color

// ─── TypeScript Interfaces ────────────────────────────────────────────

/** Represents a single active SSH session on the host machine */
interface SSHSession {
  id: string;
  user: string;
  sourceIP: string;
  connectedSince: string;  // ISO-ish timestamp
  duration: string;         // Human-readable "Xh Ym" format
  pty: string;              // Pseudo-terminal allocation (pts/N or N/A)
  pid: number;              // Process ID of the sshd child process
  sessionType: "shell" | "sftp" | "tunnel";
  networkType: "TAILSCALE" | "LAN" | "WAN";
}

/** A single entry in the SSH authentication log */
interface AuthLogEntry {
  id: number;
  timestamp: string;
  user: string;
  sourceIP: string;
  method: "publickey" | "password" | "keyboard-interactive";
  result: "ACCEPT" | "REJECT";
  keyFingerprint?: string;  // Only present for publickey auth
}

/** A device on the Tailscale network */
interface TailscalePeer {
  hostname: string;
  tailscaleIP: string;
  os: string;
  online: boolean;
  lastSeen: string;
  isSelf?: boolean;   // True for the Mac Mini running Mission Control
  relay?: string;     // DERP relay node if not direct connection
}

/** GeoIP country breakdown entry for connection stats */
interface GeoEntry {
  country: string;
  flag: string;
  connections: number;
  percentage: number;
}

/** A key-value pair from sshd_config with security assessment */
interface SSHDConfigEntry {
  key: string;
  value: string;
  comment: string;
  secure: boolean;    // Whether this setting meets hardened baseline
}

// ─── Mock Data Blocks ─────────────────────────────────────────────────

/**
 * MOCK DATA — Active SSH Sessions
 * In production, this comes from parsing `who -u` and `ss -tnp` via Gateway API.
 * Replace with: Gateway exec command `who -u` cross-referenced with `ss -tnp | grep ssh`
 * Session type detection via /proc/<pid>/cmdline inspection.
 * Network type determined by IP range: 100.x = Tailscale, 192.168.x/10.x = LAN, else WAN.
 */
const MOCK_SESSIONS: SSHSession[] = [
  {
    id: "sess-001",
    user: "boda",
    sourceIP: "100.78.214.33",
    connectedSince: "2026-03-23 02:14:08",
    duration: "2h 48m",
    pty: "pts/0",
    pid: 14832,
    sessionType: "shell",
    networkType: "TAILSCALE",
  },
  {
    id: "sess-002",
    user: "boda",
    sourceIP: "192.168.1.42",
    connectedSince: "2026-03-23 03:45:22",
    duration: "1h 17m",
    pty: "pts/1",
    pid: 15201,
    sessionType: "shell",
    networkType: "LAN",
  },
  {
    id: "sess-003",
    user: "deploy",
    sourceIP: "192.168.1.105",
    connectedSince: "2026-03-23 04:30:10",
    duration: "0h 32m",
    pty: "N/A",
    pid: 15587,
    sessionType: "sftp",
    networkType: "LAN",
  },
  {
    id: "sess-004",
    user: "boda",
    sourceIP: "100.78.214.33",
    connectedSince: "2026-03-23 04:55:01",
    duration: "0h 07m",
    pty: "N/A",
    pid: 15702,
    sessionType: "tunnel",
    networkType: "TAILSCALE",
  },
];

/**
 * MOCK DATA — Authentication Log (last 24 hours)
 * In production, this comes from parsing /var/log/auth.log or sshd journal via Gateway API.
 * Replace with: Gateway exec command `journalctl -u sshd --since "24 hours ago" -o json`
 * Parse JSON lines for "Accepted" / "Failed" / "Invalid user" patterns.
 * Each entry maps to a single sshd auth event.
 */
const MOCK_AUTH_LOG: AuthLogEntry[] = [
  // Early morning — legitimate access from Tailscale
  { id: 1,  timestamp: "2026-03-22 05:12:33", user: "boda",     sourceIP: "100.78.214.33",  method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:xK9m...q3Rw" },
  // Brute force attempt from known scanner
  { id: 2,  timestamp: "2026-03-22 06:45:11", user: "root",     sourceIP: "45.33.32.156",   method: "password",  result: "REJECT" },
  { id: 3,  timestamp: "2026-03-22 06:45:14", user: "root",     sourceIP: "45.33.32.156",   method: "password",  result: "REJECT" },
  { id: 4,  timestamp: "2026-03-22 06:45:18", user: "admin",    sourceIP: "45.33.32.156",   method: "password",  result: "REJECT" },
  // LAN access from local workstation
  { id: 5,  timestamp: "2026-03-22 08:22:07", user: "boda",     sourceIP: "192.168.1.42",   method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:bN4z...wP7v" },
  // TOR exit node probe
  { id: 6,  timestamp: "2026-03-22 10:01:55", user: "ubuntu",   sourceIP: "185.220.101.34", method: "password",  result: "REJECT" },
  { id: 7,  timestamp: "2026-03-22 10:01:58", user: "test",     sourceIP: "185.220.101.34", method: "password",  result: "REJECT" },
  // Deploy user SFTP session
  { id: 8,  timestamp: "2026-03-22 12:33:41", user: "deploy",   sourceIP: "192.168.1.105",  method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:dR2j...mK8x" },
  // Chinese IP scanning for database users
  { id: 9,  timestamp: "2026-03-22 14:18:29", user: "postgres", sourceIP: "103.237.147.52", method: "password",  result: "REJECT" },
  // Afternoon remote access
  { id: 10, timestamp: "2026-03-22 16:44:03", user: "boda",     sourceIP: "100.78.214.33",  method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:xK9m...q3Rw" },
  // Russian scanner probing service accounts
  { id: 11, timestamp: "2026-03-22 19:05:17", user: "mysql",    sourceIP: "91.240.118.172", method: "password",  result: "REJECT" },
  // Late night local session
  { id: 12, timestamp: "2026-03-22 22:30:44", user: "boda",     sourceIP: "192.168.1.42",   method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:bN4z...wP7v" },
  // Current sessions — still active
  { id: 13, timestamp: "2026-03-23 02:14:08", user: "boda",     sourceIP: "100.78.214.33",  method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:xK9m...q3Rw" },
  { id: 14, timestamp: "2026-03-23 03:45:22", user: "boda",     sourceIP: "192.168.1.42",   method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:bN4z...wP7v" },
  { id: 15, timestamp: "2026-03-23 04:30:10", user: "deploy",   sourceIP: "192.168.1.105",  method: "publickey", result: "ACCEPT", keyFingerprint: "SHA256:dR2j...mK8x" },
];

/**
 * MOCK DATA — Tailscale Peers
 * In production, this comes from `tailscale status --json` via Gateway API.
 * Replace with: Gateway exec command `tailscale status --json`
 * Parse the "Peer" map from JSON output. Online status from "Online" field.
 * The self node is identified by the "Self" field in the status output.
 */
const MOCK_TS_PEERS: TailscalePeer[] = [
  {
    hostname: "mac-mini-openclaw",
    tailscaleIP: "100.64.0.1",
    os: "linux (Ubuntu 24.04)",
    online: true,
    lastSeen: "now",
    isSelf: true,
  },
  {
    hostname: "bodas-macbook-pro",
    tailscaleIP: "100.78.214.33",
    os: "macOS 15.3",
    online: true,
    lastSeen: "now",
  },
  {
    hostname: "iphone-boda",
    tailscaleIP: "100.78.214.41",
    os: "iOS 19.1",
    online: true,
    lastSeen: "2m ago",
  },
  {
    hostname: "work-desktop",
    tailscaleIP: "100.92.44.12",
    os: "Windows 11",
    online: false,
    lastSeen: "3h ago",
  },
  {
    hostname: "pi-homelab",
    tailscaleIP: "100.115.8.77",
    os: "linux (Raspbian)",
    online: true,
    lastSeen: "now",
    relay: "tok",
  },
];

/**
 * MOCK DATA — GeoIP Connection Breakdown (24h)
 * In production, aggregate from auth.log parsing and GeoIP database lookups.
 * Replace with: Gateway endpoint GET /api/ssh/stats
 * GeoIP resolution via MaxMind GeoLite2 database or ipinfo.io API.
 * Percentages calculated server-side from total connection count.
 */
const MOCK_GEO: GeoEntry[] = [
  { country: "Qatar (Local)", flag: "🇶🇦", connections: 24, percentage: 52 },
  { country: "United States", flag: "🇺🇸", connections: 8,  percentage: 17 },
  { country: "Germany",       flag: "🇩🇪", connections: 5,  percentage: 11 },
  { country: "Russia",        flag: "🇷🇺", connections: 4,  percentage: 9 },
  { country: "China",         flag: "🇨🇳", connections: 3,  percentage: 7 },
  { country: "Netherlands",   flag: "🇳🇱", connections: 2,  percentage: 4 },
];

/**
 * MOCK DATA — sshd_config Effective Values
 * In production, parse from /etc/ssh/sshd_config or `sshd -T` output.
 * Replace with: Gateway exec command `sshd -T` to get effective config.
 * The `secure` flag is determined by comparing against a hardened baseline
 * (CIS Benchmark for OpenSSH or Mozilla Modern configuration).
 */
const MOCK_SSHD_CFG: SSHDConfigEntry[] = [
  { key: "Port",                    value: "22",          comment: "Standard SSH port — consider changing for obscurity", secure: true },
  { key: "PermitRootLogin",         value: "no",          comment: "Root login disabled — must use sudo from regular user", secure: true },
  { key: "PasswordAuthentication",  value: "no",          comment: "Password auth disabled — public key only", secure: true },
  { key: "PubkeyAuthentication",    value: "yes",         comment: "Public key authentication enabled", secure: true },
  { key: "MaxAuthTries",            value: "3",           comment: "Lockout after 3 failed attempts per connection", secure: true },
  { key: "AllowUsers",              value: "boda deploy", comment: "Only these users can SSH in", secure: true },
  { key: "X11Forwarding",           value: "no",          comment: "X11 forwarding disabled — headless server", secure: true },
  { key: "PermitEmptyPasswords",    value: "no",          comment: "Empty passwords never allowed", secure: true },
  { key: "ClientAliveInterval",     value: "300",         comment: "Send keepalive every 5 minutes", secure: true },
  { key: "ClientAliveCountMax",     value: "2",           comment: "Disconnect after 2 missed keepalives (10m timeout)", secure: true },
  { key: "LoginGraceTime",          value: "30",          comment: "30 seconds to authenticate before disconnect", secure: true },
  { key: "UsePAM",                  value: "yes",         comment: "PAM authentication modules enabled", secure: true },
];

/**
 * MOCK DATA — Connection Summary Statistics
 * In production, aggregate these from the auth.log parser and session tracker.
 * Replace with: Gateway endpoint GET /api/ssh/stats
 * fail2ban data from `fail2ban-client status sshd` output.
 * UFW denied count from parsing /var/log/ufw.log.
 */
const CONN_STATS = {
  totalToday: 46,
  uniqueIPs: 12,
  peakConcurrent: 5,
  dataTransferred: "2.4 GB",
  blockedIPs: 847,
  fail2banJails: 2,
  ufwDenied24h: 1243,
};

// ─── Helper Functions ─────────────────────────────────────────────────

/** Return accent color for network type badges */
function networkBadgeColor(type: SSHSession["networkType"]): string {
  switch (type) {
    case "TAILSCALE": return BLUE;     // Blue for Tailscale overlay network
    case "LAN":       return CYAN;     // Green/cyan for local network
    case "WAN":       return YELLOW;   // Yellow/warning for public internet
    default:          return DIM;
  }
}

/** Return the appropriate Lucide icon component for SSH session type */
function sessionTypeIcon(type: SSHSession["sessionType"]) {
  switch (type) {
    case "shell":  return Terminal;     // Interactive shell session
    case "sftp":   return ArrowUpRight; // File transfer session
    case "tunnel": return Network;      // Port forwarding / tunnel
    default:       return Terminal;
  }
}

/** Return device icon based on peer's operating system string */
function peerDeviceIcon(os: string) {
  const lower = os.toLowerCase();
  if (lower.includes("ios") || lower.includes("android")) return Smartphone;
  if (lower.includes("macos") || lower.includes("windows")) return Laptop;
  if (lower.includes("linux") || lower.includes("raspbian")) return Server;
  return Monitor;
}

/** Format timestamp to HH:MM:SS for log display */
function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

/** Format timestamp to "DD Mon HH:MM" for compact display */
function fmtFull(ts: string): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Format seconds to human-readable "Xd Yh Zm" uptime string */
function fmtUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

/** Utility: set background color on hover via inline event handler */
function hoverBg(e: React.MouseEvent, bg: string) {
  (e.currentTarget as HTMLElement).style.background = bg;
}

// ─── Sub-Components ───────────────────────────────────────────────────

/**
 * StatusBadge — Small inline status indicator for the header bar.
 * Shows a pulsing dot + label + value. Color indicates status meaning.
 */
function StatusBadge({
  label,
  value,
  color,
  pulse = false,
}: {
  label: string;
  value: string | number;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        border: `1px solid ${color}33`,
        background: `${color}0A`,
        fontSize: "9px",
        letterSpacing: "0.1em",
        fontFamily: FONT,
      }}
    >
      {/* Pulsing status dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          display: "inline-block",
          animation: pulse ? "status-pulse 2s ease-in-out infinite" : "none",
        }}
      />
      <span style={{ color: `${color}99`, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/**
 * KillConfirmModal — Confirmation dialog before terminating an SSH session.
 * Displays session details and requires explicit action to send SIGHUP.
 * In production, this would call: POST /api/ssh/kill { pid: number }
 */
function KillConfirmModal({
  session,
  onConfirm,
  onCancel,
}: {
  session: SSHSession;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 400, fontFamily: FONT }}>
        {/* Modal title with danger icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Skull size={14} style={{ color: MAGENTA }} />
          <span style={{ fontSize: 11, color: MAGENTA, letterSpacing: "0.1em", fontWeight: 600 }}>
            TERMINATE SESSION
          </span>
        </div>

        {/* Session details summary box */}
        <div
          style={{
            fontSize: 9,
            color: DIM,
            lineHeight: "1.8",
            marginBottom: 16,
            padding: 10,
            border: `1px solid ${BORDER}`,
            background: `${MAGENTA}08`,
          }}
        >
          <div>
            <span style={{ color: LBL }}>USER: </span>
            <span style={{ color: CYAN }}>{session.user}</span>
          </div>
          <div>
            <span style={{ color: LBL }}>PID: </span>
            <span style={{ color: CYAN }}>{session.pid}</span>
          </div>
          <div>
            <span style={{ color: LBL }}>SOURCE: </span>
            <span style={{ color: CYAN }}>{session.sourceIP}</span>
          </div>
          <div>
            <span style={{ color: LBL }}>TYPE: </span>
            <span style={{ color: CYAN }}>{session.sessionType.toUpperCase()}</span>
          </div>
        </div>

        {/* Warning text */}
        <p style={{ fontSize: 9, color: `${MAGENTA}CC`, marginBottom: 16, lineHeight: "1.6" }}>
          This will send SIGHUP to PID {session.pid}, forcefully terminating the
          session. Any unsaved work in this session will be lost.
        </p>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 16px", fontSize: 9, letterSpacing: "0.1em",
              color: DIM, border: `1px solid ${BORDER}`, background: "transparent",
              cursor: "pointer", fontFamily: FONT,
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "6px 16px", fontSize: 9, letterSpacing: "0.1em",
              color: "#fff", border: `1px solid ${MAGENTA}`, background: `${MAGENTA}22`,
              cursor: "pointer", fontFamily: FONT,
            }}
          >
            KILL -HUP {session.pid}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function SSHMonitor() {
  // ── Local State ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SSHSession[]>(MOCK_SESSIONS);
  const [killTarget, setKillTarget] = useState<SSHSession | null>(null);
  const [authFilter, setAuthFilter] = useState<"all" | "accept" | "reject">("all");
  const [configExpanded, setConfigExpanded] = useState(false);
  const [uptimeSec, setUptimeSec] = useState(247831); // ~2.8 days in seconds
  const [currentTime, setCurrentTime] = useState(new Date());

  // ── Timer Effects ───────────────────────────────────────────────────

  /** Tick the uptime counter and clock display every second */
  useEffect(() => {
    const interval = setInterval(() => {
      setUptimeSec((prev) => prev + 1);
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /** Simulate session duration updates every 30 seconds */
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) => {
          const match = s.duration.match(/(\d+)h (\d+)m/);
          if (!match) return s;
          let hours = parseInt(match[1], 10);
          let mins = parseInt(match[2], 10) + 1;
          if (mins >= 60) { hours++; mins = 0; }
          return { ...s, duration: `${hours}h ${String(mins).padStart(2, "0")}m` };
        })
      );
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Event Handlers ──────────────────────────────────────────────────

  /** Confirm session kill — remove from session list and close modal */
  const handleKillConfirm = useCallback(() => {
    if (!killTarget) return;
    setSessions((prev) => prev.filter((s) => s.id !== killTarget.id));
    setKillTarget(null);
  }, [killTarget]);

  // ── Derived/Computed Values ─────────────────────────────────────────
  const authLog = MOCK_AUTH_LOG;
  const peers = MOCK_TS_PEERS;
  const onlinePeers = peers.filter((p) => p.online).length;
  const failedAuth24h = authLog.filter((e) => e.result === "REJECT").length;
  const acceptedCount = authLog.filter((e) => e.result === "ACCEPT").length;
  const keyAuthCount = authLog.filter((e) => e.method === "publickey").length;

  // Apply auth log filter
  const filteredAuthLog =
    authFilter === "all"
      ? authLog
      : authLog.filter((e) =>
          authFilter === "accept" ? e.result === "ACCEPT" : e.result === "REJECT"
        );

  // Grid column template for the sessions table
  const sessionColumns = "60px 110px 90px 56px 46px 50px 60px 46px";

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div
        style={{
          height: "100%",
          overflow: "auto",
          padding: 12,
          fontFamily: FONT,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* ═════════════════════════════════════════════════════════
            SECTION 1: HEADER BAR
            At-a-glance status overview: SSHD status, active session
            count, Tailscale peer count, and failed auth in last 24h.
            ═════════════════════════════════════════════════════════ */}
        <div
          className="terminal-panel"
          style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {/* Page title + uptime */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Terminal size={16} style={{ color: CYAN }} />
            <span
              className="glow-text"
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: CYAN,
              }}
            >
              SSH TRAFFIC MONITOR
            </span>
            <span style={{ fontSize: 8, color: LBL, letterSpacing: "0.08em" }}>
              SSHD UPTIME: {fmtUptime(uptimeSec)}
            </span>
          </div>

          {/* Status badges row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label="SSHD STATUS" value="ACTIVE" color={CYAN} pulse />
            <StatusBadge label="ACTIVE SESSIONS" value={sessions.length} color={BLUE} />
            <StatusBadge label="TAILSCALE PEERS" value={onlinePeers} color={BLUE} />
            <StatusBadge label="FAILED AUTH (24H)" value={failedAuth24h} color={MAGENTA} />
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════
            MAIN THREE-COLUMN LAYOUT
            Left: Active Sessions | Center: Auth Log | Right: Tailscale
            Uses CSS Grid. On narrow viewports would benefit from
            responsive breakpoints (future improvement).
            ═════════════════════════════════════════════════════════ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 280px",
            gap: 10,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* ═══════════════════════════════════════════════════════
              SECTION 2: ACTIVE SSH SESSIONS PANEL
              Table of currently connected SSH sessions.
              - Color-coded by network source (Tailscale/LAN/WAN)
              - Session type icons (shell/sftp/tunnel)
              - Kill button for each session (opens confirm modal)
              ═══════════════════════════════════════════════════════ */}
          <div
            className="terminal-panel"
            style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="panel-header">
              <Users size={12} style={{ color: CYAN }} />
              ACTIVE SSH SESSIONS
              <span style={{ marginLeft: "auto", fontSize: 8, color: LBL }}>
                {sessions.length} CONNECTED
              </span>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
              {/* Table column headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: sessionColumns,
                  gap: 4,
                  padding: "4px 6px",
                  fontSize: 7,
                  color: LBL,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${BORDER}`,
                  marginBottom: 4,
                }}
              >
                <span>USER</span>
                <span>SOURCE IP</span>
                <span>CONNECTED</span>
                <span>DURATION</span>
                <span>PTY</span>
                <span>PID</span>
                <span>TYPE</span>
                <span>ACTION</span>
              </div>

              {/* Session rows or empty state */}
              {sessions.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 9, color: LBL }}>
                  NO ACTIVE SESSIONS
                </div>
              ) : (
                sessions.map((session) => {
                  const TypeIcon = sessionTypeIcon(session.sessionType);
                  const badgeColor = networkBadgeColor(session.networkType);

                  return (
                    <div
                      key={session.id}
                      className="log-entry"
                      style={{
                        display: "grid",
                        gridTemplateColumns: sessionColumns,
                        gap: 4,
                        padding: "5px 6px",
                        fontSize: 9,
                        color: DIM,
                        borderBottom: "1px solid rgba(0,255,156,0.05)",
                        alignItems: "center",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => hoverBg(e, "rgba(0,255,156,0.03)")}
                      onMouseLeave={(e) => hoverBg(e, "transparent")}
                    >
                      {/* Username */}
                      <span style={{ color: CYAN, fontWeight: 600 }}>{session.user}</span>

                      {/* Source IP + network type badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 9 }}>{session.sourceIP}</span>
                        <span
                          style={{
                            fontSize: 6,
                            padding: "1px 4px",
                            border: `1px solid ${badgeColor}55`,
                            color: badgeColor,
                            background: `${badgeColor}11`,
                            letterSpacing: "0.08em",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {session.networkType}
                        </span>
                      </div>

                      {/* Connected since timestamp */}
                      <span style={{ fontSize: 8, color: LBL }}>{fmtFull(session.connectedSince)}</span>

                      {/* Duration */}
                      <span style={{ color: CYAN }}>{session.duration}</span>

                      {/* PTY allocation */}
                      <span style={{ fontSize: 8, color: LBL }}>{session.pty}</span>

                      {/* Process ID */}
                      <span style={{ fontSize: 8, color: DIM }}>{session.pid}</span>

                      {/* Session type with icon */}
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <TypeIcon size={9} style={{ color: DIM }} />
                        <span style={{ fontSize: 8, textTransform: "uppercase" }}>{session.sessionType}</span>
                      </div>

                      {/* Kill session button */}
                      <button
                        onClick={() => setKillTarget(session)}
                        style={{
                          padding: "2px 8px",
                          fontSize: 7,
                          letterSpacing: "0.1em",
                          color: MAGENTA,
                          border: `1px solid ${MAGENTA}44`,
                          background: `${MAGENTA}0A`,
                          cursor: "pointer",
                          fontFamily: FONT,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = `${MAGENTA}22`;
                          (e.currentTarget as HTMLElement).style.borderColor = MAGENTA;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = `${MAGENTA}0A`;
                          (e.currentTarget as HTMLElement).style.borderColor = `${MAGENTA}44`;
                        }}
                      >
                        KILL
                      </button>
                    </div>
                  );
                })
              )}

              {/* Network type legend at bottom of sessions panel */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "8px 6px 4px",
                  fontSize: 7,
                  color: LBL,
                  borderTop: `1px solid ${BORDER}`,
                  marginTop: 6,
                }}
              >
                {([
                  ["TAILSCALE (100.x.x.x)", BLUE],
                  ["LAN (192.168.x.x)", CYAN],
                  ["WAN (Public)", YELLOW],
                ] as const).map(([label, clr]) => (
                  <span key={label}>
                    <span style={{ display: "inline-block", width: 6, height: 6, background: clr, marginRight: 4 }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 3: AUTHENTICATION LOG
              Chronological timeline of SSH auth events over 24h.
              - Filterable by all / accept / reject
              - Color-coded results and auth methods
              - Shows key fingerprints for publickey auth
              ═══════════════════════════════════════════════════════ */}
          <div
            className="terminal-panel"
            style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="panel-header">
              <Key size={12} style={{ color: CYAN }} />
              AUTHENTICATION LOG
              {/* Filter tab buttons */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                {(["all", "accept", "reject"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAuthFilter(filter)}
                    style={{
                      padding: "2px 8px",
                      fontSize: 7,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: FONT,
                      cursor: "pointer",
                      border: `1px solid ${
                        authFilter === filter
                          ? filter === "reject" ? MAGENTA : CYAN
                          : BORDER
                      }`,
                      color: authFilter === filter
                        ? filter === "reject" ? MAGENTA : CYAN
                        : LBL,
                      background: authFilter === filter
                        ? filter === "reject" ? `${MAGENTA}15` : `${CYAN}10`
                        : "transparent",
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable log entries */}
            <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
              {filteredAuthLog.map((entry) => {
                const isReject = entry.result === "REJECT";
                const resultColor = isReject ? MAGENTA : CYAN;
                const methodColor = entry.method === "publickey" ? CYAN : YELLOW;

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "5px 6px",
                      fontSize: 9,
                      borderBottom: "1px solid rgba(0,255,156,0.04)",
                      borderLeft: `2px solid ${resultColor}33`,
                      marginBottom: 2,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => hoverBg(e, "rgba(0,255,156,0.02)")}
                    onMouseLeave={(e) => hoverBg(e, "transparent")}
                  >
                    {/* Timestamp column */}
                    <div style={{ minWidth: 95, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 8, color: LBL }}>{fmtFull(entry.timestamp)}</span>
                      <span style={{ fontSize: 7, color: `${LBL}77` }}>{fmtTime(entry.timestamp)}</span>
                    </div>

                    {/* ACCEPT / REJECT badge */}
                    <span
                      style={{
                        fontSize: 7,
                        padding: "1px 6px",
                        border: `1px solid ${resultColor}44`,
                        color: resultColor,
                        background: `${resultColor}11`,
                        letterSpacing: "0.1em",
                        fontWeight: 600,
                        minWidth: 48,
                        textAlign: "center",
                      }}
                    >
                      {entry.result}
                    </span>

                    {/* User, IP, method, and key fingerprint */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: isReject ? `${MAGENTA}CC` : CYAN, fontWeight: 500 }}>
                          {entry.user}
                        </span>
                        <span style={{ color: DIM, fontSize: 8 }}>{entry.sourceIP}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 7 }}>
                        <span
                          style={{
                            padding: "0px 4px",
                            border: `1px solid ${methodColor}33`,
                            color: methodColor,
                            letterSpacing: "0.06em",
                          }}
                        >
                          {entry.method}
                        </span>
                        {entry.keyFingerprint && (
                          <span style={{ color: LBL, fontSize: 7 }}>{entry.keyFingerprint}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auth log summary footer */}
            <div
              style={{
                padding: "6px 10px",
                borderTop: `1px solid ${BORDER}`,
                display: "flex",
                gap: 16,
                fontSize: 7,
                color: LBL,
              }}
            >
              <span>TOTAL: <span style={{ color: DIM }}>{authLog.length}</span></span>
              <span>ACCEPTED: <span style={{ color: CYAN }}>{acceptedCount}</span></span>
              <span>REJECTED: <span style={{ color: MAGENTA }}>{failedAuth24h}</span></span>
              <span>KEY AUTH: <span style={{ color: BLUE }}>{keyAuthCount}</span></span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 4: TAILSCALE PEERS PANEL
              Right sidebar showing all Tailscale network devices.
              - Online/offline status with pulsing dots
              - Highlights the self node (Mission Control host)
              - Shows Tailnet info and MagicDNS access URL
              ═══════════════════════════════════════════════════════ */}
          <div
            className="terminal-panel"
            style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div className="panel-header">
              <Network size={12} style={{ color: CYAN }} />
              TAILSCALE PEERS
              <span style={{ marginLeft: "auto", fontSize: 8, color: LBL }}>
                {onlinePeers}/{peers.length}
              </span>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
              {peers.map((peer) => {
                const PeerIcon = peerDeviceIcon(peer.os);

                return (
                  <div
                    key={peer.hostname}
                    style={{
                      padding: 8,
                      marginBottom: 4,
                      border: `1px solid ${peer.isSelf ? `${CYAN}33` : "rgba(0,255,156,0.06)"}`,
                      background: peer.isSelf ? `${CYAN}06` : "transparent",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = BORDER_HOVER;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        peer.isSelf ? `${CYAN}33` : "rgba(0,255,156,0.06)";
                    }}
                  >
                    {/* Peer header: icon + hostname + online dot */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <PeerIcon size={11} style={{ color: peer.online ? CYAN : LBL }} />
                      <span
                        style={{
                          fontSize: 9,
                          color: peer.online ? CYAN : LBL,
                          fontWeight: 600,
                          flex: 1,
                        }}
                      >
                        {peer.hostname}
                      </span>
                      <span
                        className={`status-dot ${peer.online ? "online" : "offline"}`}
                        style={{ width: 5, height: 5 }}
                      />
                    </div>

                    {/* Peer detail lines */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 17, fontSize: 8 }}>
                      <div>
                        <span style={{ color: LBL }}>IP: </span>
                        <span style={{ color: BLUE }}>{peer.tailscaleIP}</span>
                      </div>
                      <div>
                        <span style={{ color: LBL }}>OS: </span>
                        <span style={{ color: DIM }}>{peer.os}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span>
                          <span style={{ color: LBL }}>SEEN: </span>
                          <span style={{ color: peer.online ? CYAN : `${MAGENTA}AA` }}>{peer.lastSeen}</span>
                        </span>
                        {peer.relay && (
                          <span>
                            <span style={{ color: LBL }}>RELAY: </span>
                            <span style={{ color: YELLOW }}>{peer.relay}</span>
                          </span>
                        )}
                      </div>
                      {peer.isSelf && (
                        <span style={{ fontSize: 7, color: CYAN, letterSpacing: "0.08em", marginTop: 2 }}>
                          ▸ THIS MACHINE — MISSION CONTROL HOST
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Tailnet summary info box */}
              <div style={{ marginTop: 8, padding: 8, border: `1px solid ${BORDER}`, fontSize: 8 }}>
                <div style={{ color: LBL, marginBottom: 4, fontSize: 7, letterSpacing: "0.1em" }}>
                  TAILNET INFO
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>
                    <span style={{ color: LBL }}>NETWORK: </span>
                    <span style={{ color: DIM }}>tailnet-boda.ts.net</span>
                  </div>
                  <div>
                    <span style={{ color: LBL }}>MagicDNS: </span>
                    <span style={{ color: CYAN }}>ENABLED</span>
                  </div>
                  <div>
                    <span style={{ color: LBL }}>MISSION CTRL: </span>
                    <span style={{ color: BLUE }}>http://mac-mini-openclaw:3000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════
            SECTION 5: CONNECTION MAP / STATS (BOTTOM STRIP)
            Three-panel row: Connection Summary | GeoIP | Defense Stats.
            Provides aggregate metrics, geographic distribution,
            and fail2ban/UFW defense counters.
            ═════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>

          {/* ── Connection Summary Stats ── */}
          <div className="terminal-panel" style={{ padding: 0 }}>
            <div className="panel-header">
              <Activity size={12} style={{ color: CYAN }} />
              CONNECTION SUMMARY
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: BORDER }}>
              {[
                { label: "SESSIONS TODAY", value: CONN_STATS.totalToday, color: CYAN },
                { label: "UNIQUE IPs",     value: CONN_STATS.uniqueIPs, color: BLUE },
                { label: "PEAK CONCURRENT", value: CONN_STATS.peakConcurrent, color: CYAN },
                { label: "DATA TRANSFERRED", value: CONN_STATS.dataTransferred, color: BLUE },
              ].map((stat) => (
                <div key={stat.label} style={{ padding: "10px 12px", background: "#050508" }}>
                  <div style={{ fontSize: 7, color: LBL, letterSpacing: "0.1em", marginBottom: 4 }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: 16, color: stat.color, fontWeight: 700 }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── GeoIP Distribution ── */}
          <div className="terminal-panel" style={{ padding: 0 }}>
            <div className="panel-header">
              <Globe size={12} style={{ color: CYAN }} />
              GEO DISTRIBUTION (24H)
            </div>
            <div style={{ padding: "8px 10px" }}>
              {MOCK_GEO.map((geo) => (
                <div
                  key={geo.country}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "3px 0",
                    fontSize: 9,
                  }}
                >
                  <span style={{ fontSize: 11, width: 18 }}>{geo.flag}</span>
                  <span style={{ flex: 1, color: DIM, fontSize: 8 }}>{geo.country}</span>
                  <span style={{ color: LBL, fontSize: 8, minWidth: 20, textAlign: "right" }}>
                    {geo.connections}
                  </span>
                  {/* Percentage bar */}
                  <div style={{ width: 60, height: 4, background: "rgba(0,255,156,0.08)", position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${geo.percentage}%`,
                        background: geo.percentage > 40 ? CYAN : geo.percentage > 15 ? BLUE : `${CYAN}88`,
                        boxShadow: geo.percentage > 40 ? `0 0 4px ${CYAN}55` : "none",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 7, color: LBL, minWidth: 24, textAlign: "right" }}>
                    {geo.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Defense Stats (Fail2ban + UFW) ── */}
          <div className="terminal-panel" style={{ padding: 0 }}>
            <div className="panel-header">
              <Shield size={12} style={{ color: CYAN }} />
              DEFENSE STATS
            </div>
            <div style={{ padding: "10px 12px" }}>
              {/* Fail2ban status card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  padding: 8,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <Ban size={12} style={{ color: MAGENTA }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8, color: LBL, letterSpacing: "0.08em", marginBottom: 2 }}>
                    FAIL2BAN
                  </div>
                  <div style={{ fontSize: 9, color: CYAN }}>
                    {CONN_STATS.fail2banJails} ACTIVE JAILS
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 7, color: LBL }}>BANNED IPs</div>
                  <div
                    className="glow-text-magenta"
                    style={{ fontSize: 14, color: MAGENTA, fontWeight: 700 }}
                  >
                    {CONN_STATS.blockedIPs}
                  </div>
                </div>
              </div>

              {/* UFW denied connections card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  padding: 8,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <ShieldCheck size={12} style={{ color: CYAN }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8, color: LBL, letterSpacing: "0.08em", marginBottom: 2 }}>
                    UFW DENIED (24H)
                  </div>
                  <div style={{ fontSize: 14, color: YELLOW, fontWeight: 700 }}>
                    {CONN_STATS.ufwDenied24h.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Live clock readout */}
              <div
                style={{
                  textAlign: "center",
                  padding: 6,
                  border: `1px solid ${BORDER}`,
                  fontSize: 8,
                  color: LBL,
                }}
              >
                <div style={{ letterSpacing: "0.1em", marginBottom: 2 }}>MONITOR CLOCK</div>
                <div style={{ fontSize: 12, color: CYAN, fontWeight: 600, letterSpacing: "0.15em" }}>
                  {currentTime.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════
            SECTION 6: SSHD CONFIG QUICK VIEW (COLLAPSIBLE)
            Read-only display of effective sshd_config directives.
            Each entry shows the directive, its value, a security
            indicator (shield/warning), and a descriptive comment.
            Collapsed by default to save vertical space.
            ═════════════════════════════════════════════════════════ */}
        <div className="terminal-panel">
          {/* Collapsible toggle header */}
          <button
            onClick={() => setConfigExpanded(!configExpanded)}
            className="panel-header"
            style={{
              width: "100%",
              background: "transparent",
              cursor: "pointer",
              fontFamily: FONT,
              border: "none",
              borderBottom: configExpanded ? `1px solid ${BORDER}` : "none",
            }}
          >
            <Lock size={12} style={{ color: CYAN }} />
            <span>SSHD CONFIG QUICK VIEW</span>
            <span style={{ fontSize: 7, color: LBL, marginLeft: 8 }}>
              /etc/ssh/sshd_config — READ ONLY
            </span>
            <span style={{ marginLeft: "auto" }}>
              {configExpanded ? (
                <ChevronDown size={12} style={{ color: DIM }} />
              ) : (
                <ChevronRight size={12} style={{ color: DIM }} />
              )}
            </span>
          </button>

          {/* Expanded config content */}
          {configExpanded && (
            <div style={{ padding: "8px 10px" }}>
              {/* Read-only warning banner */}
              <div
                style={{
                  fontSize: 7,
                  color: `${MAGENTA}99`,
                  padding: "6px 8px",
                  marginBottom: 8,
                  border: `1px solid ${MAGENTA}22`,
                  background: `${MAGENTA}08`,
                  lineHeight: "1.5",
                }}
              >
                <AlertTriangle
                  size={9}
                  style={{ display: "inline", verticalAlign: "middle", marginRight: 4, color: MAGENTA }}
                />
                Read-only snapshot. In production, fetch from{" "}
                <span style={{ color: CYAN }}>sshd -T</span> via Gateway API.
                Config changes require direct SSH access to the host.
              </div>

              {/* Config table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 140px 1fr",
                  gap: 8,
                  padding: "4px 8px",
                  fontSize: 7,
                  color: LBL,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <span>DIRECTIVE</span>
                <span>VALUE</span>
                <span>NOTES</span>
              </div>

              {/* Config directive rows */}
              {MOCK_SSHD_CFG.map((entry) => (
                <div
                  key={entry.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "180px 140px 1fr",
                    gap: 8,
                    padding: "5px 8px",
                    fontSize: 9,
                    borderBottom: "1px solid rgba(0,255,156,0.04)",
                    alignItems: "center",
                  }}
                >
                  {/* Directive name */}
                  <span style={{ color: CYAN, fontWeight: 500 }}>{entry.key}</span>

                  {/* Value + security icon */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: entry.secure ? CYAN : MAGENTA, fontWeight: 600 }}>
                      {entry.value}
                    </span>
                    {entry.secure ? (
                      <ShieldCheck size={9} style={{ color: `${CYAN}77` }} />
                    ) : (
                      <AlertTriangle size={9} style={{ color: MAGENTA }} />
                    )}
                  </div>

                  {/* Comment / description */}
                  <span style={{ fontSize: 7, color: LBL, fontStyle: "italic" }}>
                    {entry.comment}
                  </span>
                </div>
              ))}

              {/* Production replacement note */}
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 8px",
                  fontSize: 7,
                  color: LBL,
                  border: `1px dashed ${BORDER}`,
                  lineHeight: "1.6",
                }}
              >
                <span style={{ color: DIM }}>// PRODUCTION NOTE:</span>{" "}
                Replace this static display with live data from{" "}
                <span style={{ color: CYAN }}>GET /api/system/sshd-config</span>{" "}
                which runs <span style={{ color: CYAN }}>sshd -T</span> and parses
                the effective configuration. Consider adding a diff view against
                the recommended hardened baseline (CIS Benchmark).
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          KILL SESSION CONFIRMATION MODAL
          Rendered as a portal-style overlay when killTarget is set.
          Requires explicit confirmation before sending SIGHUP.
          ═══════════════════════════════════════════════════════════ */}
      {killTarget && (
        <KillConfirmModal
          session={killTarget}
          onConfirm={handleKillConfirm}
          onCancel={() => setKillTarget(null)}
        />
      )}
    </AppShell>
  );
}
