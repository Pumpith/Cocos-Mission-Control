import { useState } from "react";
import AppShell from "@/components/AppShell";
import {
  FileCode, Save, RotateCcw, ChevronRight, ChevronDown,
  Search, Tag, Copy, Check, AlertTriangle, Zap
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   CONFIG EDITOR PAGE
   Edit the OpenClaw configuration file with a terminal-style
   YAML/JSON editor. Two modes: Form (schema-driven fields)
   and Raw JSON editor.

   Inspired by builderz-labs/mission-control gateway-config-panel:
   - Left sidebar with section navigation + search + tags
   - Form mode with schema-driven field widgets
   - JSON mode with raw textarea editor
   - Diff tracking for unsaved changes
   - Save/Apply/Reload actions

   MOCK DATA: The entire config object below is simulated.
   On real deployment, fetch from:
   - GET /api/gateway-config (live config)
   - GET /api/gateway-config?action=schema (JSON schema)
   Replace MOCK_CONFIG with actual API response.
   ────────────────────────────────────────────────────────────── */

interface ConfigSection {
  id: string;
  label: string;
  icon: string;
  fields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "array";
  value: any;
  description?: string;
  options?: string[];
}

/* MOCK DATA: Configuration sections — replace with data from
   GET /api/gateway-config endpoint */
const MOCK_CONFIG: ConfigSection[] = [
  {
    id: "gateway",
    label: "GATEWAY",
    icon: "G",
    fields: [
      { key: "gateway.port", label: "Port", type: "number", value: 18789, description: "WebSocket gateway port" },
      { key: "gateway.host", label: "Host", type: "string", value: "0.0.0.0", description: "Bind address" },
      { key: "gateway.protocol", label: "Protocol Version", type: "select", value: "v3", options: ["v2", "v3"], description: "Gateway protocol version" },
      { key: "gateway.maxConnections", label: "Max Connections", type: "number", value: 100, description: "Maximum concurrent connections" },
      { key: "gateway.heartbeatInterval", label: "Heartbeat Interval (ms)", type: "number", value: 30000 },
      { key: "gateway.enableTLS", label: "Enable TLS", type: "boolean", value: false, description: "Enable TLS/SSL for WebSocket" },
    ],
  },
  {
    id: "agents",
    label: "AGENTS",
    icon: "A",
    fields: [
      { key: "agents.coordinator", label: "Coordinator Agent", type: "string", value: "coco", description: "Primary agent name" },
      { key: "agents.maxConcurrent", label: "Max Concurrent Agents", type: "number", value: 6 },
      { key: "agents.defaultModel", label: "Default Model", type: "select", value: "claude-opus-4-6", options: ["claude-opus-4-6", "claude-sonnet-4-6", "gpt-4o", "local/minimax", "local/qwen-32b"], description: "Default LLM model for agents" },
      { key: "agents.memoryPersistence", label: "Memory Persistence", type: "boolean", value: true },
      { key: "agents.autoRestart", label: "Auto Restart on Crash", type: "boolean", value: true },
    ],
  },
  {
    id: "channels",
    label: "CHANNELS",
    icon: "C",
    fields: [
      { key: "channels.whatsapp.enabled", label: "WhatsApp", type: "boolean", value: true },
      { key: "channels.telegram.enabled", label: "Telegram", type: "boolean", value: true },
      { key: "channels.telegram.botToken", label: "Telegram Bot Token", type: "string", value: "********", description: "Telegram bot API token (redacted)" },
      { key: "channels.slack.enabled", label: "Slack", type: "boolean", value: true },
      { key: "channels.discord.enabled", label: "Discord", type: "boolean", value: false },
      { key: "channels.elementx.enabled", label: "Element X (Matrix)", type: "boolean", value: true },
    ],
  },
  {
    id: "auth",
    label: "AUTH",
    icon: "K",
    fields: [
      { key: "auth.method", label: "Auth Method", type: "select", value: "token", options: ["token", "ed25519", "none"], description: "Authentication method for gateway connections" },
      { key: "auth.tokenRotationDays", label: "Token Rotation (days)", type: "number", value: 30 },
      { key: "auth.requireApproval", label: "Require Exec Approval", type: "boolean", value: true, description: "Require user approval for destructive commands" },
    ],
  },
  {
    id: "tools",
    label: "TOOLS",
    icon: "T",
    fields: [
      { key: "tools.shellAccess", label: "Shell Access", type: "boolean", value: true },
      { key: "tools.browserAccess", label: "Browser Access", type: "boolean", value: true },
      { key: "tools.fileSystemScope", label: "Filesystem Scope", type: "string", value: "/home/openclaw", description: "Root directory for file access" },
      { key: "tools.maxExecTimeout", label: "Max Exec Timeout (s)", type: "number", value: 300 },
      { key: "tools.blockedCommands", label: "Blocked Commands", type: "array", value: ["rm -rf /", "mkfs", "dd if=/dev/zero", ":(){ :|:& };:"] },
    ],
  },
  {
    id: "models",
    label: "MODELS",
    icon: "M",
    fields: [
      { key: "models.provider", label: "Primary Provider", type: "select", value: "local", options: ["local", "openai", "anthropic", "custom"], description: "LLM provider" },
      { key: "models.localEndpoint", label: "Local Endpoint", type: "string", value: "http://127.0.0.1:1234/v1", description: "LM Studio / Ollama endpoint" },
      { key: "models.temperature", label: "Temperature", type: "number", value: 0.7 },
      { key: "models.maxTokens", label: "Max Tokens", type: "number", value: 4096 },
    ],
  },
  {
    id: "security",
    label: "SECURITY",
    icon: "S",
    fields: [
      { key: "security.injectionDetection", label: "Prompt Injection Detection", type: "boolean", value: true },
      { key: "security.rateLimitPerMinute", label: "Rate Limit (req/min)", type: "number", value: 60 },
      { key: "security.ipWhitelist", label: "IP Whitelist", type: "array", value: ["127.0.0.1", "192.168.1.0/24"] },
      { key: "security.auditLogging", label: "Audit Logging", type: "boolean", value: true },
    ],
  },
  {
    id: "logging",
    label: "LOGGING",
    icon: "L",
    fields: [
      { key: "logging.level", label: "Log Level", type: "select", value: "info", options: ["debug", "info", "warn", "error"] },
      { key: "logging.file", label: "Log File", type: "string", value: "/var/log/openclaw/gateway.log" },
      { key: "logging.maxSizeMB", label: "Max Log Size (MB)", type: "number", value: 100 },
      { key: "logging.retentionDays", label: "Retention (days)", type: "number", value: 30 },
    ],
  },
  {
    id: "cron",
    label: "CRON",
    icon: "R",
    fields: [
      { key: "cron.enabled", label: "Cron Enabled", type: "boolean", value: true },
      { key: "cron.timezone", label: "Timezone", type: "string", value: "Asia/Qatar" },
      { key: "cron.maxConcurrentJobs", label: "Max Concurrent Jobs", type: "number", value: 5 },
    ],
  },
];

export default function ConfigEditor() {
  const [activeSection, setActiveSection] = useState(MOCK_CONFIG[0].id);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [config, setConfig] = useState(MOCK_CONFIG);
  const [searchQuery, setSearchQuery] = useState("");
  const [changes, setChanges] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState(false);
  const [jsonText, setJsonText] = useState("");

  const currentSection = config.find(s => s.id === activeSection);
  const changeCount = Object.keys(changes).length;

  const updateField = (key: string, value: any) => {
    setChanges(prev => ({ ...prev, [key]: value }));
    setConfig(prev => prev.map(section => ({
      ...section,
      fields: section.fields.map(f => f.key === key ? { ...f, value } : f),
    })));
  };

  const handleSave = () => {
    /* MOCK DATA: On real deployment, send changes to:
       PUT /api/gateway-config with { updates: changes, hash: configHash } */
    setSaved(true);
    setChanges({});
    setTimeout(() => setSaved(false), 2000);
  };

  const handleApply = () => {
    /* MOCK DATA: On real deployment, save + hot-reload:
       PUT /api/gateway-config?action=apply */
    handleSave();
  };

  const handleDiscard = () => {
    setChanges({});
    setConfig(MOCK_CONFIG);
  };

  // Generate JSON view
  const toJson = () => {
    const obj: Record<string, any> = {};
    config.forEach(section => {
      section.fields.forEach(f => {
        const parts = f.key.split(".");
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = f.value;
      });
    });
    return JSON.stringify(obj, null, 2);
  };

  const filteredSections = searchQuery
    ? config.filter(s => s.fields.some(f =>
        f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      ))
    : config;

  return (
    <AppShell>
      <div className="flex-1 p-2 h-full overflow-hidden flex gap-2">
        {/* LEFT: Section nav */}
        <div
          className="w-[180px] lg:w-[200px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="p-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,255,156,0.08)" }}>
            <div className="flex items-center gap-1 px-2 py-1" style={{ border: "1px solid rgba(0,255,156,0.1)" }}>
              <Search size={10} style={{ color: "rgba(0,255,156,0.3)" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search config..."
                className="flex-1 bg-transparent text-[10px] outline-none"
                style={{ color: "#00FF9C", caretColor: "#00FF9C" }}
                data-testid="config-search"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filteredSections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                style={{
                  background: activeSection === section.id ? "rgba(0,255,156,0.06)" : "transparent",
                  color: activeSection === section.id ? "#00FF9C" : "rgba(0,255,156,0.4)",
                }}
                data-testid={`config-section-${section.id}`}
              >
                <span
                  className="w-5 h-5 flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                  style={{
                    border: `1px solid ${activeSection === section.id ? "rgba(0,255,156,0.3)" : "rgba(0,255,156,0.1)"}`,
                    background: activeSection === section.id ? "rgba(0,255,156,0.08)" : "transparent",
                  }}
                >
                  {section.icon}
                </span>
                <span className="text-[9px] tracking-wider">{section.label}</span>
              </button>
            ))}
          </div>

          {/* Mode toggle */}
          <div className="p-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(0,255,156,0.08)" }}>
            <div className="flex">
              <button
                onClick={() => setMode("form")}
                className="flex-1 text-[8px] tracking-wider py-1"
                style={{
                  border: "1px solid rgba(0,255,156,0.15)",
                  background: mode === "form" ? "rgba(0,255,156,0.08)" : "transparent",
                  color: mode === "form" ? "#00FF9C" : "rgba(0,255,156,0.3)",
                  borderRight: "none",
                }}
              >
                FORM
              </button>
              <button
                onClick={() => { setMode("json"); setJsonText(toJson()); }}
                className="flex-1 text-[8px] tracking-wider py-1"
                style={{
                  border: "1px solid rgba(0,255,156,0.15)",
                  background: mode === "json" ? "rgba(0,255,156,0.08)" : "transparent",
                  color: mode === "json" ? "#00FF9C" : "rgba(0,255,156,0.3)",
                }}
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,0,0,0.2)" }}>
          {/* Action bar */}
          <div
            className="flex items-center justify-between px-3 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(0,255,156,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <FileCode size={14} style={{ color: "#00FF9C" }} />
              <span className="text-xs font-bold tracking-widest" style={{ color: "#00FF9C" }}>
                CONFIG EDITOR
              </span>
              {changeCount > 0 && (
                <span className="text-[9px] px-2 py-0.5" style={{ color: "#FFB800", border: "1px solid rgba(255,184,0,0.3)" }}>
                  {changeCount} unsaved {changeCount === 1 ? "change" : "changes"}
                </span>
              )}
              {saved && (
                <span className="text-[9px] px-2 py-0.5 flex items-center gap-1" style={{ color: "#00FF9C", border: "1px solid rgba(0,255,156,0.3)" }}>
                  <Check size={10} /> SAVED
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscard}
                className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider"
                style={{
                  border: "1px solid rgba(255,45,120,0.2)",
                  color: changeCount > 0 ? "#FF2D78" : "rgba(255,45,120,0.3)",
                  opacity: changeCount > 0 ? 1 : 0.4,
                }}
                disabled={changeCount === 0}
                data-testid="config-discard"
              >
                <RotateCcw size={10} /> DISCARD
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider"
                style={{
                  border: "1px solid rgba(0,255,156,0.3)",
                  color: "#00FF9C",
                  background: changeCount > 0 ? "rgba(0,255,156,0.08)" : "transparent",
                  opacity: changeCount > 0 ? 1 : 0.4,
                }}
                disabled={changeCount === 0}
                data-testid="config-save"
              >
                <Save size={10} /> SAVE
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-wider font-bold"
                style={{
                  border: "1px solid rgba(0,180,255,0.3)",
                  color: "#00B4FF",
                  background: "rgba(0,180,255,0.08)",
                }}
                data-testid="config-apply"
              >
                <Zap size={10} /> SAVE & APPLY
              </button>
            </div>
          </div>

          {/* Config path */}
          <div className="px-3 py-1 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,255,156,0.05)" }}>
            <span className="text-[8px] font-mono" style={{ color: "rgba(0,255,156,0.3)" }}>
              {/* MOCK DATA: Replace with actual config file path from API */}
              ~/.openclaw/config.yaml
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {mode === "form" && currentSection && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-bold tracking-widest" style={{ color: "#00FF9C" }}>
                    // {currentSection.label}
                  </span>
                </div>
                {currentSection.fields.map(field => (
                  <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(0,255,156,0.04)" }}>
                    <div className="sm:w-[200px] flex-shrink-0">
                      <div className="text-[10px] font-bold" style={{ color: "rgba(0,255,156,0.6)" }}>{field.label}</div>
                      {field.description && (
                        <div className="text-[8px]" style={{ color: "rgba(0,255,156,0.25)" }}>{field.description}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      {field.type === "string" && (
                        <input
                          value={field.value}
                          onChange={e => updateField(field.key, e.target.value)}
                          className="w-full bg-transparent text-[11px] outline-none px-2 py-1"
                          style={{
                            color: field.value === "********" ? "#FF2D78" : "#00B4FF",
                            border: "1px solid rgba(0,180,255,0.15)",
                            caretColor: "#00B4FF",
                          }}
                          type={field.value === "********" ? "password" : "text"}
                          data-testid={`config-field-${field.key}`}
                        />
                      )}
                      {field.type === "number" && (
                        <input
                          type="number"
                          value={field.value}
                          onChange={e => updateField(field.key, Number(e.target.value))}
                          className="w-full bg-transparent text-[11px] outline-none px-2 py-1"
                          style={{ color: "#00B4FF", border: "1px solid rgba(0,180,255,0.15)" }}
                          data-testid={`config-field-${field.key}`}
                        />
                      )}
                      {field.type === "boolean" && (
                        <button
                          onClick={() => updateField(field.key, !field.value)}
                          className="flex items-center gap-2 px-2 py-1 text-[10px]"
                          style={{
                            border: `1px solid ${field.value ? "rgba(0,255,156,0.3)" : "rgba(255,45,120,0.2)"}`,
                            color: field.value ? "#00FF9C" : "#FF2D78",
                            background: field.value ? "rgba(0,255,156,0.05)" : "rgba(255,45,120,0.05)",
                          }}
                          data-testid={`config-field-${field.key}`}
                        >
                          {field.value ? "ON" : "OFF"}
                        </button>
                      )}
                      {field.type === "select" && (
                        <select
                          value={field.value}
                          onChange={e => updateField(field.key, e.target.value)}
                          className="w-full bg-[#0a0a0f] text-[11px] outline-none px-2 py-1 appearance-none"
                          style={{ color: "#00B4FF", border: "1px solid rgba(0,180,255,0.15)" }}
                          data-testid={`config-field-${field.key}`}
                        >
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {field.type === "array" && (
                        <div className="space-y-1">
                          {(field.value as string[]).map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="text-[10px] font-mono px-2 py-0.5" style={{ color: "rgba(0,255,156,0.6)", border: "1px solid rgba(0,255,156,0.1)" }}>
                                {item}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Show changed indicator */}
                    {changes[field.key] !== undefined && (
                      <AlertTriangle size={10} style={{ color: "#FFB800", flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {mode === "json" && (
              <textarea
                value={jsonText || toJson()}
                onChange={e => setJsonText(e.target.value)}
                className="w-full h-full bg-transparent text-[11px] font-mono outline-none resize-none"
                style={{
                  color: "#00B4FF",
                  caretColor: "#00B4FF",
                  lineHeight: "1.6",
                }}
                spellCheck={false}
                data-testid="config-json-editor"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
