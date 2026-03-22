import { useState, useEffect, useCallback } from "react";
import TopBar from "@/components/TopBar";
import BotIdentity from "@/components/BotIdentity";
import ScheduledOps from "@/components/ScheduledOps";
import CommandLog from "@/components/CommandLog";
import PixelOffice from "@/components/PixelOffice";
import GatewayPanel from "@/components/GatewayPanel";
import BootSequence from "@/components/BootSequence";
import AddTaskModal from "@/components/AddTaskModal";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

export default function Dashboard() {
  const [booted, setBooted] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      <div
        className={`min-h-screen bg-[#050508] transition-opacity duration-500 ${booted ? "opacity-100" : "opacity-0"}`}
      >
        {/* Scanline CRT overlay */}
        <div className="scanline-overlay" />

        {/* Main CRT flicker container */}
        <div className="crt-flicker flex flex-col h-screen overflow-hidden">
          {/* Top Bar */}
          <TopBar />

          {/* Main Grid */}
          <div className="flex-1 grid grid-cols-[300px_1fr_360px] gap-[1px] p-2 pt-0 overflow-hidden">
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
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-1 text-center" style={{ fontSize: "9px", color: "rgba(0,255,156,0.25)" }}>
            <PerplexityAttribution />
          </div>
        </div>

        {/* Modal */}
        {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} />}
      </div>
    </>
  );
}
