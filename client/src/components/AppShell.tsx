import NavRail from "./NavRail";
import TopBar from "./TopBar";
import { PerplexityAttribution } from "./PerplexityAttribution";

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  return (
    <div className="crt-flicker flex h-screen overflow-hidden bg-[#050508]">
      <NavRail />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
        <div className="px-4 py-0.5 text-center flex-shrink-0" style={{ fontSize: "8px", color: "rgba(0,255,156,0.2)" }}>
          <PerplexityAttribution />
        </div>
      </div>
    </div>
  );
}
