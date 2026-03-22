import { useState } from "react";
import AppShell from "@/components/AppShell";
import BotIdentity from "@/components/BotIdentity";
import ScheduledOps from "@/components/ScheduledOps";
import CommandLog from "@/components/CommandLog";
import GatewayPanel from "@/components/GatewayPanel";
import NetworkInterfaces from "@/components/NetworkInterfaces";
import SystemMonitor from "@/components/SystemMonitor";
import AddTaskModal from "@/components/AddTaskModal";

/* ──────────────────────────────────────────────────────────────
   DASHBOARD — Main overview page
   Responsive 3-column layout on desktop, stacked on mobile.
   Pixel Office has been moved to its own page (/office).
   ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [showAddTask, setShowAddTask] = useState(false);

  return (
    <AppShell>
      {/* Responsive grid: single column on mobile, 3-col on lg+ */}
      <div className="flex-1 p-2 pt-1 h-full overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] xl:grid-cols-[280px_1fr_340px] gap-2 h-full lg:overflow-hidden">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-2 overflow-y-auto min-h-0">
            <BotIdentity />
            <ScheduledOps onAddTask={() => setShowAddTask(true)} />
            <GatewayPanel />
          </div>

          {/* CENTER COLUMN */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <CommandLog />
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-2 min-h-0 overflow-y-auto">
            <NetworkInterfaces />
            <SystemMonitor />
          </div>
        </div>
      </div>

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} />}
    </AppShell>
  );
}
