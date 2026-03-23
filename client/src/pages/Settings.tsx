// ─────────────────────────────────────────────────────────────────────────────
// OPENCLAW MISSION CONTROL — Settings Page
// Agent: Coco // Cyberpunk design system
//
// Design tokens:
//   Background:  #000000 / #050508
//   Primary:     #00FF9C  (electric cyan-green)
//   Secondary:   #FF2D78  (deep magenta)
//   Tertiary:    #00B4FF  (electric blue)
//   Font:        JetBrains Mono (monospace everywhere)
//   Border:      1px rgba(0,255,156,0.2)
//   Border-radius: 2px
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import {
  Server,
  Wifi,
  Shield,
  Plug,
  Monitor,
  Bell,
  Info,
  Download,
  Upload,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Terminal,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#000000",
  surface: "#050508",
  surfaceAlt: "#0a0a12",
  primary: "#00FF9C",
  secondary: "#FF2D78",
  tertiary: "#00B4FF",
  muted: "rgba(0,255,156,0.4)",
  border: "rgba(0,255,156,0.2)",
  borderHover: "rgba(0,255,156,0.5)",
  text: "#e0ffe8",
  textDim: "rgba(224,255,232,0.5)",
  textDimmer: "rgba(224,255,232,0.25)",
  danger: "#FF2D78",
  warn: "#FFB800",
  ok: "#00FF9C",
};

const font = "'JetBrains Mono', 'Fira Code', monospace";

// ─── Mock data comments ────────────────────────────────────────────────────────
// Every mock block below is annotated with what it replaces in production.

// MOCK: In production, read from server config file or environment variables
const MOCK_SERVER_CONFIG = {
  port: "8443",
  hostname: "0.0.0.0",
  corsOrigins: "http://localhost:3000, http://100.64.0.2:8443",
  sessionTimeout: "3600",
};

// MOCK: In production, run `tailscale status --json` and parse the output
const MOCK_TAILSCALE = {
  connected: true,
  ip: "100.64.12.34",
  magicDns: "kali-m4-mini.tailnet-xyz.ts.net",
  peerCount: 3,
  autoStart: true,
};

// MOCK: In production, read SSH authorized_keys, query fail2ban-client, run ufw status
const MOCK_SECURITY = {
  sshKeys: [
    { name: "macbook-pro-m3.pub", fingerprint: "SHA256:xK7pL...QmRt", added: "2024-12-01" },
    { name: "iphone-shortcuts.pub", fingerprint: "SHA256:9nWz2...Bv4a", added: "2025-01-15" },
  ],
  fail2ban: { active: true, jailed: 2, totalBanned: 47 },
  ufwRules: [
    { port: "22/tcp", from: "any", action: "ALLOW", label: "SSH" },
    { port: "8443/tcp", from: "any", action: "ALLOW", label: "OpenClaw MC" },
    { port: "any", from: "100.64.0.0/10", action: "ALLOW", label: "Tailscale" },
  ],
  twoFactorEnabled: false,
};

// MOCK: In production, read from .env or db config; token is rotated via HMAC
const MOCK_GATEWAY = {
  wsUrl: "ws://localhost:18789",
  reconnectInterval: "5000",
  authToken: "oc-gw-tok-a8f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5",
  showToken: false,
};

// MOCK: Persisted to localStorage in a real implementation
const MOCK_APPEARANCE = {
  theme: "dark",
  crtIntensity: 40,
  scanlines: true,
  skipBoot: false,
};

// MOCK: In production, use Notifications API + backend event subscriptions
const MOCK_NOTIFICATIONS = {
  desktop: true,
  alertSound: false,
  sshFailAlert: true,
};

// MOCK: In production, gather from /proc/meminfo, os.uptime(), df -h, etc.
const MOCK_SYSTEM_INFO = {
  os: "Kali Linux GNU/Linux",
  kernel: "6.8.0-kali1-arm64",
  uptime: "14d 6h 22m",
  cpu: "Apple M4 (10 cores)",
  ram: "32 GB",
  disk: "450 GB / 1 TB used",
  nodeVersion: "v22.3.0",
  projectVersion: "4.0.0",
  arch: "arm64",
};

// ─── Utility components ───────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}
function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          position: "relative",
          width: "42px",
          height: "22px",
          background: checked ? C.primary : "rgba(255,255,255,0.08)",
          borderRadius: "2px",
          border: `1px solid ${checked ? C.primary : C.border}`,
          transition: "all 0.2s",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "22px" : "2px",
            width: "16px",
            height: "16px",
            background: checked ? C.bg : C.textDim,
            borderRadius: "1px",
            transition: "left 0.2s",
          }}
        />
      </div>
      {label && (
        <span style={{ color: checked ? C.text : C.textDim, fontFamily: font, fontSize: "12px" }}>
          {label}
        </span>
      )}
    </label>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  monospace?: boolean;
  placeholder?: string;
  disabled?: boolean;
}
function InputField({ label, value, onChange, type = "text", placeholder, disabled }: InputFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ color: C.textDim, fontFamily: font, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          background: disabled ? "transparent" : C.surfaceAlt,
          border: `1px solid ${C.border}`,
          borderRadius: "2px",
          color: disabled ? C.textDim : C.text,
          fontFamily: font,
          fontSize: "13px",
          padding: "8px 10px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: string;
  defaultOpen?: boolean;
}
function Section({ id, icon, title, children, accent = C.primary, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      id={id}
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: "2px",
        background: C.surface,
        marginBottom: "16px",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          borderBottom: open ? `1px solid ${C.border}` : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ color: accent, display: "flex", alignItems: "center" }}>{icon}</span>
        <span style={{ color: C.text, fontFamily: font, fontSize: "13px", fontWeight: 600, flex: 1, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {title}
        </span>
        <span style={{ color: C.textDim }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && (
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
}
function Badge({ children, color = C.primary, bg }: BadgeProps) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "2px 8px",
      background: bg ?? `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: "2px",
      color,
      fontFamily: font,
      fontSize: "11px",
      letterSpacing: "0.05em",
    }}>
      {children}
    </span>
  );
}

function Row({ label, value, children }: { label: string; value?: string | React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <span style={{ color: C.textDim, fontFamily: font, fontSize: "12px", minWidth: "160px" }}>{label}</span>
      {value !== undefined && (
        <span style={{ color: C.text, fontFamily: font, fontSize: "12px" }}>{value}</span>
      )}
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: C.border, margin: "4px 0" }} />;
}

// ─── Slider ───────────────────────────────────────────────────────────────────
interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  unit?: string;
}
function Slider({ label, value, min = 0, max = 100, onChange, unit = "%" }: SliderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: C.textDim, fontFamily: font, fontSize: "12px" }}>{label}</span>
        <span style={{ color: C.primary, fontFamily: font, fontSize: "12px" }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          WebkitAppearance: "none",
          appearance: "none",
          width: "100%",
          height: "4px",
          background: `linear-gradient(to right, ${C.primary} ${value}%, rgba(0,255,156,0.15) ${value}%)`,
          outline: "none",
          borderRadius: "2px",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      style={{
        background: "transparent",
        border: "none",
        color: copied ? C.primary : C.textDim,
        cursor: "pointer",
        padding: "2px 4px",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ─── Main Settings component ──────────────────────────────────────────────────
export default function Settings() {
  // ── State: Server Config ──────────────────────────────────────────────────
  const [serverConfig, setServerConfig] = useState(MOCK_SERVER_CONFIG);

  // ── State: Tailscale ──────────────────────────────────────────────────────
  const [tailscale, setTailscale] = useState(MOCK_TAILSCALE);

  // ── State: Security ───────────────────────────────────────────────────────
  const [security, setSecurity] = useState(MOCK_SECURITY);

  // ── State: Gateway ────────────────────────────────────────────────────────
  const [gateway, setGateway] = useState(MOCK_GATEWAY);

  // ── State: Appearance ─────────────────────────────────────────────────────
  const [appearance, setAppearance] = useState(MOCK_APPEARANCE);

  // ── State: Notifications ──────────────────────────────────────────────────
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  // ── State: System Info ────────────────────────────────────────────────────
  const [systemInfo] = useState(MOCK_SYSTEM_INFO);

  // ── State: Save feedback ──────────────────────────────────────────────────
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // MOCK: In production, POST to /api/settings with the full config object
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    // MOCK: In production, include server-side secrets (tokens, paths) in export
    const config = { serverConfig, tailscale, gateway, appearance, notifications };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openclaw-mc-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    // MOCK: In production, validate schema before applying imported config
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (parsed.serverConfig) setServerConfig(parsed.serverConfig);
          if (parsed.gateway) setGateway(parsed.gateway);
          if (parsed.appearance) setAppearance(parsed.appearance);
          if (parsed.notifications) setNotifications(parsed.notifications);
        } catch {
          alert("Invalid config file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    // MOCK: In production, reset all settings to built-in defaults from server
    if (window.confirm("Reset all settings to defaults? This cannot be undone.")) {
      setServerConfig(MOCK_SERVER_CONFIG);
      setTailscale(MOCK_TAILSCALE);
      setGateway(MOCK_GATEWAY);
      setAppearance(MOCK_APPEARANCE);
      setNotifications(MOCK_NOTIFICATIONS);
    }
  };

  const rotateToken = () => {
    // MOCK: In production, POST /api/gateway/rotate-token and re-subscribe WS
    const newToken = "oc-gw-tok-" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setGateway((g) => ({ ...g, authToken: newToken }));
  };

  // ── Uptime live counter (demo) ─────────────────────────────────────────────
  const [uptimeStr, setUptimeStr] = useState(systemInfo.uptime);
  useEffect(() => {
    // MOCK: In production, poll /api/health for uptime field
    const interval = setInterval(() => {
      setUptimeStr(systemInfo.uptime); // no-op in mock; real impl increments
    }, 30000);
    return () => clearInterval(interval);
  }, [systemInfo.uptime]);

  return (
    <AppShell>
      <div
        style={{
          background: C.bg,
          minHeight: "100vh",
          color: C.text,
          fontFamily: font,
          padding: "0",
        }}
      >
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div
          style={{
            borderBottom: `1px solid ${C.border}`,
            padding: "20px 28px 16px",
            background: C.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Terminal size={18} color={C.primary} />
              <h1 style={{ margin: 0, fontSize: "16px", color: C.primary, fontFamily: font, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Mission Control — Settings
              </h1>
            </div>
            <p style={{ margin: "4px 0 0", color: C.textDim, fontSize: "11px", fontFamily: font }}>
              All changes are local until saved · No backend calls in this build
            </p>
          </div>

          <button
            onClick={handleSave}
            style={{
              background: saved ? C.primary : "transparent",
              border: `1px solid ${C.primary}`,
              borderRadius: "2px",
              color: saved ? C.bg : C.primary,
              fontFamily: font,
              fontSize: "12px",
              fontWeight: 700,
              padding: "8px 20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              letterSpacing: "0.08em",
              transition: "all 0.15s",
            }}
          >
            {saved ? <><Check size={13} /> SAVED</> : "SAVE CHANGES"}
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: "24px 28px", maxWidth: "900px" }}>

          {/* ══════════════════════════════════════════════════════════════════
              1. SERVER CONFIGURATION
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="server-config" icon={<Server size={16} />} title="Server Configuration">
            {/* MOCK: In production, these fields map to .env / server config file */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <InputField
                label="Listen Port"
                value={serverConfig.port}
                onChange={(v) => setServerConfig((c) => ({ ...c, port: v }))}
                placeholder="8443"
              />
              <InputField
                label="Bind Hostname"
                value={serverConfig.hostname}
                onChange={(v) => setServerConfig((c) => ({ ...c, hostname: v }))}
                placeholder="0.0.0.0"
              />
            </div>
            <InputField
              label="CORS Allowed Origins"
              value={serverConfig.corsOrigins}
              onChange={(v) => setServerConfig((c) => ({ ...c, corsOrigins: v }))}
              placeholder="http://localhost:3000, https://yourdomain.com"
            />
            <InputField
              label="Session Timeout (seconds)"
              value={serverConfig.sessionTimeout}
              onChange={(v) => setServerConfig((c) => ({ ...c, sessionTimeout: v }))}
              placeholder="3600"
            />
            <div
              style={{
                padding: "10px 12px",
                background: `${C.tertiary}10`,
                border: `1px solid ${C.tertiary}30`,
                borderRadius: "2px",
                color: C.textDim,
                fontSize: "11px",
                lineHeight: "1.6",
              }}
            >
              // MOCK NOTE: In production, changes here update the server .env and trigger a
              graceful reload via <code style={{ color: C.tertiary }}>SIGHUP</code> or
              {" "}<code style={{ color: C.tertiary }}>systemctl reload openclaw-mission-control</code>.
            </div>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              2. TAILSCALE INTEGRATION
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="tailscale" icon={<Wifi size={16} />} title="Tailscale Integration" accent={C.tertiary}>
            {/* MOCK: In production, run `tailscale status --json` and parse Self + Peers */}
            <Row label="Connection Status">
              <Badge color={tailscale.connected ? C.primary : C.danger}>
                {tailscale.connected ? <><Check size={10} /> CONNECTED</> : <><X size={10} /> DISCONNECTED</>}
              </Badge>
            </Row>
            <Row label="Tailscale IPv4">
              <span style={{ color: C.tertiary, fontFamily: font, fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                {tailscale.ip}
                <CopyButton text={tailscale.ip} />
              </span>
            </Row>
            <Row label="MagicDNS Hostname">
              <span style={{ color: C.textDim, fontFamily: font, fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                {tailscale.magicDns}
                <CopyButton text={tailscale.magicDns} />
              </span>
            </Row>
            <Row label="Connected Peers">
              <Badge color={C.tertiary}>{tailscale.peerCount} peers</Badge>
            </Row>
            <Row label="Peer List">
              <a
                href="http://100.100.100.100"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.tertiary, fontFamily: font, fontSize: "12px", textDecoration: "none" }}
              >
                Open Tailscale Admin ↗
              </a>
            </Row>
            <Divider />
            <Row label="Auto-start Tailscale on boot">
              <Toggle
                checked={tailscale.autoStart}
                onChange={(v) => setTailscale((t) => ({ ...t, autoStart: v }))}
                label={tailscale.autoStart ? "Enabled" : "Disabled"}
              />
            </Row>
            <div
              style={{
                padding: "10px 12px",
                background: `${C.tertiary}10`,
                border: `1px solid ${C.tertiary}30`,
                borderRadius: "2px",
                color: C.textDim,
                fontSize: "11px",
                lineHeight: "1.6",
              }}
            >
              // MOCK NOTE: Auto-start toggle runs <code style={{ color: C.tertiary }}>sudo systemctl enable tailscaled</code>.
              Tailscale URL: <code style={{ color: C.tertiary }}>http://{tailscale.ip}:{serverConfig.port}</code>
            </div>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              3. SECURITY
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="security" icon={<Shield size={16} />} title="Security" accent={C.secondary}>
            {/* MOCK: In production, SSH keys from ~/.ssh/authorized_keys */}
            <div>
              <span style={{ color: C.textDim, fontFamily: font, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "8px" }}>
                SSH Authorized Keys
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {security.sshKeys.map((key, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: C.surfaceAlt,
                      border: `1px solid ${C.border}`,
                      borderRadius: "2px",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Shield size={12} color={C.secondary} />
                      <span style={{ color: C.text, fontFamily: font, fontSize: "12px" }}>{key.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ color: C.textDimmer, fontFamily: font, fontSize: "11px" }}>{key.fingerprint}</span>
                      <span style={{ color: C.textDimmer, fontFamily: font, fontSize: "11px" }}>{key.added}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            {/* MOCK: In production, run `fail2ban-client status sshd` */}
            <div>
              <span style={{ color: C.textDim, fontFamily: font, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "8px" }}>
                Fail2Ban Status
              </span>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Badge color={security.fail2ban.active ? C.primary : C.danger}>
                  {security.fail2ban.active ? "ACTIVE" : "INACTIVE"}
                </Badge>
                <Badge color={C.warn}>
                  <AlertTriangle size={10} />
                  {security.fail2ban.jailed} currently jailed
                </Badge>
                <Badge color={C.textDim}>
                  {security.fail2ban.totalBanned} total banned
                </Badge>
              </div>
            </div>

            <Divider />

            {/* MOCK: In production, run `ufw status verbose` */}
            <div>
              <span style={{ color: C.textDim, fontFamily: font, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "8px" }}>
                UFW Rules
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {security.ufwRules.map((rule, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.5fr auto auto",
                      gap: "8px",
                      alignItems: "center",
                      padding: "6px 12px",
                      background: C.surfaceAlt,
                      border: `1px solid ${C.border}`,
                      borderRadius: "2px",
                      fontFamily: font,
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: C.tertiary }}>{rule.port}</span>
                    <span style={{ color: C.textDim }}>from {rule.from}</span>
                    <Badge color={C.primary}>{rule.action}</Badge>
                    <span style={{ color: C.textDimmer }}>{rule.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            <Row label="Two-Factor Authentication">
              <Toggle
                checked={security.twoFactorEnabled}
                onChange={(v) => setSecurity((s) => ({ ...s, twoFactorEnabled: v }))}
                label={security.twoFactorEnabled ? "Enabled" : "Disabled — click to enable"}
              />
            </Row>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              4. GATEWAY CONNECTION
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="gateway" icon={<Plug size={16} />} title="Gateway Connection" accent={C.tertiary}>
            {/* MOCK: In production, gateway config lives in .env (GATEWAY_WS_URL, GATEWAY_TOKEN) */}
            <InputField
              label="WebSocket URL"
              value={gateway.wsUrl}
              onChange={(v) => setGateway((g) => ({ ...g, wsUrl: v }))}
              placeholder="ws://localhost:18789"
            />
            <InputField
              label="Reconnect Interval (ms)"
              value={gateway.reconnectInterval}
              onChange={(v) => setGateway((g) => ({ ...g, reconnectInterval: v }))}
              placeholder="5000"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ color: C.textDim, fontFamily: font, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Auth Token
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type={gateway.showToken ? "text" : "password"}
                  value={gateway.authToken}
                  readOnly
                  style={{
                    flex: 1,
                    background: C.surfaceAlt,
                    border: `1px solid ${C.border}`,
                    borderRadius: "2px",
                    color: C.textDim,
                    fontFamily: font,
                    fontSize: "12px",
                    padding: "8px 10px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => setGateway((g) => ({ ...g, showToken: !g.showToken }))}
                  style={{ background: "transparent", border: "none", color: C.textDim, cursor: "pointer", padding: "4px" }}
                  title={gateway.showToken ? "Hide" : "Show"}
                >
                  {gateway.showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <CopyButton text={gateway.authToken} />
                <button
                  onClick={rotateToken}
                  title="Rotate token"
                  style={{
                    background: `${C.secondary}15`,
                    border: `1px solid ${C.secondary}40`,
                    borderRadius: "2px",
                    color: C.secondary,
                    fontFamily: font,
                    fontSize: "11px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <RefreshCw size={11} /> ROTATE
                </button>
              </div>
            </div>
            <div
              style={{
                padding: "10px 12px",
                background: `${C.secondary}08`,
                border: `1px solid ${C.secondary}25`,
                borderRadius: "2px",
                color: C.textDim,
                fontSize: "11px",
                lineHeight: "1.6",
              }}
            >
              // MOCK NOTE: Rotating the token generates a new HMAC secret, saves to
              .env, and restarts the gateway WS connection. All connected clients will
              need to reconnect.
            </div>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              5. APPEARANCE
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="appearance" icon={<Monitor size={16} />} title="Appearance">
            {/* MOCK: In production, persisted to localStorage + applied via CSS vars */}
            <div>
              <span style={{ color: C.textDim, fontFamily: font, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "10px" }}>
                Theme
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                {["dark", "darker", "matrix"].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setAppearance((a) => ({ ...a, theme }))}
                    style={{
                      background: appearance.theme === theme ? `${C.primary}20` : "transparent",
                      border: `1px solid ${appearance.theme === theme ? C.primary : C.border}`,
                      borderRadius: "2px",
                      color: appearance.theme === theme ? C.primary : C.textDim,
                      fontFamily: font,
                      fontSize: "12px",
                      padding: "6px 16px",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {theme}
                    {theme !== "dark" && (
                      <span style={{ color: C.textDimmer, marginLeft: "6px", fontSize: "10px" }}>(dev)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Divider />

            <Slider
              label="CRT Effect Intensity"
              value={appearance.crtIntensity}
              onChange={(v) => setAppearance((a) => ({ ...a, crtIntensity: v }))}
              unit="%"
            />

            <Row label="Scanline Overlay">
              <Toggle
                checked={appearance.scanlines}
                onChange={(v) => setAppearance((a) => ({ ...a, scanlines: v }))}
                label={appearance.scanlines ? "ON" : "OFF"}
              />
            </Row>

            <Row label="Skip Boot Sequence">
              <Toggle
                checked={appearance.skipBoot}
                onChange={(v) => setAppearance((a) => ({ ...a, skipBoot: v }))}
                label={appearance.skipBoot ? "Skipping boot animation" : "Show boot animation"}
              />
            </Row>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              6. NOTIFICATIONS
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="notifications" icon={<Bell size={16} />} title="Notifications" accent={C.warn}>
            {/* MOCK: In production, uses Notifications API + backend event subscriptions */}
            <Row label="Desktop Notifications">
              <Toggle
                checked={notifications.desktop}
                onChange={(v) => setNotifications((n) => ({ ...n, desktop: v }))}
                label={notifications.desktop ? "Enabled" : "Disabled"}
              />
            </Row>
            <Row label="Alert Sounds">
              <Toggle
                checked={notifications.alertSound}
                onChange={(v) => setNotifications((n) => ({ ...n, alertSound: v }))}
                label={notifications.alertSound ? "Enabled" : "Disabled"}
              />
            </Row>
            <Row label="Alert on SSH Failed Auth">
              <Toggle
                checked={notifications.sshFailAlert}
                onChange={(v) => setNotifications((n) => ({ ...n, sshFailAlert: v }))}
                label={notifications.sshFailAlert ? "Notifying on SSH failures" : "SSH failure alerts off"}
              />
            </Row>
            {notifications.sshFailAlert && (
              <div
                style={{
                  padding: "10px 12px",
                  background: `${C.warn}10`,
                  border: `1px solid ${C.warn}30`,
                  borderRadius: "2px",
                  color: C.textDim,
                  fontSize: "11px",
                  lineHeight: "1.6",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <AlertTriangle size={13} color={C.warn} style={{ flexShrink: 0, marginTop: "1px" }} />
                // MOCK NOTE: SSH failure alerts subscribe to the gateway event stream
                for <code style={{ color: C.warn }}>auth_fail</code> events from the
                fail2ban log watcher.
              </div>
            )}
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              7. SYSTEM INFO
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="system-info" icon={<Info size={16} />} title="System Info" defaultOpen={false}>
            {/* MOCK: In production, pulled from /api/health and `uname -a`, `free -h`, `df -h` */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                ["Operating System", systemInfo.os],
                ["Kernel", systemInfo.kernel],
                ["Architecture", systemInfo.arch],
                ["Uptime", uptimeStr],
                ["CPU", systemInfo.cpu],
                ["RAM", systemInfo.ram],
                ["Disk", systemInfo.disk],
                ["Node.js", systemInfo.nodeVersion],
                ["Project Version", systemInfo.projectVersion],
                ["Platform", "Kali Linux on Mac mini M4"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: "8px 12px",
                    background: C.surfaceAlt,
                    border: `1px solid ${C.border}`,
                    borderRadius: "2px",
                  }}
                >
                  <div style={{ color: C.textDim, fontFamily: font, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>
                    {label}
                  </div>
                  <div style={{ color: C.text, fontFamily: font, fontSize: "12px" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "10px 12px",
                background: `${C.primary}08`,
                border: `1px solid ${C.border}`,
                borderRadius: "2px",
                color: C.textDim,
                fontSize: "11px",
                lineHeight: "1.6",
              }}
            >
              // MOCK NOTE: Live system metrics are pulled from <code style={{ color: C.primary }}>/api/health</code> every 30s.
              Real disk/CPU data requires <code style={{ color: C.primary }}>systeminformation</code> npm package
              or shell commands via <code style={{ color: C.primary }}>child_process.exec</code>.
            </div>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════
              8. EXPORT / IMPORT / RESET
              ══════════════════════════════════════════════════════════════════ */}
          <Section id="export-import" icon={<Download size={16} />} title="Export / Import / Reset" defaultOpen={false} accent={C.secondary}>
            {/* MOCK: In production, export includes server-side keys; import validates schema */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  padding: "12px 16px",
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: "2px",
                  color: C.textDim,
                  fontFamily: font,
                  fontSize: "11px",
                  lineHeight: "1.7",
                }}
              >
                Export saves all current settings as a JSON file to your local machine.
                Import restores settings from a previously exported file.
                Reset wipes all changes and reverts to compiled-in defaults.
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={handleExport}
                  style={{
                    background: `${C.primary}15`,
                    border: `1px solid ${C.primary}50`,
                    borderRadius: "2px",
                    color: C.primary,
                    fontFamily: font,
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "9px 18px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    letterSpacing: "0.06em",
                  }}
                >
                  <Download size={13} /> EXPORT CONFIG
                </button>

                <button
                  onClick={handleImport}
                  style={{
                    background: `${C.tertiary}15`,
                    border: `1px solid ${C.tertiary}50`,
                    borderRadius: "2px",
                    color: C.tertiary,
                    fontFamily: font,
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "9px 18px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    letterSpacing: "0.06em",
                  }}
                >
                  <Upload size={13} /> IMPORT CONFIG
                </button>

                <button
                  onClick={handleReset}
                  style={{
                    background: `${C.danger}12`,
                    border: `1px solid ${C.danger}40`,
                    borderRadius: "2px",
                    color: C.danger,
                    fontFamily: font,
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "9px 18px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    letterSpacing: "0.06em",
                  }}
                >
                  <RotateCcw size={13} /> RESET TO DEFAULTS
                </button>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  background: `${C.secondary}08`,
                  border: `1px solid ${C.secondary}25`,
                  borderRadius: "2px",
                  color: C.textDim,
                  fontSize: "11px",
                  lineHeight: "1.6",
                }}
              >
                // MOCK NOTE: In production, export also includes the gateway auth token (server-side only),
                SSH key paths, and systemd service configuration. Import validates the config version
                before applying.
              </div>
            </div>
          </Section>

          {/* ── Footer spacer ─────────────────────────────────────────────── */}
          <div style={{ height: "40px" }} />
        </div>
      </div>
    </AppShell>
  );
}
