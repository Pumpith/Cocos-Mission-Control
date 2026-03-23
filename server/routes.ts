import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerHealthRoutes } from "./health";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // prefix all routes with /api
  // use storage to perform CRUD operations on the storage interface
  // e.g. app.get("/api/items", async (_req, res) => { ... })

  // Health endpoints — used by deploy.sh and monitoring tools
  registerHealthRoutes(app);

  return httpServer;
}
