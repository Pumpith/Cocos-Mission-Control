import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function AddTaskModal({ onClose }: Props) {
  const [taskName, setTaskName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    // Pure UI - just close
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span
              className="text-[10px] tracking-widest"
              style={{ color: "rgba(0,255,156,0.4)" }}
            >
              //
            </span>
            <span
              className="text-xs font-bold tracking-wider ml-2"
              style={{ color: "#00FF9C", textShadow: "0 0 6px rgba(0,255,156,0.4)" }}
            >
              NEW SCHEDULED TASK
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 transition-colors"
            style={{ color: "rgba(255,45,120,0.5)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#FF2D78")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,45,120,0.5)")}
            data-testid="button-close-modal"
          >
            <X size={14} />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div>
            <label
              className="text-[9px] tracking-widest block mb-1"
              style={{ color: "rgba(0,255,156,0.4)" }}
            >
              TASK NAME
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Inbox cleanup"
              className="w-full bg-transparent text-[11px] outline-none px-2 py-1.5"
              style={{
                color: "#00FF9C",
                border: "1px solid rgba(0,255,156,0.15)",
                caretColor: "#00FF9C",
              }}
              data-testid="input-task-name"
            />
          </div>

          <div>
            <label
              className="text-[9px] tracking-widest block mb-1"
              style={{ color: "rgba(0,255,156,0.4)" }}
            >
              SCHEDULE (CRON)
            </label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g. 0 */2 * * * (every 2 hours)"
              className="w-full bg-transparent text-[11px] outline-none px-2 py-1.5"
              style={{
                color: "#00B4FF",
                border: "1px solid rgba(0,180,255,0.15)",
                caretColor: "#00B4FF",
              }}
              data-testid="input-task-schedule"
            />
          </div>

          <div>
            <label
              className="text-[9px] tracking-widest block mb-1"
              style={{ color: "rgba(0,255,156,0.4)" }}
            >
              DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should the agent do?"
              rows={3}
              className="w-full bg-transparent text-[11px] outline-none px-2 py-1.5 resize-none"
              style={{
                color: "rgba(0,255,156,0.7)",
                border: "1px solid rgba(0,255,156,0.1)",
                caretColor: "#00FF9C",
              }}
              data-testid="input-task-description"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3" style={{ borderTop: "1px solid rgba(0,255,156,0.08)" }}>
          <button
            onClick={onClose}
            className="text-[10px] tracking-wider px-3 py-1.5"
            style={{
              border: "1px solid rgba(255,45,120,0.2)",
              color: "rgba(255,45,120,0.5)",
            }}
            data-testid="button-cancel-task"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            className="text-[10px] tracking-wider px-4 py-1.5 font-bold transition-all"
            style={{
              border: "1px solid rgba(0,255,156,0.4)",
              color: "#00FF9C",
              background: "rgba(0,255,156,0.05)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,156,0.3)";
              e.currentTarget.style.background = "rgba(0,255,156,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.background = "rgba(0,255,156,0.05)";
            }}
            data-testid="button-create-task"
          >
            CREATE TASK
          </button>
        </div>
      </div>
    </div>
  );
}
