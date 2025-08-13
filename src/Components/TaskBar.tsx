import React from "react";
import { Task } from "../Types";

const colorMap: Record<Task["category"], string> = {
  "To Do": "#00a3ff",
  "In Progress": "#ffb020",
  "Review": "#7C4DFF",
  "Completed": "#2ECC71",
};

export default function TaskBar({
  task,
  style,
  onDragStart,
  onDoubleClick,
  onStartResize,
}: {
  task: Task;
  style?: React.CSSProperties;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDoubleClick?: (t: Task) => void;
  onStartResize?: (id: string, edge: "left" | "right", e: React.PointerEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDoubleClick={() => onDoubleClick?.(task)}
      className="task-bar"
      style={{ backgroundColor: colorMap[task.category], position: "relative", ...style }}
      title={`${task.title} (${task.start} → ${task.end})`}
    >
      {/* left handle */}
      <div
        className="resize-handle left"
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartResize?.(task.id, "left", e);
        }}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: "ew-resize",
        }}
      />
      {/* content */}
      <div className="task-title" style={{ paddingLeft: 8, paddingRight: 8, pointerEvents: "none" }}>{task.title}</div>
      {/* right handle */}
      <div
        className="resize-handle right"
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartResize?.(task.id, "right", e);
        }}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: "ew-resize",
        }}
      />
    </div>
  );
}
