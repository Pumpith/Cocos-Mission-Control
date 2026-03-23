import { useState, useEffect, useCallback, useRef } from "react";

export interface GatewayMessage {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  event?: string;
  payload?: unknown;
  ok?: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface GatewayStatus {
  connected: boolean;
  protocol: number;
  url: string;
  token: string;
  role: string;
  scopes: string[];
  uptime: number;
  messagesIn: number;
  messagesOut: number;
  error?: string;
}

const GATEWAY_URL = "ws://localhost:18789";
const GATEWAY_TOKEN = "942325e9fbb9e303194407766536f4d2c55a66ff52ad9db1";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

let wsInstance: WebSocket | null = null;
let pendingRequests = new Map<string, (msg: GatewayMessage) => void>();
let reconnectTimeout: NodeJS.Timeout | null = null;
let connectTime = 0;
let messageCountIn = 0;
let messageCountOut = 0;
let scopes: string[] = [];

const statusListeners = new Set<(status: GatewayStatus) => void>();
let currentStatus: GatewayStatus = {
  connected: false,
  protocol: 3,
  url: GATEWAY_URL,
  token: GATEWAY_TOKEN.substring(0, 8) + "...",
  role: "operator",
  scopes: [],
  uptime: 0,
  messagesIn: 0,
  messagesOut: 0,
};

function notifyListeners() {
  statusListeners.forEach(listener => listener({ ...currentStatus }));
}

function updateStatus(partial: Partial<GatewayStatus>) {
  currentStatus = { ...currentStatus, ...partial };
  notifyListeners();
}

function handleMessage(msg: GatewayMessage) {
  messageCountIn++;
  updateStatus({ messagesIn: messageCountIn });

  if (msg.type === "event") {
    if (msg.event === "connect.challenge") {
      const challenge = msg.payload as { nonce: string; ts: number };
      sendConnect(challenge.nonce);
    } else if (msg.event === "system-presence") {
      console.log("[Gateway] Presence update:", msg.payload);
    } else if (msg.event === "exec.approval.requested") {
      console.log("[Gateway] Approval requested:", msg.payload);
    } else if (msg.event === "chat.response") {
      console.log("[Gateway] Chat response:", msg.payload);
    }
  } else if (msg.type === "res" && msg.id) {
    const resolver = pendingRequests.get(msg.id);
    if (resolver) {
      resolver(msg);
      pendingRequests.delete(msg.id);
    }
  }
}

function sendConnect(nonce: string) {
  if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) return;

  const connectParams = {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "mission-control",
      version: "1.0.0",
      platform: "web",
      mode: "operator"
    },
    role: "operator",
    scopes: ["operator.read", "operator.write", "operator.approvals"],
    caps: [],
    commands: [],
    permissions: {},
    auth: { token: GATEWAY_TOKEN },
    locale: "en-US",
    userAgent: "mission-control/1.0.0",
    device: {
      id: "mission-control-web",
      publicKey: "",
      signature: "",
      signedAt: Date.now(),
      nonce: nonce
    }
  };

  const id = generateId();
  const msg: GatewayMessage = {
    type: "req",
    id,
    method: "connect",
    params: connectParams
  };

  wsInstance.send(JSON.stringify(msg));
  messageCountOut++;
  updateStatus({ messagesOut: messageCountOut });
}

function connect() {
  if (wsInstance?.readyState === WebSocket.OPEN ||
      wsInstance?.readyState === WebSocket.CONNECTING) {
    return;
  }

  try {
    const ws = new WebSocket(GATEWAY_URL);
    wsInstance = ws;

    ws.onopen = () => {
      console.log("[Gateway] WebSocket connected, waiting for challenge...");
      updateStatus({ connected: true, error: undefined });
    };

    ws.onmessage = (event) => {
      try {
        const msg: GatewayMessage = JSON.parse(event.data);
        handleMessage(msg);

        if (msg.type === "res" && msg.payload && typeof msg.payload === "object" && "type" in msg.payload) {
          const payload = msg.payload as { type: string; auth?: { scopes?: string[]; role?: string } };
          if (payload.type === "hello-ok") {
            connectTime = Date.now();
            if (payload.auth) {
              scopes = payload.auth.scopes || [];
              updateStatus({ scopes, role: payload.auth.role || "operator" });
            }
            console.log("[Gateway] Handshake successful!");
          }
        }
      } catch (e) {
        console.error("[Gateway] Failed to parse message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("[Gateway] WebSocket error:", error);
      updateStatus({ error: "Connection error" });
    };

    ws.onclose = (event) => {
      console.log("[Gateway] WebSocket closed:", event.code, event.reason);
      updateStatus({ connected: false });
      wsInstance = null;
      connectTime = 0;

      if (event.code !== 1000) {
        reconnectTimeout = setTimeout(() => {
          console.log("[Gateway] Reconnecting...");
          connect();
        }, 3000);
      }
    };
  } catch (e) {
    console.error("[Gateway] Failed to create WebSocket:", e);
    updateStatus({ error: "Failed to connect" });
  }
}

function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (wsInstance) {
    wsInstance.close(1000, "User disconnected");
    wsInstance = null;
  }
}

export function sendRequest(method: string, params?: Record<string, unknown>): Promise<GatewayMessage> {
  return new Promise((resolve, reject) => {
    if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
      reject(new Error("WebSocket not connected"));
      return;
    }

    const id = generateId();
    const msg: GatewayMessage = {
      type: "req",
      id,
      method,
      params
    };

    wsInstance.send(JSON.stringify(msg));
    messageCountOut++;
    updateStatus({ messagesOut: messageCountOut });

    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request ${method} timed out`));
    }, 30000);

    pendingRequests.set(id, (res) => {
      clearTimeout(timeout);
      if (res.ok) {
        resolve(res);
      } else {
        reject(new Error(res.error?.message || "Request failed"));
      }
    });
  });
}

export function useGateway() {
  const [status, setStatus] = useState<GatewayStatus>({ ...currentStatus });

  useEffect(() => {
    connect();

    const uptimeInterval = setInterval(() => {
      if (connectTime > 0) {
        const uptime = Math.floor((Date.now() - connectTime) / 1000);
        updateStatus({ uptime });
      }
    }, 1000);

    const listener = (newStatus: GatewayStatus) => {
      setStatus({ ...newStatus });
    };
    statusListeners.add(listener);

    return () => {
      clearInterval(uptimeInterval);
      statusListeners.delete(listener);
    };
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendRequest
  };
}

export const gateway = {
  url: GATEWAY_URL,
  token: GATEWAY_TOKEN
};

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  model: string;
  status: "active" | "idle" | "error";
  role: string;
  workspace?: string;
  skillsCount: number;
  sessionsCount: number;
  memoryUsageMB: number;
  memoryCapMB: number;
  uptime: string;
}

export async function fetchAgents(): Promise<Agent[]> {
  return new Promise((resolve) => {
    const ws = new WebSocket(GATEWAY_URL);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve(getAgentsFromConfig());
      }
    }, 5000);

    ws.onopen = () => {
      ws.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "event" && msg.event === "connect.challenge") {
            const nonce = msg.payload.nonce;
            ws.send(JSON.stringify({
              type: "req",
              id: "fetch-agents-1",
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: { id: "mission-control", version: "1.0.0", platform: "web", mode: "operator" },
                role: "operator",
                scopes: ["operator.read", "operator.write"],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: GATEWAY_TOKEN },
                locale: "en-US",
                userAgent: "mission-control/1.0.0",
                device: { id: "mission-control-web", publicKey: "", signature: "", signedAt: Date.now(), nonce }
              }
            }));
          } else if (msg.type === "res" && msg.id === "fetch-agents-1") {
            clearTimeout(timeout);
            resolved = true;
            ws.close();
            resolve(getAgentsFromConfig());
          }
        } catch {}
      });
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve(getAgentsFromConfig());
      }
    };
  });
}

function getAgentsFromConfig(): Agent[] {
  const agentEmojis: Record<string, string> = {
    main: "🎃",
    xcode: "💻",
    xfund: "💰",
    xsight: "👁️",
    xtech: "⚙️",
    xwork: "🏢",
    xspooky: "👻",
    xbiz: "💼"
  };

  const agentRoles: Record<string, string> = {
    main: "Primary Orchestrator",
    xcode: "Code Agent",
    xfund: "Fund Analyst",
    xsight: "Intelligence Agent",
    xtech: "Tech Analyst",
    xwork: "Work Agent",
    xspooky: "Creative Agent",
    xbiz: "Business Agent"
  };

  return [
    { id: "main", name: "B1GHER0", emoji: "🤖", model: "minimax/MiniMax-M2.5", status: "active", role: "Primary Orchestrator", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 2048, uptime: "0d 0h 0m" },
    { id: "xcode", name: "xCODE", emoji: "💻", model: "blockrun/free", status: "idle", role: "Code Agent", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 1024, uptime: "0d 0h 0m" },
    { id: "xfund", name: "xFUND", emoji: "💰", model: "minimax/MiniMax-M2.5", status: "idle", role: "Fund Analyst", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 1024, uptime: "0d 0h 0m" },
    { id: "xsight", name: "xSIGHT", emoji: "👁️", model: "blockrun/free", status: "idle", role: "Intelligence Agent", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 1024, uptime: "0d 0h 0m" },
    { id: "xtech", name: "xTECH", emoji: "⚙️", model: "minimax/MiniMax-M2.5", status: "idle", role: "Tech Analyst", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 1024, uptime: "0d 0h 0m" },
    { id: "xwork", name: "xWORK", emoji: "🏢", model: "minimax/MiniMax-M2.5", status: "idle", role: "Work Agent", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 1024, uptime: "0d 0h 0m" },
    { id: "xspooky", name: "xSPOOKY", emoji: "👻", model: "minimax/MiniMax-M2.5", status: "idle", role: "Creative Agent", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 1024, uptime: "0d 0h 0m" },
    { id: "xbiz", name: "xBIZ", emoji: "💼", model: "minimax/MiniMax-M2.5", status: "idle", role: "Business Agent", skillsCount: 0, sessionsCount: 0, memoryUsageMB: 0, memoryCapMB: 1024, uptime: "0d 0h 0m" },
  ];
}
