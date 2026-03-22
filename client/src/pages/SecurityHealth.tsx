import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import {
  HeartPulse, Shield, Activity, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Server, Wifi, Lock, Eye, Cpu, HardDrive, Zap, Bug
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   SECURITY & HEALTH PAGE
   Comprehensive security audit, health checks, and OpenClaw
   doctor diagnostics.

   Inspired by builderz-labs/mission-control security-audit-panel:
   - Top-level posture score (0-100) with SVG gauge
   - 5 infrastructure scan categories (credentials, network,
     openclaw, runtime, os)
   - Individual check pass/fail/warn with severity levels
   - Health check system with periodic monitoring
   - OpenClaw doctor diagnostics

   MOCK DATA: All scan results and health checks below are
   simulated. On real deployment, fetch from:
   - GET /api/security-audit (security scan results)
   - GET /api/health (system health checks)
   - GET /api/doctor (OpenClaw doctor diagnostics)
   Replace MOCK_SCAN_CATEGORIES and MOCK_HEALTH_CHECKS with
   actual API responses.
   ────────────────────────────────────────────────────────────── */

interface ScanCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
  fix?: string;
}

interface ScanCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  score: number;
  checks: ScanCheck[];
}

interface HealthCheck {
  id: string;
  label: string;
  status: "healthy" | "degraded" | "down" | "checking";
  value?: string;
  lastCheck: Date;
}

/* MOCK DATA: Scan categories — replace with GET /api/security-audit */
const MOCK_SCAN_CATEGORIES: ScanCategory[] = [
  {
    id: "credentials",
    label: "CREDENTIALS & SECRETS",
    icon: Lock,
    score: 92,
    checks: [
      { id: "c1", label: "API keys not in source code", status: "pass", severity: "critical", detail: "No API keys found in tracked files" },
      { id: "c2", label: "SSH keys permissions", status: "pass", severity: "high", detail: "All SSH keys have 600 permissions" },
      { id: "c3", label: ".env file protection", status: "pass", severity: "high", detail: ".env is in .gitignore" },
      { id: "c4", label: "Token rotation policy", status: "warn", severity: "medium", detail: "Auth token last rotated 45 days ago", fix: "Rotate gateway auth token — run: openclaw token rotate" },
      { id: "c5", label: "Password strength", status: "pass", severity: "medium", detail: "All configured passwords meet minimum strength requirements" },
    ],
  },
  {
    id: "network",
    label: "NETWORK SECURITY",
    icon: Wifi,
    score: 85,
    checks: [
      { id: "n1", label: "UFW firewall active", status: "pass", severity: "critical", detail: "UFW is active with 64 rules" },
      { id: "n2", label: "Gateway bound to localhost", status: "warn", severity: "high", detail: "Gateway is listening on 0.0.0.0 — consider binding to 127.0.0.1", fix: "Set gateway.host to '127.0.0.1' in config to restrict to local connections only" },
      { id: "n3", label: "No unnecessary open ports", status: "pass", severity: "high", detail: "Only expected services detected on scan: ssh(22), http(80), gateway(18789)" },
      { id: "n4", label: "DNS leak protection", status: "pass", severity: "medium", detail: "DNS queries routing through local resolver" },
      { id: "n5", label: "TLS on gateway", status: "fail", severity: "medium", detail: "Gateway WebSocket is not using TLS encryption", fix: "Enable TLS in gateway config — set gateway.enableTLS to true and provide cert path" },
    ],
  },
  {
    id: "openclaw",
    label: "OPENCLAW DOCTOR",
    icon: Zap,
    score: 88,
    checks: [
      { id: "o1", label: "Gateway process running", status: "pass", severity: "critical", detail: "openclaw-gateway PID 1847 running for 4d 12h" },
      { id: "o2", label: "Config file valid", status: "pass", severity: "critical", detail: "config.yaml parsed successfully — no syntax errors" },
      { id: "o3", label: "Model provider reachable", status: "pass", severity: "high", detail: "LM Studio responding at http://127.0.0.1:1234/v1" },
      { id: "o4", label: "Memory database integrity", status: "pass", severity: "high", detail: "SQLite database integrity check passed" },
      { id: "o5", label: "Skill manifest up to date", status: "warn", severity: "medium", detail: "2 skills have newer versions available", fix: "Run: openclaw skills update" },
      { id: "o6", label: "Cron scheduler healthy", status: "pass", severity: "medium", detail: "5 cron jobs registered — 0 failed in last 24h" },
      { id: "o7", label: "Channel bridges connected", status: "pass", severity: "medium", detail: "4/5 configured channels connected (Discord disabled)" },
      { id: "o8", label: "Agent fleet status", status: "pass", severity: "low", detail: "6 agents registered — all responsive" },
    ],
  },
  {
    id: "runtime",
    label: "RUNTIME ENVIRONMENT",
    icon: Cpu,
    score: 95,
    checks: [
      { id: "r1", label: "Node.js version", status: "pass", severity: "high", detail: "Node.js v22.12.0 — supported version" },
      { id: "r2", label: "npm audit", status: "pass", severity: "high", detail: "0 vulnerabilities found in dependencies" },
      { id: "r3", label: "Disk space", status: "pass", severity: "medium", detail: "67% used (3400GB/5120GB) — sufficient headroom" },
      { id: "r4", label: "Memory usage", status: "pass", severity: "medium", detail: "21.4GB / 32GB — 67% utilized" },
      { id: "r5", label: "Process isolation", status: "pass", severity: "low", detail: "Running under dedicated 'openclaw' user account" },
    ],
  },
  {
    id: "os",
    label: "OS HARDENING",
    icon: Server,
    score: 82,
    checks: [
      { id: "s1", label: "macOS FileVault", status: "pass", severity: "critical", detail: "Full disk encryption enabled" },
      { id: "s2", label: "macOS Firewall", status: "pass", severity: "high", detail: "macOS application firewall enabled" },
      { id: "s3", label: "Automatic updates", status: "warn", severity: "medium", detail: "macOS auto-update is disabled", fix: "Consider enabling automatic security updates in System Settings" },
      { id: "s4", label: "SIP (System Integrity Protection)", status: "pass", severity: "critical", detail: "SIP is enabled" },
      { id: "s5", label: "Gatekeeper", status: "pass", severity: "high", detail: "Gatekeeper active — only App Store and identified developers" },
    ],
  },
];

/* MOCK DATA: Health checks — replace with GET /api/health */
const MOCK_HEALTH_CHECKS: HealthCheck[] = [
  { id: "h1", label: "OpenClaw Gateway", status: "healthy", value: "ws://localhost:18789 — connected", lastCheck: new Date() },
  { id: "h2", label: "LM Studio", status: "healthy", value: "http://127.0.0.1:1234 — 2 models loaded", lastCheck: new Date() },
  { id: "h3", label: "UFW Firewall", status: "healthy", value: "Active — 64 rules, 3291 blocked today", lastCheck: new Date() },
  { id: "h4", label: "Network (eth0)", status: "healthy", value: "192.168.1.50 — UP", lastCheck: new Date() },
  { id: "h5", label: "Network (wlan0)", status: "healthy", value: "192.168.1.105 — UP", lastCheck: new Date() },
  { id: "h6", label: "Network (tun0/VPN)", status: "degraded", value: "10.8.0.2 — connected (latency: 120ms)", lastCheck: new Date() },
  { id: "h7", label: "Disk I/O", status: "healthy", value: "Read: 45 MB/s — Write: 28 MB/s", lastCheck: new Date() },
  { id: "h8", label: "Memory", status: "healthy", value: "21.4 / 32 GB (67%)", lastCheck: new Date() },
  { id: "h9", label: "CPU", status: "healthy", value: "Apple M4 — 23% avg load", lastCheck: new Date() },
  { id: "h10", label: "SQLite Database", status: "healthy", value: "47 MB — last vacuum 6h ago", lastCheck: new Date() },
];

export default function SecurityHealth() {
  const [categories, setCategories] = useState(MOCK_SCAN_CATEGORIES);
  const [healthChecks, setHealthChecks] = useState(MOCK_HEALTH_CHECKS);
  const [expandedCats, setExpandedCats] = useState<string[]>(["openclaw"]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDoctorRunning, setIsDoctorRunning] = useState(false);
  const [tab, setTab] = useState<"audit" | "health" | "doctor">("audit");

  // Calculate blended posture score
  const postureScore = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);
  const postureLevel = postureScore >= 90 ? "HARDENED" : postureScore >= 75 ? "SECURE" : postureScore >= 60 ? "NEEDS ATTENTION" : "AT RISK";
  const postureColor = postureScore >= 90 ? "#00FF9C" : postureScore >= 75 ? "#00B4FF" : postureScore >= 60 ? "#FFB800" : "#FF2D78";

  const toggleCategory = (id: string) => {
    setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  /* MOCK DATA: Simulated scan — replace with actual API call
     POST /api/security-audit/scan */
  const runScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 3000);
  };

  /* MOCK DATA: Simulated doctor — replace with actual API call
     POST /api/doctor/run */
  const runDoctor = () => {
    setIsDoctorRunning(true);
    setTimeout(() => setIsDoctorRunning(false), 4000);
  };

  /* MOCK DATA: Simulate health check refresh */
  const refreshHealth = () => {
    setHealthChecks(prev => prev.map(h => ({ ...h, status: "checking" as const })));
    setTimeout(() => {
      setHealthChecks(MOCK_HEALTH_CHECKS.map(h => ({ ...h, lastCheck: new Date() })));
    }, 2000);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pass": case "healthy": return <CheckCircle size={12} style={{ color: "#00FF9C" }} />;
      case "warn": case "degraded": return <AlertTriangle size={12} style={{ color: "#FFB800" }} />;
      case "fail": case "down": return <XCircle size={12} style={{ color: "#FF2D78" }} />;
      case "checking": return <RefreshCw size={12} className="animate-spin" style={{ color: "#00B4FF" }} />;
      default: return <Activity size={12} style={{ color: "#94a3b8" }} />;
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "#FF2D78";
      case "high": return "#FF9C00";
      case "medium": return "#FFB800";
      case "low": return "#00B4FF";
      default: return "#94a3b8";
    }
  };

  return (
    <AppShell>
      <div className="flex-1 p-2 h-full overflow-hidden flex flex-col gap-2">
        {/* Header with tabs */}
        <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <HeartPulse size={14} style={{ color: "#00FF9C" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "#00FF9C" }}>
              SECURITY & HEALTH
            </span>
          </div>
          <div className="flex items-center gap-1">
            {(["audit", "health", "doctor"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1 text-[9px] tracking-wider transition-all"
                style={{
                  border: `1px solid ${tab === t ? "rgba(0,255,156,0.3)" : "rgba(0,255,156,0.08)"}`,
                  background: tab === t ? "rgba(0,255,156,0.06)" : "transparent",
                  color: tab === t ? "#00FF9C" : "rgba(0,255,156,0.4)",
                }}
                data-testid={`security-tab-${t}`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {/* ─── SECURITY AUDIT TAB ─── */}
          {tab === "audit" && (
            <>
              {/* Posture Score */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4" style={{ border: "1px solid rgba(0,255,156,0.1)", background: "rgba(0,0,0,0.3)" }}>
                {/* SVG Gauge */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,255,156,0.08)" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={postureColor}
                      strokeWidth="6"
                      strokeDasharray={`${(postureScore / 100) * 264} 264`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                      style={{ filter: `drop-shadow(0 0 6px ${postureColor}50)` }}
                    />
                    <text x="50" y="45" textAnchor="middle" fill={postureColor} fontSize="20" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                      {postureScore}
                    </text>
                    <text x="50" y="60" textAnchor="middle" fill="rgba(0,255,156,0.4)" fontSize="6" fontFamily="JetBrains Mono, monospace">
                      POSTURE
                    </text>
                  </svg>
                </div>
                <div className="text-center sm:text-left">
                  <span
                    className="text-[10px] font-bold tracking-widest px-2 py-0.5"
                    style={{ color: postureColor, border: `1px solid ${postureColor}40` }}
                  >
                    {postureLevel}
                  </span>
                  <p className="text-[10px] mt-2" style={{ color: "rgba(0,255,156,0.4)" }}>
                    Blended score from {categories.length} infrastructure scan categories
                  </p>
                </div>
                <div className="flex-1" />
                <button
                  onClick={runScan}
                  className="flex items-center gap-1 px-3 py-1.5 text-[9px] tracking-wider"
                  style={{ border: "1px solid rgba(0,255,156,0.3)", color: "#00FF9C", background: "rgba(0,255,156,0.05)" }}
                  data-testid="run-scan"
                >
                  <RefreshCw size={10} className={isScanning ? "animate-spin" : ""} />
                  {isScanning ? "SCANNING..." : "RUN FULL SCAN"}
                </button>
              </div>

              {/* Scan Categories */}
              {categories.map(cat => {
                const isExpanded = expandedCats.includes(cat.id);
                const Icon = cat.icon;
                const catColor = cat.score >= 90 ? "#00FF9C" : cat.score >= 75 ? "#00B4FF" : cat.score >= 60 ? "#FFB800" : "#FF2D78";
                const failCount = cat.checks.filter(c => c.status !== "pass").length;
                return (
                  <div key={cat.id} style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.2)" }}>
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left"
                      data-testid={`scan-cat-${cat.id}`}
                    >
                      <Icon size={14} style={{ color: catColor }} />
                      <span className="text-[10px] font-bold tracking-wider flex-1" style={{ color: "rgba(0,255,156,0.7)" }}>
                        {cat.label}
                      </span>
                      {failCount > 0 && (
                        <span className="text-[8px] px-1.5 py-0.5" style={{ color: "#FFB800", border: "1px solid rgba(255,184,0,0.3)" }}>
                          {failCount} {failCount === 1 ? "issue" : "issues"}
                        </span>
                      )}
                      <span className="text-[10px] font-bold" style={{ color: catColor }}>{cat.score}%</span>
                      <span
                        className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                        style={{ color: "rgba(0,255,156,0.3)" }}
                      >▸</span>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-2 space-y-1">
                        {[...cat.checks]
                          .sort((a, b) => {
                            const statusOrder = { fail: 0, warn: 1, pass: 2 };
                            return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
                          })
                          .map(check => (
                            <div key={check.id} className="flex items-start gap-2 py-1" style={{ borderTop: "1px solid rgba(0,255,156,0.03)" }}>
                              {statusIcon(check.status)}
                              <span
                                className="text-[8px] font-bold px-1 py-0.5 uppercase flex-shrink-0"
                                style={{ color: severityColor(check.severity), border: `1px solid ${severityColor(check.severity)}30`, minWidth: "14px", textAlign: "center" }}
                              >
                                {check.severity[0]}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px]" style={{ color: "rgba(0,255,156,0.6)" }}>{check.label}</div>
                                <div className="text-[9px]" style={{ color: "rgba(0,255,156,0.35)" }}>{check.detail}</div>
                                {check.fix && check.status !== "pass" && (
                                  <div className="text-[9px] mt-0.5" style={{ color: "#FFB800" }}>Fix: {check.fix}</div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ─── HEALTH CHECKS TAB ─── */}
          {tab === "health" && (
            <>
              <div className="flex items-center justify-between p-2" style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.3)" }}>
                <span className="text-[10px] tracking-widest" style={{ color: "rgba(0,255,156,0.5)" }}>
                  SYSTEM HEALTH CHECKS — {healthChecks.filter(h => h.status === "healthy").length}/{healthChecks.length} HEALTHY
                </span>
                <button
                  onClick={refreshHealth}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider"
                  style={{ border: "1px solid rgba(0,255,156,0.2)", color: "#00FF9C" }}
                  data-testid="refresh-health"
                >
                  <RefreshCw size={10} /> REFRESH
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {healthChecks.map(check => (
                  <div
                    key={check.id}
                    className="flex items-center gap-3 p-3"
                    style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.2)" }}
                  >
                    {statusIcon(check.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold" style={{ color: "rgba(0,255,156,0.7)" }}>{check.label}</div>
                      <div className="text-[9px] truncate" style={{ color: "rgba(0,255,156,0.35)" }}>{check.value}</div>
                    </div>
                    <span className="text-[7px]" style={{ color: "rgba(0,255,156,0.2)" }}>
                      {check.lastCheck.toLocaleTimeString("en-US", { hour12: false })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── DOCTOR TAB ─── */}
          {tab === "doctor" && (
            <>
              <div className="p-4 text-center" style={{ border: "1px solid rgba(0,255,156,0.1)", background: "rgba(0,0,0,0.3)" }}>
                <div className="text-3xl mb-2">🎃</div>
                <div className="text-sm font-bold tracking-widest mb-1" style={{ color: "#00FF9C" }}>OPENCLAW DOCTOR</div>
                <p className="text-[10px] mb-4" style={{ color: "rgba(0,255,156,0.4)" }}>
                  Comprehensive diagnostic check of your OpenClaw installation.
                  Validates gateway, config, models, channels, skills, and system health.
                </p>
                <button
                  onClick={runDoctor}
                  className="px-4 py-2 text-[10px] tracking-widest font-bold"
                  style={{
                    border: "1px solid rgba(0,255,156,0.4)",
                    color: "#00FF9C",
                    background: "rgba(0,255,156,0.08)",
                    boxShadow: "0 0 12px rgba(0,255,156,0.1)",
                  }}
                  data-testid="run-doctor"
                >
                  {isDoctorRunning ? "⏳ RUNNING DIAGNOSTICS..." : "🩺 RUN OPENCLAW DOCTOR"}
                </button>
              </div>

              {/* Doctor results — same as the OpenClaw scan category */}
              {(() => {
                const doctorCat = categories.find(c => c.id === "openclaw");
                if (!doctorCat) return null;
                return (
                  <div style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.2)" }}>
                    <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,255,156,0.06)" }}>
                      <Zap size={14} style={{ color: "#00FF9C" }} />
                      <span className="text-[10px] font-bold tracking-wider" style={{ color: "#00FF9C" }}>DOCTOR RESULTS</span>
                      <span className="text-[10px] font-bold ml-auto" style={{ color: "#00FF9C" }}>{doctorCat.score}%</span>
                    </div>
                    <div className="p-3 space-y-1">
                      {doctorCat.checks.map(check => (
                        <div key={check.id} className="flex items-start gap-2 py-1">
                          {statusIcon(check.status)}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px]" style={{ color: "rgba(0,255,156,0.6)" }}>{check.label}</div>
                            <div className="text-[9px]" style={{ color: "rgba(0,255,156,0.35)" }}>{check.detail}</div>
                            {check.fix && check.status !== "pass" && (
                              <div className="text-[9px] mt-0.5" style={{ color: "#FFB800" }}>Fix: {check.fix}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Quick doctor commands */}
              <div style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.2)" }}>
                <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(0,255,156,0.06)" }}>
                  <span className="text-[10px] font-bold tracking-wider" style={{ color: "rgba(0,255,156,0.5)" }}>
                    QUICK DOCTOR COMMANDS
                  </span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* MOCK DATA: These commands should execute real openclaw CLI commands */}
                  {[
                    { cmd: "openclaw doctor", desc: "Full diagnostic check" },
                    { cmd: "openclaw doctor --fix", desc: "Auto-fix detected issues" },
                    { cmd: "openclaw gateway status", desc: "Gateway process status" },
                    { cmd: "openclaw config validate", desc: "Validate configuration" },
                    { cmd: "openclaw skills update", desc: "Update all skills" },
                    { cmd: "openclaw channels test", desc: "Test all channel connections" },
                  ].map(item => (
                    <button
                      key={item.cmd}
                      className="flex items-start gap-2 p-2 text-left"
                      style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.2)" }}
                      data-testid={`doctor-cmd-${item.cmd.replace(/\s+/g, "-")}`}
                    >
                      <span className="text-[10px] font-mono" style={{ color: "#00B4FF" }}>{`$ ${item.cmd}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
