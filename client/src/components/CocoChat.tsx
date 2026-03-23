import { useState, useRef, useEffect } from "react";
import {
  Send, Paperclip, Shield, Key, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Terminal, Bot, User,
  FileText, Image as ImageIcon, File, Loader2, X,
  Package, Download, Check, AlertCircle
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   COCO CHAT BOX — Dashboard Chat Widget
   Embedded chat interface on the home page to talk to Coco 🎃.

   ┌─────────────────────────────────────────────────────────┐
   │  GATEWAY INTEGRATION (LIVE)                             │
   │  ─────────────────────────────────────────────────────── │
   │  When connected to the OpenClaw Gateway via WebSocket:  │
   │                                                         │
   │  • Messages sent via: ws.send({ type: "req",            │
   │    method: "chat.send", params: { message, files } })   │
   │  • Responses streamed via: event "chat.response"        │
   │    payload contains token-by-token streamed text        │
   │  • File attachments: encode as base64 in params.files[] │
   │    with { name, mimeType, data } objects                │
   │  • Slash commands (/status, /usage, /config, etc.)      │
   │    are sent as regular messages through chat.send       │
   │  • The Gateway handles routing to the active agent      │
   │    (Coco) and returns responses in the same session     │
   │                                                         │
   │  Scope required: operator.read + operator.write         │
   │                                                         │
   │  APPROVAL SYSTEM (LIVE)                                 │
   │  ─────────────────────────────────────────────────────── │
   │  • Gateway broadcasts "exec.approval.requested" event   │
   │    when Coco needs permission to run a command           │
   │  • Contains: { id, command, rawCommand, cwd, risk }     │
   │  • Resolve via: ws.send({ type: "req",                  │
   │    method: "exec.approval.resolve",                     │
   │    params: { id, approved: true/false, password? } })   │
   │  • Scope required: operator.approvals                   │
   │  • The systemRunPlan field contains canonical argv,     │
   │    cwd, rawCommand, and session metadata                │
   │  • For sudo commands, password is passed in resolve     │
   │                                                         │
   │  COCO MONITORING NOTES                                  │
   │  ─────────────────────────────────────────────────────── │
   │  • If user changes the agent name in IDENTITY.md,       │
   │    Coco should update the chat header display name      │
   │  • If user changes persona in SOUL.md, the agent's     │
   │    tone/behavior in responses will change               │
   │  • If user modifies AGENTS.md rules, the agent's       │
   │    response patterns and memory handling changes        │
   │  • Chat history is per-session; sessions stored in      │
   │    ~/.openclaw/agents/<agentId>/sessions/                │
   │  • The model being used is configured in                │
   │    openclaw.json → agents.defaults.model.primary        │
   │    and can be switched at runtime via /model command     │
   └─────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  files?: { name: string; type: string; size: number }[];
  isStreaming?: boolean;
}

interface ApprovalRequest {
  id: string;
  command: string;
  rawCommand: string;
  cwd: string;
  risk: "low" | "medium" | "high" | "critical";
  needsSudo: boolean;
  timestamp: Date;
  status: "pending" | "approved" | "denied";
  /* MOCK DATA: On real deployment, these come from the
     exec.approval.requested event via Gateway WebSocket.
     The systemRunPlan field contains the canonical argv array,
     cwd, rawCommand, and session metadata. */
}

/* MOCK DATA: Simulated chat messages — replace with actual
   Gateway WebSocket chat.send / chat.response event flow.
   Real messages stream token-by-token from the gateway. */
const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "sys-1",
    role: "system",
    content: "Session started. Coco 🎃 is online and ready. Type a message or use /commands.",
    timestamp: new Date(Date.now() - 300000),
  },
  {
    id: "u-1",
    role: "user",
    content: "Hey Coco, what's the current system status?",
    timestamp: new Date(Date.now() - 240000),
  },
  {
    id: "a-1",
    role: "assistant",
    content: "Hey! 🎃 Everything's looking good:\n\n• **Gateway**: Connected on ws://localhost:18789 (protocol v3)\n• **Model**: claude-opus-4-6 via LM Studio (local)\n• **Memory**: 4.2GB used, daily log updated\n• **Active sessions**: 1 (this one)\n• **UFW**: Active, 64 rules, 3 blocked in last hour\n• **Uptime**: 4d 12h 37m\n\nAll systems nominal. What do you need?",
    timestamp: new Date(Date.now() - 230000),
  },
  {
    id: "u-2",
    role: "user",
    content: "Run a security scan on the network",
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: "a-2",
    role: "assistant",
    content: "I'll run an nmap scan on your local network. This requires elevated permissions — I'm sending an approval request now.",
    timestamp: new Date(Date.now() - 110000),
  },
];

/* MOCK DATA: Simulated approval requests — replace with
   exec.approval.requested events from Gateway WebSocket.
   Real approvals include systemRunPlan with argv, cwd, session data. */
const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: "apr-1",
    command: "nmap -sV -p- 192.168.1.0/24",
    rawCommand: "sudo nmap -sV -p- 192.168.1.0/24",
    cwd: "/home/openclaw",
    risk: "medium",
    needsSudo: true,
    timestamp: new Date(Date.now() - 100000),
    status: "pending",
  },
];

/**
 * MOCK DATA — Package install statuses
 * In production, package install commands are sent via Gateway:
 * ws.send({ type: "req", method: "chat.send",
 *   params: { message: "/install apt nmap" } })
 * Coco interprets the command and creates an exec.approval.requested
 * event for the actual install command (e.g., sudo apt install -y nmap).
 * The install status is tracked via Gateway exec events.
 */
interface PackageInstall {
  id: string;
  name: string;
  manager: "apt" | "pip" | "npm" | "snap" | "gem";
  status: "pending" | "installing" | "installed" | "failed";
  requestedAt: Date;
  output?: string;
}

export default function CocoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(MOCK_APPROVALS);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showApprovals, setShowApprovals] = useState(true);
  const [showInstaller, setShowInstaller] = useState(false);
  const [installPkg, setInstallPkg] = useState("");
  const [installMgr, setInstallMgr] = useState<"apt" | "pip" | "npm">("apt");
  const [installs, setInstalls] = useState<PackageInstall[]>([]);
  const [sudoPassword, setSudoPassword] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pendingApprovals = approvals.filter(a => a.status === "pending");

  const handleSend = () => {
    if (!input.trim() && files.length === 0) return;

    const newMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      files: files.map(f => ({ name: f.name, type: f.type, size: f.size })),
    };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setFiles([]);

    /* MOCK DATA: Simulate Coco responding after a delay.
       On real deployment, send via Gateway WebSocket:
       ws.send({ type: "req", id: uuid(), method: "chat.send",
         params: { message: input, files: base64EncodedFiles } })
       Then listen for "chat.response" events for streamed tokens. */
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "Got it! I'm working on that now. 🎃",
        timestamp: new Date(),
      }]);
    }, 1500);
  };

  const handleApproval = (id: string, approved: boolean) => {
    /* MOCK DATA: On real deployment, resolve via Gateway:
       ws.send({ type: "req", id: uuid(),
         method: "exec.approval.resolve",
         params: { id, approved, password: sudoPassword || undefined } })
       Requires scope: operator.approvals */
    setApprovals(prev => prev.map(a =>
      a.id === id ? { ...a, status: approved ? "approved" : "denied" } : a
    ));
    setSudoPassword("");
  };

  /**
   * PACKAGE INSTALL HANDLER
   * Sends an install request to Coco. In production, this triggers:
   * 1. chat.send with message: "/install {manager} {package}"
   * 2. Coco creates an exec.approval.requested for the sudo command
   * 3. User approves → Coco runs the install → output streamed back
   * Package managers supported: apt (Kali default), pip, npm, snap, gem
   */
  const handleInstallPackage = () => {
    if (!installPkg.trim()) return;

    const pkgName = installPkg.trim();
    const mgr = installMgr;
    const installCmd = mgr === "apt" ? `sudo apt install -y ${pkgName}`
      : mgr === "pip" ? `pip install ${pkgName}`
      : `npm install -g ${pkgName}`;

    // Add to installs list
    const newInstall: PackageInstall = {
      id: `inst-${Date.now()}`,
      name: pkgName,
      manager: mgr,
      status: "pending",
      requestedAt: new Date(),
    };
    setInstalls(prev => [newInstall, ...prev]);

    // Add chat message
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: "user",
      content: `Install ${pkgName} via ${mgr}`,
      timestamp: new Date(),
    }]);

    // If apt, create approval request (needs sudo)
    if (mgr === "apt") {
      setApprovals(prev => [...prev, {
        id: `apr-inst-${Date.now()}`,
        command: `apt install -y ${pkgName}`,
        rawCommand: installCmd,
        cwd: "/home/openclaw",
        risk: "medium",
        needsSudo: true,
        timestamp: new Date(),
        status: "pending",
      }]);
      setShowApprovals(true);
    }

    // MOCK: Simulate Coco responding
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      if (mgr === "apt") {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `I'll install **${pkgName}** via apt. This needs sudo — check the approval panel above. 🎃`,
          timestamp: new Date(),
        }]);
      } else {
        // pip/npm don't need sudo approval
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `Installing **${pkgName}** via ${mgr}... \n\n\`\`\`\n$ ${installCmd}\nResolving dependencies...\nInstalling ${pkgName}@latest\nDone ✓\n\`\`\`\n\n${pkgName} installed successfully. 🎃`,
          timestamp: new Date(),
        }]);
        setInstalls(prev => prev.map(i =>
          i.id === newInstall.id ? { ...i, status: "installed" as const, output: `Installed ${pkgName} successfully` } : i
        ));
      }
    }, 1500);

    setInstallPkg("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const riskColors: Record<string, string> = {
    low: "#00FF9C",
    medium: "#FFB800",
    high: "#FF6B35",
    critical: "#FF2D78",
  };

  return (
    <div className="flex flex-col h-full" style={{ border: "1px solid rgba(0,255,156,0.12)", background: "rgba(0,0,0,0.4)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,255,156,0.1)" }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🎃</span>
          <span className="text-[10px] font-bold tracking-widest" style={{ color: "#00FF9C" }}>
            // COCO CHAT
          </span>
          <span className="text-[8px] px-1.5 py-0.5" style={{ color: "#00FF9C", border: "1px solid rgba(0,255,156,0.2)", background: "rgba(0,255,156,0.05)" }}>
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Package Install Button */}
          <button
            onClick={() => setShowInstaller(!showInstaller)}
            className="flex items-center gap-1 px-2 py-0.5 text-[8px] tracking-wider"
            style={{
              border: `1px solid ${showInstaller ? "rgba(0,180,255,0.4)" : "rgba(0,180,255,0.15)"}`,
              color: showInstaller ? "#00B4FF" : "rgba(0,180,255,0.5)",
              background: showInstaller ? "rgba(0,180,255,0.08)" : "transparent",
            }}
            data-testid="install-toggle"
          >
            <Package size={9} /> INSTALL
          </button>

          {pendingApprovals.length > 0 && (
            <button
              onClick={() => setShowApprovals(!showApprovals)}
              className="flex items-center gap-1 px-2 py-0.5 text-[8px] tracking-wider animate-pulse"
              style={{ border: "1px solid rgba(255,184,0,0.4)", color: "#FFB800", background: "rgba(255,184,0,0.08)" }}
              data-testid="approval-toggle"
            >
              <Shield size={10} />
              {pendingApprovals.length} PENDING
              {showApprovals ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
            </button>
          )}
        </div>
      </div>

      {/* Package Installer Panel */}
      {showInstaller && (
        <div className="flex-shrink-0 p-2 space-y-2" style={{ borderBottom: "1px solid rgba(0,180,255,0.15)", background: "rgba(0,180,255,0.02)" }}>
          <div className="text-[8px] tracking-widest font-bold" style={{ color: "#00B4FF" }}>
            // 📦 ASK COCO TO INSTALL A PACKAGE ON KALI
          </div>
          <div className="flex items-center gap-1.5">
            {/* Package Manager Selector */}
            <div className="flex gap-0.5">
              {(["apt", "pip", "npm"] as const).map(mgr => (
                <button
                  key={mgr}
                  onClick={() => setInstallMgr(mgr)}
                  className="text-[8px] px-2 py-0.5 tracking-wider"
                  style={{
                    border: `1px solid ${installMgr === mgr ? "rgba(0,180,255,0.4)" : "rgba(0,180,255,0.1)"}`,
                    color: installMgr === mgr ? "#00B4FF" : "rgba(0,180,255,0.3)",
                    background: installMgr === mgr ? "rgba(0,180,255,0.08)" : "transparent",
                  }}
                  data-testid={`mgr-${mgr}`}
                >
                  {mgr.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              value={installPkg}
              onChange={e => setInstallPkg(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleInstallPackage(); }}
              placeholder={installMgr === "apt" ? "e.g., nmap, wireshark, hydra..." : installMgr === "pip" ? "e.g., requests, scapy..." : "e.g., pm2, nodemon..."}
              className="flex-1 bg-transparent text-[9px] outline-none font-mono px-2 py-0.5"
              style={{ border: "1px solid rgba(0,180,255,0.15)", color: "#00B4FF", caretColor: "#00B4FF" }}
              data-testid="install-input"
            />
            <button
              onClick={handleInstallPackage}
              className="flex items-center gap-1 px-2 py-0.5 text-[8px] tracking-wider"
              style={{ border: "1px solid rgba(0,180,255,0.3)", color: "#00B4FF", background: "rgba(0,180,255,0.08)" }}
              data-testid="install-submit"
            >
              <Download size={9} /> INSTALL
            </button>
          </div>
          <div className="text-[7px]" style={{ color: "rgba(0,180,255,0.3)" }}>
            {installMgr === "apt" && "Requires sudo approval • Coco will run: sudo apt install -y [package]"}
            {installMgr === "pip" && "No sudo needed • Coco will run: pip install [package]"}
            {installMgr === "npm" && "No sudo needed • Coco will run: npm install -g [package]"}
          </div>
          {/* Recent installs */}
          {installs.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {installs.slice(0, 5).map(inst => (
                <div key={inst.id} className="flex items-center gap-2 text-[8px]">
                  {inst.status === "installed" ? <Check size={8} style={{ color: "#00FF9C" }} /> :
                   inst.status === "failed" ? <AlertCircle size={8} style={{ color: "#FF2D78" }} /> :
                   inst.status === "installing" ? <Loader2 size={8} className="animate-spin" style={{ color: "#00B4FF" }} /> :
                   <Package size={8} style={{ color: "rgba(0,180,255,0.3)" }} />}
                  <span style={{ color: inst.status === "installed" ? "#00FF9C" : inst.status === "failed" ? "#FF2D78" : "rgba(0,180,255,0.5)" }}>
                    {inst.manager} install {inst.name}
                  </span>
                  <span className="text-[7px] ml-auto" style={{ color: "rgba(0,255,156,0.2)" }}>
                    {inst.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approval Panel */}
      {showApprovals && pendingApprovals.length > 0 && (
        <div className="flex-shrink-0 p-2 space-y-2" style={{ borderBottom: "1px solid rgba(255,184,0,0.15)", background: "rgba(255,184,0,0.03)" }}>
          <div className="text-[8px] tracking-widest font-bold" style={{ color: "#FFB800" }}>
            // ⚠ APPROVAL REQUESTS
          </div>
          {pendingApprovals.map(apr => (
            <div key={apr.id} className="p-2 space-y-1.5" style={{ border: `1px solid ${riskColors[apr.risk]}30`, background: "rgba(0,0,0,0.4)" }}>
              <div className="flex items-center gap-2">
                <Terminal size={10} style={{ color: riskColors[apr.risk] }} />
                <span className="text-[9px] font-mono flex-1" style={{ color: "#00B4FF" }}>{apr.rawCommand}</span>
                <span className="text-[7px] px-1.5 py-0.5 font-bold tracking-wider" style={{ color: riskColors[apr.risk], border: `1px solid ${riskColors[apr.risk]}40` }}>
                  {apr.risk.toUpperCase()}
                </span>
              </div>
              <div className="text-[8px] font-mono" style={{ color: "rgba(0,255,156,0.3)" }}>
                cwd: {apr.cwd}
              </div>

              {/* Sudo password input if needed */}
              {apr.needsSudo && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Key size={9} style={{ color: "#FF2D78" }} />
                  <input
                    type="password"
                    placeholder="sudo password..."
                    value={sudoPassword}
                    onChange={e => setSudoPassword(e.target.value)}
                    className="flex-1 bg-transparent text-[9px] outline-none px-2 py-0.5"
                    style={{ border: "1px solid rgba(255,45,120,0.2)", color: "#FF2D78", caretColor: "#FF2D78" }}
                    data-testid="sudo-password"
                  />
                </div>
              )}

              {/* Approve / Deny buttons */}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleApproval(apr.id, true)}
                  className="flex items-center gap-1 px-3 py-1 text-[8px] tracking-wider font-bold"
                  style={{ border: "1px solid rgba(0,255,156,0.3)", color: "#00FF9C", background: "rgba(0,255,156,0.08)" }}
                  data-testid={`approve-${apr.id}`}
                >
                  <CheckCircle size={10} /> APPROVE
                </button>
                <button
                  onClick={() => handleApproval(apr.id, false)}
                  className="flex items-center gap-1 px-3 py-1 text-[8px] tracking-wider font-bold"
                  style={{ border: "1px solid rgba(255,45,120,0.3)", color: "#FF2D78", background: "rgba(255,45,120,0.08)" }}
                  data-testid={`deny-${apr.id}`}
                >
                  <XCircle size={10} /> DENY
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role !== "user" && (
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] mt-0.5" style={{ border: "1px solid rgba(0,255,156,0.2)", borderRadius: "2px" }}>
                {msg.role === "assistant" ? "🎃" : <AlertTriangle size={10} style={{ color: "#FFB800" }} />}
              </div>
            )}
            <div
              className="max-w-[85%] px-2.5 py-1.5"
              style={{
                background: msg.role === "user" ? "rgba(0,180,255,0.08)" : msg.role === "system" ? "rgba(255,184,0,0.05)" : "rgba(0,255,156,0.04)",
                border: `1px solid ${msg.role === "user" ? "rgba(0,180,255,0.15)" : msg.role === "system" ? "rgba(255,184,0,0.1)" : "rgba(0,255,156,0.08)"}`,
              }}
            >
              <div className="text-[10px] font-mono whitespace-pre-wrap" style={{ color: msg.role === "user" ? "#00B4FF" : msg.role === "system" ? "#FFB800" : "rgba(0,255,156,0.8)", lineHeight: "1.5" }}>
                {msg.content}
              </div>
              {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {msg.files.map((f, i) => (
                    <span key={i} className="text-[7px] px-1.5 py-0.5 flex items-center gap-1" style={{ border: "1px solid rgba(0,180,255,0.2)", color: "rgba(0,180,255,0.6)" }}>
                      <FileText size={7} /> {f.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-[7px] mt-1" style={{ color: "rgba(0,255,156,0.2)" }}>
                {msg.timestamp.toLocaleTimeString("en-US", { hour12: false })}
              </div>
            </div>
            {msg.role === "user" && (
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] mt-0.5" style={{ border: "1px solid rgba(0,180,255,0.2)", borderRadius: "2px" }}>
                <User size={10} style={{ color: "#00B4FF" }} />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2 items-center">
            <div className="w-5 h-5 flex items-center justify-center text-[10px]" style={{ border: "1px solid rgba(0,255,156,0.2)", borderRadius: "2px" }}>🎃</div>
            <div className="flex items-center gap-1 px-2.5 py-1.5" style={{ border: "1px solid rgba(0,255,156,0.08)", background: "rgba(0,255,156,0.04)" }}>
              <Loader2 size={10} className="animate-spin" style={{ color: "#00FF9C" }} />
              <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.5)" }}>Coco is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Attachments Preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-1 flex-shrink-0" style={{ borderTop: "1px solid rgba(0,255,156,0.05)" }}>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 text-[8px]" style={{ border: "1px solid rgba(0,180,255,0.2)", color: "rgba(0,180,255,0.6)" }}>
              {f.type.startsWith("image/") ? <ImageIcon size={8} /> : <File size={8} />}
              <span className="max-w-[80px] truncate">{f.name}</span>
              <button onClick={() => removeFile(i)}><X size={8} style={{ color: "#FF2D78" }} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 flex-shrink-0" style={{ borderTop: "1px solid rgba(0,255,156,0.1)", background: "rgba(0,0,0,0.3)" }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
          data-testid="chat-file-input"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center w-7 h-7 flex-shrink-0"
          style={{ border: "1px solid rgba(0,255,156,0.12)", background: "rgba(0,255,156,0.03)", borderRadius: "2px" }}
          title="Attach files"
          data-testid="chat-attach"
        >
          <Paperclip size={12} style={{ color: "rgba(0,255,156,0.4)" }} />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Talk to Coco... (or /commands)"
          className="flex-1 bg-transparent text-[10px] outline-none font-mono"
          style={{ color: "#00FF9C", caretColor: "#00FF9C" }}
          data-testid="chat-input"
        />
        <button
          onClick={handleSend}
          className="flex items-center justify-center w-7 h-7 flex-shrink-0"
          style={{ border: "1px solid rgba(0,255,156,0.2)", background: "rgba(0,255,156,0.06)", borderRadius: "2px" }}
          data-testid="chat-send"
        >
          <Send size={12} style={{ color: "#00FF9C" }} />
        </button>
      </div>
    </div>
  );
}
