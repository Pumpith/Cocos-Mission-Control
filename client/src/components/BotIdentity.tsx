import { useState } from "react";
import { Bot, ChevronDown } from "lucide-react";

const MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "gpt-4o",
  "local/minimax",
];

const CHANNELS = [
  { name: "WhatsApp", active: true },
  { name: "Telegram", active: true },
  { name: "Discord", active: false },
  { name: "Slack", active: true },
  { name: "iMessage", active: false },
  { name: "Element X", active: true },
];

export default function BotIdentity() {
  const [name, setName] = useState("MOLTY");
  const [persona, setPersona] = useState(
    "24/7 personal AI agent. Access to full system. Memory: persistent. Mission: whatever you need."
  );
  const [model, setModel] = useState(MODELS[0]);
  const [channels, setChannels] = useState(CHANNELS);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const toggleChannel = (index: number) => {
    setChannels((prev) =>
      prev.map((ch, i) => (i === index ? { ...ch, active: !ch.active } : ch))
    );
  };

  return (
    <div className="terminal-panel flex-shrink-0">
      <div className="panel-header">BOT IDENTITY</div>

      <div className="p-3 space-y-3">
        {/* Avatar + Name */}
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 flex items-center justify-center text-3xl flex-shrink-0"
            style={{
              border: "1px solid rgba(0,255,156,0.3)",
              borderRadius: "50%",
              background: "rgba(0,255,156,0.05)",
              boxShadow: "0 0 16px rgba(0,255,156,0.15), inset 0 0 12px rgba(0,255,156,0.05)",
            }}
          >
            🦞
          </div>
          <div className="flex-1">
            <label
              className="text-[9px] tracking-widest block mb-1"
              style={{ color: "rgba(0,255,156,0.4)" }}
            >
              AGENT NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-sm font-bold outline-none px-2 py-1"
              style={{
                color: "#00FF9C",
                border: "1px solid rgba(0,255,156,0.15)",
                textShadow: "0 0 6px rgba(0,255,156,0.4)",
              }}
              data-testid="input-bot-name"
            />
          </div>
        </div>

        {/* Persona */}
        <div>
          <label
            className="text-[9px] tracking-widest block mb-1"
            style={{ color: "rgba(0,255,156,0.4)" }}
          >
            PERSONA
          </label>
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={3}
            className="w-full bg-transparent text-[11px] outline-none px-2 py-1 resize-none"
            style={{
              color: "rgba(0,255,156,0.7)",
              border: "1px solid rgba(0,255,156,0.15)",
              lineHeight: "1.5",
            }}
            data-testid="input-persona"
          />
        </div>

        {/* Model Selector */}
        <div>
          <label
            className="text-[9px] tracking-widest block mb-1"
            style={{ color: "rgba(0,255,156,0.4)" }}
          >
            MODEL
          </label>
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[11px]"
              style={{
                border: "1px solid rgba(0,255,156,0.15)",
                color: "#00B4FF",
                background: "rgba(0,180,255,0.03)",
              }}
              data-testid="button-model-select"
            >
              <span style={{ textShadow: "0 0 6px rgba(0,180,255,0.4)" }}>
                {model}
              </span>
              <ChevronDown size={12} style={{ color: "rgba(0,180,255,0.5)" }} />
            </button>
            {showModelDropdown && (
              <div
                className="absolute top-full left-0 right-0 z-50 mt-[1px]"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid rgba(0,255,156,0.2)",
                }}
              >
                {MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setModel(m);
                      setShowModelDropdown(false);
                    }}
                    className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-[rgba(0,255,156,0.05)] transition-colors"
                    style={{
                      color: m === model ? "#00FF9C" : "rgba(0,255,156,0.5)",
                    }}
                  >
                    {m === model && "▸ "}{m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Channels */}
        <div>
          <label
            className="text-[9px] tracking-widest block mb-1"
            style={{ color: "rgba(0,255,156,0.4)" }}
          >
            CHANNELS
          </label>
          <div className="flex flex-wrap gap-1">
            {channels.map((ch, i) => (
              <button
                key={ch.name}
                onClick={() => toggleChannel(i)}
                className={`channel-badge ${ch.active ? "active" : ""}`}
                data-testid={`badge-channel-${ch.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                {ch.active && "● "}{ch.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
