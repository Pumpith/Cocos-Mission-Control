import { useState, useEffect } from "react";
import { Wifi, Network, ArrowUp, ArrowDown, Activity } from "lucide-react";

interface NetInterface {
  name: string;
  type: "ethernet" | "wifi" | "vpn" | "loopback" | "bridge";
  ip: string;
  mac: string;
  status: "up" | "down";
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
  rxPackets: number;
  txPackets: number;
}

const INITIAL_INTERFACES: NetInterface[] = [
  { name: "eth0", type: "ethernet", ip: "192.168.1.50", mac: "aa:bb:cc:dd:ee:01", status: "up", rxBytes: 2847293440, txBytes: 1293847040, rxRate: 0, txRate: 0, rxPackets: 4827394, txPackets: 2938471 },
  { name: "wlan0", type: "wifi", ip: "192.168.1.105", mac: "aa:bb:cc:dd:ee:02", status: "up", rxBytes: 948271040, txBytes: 384729600, rxRate: 0, txRate: 0, rxPackets: 1293847, txPackets: 847293 },
  { name: "tun0", type: "vpn", ip: "10.8.0.2", mac: "—", status: "up", rxBytes: 384729600, txBytes: 128947200, rxRate: 0, txRate: 0, rxPackets: 384729, txPackets: 128947 },
  { name: "lo", type: "loopback", ip: "127.0.0.1", mac: "00:00:00:00:00:00", status: "up", rxBytes: 84729600, txBytes: 84729600, rxRate: 0, txRate: 0, rxPackets: 84729, txPackets: 84729 },
  { name: "docker0", type: "bridge", ip: "172.17.0.1", mac: "02:42:ac:11:00:01", status: "down", rxBytes: 0, txBytes: 0, rxRate: 0, txRate: 0, rxPackets: 0, txPackets: 0 },
];

function formatBytes(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + " KB";
  return bytes + " B";
}

function formatRate(bytesPerSec: number) {
  if (bytesPerSec >= 1e6) return (bytesPerSec / 1e6).toFixed(1) + " MB/s";
  if (bytesPerSec >= 1e3) return (bytesPerSec / 1e3).toFixed(1) + " KB/s";
  return bytesPerSec.toFixed(0) + " B/s";
}

const typeIcon = (type: string) => {
  switch (type) {
    case "wifi": return "📡";
    case "vpn": return "🔒";
    case "loopback": return "🔄";
    case "bridge": return "🐳";
    default: return "🔌";
  }
};

export default function NetworkInterfaces() {
  const [interfaces, setInterfaces] = useState<NetInterface[]>(INITIAL_INTERFACES);

  useEffect(() => {
    const interval = setInterval(() => {
      setInterfaces(prev => prev.map(iface => {
        if (iface.status === "down") return iface;
        const rxAdd = iface.type === "loopback" ? Math.random() * 5000 : Math.random() * 150000 + 10000;
        const txAdd = iface.type === "loopback" ? Math.random() * 5000 : Math.random() * 80000 + 5000;
        return {
          ...iface,
          rxBytes: iface.rxBytes + rxAdd,
          txBytes: iface.txBytes + txAdd,
          rxRate: rxAdd,
          txRate: txAdd,
          rxPackets: iface.rxPackets + Math.floor(rxAdd / 1500),
          txPackets: iface.txPackets + Math.floor(txAdd / 1500),
        };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = interfaces.filter(i => i.status === "up").length;

  return (
    <div className="terminal-panel flex-shrink-0">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Network size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
          NETWORK INTERFACES
        </div>
        <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.3)" }}>
          {activeCount}/{interfaces.length} ACTIVE
        </span>
      </div>

      <div className="p-2 space-y-1">
        {interfaces.map(iface => (
          <div
            key={iface.name}
            className="px-2 py-1.5 transition-colors hover:bg-[rgba(0,255,156,0.02)]"
            style={{ borderBottom: "1px solid rgba(0,255,156,0.04)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px]">{typeIcon(iface.type)}</span>
                <span className="text-[11px] font-bold" style={{ color: iface.status === "up" ? "#00FF9C" : "rgba(255,45,120,0.5)" }}>
                  {iface.name}
                </span>
                <span className="text-[9px]" style={{ color: "rgba(0,180,255,0.6)" }}>{iface.ip}</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: iface.status === "up" ? "#00FF9C" : "#FF2D78",
                    boxShadow: iface.status === "up" ? "0 0 4px #00FF9C" : "none",
                  }}
                />
                <span className="text-[8px] tracking-wider" style={{ color: iface.status === "up" ? "rgba(0,255,156,0.5)" : "rgba(255,45,120,0.4)" }}>
                  {iface.status.toUpperCase()}
                </span>
              </div>
            </div>

            {iface.status === "up" && (
              <div className="flex items-center gap-4 ml-6">
                <div className="flex items-center gap-1">
                  <ArrowDown size={8} style={{ color: "#00B4FF" }} />
                  <span className="text-[9px]" style={{ color: "rgba(0,180,255,0.7)" }}>
                    {formatRate(iface.rxRate)}
                  </span>
                  <span className="text-[8px]" style={{ color: "rgba(0,180,255,0.3)" }}>
                    ({formatBytes(iface.rxBytes)})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowUp size={8} style={{ color: "#00FF9C" }} />
                  <span className="text-[9px]" style={{ color: "rgba(0,255,156,0.7)" }}>
                    {formatRate(iface.txRate)}
                  </span>
                  <span className="text-[8px]" style={{ color: "rgba(0,255,156,0.3)" }}>
                    ({formatBytes(iface.txBytes)})
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
