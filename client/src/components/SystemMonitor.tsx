import { useState, useEffect } from "react";

/* MOCK DATA: All system metrics below are simulated random values.
   On real deployment, fetch from GET /api/system/metrics which
   should read from /proc/stat, /proc/meminfo, df, and sensors
   on the Kali machine. Replace the random metric generation with
   actual system data polling. */
import { Cpu, HardDrive, MemoryStick, Thermometer } from "lucide-react";

export default function SystemMonitor() {
  const [cpu, setCpu] = useState(23);
  const [mem, setMem] = useState(67);
  const [disk, setDisk] = useState(43);
  const [temp, setTemp] = useState(52);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpu(p => Math.max(5, Math.min(95, p + (Math.random() - 0.5) * 12)));
      setMem(p => Math.max(30, Math.min(92, p + (Math.random() - 0.5) * 4)));
      setTemp(p => Math.max(40, Math.min(80, p + (Math.random() - 0.5) * 3)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const Bar = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) => (
    <div className="flex items-center gap-2">
      <Icon size={9} style={{ color: `${color}80`, flexShrink: 0 }} />
      <span className="text-[8px] tracking-wider w-8 flex-shrink-0" style={{ color: "rgba(0,255,156,0.3)" }}>{label}</span>
      <div className="flex-1 h-1.5" style={{ background: "rgba(0,255,156,0.06)", borderRadius: "1px" }}>
        <div className="h-full transition-all duration-500" style={{ width: `${value}%`, background: value > 80 ? "#FF2D78" : color, boxShadow: `0 0 4px ${value > 80 ? "#FF2D78" : color}60`, borderRadius: "1px" }} />
      </div>
      <span className="text-[9px] font-bold w-8 text-right flex-shrink-0" style={{ color: value > 80 ? "#FF2D78" : color }}>{Math.round(value)}%</span>
    </div>
  );

  return (
    <div className="terminal-panel flex-shrink-0">
      <div className="panel-header">SYSTEM MONITOR</div>
      <div className="p-2 space-y-1.5">
        <Bar label="CPU" value={cpu} icon={Cpu} color="#00FF9C" />
        <Bar label="MEM" value={mem} icon={MemoryStick} color="#00B4FF" />
        <Bar label="DISK" value={disk} icon={HardDrive} color="#00B4FF" />
        <Bar label="TEMP" value={temp} icon={Thermometer} color={temp > 70 ? "#FF2D78" : "#FFD700"} />
      </div>
    </div>
  );
}
