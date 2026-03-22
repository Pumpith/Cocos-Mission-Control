import { useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import {
  Search,
  Crosshair,
  Shield,
  Zap,
  Radio,
  Key,
  Wifi,
  HardDrive,
  Globe,
  Binary,
  Lock,
  ChevronRight,
  Activity,
  Terminal,
  Clock,
  Layers,
  Rocket,
  Scan,
  Network,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
type Category =
  | "ALL"
  | "RECON"
  | "VULN SCAN"
  | "EXPLOIT"
  | "SNIFF"
  | "PASSWORDS"
  | "WIRELESS"
  | "FORENSICS"
  | "WEB APPS"
  | "REVERSE"
  | "CRYPTO";

interface Tool {
  name: string;
  category: Category;
  description: string;
  power: number; // 1-5
  lastUsed: string;
}

interface LaunchEntry {
  tool: string;
  timestamp: string;
}

// ─── Category metadata ───────────────────────────────────────────────
const CATEGORIES: { label: Category; desc: string }[] = [
  { label: "ALL", desc: "All Tools" },
  { label: "RECON", desc: "Information Gathering" },
  { label: "VULN SCAN", desc: "Vulnerability Analysis" },
  { label: "EXPLOIT", desc: "Exploitation Tools" },
  { label: "SNIFF", desc: "Sniffing & Spoofing" },
  { label: "PASSWORDS", desc: "Password Attacks" },
  { label: "WIRELESS", desc: "Wireless Attacks" },
  { label: "FORENSICS", desc: "Digital Forensics" },
  { label: "WEB APPS", desc: "Web Application Analysis" },
  { label: "REVERSE", desc: "Reverse Engineering" },
  { label: "CRYPTO", desc: "Cryptography" },
];

const CATEGORY_COLORS: Record<Category, string> = {
  ALL: "#00FF9C",
  RECON: "#00B4FF",
  "VULN SCAN": "#FF2D78",
  EXPLOIT: "#FF2D78",
  SNIFF: "#00B4FF",
  PASSWORDS: "#FF2D78",
  WIRELESS: "#00B4FF",
  FORENSICS: "#00FF9C",
  "WEB APPS": "#FF2D78",
  REVERSE: "#00B4FF",
  CRYPTO: "#00FF9C",
};

// ─── Tool database ──────────────────────────────────────────────────
const TOOLS: Tool[] = [
  { name: "nmap", category: "RECON", description: "Network exploration & port scanning utility", power: 4, lastUsed: "2026-03-22 18:31" },
  { name: "masscan", category: "RECON", description: "Fastest Internet port scanner — async SYN scanning", power: 5, lastUsed: "2026-03-21 09:14" },
  { name: "amass", category: "RECON", description: "In-depth attack surface mapping & asset discovery", power: 4, lastUsed: "2026-03-20 22:47" },
  { name: "theharvester", category: "RECON", description: "Gathers emails, subdomains, IPs from public sources", power: 3, lastUsed: "2026-03-19 14:05" },
  { name: "recon-ng", category: "RECON", description: "Full-featured web reconnaissance framework", power: 4, lastUsed: "2026-03-18 11:30" },
  { name: "maltego", category: "RECON", description: "Interactive data mining & link analysis for OSINT", power: 5, lastUsed: "2026-03-17 08:22" },
  { name: "fierce", category: "RECON", description: "DNS reconnaissance tool for locating non-contiguous IP space", power: 3, lastUsed: "2026-03-16 16:44" },
  { name: "dnsenum", category: "RECON", description: "Enumerates DNS info & discovers non-contiguous IP blocks", power: 2, lastUsed: "2026-03-15 20:11" },
  { name: "whatweb", category: "RECON", description: "Web scanner that identifies websites & technologies", power: 2, lastUsed: "2026-03-22 07:58" },
  { name: "nikto", category: "VULN SCAN", description: "Web server scanner — tests for dangerous files & outdated software", power: 3, lastUsed: "2026-03-22 15:22" },
  { name: "openvas", category: "VULN SCAN", description: "Full-featured vulnerability scanner & manager", power: 5, lastUsed: "2026-03-21 03:45" },
  { name: "lynis", category: "VULN SCAN", description: "Security auditing tool for Unix/Linux systems", power: 3, lastUsed: "2026-03-20 19:33" },
  { name: "wapiti", category: "VULN SCAN", description: "Black-box web application vulnerability scanner", power: 3, lastUsed: "2026-03-19 10:17" },
  { name: "sqlmap", category: "EXPLOIT", description: "Automatic SQL injection & database takeover tool", power: 5, lastUsed: "2026-03-22 12:09" },
  { name: "metasploit", category: "EXPLOIT", description: "Advanced open-source penetration testing framework", power: 5, lastUsed: "2026-03-22 20:01" },
  { name: "netcat", category: "EXPLOIT", description: "TCP/UDP networking utility — the Swiss army knife", power: 3, lastUsed: "2026-03-21 17:38" },
  { name: "searchsploit", category: "EXPLOIT", description: "CLI search tool for Exploit-DB archive", power: 3, lastUsed: "2026-03-20 08:55" },
  { name: "beef-xss", category: "EXPLOIT", description: "Browser Exploitation Framework — client-side attack vectors", power: 4, lastUsed: "2026-03-19 23:12" },
  { name: "wireshark", category: "SNIFF", description: "Deep packet inspection & network protocol analyzer", power: 4, lastUsed: "2026-03-22 16:44" },
  { name: "tcpdump", category: "SNIFF", description: "Command-line packet analyzer for network traffic capture", power: 3, lastUsed: "2026-03-21 14:27" },
  { name: "responder", category: "SNIFF", description: "LLMNR/NBT-NS/mDNS poisoner & credential harvester", power: 5, lastUsed: "2026-03-20 21:06" },
  { name: "ettercap", category: "SNIFF", description: "Comprehensive suite for man-in-the-middle attacks", power: 4, lastUsed: "2026-03-19 18:39" },
  { name: "hydra", category: "PASSWORDS", description: "Fast & flexible online password brute-force tool", power: 4, lastUsed: "2026-03-22 10:33" },
  { name: "john", category: "PASSWORDS", description: "John the Ripper — high-speed offline password cracker", power: 4, lastUsed: "2026-03-21 22:15" },
  { name: "hashcat", category: "PASSWORDS", description: "World's fastest GPU-based password recovery utility", power: 5, lastUsed: "2026-03-20 13:48" },
  { name: "crackmapexec", category: "PASSWORDS", description: "Post-exploitation tool for large Active Directory networks", power: 5, lastUsed: "2026-03-19 07:21" },
  { name: "mimikatz", category: "PASSWORDS", description: "Extracts plaintext passwords, hashes, & Kerberos tickets from memory", power: 5, lastUsed: "2026-03-18 15:56" },
  { name: "aircrack-ng", category: "WIRELESS", description: "WiFi security auditing suite — WEP/WPA/WPA2 cracking", power: 5, lastUsed: "2026-03-22 02:19" },
  { name: "wifite", category: "WIRELESS", description: "Automated wireless attack tool targeting WEP/WPA/WPS", power: 4, lastUsed: "2026-03-21 05:42" },
  { name: "kismet", category: "WIRELESS", description: "Wireless network detector, sniffer, & IDS", power: 3, lastUsed: "2026-03-20 11:30" },
  { name: "volatility", category: "FORENSICS", description: "Advanced memory forensics framework for incident response", power: 4, lastUsed: "2026-03-22 06:17" },
  { name: "autopsy", category: "FORENSICS", description: "Digital forensics platform with GUI — disk image analysis", power: 4, lastUsed: "2026-03-21 19:53" },
  { name: "binwalk", category: "FORENSICS", description: "Firmware analysis tool — extracts embedded files & code", power: 3, lastUsed: "2026-03-20 15:26" },
  { name: "foremost", category: "FORENSICS", description: "File carving tool that recovers files based on headers & footers", power: 3, lastUsed: "2026-03-19 12:44" },
  { name: "burpsuite", category: "WEB APPS", description: "Integrated platform for web application security testing", power: 5, lastUsed: "2026-03-22 19:47" },
  { name: "gobuster", category: "WEB APPS", description: "Directory/file & DNS busting tool written in Go", power: 3, lastUsed: "2026-03-21 08:31" },
  { name: "dirb", category: "WEB APPS", description: "Web content scanner — finds existing objects via dictionary attack", power: 2, lastUsed: "2026-03-20 17:14" },
  { name: "wfuzz", category: "WEB APPS", description: "Web application fuzzer for brute-forcing parameters & paths", power: 3, lastUsed: "2026-03-19 21:58" },
  { name: "enum4linux", category: "WEB APPS", description: "Enumerates info from Windows & Samba systems", power: 3, lastUsed: "2026-03-18 14:07" },
  { name: "smbmap", category: "WEB APPS", description: "SMB share enumerator — checks permissions across drives", power: 3, lastUsed: "2026-03-17 10:35" },
  { name: "ghidra", category: "REVERSE", description: "NSA's software reverse engineering suite with decompiler", power: 5, lastUsed: "2026-03-22 04:22" },
  { name: "radare2", category: "REVERSE", description: "Advanced open-source reverse engineering framework & debugger", power: 5, lastUsed: "2026-03-21 12:09" },
  { name: "gdb", category: "REVERSE", description: "GNU Debugger — source-level debugging for compiled programs", power: 4, lastUsed: "2026-03-20 09:41" },
  { name: "objdump", category: "REVERSE", description: "Displays information from object files & disassembles binaries", power: 2, lastUsed: "2026-03-19 16:28" },
  { name: "hashid", category: "CRYPTO", description: "Identifies different types of hashes from input", power: 1, lastUsed: "2026-03-22 13:55" },
  { name: "hash-identifier", category: "CRYPTO", description: "Software to identify hash types from sample strings", power: 1, lastUsed: "2026-03-21 07:38" },
  { name: "sslscan", category: "CRYPTO", description: "Queries SSL/TLS services to determine supported ciphers", power: 2, lastUsed: "2026-03-20 20:12" },
  { name: "sslyze", category: "CRYPTO", description: "Fast & comprehensive SSL/TLS server configuration analyzer", power: 2, lastUsed: "2026-03-19 04:49" },
];

// ─── Helpers ────────────────────────────────────────────────────────
function nowTimestamp() {
  const d = new Date();
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Power level bar ────────────────────────────────────────────────
function PowerBar({ level }: { level: number }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 8 + i * 2,
            background: i <= level
              ? level >= 4
                ? "#FF2D78"
                : level >= 2
                  ? "#00B4FF"
                  : "#00FF9C"
              : "rgba(0,255,156,0.1)",
            boxShadow: i <= level
              ? level >= 4
                ? "0 0 4px rgba(255,45,120,0.5)"
                : "0 0 4px rgba(0,180,255,0.4)"
              : "none",
            transition: "all 0.2s",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────
export default function WeaponVault() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("ALL");
  const [launchLog, setLaunchLog] = useState<LaunchEntry[]>([]);

  const handleLaunch = useCallback((toolName: string) => {
    setLaunchLog((prev) => [
      { tool: toolName, timestamp: nowTimestamp() },
      ...prev.slice(0, 19), // keep last 20
    ]);
  }, []);

  // Filtering
  const filteredTools = TOOLS.filter((t) => {
    const matchesCategory = activeCategory === "ALL" || t.category === activeCategory;
    const matchesSearch =
      search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalCategories = new Set(TOOLS.map((t) => t.category)).size;
  const recentlyUsedCount = launchLog.length;

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
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          style={{
            padding: "12px 16px 8px",
            borderBottom: "1px solid rgba(0,255,156,0.15)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Crosshair size={16} color="#FF2D78" />
              <h1
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "#00FF9C",
                  margin: 0,
                  textShadow: "0 0 8px rgba(0,255,156,0.5)",
                }}
              >
                WEAPON VAULT // KALI ARSENAL
              </h1>
            </div>
            <div
              style={{
                position: "relative",
                flex: "0 1 340px",
              }}
            >
              <Search
                size={13}
                color="rgba(0,255,156,0.4)"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                placeholder="// SEARCH TOOLS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
          </div>

          {/* ── Category filters ─────────────────────────────── */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 10,
              overflowX: "auto",
              paddingBottom: 2,
              flexWrap: "nowrap",
            }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.label;
              const catColor = CATEGORY_COLORS[cat.label];
              return (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(cat.label)}
                  style={{
                    flexShrink: 0,
                    fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.1em",
                    padding: "4px 10px",
                    background: isActive ? `${catColor}12` : "transparent",
                    border: `1px solid ${isActive ? catColor : "rgba(0,255,156,0.12)"}`,
                    color: isActive ? catColor : "rgba(0,255,156,0.4)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textTransform: "uppercase",
                    borderRadius: 2,
                    boxShadow: isActive ? `0 0 8px ${catColor}30` : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main content ───────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
            gap: 1,
          }}
        >
          {/* ── Tool grid ─────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
            }}
          >
            {filteredTools.length === 0 ? (
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
                <AlertTriangle size={24} />
                <span>NO MATCHING WEAPONS FOUND</span>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 8,
                }}
              >
                {filteredTools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} onLaunch={handleLaunch} />
                ))}
              </div>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────── */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderLeft: "1px solid rgba(0,255,156,0.1)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            {/* TOOL STATS */}
            <div className="terminal-panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <Activity size={10} /> TOOL STATS
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                <StatRow icon={<Layers size={12} color="#00B4FF" />} label="TOTAL WEAPONS" value={TOOLS.length.toString()} />
                <StatRow icon={<Layers size={12} color="#FF2D78" />} label="CATEGORIES" value={totalCategories.toString()} />
                <StatRow icon={<Clock size={12} color="#00FF9C" />} label="RECENTLY LAUNCHED" value={recentlyUsedCount.toString()} />
                <StatRow icon={<Shield size={12} color="#FF2D78" />} label="HIGH POWER (4+)" value={TOOLS.filter((t) => t.power >= 4).length.toString()} />
              </div>
            </div>

            {/* RECENTLY LAUNCHED */}
            <div className="terminal-panel" style={{ margin: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div className="panel-header">
                <Terminal size={10} /> RECENTLY LAUNCHED
              </div>
              <div style={{ padding: "6px 0", flex: 1, overflowY: "auto" }}>
                {launchLog.length === 0 ? (
                  <div
                    style={{
                      padding: "16px 12px",
                      color: "rgba(0,255,156,0.2)",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      textAlign: "center",
                    }}
                  >
                    NO LAUNCHES YET — SELECT A TOOL
                  </div>
                ) : (
                  launchLog.map((entry, i) => (
                    <div
                      key={`${entry.tool}-${entry.timestamp}-${i}`}
                      className="log-entry"
                      style={{
                        padding: "5px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        borderBottom: "1px solid rgba(0,255,156,0.05)",
                        fontSize: 9,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ChevronRight size={8} color="#FF2D78" />
                        <span style={{ color: "#00FF9C", fontWeight: 600 }}>{entry.tool}</span>
                      </span>
                      <span style={{ color: "rgba(0,255,156,0.3)", fontSize: 8, fontVariantNumeric: "tabular-nums" }}>
                        {entry.timestamp}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="terminal-panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <Rocket size={10} /> QUICK ACTIONS
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <QuickActionButton
                  icon={<Scan size={11} />}
                  label="FULL SCAN"
                  color="#FF2D78"
                  onClick={() => handleLaunch("full-scan")}
                />
                <QuickActionButton
                  icon={<Network size={11} />}
                  label="PORT SWEEP"
                  color="#00B4FF"
                  onClick={() => handleLaunch("port-sweep")}
                />
                <QuickActionButton
                  icon={<AlertTriangle size={11} />}
                  label="VULN ASSESSMENT"
                  color="#00FF9C"
                  onClick={() => handleLaunch("vuln-assessment")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Tool Card ──────────────────────────────────────────────────────
function ToolCard({ tool, onLaunch }: { tool: Tool; onLaunch: (name: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const catColor = CATEGORY_COLORS[tool.category];

  return (
    <div
      className="terminal-panel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        cursor: "default",
        transition: "all 0.2s",
        borderColor: hovered ? `${catColor}50` : undefined,
        boxShadow: hovered ? `0 0 16px ${catColor}18, inset 0 0 16px ${catColor}05` : undefined,
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
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#00FF9C",
              letterSpacing: "0.08em",
              textShadow: hovered ? "0 0 8px rgba(0,255,156,0.5)" : "none",
            }}
          >
            {tool.name}
          </span>
          <span
            style={{
              fontSize: 7,
              letterSpacing: "0.12em",
              padding: "2px 6px",
              border: `1px solid ${catColor}40`,
              color: catColor,
              background: `${catColor}08`,
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {tool.category}
          </span>
        </div>
        <PowerBar level={tool.power} />
      </div>

      {/* Description */}
      <div
        style={{
          padding: "0 12px 8px",
          fontSize: 9,
          lineHeight: 1.5,
          color: "rgba(0,255,156,0.5)",
          letterSpacing: "0.04em",
          flex: 1,
        }}
      >
        {tool.description}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid rgba(0,255,156,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 8,
            color: "rgba(0,255,156,0.2)",
            letterSpacing: "0.06em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Clock size={8} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          {tool.lastUsed}
        </span>
        <button
          onClick={() => onLaunch(tool.name)}
          style={{
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.15em",
            padding: "3px 12px",
            background: hovered ? "rgba(255,45,120,0.12)" : "rgba(0,255,156,0.06)",
            border: `1px solid ${hovered ? "rgba(255,45,120,0.4)" : "rgba(0,255,156,0.2)"}`,
            color: hovered ? "#FF2D78" : "#00FF9C",
            cursor: "pointer",
            transition: "all 0.2s",
            textTransform: "uppercase",
            borderRadius: 2,
            boxShadow: hovered ? "0 0 8px rgba(255,45,120,0.2)" : "none",
          }}
        >
          LAUNCH
        </button>
      </div>
    </div>
  );
}

// ─── Stat row ───────────────────────────────────────────────────────
function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", letterSpacing: "0.08em" }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#00FF9C",
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 0 6px rgba(0,255,156,0.4)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Quick Action button ────────────────────────────────────────────
function QuickActionButton({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "8px 10px",
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        letterSpacing: "0.12em",
        color: hovered ? color : `${color}99`,
        background: hovered ? `${color}10` : "transparent",
        border: `1px solid ${hovered ? `${color}50` : `${color}20`}`,
        cursor: "pointer",
        transition: "all 0.2s",
        borderRadius: 2,
        textTransform: "uppercase",
        textAlign: "left",
        boxShadow: hovered ? `0 0 10px ${color}20` : "none",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
