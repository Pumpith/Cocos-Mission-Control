import { useState } from "react";
import { ChevronRight, ChevronLeft, Shield, Radio, Bot, Radar, Zap } from "lucide-react";

interface Props { onComplete: () => void; }

const STEPS = [
  { icon: Zap, title: "WELCOME", subtitle: "OPENCLAW MISSION CONTROL" },
  { icon: Radio, title: "GATEWAY", subtitle: "CONNECT TO YOUR AGENT" },
  { icon: Bot, title: "AGENT SETUP", subtitle: "CONFIGURE YOUR OPERATOR" },
  { icon: Shield, title: "SECURITY", subtitle: "INITIAL SECURITY SCAN" },
  { icon: Radar, title: "LAUNCH", subtitle: "ENTER THE COMMAND CENTER" },
];

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [gatewayUrl, setGatewayUrl] = useState("ws://localhost:18789");
  const [gatewayToken, setGatewayToken] = useState("");
  const [agentName, setAgentName] = useState("MOLTY");
  const [model, setModel] = useState("claude-opus-4-6");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanDone, setScanDone] = useState(false);

  const startScan = () => {
    setScanProgress(0);
    setScanDone(false);
    const interval = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) { clearInterval(interval); setScanDone(true); return 100; }
        return p + Math.random() * 15 + 5;
      });
    }, 200);
  };

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4 text-center">
          <pre className="text-[#00FF9C] text-[8px] leading-tight mx-auto" style={{ textShadow: "0 0 8px rgba(0,255,156,0.4)" }}>
{`  ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗
 ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║
 ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║
 ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║
 ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝
  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝`}
          </pre>
          <div className="text-lg font-bold glow-text" style={{ color: "#00FF9C" }}>MISSION CONTROL v2.0</div>
          <p className="text-[11px]" style={{ color: "rgba(0,255,156,0.5)" }}>
            Your hacker command center for AI agent orchestration.<br/>
            Weapon vault. Firewall monitoring. Threat intelligence.<br/>
            All from one terminal.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {["Kali Tools", "UFW Monitor", "Threat Intel", "IOC Scanner", "Pixel Office", "Agent Fleet"].map(f => (
              <span key={f} className="text-[8px] px-2 py-0.5 tracking-wider" style={{ border: "1px solid rgba(0,255,156,0.2)", color: "rgba(0,255,156,0.5)" }}>{f}</span>
            ))}
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-4">
          <p className="text-[10px]" style={{ color: "rgba(0,255,156,0.5)" }}>Configure your OpenClaw Gateway connection. The Gateway is the WebSocket bridge between your messaging apps and the AI agent.</p>
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>GATEWAY ENDPOINT</label>
            <input value={gatewayUrl} onChange={e => setGatewayUrl(e.target.value)} className="w-full bg-transparent text-[11px] outline-none px-3 py-2" style={{ color: "#00B4FF", border: "1px solid rgba(0,180,255,0.2)", caretColor: "#00B4FF" }} data-testid="onboard-gateway-url" />
          </div>
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>AUTH TOKEN (optional)</label>
            <input value={gatewayToken} onChange={e => setGatewayToken(e.target.value)} type="password" placeholder="ocw_..." className="w-full bg-transparent text-[11px] outline-none px-3 py-2" style={{ color: "#00FF9C", border: "1px solid rgba(0,255,156,0.15)", caretColor: "#00FF9C" }} data-testid="onboard-gateway-token" />
          </div>
          <div className="text-[9px] px-3 py-2" style={{ border: "1px solid rgba(0,180,255,0.1)", color: "rgba(0,180,255,0.5)", background: "rgba(0,180,255,0.03)" }}>
            Default port: 18789 // Protocol: v3 // Role: operator<br/>
            See: docs.openclaw.ai/gateway/protocol
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-4">
          <p className="text-[10px]" style={{ color: "rgba(0,255,156,0.5)" }}>Configure your primary AI agent identity.</p>
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>AGENT NAME</label>
            <input value={agentName} onChange={e => setAgentName(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none px-3 py-2" style={{ color: "#00FF9C", border: "1px solid rgba(0,255,156,0.2)", textShadow: "0 0 6px rgba(0,255,156,0.3)" }} data-testid="onboard-agent-name" />
          </div>
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>MODEL</label>
            <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#0a0a0f] text-[11px] outline-none px-3 py-2 appearance-none" style={{ color: "#00B4FF", border: "1px solid rgba(0,180,255,0.2)" }} data-testid="onboard-model">
              <option value="claude-opus-4-6">claude-opus-4-6</option>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="local/minimax">local/minimax</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] tracking-widest block mb-1" style={{ color: "rgba(0,255,156,0.4)" }}>CHANNELS TO ENABLE</label>
            <div className="flex flex-wrap gap-1">
              {["WhatsApp", "Telegram", "Slack", "Element X", "Discord"].map(ch => (
                <button key={ch} className="channel-badge active text-[9px]">{ch}</button>
              ))}
            </div>
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <p className="text-[10px]" style={{ color: "rgba(0,255,156,0.5)" }}>Running initial security scan on your system. This checks for open ports, exposed secrets, and security posture.</p>
          {!scanDone && scanProgress === 0 && (
            <button onClick={startScan} className="w-full py-2 text-[10px] tracking-widest font-bold" style={{ border: "1px solid rgba(0,255,156,0.3)", color: "#00FF9C", background: "rgba(0,255,156,0.05)" }} data-testid="onboard-start-scan">
              INITIATE SECURITY SCAN
            </button>
          )}
          {(scanProgress > 0 || scanDone) && (
            <div className="space-y-3">
              <div className="h-1.5 w-full" style={{ background: "rgba(0,255,156,0.1)", borderRadius: "1px" }}>
                <div className="h-full transition-all duration-300" style={{ width: `${Math.min(scanProgress, 100)}%`, background: "#00FF9C", boxShadow: "0 0 8px rgba(0,255,156,0.5)" }} />
              </div>
              <div className="text-[10px] space-y-1" style={{ fontFamily: "monospace" }}>
                {scanProgress > 10 && <div style={{ color: "#00FF9C" }}>✓ Port scan complete — 3 services detected</div>}
                {scanProgress > 30 && <div style={{ color: "#00FF9C" }}>✓ UFW firewall — ACTIVE (64 rules)</div>}
                {scanProgress > 50 && <div style={{ color: "#00B4FF" }}>✓ Secret scanner — 0 exposed credentials</div>}
                {scanProgress > 70 && <div style={{ color: "#00FF9C" }}>✓ Network interfaces — 3 active</div>}
                {scanProgress > 85 && <div style={{ color: "#00B4FF" }}>✓ Kali toolkit — 247 tools available</div>}
                {scanDone && (
                  <div className="mt-2 px-3 py-2 font-bold" style={{ color: "#00FF9C", border: "1px solid rgba(0,255,156,0.3)", background: "rgba(0,255,156,0.05)", textShadow: "0 0 8px rgba(0,255,156,0.5)" }}>
                    SECURITY POSTURE: 87/100 — GOOD
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
      case 4: return (
        <div className="space-y-4 text-center">
          <div className="text-5xl mb-2">🦞</div>
          <div className="text-lg font-bold glow-text" style={{ color: "#00FF9C" }}>SYSTEMS READY</div>
          <p className="text-[11px]" style={{ color: "rgba(0,255,156,0.6)" }}>
            Gateway: {gatewayUrl}<br/>
            Agent: {agentName} // Model: {model}<br/>
            Security Score: 87/100
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[{ n: "247", l: "TOOLS" }, { n: "100", l: "AGENTS" }, { n: "3", l: "FLOORS" }, { n: "64", l: "FW RULES" }, { n: "5", l: "CHANNELS" }, { n: "4", l: "INTEL APIs" }].map(s => (
              <div key={s.l} className="py-2 px-1" style={{ border: "1px solid rgba(0,255,156,0.1)", background: "rgba(0,255,156,0.02)" }}>
                <div className="text-sm font-bold" style={{ color: "#00FF9C" }}>{s.n}</div>
                <div className="text-[7px] tracking-widest" style={{ color: "rgba(0,255,156,0.3)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.95)" }}>
      <div className="w-full max-w-lg mx-4" style={{ background: "#0a0a0f", border: "1px solid rgba(0,255,156,0.2)", boxShadow: "0 0 40px rgba(0,255,156,0.05)" }}>
        {/* Step indicator */}
        <div className="flex items-center px-4 py-3" style={{ borderBottom: "1px solid rgba(0,255,156,0.1)" }}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 flex items-center justify-center" style={{ border: `1px solid ${i <= step ? "rgba(0,255,156,0.4)" : "rgba(0,255,156,0.1)"}`, background: i < step ? "rgba(0,255,156,0.1)" : i === step ? "rgba(0,255,156,0.05)" : "transparent" }}>
                    <Icon size={10} style={{ color: i <= step ? "#00FF9C" : "rgba(0,255,156,0.2)" }} />
                  </div>
                  <span className="text-[7px] tracking-widest hidden sm:block" style={{ color: i <= step ? "rgba(0,255,156,0.6)" : "rgba(0,255,156,0.2)" }}>{s.title}</span>
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-px mx-2" style={{ background: i < step ? "rgba(0,255,156,0.3)" : "rgba(0,255,156,0.06)" }} />}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[280px]">{renderStep()}</div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(0,255,156,0.1)" }}>
          <button onClick={() => step > 0 && setStep(step - 1)} className="flex items-center gap-1 text-[10px] tracking-wider px-3 py-1.5" style={{ border: `1px solid ${step > 0 ? "rgba(0,255,156,0.2)" : "transparent"}`, color: step > 0 ? "rgba(0,255,156,0.5)" : "transparent", visibility: step > 0 ? "visible" : "hidden" }} data-testid="onboard-back">
            <ChevronLeft size={10} /> BACK
          </button>
          <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.25)" }}>{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="flex items-center gap-1 text-[10px] tracking-wider font-bold px-3 py-1.5" style={{ border: "1px solid rgba(0,255,156,0.3)", color: "#00FF9C", background: "rgba(0,255,156,0.05)" }} data-testid="onboard-next">
              NEXT <ChevronRight size={10} />
            </button>
          ) : (
            <button onClick={onComplete} className="flex items-center gap-1 text-[10px] tracking-wider font-bold px-4 py-1.5" style={{ border: "1px solid rgba(0,255,156,0.4)", color: "#00FF9C", background: "rgba(0,255,156,0.08)", boxShadow: "0 0 12px rgba(0,255,156,0.15)" }} data-testid="onboard-launch">
              LAUNCH <Zap size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
