import { useState } from "react";
import { Plus, Calendar } from "lucide-react";

interface Task {
  name: string;
  schedule: string;
  status: "ACTIVE" | "PENDING" | "PAUSED";
}

const INITIAL_TASKS: Task[] = [
  { name: "Daily briefing", schedule: "08:00 every day", status: "ACTIVE" },
  { name: "Email cleanup", schedule: "every 2h", status: "ACTIVE" },
  { name: "GitHub PR scan", schedule: "every 30min", status: "PENDING" },
  { name: "Calendar check", schedule: "09:00 weekdays", status: "PAUSED" },
  { name: "Memory consolidation", schedule: "03:00 daily", status: "ACTIVE" },
];

interface Props {
  onAddTask: () => void;
}

export default function ScheduledOps({ onAddTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  const toggleTask = (index: number) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        if (t.status === "PAUSED") return { ...t, status: "ACTIVE" };
        if (t.status === "ACTIVE") return { ...t, status: "PAUSED" };
        return t;
      })
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "#00FF9C";
      case "PENDING": return "#00B4FF";
      case "PAUSED": return "#FF2D78";
      default: return "rgba(0,255,156,0.4)";
    }
  };

  return (
    <div className="terminal-panel flex-shrink-0">
      <div className="panel-header">
        <Calendar size={10} style={{ color: "rgba(0,255,156,0.4)" }} />
        SCHEDULED OPERATIONS
      </div>

      <div className="p-2 space-y-0.5">
        {tasks.map((task, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-2 py-1.5 hover:bg-[rgba(0,255,156,0.03)] transition-colors"
            style={{ borderBottom: "1px solid rgba(0,255,156,0.05)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] font-bold tracking-wider px-1"
                  style={{
                    color: statusColor(task.status),
                    border: `1px solid ${statusColor(task.status)}30`,
                    background: `${statusColor(task.status)}08`,
                  }}
                >
                  {task.status}
                </span>
                <span
                  className="text-[11px] truncate"
                  style={{ color: "rgba(0,255,156,0.8)" }}
                >
                  {task.name}
                </span>
              </div>
              <div
                className="text-[9px] mt-0.5 ml-1"
                style={{ color: "rgba(0,255,156,0.3)" }}
              >
                {task.schedule}
              </div>
            </div>

            {task.status !== "PENDING" && (
              <div
                className={`claw-switch ${task.status === "ACTIVE" ? "on" : ""}`}
                onClick={() => toggleTask(i)}
                data-testid={`switch-task-${i}`}
              />
            )}
          </div>
        ))}

        {/* Add Task Button */}
        <button
          onClick={onAddTask}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 mt-2 text-[10px] tracking-widest transition-all"
          style={{
            border: "1px dashed rgba(0,255,156,0.2)",
            color: "rgba(0,255,156,0.5)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(0,255,156,0.4)";
            e.currentTarget.style.color = "#00FF9C";
            e.currentTarget.style.background = "rgba(0,255,156,0.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(0,255,156,0.2)";
            e.currentTarget.style.color = "rgba(0,255,156,0.5)";
            e.currentTarget.style.background = "transparent";
          }}
          data-testid="button-add-task"
        >
          <Plus size={10} /> ADD TASK
        </button>
      </div>
    </div>
  );
}
