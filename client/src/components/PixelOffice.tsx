import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Building2, ChevronUp, ChevronDown, Users, MessageSquare, Cpu } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

/** Hair style identifiers for RPG sprite rendering */
type HairStyle = "spiky" | "long_wavy" | "afro" | "curly_big" | "short_silver" | "messy" | "pumpkin_crown";

/** Room type identifiers for the multi-room office layout */
type RoomType = "workspace" | "kitchen" | "lounge";

/** Agent activity states that drive animation and behavior */
type AgentState = "idle" | "walking" | "typing" | "talking";

/** Facing direction for sprite mirroring */
type Direction = "left" | "right";

/** Full agent appearance descriptor for RPG sprite rendering */
interface AgentAppearance {
  hairStyle: HairStyle;
  hairColor: string;
  skinTone: string;
  shirtColor: string;
  pantsColor: string;
  /** Optional undershirt/accent color visible at collar area */
  accentColor?: string;
}

/** Agent entity with position, state, and metadata */
interface Agent {
  id: number;
  name: string;
  appearance: AgentAppearance;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: AgentState;
  direction: Direction;
  frame: number;
  floor: number;
  /** Which room this agent is assigned to (only Coco can change rooms) */
  assignedRoom: RoomType;
  role: string;
  speech?: string;
  speechTimer: number;
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
   * Only Coco can move between floors/rooms via corridors.
   */
  isCoco: boolean;
  /** Internal walk timer for AI patrol behavior */
  walkTimer: number;
  /** Internal idle timer before next action */
  idleTimer: number;
}

/** A rectangular region defining a room in the office */
interface Room {
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Doorway openings in the walls — array of {side, pos} */
  doors: Array<{ side: "top" | "bottom" | "left" | "right"; pos: number }>;
}

/** A furniture piece placed in a room */
interface Furniture {
  type: "desk" | "chair" | "bookshelf" | "plant" | "vending_machine" | "coffee_machine"
    | "couch" | "coffee_table" | "fridge" | "microwave" | "clock" | "painting"
    | "crt_monitor" | "laptop" | "cardboard_box" | "counter";
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Complete floor layout with rooms, walls, and furniture */
interface FloorLayout {
  name: string;
  rooms: Room[];
  furniture: Furniture[];
}

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

/** Canvas internal resolution (rendered at this size, CSS scales to fill container) */
const CANVAS_W = 640;
const CANVAS_H = 480;

/** Tile size for the grid system */
const TILE = 16;

/** Target FPS for the game loop (30fps for retro feel) */
const TARGET_FPS = 30;
const FRAME_DURATION = 1000 / TARGET_FPS;

/** Wall thickness in pixels */
const WALL_THICKNESS = 8;

/** Room floor tile colors by room type */
const FLOOR_COLORS: Record<RoomType, { base: string; alt: string; grid: string }> = {
  workspace: { base: "#3D2B1F", alt: "#4A3628", grid: "#33231A" },
  kitchen: { base: "#D4C5A9", alt: "#C8B898", grid: "#BBA888" },
  lounge: { base: "#2A3A5C", alt: "#324470", grid: "#243050" },
};

/** Wall color (dark navy) */
const WALL_COLOR = "#1A1A2E";
const WALL_HIGHLIGHT = "#252545";

/**
 * MOCK DATA — Available LLM models
 * In production, models come from openclaw.json → models.providers.<provider>.models[]
 * Each agent is randomly assigned a model when actively running.
 */
const MOCK_MODELS = [
  "gpt-4o", "claude-3.5", "llama-3.1", "gemini-pro",
  "mistral-lg", "deepseek-v3", "qwen-2.5", "phi-4",
];

/**
 * MOCK DATA — Speech lines for agent bubbles
 * In production, these would come from actual agent message streams.
 */
const SPEECH_LINES = [
  "Compiling...", "LGTM!", "Deploying", "Bug found", "PR ready",
  "Testing...", "Refactoring", "Optimizing", "Reviewing", "Shipped!",
  "Building", "Scanning", "Analyzing", "Merging", "Done ✓",
  "Indexing...", "Patching", "Syncing", "On it!", "Checking",
];

// =============================================================================
// AGENT CONFIGURATION — 7 unique RPG characters
// =============================================================================

/**
 * MOCK DATA — Agent definitions
 * Each agent has a unique RPG appearance, role, and room assignment.
 * Agent 0 is always Coco (orchestrator) who can roam all rooms.
 * In production, agent list comes from Gateway system-presence events.
 */
interface AgentConfig {
  name: string;
  role: string;
  appearance: AgentAppearance;
  assignedRoom: RoomType;
  isCoco: boolean;
}

const AGENT_CONFIGS: AgentConfig[] = [
  // Agent 0: Coco 🎃 — The Orchestrator — can roam ALL rooms
  {
    name: "Coco 🎃",
    role: "Orchestrator",
    appearance: {
      hairStyle: "pumpkin_crown",
      hairColor: "#E8A020",    // golden/orange hair
      skinTone: "#FFDCB0",     // light peach
      shirtColor: "#FF8C00",   // orange shirt
      pantsColor: "#8B4513",   // brown pants
      accentColor: "#00FF9C",  // green accent (pumpkin stem)
    },
    assignedRoom: "workspace",
    isCoco: true,
  },
  // Agent 1: Male, brown spiky hair, blue jacket — Engineer — WORKSPACE
  {
    name: "Rex",
    role: "Engineer",
    appearance: {
      hairStyle: "spiky",
      hairColor: "#6B4226",    // brown spiky hair
      skinTone: "#FFDCB0",     // light peach skin
      shirtColor: "#2563EB",   // blue jacket
      pantsColor: "#1E3A5F",   // dark blue pants
      accentColor: "#FFFFFF",  // white undershirt
    },
    assignedRoom: "workspace",
    isCoco: false,
  },
  // Agent 2: Female, blonde wavy hair, black dress — Researcher — WORKSPACE
  {
    name: "Luna",
    role: "Researcher",
    appearance: {
      hairStyle: "long_wavy",
      hairColor: "#E8C547",    // blonde long wavy
      skinTone: "#FFD5B8",     // light skin
      shirtColor: "#1A1A2E",   // black dress top
      pantsColor: "#1A1A2E",   // black dress bottom
    },
    assignedRoom: "workspace",
    isCoco: false,
  },
  // Agent 3: Dark skin, black curly afro, orange shirt — Builder — WORKSPACE
  {
    name: "Kwame",
    role: "Builder",
    appearance: {
      hairStyle: "afro",
      hairColor: "#1A1A1A",    // black afro
      skinTone: "#8B5E3C",     // dark brown skin
      shirtColor: "#E86420",   // orange/red striped shirt
      pantsColor: "#2563EB",   // blue shorts
      accentColor: "#CC4400",  // red stripe accent
    },
    assignedRoom: "workspace",
    isCoco: false,
  },
  // Agent 4: Female, dark curly hair, red shirt — SecOps — KITCHEN
  {
    name: "Mira",
    role: "SecOps",
    appearance: {
      hairStyle: "curly_big",
      hairColor: "#2C1810",    // dark curly hair
      skinTone: "#D4A574",     // medium skin
      shirtColor: "#DC2626",   // red shirt
      pantsColor: "#1A1A2E",   // dark skirt
    },
    assignedRoom: "kitchen",
    isCoco: false,
  },
  // Agent 5: White/silver hair, gray shirt — Analyst — LOUNGE
  {
    name: "Sage",
    role: "Analyst",
    appearance: {
      hairStyle: "short_silver",
      hairColor: "#C0C0C0",    // white/silver short hair
      skinTone: "#FFDCB0",     // light skin
      shirtColor: "#6B7280",   // gray shirt
      pantsColor: "#4B5563",   // gray pants
    },
    assignedRoom: "lounge",
    isCoco: false,
  },
  // Agent 6: Brown messy hair, white shirt — Intern — distributed
  {
    name: "Niko",
    role: "Intern",
    appearance: {
      hairStyle: "messy",
      hairColor: "#7B5B3A",    // brown messy hair
      skinTone: "#E8C49A",     // tan skin
      shirtColor: "#F0F0F0",   // white shirt
      pantsColor: "#2563EB",   // blue shorts
    },
    assignedRoom: "lounge",
    isCoco: false,
  },
];

// =============================================================================
// ROOM & FLOOR LAYOUT GENERATION
// =============================================================================

/**
 * Generates the multi-room office layout for a single floor.
 * Layout:
 * - WORKSPACE (left, largest): x=0..380, y=0..480
 * - KITCHEN (top right): x=388..640, y=0..230
 * - LOUNGE (bottom right): x=388..640, y=238..480
 * Rooms separated by dark navy walls with doorway openings.
 */
function generateFloorLayout(floorNum: number): FloorLayout {
  const names = ["FLOOR 1 // ENGINEERING", "FLOOR 2 // OPERATIONS", "FLOOR 3 // RESEARCH"];

  // Room definitions
  const rooms: Room[] = [
    // Workspace — large left room
    {
      type: "workspace",
      x: 0, y: 0, w: 376, h: CANVAS_H,
      doors: [
        { side: "right", pos: 100 },  // door to kitchen corridor
        { side: "right", pos: 320 },  // door to lounge corridor
      ],
    },
    // Kitchen — top right
    {
      type: "kitchen",
      x: 392, y: 0, w: CANVAS_W - 392, h: 224,
      doors: [
        { side: "left", pos: 100 },   // door from workspace corridor
      ],
    },
    // Lounge — bottom right
    {
      type: "lounge",
      x: 392, y: 248, w: CANVAS_W - 392, h: CANVAS_H - 248,
      doors: [
        { side: "left", pos: 72 },    // door from workspace corridor
      ],
    },
  ];

  // Furniture placement per room
  const furniture: Furniture[] = [];

  // === WORKSPACE FURNITURE ===
  // Row of desks with CRT monitors
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const dx = 48 + col * 140;
      const dy = 60 + row * 130;
      // Desk
      furniture.push({ type: "desk", x: dx, y: dy, w: 80, h: 32 });
      // CRT monitor on desk
      furniture.push({ type: "crt_monitor", x: dx + 10, y: dy - 12, w: 24, h: 18 });
      // Laptop on second desk position
      furniture.push({ type: "laptop", x: dx + 48, y: dy + 2, w: 16, h: 12 });
      // Chair in front of desk
      furniture.push({ type: "chair", x: dx + 16, y: dy + 36, w: 14, h: 14 });
      furniture.push({ type: "chair", x: dx + 50, y: dy + 36, w: 14, h: 14 });
    }
  }
  // Bookshelves along left wall
  furniture.push({ type: "bookshelf", x: 8, y: 40, w: 20, h: 56 });
  furniture.push({ type: "bookshelf", x: 8, y: 160, w: 20, h: 56 });
  furniture.push({ type: "bookshelf", x: 8, y: 360, w: 20, h: 56 });
  // Plants in workspace
  furniture.push({ type: "plant", x: 340, y: 20, w: 16, h: 24 });
  furniture.push({ type: "plant", x: 340, y: 440, w: 16, h: 24 });
  furniture.push({ type: "plant", x: 44, y: 430, w: 16, h: 24 });
  // Cardboard boxes
  furniture.push({ type: "cardboard_box", x: 320, y: 180, w: 24, h: 20 });
  furniture.push({ type: "cardboard_box", x: 300, y: 380, w: 24, h: 20 });

  // === KITCHEN FURNITURE ===
  // Counter with appliances
  furniture.push({ type: "counter", x: 410, y: 16, w: 200, h: 24 });
  furniture.push({ type: "coffee_machine", x: 430, y: 2, w: 18, h: 20 });
  furniture.push({ type: "microwave", x: 470, y: 4, w: 22, h: 16 });
  // Vending machine
  furniture.push({ type: "vending_machine", x: 600, y: 40, w: 28, h: 56 });
  // Fridge
  furniture.push({ type: "fridge", x: 540, y: 8, w: 24, h: 40 });
  // Clock on wall (drawn as decoration)
  furniture.push({ type: "clock", x: 500, y: 4, w: 12, h: 12 });
  // Small table
  furniture.push({ type: "coffee_table", x: 440, y: 120, w: 48, h: 28 });
  furniture.push({ type: "chair", x: 440, y: 154, w: 14, h: 14 });
  furniture.push({ type: "chair", x: 474, y: 154, w: 14, h: 14 });
  // Plant
  furniture.push({ type: "plant", x: 400, y: 190, w: 16, h: 24 });

  // === LOUNGE FURNITURE ===
  // Couch / sofa
  furniture.push({ type: "couch", x: 420, y: 290, w: 72, h: 32 });
  // Coffee table in front of couch
  furniture.push({ type: "coffee_table", x: 432, y: 332, w: 48, h: 24 });
  // Bookshelf
  furniture.push({ type: "bookshelf", x: 610, y: 260, w: 20, h: 56 });
  // Painting on wall
  furniture.push({ type: "painting", x: 520, y: 254, w: 36, h: 24 });
  // Plants
  furniture.push({ type: "plant", x: 400, y: 440, w: 16, h: 24 });
  furniture.push({ type: "plant", x: 610, y: 440, w: 16, h: 24 });
  // Additional seating
  furniture.push({ type: "chair", x: 540, y: 360, w: 14, h: 14 });
  furniture.push({ type: "chair", x: 570, y: 360, w: 14, h: 14 });
  furniture.push({ type: "coffee_table", x: 530, y: 390, w: 60, h: 24 });

  return { name: names[floorNum] || `FLOOR ${floorNum + 1}`, rooms, furniture };
}

/**
 * Returns the walkable area bounds for an agent in their assigned room.
 * Adds padding so agents don't walk into walls or furniture edges.
 */
function getRoomBounds(room: Room): { minX: number; minY: number; maxX: number; maxY: number } {
  const pad = 20;
  return {
    minX: room.x + pad,
    minY: room.y + pad,
    maxX: room.x + room.w - pad - 24,  // 24 = agent sprite width
    maxY: room.y + room.h - pad - 32,  // 32 = agent sprite height
  };
}

// =============================================================================
// AGENT GENERATION
// =============================================================================

/**
 * MOCK DATA — Generate all agents for all floors.
 * Agent configs define the 7 core agents; additional agents are cloned
 * with variations for higher floors.
 * In production, agent list comes from Gateway system-presence events.
 */
function generateAgents(floors: FloorLayout[]): Agent[] {
  const agents: Agent[] = [];
  let id = 0;

  for (let floorIdx = 0; floorIdx < floors.length; floorIdx++) {
    const floor = floors[floorIdx];

    for (let cfgIdx = 0; cfgIdx < AGENT_CONFIGS.length; cfgIdx++) {
      const cfg = AGENT_CONFIGS[cfgIdx];

      // Coco only exists once, on floor 0
      if (cfg.isCoco && floorIdx > 0) continue;

      const room = floor.rooms.find(r => r.type === cfg.assignedRoom) || floor.rooms[0];
      const bounds = getRoomBounds(room);
      const startX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const startY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

      /**
       * MOCK DATA — Initial agent state
       * Running agents (typing/talking) get a model indicator.
       * In production, state comes from Gateway events.
       */
      const isRunning = Math.random() > 0.35;
      const initialState: AgentState = isRunning
        ? (Math.random() > 0.5 ? "typing" : "idle")
        : "idle";

      agents.push({
        id: id++,
        name: cfg.isCoco ? cfg.name : (floorIdx === 0 ? cfg.name : `${cfg.name}-F${floorIdx + 1}`),
        appearance: { ...cfg.appearance },
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        state: initialState,
        direction: Math.random() > 0.5 ? "right" : "left",
        frame: Math.floor(Math.random() * 100),
        floor: floorIdx,
        assignedRoom: cfg.assignedRoom,
        role: cfg.role,
        isCoco: cfg.isCoco,
        walkTimer: 0,
        idleTimer: 60 + Math.floor(Math.random() * 120),
        speechTimer: 0,
        // MOCK DATA — Assign model to running agents
        model: isRunning ? MOCK_MODELS[Math.floor(Math.random() * MOCK_MODELS.length)] : undefined,
      });
    }
  }

  /**
   * MOCK DATA — Agent communication pairs
   * Randomly pair some agents on the same floor for communication lines.
   * In production, derive from Gateway chat event streams.
   */
  for (let floorIdx = 0; floorIdx < floors.length; floorIdx++) {
    const floorAgents = agents.filter(a => a.floor === floorIdx && !a.isCoco);
    // Create 2 talking pairs per floor
    for (let p = 0; p < Math.min(2, Math.floor(floorAgents.length / 2)); p++) {
      const a = floorAgents[p * 2];
      const b = floorAgents[p * 2 + 1];
      if (a && b && a.assignedRoom === b.assignedRoom) {
        a.talkingTo = b.id;
        a.state = "talking";
        a.model = MOCK_MODELS[Math.floor(Math.random() * MOCK_MODELS.length)];
        b.talkingTo = a.id;
        b.state = "talking";
        b.model = MOCK_MODELS[Math.floor(Math.random() * MOCK_MODELS.length)];
      }
    }
  }

  return agents;
}

// =============================================================================
// PIXEL ART DRAWING — RPG SPRITE SYSTEM
// =============================================================================

/**
 * Draws a single pixel block on the canvas.
 * This is the primitive used for all pixel art rendering.
 */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/**
 * Darkens a hex color by a factor (0-1, where 0.2 = 20% darker).
 */
function darken(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.max(0, Math.floor(r * (1 - factor)));
  const dg = Math.max(0, Math.floor(g * (1 - factor)));
  const db = Math.max(0, Math.floor(b * (1 - factor)));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

/**
 * Lighten a hex color by a factor (0-1).
 */
function lighten(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, Math.floor(r + (255 - r) * factor));
  const lg = Math.min(255, Math.floor(g + (255 - g) * factor));
  const lb = Math.min(255, Math.floor(b + (255 - b) * factor));
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// HAIR DRAWING — Each style has a unique silhouette
// ---------------------------------------------------------------------------

function drawHair(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  style: HairStyle,
  color: string,
  direction: Direction
) {
  const hc = color;
  const hcDark = darken(color, 0.25);
  const flip = direction === "left";
  // Mirror helper: if facing left, flip x around the center of the sprite (24px wide)
  const fx = (x: number, w: number) => flip ? baseX + 24 - x - w : x;

  switch (style) {
    case "spiky": {
      // Jagged spikes rising above head — 3-4 spikes
      px(ctx, fx(baseX + 5, 14), baseY - 6, 14, 4, hc);        // base mass
      px(ctx, fx(baseX + 6, 3), baseY - 10, 3, 5, hc);          // spike 1 (left)
      px(ctx, fx(baseX + 10, 3), baseY - 12, 3, 7, hc);         // spike 2 (center, tallest)
      px(ctx, fx(baseX + 14, 3), baseY - 9, 3, 4, hc);          // spike 3 (right)
      px(ctx, fx(baseX + 17, 2), baseY - 7, 2, 3, hc);          // spike 4 (small)
      // Highlight streaks
      px(ctx, fx(baseX + 11, 1), baseY - 11, 1, 3, hcDark);
      px(ctx, fx(baseX + 7, 1), baseY - 9, 1, 2, hcDark);
      // Side burns
      px(ctx, fx(baseX + 5, 2), baseY - 2, 2, 4, hc);
      px(ctx, fx(baseX + 17, 2), baseY - 2, 2, 4, hc);
      break;
    }
    case "long_wavy": {
      // Long hair that extends down past shoulders with wavy outline
      px(ctx, fx(baseX + 5, 14), baseY - 5, 14, 4, hc);        // top mass
      px(ctx, fx(baseX + 4, 16), baseY - 2, 16, 6, hc);         // middle mass
      // Left cascade
      px(ctx, fx(baseX + 3, 4), baseY + 4, 4, 14, hc);
      px(ctx, fx(baseX + 2, 3), baseY + 8, 3, 10, hc);
      px(ctx, fx(baseX + 4, 2), baseY + 18, 2, 4, hcDark);      // wavy tip
      // Right cascade
      px(ctx, fx(baseX + 17, 4), baseY + 4, 4, 14, hc);
      px(ctx, fx(baseX + 19, 3), baseY + 8, 3, 10, hc);
      px(ctx, fx(baseX + 18, 2), baseY + 18, 2, 4, hcDark);     // wavy tip
      // Top highlight
      px(ctx, fx(baseX + 8, 6), baseY - 5, 6, 1, lighten(hc, 0.2));
      break;
    }
    case "afro": {
      // Large round afro shape above and around head
      ctx.fillStyle = hc;
      ctx.beginPath();
      ctx.ellipse(baseX + 12, baseY - 2, 13, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Inner shadow
      ctx.fillStyle = hcDark;
      ctx.beginPath();
      ctx.ellipse(baseX + 12, baseY, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Restore the face area by drawing skin later (handled in drawHead)
      // Side volume
      px(ctx, fx(baseX + 1, 4), baseY + 2, 4, 8, hc);
      px(ctx, fx(baseX + 19, 4), baseY + 2, 4, 8, hc);
      break;
    }
    case "curly_big": {
      // Dark curly voluminous hair
      px(ctx, fx(baseX + 4, 16), baseY - 6, 16, 5, hc);
      // Curly bumps on top
      px(ctx, fx(baseX + 5, 4), baseY - 8, 4, 3, hc);
      px(ctx, fx(baseX + 10, 4), baseY - 9, 4, 4, hc);
      px(ctx, fx(baseX + 15, 3), baseY - 7, 3, 3, hc);
      // Side volume
      px(ctx, fx(baseX + 3, 3), baseY - 2, 3, 8, hc);
      px(ctx, fx(baseX + 18, 3), baseY - 2, 3, 8, hc);
      // Curl details
      px(ctx, fx(baseX + 6, 2), baseY - 7, 2, 1, hcDark);
      px(ctx, fx(baseX + 13, 2), baseY - 8, 2, 1, hcDark);
      break;
    }
    case "short_silver": {
      // Short, neat hair — small patches above head
      px(ctx, fx(baseX + 6, 12), baseY - 4, 12, 4, hc);
      px(ctx, fx(baseX + 7, 10), baseY - 6, 10, 3, hc);
      // Slight side coverage
      px(ctx, fx(baseX + 5, 2), baseY - 1, 2, 3, hc);
      px(ctx, fx(baseX + 17, 2), baseY - 1, 2, 3, hc);
      // Highlight for silver effect
      px(ctx, fx(baseX + 9, 4), baseY - 5, 4, 1, lighten(hc, 0.3));
      break;
    }
    case "messy": {
      // Irregular messy patches sticking out
      px(ctx, fx(baseX + 5, 14), baseY - 5, 14, 5, hc);
      // Random sticking-out patches
      px(ctx, fx(baseX + 4, 3), baseY - 7, 3, 4, hc);
      px(ctx, fx(baseX + 9, 2), baseY - 8, 2, 4, hc);
      px(ctx, fx(baseX + 14, 4), baseY - 7, 4, 3, hc);
      px(ctx, fx(baseX + 18, 3), baseY - 4, 3, 3, hc);
      px(ctx, fx(baseX + 3, 2), baseY - 3, 2, 3, hc);
      // Strand details
      px(ctx, fx(baseX + 7, 1), baseY - 7, 1, 2, hcDark);
      px(ctx, fx(baseX + 16, 1), baseY - 6, 1, 2, hcDark);
      break;
    }
    case "pumpkin_crown": {
      // Coco's pumpkin crown — orange base with green stem
      // Orange pumpkin shape
      ctx.fillStyle = "#FF6B00";
      ctx.beginPath();
      ctx.ellipse(baseX + 12, baseY - 5, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pumpkin ridges
      px(ctx, fx(baseX + 8, 2), baseY - 10, 2, 8, "#CC5500");
      px(ctx, fx(baseX + 14, 2), baseY - 10, 2, 8, "#CC5500");
      // Green stem
      px(ctx, fx(baseX + 11, 2), baseY - 13, 2, 5, "#00AA44");
      px(ctx, fx(baseX + 10, 4), baseY - 14, 4, 2, "#00CC55");
      // Small leaf
      px(ctx, fx(baseX + 14, 3), baseY - 13, 3, 2, "#00DD66");
      // Hair underneath the pumpkin
      px(ctx, fx(baseX + 5, 14), baseY - 2, 14, 3, hc);
      px(ctx, fx(baseX + 4, 3), baseY + 1, 3, 4, hc);
      px(ctx, fx(baseX + 17, 3), baseY + 1, 3, 4, hc);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// HEAD / FACE DRAWING
// ---------------------------------------------------------------------------

function drawHead(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  skinTone: string,
  direction: Direction
) {
  const flip = direction === "left";
  const fx = (x: number, w: number) => flip ? baseX + 24 - x - w : x;

  // Head shape — ~12x10 rectangular with slight rounding
  px(ctx, fx(baseX + 6, 12), baseY, 12, 10, skinTone);
  // Slight cheek highlight
  px(ctx, fx(baseX + 6, 2), baseY + 4, 2, 3, lighten(skinTone, 0.1));

  // Eyes — anime style: 2x3 black with 1x1 white highlight dot
  const eyeColor = "#101020";
  const highlightColor = "#FFFFFF";

  if (!flip) {
    // Right-facing: eyes on right side of face
    // Left eye
    px(ctx, baseX + 9, baseY + 3, 2, 3, eyeColor);
    px(ctx, baseX + 9, baseY + 3, 1, 1, highlightColor);
    // Right eye
    px(ctx, baseX + 14, baseY + 3, 2, 3, eyeColor);
    px(ctx, baseX + 14, baseY + 3, 1, 1, highlightColor);
  } else {
    // Left-facing: eyes on left side
    // Left eye
    px(ctx, baseX + 8, baseY + 3, 2, 3, eyeColor);
    px(ctx, baseX + 9, baseY + 3, 1, 1, highlightColor);
    // Right eye
    px(ctx, baseX + 13, baseY + 3, 2, 3, eyeColor);
    px(ctx, baseX + 14, baseY + 3, 1, 1, highlightColor);
  }

  // Small mouth line
  px(ctx, fx(baseX + 10, 4), baseY + 7, 4, 1, darken(skinTone, 0.2));
}

// ---------------------------------------------------------------------------
// BODY / CLOTHING DRAWING
// ---------------------------------------------------------------------------

function drawBody(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  appearance: AgentAppearance,
  state: AgentState,
  frame: number,
  direction: Direction
) {
  const { shirtColor, pantsColor, accentColor, skinTone } = appearance;
  const shirtDark = darken(shirtColor, 0.2);

  // --- Shirt / torso: ~12x12 below head ---
  px(ctx, baseX + 6, baseY + 10, 12, 12, shirtColor);
  // Shirt shadow on sides
  px(ctx, baseX + 6, baseY + 10, 2, 12, shirtDark);
  px(ctx, baseX + 16, baseY + 10, 2, 12, shirtDark);

  // Collar / undershirt accent
  if (accentColor) {
    px(ctx, baseX + 9, baseY + 10, 6, 2, accentColor);
  }

  // Shirt stripe detail for Kwame (orange/red stripes)
  if (appearance.hairStyle === "afro" && accentColor) {
    for (let s = 0; s < 3; s++) {
      px(ctx, baseX + 7, baseY + 13 + s * 3, 10, 1, accentColor);
    }
  }

  // --- Arms: 3x8 on each side ---
  const armDark = darken(shirtColor, 0.15);
  let leftArmOffset = 0;
  let rightArmOffset = 0;

  if (state === "typing") {
    // Typing animation: arms move alternately
    const armFrame = Math.floor(frame / 6) % 4;
    leftArmOffset = armFrame < 2 ? -1 : 1;
    rightArmOffset = armFrame < 2 ? 1 : -1;
  } else if (state === "walking") {
    // Walking: arms swing
    leftArmOffset = Math.sin(frame * 0.3) * 2;
    rightArmOffset = -Math.sin(frame * 0.3) * 2;
  }

  // Left arm
  px(ctx, baseX + 3, baseY + 11 + leftArmOffset, 3, 8, armDark);
  // Left hand (skin)
  px(ctx, baseX + 3, baseY + 18 + leftArmOffset, 3, 2, skinTone);
  // Right arm
  px(ctx, baseX + 18, baseY + 11 + rightArmOffset, 3, 8, armDark);
  // Right hand (skin)
  px(ctx, baseX + 18, baseY + 18 + rightArmOffset, 3, 2, skinTone);

  // --- Legs / pants: two 4x8 rectangles below body ---
  const pantsDark = darken(pantsColor, 0.15);
  let leftLegOffset = 0;
  let rightLegOffset = 0;

  if (state === "walking") {
    const walkCycle = Math.sin(frame * 0.35);
    leftLegOffset = walkCycle * 2;
    rightLegOffset = -walkCycle * 2;
  }

  // Left leg
  px(ctx, baseX + 7, baseY + 22, 4, 8, pantsColor);
  px(ctx, baseX + 7, baseY + 22 + leftLegOffset, 4, 8, pantsColor);
  px(ctx, baseX + 7, baseY + 22, 1, 8, pantsDark);
  // Left shoe
  px(ctx, baseX + 6, baseY + 29 + leftLegOffset, 5, 3, darken(pantsColor, 0.4));

  // Right leg
  px(ctx, baseX + 13, baseY + 22 + rightLegOffset, 4, 8, pantsColor);
  px(ctx, baseX + 16, baseY + 22, 1, 8, pantsDark);
  // Right shoe
  px(ctx, baseX + 13, baseY + 29 + rightLegOffset, 5, 3, darken(pantsColor, 0.4));
}

// ---------------------------------------------------------------------------
// SHADOW
// ---------------------------------------------------------------------------

function drawShadow(ctx: CanvasRenderingContext2D, baseX: number, baseY: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(baseX + 12, baseY + 33, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// COMPLETE AGENT SPRITE — Assembles all parts
// ---------------------------------------------------------------------------

function drawAgentSprite(
  ctx: CanvasRenderingContext2D,
  agent: Agent,
  globalFrame: number
) {
  const bx = Math.round(agent.x);
  const by = Math.round(agent.y);
  const f = agent.frame + globalFrame;

  // Breathing / idle animation: slight vertical bob
  const breathe = agent.state === "idle" ? Math.sin(f * 0.06) * 1 : 0;
  const bounce = agent.state === "walking" ? Math.abs(Math.sin(f * 0.25)) * 2 : 0;
  const offsetY = -breathe - bounce;

  ctx.save();

  // 1. Shadow
  drawShadow(ctx, bx, by + offsetY);

  // 2. Body (drawn first so hair/head overlaps correctly for afro etc.)
  drawBody(ctx, bx, by + offsetY, agent.appearance, agent.state, f, agent.direction);

  // 3. Head / face
  drawHead(ctx, bx, by + offsetY, agent.appearance.skinTone, agent.direction);

  // 4. Hair (drawn last so it's on top)
  drawHair(ctx, bx, by + offsetY, agent.appearance.hairStyle, agent.appearance.hairColor, agent.direction);

  // 5. Talking animation — speech pulse rings
  if (agent.state === "talking") {
    const pulseR = 6 + Math.sin(f * 0.12) * 4;
    ctx.strokeStyle = "rgba(168,85,247,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx + 12, by + 5 + offsetY, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 6. Typing animation — small keyboard sparkle
  if (agent.state === "typing") {
    const sparkle = Math.floor(f / 8) % 3;
    if (sparkle === 0) {
      px(ctx, bx + 3 + (f % 5) * 3, by + 24 + offsetY, 2, 1, "#00FF9C80");
    }
  }

  // 7. Speech bubble
  if (agent.speech && agent.speechTimer > 0) {
    const bubbleText = agent.speech;
    ctx.font = "bold 8px 'JetBrains Mono', monospace";
    const textW = ctx.measureText(bubbleText).width;
    const bubbleW = textW + 10;
    const bubbleX = bx + 12 - bubbleW / 2;
    const bubbleY = by - 20 + offsetY;

    // Bubble background
    ctx.fillStyle = "rgba(5,5,8,0.92)";
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, 14, 3);
    ctx.fill();

    // Bubble border
    ctx.strokeStyle = "rgba(0,255,156,0.3)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, 14, 3);
    ctx.stroke();

    // Bubble tail
    ctx.fillStyle = "rgba(5,5,8,0.92)";
    ctx.beginPath();
    ctx.moveTo(bx + 10, bubbleY + 14);
    ctx.lineTo(bx + 12, bubbleY + 18);
    ctx.lineTo(bx + 14, bubbleY + 14);
    ctx.fill();

    // Text
    ctx.fillStyle = "#00FF9C";
    ctx.fillText(bubbleText, bubbleX + 5, bubbleY + 10);
  }

  /**
   * MODEL INDICATOR LABEL
   * Shows a small model name badge below the agent when running (typing/talking).
   * Dark background, colored border, model name in 7px font.
   * In production, the model name comes from Gateway system-presence or session info.
   */
  if (agent.model && (agent.state === "typing" || agent.state === "talking")) {
    const modelLabel = agent.model;
    ctx.font = "bold 7px 'JetBrains Mono', monospace";
    const labelTextW = ctx.measureText(modelLabel).width;
    const labelW = labelTextW + 10;
    const labelX = bx + 12 - labelW / 2;
    const labelY = by + 36 + offsetY;

    // Background
    ctx.fillStyle = "rgba(5,5,8,0.9)";
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, 11, 2);
    ctx.fill();

    // Border — blue for typing, purple for talking
    const modelColor = agent.state === "typing" ? "#00B4FF" : "#A855F7";
    ctx.strokeStyle = modelColor + "80";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, 11, 2);
    ctx.stroke();

    // Model text
    ctx.fillStyle = modelColor;
    ctx.fillText(modelLabel, labelX + 5, labelY + 8);

    // Blinking activity dot
    const dotBlink = Math.floor(f / 15) % 2;
    if (dotBlink) {
      ctx.fillStyle = modelColor;
      ctx.beginPath();
      ctx.arc(labelX + labelW - 4, labelY + 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// =============================================================================
// ROOM & FURNITURE DRAWING
// =============================================================================

/**
 * Draws the floor tiles for a single room with a repeating grid pattern.
 * Different colors per room type as defined in FLOOR_COLORS.
 */
function drawRoomFloor(ctx: CanvasRenderingContext2D, room: Room) {
  const colors = FLOOR_COLORS[room.type];
  const tileSize = TILE;

  for (let ty = room.y; ty < room.y + room.h; ty += tileSize) {
    for (let tx = room.x; tx < room.x + room.w; tx += tileSize) {
      const isAlt = ((tx / tileSize) + (ty / tileSize)) % 2 === 0;
      ctx.fillStyle = isAlt ? colors.base : colors.alt;
      ctx.fillRect(tx, ty, tileSize, tileSize);
    }
  }

  // Subtle grid lines
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.5;
  for (let ty = room.y; ty <= room.y + room.h; ty += tileSize) {
    ctx.beginPath();
    ctx.moveTo(room.x, ty);
    ctx.lineTo(room.x + room.w, ty);
    ctx.stroke();
  }
  for (let tx = room.x; tx <= room.x + room.w; tx += tileSize) {
    ctx.beginPath();
    ctx.moveTo(tx, room.y);
    ctx.lineTo(tx, room.y + room.h);
    ctx.stroke();
  }
}

/**
 * Draws the walls between rooms and around the office perimeter.
 * Walls are dark navy with slight highlight on edges.
 */
function drawWalls(ctx: CanvasRenderingContext2D, rooms: Room[]) {
  // Fill the entire background first (walls are the gaps between rooms)
  ctx.fillStyle = WALL_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw room floors on top (so wall gaps show as navy)
  rooms.forEach(room => drawRoomFloor(ctx, room));

  // Draw wall highlights on room edges for depth
  ctx.strokeStyle = WALL_HIGHLIGHT;
  ctx.lineWidth = 2;
  rooms.forEach(room => {
    ctx.strokeRect(room.x, room.y, room.w, room.h);
  });

  // Draw doorway openings (clear the wall between rooms)
  rooms.forEach(room => {
    room.doors.forEach(door => {
      const doorW = 32; // doorway width in pixels
      ctx.fillStyle = "#2A2A3E"; // corridor floor color
      switch (door.side) {
        case "right":
          ctx.fillRect(room.x + room.w - 1, room.y + door.pos - doorW / 2, 18, doorW);
          break;
        case "left":
          ctx.fillRect(room.x - 17, room.y + door.pos - doorW / 2, 18, doorW);
          break;
        case "top":
          ctx.fillRect(room.x + door.pos - doorW / 2, room.y - 17, doorW, 18);
          break;
        case "bottom":
          ctx.fillRect(room.x + door.pos - doorW / 2, room.y + room.h - 1, doorW, 18);
          break;
      }
    });
  });

  // Outer perimeter wall highlight
  ctx.strokeStyle = WALL_HIGHLIGHT;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, CANVAS_W, CANVAS_H);
}

/**
 * Draws all furniture items for the current floor.
 * Each furniture type has a unique pixel art sprite.
 */
function drawFurniture(ctx: CanvasRenderingContext2D, furniture: Furniture[], frame: number) {
  furniture.forEach(f => {
    switch (f.type) {
      case "desk": {
        // Brown wooden desk
        px(ctx, f.x, f.y, f.w, f.h, "#5C3D2E");
        // Desktop surface (lighter)
        px(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 6, "#7A5240");
        // Desk legs
        px(ctx, f.x + 2, f.y + f.h - 4, 3, 4, "#4A2E1F");
        px(ctx, f.x + f.w - 5, f.y + f.h - 4, 3, 4, "#4A2E1F");
        // Edge highlight
        px(ctx, f.x, f.y, f.w, 2, "#8B6848");
        break;
      }
      case "chair": {
        // Small office chair — brown with dark seat
        px(ctx, f.x + 2, f.y, f.w - 4, f.h - 4, "#6B4226");
        px(ctx, f.x + 3, f.y + 1, f.w - 6, f.h - 6, "#7A5240");
        // Back rest
        px(ctx, f.x + 3, f.y - 3, f.w - 6, 4, "#5C3D2E");
        // Wheels
        px(ctx, f.x + 4, f.y + f.h - 2, 2, 2, "#333");
        px(ctx, f.x + f.w - 6, f.y + f.h - 2, 2, 2, "#333");
        break;
      }
      case "crt_monitor": {
        // CRT monitor — beige/gray body with screen
        px(ctx, f.x, f.y, f.w, f.h, "#A0A0A0");
        // Screen (dark blue-green glow)
        px(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 6, "#0A2A1A");
        // Screen scanlines
        for (let sl = 0; sl < 4; sl++) {
          const flickerAlpha = 0.15 + Math.sin(frame * 0.05 + sl) * 0.1;
          ctx.fillStyle = `rgba(0,255,156,${flickerAlpha})`;
          ctx.fillRect(f.x + 3, f.y + 3 + sl * 3, f.w - 6, 1);
        }
        // Power LED
        const ledBlink = Math.sin(frame * 0.08) > 0;
        px(ctx, f.x + f.w / 2 - 1, f.y + f.h - 3, 2, 2, ledBlink ? "#00FF00" : "#004400");
        // Monitor base
        px(ctx, f.x + 4, f.y + f.h - 2, f.w - 8, 3, "#808080");
        break;
      }
      case "laptop": {
        // Small laptop — open
        px(ctx, f.x, f.y, f.w, f.h, "#2A2A3E");
        // Screen
        px(ctx, f.x + 1, f.y + 1, f.w - 2, f.h - 4, "#0A1A2A");
        // Keyboard area
        px(ctx, f.x, f.y + f.h - 3, f.w, 3, "#1A1A2E");
        // Screen content — code lines
        for (let l = 0; l < 3; l++) {
          const lw = 4 + (l * 3) % 7;
          ctx.fillStyle = `rgba(0,255,156,${0.2 + l * 0.05})`;
          ctx.fillRect(f.x + 2, f.y + 2 + l * 3, lw, 1);
        }
        break;
      }
      case "bookshelf": {
        // Tall narrow bookshelf with colored book spines
        px(ctx, f.x, f.y, f.w, f.h, "#4A2E1F");
        // Shelves
        const shelfColors = ["#CC3333", "#3366CC", "#33AA33", "#CC9933", "#9933CC", "#33AAAA"];
        const shelfH = Math.floor(f.h / 4);
        for (let s = 0; s < 4; s++) {
          // Shelf plank
          px(ctx, f.x + 1, f.y + s * shelfH + shelfH - 2, f.w - 2, 2, "#3A2010");
          // Books on shelf
          for (let b = 0; b < 3; b++) {
            const bookColor = shelfColors[(s * 3 + b) % shelfColors.length];
            const bookW = 3 + (b % 2);
            px(ctx, f.x + 2 + b * (bookW + 1), f.y + s * shelfH + 2, bookW, shelfH - 4, bookColor);
          }
        }
        break;
      }
      case "plant": {
        // Potted plant — brown pot with green leaves
        const sway = Math.sin(frame * 0.025) * 1;
        // Pot
        px(ctx, f.x + 3, f.y + 14, 10, 10, "#8B5E3C");
        px(ctx, f.x + 2, f.y + 14, 12, 3, "#9B6E4C");
        // Soil
        px(ctx, f.x + 4, f.y + 13, 8, 2, "#3D2B1F");
        // Leaves
        px(ctx, f.x + 4 + sway, f.y + 4, 8, 10, "#228B22");
        px(ctx, f.x + 2 + sway, f.y + 6, 5, 7, "#2AAA2A");
        px(ctx, f.x + 9 + sway, f.y + 5, 5, 7, "#1E7A1E");
        // Stem
        px(ctx, f.x + 7, f.y + 8, 2, 8, "#1A5A1A");
        // Leaf highlights
        px(ctx, f.x + 6 + sway, f.y + 5, 2, 2, "#33CC33");
        break;
      }
      case "vending_machine": {
        // Tall vending machine with colored lights
        px(ctx, f.x, f.y, f.w, f.h, "#3A3A50");
        // Glass panel
        px(ctx, f.x + 3, f.y + 4, f.w - 6, f.h - 16, "#1A1A2E");
        // Colored product rows
        const vmColors = ["#FF4444", "#44FF44", "#4444FF", "#FFFF44", "#FF44FF"];
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 3; col++) {
            const c = vmColors[(row + col) % vmColors.length];
            px(ctx, f.x + 5 + col * 7, f.y + 6 + row * 9, 5, 7, c + "80");
          }
        }
        // Coin slot
        px(ctx, f.x + f.w - 6, f.y + f.h - 12, 3, 6, "#666");
        // Dispenser slot
        px(ctx, f.x + 4, f.y + f.h - 10, f.w - 8, 8, "#0A0A1E");
        // Power light
        const vmBlink = Math.sin(frame * 0.1) > 0;
        px(ctx, f.x + 4, f.y + 2, 3, 2, vmBlink ? "#00FF00" : "#003300");
        break;
      }
      case "coffee_machine": {
        // Small coffee machine on counter
        px(ctx, f.x, f.y, f.w, f.h, "#4A4A5E");
        px(ctx, f.x + 2, f.y + 2, f.w - 4, f.h / 2, "#2A2A3E");
        // Buttons
        px(ctx, f.x + 3, f.y + f.h - 6, 3, 3, "#FF4444");
        px(ctx, f.x + 8, f.y + f.h - 6, 3, 3, "#44FF44");
        // Steam
        if (Math.sin(frame * 0.1) > 0.3) {
          ctx.fillStyle = "rgba(200,200,200,0.15)";
          ctx.fillRect(f.x + 6, f.y - 4 + Math.sin(frame * 0.15) * 2, 4, 4);
        }
        break;
      }
      case "microwave": {
        px(ctx, f.x, f.y, f.w, f.h, "#B0B0B0");
        // Door/window
        px(ctx, f.x + 2, f.y + 2, f.w - 8, f.h - 4, "#1A2A1A");
        // Control panel
        px(ctx, f.x + f.w - 5, f.y + 2, 4, f.h - 4, "#808080");
        // Buttons
        px(ctx, f.x + f.w - 4, f.y + 3, 2, 2, "#00AA00");
        px(ctx, f.x + f.w - 4, f.y + 7, 2, 2, "#AA0000");
        break;
      }
      case "counter": {
        // Kitchen counter — long horizontal surface
        px(ctx, f.x, f.y, f.w, f.h, "#9B8870");
        px(ctx, f.x, f.y, f.w, 3, "#B0A088"); // top surface highlight
        // Cabinet doors below
        for (let d = 0; d < Math.floor(f.w / 32); d++) {
          px(ctx, f.x + 4 + d * 32, f.y + 8, 24, 14, "#887060");
          px(ctx, f.x + 14 + d * 32, f.y + 14, 4, 3, "#666050"); // handle
        }
        break;
      }
      case "fridge": {
        px(ctx, f.x, f.y, f.w, f.h, "#E0E0E0");
        // Door line
        px(ctx, f.x, f.y + f.h * 0.4, f.w, 2, "#999");
        // Handle
        px(ctx, f.x + f.w - 4, f.y + 8, 2, 8, "#888");
        px(ctx, f.x + f.w - 4, f.y + f.h * 0.4 + 6, 2, 8, "#888");
        // Brand logo area
        px(ctx, f.x + 6, f.y + 4, 8, 3, "#CCCCCC");
        break;
      }
      case "clock": {
        // Wall clock — circle
        ctx.fillStyle = "#E0E0D0";
        ctx.beginPath();
        ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Hands
        const cx = f.x + f.w / 2;
        const cy = f.y + f.h / 2;
        const hourAngle = (frame * 0.001) % (Math.PI * 2);
        const minAngle = (frame * 0.01) % (Math.PI * 2);
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(hourAngle) * 3, cy + Math.sin(hourAngle) * 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(minAngle) * 4, cy + Math.sin(minAngle) * 4);
        ctx.stroke();
        break;
      }
      case "couch": {
        // Wide couch / sofa in warm color
        px(ctx, f.x, f.y, f.w, f.h, "#8B4513");
        // Cushions
        px(ctx, f.x + 3, f.y + 3, f.w / 2 - 4, f.h - 8, "#A0522D");
        px(ctx, f.x + f.w / 2 + 1, f.y + 3, f.w / 2 - 4, f.h - 8, "#A0522D");
        // Back rest
        px(ctx, f.x, f.y - 6, f.w, 8, "#7A3A10");
        // Arm rests
        px(ctx, f.x - 4, f.y - 4, 6, f.h + 2, "#7A3A10");
        px(ctx, f.x + f.w - 2, f.y - 4, 6, f.h + 2, "#7A3A10");
        // Pillow accent
        px(ctx, f.x + 6, f.y + 5, 12, 10, "#CC8844");
        break;
      }
      case "coffee_table": {
        // Small/medium wooden coffee table
        px(ctx, f.x, f.y, f.w, f.h, "#6B4226");
        px(ctx, f.x + 1, f.y + 1, f.w - 2, 2, "#8B5E3C"); // surface highlight
        // Legs
        px(ctx, f.x + 2, f.y + f.h - 3, 2, 3, "#4A2E1F");
        px(ctx, f.x + f.w - 4, f.y + f.h - 3, 2, 3, "#4A2E1F");
        // Items on table
        px(ctx, f.x + f.w / 2 - 4, f.y + 3, 8, 5, "#D4C5A9"); // papers/book
        break;
      }
      case "painting": {
        // Framed painting on wall
        px(ctx, f.x, f.y, f.w, f.h, "#3A3A20"); // frame
        px(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 4, "#1A3A5C"); // canvas - blue landscape
        // Simple landscape
        px(ctx, f.x + 3, f.y + f.h - 8, f.w - 6, 5, "#2A6A2A"); // green hills
        px(ctx, f.x + 8, f.y + 4, 6, 6, "#FFD700"); // sun
        // Frame highlight
        ctx.strokeStyle = "#5A5A30";
        ctx.lineWidth = 1;
        ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
        break;
      }
      case "cardboard_box": {
        px(ctx, f.x, f.y, f.w, f.h, "#B8860B");
        // Box top flaps
        px(ctx, f.x + 1, f.y, f.w / 2 - 2, 4, "#C8960B");
        px(ctx, f.x + f.w / 2 + 1, f.y, f.w / 2 - 2, 4, "#A8760B");
        // Tape
        px(ctx, f.x + f.w / 2 - 2, f.y, 4, f.h, "#D4A01770");
        break;
      }
    }
  });
}

// =============================================================================
// COMMUNICATION LINES — Animated dashed lines between talking agents
// =============================================================================

/**
 * COMMUNICATION LINES
 * Draws animated dashed lines between agents that are talking to each other.
 * Lines have a purple/blue glow with traveling "data packet" dots.
 * In production, communication pairs come from Gateway chat event streams.
 */
function drawCommunicationLines(
  ctx: CanvasRenderingContext2D,
  agents: Agent[],
  globalFrame: number
) {
  const drawn = new Set<string>();

  agents.forEach(agent => {
    if (agent.talkingTo === undefined) return;
    const pairKey = `${Math.min(agent.id, agent.talkingTo)}-${Math.max(agent.id, agent.talkingTo)}`;
    if (drawn.has(pairKey)) return;
    drawn.add(pairKey);

    const target = agents.find(a => a.id === agent.talkingTo);
    if (!target) return;

    // Agent center positions
    const ax = agent.x + 12;
    const ay = agent.y + 16;
    const bx = target.x + 12;
    const by = target.y + 16;

    ctx.save();

    // Animated dash offset
    const dashOffset = globalFrame * 0.8;

    // Glow layer (wider, semi-transparent)
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = "rgba(168,85,247,0.12)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Main line
    ctx.strokeStyle = "rgba(100,60,220,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.setLineDash([]);

    // Data packet 1 — purple dot traveling along the line
    const t1 = ((globalFrame * 0.02) % 1);
    const p1x = ax + (bx - ax) * t1;
    const p1y = ay + (by - ay) * t1;
    ctx.fillStyle = "#A855F7";
    ctx.beginPath();
    ctx.arc(p1x, p1y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Glow around packet
    ctx.fillStyle = "rgba(168,85,247,0.3)";
    ctx.beginPath();
    ctx.arc(p1x, p1y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Data packet 2 — blue dot traveling in reverse
    const t2 = ((globalFrame * 0.02 + 0.5) % 1);
    const p2x = ax + (bx - ax) * t2;
    const p2y = ay + (by - ay) * t2;
    ctx.fillStyle = "#00B4FF";
    ctx.beginPath();
    ctx.arc(p2x, p2y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,180,255,0.25)";
    ctx.beginPath();
    ctx.arc(p2x, p2y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

// =============================================================================
// ROOM LABELS — Subtle room type indicators
// =============================================================================

function drawRoomLabels(ctx: CanvasRenderingContext2D, rooms: Room[]) {
  ctx.save();
  ctx.font = "bold 9px 'JetBrains Mono', monospace";
  ctx.globalAlpha = 0.15;

  rooms.forEach(room => {
    const label = room.type.toUpperCase();
    ctx.fillStyle = room.type === "workspace" ? "#FFD700"
      : room.type === "kitchen" ? "#FF6B35"
      : "#00B4FF";
    ctx.fillText(label, room.x + 8, room.y + 14);
  });

  ctx.globalAlpha = 1.0;
  ctx.restore();
}

// =============================================================================
// AGENT AI BEHAVIOR — Movement and state management
// =============================================================================

function updateAgent(agent: Agent, floor: FloorLayout, dt: number): Agent {
  const updated = { ...agent };
  updated.frame++;

  // Decrement speech timer
  if (updated.speechTimer > 0) {
    updated.speechTimer--;
    if (updated.speechTimer <= 0) {
      updated.speech = undefined;
    }
  }

  // Find the agent's room bounds
  const room = floor.rooms.find(r => r.type === agent.assignedRoom) || floor.rooms[0];
  const bounds = getRoomBounds(room);

  // Coco can go anywhere — use full canvas bounds
  const effectiveBounds = agent.isCoco
    ? { minX: 16, minY: 16, maxX: CANVAS_W - 40, maxY: CANVAS_H - 48 }
    : bounds;

  switch (updated.state) {
    case "idle": {
      updated.idleTimer--;
      if (updated.idleTimer <= 0) {
        // Decide next action
        const roll = Math.random();
        if (roll < 0.4) {
          // Start walking to a new position within room
          updated.state = "walking";
          updated.targetX = effectiveBounds.minX + Math.random() * (effectiveBounds.maxX - effectiveBounds.minX);
          updated.targetY = effectiveBounds.minY + Math.random() * (effectiveBounds.maxY - effectiveBounds.minY);
          updated.walkTimer = 300;
        } else if (roll < 0.7) {
          // Start typing
          updated.state = "typing";
          updated.idleTimer = 200 + Math.floor(Math.random() * 300);
          /**
           * MOCK DATA — Assign model when starting to type
           * In production, model comes from Gateway session info.
           */
          updated.model = MOCK_MODELS[Math.floor(Math.random() * MOCK_MODELS.length)];
        } else {
          // Stay idle longer
          updated.idleTimer = 60 + Math.floor(Math.random() * 120);
        }
      }
      break;
    }
    case "walking": {
      // Move toward target
      const dx = updated.targetX - updated.x;
      const dy = updated.targetY - updated.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = updated.isCoco ? 1.2 : 0.8;

      if (dist < 2) {
        // Arrived at target
        updated.state = "idle";
        updated.idleTimer = 60 + Math.floor(Math.random() * 120);
        updated.model = undefined;
      } else {
        updated.x += (dx / dist) * speed;
        updated.y += (dy / dist) * speed;
        updated.direction = dx > 0 ? "right" : "left";
      }

      updated.walkTimer--;
      if (updated.walkTimer <= 0) {
        updated.state = "idle";
        updated.idleTimer = 40;
      }
      break;
    }
    case "typing": {
      updated.idleTimer--;
      if (updated.idleTimer <= 0) {
        updated.state = "idle";
        updated.idleTimer = 60 + Math.floor(Math.random() * 100);
        updated.model = undefined;
      }
      break;
    }
    case "talking": {
      // Talking agents stay in place but face their partner
      const partner = updated.talkingTo;
      if (partner !== undefined) {
        // This is handled by the talkingTo relationship; stay put
      }
      // Occasionally end conversation
      /**
       * MOCK DATA — Random conversation end
       * In production, conversation state comes from Gateway chat events.
       */
      if (Math.random() < 0.002) {
        updated.talkingTo = undefined;
        updated.state = "idle";
        updated.idleTimer = 100;
        updated.model = undefined;
      }
      break;
    }
  }

  // Random speech bubble generation
  /**
   * MOCK DATA — Random speech bubbles
   * In production, speech content comes from actual agent message streams.
   */
  if (!updated.speech && Math.random() < 0.004 && (updated.state === "typing" || updated.state === "talking")) {
    updated.speech = SPEECH_LINES[Math.floor(Math.random() * SPEECH_LINES.length)];
    updated.speechTimer = 90;
  }

  /**
   * MOCK DATA — Random model rotation
   * In production, models are assigned by Gateway based on task routing.
   */
  if (Math.random() < 0.001 && (updated.state === "typing" || updated.state === "talking")) {
    updated.model = MOCK_MODELS[Math.floor(Math.random() * MOCK_MODELS.length)];
  }

  // Clamp position to effective bounds
  updated.x = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, updated.x));
  updated.y = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, updated.y));

  return updated;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const agentsRef = useRef<Agent[]>([]);

  // Generate floors once
  const floors = useMemo<FloorLayout[]>(() => [
    generateFloorLayout(0),
    generateFloorLayout(1),
    generateFloorLayout(2),
  ], []);

  // Generate agents once (stored in ref for performance — avoid React re-renders)
  const [agentsInitialized, setAgentsInitialized] = useState(false);
  if (!agentsInitialized) {
    agentsRef.current = generateAgents(floors);
    setAgentsInitialized(true);
  }

  // Derived agent stats (recomputed from ref on each render cycle)
  const [stats, setStats] = useState({ floorCount: 0, activeCount: 0, talkingCount: 0, totalAgents: 0 });

  /**
   * COCO FLOOR MOVEMENT
   * Only Coco (agent id 0) can travel between floors.
   * Other agents are fixed to their assigned floor.
   * When floor changes, Coco transitions to the new floor and walks to a random position.
   */
  const handleFloorChange = useCallback((targetFloor: number) => {
    setCurrentFloor(targetFloor);
    // Move Coco to the new floor
    agentsRef.current = agentsRef.current.map(agent => {
      if (!agent.isCoco) return agent;
      const room = floors[targetFloor].rooms[0]; // Coco enters from workspace
      return {
        ...agent,
        floor: targetFloor,
        x: room.x + room.w - 30,   // Enter near a doorway
        y: room.y + room.h / 2,
        targetX: room.x + 100 + Math.random() * 150,
        targetY: room.y + 80 + Math.random() * 200,
        state: "walking" as AgentState,
        speech: `→ F${targetFloor + 1}`,
        speechTimer: 60,
      };
    });
    setSelectedAgent(null);
  }, [floors]);

  // Canvas rendering loop with fixed timestep
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx.imageSmoothingEnabled = false; // crisp pixel art

    const render = (timestamp: number) => {
      // Fixed timestep for ~30fps
      const elapsed = timestamp - lastTimeRef.current;
      if (elapsed < FRAME_DURATION) {
        animRef.current = requestAnimationFrame(render);
        return;
      }
      lastTimeRef.current = timestamp - (elapsed % FRAME_DURATION);
      frameRef.current++;
      const gf = frameRef.current;

      // --- UPDATE AGENTS ---
      const floor = floors[currentFloor];
      agentsRef.current = agentsRef.current.map(agent => {
        if (agent.floor !== currentFloor) return agent;
        return updateAgent(agent, floor, 1);
      });

      // Update stats periodically (every 15 frames to reduce React overhead)
      if (gf % 15 === 0) {
        const floorAgents = agentsRef.current.filter(a => a.floor === currentFloor);
        const active = floorAgents.filter(a => a.state !== "idle").length;
        const talking = floorAgents.filter(a => a.talkingTo !== undefined).length;
        setStats({
          floorCount: floorAgents.length,
          activeCount: active,
          talkingCount: talking,
          totalAgents: agentsRef.current.length,
        });
      }

      // --- RENDER ---
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // 1. Background fill (wall color)
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // 2. Walls and room floors
      drawWalls(ctx, floor.rooms);

      // 3. Room labels
      drawRoomLabels(ctx, floor.rooms);

      // 4. Furniture
      drawFurniture(ctx, floor.furniture, gf);

      // 5. Get visible agents (on current floor)
      const visibleAgents = agentsRef.current.filter(a => a.floor === currentFloor);

      // 6. Communication lines (behind agents)
      drawCommunicationLines(ctx, visibleAgents, gf);

      // 7. Sort agents by Y position for correct depth ordering
      const sortedAgents = [...visibleAgents].sort((a, b) => a.y - b.y);

      // 8. Draw each agent sprite
      sortedAgents.forEach(agent => {
        drawAgentSprite(ctx, agent, gf);
      });

      // 9. Selected agent highlight
      if (selectedAgent) {
        const sel = visibleAgents.find(a => a.id === selectedAgent.id);
        if (sel) {
          ctx.strokeStyle = "#00FF9C";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(sel.x - 2, sel.y - 16, 28, 54);
          ctx.setLineDash([]);
        }
      }

      // 10. Floor indicator in corner
      ctx.fillStyle = "rgba(0,255,156,0.15)";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillText(floor.name, 8, CANVAS_H - 8);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [currentFloor, floors, selectedAgent]);

  // Handle canvas click to select agent
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Find closest agent within click radius (20px)
    const visibleAgents = agentsRef.current.filter(a => a.floor === currentFloor);
    let closestAgent: Agent | null = null;
    let closestDist = 25; // max click distance

    visibleAgents.forEach(agent => {
      const acx = agent.x + 12;
      const acy = agent.y + 16;
      const dist = Math.sqrt((mx - acx) ** 2 + (my - acy) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closestAgent = agent;
      }
    });

    setSelectedAgent(closestAgent);
  }, [currentFloor]);

  return (
    <div className="terminal-panel flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
          <span className="glow-text">PIXEL OFFICE</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Communication count */}
          {stats.talkingCount > 0 && (
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(168,85,247,0.6)" }}>
              <MessageSquare size={8} />
              {Math.floor(stats.talkingCount / 2)} comms
            </span>
          )}
          {/* Agent count */}
          <div className="flex items-center gap-1">
            <Users size={9} style={{ color: "rgba(0,255,156,0.3)" }} />
            <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.4)" }}>
              {stats.floorCount} agents ({stats.activeCount} active)
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
            aria-label="Floor up"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => handleFloorChange(Math.min(2, currentFloor + 1))}
            className="p-0.5"
            style={{ color: "rgba(0,255,156,0.3)" }}
            aria-label="Floor down"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Canvas — renders at 640x480, CSS scales to fill container */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{
            maxHeight: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            border: "1px solid rgba(0,255,156,0.08)",
            boxShadow: "inset 0 0 30px rgba(0,255,156,0.02)",
          }}
          onClick={handleCanvasClick}
          data-testid="canvas-office"
        />
      </div>

      {/* Agent info panel — shows selected agent details */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{
          borderTop: "1px solid rgba(0,255,156,0.08)",
          minHeight: "28px",
        }}
      >
        {selectedAgent ? (
          <div className="flex items-center gap-3 w-full flex-wrap">
            {/* Agent color indicator */}
            <div
              className="w-3 h-3 flex-shrink-0"
              style={{
                background: selectedAgent.isCoco ? "#FF8C00" : selectedAgent.appearance.shirtColor,
                boxShadow: `0 0 6px ${selectedAgent.isCoco ? "#FF8C00" : selectedAgent.appearance.shirtColor}60`,
                borderRadius: selectedAgent.isCoco ? "50%" : "0",
              }}
            />
            {/* Agent name */}
            <span className="text-[10px] font-bold" style={{ color: selectedAgent.isCoco ? "#FFD700" : "#00FF9C" }}>
              {selectedAgent.name}
            </span>
            {/* Role */}
            <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.4)" }}>
              {selectedAgent.role}
            </span>
            {/* Model indicator badge */}
            {selectedAgent.model && (
              <span
                className="text-[8px] px-1.5 py-0.5 flex items-center gap-1"
                style={{
                  color: "#00B4FF",
                  border: "1px solid rgba(0,180,255,0.3)",
                  background: "rgba(0,180,255,0.05)",
                }}
              >
                <Cpu size={7} />
                {selectedAgent.model}
              </span>
            )}
            {/* Communication target badge */}
            {selectedAgent.talkingTo !== undefined && (
              <span
                className="text-[8px] px-1.5 py-0.5"
                style={{
                  color: "#A855F7",
                  border: "1px solid rgba(168,85,247,0.3)",
                  background: "rgba(168,85,247,0.05)",
                }}
              >
                ↔ {agentsRef.current.find(a => a.id === selectedAgent.talkingTo)?.name || `#${selectedAgent.talkingTo}`}
              </span>
            )}
            {/* State badge */}
            <span
              className="text-[9px] px-1.5 py-0.5 ml-auto"
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
            Click an agent to inspect // {stats.totalAgents} agents across {floors.length} floors // 🎃 Coco roams freely
          </span>
        )}
      </div>
    </div>
  );
}
