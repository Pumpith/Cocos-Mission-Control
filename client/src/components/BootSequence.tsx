import { useState, useEffect } from "react";

const BOOT_LINES = [
  { text: "OPENCLAW MISSION CONTROL v1.0.0", delay: 0, color: "#00FF9C" },
  { text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", delay: 200, color: "rgba(0,255,156,0.3)" },
  { text: "", delay: 300, color: "#00FF9C" },
  { text: "Initializing neural core.............. OK", delay: 400, color: "#00FF9C" },
  { text: "Loading skill matrix.................. OK", delay: 700, color: "#00FF9C" },
  { text: "Memory subsystem: PERSISTENT.......... OK", delay: 1000, color: "#00FF9C" },
  { text: "Connecting channels................... OK", delay: 1300, color: "#00B4FF" },
  { text: "  ├─ WhatsApp ✓", delay: 1400, color: "#00B4FF" },
  { text: "  ├─ Telegram ✓", delay: 1500, color: "#00B4FF" },
  { text: "  ├─ Slack ✓", delay: 1600, color: "#00B4FF" },
  { text: "  └─ Element X (Matrix) ✓", delay: 1700, color: "#00B4FF" },
  { text: "Gateway WebSocket on ws://localhost:18789", delay: 1900, color: "rgba(0,255,156,0.6)" },
  { text: "Spawning agent workforce.............. OK", delay: 2200, color: "#00FF9C" },
  { text: "Pixel Office: 3 floors, 100 agents.... OK", delay: 2500, color: "#00FF9C" },
  { text: "", delay: 2700, color: "#00FF9C" },
  { text: "STATUS: ONLINE ✓", delay: 2800, color: "#00FF9C", glow: true },
  { text: "", delay: 3000, color: "#00FF9C" },
  { text: ">> Entering Mission Control...", delay: 3200, color: "rgba(0,255,156,0.5)" },
];

interface Props {
  onComplete: () => void;
}

export default function BootSequence({ onComplete }: Props) {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines(i + 1);
        }, line.delay)
      );
    });

    // Start fade out
    timers.push(
      setTimeout(() => {
        setFadeOut(true);
      }, 3600)
    );

    // Complete
    timers.push(
      setTimeout(() => {
        onComplete();
      }, 4100)
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`boot-screen transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}
    >
      <div className="max-w-xl w-full px-8">
        {/* ASCII Art Logo */}
        <pre
          className="text-[#00FF9C] mb-6 text-center"
          style={{
            fontSize: "10px",
            lineHeight: "1.2",
            textShadow: "0 0 10px rgba(0,255,156,0.5)",
          }}
        >
{`
  ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗
 ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║
 ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║
 ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║
 ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝
  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
`}
        </pre>

        {/* Boot log */}
        <div className="font-mono text-xs space-y-0.5">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className="log-entry"
              style={{
                color: line.color,
                textShadow: line.glow
                  ? "0 0 12px rgba(0,255,156,0.8), 0 0 24px rgba(0,255,156,0.4)"
                  : undefined,
                fontWeight: line.glow ? 700 : 400,
                fontSize: line.glow ? "14px" : "11px",
              }}
            >
              {line.text}
              {i === visibleLines - 1 && !line.glow && (
                <span className="blink-cursor" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
