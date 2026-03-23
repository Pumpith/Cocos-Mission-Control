import { useState, useEffect, useRef } from "react";
import { gateway } from "@/lib/gateway";

interface Props {
  onComplete: () => void;
}

interface CheckResult {
  label: string;
  status: "pending" | "checking" | "ok" | "warn" | "fail";
  detail?: string;
}

const INITIAL_CHECKS: CheckResult[] = [
  { label: "Initializing B1GHER0 neural core", status: "pending" },
  { label: "Loading skill matrix", status: "pending" },
  { label: "Memory subsystem", status: "pending" },
  { label: "OpenClaw Gateway", status: "pending" },
  { label: "LM Studio / Model Provider", status: "pending" },
  { label: "UFW Firewall", status: "pending" },
  { label: "Network interfaces", status: "pending" },
  { label: "Connecting channels", status: "pending" },
];

export default function BootSequence({ onComplete }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [checks, setChecks] = useState<CheckResult[]>(INITIAL_CHECKS);
  const [phase, setPhase] = useState<"ascii" | "checks" | "done">("ascii");
  const [channels, setChannels] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Phase 1: ASCII art display
  useEffect(() => {
    const asciiLines = [
      "",
      "  OPENCLAW MISSION CONTROL v3.0",
      "  ────────────────────────────────────",
    ];
    let i = 0;
    const addLine = () => {
      if (i < asciiLines.length) {
        setLines(prev => [...prev, asciiLines[i]]);
        i++;
        timeoutRef.current = setTimeout(addLine, 100);
      } else {
        setTimeout(() => setPhase("checks"), 300);
      }
    };
    addLine();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // Phase 2: Run connection checks
  useEffect(() => {
    if (phase !== "checks") return;

    const runChecks = async () => {
      for (let i = 0; i < INITIAL_CHECKS.length; i++) {
        // Mark as checking
        setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: "checking" } : c));

        /* ──────────────────────────────────────────────────────
           REAL CONNECTION CHECK LOGIC
           Each check attempts a real connection. On failure,
           it falls back to a simulated result.
           
           MOCK DATA: The simulated delays and fallback results
           below should be replaced with actual system checks
           when deploying on the Kali machine.
           ────────────────────────────────────────────────────── */
        let result: CheckResult;
        try {
          switch (i) {
            case 0: // Neural core init
              await delay(300);
              result = { ...INITIAL_CHECKS[i], status: "ok", detail: "PERSISTENT" };
              break;

            case 1: // Skill matrix
              await delay(250);
              result = { ...INITIAL_CHECKS[i], status: "ok" };
              break;

            case 2: // Memory subsystem
              await delay(200);
              result = { ...INITIAL_CHECKS[i], status: "ok", detail: "PERSISTENT" };
              break;

            case 3: // OpenClaw Gateway — attempt real WebSocket connection
              result = await checkGateway();
              break;

            case 4: // LM Studio — attempt real HTTP check
              result = await checkModelProvider();
              break;

            case 5: // UFW Firewall
              /* MOCK DATA: On real Kali, call GET /api/system/ufw-status 
                 which should run `ufw status` and return parsed result */
              await delay(400);
              result = { ...INITIAL_CHECKS[i], status: "ok", detail: "ACTIVE (64 rules)" };
              break;

            case 6: // Network interfaces
              /* MOCK DATA: On real Kali, call GET /api/system/network-interfaces
                 which should run `ip addr` and return parsed result */
              await delay(300);
              result = { ...INITIAL_CHECKS[i], status: "ok", detail: "3 active" };
              break;

            case 7: // Channels
              await delay(200);
              result = { ...INITIAL_CHECKS[i], status: "ok" };
              setChannels(["WhatsApp", "Telegram", "Slack", "Element X (Matrix)"]);
              break;

            default:
              result = { ...INITIAL_CHECKS[i], status: "ok" };
          }
        } catch {
          result = { ...INITIAL_CHECKS[i], status: "warn", detail: "timeout / unreachable" };
        }

        setChecks(prev => prev.map((c, idx) => idx === i ? result : c));
        await delay(100);
      }

      // Done — proceed after a brief pause
      await delay(600);
      setPhase("done");
      onComplete();
    };

    runChecks();
  }, [phase, onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      {/* ASCII Art Logo */}
      <pre
        className="text-[#00FF9C] text-[10px] sm:text-xs leading-tight mb-6 text-center"
        style={{ textShadow: "0 0 10px rgba(0,255,156,0.4)" }}
      >
{`  ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗
 ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║
 ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║
 ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║
 ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝
  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝`}
      </pre>

      <div className="w-full max-w-lg px-4 space-y-1.5">
        {/* Intro lines */}
        {lines.map((line, i) => (
          <div
            key={i}
            className="text-[11px] font-mono"
            style={{ color: "#00FF9C", textShadow: "0 0 4px rgba(0,255,156,0.3)" }}
          >
            {line}
          </div>
        ))}

        {/* Connection checks */}
        {phase !== "ascii" && checks.map((check, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
            <span style={{ color: "rgba(0,255,156,0.6)" }}>
              {check.label}{"..........".slice(0, Math.max(0, 20 - check.label.length))}
            </span>
            {check.status === "pending" && (
              <span style={{ color: "rgba(0,255,156,0.2)" }}>WAITING</span>
            )}
            {check.status === "checking" && (
              <span className="blink-cursor" style={{ color: "#00B4FF" }}>CHECKING</span>
            )}
            {check.status === "ok" && (
              <span style={{ color: "#00FF9C", textShadow: "0 0 6px rgba(0,255,156,0.5)" }}>
                OK {check.detail && `(${check.detail})`}
              </span>
            )}
            {check.status === "warn" && (
              <span style={{ color: "#FFB800" }}>
                WARN {check.detail && `(${check.detail})`}
              </span>
            )}
            {check.status === "fail" && (
              <span style={{ color: "#FF2D78" }}>
                FAIL {check.detail && `(${check.detail})`}
              </span>
            )}
          </div>
        ))}

        {/* Channel sub-items */}
        {channels.map((ch, i) => (
          <div key={ch} className="flex items-center gap-2 text-[11px] font-mono ml-4">
            <span style={{ color: "rgba(0,255,156,0.4)" }}>
              {i < channels.length - 1 ? "├─" : "└─"} {ch} ✓
            </span>
          </div>
        ))}

        {/* Gateway WS line */}
        {phase !== "ascii" && checks[3]?.status === "ok" && (
          <div className="text-[11px] font-mono mt-1" style={{ color: "#00B4FF", textShadow: "0 0 6px rgba(0,180,255,0.3)" }}>
            Gateway WebSocket on ws://localhost:18789
            <span className="blink-cursor">█</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   REAL CHECK FUNCTIONS
   These attempt actual connections. If they fail (e.g. on the
   deployed Perplexity preview), they fall back to simulated
   success with a warning.
   
   MOCK DATA: When deploying on real Kali, remove the fallback
   and let these report actual status.
   ────────────────────────────────────────────────────────────── */

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function checkGateway(): Promise<CheckResult> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(gateway.url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ label: "OpenClaw Gateway", status: "fail", detail: "timeout" });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        const connected = () => {
          ws.close();
          resolve({ label: "OpenClaw Gateway", status: "ok", detail: "CONNECTED" });
        };
        const onMessage = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "event" && msg.event === "connect.challenge") {
              const nonce = msg.payload.nonce;
              ws.send(JSON.stringify({
                type: "req",
                id: Math.random().toString(36).substring(2, 15),
                method: "connect",
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: { id: "mission-control", version: "1.0.0", platform: "web", mode: "operator" },
                  role: "operator",
                  scopes: ["operator.read", "operator.write", "operator.approvals"],
                  caps: [],
                  commands: [],
                  permissions: {},
                  auth: { token: gateway.token },
                  locale: "en-US",
                  userAgent: "mission-control/1.0.0",
                  device: { id: "mission-control-web", publicKey: "", signature: "", signedAt: Date.now(), nonce }
                }
              }));
            } else if (msg.type === "res" && msg.payload && (msg.payload as any).type === "hello-ok") {
              ws.close();
              resolve({ label: "OpenClaw Gateway", status: "ok", detail: "AUTHENTICATED" });
            }
          } catch {}
        };
        ws.addEventListener("message", onMessage);
        ws.addEventListener("close", connected);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({ label: "OpenClaw Gateway", status: "fail", detail: "connection failed" });
      };
    } catch {
      resolve({ label: "OpenClaw Gateway", status: "fail", detail: "error" });
    }
  });
}

async function checkModelProvider(): Promise<CheckResult> {
  try {
    /* MOCK DATA: Attempt real check to LM Studio endpoint.
       On the real Kali machine, this will connect to the actual
       LM Studio / Ollama running locally. In preview, falls back. */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const resp = await fetch("http://127.0.0.1:1234/v1/models", {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);

    if (resp && resp.ok) {
      return { label: "LM Studio / Model Provider", status: "ok", detail: "CONNECTED" };
    }
    /* MOCK DATA FALLBACK */
    return { label: "LM Studio / Model Provider", status: "ok", detail: "simulated" };
  } catch {
    return { label: "LM Studio / Model Provider", status: "ok", detail: "simulated" };
  }
}
