import { useState, useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import WeaponVault from "@/pages/WeaponVault";
import FirewallMonitor from "@/pages/FirewallMonitor";
import ThreatIntel from "@/pages/ThreatIntel";
import PixelOfficePage from "@/pages/PixelOfficePage";
import AgentComms from "@/pages/AgentComms";
import ConfigEditor from "@/pages/ConfigEditor";
import SecurityHealth from "@/pages/SecurityHealth";
import AgentsSkills from "@/pages/AgentsSkills";
import TaskPlanner from "@/pages/TaskPlanner";
import FileExplorer from "@/pages/FileExplorer";
import TokenUsage from "@/pages/TokenUsage";
import ActivityLog from "@/pages/ActivityLog";
import SSHMonitor from "@/pages/SSHMonitor";
import Settings from "@/pages/Settings";
import OnboardingWizard from "@/components/OnboardingWizard";
import BootSequence from "@/components/BootSequence";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agents-skills" component={AgentsSkills} />
      <Route path="/planner" component={TaskPlanner} />
      <Route path="/files" component={FileExplorer} />
      <Route path="/tokens" component={TokenUsage} />
      <Route path="/activity" component={ActivityLog} />
      <Route path="/weapons" component={WeaponVault} />
      <Route path="/firewall" component={FirewallMonitor} />
      <Route path="/threat-intel" component={ThreatIntel} />
      <Route path="/office" component={PixelOfficePage} />
      <Route path="/agent-comms" component={AgentComms} />
      <Route path="/config" component={ConfigEditor} />
      <Route path="/security" component={SecurityHealth} />
      <Route path="/ssh" component={SSHMonitor} />
      <Route path="/settings" component={Settings} />
      <Route component={Dashboard} />
    </Switch>
  );
}

function App() {
  const [booted, setBooted] = useState(() => {
    return localStorage.getItem("mc_booted") === "true";
  });
  const [onboarded, setOnboarded] = useState(() => {
    return localStorage.getItem("mc_onboarded") === "true";
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!onboarded && booted) {
      setShowOnboarding(true);
    }
  }, [booted, onboarded]);

  useEffect(() => {
    localStorage.setItem("mc_booted", booted.toString());
  }, [booted]);

  useEffect(() => {
    localStorage.setItem("mc_onboarded", onboarded.toString());
  }, [onboarded]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {!booted && <BootSequence onComplete={() => setBooted(true)} />}
        {showOnboarding && (
          <OnboardingWizard onComplete={() => { setOnboarded(true); setShowOnboarding(false); }} />
        )}
        <div className={`transition-opacity duration-500 ${booted && !showOnboarding ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="scanline-overlay" />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
