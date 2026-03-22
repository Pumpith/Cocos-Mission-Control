import { useState } from "react";
import AppShell from "@/components/AppShell";
import BotIdentity from "@/components/BotIdentity";
import ScheduledOps from "@/components/ScheduledOps";
import CommandLog from "@/components/CommandLog";
import PixelOffice from "@/components/PixelOffice";
import GatewayPanel from "@/components/GatewayPanel";
import NetworkInterfaces from "@/components/NetworkInterfaces";
import SystemMonitor from "@/components/SystemMonitor";
import AddTaskModal from "@/components/AddTaskModal";

export default function Dashboard() {
  const [showAddTask, setShowAddTask] = useState(false);

  return (
    <AppShell>
      <div className="flex-1 grid grid-cols-[280px_1fr_340px] gap-[1px] p-2 pt-1 h-full overflow-hidden">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-[1px] overflow-y-auto min-h-0">
          <BotIdentity />
          <ScheduledOps onAddTask={() => setShowAddTask(true)} />
          <GatewayPanel />
        </div>

        {/* CENTER COLUMN */}
        <div className="flex flex-col gap-[1px] min-h-0 overflow-hidden">
          <CommandLog />
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-[1px] min-h-0 overflow-hidden">
          <PixelOffice />
          <NetworkInterfaces />
          <SystemMonitor />
        </div>
      </div>

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} />}
    </AppShell>
  );
}
