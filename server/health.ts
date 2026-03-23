import type { Express } from "express";
import os from "os";

export function registerHealthRoutes(app: Express) {
  // GET /api/health — used by deploy.sh polling and external monitoring
  app.get("/api/health", (_req, res) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    res.json({
      status: "ok",
      service: "openclaw-mission-control",
      version: "4.0.0",
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      system: {
        totalMem: Math.round(os.totalmem() / 1024 / 1024),
        freeMem: Math.round(os.freemem() / 1024 / 1024),
        cpus: os.cpus().length,
        loadAvg: os.loadavg(),
      },
      // Tailscale detection placeholder
      // In production: run `tailscale status --json` and parse the output.
      // The JSON contains fields: Self.TailscaleIPs, Self.DNSName, Peers, etc.
      tailscale: {
        note: "In production, detect via `tailscale status --json`",
      },
    });
  });

  // GET /api/health/ping — minimal health check (used by load balancers / HAProxy)
  app.get("/api/health/ping", (_req, res) => {
    res.send("pong");
  });
}
