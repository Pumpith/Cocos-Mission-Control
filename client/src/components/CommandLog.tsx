import { useState, useEffect, useRef } from "react";
import { Pause, Play, Trash2, Terminal, Send } from "lucide-react";

interface LogEntry {
  time: string;
  direction: "in" | "out" | "ok";
  channel?: string;
  sender: string;
  message: string;
}

const INITIAL_LOGS: LogEntry[] = [
  { time: "14:28:12", direction: "in", channel: "Telegram", sender: "USER", message: '"Summarize my unread emails"' },
  { time: "14:28:14", direction: "out", sender: "AGENT", message: "Scanning Gmail via skill: email-reader..." },
  { time: "14:28:18", direction: "ok", sender: "AGENT", message: "12 unread. 3 urgent: invoice from AWS, meeting reschedule from Sarah, PR review from @kai" },
  { time: "14:29:01", direction: "in", channel: "WhatsApp", sender: "USER", message: '"Check my calendar for tomorrow"' },
  { time: "14:29:03", direction: "out", sender: "AGENT", message: "Fetching Google Calendar..." },
  { time: "14:29:05", direction: "ok", sender: "AGENT", message: "You have 3 meetings: Standup 9am, Design Review 2pm, 1:1 4pm" },
  { time: "14:30:22", direction: "in", channel: "Slack", sender: "USER", message: '"What\'s the status of the deployment pipeline?"' },
  { time: "14:30:24", direction: "out", sender: "AGENT", message: "Running system command: kubectl get pods --namespace=prod..." },
  { time: "14:30:27", direction: "ok", sender: "AGENT", message: "All 8 pods healthy. Last deploy: 2h ago. No rollbacks." },
  { time: "14:31:44", direction: "in", channel: "Telegram", sender: "USER", message: '"Send that email draft to John"' },
  { time: "14:31:46", direction: "out", sender: "AGENT", message: "Composing email via Gmail skill..." },
  { time: "14:31:49", direction: "ok", sender: "AGENT", message: "Email sent to john@example.com ✓" },
  { time: "14:32:01", direction: "in", channel: "WhatsApp", sender: "USER", message: '"Browse the web for the latest AI agent frameworks"' },
  { time: "14:32:04", direction: "out", sender: "AGENT", message: "Launching headless browser. Searching: AI agent frameworks 2026..." },
  { time: "14:32:12", direction: "ok", sender: "AGENT", message: "Found 5 results: OpenClaw, LangGraph, CrewAI, AutoGen, Semantic Kernel. Summary compiled." },
  { time: "14:33:00", direction: "in", channel: "Element X", sender: "USER", message: '"Run the backup script on my NAS"' },
  { time: "14:33:02", direction: "out", sender: "AGENT", message: "Executing: ssh nas@192.168.1.50 ./backup.sh..." },
  { time: "14:33:15", direction: "ok", sender: "AGENT", message: "Backup completed: 142GB synced, 0 errors. Duration: 12s" },
];

const FAKE_INCOMING = [
  { channel: "WhatsApp", message: '"What\'s the weather in Doha today?"', response: "Fetching weather data...", result: "Doha: 34°C, sunny, humidity 45%. UV index: extreme. Stay hydrated." },
  { channel: "Telegram", message: '"Remind me to call mom at 6pm"', response: "Setting reminder via cron...", result: "Reminder set: Call mom at 18:00 AST ✓" },
  { channel: "Slack", message: '"Generate a weekly report from JIRA"', response: "Querying JIRA API...", result: "Report: 12 tickets closed, 3 in review, 2 blocked. Sprint velocity: 34 pts." },
  { channel: "Element X", message: '"Check disk usage on the server"', response: "Running: df -h on gateway...", result: "/dev/sda1: 67% used (340GB/512GB). /tmp: clear. No alerts." },
];

function getTimeStr() {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

export default function CommandLog() {
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [paused, setPaused] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fakeIndexRef = useRef(0);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !paused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  // Simulate incoming messages
  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      const fake = FAKE_INCOMING[fakeIndexRef.current % FAKE_INCOMING.length];
      fakeIndexRef.current++;
      const time = getTimeStr();

      setLogs((prev) => [
        ...prev,
        { time, direction: "in", channel: fake.channel, sender: "USER", message: fake.message },
      ]);

      setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          { time: getTimeStr(), direction: "out", sender: "AGENT", message: fake.response },
        ]);
      }, 1500);

      setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          { time: getTimeStr(), direction: "ok", sender: "AGENT", message: fake.result },
        ]);
      }, 3500);
    }, 12000);

    return () => clearInterval(interval);
  }, [paused]);

  const handleCommand = () => {
    if (!input.trim()) return;
    const time = getTimeStr();
    setLogs((prev) => [
      ...prev,
      { time, direction: "in", channel: "CONSOLE", sender: "OPERATOR", message: input },
    ]);

    // Fake response
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        { time: getTimeStr(), direction: "out", sender: "AGENT", message: "Processing command..." },
      ]);
    }, 500);

    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        { time: getTimeStr(), direction: "ok", sender: "AGENT", message: `Command executed: "${input}" — completed successfully ✓` },
      ]);
    }, 2000);

    setInput("");
  };

  const directionSymbol = (d: string) => {
    switch (d) {
      case "in": return "→";
      case "out": return "←";
      case "ok": return "✓";
      default: return "·";
    }
  };

  const directionColor = (d: string) => {
    switch (d) {
      case "in": return "#00B4FF";
      case "out": return "rgba(0,255,156,0.5)";
      case "ok": return "#00FF9C";
      default: return "rgba(0,255,156,0.3)";
    }
  };

  return (
    <div className="terminal-panel flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
          COMMAND LOG // LIVE
          {!paused && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full ml-1"
              style={{
                background: "#00FF9C",
                boxShadow: "0 0 4px #00FF9C",
                animation: "status-pulse 2s ease-in-out infinite",
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-wider transition-all"
            style={{
              border: `1px solid ${paused ? "rgba(255,45,120,0.3)" : "rgba(0,255,156,0.2)"}`,
              color: paused ? "#FF2D78" : "rgba(0,255,156,0.5)",
            }}
            data-testid="button-pause-log"
          >
            {paused ? <Play size={8} /> : <Pause size={8} />}
            {paused ? "RESUME" : "PAUSE"}
          </button>
          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-wider transition-all"
            style={{
              border: "1px solid rgba(255,45,120,0.2)",
              color: "rgba(255,45,120,0.5)",
            }}
            data-testid="button-clear-log"
          >
            <Trash2 size={8} /> CLEAR
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {logs.map((entry, i) => (
          <div
            key={i}
            className="log-entry flex items-start gap-1 text-[11px] leading-relaxed py-0.5 px-1 hover:bg-[rgba(0,255,156,0.02)] transition-colors"
          >
            <span style={{ color: "rgba(0,255,156,0.25)", flexShrink: 0 }}>
              [{entry.time}]
            </span>
            <span style={{ color: directionColor(entry.direction), flexShrink: 0 }}>
              {directionSymbol(entry.direction)}
            </span>
            {entry.channel && (
              <span
                className="text-[9px] px-1"
                style={{
                  color: "#00B4FF",
                  border: "1px solid rgba(0,180,255,0.2)",
                  flexShrink: 0,
                }}
              >
                {entry.channel}
              </span>
            )}
            <span
              className="font-bold"
              style={{
                color: entry.sender === "USER" || entry.sender === "OPERATOR"
                  ? "#00B4FF"
                  : "#00FF9C",
                flexShrink: 0,
              }}
            >
              {entry.sender}:
            </span>
            <span style={{ color: "rgba(0,255,156,0.7)" }}>
              {entry.message}
            </span>
          </div>
        ))}
      </div>

      {/* Command input */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: "1px solid rgba(0,255,156,0.1)" }}
      >
        <span style={{ color: "rgba(0,255,156,0.3)", fontSize: "11px" }}>{">"}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCommand()}
          placeholder="// INJECT COMMAND..."
          className="flex-1 bg-transparent outline-none text-[11px]"
          style={{
            color: "#00FF9C",
            caretColor: "#00FF9C",
          }}
          data-testid="input-command"
        />
        <button
          onClick={handleCommand}
          className="flex items-center gap-1 px-3 py-1 text-[9px] tracking-widest font-bold transition-all"
          style={{
            border: "1px solid rgba(0,255,156,0.3)",
            color: "#00FF9C",
            background: "rgba(0,255,156,0.05)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 8px rgba(0,255,156,0.3)";
            e.currentTarget.style.background = "rgba(0,255,156,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.background = "rgba(0,255,156,0.05)";
          }}
          data-testid="button-execute"
        >
          <Send size={9} /> EXECUTE
        </button>
      </div>
    </div>
  );
}
