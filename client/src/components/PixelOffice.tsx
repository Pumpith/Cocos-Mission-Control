import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, ChevronUp, ChevronDown, Users } from "lucide-react";

// ===== TYPES =====
interface Agent {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: "idle" | "walking" | "typing" | "reading" | "talking";
  direction: "left" | "right";
  frame: number;
  floor: number;
  role: string;
  speech?: string;
  speechTimer?: number;
}

interface Desk {
  x: number;
  y: number;
  occupied: boolean;
}

interface FloorPlan {
  name: string;
  desks: Desk[];
  decorations: { x: number; y: number; type: string }[];
}

// ===== CONSTANTS =====
const TILE = 16;
const GRID_W = 22;
const GRID_H = 18;
const AGENT_COLORS = [
  "#00FF9C", "#00B4FF", "#FF2D78", "#FFD700", "#FF6B35",
  "#A855F7", "#22D3EE", "#F472B6", "#34D399", "#FBBF24",
  "#60A5FA", "#C084FC", "#FB923C", "#4ADE80", "#38BDF8",
  "#E879F9", "#2DD4BF",
];

const ROLES = [
  "Engineer", "Researcher", "Designer", "Analyst", "DevOps",
  "Security", "PM", "QA", "DataSci", "MLOps",
  "Backend", "Frontend", "SRE", "Architect", "Support",
];

const SPEECH_LINES = [
  "Compiling...", "LGTM!", "Deploying", "Bug found", "PR ready",
  "Testing...", "Refactoring", "Optimizing", "Reviewing", "Shipped!",
  "Building", "Scanning", "Analyzing", "Merging", "Done ✓",
];

// ===== FLOOR GENERATION =====
function generateFloorPlan(floorNum: number): FloorPlan {
  const names = ["FLOOR 1 // ENGINEERING", "FLOOR 2 // OPERATIONS", "FLOOR 3 // RESEARCH"];
  const desks: Desk[] = [];

  // Generate desk rows - office layout
  for (let col = 3; col < GRID_W - 3; col += 3) {
    desks.push({ x: col, y: 3, occupied: false });
  }
  for (let col = 3; col < GRID_W - 3; col += 3) {
    desks.push({ x: col, y: 7, occupied: false });
  }
  for (let col = 3; col < GRID_W - 3; col += 3) {
    desks.push({ x: col, y: 11, occupied: false });
  }
  for (let col = 3; col < GRID_W - 3; col += 3) {
    desks.push({ x: col, y: 15, occupied: false });
  }

  const decorations = [
    // Plants
    { x: 1, y: 1, type: "plant" },
    { x: GRID_W - 2, y: 1, type: "plant" },
    { x: 1, y: GRID_H - 2, type: "plant" },
    { x: GRID_W - 2, y: GRID_H - 2, type: "plant" },
    // Servers / equipment
    { x: 1, y: 9, type: floorNum === 0 ? "server" : floorNum === 1 ? "monitor" : "whiteboard" },
    { x: GRID_W - 2, y: 9, type: "cooler" },
  ];

  return { name: names[floorNum] || `FLOOR ${floorNum + 1}`, desks, decorations };
}

function generateAgents(count: number, floorsCount: number): Agent[] {
  const agents: Agent[] = [];
  const perFloor = Math.ceil(count / floorsCount);

  for (let i = 0; i < count; i++) {
    const floor = Math.min(Math.floor(i / perFloor), floorsCount - 1);
    const x = 2 + Math.floor(Math.random() * (GRID_W - 4));
    const y = 2 + Math.floor(Math.random() * (GRID_H - 4));

    agents.push({
      id: i,
      name: `Agent-${String(i + 1).padStart(3, "0")}`,
      color: AGENT_COLORS[i % AGENT_COLORS.length],
      x,
      y,
      targetX: x,
      targetY: y,
      state: Math.random() > 0.3 ? "idle" : "typing",
      direction: Math.random() > 0.5 ? "right" : "left",
      frame: 0,
      floor,
      role: ROLES[i % ROLES.length],
    });
  }
  return agents;
}

// ===== DRAWING HELPERS =====
function drawPixelAgent(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  frameOffset: number
) {
  const px = agent.x * TILE;
  const py = agent.y * TILE;
  const bounce = agent.state === "walking" ? Math.sin(frameOffset * 0.3) * 2 : 0;
  const breathe = agent.state === "idle" ? Math.sin(frameOffset * 0.08) * 0.7 : 0;

  ctx.save();

  // Glow effect under agent
  ctx.fillStyle = agent.color + "15";
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE - 1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(px + 3, py + TILE - 2, TILE - 6, 2);

  const bodyY = py + 2 - bounce - breathe;

  // Head (larger for visibility)
  ctx.fillStyle = agent.color;
  ctx.fillRect(px + 4, bodyY, 8, 5);

  // Body
  ctx.fillStyle = agent.color + "CC";
  ctx.fillRect(px + 3, bodyY + 5, 10, 5);

  // Legs
  const legOffset = agent.state === "walking" ? Math.sin(frameOffset * 0.4) * 1.5 : 0;
  ctx.fillStyle = agent.color + "99";
  ctx.fillRect(px + 4 + legOffset, bodyY + 10, 3, 3);
  ctx.fillRect(px + 9 - legOffset, bodyY + 10, 3, 3);

  // Eyes
  ctx.fillStyle = "#050508";
  if (agent.direction === "right") {
    ctx.fillRect(px + 9, bodyY + 1, 2, 2);
    ctx.fillRect(px + 9, bodyY + 3, 1, 1);
  } else {
    ctx.fillRect(px + 5, bodyY + 1, 2, 2);
    ctx.fillRect(px + 6, bodyY + 3, 1, 1);
  }

  // Typing animation - arms move
  if (agent.state === "typing") {
    const armFrame = Math.floor(frameOffset / 4) % 2;
    ctx.fillStyle = agent.color + "AA";
    ctx.fillRect(px + 1, bodyY + 5 + armFrame, 2, 3);
    ctx.fillRect(px + 13, bodyY + 6 - armFrame, 2, 3);
  }

  // Speech bubble
  if (agent.speech) {
    const bubbleW = agent.speech.length * 5 + 8;
    const bubbleX = px + TILE / 2 - bubbleW / 2;
    const bubbleY = bodyY - 14;

    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(bubbleX, bubbleY, bubbleW, 10);
    ctx.strokeStyle = agent.color + "60";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bubbleX, bubbleY, bubbleW, 10);

    ctx.fillStyle = agent.color;
    ctx.font = "7px 'JetBrains Mono', monospace";
    ctx.fillText(agent.speech, bubbleX + 4, bubbleY + 8);

    // Tail
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(px + TILE / 2 - 1, bubbleY + 10, 3, 3);
  }

  ctx.restore();
}

function drawDesk(ctx: CanvasRenderingContext2D, desk: Desk) {
  const px = desk.x * TILE;
  const py = desk.y * TILE;

  // Desk surface
  ctx.fillStyle = "rgba(0,255,156,0.08)";
  ctx.fillRect(px, py, TILE * 2, TILE);
  ctx.strokeStyle = "rgba(0,255,156,0.15)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(px, py, TILE * 2, TILE);

  // Monitor on desk
  ctx.fillStyle = "rgba(0,255,156,0.12)";
  ctx.fillRect(px + 3, py + 1, 6, 4);
  ctx.fillStyle = desk.occupied ? "rgba(0,255,156,0.3)" : "rgba(0,255,156,0.06)";
  ctx.fillRect(px + 4, py + 2, 4, 2);

  // Monitor stand
  ctx.fillStyle = "rgba(0,255,156,0.1)";
  ctx.fillRect(px + 5, py + 5, 2, 2);

  // Chair
  ctx.fillStyle = "rgba(0,180,255,0.06)";
  ctx.fillRect(px + 3, py + TILE + 1, 6, 4);
  ctx.strokeStyle = "rgba(0,180,255,0.1)";
  ctx.strokeRect(px + 3, py + TILE + 1, 6, 4);
}

function drawDecoration(ctx: CanvasRenderingContext2D, dec: { x: number; y: number; type: string }, frame: number) {
  const px = dec.x * TILE;
  const py = dec.y * TILE;

  switch (dec.type) {
    case "plant": {
      const sway = Math.sin(frame * 0.03) * 0.5;
      // Pot
      ctx.fillStyle = "rgba(255,45,120,0.15)";
      ctx.fillRect(px + 3, py + 7, 6, 5);
      // Leaves
      ctx.fillStyle = "rgba(0,255,156,0.25)";
      ctx.fillRect(px + 4 + sway, py + 2, 4, 5);
      ctx.fillRect(px + 2 + sway, py + 3, 3, 3);
      ctx.fillRect(px + 7 + sway, py + 4, 3, 3);
      break;
    }
    case "server": {
      const blink = Math.floor(frame / 20) % 2;
      ctx.fillStyle = "rgba(0,180,255,0.1)";
      ctx.fillRect(px + 1, py, 10, TILE);
      ctx.strokeStyle = "rgba(0,180,255,0.2)";
      ctx.strokeRect(px + 1, py, 10, TILE);
      // Lights
      ctx.fillStyle = blink ? "#00FF9C" : "rgba(0,255,156,0.2)";
      ctx.fillRect(px + 3, py + 2, 2, 1);
      ctx.fillStyle = !blink ? "#00B4FF" : "rgba(0,180,255,0.2)";
      ctx.fillRect(px + 3, py + 5, 2, 1);
      ctx.fillStyle = "#FF2D78";
      ctx.fillRect(px + 3, py + 8, 2, 1);
      break;
    }
    case "monitor": {
      ctx.fillStyle = "rgba(0,255,156,0.08)";
      ctx.fillRect(px + 1, py + 2, 10, 7);
      ctx.fillStyle = "rgba(0,255,156,0.15)";
      ctx.fillRect(px + 2, py + 3, 8, 5);
      // Screen content
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(0,255,156,${0.1 + Math.random() * 0.15})`;
        ctx.fillRect(px + 3, py + 4 + i * 1.5, 3 + Math.random() * 3, 0.8);
      }
      break;
    }
    case "whiteboard": {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(px, py + 1, TILE, TILE - 2);
      ctx.strokeStyle = "rgba(0,255,156,0.15)";
      ctx.strokeRect(px, py + 1, TILE, TILE - 2);
      // Scribbles
      ctx.fillStyle = "rgba(0,255,156,0.15)";
      ctx.fillRect(px + 2, py + 3, 5, 0.5);
      ctx.fillRect(px + 2, py + 5, 7, 0.5);
      ctx.fillRect(px + 2, py + 7, 4, 0.5);
      break;
    }
    case "cooler": {
      ctx.fillStyle = "rgba(0,180,255,0.08)";
      ctx.fillRect(px + 3, py + 3, 6, 9);
      ctx.strokeStyle = "rgba(0,180,255,0.15)";
      ctx.strokeRect(px + 3, py + 3, 6, 9);
      ctx.fillStyle = "rgba(0,180,255,0.2)";
      ctx.fillRect(px + 4, py + 1, 4, 3);
      break;
    }
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Floor grid
  ctx.strokeStyle = "rgba(0,255,156,0.03)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < width; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Walls
  ctx.strokeStyle = "rgba(0,255,156,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Corner markers
  const cornerSize = 4;
  ctx.fillStyle = "rgba(0,255,156,0.2)";
  ctx.fillRect(0, 0, cornerSize, 1);
  ctx.fillRect(0, 0, 1, cornerSize);
  ctx.fillRect(width - cornerSize, 0, cornerSize, 1);
  ctx.fillRect(width - 1, 0, 1, cornerSize);
  ctx.fillRect(0, height - 1, cornerSize, 1);
  ctx.fillRect(0, height - cornerSize, 1, cornerSize);
  ctx.fillRect(width - cornerSize, height - 1, cornerSize, 1);
  ctx.fillRect(width - 1, height - cornerSize, 1, cornerSize);
}

// ===== MAIN COMPONENT =====
export default function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [agents, setAgents] = useState<Agent[]>(() => generateAgents(100, 3));
  const [floors] = useState<FloorPlan[]>([
    generateFloorPlan(0),
    generateFloorPlan(1),
    generateFloorPlan(2),
  ]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);

  // Agent movement logic
  const updateAgents = useCallback(() => {
    setAgents((prev) =>
      prev.map((agent) => {
        // Only update agents on current floor
        if (agent.floor !== currentFloor) return agent;

        let newAgent = { ...agent };
        newAgent.frame++;

        // Randomly assign new target
        if (
          Math.abs(agent.x - agent.targetX) < 0.5 &&
          Math.abs(agent.y - agent.targetY) < 0.5
        ) {
          if (Math.random() < 0.02) {
            // Pick new target
            newAgent.targetX = 2 + Math.floor(Math.random() * (GRID_W - 4));
            newAgent.targetY = 2 + Math.floor(Math.random() * (GRID_H - 4));
            newAgent.state = "walking";
          } else if (agent.state === "walking") {
            newAgent.state = Math.random() > 0.5 ? "typing" : "idle";
          }
        }

        // Move toward target
        if (newAgent.state === "walking") {
          const dx = newAgent.targetX - newAgent.x;
          const dy = newAgent.targetY - newAgent.y;
          const speed = 0.15;
          if (Math.abs(dx) > 0.1) {
            newAgent.x += Math.sign(dx) * speed;
            newAgent.direction = dx > 0 ? "right" : "left";
          }
          if (Math.abs(dy) > 0.1) {
            newAgent.y += Math.sign(dy) * speed;
          }
        }

        // Random speech bubbles
        if (newAgent.speechTimer && newAgent.speechTimer > 0) {
          newAgent.speechTimer--;
          if (newAgent.speechTimer <= 0) {
            newAgent.speech = undefined;
          }
        } else if (Math.random() < 0.003 && !newAgent.speech) {
          newAgent.speech = SPEECH_LINES[Math.floor(Math.random() * SPEECH_LINES.length)];
          newAgent.speechTimer = 120;
        }

        return newAgent;
      })
    );
  }, [currentFloor]);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = GRID_W * TILE;
    const height = GRID_H * TILE;
    canvas.width = width;
    canvas.height = height;

    const render = () => {
      frameRef.current++;
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, width, height);

      // Floor grid
      drawFloor(ctx, width, height);

      const floor = floors[currentFloor];

      // Draw desks
      floor.desks.forEach((desk) => drawDesk(ctx, desk));

      // Draw decorations
      floor.decorations.forEach((dec) => drawDecoration(ctx, dec, frameRef.current));

      // Draw agents on current floor
      const floorAgents = agents.filter((a) => a.floor === currentFloor);
      floorAgents.forEach((agent) => {
        drawPixelAgent(ctx, agent, frameRef.current);
      });

      // Update agents every 3 frames
      if (frameRef.current % 3 === 0) {
        updateAgents();
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [agents, currentFloor, floors, updateAgents]);

  // Handle canvas click to select agent
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const gx = mx / TILE;
    const gy = my / TILE;

    const floorAgents = agents.filter((a) => a.floor === currentFloor);
    const clicked = floorAgents.find(
      (a) => Math.abs(a.x - gx) < 1.2 && Math.abs(a.y - gy) < 1.2
    );
    setSelectedAgent(clicked || null);
  };

  const floorAgentCount = agents.filter((a) => a.floor === currentFloor).length;
  const activeCount = agents.filter((a) => a.floor === currentFloor && a.state !== "idle").length;

  return (
    <div className="terminal-panel flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
          PIXEL OFFICE
        </div>
        <div className="flex items-center gap-2">
          <Users size={9} style={{ color: "rgba(0,255,156,0.3)" }} />
          <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.4)" }}>
            {floorAgentCount} agents ({activeCount} active)
          </span>
        </div>
      </div>

      {/* Floor selector */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: "1px solid rgba(0,255,156,0.08)" }}
      >
        <div className="flex items-center gap-1">
          {floors.map((floor, i) => (
            <button
              key={i}
              onClick={() => setCurrentFloor(i)}
              className="text-[9px] px-2 py-0.5 tracking-wider transition-all"
              style={{
                border: `1px solid ${i === currentFloor ? "rgba(0,255,156,0.4)" : "rgba(0,255,156,0.1)"}`,
                color: i === currentFloor ? "#00FF9C" : "rgba(0,255,156,0.3)",
                background: i === currentFloor ? "rgba(0,255,156,0.05)" : "transparent",
                boxShadow: i === currentFloor ? "0 0 6px rgba(0,255,156,0.15)" : "none",
              }}
              data-testid={`button-floor-${i}`}
            >
              F{i + 1}
            </button>
          ))}
        </div>
        <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.3)" }}>
          {floors[currentFloor].name}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentFloor(Math.max(0, currentFloor - 1))}
            className="p-0.5"
            style={{ color: "rgba(0,255,156,0.3)" }}
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => setCurrentFloor(Math.min(2, currentFloor + 1))}
            className="p-0.5"
            style={{ color: "rgba(0,255,156,0.3)" }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="pixel-grid w-full h-full"
          style={{
            maxHeight: "100%",
            objectFit: "contain",
            border: "1px solid rgba(0,255,156,0.08)",
            boxShadow: "inset 0 0 20px rgba(0,255,156,0.03)",
          }}
          onClick={handleCanvasClick}
          data-testid="canvas-office"
        />
      </div>

      {/* Agent info panel */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{
          borderTop: "1px solid rgba(0,255,156,0.08)",
          minHeight: "28px",
        }}
      >
        {selectedAgent ? (
          <div className="flex items-center gap-3 w-full">
            <div
              className="w-3 h-3 flex-shrink-0"
              style={{
                background: selectedAgent.color,
                boxShadow: `0 0 6px ${selectedAgent.color}60`,
              }}
            />
            <span className="text-[10px] font-bold" style={{ color: selectedAgent.color }}>
              {selectedAgent.name}
            </span>
            <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.4)" }}>
              {selectedAgent.role}
            </span>
            <span
              className="text-[9px] px-1 ml-auto"
              style={{
                color: selectedAgent.state === "typing" ? "#00FF9C"
                  : selectedAgent.state === "walking" ? "#00B4FF"
                  : "rgba(0,255,156,0.3)",
                border: `1px solid ${
                  selectedAgent.state === "typing" ? "rgba(0,255,156,0.3)"
                  : selectedAgent.state === "walking" ? "rgba(0,180,255,0.3)"
                  : "rgba(0,255,156,0.1)"
                }`,
              }}
            >
              {selectedAgent.state.toUpperCase()}
            </span>
          </div>
        ) : (
          <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.2)" }}>
            Click an agent to inspect // Total: {agents.length} agents across {floors.length} floors
          </span>
        )}
      </div>
    </div>
  );
}
