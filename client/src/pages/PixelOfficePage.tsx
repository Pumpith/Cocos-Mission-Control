import AppShell from "@/components/AppShell";
import PixelOffice from "@/components/PixelOffice";

/* ──────────────────────────────────────────────────────────────
   PIXEL OFFICE PAGE — Dedicated full-page view of the pixel
   office with all agents across floors.
   ────────────────────────────────────────────────────────────── */
export default function PixelOfficePage() {
  return (
    <AppShell>
      <div className="flex-1 p-2 h-full overflow-hidden flex flex-col">
        <div className="panel-header mb-1">
          <span className="text-xs">🏢</span> PIXEL OFFICE // AGENT HEADQUARTERS
        </div>
        <div className="flex-1 terminal-panel overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            <PixelOffice />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
