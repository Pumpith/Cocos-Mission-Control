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
  /**
   * MOCK DATA — Model indicator
   * When the agent is actively running (state === "typing" or "talking"),
   * this shows which LLM model is powering the agent.
   * In production, this would come from OpenClaw Gateway's system-presence events.
   */
  model?: string;
  /**
   * MOCK DATA — Communication target
   * When set, draws a communication line from this agent to the target agent ID.
   * In production, derive from Gateway chat.send events between agents.
   */
  talkingTo?: number;
  /**
   * Whether this agent is Coco (the primary orchestrator).
   * Only Coco can move between floors via the elevator.
   */
  isCoco?: boolean;
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

/**
 * MOCK DATA — Available models
 * In production, models come from openclaw.json → models.providers.<provider>.models[]
 * Each agent is randomly assigned a model when actively running.
 */
const MOCK_MODELS = [
  "gpt-4o", "claude-3.5", "llama-3.1", "gemini-pro",
  "mistral-lg", "deepseek-v3", "qwen-2.5", "phi-4",
];

// ===== FLOOR GENERATION =====
function generateFloorPlan(floorNum: number): FloorPlan {
  const names = ["FLOOR 1 // ENGINEERING", "FLOOR 2 // OPERATIONS", "FLOOR 3 // RESEARCH"];
  const desks: Desk[] = [];

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
    { x: 1, y: 1, type: "plant" },
    { x: GRID_W - 2, y: 1, type: "plant" },
    { x: 1, y: GRID_H - 2, type: "plant" },
    { x: GRID_W - 2, y: GRID_H - 2, type: "plant" },
    { x: 1, y: 9, type: floorNum === 0 ? "server" : floorNum === 1 ? "monitor" : "whiteboard" },
    { x: GRID_W - 2, y: 9, type: "cooler" },
    // Elevator on right edge — only Coco can use it
    { x: GRID_W - 1, y: GRID_H / 2 - 1, type: "elevator" },
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

    /**
     * MOCK DATA — Agent generation
     * Agent-000 is always Coco (the orchestrator). Coco starts on floor 0.
     * All other agents are assigned to fixed floors and cannot move between them.
     * In production, agent list comes from Gateway system-presence events.
     */
    const isCoco = i === 0;
    const isRunning = Math.random() > 0.3;
    agents.push({
      id: i,
      name: isCoco ? "Coco 🎃" : `Agent-${String(i + 1).padStart(3, "0")}`,
      color: isCoco ? "#FFD700" : AGENT_COLORS[(i - 1) % AGENT_COLORS.length],
      x,
      y,
      targetX: x,
      targetY: y,
      state: isRunning ? (Math.random() > 0.5 ? "typing" : "idle") : "idle",
      direction: Math.random() > 0.5 ? "right" : "left",
      frame: 0,
      floor: isCoco ? 0 : floor,
      role: isCoco ? "Orchestrator" : ROLES[(i - 1) % ROLES.length],
      isCoco,
      // MOCK DATA — Assign model to running agents
      model: isRunning ? MOCK_MODELS[Math.floor(Math.random() * MOCK_MODELS.length)] : undefined,
    });
  }

  /**
   * MOCK DATA — Agent communication pairs
   * Randomly pair some agents on the same floor for communication lines.
   * In production, derive from Gateway chat event streams.
   */
  for (let floor = 0; floor < floorsCount; floor++) {
    const floorAgents = agents.filter(a => a.floor === floor);
    const pairCount = Math.min(3, Math.floor(floorAgents.length / 4));
    for (let p = 0; p < pairCount; p++) {
      const a = floorAgents[p * 2];
      const b = floorAgents[p * 2 + 1];
      if (a && b) {
        a.talkingTo = b.id;
        a.state = "talking";
        b.talkingTo = a.id;
        b.state = "talking";
      }
    }
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

  // Glow effect under agent — brighter for Coco
  ctx.fillStyle = agent.isCoco ? agent.color + "30" : agent.color + "15";
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE - 1, agent.isCoco ? 7 : 5, agent.isCoco ? 3 : 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(px + 3, py + TILE - 2, TILE - 6, 2);

  const bodyY = py + 2 - bounce - breathe;

  // Head
  ctx.fillStyle = agent.color;
  ctx.fillRect(px + 4, bodyY, 8, 5);

  // Coco gets a special pumpkin crown
  if (agent.isCoco) {
    ctx.fillStyle = "#FF6B35";
    ctx.fillRect(px + 5, bodyY - 2, 6, 2);
    ctx.fillStyle = "#00FF9C";
    ctx.fillRect(px + 7, bodyY - 3, 2, 2);
  }

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

  // Typing animation
  if (agent.state === "typing") {
    const armFrame = Math.floor(frameOffset / 4) % 2;
    ctx.fillStyle = agent.color + "AA";
    ctx.fillRect(px + 1, bodyY + 5 + armFrame, 2, 3);
    ctx.fillRect(px + 13, bodyY + 6 - armFrame, 2, 3);
  }

  // Talking animation — pulse rings
  if (agent.state === "talking") {
    const pulseR = 4 + Math.sin(frameOffset * 0.15) * 3;
    ctx.strokeStyle = agent.color + "40";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(px + TILE / 2, bodyY + 4, pulseR, 0, Math.PI * 2);
    ctx.stroke();
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

    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(px + TILE / 2 - 1, bubbleY + 10, 3, 3);
  }

  /**
   * MODEL INDICATOR LABEL
   * Shows a small model name badge below the agent when running (typing/talking).
   * In production, the model name comes from Gateway system-presence or session info.
   */
  if (agent.model && (agent.state === "typing" || agent.state === "talking")) {
    const modelLabel = agent.model;
    const labelW = modelLabel.length * 4 + 6;
    const labelX = px + TILE / 2 - labelW / 2;
    const labelY = py + TILE + 1;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(labelX, labelY, labelW, 8);

    // Border with model-specific color
    const modelColor = agent.state === "typing" ? "#00B4FF" : "#A855F7";
    ctx.strokeStyle = modelColor + "60";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(labelX, labelY, labelW, 8);

    // Text
    ctx.fillStyle = modelColor;
    ctx.font = "5px 'JetBrains Mono', monospace";
    ctx.fillText(modelLabel, labelX + 3, labelY + 6);

    // Small activity dot
    const dotBlink = Math.floor(frameOffset / 15) % 2;
    if (dotBlink) {
      ctx.fillStyle = modelColor;
      ctx.fillRect(labelX + labelW - 4, labelY + 2, 2, 2);
    }
  }

  ctx.restore();
}

/**
 * COMMUNICATION LINES
 * Draws animated dashed lines between agents that are talking to each other.
 * Lines pulse with a glow effect to indicate active data exchange.
 * In production, communication pairs come from Gateway chat event streams.
 */
function drawCommunicationLines(
  ctx: CanvasRenderingContext2D,
  agents: Agent[],
  frameOffset: number
) {
  const drawn = new Set<string>();

  agents.forEach(agent => {
    if (agent.talkingTo === undefined) return;
    const pairKey = [Math.min(agent.id, agent.talkingTo), Math.max(agent.id, agent.talkingTo)].join("-");
    if (drawn.has(pairKey)) return;
    drawn.add(pairKey);

    const target = agents.find(a => a.id === agent.talkingTo);
    if (!target) return;

    const ax = agent.x * TILE + TILE / 2;
    const ay = agent.y * TILE + TILE / 2;
    const bx = target.x * TILE + TILE / 2;
    const by = target.y * TILE + TILE / 2;

    // Animated dash offset
    const dashOffset = frameOffset * 0.5;

    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -dashOffset;

    // Glow layer
    ctx.strokeStyle = "rgba(168,85,247,0.15)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Main line
    ctx.strokeStyle = "rgba(168,85,247,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.setLineDash([]);

    // Data packet animation — small dot traveling along the line
    const t = (Math.sin(frameOffset * 0.05) + 1) / 2;
    const packetX = ax + (bx - ax) * t;
    const packetY = ay + (by - ay) * t;

    ctx.fillStyle = "#A855F7";
    ctx.beginPath();
    ctx.arc(packetX, packetY, 2, 0, Math.PI * 2);
    ctx.fill();

    // Reverse packet
    const t2 = (Math.cos(frameOffset * 0.05) + 1) / 2;
    const p2x = ax + (bx - ax) * t2;
    const p2y = ay + (by - ay) * t2;

    ctx.fillStyle = "#00B4FF";
    ctx.beginPath();
    ctx.arc(p2x, p2y, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

function drawDesk(ctx: CanvasRenderingContext2D, desk: Desk) {
  const px = desk.x * TILE;
  const py = desk.y * TILE;

  ctx.fillStyle = "rgba(0,255,156,0.08)";
  ctx.fillRect(px, py, TILE * 2, TILE);
  ctx.strokeStyle = "rgba(0,255,156,0.15)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(px, py, TILE * 2, TILE);

  ctx.fillStyle = "rgba(0,255,156,0.12)";
  ctx.fillRect(px + 3, py + 1, 6, 4);
  ctx.fillStyle = desk.occupied ? "rgba(0,255,156,0.3)" : "rgba(0,255,156,0.06)";
  ctx.fillRect(px + 4, py + 2, 4, 2);

  ctx.fillStyle = "rgba(0,255,156,0.1)";
  ctx.fillRect(px + 5, py + 5, 2, 2);

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
      ctx.fillStyle = "rgba(255,45,120,0.15)";
      ctx.fillRect(px + 3, py + 7, 6, 5);
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
    case "elevator": {
      // Elevator shaft — only Coco can use
      const doorBlink = Math.floor(frame / 40) % 2;
      ctx.fillStyle = "rgba(255,215,0,0.06)";
      ctx.fillRect(px - 4, py, 12, TILE * 2);
      ctx.strokeStyle = "rgba(255,215,0,0.2)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px - 4, py, 12, TILE * 2);
      // Door panels
      ctx.fillStyle = doorBlink ? "rgba(255,215,0,0.12)" : "rgba(255,215,0,0.06)";
      ctx.fillRect(px - 3, py + 2, 4, TILE * 2 - 4);
      ctx.fillRect(px + 3, py + 2, 4, TILE * 2 - 4);
      // Arrow indicator
      ctx.fillStyle = "#FFD700";
      ctx.font = "6px 'JetBrains Mono', monospace";
      ctx.fillText("▲▼", px - 2, py - 2);
      // "COCO ONLY" label
      ctx.fillStyle = "rgba(255,215,0,0.3)";
      ctx.font = "4px 'JetBrains Mono', monospace";
      ctx.fillText("🎃", px - 1, py + TILE * 2 + 6);
      break;
    }
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, width: number, height: number) {
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

  ctx.strokeStyle = "rgba(0,255,156,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

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

  /**
   * COCO FLOOR MOVEMENT
   * Only Coco (agent id 0) can travel between floors.
   * Other agents are fixed to their assigned floor.
   * This is triggered by clicking the floor buttons — Coco auto-relocates.
   */
  const moveCocoToFloor = useCallback((targetFloor: number) => {
    setAgents(prev =>
      prev.map(agent => {
        if (!agent.isCoco) return agent;
        // Coco transitions to the new floor
        const newX = 2 + Math.floor(Math.random() * (GRID_W - 4));
        const newY = 2 + Math.floor(Math.random() * (GRID_H - 4));
        return {
          ...agent,
          floor: targetFloor,
          x: GRID_W - 2, // Start near elevator
          y: GRID_H / 2 - 1,
          targetX: newX,
          targetY: newY,
          state: "walking" as const,
          speech: `→ F${targetFloor + 1}`,
          speechTimer: 60,
        };
      })
    );
  }, []);

  const handleFloorChange = useCallback((newFloor: number) => {
    setCurrentFloor(newFloor);
    moveCocoToFloor(newFloor);
  }, [moveCocoToFloor]);

  // Agent movement logic
  const updateAgents = useCallback(() => {
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.floor !== currentFloor) return agent;

        let newAgent = { ...agent };
        newAgent.frame++;

        // Randomly assign new target
        if (
          Math.abs(agent.x - agent.targetX) < 0.5 &&
          Math.abs(agent.y - agent.targetY) < 0.5
        ) {
          if (Math.random() < 0.02) {
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
          const speed = newAgent.isCoco ? 0.2 : 0.15; // Coco moves faster
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

        /**
         * MOCK DATA — Random model/communication changes
         * Periodically toggle model assignment and talking pairs.
         * In production, these would be driven by Gateway events.
         */
        if (Math.random() < 0.001) {
          if (newAgent.state === "typing" || newAgent.state === "talking") {
            newAgent.model = MOCK_MODELS[Math.floor(Math.random() * MOCK_MODELS.length)];
          }
        }
        if (Math.random() < 0.0005 && newAgent.talkingTo !== undefined) {
          newAgent.talkingTo = undefined;
          newAgent.state = "idle";
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

      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, width, height);

      drawFloor(ctx, width, height);

      const floor = floors[currentFloor];

      floor.desks.forEach((desk) => drawDesk(ctx, desk));
      floor.decorations.forEach((dec) => drawDecoration(ctx, dec, frameRef.current));

      // Draw agents on current floor
      const floorAgents = agents.filter((a) => a.floor === currentFloor);

      // Draw communication lines BEFORE agents so lines appear behind them
      drawCommunicationLines(ctx, floorAgents, frameRef.current);

      floorAgents.forEach((agent) => {
        drawPixelAgent(ctx, agent, frameRef.current);
      });

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
  const talkingCount = agents.filter((a) => a.floor === currentFloor && a.talkingTo !== undefined).length;

  return (
    <div className="terminal-panel flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
          PIXEL OFFICE
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px]" style={{ color: "rgba(168,85,247,0.5)" }}>
            {talkingCount > 0 && `${talkingCount / 2} comms`}
          </span>
          <div className="flex items-center gap-1">
            <Users size={9} style={{ color: "rgba(0,255,156,0.3)" }} />
            <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.4)" }}>
              {floorAgentCount} agents ({activeCount} active)
            </span>
          </div>
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
              onClick={() => handleFloorChange(i)}
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
            onClick={() => handleFloorChange(Math.max(0, currentFloor - 1))}
            className="p-0.5"
            style={{ color: "rgba(0,255,156,0.3)" }}
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => handleFloorChange(Math.min(2, currentFloor + 1))}
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

      {/* Agent info panel — enhanced with model and communication info */}
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
            {/* Model indicator */}
            {selectedAgent.model && (
              <span
                className="text-[8px] px-1"
                style={{
                  color: "#00B4FF",
                  border: "1px solid rgba(0,180,255,0.3)",
                  background: "rgba(0,180,255,0.05)",
                }}
              >
                {selectedAgent.model}
              </span>
            )}
            {/* Communication target */}
            {selectedAgent.talkingTo !== undefined && (
              <span
                className="text-[8px] px-1"
                style={{
                  color: "#A855F7",
                  border: "1px solid rgba(168,85,247,0.3)",
                  background: "rgba(168,85,247,0.05)",
                }}
              >
                ↔ {agents.find(a => a.id === selectedAgent.talkingTo)?.name || `#${selectedAgent.talkingTo}`}
              </span>
            )}
            <span
              className="text-[9px] px-1 ml-auto"
              style={{
                color: selectedAgent.state === "typing" ? "#00FF9C"
                  : selectedAgent.state === "walking" ? "#00B4FF"
                  : selectedAgent.state === "talking" ? "#A855F7"
                  : "rgba(0,255,156,0.3)",
                border: `1px solid ${
                  selectedAgent.state === "typing" ? "rgba(0,255,156,0.3)"
                  : selectedAgent.state === "walking" ? "rgba(0,180,255,0.3)"
                  : selectedAgent.state === "talking" ? "rgba(168,85,247,0.3)"
                  : "rgba(0,255,156,0.1)"
                }`,
              }}
            >
              {selectedAgent.state.toUpperCase()}
              {selectedAgent.isCoco && " 🎃"}
            </span>
          </div>
        ) : (
          <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.2)" }}>
            Click an agent to inspect // Total: {agents.length} agents across {floors.length} floors // 🎃 Coco roams freely
          </span>
        )}
      </div>
    </div>
  );
}
