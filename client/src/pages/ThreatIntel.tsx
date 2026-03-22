import React, { useState, useEffect, useRef, useCallback } from "react";
import AppShell from "@/components/AppShell";
import {
  Shield,
  Radar,
  AlertTriangle,
  Search,
  Activity,
  Bug,
  Link,
  Database,
  ChevronDown,
  ChevronUp,
  Key,
  Crosshair,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Globe,
  Server,
  Zap,
  BarChart3,
  Hash,
  Mail,
  FileText,
} from "lucide-react";

// ─── Design Tokens ──────────────────────────────────────────────────
const CYAN = "#00FF9C";
const BLUE = "#00B4FF";
const MAGENTA = "#FF2D78";
const YELLOW = "#FFD93D";
const BG = "#050508";
const BORDER = "rgba(0,255,156,0.15)";
const FONT = "'JetBrains Mono', monospace";

// ─── Types ──────────────────────────────────────────────────────────
type IOCType = "Auto-detect" | "IPv4" | "IPv6" | "Domain" | "URL" | "MD5" | "SHA1" | "SHA256" | "Email";
type Verdict = "CLEAN" | "SUSPICIOUS" | "MALICIOUS";

interface APISource {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  enabled: boolean;
  connected: boolean;
  requestsToday: number;
  rateLimit: number;
  lastQuery: string;
}

interface SourceResult {
  source: string;
  status: Verdict;
  confidence: number;
  details: string;
}

interface AnalysisResult {
  ioc: string;
  type: string;
  threatScore: number;
  sources: SourceResult[];
  detectionRatio: string;
  tags: string[];
  timestamp: string;
}

interface RecentLookup {
  id: number;
  ioc: string;
  type: string;
  verdict: Verdict;
  timestamp: string;
}

interface ThreatFeedEntry {
  id: number;
  threatType: string;
  ioc: string;
  source: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp: string;
}

interface WhoisData {
  asn: string;
  organization: string;
  country: string;
  city: string;
  isp: string;
  abuseContact: string;
  networkRange: string;
  flag: string;
}

// ─── Helpers ────────────────────────────────────────────────────────
let _id = 100;
function nextId() { return ++_id; }

function now24() {
  const d = new Date();
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectType(value: string): string {
  if (/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(value)) return "IPv4";
  if (/^[0-9a-fA-F:]{3,}$/.test(value) && value.includes(":")) return "IPv6";
  if (/^[a-f0-9]{32}$/i.test(value)) return "MD5";
  if (/^[a-f0-9]{40}$/i.test(value)) return "SHA1";
  if (/^[a-f0-9]{64}$/i.test(value)) return "SHA256";
  if (/^https?:\/\//i.test(value)) return "URL";
  if (/@/.test(value)) return "Email";
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return "Domain";
  return "Unknown";
}

function verdictColor(v: Verdict): string {
  switch (v) {
    case "CLEAN": return CYAN;
    case "SUSPICIOUS": return YELLOW;
    case "MALICIOUS": return MAGENTA;
  }
}

function severityColor(s: string): string {
  switch (s) {
    case "CRITICAL": return MAGENTA;
    case "HIGH": return "#FF6B35";
    case "MEDIUM": return YELLOW;
    case "LOW": return BLUE;
    default: return CYAN;
  }
}

function scoreColor(score: number): string {
  if (score <= 25) return CYAN;
  if (score <= 50) return YELLOW;
  if (score <= 75) return "#FF6B35";
  return MAGENTA;
}

function generateFakeResults(ioc: string, type: string, enabledSources: string[]): AnalysisResult {
  const isKnownBad = ioc.includes("evil") || ioc.includes("185.220") || ioc.includes("45.33.32");
  const isKnownGood = ioc === "8.8.8.8" || ioc === "d41d8cd98f00b204e9800998ecf8427e";

  const sources: SourceResult[] = enabledSources.map(src => {
    let status: Verdict;
    let confidence: number;
    let details: string;

    if (isKnownGood) {
      status = Math.random() < 0.9 ? "CLEAN" : "SUSPICIOUS";
      confidence = Math.floor(Math.random() * 15) + 85;
      details = randomItem(["No detections", "Benign", "Whitelisted", "Known safe service", "No reports"]);
    } else if (isKnownBad) {
      status = Math.random() < 0.75 ? "MALICIOUS" : "SUSPICIOUS";
      confidence = Math.floor(Math.random() * 20) + 75;
      details = randomItem([
        "Known C2 server", "Tor exit node", "Malware distribution", "Phishing infrastructure",
        "Associated with APT group", "Botnet controller", "Port scanning activity"
      ]);
    } else {
      const roll = Math.random();
      status = roll < 0.4 ? "CLEAN" : roll < 0.7 ? "SUSPICIOUS" : "MALICIOUS";
      confidence = Math.floor(Math.random() * 40) + 55;
      details = randomItem([
        "Low reputation score", "Recently registered domain", "Open ports detected",
        "No significant findings", "Limited data available", "Flagged by community",
        "Suspicious network behavior", "Seen in honeypot logs"
      ]);
    }

    return { source: src, status, confidence, details };
  });

  const malCount = sources.filter(s => s.status === "MALICIOUS").length;
  const suspCount = sources.filter(s => s.status === "SUSPICIOUS").length;
  const flagged = malCount + suspCount;

  let threatScore: number;
  if (isKnownGood) threatScore = Math.floor(Math.random() * 10) + 2;
  else if (isKnownBad) threatScore = Math.floor(Math.random() * 15) + 80;
  else threatScore = Math.floor(Math.random() * 60) + 20;

  const allTags = ["malware", "phishing", "botnet", "c2", "spam", "tor-exit", "scanner", "brute-force", "exploit", "ransomware", "trojan", "apt"];
  const tags: string[] = [];
  if (isKnownBad) {
    const count = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < count; i++) {
      const t = randomItem(allTags);
      if (!tags.includes(t)) tags.push(t);
    }
  } else if (!isKnownGood) {
    if (Math.random() > 0.4) tags.push(randomItem(allTags));
  }

  return {
    ioc,
    type,
    threatScore,
    sources,
    detectionRatio: `${flagged}/${sources.length} engines flagged`,
    tags,
    timestamp: now24(),
  };
}

function generateWhois(ioc: string): WhoisData | null {
  const type = detectType(ioc);
  if (type !== "IPv4" && type !== "IPv6") return null;

  const data: Record<string, WhoisData> = {
    "45.33.32.156": { asn: "AS63949", organization: "Linode LLC", country: "United States", city: "Fremont, CA", isp: "Linode", abuseContact: "abuse@linode.com", networkRange: "45.33.32.0/20", flag: "🇺🇸" },
    "8.8.8.8": { asn: "AS15169", organization: "Google LLC", country: "United States", city: "Mountain View, CA", isp: "Google LLC", abuseContact: "abuse@google.com", networkRange: "8.8.8.0/24", flag: "🇺🇸" },
    "185.220.101.34": { asn: "AS205100", organization: "F3 Netze e.V.", country: "Germany", city: "Frankfurt", isp: "F3 Netze", abuseContact: "abuse@f3netze.de", networkRange: "185.220.101.0/24", flag: "🇩🇪" },
  };

  if (data[ioc]) return data[ioc];

  return {
    asn: `AS${Math.floor(Math.random() * 60000) + 1000}`,
    organization: randomItem(["CloudFlare Inc", "DigitalOcean LLC", "OVH SAS", "Hetzner Online GmbH", "Amazon AWS"]),
    country: randomItem(["United States", "Netherlands", "Germany", "Russia", "China"]),
    city: randomItem(["New York", "Amsterdam", "Frankfurt", "Moscow", "Shanghai"]),
    isp: randomItem(["CloudFlare", "DigitalOcean", "OVH", "Hetzner", "AWS"]),
    abuseContact: "abuse@provider.net",
    networkRange: ioc.replace(/\.\d+$/, ".0/24"),
    flag: randomItem(["🇺🇸", "🇳🇱", "🇩🇪", "🇷🇺", "🇨🇳"]),
  };
}

// ─── Constants ──────────────────────────────────────────────────────
const IOC_TYPES: IOCType[] = ["Auto-detect", "IPv4", "IPv6", "Domain", "URL", "MD5", "SHA1", "SHA256", "Email"];

const SAMPLE_IOCS = [
  { value: "45.33.32.156", label: "nmap.org scanner" },
  { value: "8.8.8.8", label: "Google DNS" },
  { value: "d41d8cd98f00b204e9800998ecf8427e", label: "empty MD5" },
  { value: "evil-phishing-site.ru", label: "phishing domain" },
  { value: "185.220.101.34", label: "TOR exit node" },
];

const INITIAL_LOOKUPS: RecentLookup[] = [
  { id: 1, ioc: "45.33.32.156", type: "IPv4", verdict: "MALICIOUS", timestamp: "22:31:04" },
  { id: 2, ioc: "google.com", type: "Domain", verdict: "CLEAN", timestamp: "22:28:17" },
  { id: 3, ioc: "185.220.101.34", type: "IPv4", verdict: "MALICIOUS", timestamp: "22:25:42" },
  { id: 4, ioc: "8.8.8.8", type: "IPv4", verdict: "CLEAN", timestamp: "22:22:09" },
  { id: 5, ioc: "evil-phishing-site.ru", type: "Domain", verdict: "MALICIOUS", timestamp: "22:18:33" },
  { id: 6, ioc: "d41d8cd98f00b204e9800998ecf8427e", type: "MD5", verdict: "CLEAN", timestamp: "22:15:01" },
  { id: 7, ioc: "91.240.118.172", type: "IPv4", verdict: "SUSPICIOUS", timestamp: "22:10:55" },
  { id: 8, ioc: "malware-dropper.xyz", type: "Domain", verdict: "MALICIOUS", timestamp: "22:07:22" },
  { id: 9, ioc: "https://legit-bank-login.tk/auth", type: "URL", verdict: "MALICIOUS", timestamp: "22:03:48" },
  { id: 10, ioc: "1.1.1.1", type: "IPv4", verdict: "CLEAN", timestamp: "21:59:14" },
];

const THREAT_FEED_TYPES = [
  "Malware C2 beacon",
  "Phishing campaign",
  "Brute force attack",
  "DDoS amplification",
  "Ransomware payload",
  "Credential leak",
  "Exploit kit delivery",
  "Cryptominer injection",
  "Backdoor communication",
  "Data exfiltration",
];

const FEED_SOURCES = ["AlienVault OTX", "ThreatFox", "URLhaus", "MalwareBazaar", "AbuseIPDB", "GreyNoise", "Shodan"];

const FEED_IOCS = [
  "103.237.147.52", "77.247.181.163", "198.98.51.189", "23.129.64.130",
  "162.247.74.7", "176.10.99.200", "209.141.33.97", "185.100.87.41",
  "evil-malware.xyz", "phish-bank.tk", "c2-beacon.onion.ly", "exploit-kit.cc",
  "dropper.evil.ru", "ransomware-pay.biz", "stealer-panel.top",
];

// ─── Panel Styles ───────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  background: "rgba(0,255,156,0.02)",
  border: `1px solid ${BORDER}`,
  borderRadius: 2,
  fontFamily: FONT,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderBottom: `1px solid ${BORDER}`,
  color: CYAN,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  fontFamily: FONT,
};

// ─── Main Component ─────────────────────────────────────────────────
export default function ThreatIntel() {
  // API Sources state
  const [apiSources, setApiSources] = useState<APISource[]>([
    { id: "virustotal", name: "VirusTotal", icon: Shield, enabled: true, connected: true, requestsToday: 147, rateLimit: 353, lastQuery: "22:48:31" },
    { id: "alienvault", name: "AlienVault OTX", icon: Radar, enabled: true, connected: true, requestsToday: 89, rateLimit: 911, lastQuery: "22:48:31" },
    { id: "abuseipdb", name: "AbuseIPDB", icon: AlertTriangle, enabled: true, connected: true, requestsToday: 63, rateLimit: 437, lastQuery: "22:47:55" },
    { id: "shodan", name: "Shodan", icon: Search, enabled: false, connected: false, requestsToday: 0, rateLimit: 100, lastQuery: "—" },
    { id: "greynoise", name: "GreyNoise", icon: Activity, enabled: true, connected: true, requestsToday: 41, rateLimit: 459, lastQuery: "22:46:12" },
    { id: "threatfox", name: "ThreatFox", icon: Bug, enabled: true, connected: true, requestsToday: 52, rateLimit: 948, lastQuery: "22:45:08" },
    { id: "urlhaus", name: "URLhaus", icon: Link, enabled: false, connected: true, requestsToday: 28, rateLimit: 972, lastQuery: "22:40:33" },
    { id: "malwarebazaar", name: "MalwareBazaar", icon: Database, enabled: true, connected: true, requestsToday: 37, rateLimit: 463, lastQuery: "22:44:21" },
  ]);

  // Search state
  const [searchValue, setSearchValue] = useState("");
  const [selectedType, setSelectedType] = useState<IOCType>("Auto-detect");
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    virustotal: "vt_*********************a7f2",
    alienvault: "otx_*********************3b8e",
    abuseipdb: "aip_*********************9d12",
    shodan: "",
    greynoise: "gn_*********************5c44",
    threatfox: "tf_*********************7e91",
    urlhaus: "uh_*********************2a06",
    malwarebazaar: "mb_*********************8f33",
  });

  // Results state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [whoisData, setWhoisData] = useState<WhoisData | null>(null);

  // Lookups and feeds
  const [recentLookups, setRecentLookups] = useState<RecentLookup[]>(INITIAL_LOOKUPS);
  const [threatFeed, setThreatFeed] = useState<ThreatFeedEntry[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Stats
  const [stats, setStats] = useState({
    totalLookups: 247,
    malicious: 89,
    clean: 112,
    suspicious: 46,
    commonThreat: "Phishing",
  });

  // ─── Threat Feed Auto-populate ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const entry: ThreatFeedEntry = {
        id: nextId(),
        threatType: randomItem(THREAT_FEED_TYPES),
        ioc: randomItem(FEED_IOCS),
        source: randomItem(FEED_SOURCES),
        severity: randomItem(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
        timestamp: now24(),
      };
      setThreatFeed(prev => [entry, ...prev].slice(0, 50));
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, []);

  // Seed initial feed
  useEffect(() => {
    const initial: ThreatFeedEntry[] = [];
    for (let i = 0; i < 6; i++) {
      initial.push({
        id: nextId(),
        threatType: randomItem(THREAT_FEED_TYPES),
        ioc: randomItem(FEED_IOCS),
        source: randomItem(FEED_SOURCES),
        severity: randomItem(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
        timestamp: now24(),
      });
    }
    setThreatFeed(initial);
  }, []);

  // ─── Toggle API Source ──────────────────────────────────────────
  const toggleSource = useCallback((id: string) => {
    setApiSources(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }, []);

  // ─── Analyze ────────────────────────────────────────────────────
  const handleAnalyze = useCallback((overrideValue?: string) => {
    const ioc = (overrideValue || searchValue).trim();
    if (!ioc) return;

    setIsAnalyzing(true);
    const type = selectedType === "Auto-detect" ? detectType(ioc) : selectedType;
    const enabledNames = apiSources.filter(s => s.enabled && s.connected).map(s => s.name);

    setTimeout(() => {
      const result = generateFakeResults(ioc, type, enabledNames);
      setAnalysisResult(result);
      setWhoisData(generateWhois(ioc));
      setIsAnalyzing(false);

      // Update recent lookups
      const overallVerdict: Verdict = result.threatScore > 65 ? "MALICIOUS" : result.threatScore > 30 ? "SUSPICIOUS" : "CLEAN";
      setRecentLookups(prev => [{
        id: nextId(),
        ioc,
        type,
        verdict: overallVerdict,
        timestamp: now24(),
      }, ...prev].slice(0, 20));

      // Update stats
      setStats(prev => ({
        ...prev,
        totalLookups: prev.totalLookups + 1,
        malicious: prev.malicious + (overallVerdict === "MALICIOUS" ? 1 : 0),
        clean: prev.clean + (overallVerdict === "CLEAN" ? 1 : 0),
        suspicious: prev.suspicious + (overallVerdict === "SUSPICIOUS" ? 1 : 0),
      }));

      // Update API source stats
      setApiSources(prev => prev.map(s => {
        if (s.enabled && s.connected) {
          return { ...s, requestsToday: s.requestsToday + 1, rateLimit: Math.max(0, s.rateLimit - 1), lastQuery: now24() };
        }
        return s;
      }));
    }, 1200 + Math.random() * 800);
  }, [searchValue, selectedType, apiSources]);

  const handleSampleClick = useCallback((value: string) => {
    setSearchValue(value);
    setSelectedType("Auto-detect");
    // Small delay so state updates before analyze
    setTimeout(() => {
      setIsAnalyzing(true);
      const type = detectType(value);
      const enabledNames = apiSources.filter(s => s.enabled && s.connected).map(s => s.name);

      setTimeout(() => {
        const result = generateFakeResults(value, type, enabledNames);
        setAnalysisResult(result);
        setWhoisData(generateWhois(value));
        setIsAnalyzing(false);

        const overallVerdict: Verdict = result.threatScore > 65 ? "MALICIOUS" : result.threatScore > 30 ? "SUSPICIOUS" : "CLEAN";
        setRecentLookups(prev => [{
          id: nextId(),
          ioc: value,
          type,
          verdict: overallVerdict,
          timestamp: now24(),
        }, ...prev].slice(0, 20));

        setStats(prev => ({
          ...prev,
          totalLookups: prev.totalLookups + 1,
          malicious: prev.malicious + (overallVerdict === "MALICIOUS" ? 1 : 0),
          clean: prev.clean + (overallVerdict === "CLEAN" ? 1 : 0),
          suspicious: prev.suspicious + (overallVerdict === "SUSPICIOUS" ? 1 : 0),
        }));

        setApiSources(prev => prev.map(s => {
          if (s.enabled && s.connected) {
            return { ...s, requestsToday: s.requestsToday + 1, rateLimit: Math.max(0, s.rateLimit - 1), lastQuery: now24() };
          }
          return s;
        }));
      }, 1200 + Math.random() * 800);
    }, 50);
  }, [apiSources]);

  // ─── Pie Chart (CSS only) ──────────────────────────────────────
  const total = stats.malicious + stats.clean + stats.suspicious;
  const malPct = Math.round((stats.malicious / total) * 100);
  const cleanPct = Math.round((stats.clean / total) * 100);
  const suspPct = 100 - malPct - cleanPct;

  return (
    <AppShell>
      <div style={{
        height: "100%",
        overflow: "auto",
        padding: 16,
        fontFamily: FONT,
        color: CYAN,
        background: BG,
      }}>
        {/* ═══════════ TOP: IOC SCANNER ═══════════ */}
        <div className="terminal-panel" style={{ ...panelStyle, marginBottom: 16 }}>
          <div className="panel-header" style={panelHeaderStyle}>
            <Crosshair size={14} />
            IOC SCANNER
            <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(0,255,156,0.4)", fontWeight: 400 }}>
              THREAT INTELLIGENCE ANALYSIS ENGINE
            </span>
          </div>

          <div style={{ padding: 16 }}>
            {/* Search Row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input
                type="text"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                placeholder="Enter IP, domain, hash, URL, or email..."
                style={{
                  flex: 1,
                  background: "rgba(0,255,156,0.04)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 2,
                  padding: "12px 14px",
                  color: CYAN,
                  fontFamily: FONT,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value as IOCType)}
                style={{
                  background: "rgba(0,255,156,0.04)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 2,
                  padding: "8px 12px",
                  color: CYAN,
                  fontFamily: FONT,
                  fontSize: 11,
                  cursor: "pointer",
                  minWidth: 130,
                }}
              >
                {IOC_TYPES.map(t => (
                  <option key={t} value={t} style={{ background: "#0a0a12", color: CYAN }}>{t}</option>
                ))}
              </select>
            </div>

            {/* Sample IOCs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "rgba(0,255,156,0.4)", alignSelf: "center", marginRight: 4 }}>SAMPLES:</span>
              {SAMPLE_IOCS.map(s => (
                <button
                  key={s.value}
                  onClick={() => handleSampleClick(s.value)}
                  style={{
                    background: "rgba(0,255,156,0.05)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 2,
                    padding: "4px 10px",
                    color: BLUE,
                    fontFamily: FONT,
                    fontSize: 10,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.borderColor = CYAN;
                    (e.target as HTMLElement).style.boxShadow = `0 0 8px rgba(0,255,156,0.2)`;
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.borderColor = BORDER;
                    (e.target as HTMLElement).style.boxShadow = "none";
                  }}
                  title={s.label}
                >
                  {s.value.length > 24 ? s.value.slice(0, 24) + "…" : s.value}
                </button>
              ))}
            </div>

            {/* API Source Toggles */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: "rgba(0,255,156,0.4)", marginBottom: 8, letterSpacing: "0.1em" }}>
                API SOURCES
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {apiSources.map(src => {
                  const Icon = src.icon;
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: src.enabled ? "rgba(0,255,156,0.08)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${src.enabled ? "rgba(0,255,156,0.3)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 2,
                        padding: "6px 12px",
                        color: src.enabled ? CYAN : "rgba(255,255,255,0.3)",
                        fontFamily: FONT,
                        fontSize: 10,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => {
                        (e.target as HTMLElement).style.boxShadow = `0 0 10px rgba(0,255,156,0.15)`;
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      <Icon size={12} />
                      {src.name}
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: src.connected ? (src.enabled ? CYAN : "rgba(0,255,156,0.3)") : MAGENTA,
                        display: "inline-block",
                        marginLeft: 2,
                        boxShadow: src.connected && src.enabled ? `0 0 6px ${CYAN}` : "none",
                      }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Keys Section */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setShowApiKeys(!showApiKeys)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  color: "rgba(0,255,156,0.5)",
                  fontFamily: FONT,
                  fontSize: 10,
                  cursor: "pointer",
                  padding: 0,
                  letterSpacing: "0.05em",
                }}
              >
                <Key size={11} />
                API KEY CONFIGURATION
                {showApiKeys ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {showApiKeys && (
                <div style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 2,
                  padding: 12,
                }}>
                  {apiSources.map(src => (
                    <div key={src.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: 9, color: "rgba(0,255,156,0.5)", minWidth: 100, textTransform: "uppercase" }}>
                        {src.name}
                      </label>
                      <input
                        type="password"
                        value={apiKeys[src.id] || ""}
                        onChange={e => setApiKeys(prev => ({ ...prev, [src.id]: e.target.value }))}
                        placeholder="Enter API key..."
                        style={{
                          flex: 1,
                          background: "rgba(0,255,156,0.03)",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 2,
                          padding: "4px 8px",
                          color: CYAN,
                          fontFamily: FONT,
                          fontSize: 10,
                          outline: "none",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ANALYZE Button */}
            <button
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing || !searchValue.trim()}
              style={{
                width: "100%",
                padding: "14px 20px",
                background: isAnalyzing
                  ? "rgba(0,255,156,0.05)"
                  : !searchValue.trim()
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,255,156,0.12)",
                border: `1px solid ${isAnalyzing ? YELLOW : !searchValue.trim() ? "rgba(255,255,255,0.08)" : CYAN}`,
                borderRadius: 2,
                color: isAnalyzing ? YELLOW : !searchValue.trim() ? "rgba(255,255,255,0.2)" : CYAN,
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.2em",
                cursor: isAnalyzing || !searchValue.trim() ? "not-allowed" : "pointer",
                transition: "all 0.3s",
                textTransform: "uppercase" as const,
              }}
              onMouseEnter={e => {
                if (!isAnalyzing && searchValue.trim()) {
                  (e.target as HTMLElement).style.boxShadow = `0 0 20px rgba(0,255,156,0.3), inset 0 0 20px rgba(0,255,156,0.05)`;
                }
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.boxShadow = "none";
              }}
            >
              {isAnalyzing ? "⟳ ANALYZING..." : "▶ ANALYZE"}
            </button>
          </div>
        </div>

        {/* ═══════════ RESULTS PANEL ═══════════ */}
        {(analysisResult || isAnalyzing) && (
          <div className="terminal-panel" style={{ ...panelStyle, marginBottom: 16 }}>
            <div className="panel-header" style={panelHeaderStyle}>
              <Eye size={14} />
              ANALYSIS RESULTS
              {analysisResult && (
                <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(0,255,156,0.4)", fontWeight: 400 }}>
                  {analysisResult.ioc} · {analysisResult.type} · {analysisResult.timestamp}
                </span>
              )}
            </div>

            {isAnalyzing ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: YELLOW, marginBottom: 8 }}>
                  ⟳ Querying {apiSources.filter(s => s.enabled && s.connected).length} intelligence sources...
                </div>
                <div style={{ fontSize: 10, color: "rgba(0,255,156,0.3)" }}>
                  {apiSources.filter(s => s.enabled && s.connected).map(s => s.name).join(" · ")}
                </div>
                {/* Scan animation bar */}
                <div style={{
                  marginTop: 16,
                  height: 2,
                  background: "rgba(0,255,156,0.1)",
                  borderRadius: 1,
                  overflow: "hidden",
                  position: "relative",
                }}>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: "30%",
                    background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
                    animation: "scanMove 1.2s ease-in-out infinite",
                  }} />
                </div>
                <style>{`@keyframes scanMove { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
              </div>
            ) : analysisResult && (
              <div style={{ padding: 16 }}>
                {/* Threat Score */}
                <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      fontSize: 48,
                      fontWeight: 700,
                      color: scoreColor(analysisResult.threatScore),
                      lineHeight: 1,
                      textShadow: `0 0 20px ${scoreColor(analysisResult.threatScore)}40`,
                    }}>
                      {analysisResult.threatScore}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(0,255,156,0.4)", marginTop: 4, letterSpacing: "0.1em" }}>
                      THREAT SCORE
                    </div>
                  </div>

                  {/* Score bar */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: 8,
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 1,
                      overflow: "hidden",
                      position: "relative",
                    }}>
                      <div style={{
                        width: `${analysisResult.threatScore}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${CYAN}, ${YELLOW}, ${MAGENTA})`,
                        borderRadius: 1,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 8, color: "rgba(0,255,156,0.3)" }}>
                      <span>SAFE</span>
                      <span>SUSPICIOUS</span>
                      <span>MALICIOUS</span>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: BLUE, fontWeight: 600 }}>
                      {analysisResult.detectionRatio}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(0,255,156,0.4)", marginTop: 2 }}>DETECTION RATIO</div>
                  </div>
                </div>

                {/* Tags */}
                {analysisResult.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                    {analysisResult.tags.map((tag, i) => (
                      <span key={i} style={{
                        padding: "3px 10px",
                        background: "rgba(255,45,120,0.1)",
                        border: `1px solid rgba(255,45,120,0.3)`,
                        borderRadius: 2,
                        color: MAGENTA,
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.05em",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Per-source results table */}
                <div style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 2,
                  overflow: "hidden",
                }}>
                  {/* Table header */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "160px 110px 90px 1fr",
                    padding: "8px 12px",
                    background: "rgba(0,255,156,0.04)",
                    borderBottom: `1px solid ${BORDER}`,
                    fontSize: 9,
                    color: "rgba(0,255,156,0.5)",
                    letterSpacing: "0.1em",
                    fontWeight: 600,
                  }}>
                    <span>SOURCE</span>
                    <span>STATUS</span>
                    <span>CONFIDENCE</span>
                    <span>DETAILS</span>
                  </div>
                  {/* Table rows */}
                  {analysisResult.sources.map((src, i) => (
                    <div key={i} style={{
                      display: "grid",
                      gridTemplateColumns: "160px 110px 90px 1fr",
                      padding: "7px 12px",
                      borderBottom: i < analysisResult.sources.length - 1 ? `1px solid rgba(0,255,156,0.06)` : "none",
                      fontSize: 11,
                      alignItems: "center",
                    }}>
                      <span style={{ color: BLUE }}>{src.source}</span>
                      <span style={{
                        color: verdictColor(src.status),
                        fontWeight: 600,
                        fontSize: 10,
                      }}>
                        ● {src.status}
                      </span>
                      <span style={{ color: "rgba(0,255,156,0.6)" }}>{src.confidence}%</span>
                      <span style={{ color: "rgba(0,255,156,0.4)", fontSize: 10 }}>{src.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ BOTTOM SECTION (2 columns) ═══════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* ─── LEFT COLUMN ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* RECENT LOOKUPS */}
            <div className="terminal-panel" style={panelStyle}>
              <div className="panel-header" style={panelHeaderStyle}>
                <Clock size={14} />
                RECENT LOOKUPS
                <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(0,255,156,0.3)", fontWeight: 400 }}>
                  {recentLookups.length} entries
                </span>
              </div>
              <div style={{ maxHeight: 280, overflow: "auto", padding: "4px 0" }}>
                {recentLookups.map(lookup => (
                  <div
                    key={lookup.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 14px",
                      borderBottom: "1px solid rgba(0,255,156,0.04)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(0,255,156,0.04)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                    onClick={() => handleSampleClick(lookup.ioc)}
                  >
                    <span style={{
                      fontSize: 11,
                      color: CYAN,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {lookup.ioc}
                    </span>
                    <span style={{
                      fontSize: 8,
                      padding: "2px 6px",
                      background: "rgba(0,180,255,0.1)",
                      border: "1px solid rgba(0,180,255,0.2)",
                      borderRadius: 2,
                      color: BLUE,
                      fontWeight: 600,
                    }}>
                      {lookup.type}
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: verdictColor(lookup.verdict),
                      minWidth: 80,
                      textAlign: "right",
                    }}>
                      {lookup.verdict}
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(0,255,156,0.25)", minWidth: 60, textAlign: "right" }}>
                      {lookup.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* THREAT FEEDS */}
            <div className="terminal-panel" style={panelStyle}>
              <div className="panel-header" style={panelHeaderStyle}>
                <Zap size={14} />
                THREAT FEEDS
                <span style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 9,
                  fontWeight: 400,
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: CYAN,
                    display: "inline-block",
                    animation: "pulse 2s infinite",
                    boxShadow: `0 0 6px ${CYAN}`,
                  }} />
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
                  <span style={{ color: "rgba(0,255,156,0.4)" }}>LIVE</span>
                </span>
              </div>
              <div ref={feedRef} style={{ maxHeight: 280, overflow: "auto", padding: "4px 0" }}>
                {threatFeed.map(entry => (
                  <div key={entry.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 14px",
                    borderBottom: "1px solid rgba(0,255,156,0.04)",
                    fontSize: 10,
                  }}>
                    <span style={{
                      fontSize: 7,
                      padding: "2px 5px",
                      background: `${severityColor(entry.severity)}15`,
                      border: `1px solid ${severityColor(entry.severity)}40`,
                      borderRadius: 2,
                      color: severityColor(entry.severity),
                      fontWeight: 700,
                      minWidth: 52,
                      textAlign: "center",
                    }}>
                      {entry.severity}
                    </span>
                    <span style={{ color: MAGENTA, fontWeight: 600, minWidth: 140 }}>
                      {entry.threatType}
                    </span>
                    <span style={{
                      color: CYAN,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {entry.ioc}
                    </span>
                    <span style={{ color: "rgba(0,180,255,0.5)", fontSize: 9 }}>
                      {entry.source}
                    </span>
                    <span style={{ color: "rgba(0,255,156,0.2)", fontSize: 9, minWidth: 55, textAlign: "right" }}>
                      {entry.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* API STATUS */}
            <div className="terminal-panel" style={panelStyle}>
              <div className="panel-header" style={panelHeaderStyle}>
                <Server size={14} />
                API STATUS
              </div>
              <div style={{ padding: "4px 0" }}>
                {apiSources.map(src => {
                  const Icon = src.icon;
                  return (
                    <div key={src.id} style={{
                      display: "grid",
                      gridTemplateColumns: "150px 60px 80px 80px 70px",
                      padding: "6px 14px",
                      borderBottom: "1px solid rgba(0,255,156,0.04)",
                      fontSize: 10,
                      alignItems: "center",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: CYAN }}>
                        <Icon size={11} />
                        {src.name}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: src.connected ? CYAN : MAGENTA,
                          boxShadow: src.connected ? `0 0 4px ${CYAN}` : `0 0 4px ${MAGENTA}`,
                          display: "inline-block",
                        }} />
                        <span style={{ color: src.connected ? CYAN : MAGENTA, fontSize: 9 }}>
                          {src.connected ? "UP" : "DOWN"}
                        </span>
                      </span>
                      <span style={{ color: "rgba(0,255,156,0.4)", fontSize: 9 }}>
                        {src.requestsToday} req
                      </span>
                      <span style={{ color: "rgba(0,180,255,0.5)", fontSize: 9 }}>
                        {src.rateLimit} left
                      </span>
                      <span style={{ color: "rgba(0,255,156,0.25)", fontSize: 9 }}>
                        {src.lastQuery}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* IOC STATISTICS */}
            <div className="terminal-panel" style={panelStyle}>
              <div className="panel-header" style={panelHeaderStyle}>
                <BarChart3 size={14} />
                IOC STATISTICS
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "rgba(0,255,156,0.04)", border: `1px solid ${BORDER}`, borderRadius: 2, padding: "10px 12px" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: CYAN }}>{stats.totalLookups}</div>
                    <div style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", letterSpacing: "0.1em" }}>TOTAL LOOKUPS</div>
                  </div>
                  <div style={{ background: "rgba(255,45,120,0.04)", border: "1px solid rgba(255,45,120,0.15)", borderRadius: 2, padding: "10px 12px" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: MAGENTA }}>{stats.malicious}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,45,120,0.5)", letterSpacing: "0.1em" }}>MALICIOUS</div>
                  </div>
                  <div style={{ background: "rgba(0,255,156,0.04)", border: `1px solid ${BORDER}`, borderRadius: 2, padding: "10px 12px" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: CYAN }}>{stats.clean}</div>
                    <div style={{ fontSize: 8, color: "rgba(0,255,156,0.4)", letterSpacing: "0.1em" }}>CLEAN</div>
                  </div>
                  <div style={{ background: "rgba(255,217,61,0.04)", border: "1px solid rgba(255,217,61,0.15)", borderRadius: 2, padding: "10px 12px" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: YELLOW }}>{stats.suspicious}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,217,61,0.5)", letterSpacing: "0.1em" }}>SUSPICIOUS</div>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: "rgba(0,255,156,0.4)", marginBottom: 6, letterSpacing: "0.05em" }}>
                    MOST COMMON: <span style={{ color: MAGENTA, fontWeight: 600 }}>{stats.commonThreat}</span>
                  </div>
                </div>

                {/* CSS-only pie chart */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: `conic-gradient(${MAGENTA} 0deg ${malPct * 3.6}deg, ${YELLOW} ${malPct * 3.6}deg ${(malPct + suspPct) * 3.6}deg, ${CYAN} ${(malPct + suspPct) * 3.6}deg 360deg)`,
                    position: "relative",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: BG,
                    }} />
                  </div>
                  <div style={{ fontSize: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, background: MAGENTA, borderRadius: 1, display: "inline-block" }} />
                      <span style={{ color: "rgba(0,255,156,0.5)" }}>Malicious {malPct}%</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, background: YELLOW, borderRadius: 1, display: "inline-block" }} />
                      <span style={{ color: "rgba(0,255,156,0.5)" }}>Suspicious {suspPct}%</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, background: CYAN, borderRadius: 1, display: "inline-block" }} />
                      <span style={{ color: "rgba(0,255,156,0.5)" }}>Clean {cleanPct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* WHOIS / GEO */}
            <div className="terminal-panel" style={panelStyle}>
              <div className="panel-header" style={panelHeaderStyle}>
                <Globe size={14} />
                WHOIS / GEO LOOKUP
              </div>
              <div style={{ padding: 14 }}>
                {whoisData ? (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 12px" }}>
                      {[
                        ["ASN", whoisData.asn],
                        ["Organization", whoisData.organization],
                        ["Country", `${whoisData.flag} ${whoisData.country}`],
                        ["City", whoisData.city],
                        ["ISP", whoisData.isp],
                        ["Abuse Contact", whoisData.abuseContact],
                        ["Network Range", whoisData.networkRange],
                      ].map(([label, value]) => (
                        <React.Fragment key={label}>
                          <span style={{ color: "rgba(0,255,156,0.4)", fontSize: 10 }}>{label}</span>
                          <span style={{ color: CYAN }}>{value}</span>
                        </React.Fragment>
                      ))}
                    </div>

                    <div style={{
                      marginTop: 14,
                      padding: "10px 12px",
                      background: "rgba(0,255,156,0.03)",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 2,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 32 }}>{whoisData.flag}</div>
                      <div style={{ fontSize: 12, color: CYAN, fontWeight: 600, marginTop: 4 }}>{whoisData.country}</div>
                      <div style={{ fontSize: 10, color: "rgba(0,255,156,0.4)" }}>{whoisData.city}</div>
                      <div style={{ fontSize: 9, color: "rgba(0,180,255,0.5)", marginTop: 4 }}>{whoisData.asn} · {whoisData.isp}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center",
                    padding: 30,
                    color: "rgba(0,255,156,0.2)",
                    fontSize: 11,
                  }}>
                    <Globe size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
                    <div>Analyze an IP address to view WHOIS data</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
