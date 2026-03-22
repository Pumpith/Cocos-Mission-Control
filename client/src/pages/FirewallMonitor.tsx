import { useState, useEffect, useRef, useCallback } from "react";
import AppShell from "@/components/AppShell";

/* MOCK DATA: All firewall data is simulated — rules, traffic,
   blocked connections, and stats. On real deployment:
   - Fetch UFW rules from: GET /api/system/ufw-rules
     (runs `ufw status verbose` and parses output)
   - Live traffic from: WebSocket at /api/system/traffic-feed
     (runs `tcpdump` or `conntrack` and streams events)
   - Blocked connections from: GET /api/system/ufw-blocked
     (parses /var/log/ufw.log)
   Replace all hardcoded arrays and random generators. */
import {
  Shield,
  ShieldOff,
  ShieldCheck,
  Activity,
  Pause,
  Play,
  Plus,
  AlertTriangle,
  Flame,
  Eye,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Wifi,
  Server,
  Globe,
  Zap,
  Radio,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface FirewallRule {
  id: number;
  to: string;
  action: "ALLOW" | "DENY";
  from: string;
  protocol: string;
  comment: string;
}

interface TrafficEntry {
  id: number;
  timestamp: string;
  action: "ALLOW" | "BLOCK" | "DROP";
  proto: string;
  srcIp: string;
  srcPort: number;
  dstIp: string;
  dstPort: number;
  iface: string;
  bytes: number;
}

interface BlockedIP {
  ip: string;
  count: number;
  country: string;
  flag: string;
  lastSeen: string;
  history: number[];
}

interface ThreatEntry {
  id: number;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  srcIp: string;
  timestamp: string;
  detail: string;
}

// ─── Constants ───────────────────────────────────────────────────────
const CYAN = "#00FF9C";
const BLUE = "#00B4FF";
const MAGENTA = "#FF2D78";
const YELLOW = "#FFD93D";
const BG = "#050508";
const BORDER = "rgba(0,255,156,0.15)";
const FONT = "'JetBrains Mono', monospace";

const FIREWALL_RULES: FirewallRule[] = [
  { id: 1, to: "22/tcp", action: "ALLOW", from: "192.168.1.0/24", protocol: "TCP", comment: "SSH Local" },
  { id: 2, to: "80/tcp", action: "ALLOW", from: "Anywhere", protocol: "TCP", comment: "HTTP" },
  { id: 3, to: "443/tcp", action: "ALLOW", from: "Anywhere", protocol: "TCP", comment: "HTTPS" },
  { id: 4, to: "18789/tcp", action: "ALLOW", from: "Anywhere", protocol: "TCP", comment: "OpenClaw Gateway" },
  { id: 5, to: "3000/tcp", action: "ALLOW", from: "10.0.0.0/8", protocol: "TCP", comment: "Dev Server" },
  { id: 6, to: "53", action: "ALLOW", from: "Anywhere", protocol: "TCP/UDP", comment: "DNS" },
  { id: 7, to: "8443/tcp", action: "ALLOW", from: "172.16.0.0/12", protocol: "TCP", comment: "Admin Panel" },
  { id: 8, to: "5432/tcp", action: "ALLOW", from: "10.0.0.5", protocol: "TCP", comment: "PostgreSQL" },
  { id: 9, to: "6379/tcp", action: "ALLOW", from: "10.0.0.5", protocol: "TCP", comment: "Redis" },
  { id: 10, to: "8080/tcp", action: "DENY", from: "Anywhere", protocol: "TCP", comment: "Alt HTTP Blocked" },
  { id: 11, to: "23/tcp", action: "DENY", from: "Anywhere", protocol: "TCP", comment: "Telnet" },
  { id: 12, to: "Anywhere", action: "DENY", from: "45.33.32.156", protocol: "ANY", comment: "Suspicious IP" },
  { id: 13, to: "Anywhere", action: "DENY", from: "185.220.101.0/24", protocol: "ANY", comment: "TOR Exit Nodes" },
  { id: 14, to: "25/tcp", action: "DENY", from: "Anywhere", protocol: "TCP", comment: "SMTP Blocked" },
  { id: 15, to: "1433/tcp", action: "DENY", from: "Anywhere", protocol: "TCP", comment: "MSSQL" },
  { id: 16, to: "3389/tcp", action: "DENY", from: "Anywhere", protocol: "TCP", comment: "RDP" },
  { id: 17, to: "27017/tcp", action: "DENY", from: "Anywhere", protocol: "TCP", comment: "MongoDB" },
  { id: 18, to: "Anywhere", action: "DENY", from: "103.237.147.0/24", protocol: "ANY", comment: "Known Botnet" },
];

const THREAT_IPS = [
  "45.33.32.156", "185.220.101.34", "103.237.147.52", "91.240.118.172",
  "77.247.181.163", "198.98.51.189", "23.129.64.130", "162.247.74.7",
  "176.10.99.200", "209.141.33.97", "185.100.87.41", "104.244.76.13",
];

const NORMAL_SRC_IPS = [
  "192.168.1.42", "192.168.1.105", "10.0.0.12", "10.0.0.5",
  "172.16.0.3", "192.168.1.1", "10.0.0.1", "192.168.1.200",
];

const DST_IPS = [
  "192.168.1.1", "10.0.0.1", "172.16.0.1", "8.8.8.8",
  "1.1.1.1", "142.250.80.46", "151.101.1.140", "104.16.132.229",
];

const INTERFACES = ["eth0", "wlan0", "lo", "docker0"];

const BLOCKED_IPS_INITIAL: BlockedIP[] = [
  { ip: "45.33.32.156", count: 847, country: "United States", flag: "🇺🇸", lastSeen: "2s ago", history: [12, 18, 25, 14, 31, 22, 19] },
  { ip: "185.220.101.34", count: 623, country: "Germany", flag: "🇩🇪", lastSeen: "5s ago", history: [8, 15, 22, 19, 27, 16, 21] },
  { ip: "103.237.147.52", count: 512, country: "China", flag: "🇨🇳", lastSeen: "8s ago", history: [20, 14, 18, 25, 12, 30, 16] },
  { ip: "91.240.118.172", count: 389, country: "Russia", flag: "🇷🇺", lastSeen: "12s ago", history: [15, 22, 10, 18, 25, 14, 20] },
  { ip: "77.247.181.163", count: 301, country: "Netherlands", flag: "🇳🇱", lastSeen: "15s ago", history: [10, 8, 14, 12, 18, 9, 15] },
  { ip: "198.98.51.189", count: 278, country: "United States", flag: "🇺🇸", lastSeen: "22s ago", history: [7, 12, 15, 9, 18, 11, 14] },
  { ip: "23.129.64.130", count: 234, country: "United States", flag: "🇺🇸", lastSeen: "30s ago", history: [5, 9, 12, 7, 15, 8, 11] },
  { ip: "162.247.74.7", count: 198, country: "United States", flag: "🇺🇸", lastSeen: "45s ago", history: [4, 7, 10, 6, 12, 5, 9] },
  { ip: "176.10.99.200", count: 156, country: "Switzerland", flag: "🇨🇭", lastSeen: "1m ago", history: [3, 6, 8, 5, 10, 4, 7] },
  { ip: "209.141.33.97", count: 134, country: "United States", flag: "🇺🇸", lastSeen: "2m ago", history: [2, 5, 7, 4, 9, 3, 6] },
];

const THREAT_TYPES = [
  { type: "Port Scan Detected", severity: "HIGH" as const, detail: "Sequential port probing on ports 1-1024" },
  { type: "Brute Force SSH", severity: "CRITICAL" as const, detail: "500+ failed auth attempts in 60s" },
  { type: "SYN Flood Attack", severity: "CRITICAL" as const, detail: "Anomalous SYN packet volume detected" },
  { type: "DNS Amplification", severity: "HIGH" as const, detail: "Spoofed DNS queries targeting resolver" },
  { type: "ICMP Flood", severity: "MEDIUM" as const, detail: "Excessive ping requests from single source" },
  { type: "Directory Traversal", severity: "HIGH" as const, detail: "Path traversal attempt on port 443" },
  { type: "SQL Injection Attempt", severity: "HIGH" as const, detail: "Malicious SQL payload in HTTP request" },
  { type: "Slowloris Attack", severity: "MEDIUM" as const, detail: "Partial HTTP requests holding connections" },
  { type: "XSS Probe", severity: "LOW" as const, detail: "Script injection attempt in query params" },
  { type: "Credential Stuffing", severity: "HIGH" as const, detail: "Automated login attempts with leaked creds" },
];

// ─── Helpers ─────────────────────────────────────────────────────────
let _entryId = 0;
function nextId() { return ++_entryId; }

function now24() {
  const d = new Date();
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPort(): number {
  const common = [22, 53, 80, 443, 8080, 3000, 8443, 18789, 3306, 5432, 6379, 25, 1433, 3389, 27017, 445, 139];
  return Math.random() < 0.6 ? randomItem(common) : Math.floor(Math.random() * 65535) + 1;
}

function randomEphemeral(): number {
  return Math.floor(Math.random() * 16384) + 49152;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function generateTrafficEntry(): TrafficEntry {
  const isAttack = Math.random() < 0.35;
  const isDrop = Math.random() < 0.1;

  if (isAttack) {
    return {
      id: nextId(),
      timestamp: now24(),
      action: isDrop ? "DROP" : "BLOCK",
      proto: randomItem(["TCP", "TCP", "TCP", "UDP", "ICMP"]),
      srcIp: randomItem(THREAT_IPS),
      srcPort: randomEphemeral(),
      dstIp: randomItem(DST_IPS.slice(0, 4)),
      dstPort: randomItem([22, 23, 80, 443, 3389, 8080, 1433, 3306, 27017, 445]),
      iface: randomItem(["eth0", "wlan0"]),
      bytes: Math.floor(Math.random() * 512) + 40,
    };
  }

  return {
    id: nextId(),
    timestamp: now24(),
    action: "ALLOW",
    proto: randomItem(["TCP", "TCP", "UDP", "TCP", "ICMP"]),
    srcIp: randomItem(NORMAL_SRC_IPS),
    srcPort: randomEphemeral(),
    dstIp: randomItem(DST_IPS),
    dstPort: randomPort(),
    iface: randomItem(INTERFACES),
    bytes: Math.floor(Math.random() * 8192) + 64,
  };
}

function severityColor(sev: string): string {
  switch (sev) {
    case "CRITICAL": return MAGENTA;
    case "HIGH": return "#FF6B35";
    case "MEDIUM": return YELLOW;
    case "LOW": return BLUE;
    default: return CYAN;
  }
}

// ─── Main Component ──────────────────────────────────────────────────
export default function FirewallMonitor() {
  const [ufwEnabled, setUfwEnabled] = useState(true);
  const [logging, setLogging] = useState(true);
  const [trafficLog, setTrafficLog] = useState<TrafficEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>(BLOCKED_IPS_INITIAL);
  const [threats, setThreats] = useState<ThreatEntry[]>(() => {
    // seed some initial threats
    const initial: ThreatEntry[] = [];
    for (let i = 0; i < 5; i++) {
      const t = randomItem(THREAT_TYPES);
      initial.push({
        id: nextId(),
        type: t.type,
        severity: t.severity,
        srcIp: randomItem(THREAT_IPS),
        timestamp: now24(),
        detail: t.detail,
      });
    }
    return initial;
  });
  const [counters, setCounters] = useState({
    packetsIn: 148203,
    packetsOut: 92457,
    blocked: 12847,
    dropped: 3291,
  });
  const [bandwidth, setBandwidth] = useState({
    inBytes: 2147483648,
    outBytes: 987654321,
  });
  const [protoCounts, setProtoCounts] = useState({ TCP: 187432, UDP: 34521, ICMP: 2847 });
  const [portTraffic] = useState([
    { port: 443, label: "HTTPS", volume: 82 },
    { port: 80, label: "HTTP", volume: 45 },
    { port: 22, label: "SSH", volume: 31 },
    { port: 53, label: "DNS", volume: 28 },
    { port: 18789, label: "OpenClaw", volume: 22 },
    { port: 3000, label: "Dev", volume: 15 },
  ]);
  const [sparkData, setSparkData] = useState<number[]>(() =>
    Array.from({ length: 20 }, () => Math.floor(Math.random() * 80) + 20)
  );

  const logRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Traffic generation
  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current || !ufwEnabled) return;

      const newEntries: TrafficEntry[] = [];
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        newEntries.push(generateTrafficEntry());
      }

      setTrafficLog((prev) => [...prev, ...newEntries].slice(-200));

      // Update counters
      setCounters((prev) => {
        const allowed = newEntries.filter((e) => e.action === "ALLOW").length;
        const blocked = newEntries.filter((e) => e.action === "BLOCK").length;
        const dropped = newEntries.filter((e) => e.action === "DROP").length;
        return {
          packetsIn: prev.packetsIn + newEntries.length,
          packetsOut: prev.packetsOut + allowed,
          blocked: prev.blocked + blocked,
          dropped: prev.dropped + dropped,
        };
      });

      // Update bandwidth
      setBandwidth((prev) => ({
        inBytes: prev.inBytes + newEntries.reduce((s, e) => s + e.bytes, 0),
        outBytes: prev.outBytes + newEntries.filter((e) => e.action === "ALLOW").reduce((s, e) => s + e.bytes, 0),
      }));

      // Update protocol counts
      setProtoCounts((prev) => {
        const update = { ...prev };
        newEntries.forEach((e) => {
          if (e.proto === "TCP") update.TCP++;
          else if (e.proto === "UDP") update.UDP++;
          else if (e.proto === "ICMP") update.ICMP++;
        });
        return update;
      });

      // Update sparkline
      setSparkData((prev) => [...prev.slice(1), Math.floor(Math.random() * 80) + 20]);

      // Occasionally update blocked IPs
      newEntries.forEach((e) => {
        if (e.action === "BLOCK" || e.action === "DROP") {
          setBlockedIPs((prev) => {
            const idx = prev.findIndex((b) => b.ip === e.srcIp);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                count: updated[idx].count + 1,
                lastSeen: "just now",
                history: [...updated[idx].history.slice(1), updated[idx].history[updated[idx].history.length - 1] + 1],
              };
              return updated.sort((a, b) => b.count - a.count);
            }
            return prev;
          });
        }
      });

      // Occasionally add a threat
      if (Math.random() < 0.08) {
        const t = randomItem(THREAT_TYPES);
        setThreats((prev) =>
          [
            {
              id: nextId(),
              type: t.type,
              severity: t.severity,
              srcIp: randomItem(THREAT_IPS),
              timestamp: now24(),
              detail: t.detail,
            },
            ...prev,
          ].slice(0, 12)
        );
      }
    }, 1200 + Math.random() * 800);

    return () => clearInterval(iv);
  }, [ufwEnabled]);

  // Auto-scroll
  useEffect(() => {
    if (!paused && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [trafficLog, paused]);

  const actionColor = useCallback((action: string) => {
    switch (action) {
      case "ALLOW": return CYAN;
      case "BLOCK": return MAGENTA;
      case "DROP": return YELLOW;
      default: return CYAN;
    }
  }, []);

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          fontFamily: FONT,
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          style={{
            padding: "8px 16px",
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Shield size={14} color={ufwEnabled ? CYAN : MAGENTA} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: CYAN,
              textShadow: `0 0 8px rgba(0,255,156,0.5)`,
            }}
          >
            FIREWALL MONITOR // UFW LIVE
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 9, color: "rgba(0,255,156,0.3)", letterSpacing: "0.08em" }}>
            eth0: 192.168.1.42 | wlan0: 10.0.0.12 | Kali GNU/Linux 2026.1
          </span>
        </div>

        {/* ── 3 Column Layout ────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "280px 1fr 340px",
            gap: 1,
            padding: "8px 8px 4px",
            overflow: "hidden",
          }}
        >
          {/* ══════════ LEFT COLUMN ══════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, overflow: "hidden", minHeight: 0 }}>
            {/* FIREWALL STATUS */}
            <div className="terminal-panel" style={{ margin: 0, flexShrink: 0 }}>
              <div className="panel-header">
                <ShieldCheck size={10} /> FIREWALL STATUS
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                {/* UFW Status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>
                    UFW STATUS
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: ufwEnabled ? CYAN : MAGENTA,
                        boxShadow: ufwEnabled
                          ? `0 0 6px ${CYAN}, 0 0 12px ${CYAN}`
                          : `0 0 6px ${MAGENTA}`,
                        animation: ufwEnabled ? "pulse 2s infinite" : "none",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: ufwEnabled ? CYAN : MAGENTA,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {ufwEnabled ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </div>

                {/* Default incoming */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>
                    DEFAULT IN
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: MAGENTA, letterSpacing: "0.1em" }}>
                    DENY
                  </span>
                </div>

                {/* Default outgoing */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>
                    DEFAULT OUT
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: CYAN, letterSpacing: "0.1em" }}>
                    ALLOW
                  </span>
                </div>

                {/* Logging level */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>
                    LOGGING
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: "0.1em" }}>
                    {logging ? "MEDIUM" : "OFF"}
                  </span>
                </div>

                {/* Toggle buttons */}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <ToggleButton
                    active={ufwEnabled}
                    label={ufwEnabled ? "DISABLE UFW" : "ENABLE UFW"}
                    activeColor={MAGENTA}
                    inactiveColor={CYAN}
                    icon={ufwEnabled ? <ShieldOff size={10} /> : <Shield size={10} />}
                    onClick={() => setUfwEnabled((v) => !v)}
                  />
                  <ToggleButton
                    active={logging}
                    label={logging ? "LOG: ON" : "LOG: OFF"}
                    activeColor={CYAN}
                    inactiveColor="rgba(0,255,156,0.4)"
                    icon={<Eye size={10} />}
                    onClick={() => setLogging((v) => !v)}
                  />
                </div>
              </div>
            </div>

            {/* UFW RULES TABLE */}
            <div
              className="terminal-panel"
              style={{ margin: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
            >
              <div className="panel-header">
                <Activity size={10} /> UFW RULES ({FIREWALL_RULES.length})
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px 1fr 48px 1fr",
                    gap: 4,
                    padding: "6px 10px",
                    fontSize: 7,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: "rgba(0,255,156,0.35)",
                    borderBottom: `1px solid ${BORDER}`,
                    position: "sticky",
                    top: 0,
                    background: BG,
                    zIndex: 1,
                  }}
                >
                  <span>#</span>
                  <span>TO</span>
                  <span>ACTION</span>
                  <span>FROM</span>
                </div>
                {FIREWALL_RULES.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr 48px 1fr",
                      gap: 4,
                      padding: "5px 10px",
                      fontSize: 8,
                      borderBottom: "1px solid rgba(0,255,156,0.04)",
                      alignItems: "center",
                      transition: "background 0.15s",
                    }}
                    className="log-entry"
                  >
                    <span style={{ color: "rgba(0,255,156,0.25)", fontVariantNumeric: "tabular-nums" }}>
                      {String(rule.id).padStart(2, "0")}
                    </span>
                    <span style={{ color: rule.action === "ALLOW" ? CYAN : MAGENTA, fontSize: 8 }}>
                      {rule.to}
                    </span>
                    <span
                      style={{
                        fontSize: 7,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: rule.action === "ALLOW" ? CYAN : MAGENTA,
                        background: rule.action === "ALLOW" ? "rgba(0,255,156,0.08)" : "rgba(255,45,120,0.08)",
                        padding: "1px 4px",
                        textAlign: "center",
                        borderRadius: 1,
                      }}
                    >
                      {rule.action}
                    </span>
                    <div style={{ overflow: "hidden" }}>
                      <span style={{ color: "rgba(0,255,156,0.6)", fontSize: 8 }}>{rule.from}</span>
                      <br />
                      <span style={{ color: "rgba(0,180,255,0.4)", fontSize: 7 }}>{rule.comment}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* ADD RULE button */}
              <div style={{ padding: 8, borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
                <button
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "6px 0",
                    fontSize: 9,
                    fontFamily: FONT,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: CYAN,
                    background: "rgba(0,255,156,0.05)",
                    border: `1px solid ${BORDER}`,
                    cursor: "pointer",
                    borderRadius: 2,
                    transition: "all 0.2s",
                  }}
                >
                  <Plus size={10} />
                  ADD RULE
                </button>
              </div>
            </div>
          </div>

          {/* ══════════ CENTER COLUMN ══════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, overflow: "hidden", minHeight: 0 }}>
            {/* LIVE TRAFFIC FEED */}
            <div
              className="terminal-panel"
              style={{ margin: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
            >
              <div className="panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Radio size={10} />
                  <span>LIVE TRAFFIC FEED</span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: paused ? YELLOW : CYAN,
                      display: "inline-block",
                      animation: paused ? "none" : "pulse 1.5s infinite",
                      boxShadow: paused ? "none" : `0 0 4px ${CYAN}`,
                    }}
                  />
                </div>
                <button
                  onClick={() => setPaused((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    fontSize: 8,
                    fontFamily: FONT,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: paused ? CYAN : YELLOW,
                    background: paused ? "rgba(0,255,156,0.06)" : "rgba(255,217,61,0.06)",
                    border: `1px solid ${paused ? "rgba(0,255,156,0.3)" : "rgba(255,217,61,0.3)"}`,
                    cursor: "pointer",
                    borderRadius: 2,
                  }}
                >
                  {paused ? <Play size={8} /> : <Pause size={8} />}
                  {paused ? "RESUME" : "PAUSE"}
                </button>
              </div>
              <div
                ref={logRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  minHeight: 0,
                  padding: "4px 0",
                  background: "rgba(0,0,0,0.3)",
                }}
              >
                {trafficLog.length === 0 && (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      color: "rgba(0,255,156,0.2)",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                    }}
                  >
                    {ufwEnabled ? "INITIALIZING TRAFFIC CAPTURE..." : "FIREWALL DISABLED — NO TRAFFIC MONITORING"}
                  </div>
                )}
                {trafficLog.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: "2px 10px",
                      fontSize: 9,
                      lineHeight: 1.6,
                      borderBottom: "1px solid rgba(0,255,156,0.02)",
                      fontVariantNumeric: "tabular-nums",
                      display: "flex",
                      gap: 0,
                      flexWrap: "nowrap",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ color: "rgba(0,255,156,0.3)" }}>[{entry.timestamp}]</span>
                    <span style={{ color: actionColor(entry.action), fontWeight: 700, marginLeft: 6, minWidth: 40 }}>
                      [{entry.action}]
                    </span>
                    <span style={{ color: BLUE, marginLeft: 6, minWidth: 32 }}>[{entry.proto}]</span>
                    <span style={{ color: "rgba(0,255,156,0.7)", marginLeft: 6 }}>
                      {entry.srcIp}:{entry.srcPort}
                    </span>
                    <span style={{ color: "rgba(0,255,156,0.3)", margin: "0 4px" }}>→</span>
                    <span style={{ color: "rgba(0,255,156,0.7)" }}>
                      {entry.dstIp}:{entry.dstPort}
                    </span>
                    <span style={{ color: "rgba(0,180,255,0.4)", marginLeft: 6 }}>IN={entry.iface}</span>
                    <span style={{ color: "rgba(0,255,156,0.3)", marginLeft: 6 }}>
                      {formatBytes(entry.bytes)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Live counters */}
              <div
                style={{
                  flexShrink: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  borderTop: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <CounterCell
                  icon={<ArrowDownLeft size={10} color={CYAN} />}
                  label="PACKETS IN"
                  value={counters.packetsIn}
                  color={CYAN}
                />
                <CounterCell
                  icon={<ArrowUpRight size={10} color={BLUE} />}
                  label="PACKETS OUT"
                  value={counters.packetsOut}
                  color={BLUE}
                />
                <CounterCell
                  icon={<Ban size={10} color={MAGENTA} />}
                  label="BLOCKED"
                  value={counters.blocked}
                  color={MAGENTA}
                />
                <CounterCell
                  icon={<AlertTriangle size={10} color={YELLOW} />}
                  label="DROPPED"
                  value={counters.dropped}
                  color={YELLOW}
                />
              </div>
            </div>
          </div>

          {/* ══════════ RIGHT COLUMN ══════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, overflow: "hidden", minHeight: 0 }}>
            {/* BLOCKED CONNECTIONS */}
            <div
              className="terminal-panel"
              style={{ margin: 0, flex: "0 1 auto", minHeight: 0, display: "flex", flexDirection: "column", maxHeight: "40%" }}
            >
              <div className="panel-header">
                <Ban size={10} /> BLOCKED CONNECTIONS (TOP 10)
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "4px 0" }}>
                {blockedIPs.map((entry, idx) => (
                  <div
                    key={entry.ip}
                    className="log-entry"
                    style={{
                      padding: "5px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      borderBottom: "1px solid rgba(0,255,156,0.04)",
                      fontSize: 9,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        color: "rgba(0,255,156,0.25)",
                        fontVariantNumeric: "tabular-nums",
                        minWidth: 14,
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: 11 }}>{entry.flag}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: MAGENTA, fontWeight: 600, fontSize: 9 }}>{entry.ip}</span>
                        <span
                          style={{
                            color: MAGENTA,
                            fontWeight: 700,
                            fontSize: 10,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {entry.count.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                        {/* Mini bar chart */}
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 10 }}>
                          {entry.history.map((val, i) => (
                            <div
                              key={i}
                              style={{
                                width: 3,
                                height: Math.max(1, (val / 35) * 10),
                                background: MAGENTA,
                                opacity: 0.3 + (i / entry.history.length) * 0.7,
                                borderRadius: 0,
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: 7, color: "rgba(0,255,156,0.25)" }}>{entry.lastSeen}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TRAFFIC STATS */}
            <div className="terminal-panel" style={{ margin: 0, flexShrink: 0 }}>
              <div className="panel-header">
                <Wifi size={10} /> TRAFFIC STATS
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Bandwidth */}
                <div>
                  <div style={{ fontSize: 7, color: "rgba(0,255,156,0.35)", letterSpacing: "0.12em", marginBottom: 4 }}>
                    BANDWIDTH
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ArrowDownLeft size={9} color={CYAN} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: CYAN, fontVariantNumeric: "tabular-nums" }}>
                        {(bandwidth.inBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ArrowUpRight size={9} color={BLUE} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, fontVariantNumeric: "tabular-nums" }}>
                        {(bandwidth.outBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sparkline */}
                <div>
                  <div style={{ fontSize: 7, color: "rgba(0,255,156,0.35)", letterSpacing: "0.12em", marginBottom: 4 }}>
                    THROUGHPUT (LAST 20s)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 2,
                      height: 24,
                      padding: "0 2px",
                    }}
                  >
                    {sparkData.map((val, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${val}%`,
                          background: i === sparkData.length - 1
                            ? CYAN
                            : `rgba(0,255,156,${0.15 + (i / sparkData.length) * 0.35})`,
                          borderRadius: 0,
                          transition: "height 0.3s ease",
                          boxShadow: i === sparkData.length - 1 ? `0 0 4px ${CYAN}` : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Protocol breakdown */}
                <div>
                  <div style={{ fontSize: 7, color: "rgba(0,255,156,0.35)", letterSpacing: "0.12em", marginBottom: 4 }}>
                    CONNECTIONS BY PROTOCOL
                  </div>
                  {(["TCP", "UDP", "ICMP"] as const).map((proto) => {
                    const total = protoCounts.TCP + protoCounts.UDP + protoCounts.ICMP;
                    const pct = ((protoCounts[proto] / total) * 100).toFixed(1);
                    const colors = { TCP: CYAN, UDP: BLUE, ICMP: YELLOW };
                    return (
                      <div key={proto} style={{ marginBottom: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontSize: 8, color: colors[proto], fontWeight: 600 }}>{proto}</span>
                          <span style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", fontVariantNumeric: "tabular-nums" }}>
                            {protoCounts[proto].toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: 3,
                            background: "rgba(0,255,156,0.06)",
                            borderRadius: 0,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: colors[proto],
                              opacity: 0.6,
                              boxShadow: `0 0 4px ${colors[proto]}40`,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Top ports */}
                <div>
                  <div style={{ fontSize: 7, color: "rgba(0,255,156,0.35)", letterSpacing: "0.12em", marginBottom: 4 }}>
                    TOP PORTS BY VOLUME
                  </div>
                  {portTraffic.map((p) => (
                    <div key={p.port} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span
                        style={{
                          fontSize: 8,
                          color: BLUE,
                          fontWeight: 600,
                          minWidth: 36,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {p.port}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: "rgba(0,255,156,0.06)",
                          borderRadius: 0,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${p.volume}%`,
                            height: "100%",
                            background: CYAN,
                            opacity: 0.5,
                            boxShadow: `0 0 3px ${CYAN}30`,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 7, color: "rgba(0,255,156,0.3)", minWidth: 40, textAlign: "right" }}>
                        {p.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* THREAT DETECTION */}
            <div
              className="terminal-panel"
              style={{ margin: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
            >
              <div className="panel-header">
                <Flame size={10} /> THREAT DETECTION
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "4px 0" }}>
                {threats.map((threat) => (
                  <div
                    key={threat.id}
                    className="log-entry"
                    style={{
                      padding: "6px 10px",
                      borderBottom: "1px solid rgba(0,255,156,0.04)",
                      borderLeft: `2px solid ${severityColor(threat.severity)}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: severityColor(threat.severity) }}>
                        {threat.type}
                      </span>
                      <span
                        style={{
                          fontSize: 7,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          padding: "1px 5px",
                          color: severityColor(threat.severity),
                          background: `${severityColor(threat.severity)}15`,
                          border: `1px solid ${severityColor(threat.severity)}40`,
                          borderRadius: 1,
                        }}
                      >
                        {threat.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", marginBottom: 1 }}>
                      {threat.detail}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7 }}>
                      <span style={{ color: MAGENTA }}>{threat.srcIp}</span>
                      <span style={{ color: "rgba(0,255,156,0.2)" }}>{threat.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </AppShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────
function ToggleButton({
  active,
  label,
  activeColor,
  inactiveColor,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  activeColor: string;
  inactiveColor: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "5px 6px",
        fontSize: 8,
        fontFamily: FONT,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: active ? activeColor : inactiveColor,
        background: `${active ? activeColor : inactiveColor}08`,
        border: `1px solid ${active ? activeColor : inactiveColor}40`,
        cursor: "pointer",
        borderRadius: 2,
        transition: "all 0.2s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function CounterCell({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        textAlign: "center",
        borderRight: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      {icon}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 6px ${color}60`,
        }}
      >
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 7, color: "rgba(0,255,156,0.3)", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}
