import React, { useEffect, useMemo, useState, useRef } from "react";
import Calendar from "../Components/Calendar";
import TaskBar from "../Components/TaskBar";
import ReactModal from "react-modal";
import { Task, Category } from "../Types";
import { fmt, uid, parse } from "../Utils/dateUtils";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  differenceInCalendarDays,
  isBefore,
  isAfter,
  format,
  isValid,
} from "date-fns";
import "./MonthPlanner.css";

type DragMode =
  | { type: "resize"; id: string; edge: "left" | "right" }
  | { type: "select"; startDate: string }
  | null;

export default function MonthPlanner() {

  const [cursorMonth, setCursorMonth] = useState<Date>(new Date());
  const dragRef = useRef<DragMode & { originalStart?: string; originalEnd?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<Task[]>(() => {
    // Load tasks from localStorage or default
    try {
      const s = localStorage.getItem("tasks_v1");
      return s ? JSON.parse(s) : sampleTasks();
    } catch {
      return sampleTasks();
    }
  });

  useEffect(() => {
    localStorage.setItem("tasks_v1", JSON.stringify(tasks));
  }, [tasks]);

  /** Modal state for creating/editing tasks */
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: "",
    start: "",
    end: "",
    category: "To Do" as Category,
  });

  /** Preview state during resize */
  const [previewMap, setPreviewMap] = useState<Record<string, { start: string; end: string }>>({});
const lastHoverDateRef = useRef<Date | null>(null);

  /** Floating task state (while dragging) */
  const [floatingTask, setFloatingTask] = useState<{
    task: Task;
    width: number;
    x: number;
    y: number;
  } | null>(null);

  /** Filters state */
  const [selectedStatuses, setSelectedStatuses] = useState<any>([]);
  const [weeksFilter, setWeeksFilter] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState<null | "category" | "time">(null);
  const [filterOpen, setFilterOpen] = useState(false);


  const weeks = useMemo(() => {
    const monthStart = startOfMonth(cursorMonth);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    const allDays: Date[] = [];
    let cur = gridStart;
    while (cur <= gridEnd) {
      allDays.push(cur);
      cur = addDays(cur, 1);
    }

    const w: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      w.push(allDays.slice(i, i + 7));
    }
    return w;
  }, [cursorMonth]);

  /*  Task Position Calculation */
  type Positioned = { task: Task; weekIndex: number; left: number; width: number };

  const positioned = useMemo(() => {
    const gridStart = weeks[0][0];
    const gridEnd = weeks[weeks.length - 1][6];

    const getDates = (t: Task) => {
      const preview = previewMap[t.id];
      const tStart = parse(preview ? preview.start : t.start);
      const tEnd = parse(preview ? preview.end : t.end);
      return { tStart, tEnd };
    };

    return tasks.flatMap((t) => {
      const { tStart, tEnd } = getDates(t);
      if (isAfter(tStart, gridEnd) || isBefore(tEnd, gridStart)) return [];

      const result: Positioned[] = [];
      for (let wi = 0; wi < weeks.length; wi++) {
        const weekStart = weeks[wi][0];
        const weekEnd = weeks[wi][6];
        const fragStart = isBefore(tStart, weekStart) ? weekStart : tStart;
        const fragEnd = isAfter(tEnd, weekEnd) ? weekEnd : tEnd;
        if (isAfter(fragStart, fragEnd)) continue;

        const left = differenceInCalendarDays(fragStart, weekStart);
        const width = differenceInCalendarDays(fragEnd, fragStart) + 1;

        result.push({ task: t, weekIndex: wi, left, width });
      }
      return result;
    });
  }, [tasks, weeks, previewMap]);

  /** Open "Create Task" modal for a specific date */
  const openCreateFor = (date: Date) => {
    setForm({ title: "", start: fmt(date), end: fmt(date), category: "To Do" });
    setEditing(null);
    setModalOpen(true);
    setFilterOpen(false);
  };

  /** Save form (create or update task) */
  const saveForm = () => {
    if (!form.title) return alert("Enter title");
    if (editing) {
      setTasks((s) => s.map((t) => (t.id === editing.id ? { ...editing, ...form } as Task : t)));
    } else {
      const t: Task = {
        id: uid(),
        title: form.title,
        start: form.start,
        end: form.end,
        category: form.category as Category,
      };
      setTasks((s) => [...s, t]);
    }
    setPreviewMap({});
    setModalOpen(false);
  };

  /** Start dragging a task */
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
  };

  /** Drop task on a new day */
  const onDropOnDay = (date: Date, dt: DataTransfer) => {
    const id = dt.getData("text/plain");
    if (!id) return;
    setTasks((prev) => {
      const t = prev.find((x) => x.id === id);
      if (!t) return prev;
      const duration = differenceInCalendarDays(parse(t.end), parse(t.start));
      const newStart = date;
      const newEnd = addDays(newStart, duration);
      return prev.map((x) =>
        x.id === id ? { ...x, start: fmt(newStart), end: fmt(newEnd) } : x
      );
    });
  };


  /** Edit existing task */
  const editTask = (t: Task) => {
    setEditing(t);
    setForm({ title: t.title, start: t.start, end: t.end, category: t.category });
    setModalOpen(true);
    setFilterOpen(false);
  };

function getDayCellAt(x: number, y: number): HTMLElement | null {
  const stack = (document.elementsFromPoint?.(x, y) || []) as Element[];
  for (const node of stack) {
    const el = (node as HTMLElement).closest?.(".day-cell") as HTMLElement | null;
    if (el && el.getAttribute("data-date")) return el;
  }
  return null;
}

/** Start resizing a task */
const startResizing = (id: string, edge: "left" | "right", event: React.PointerEvent) => {
  event.preventDefault();

  // Important: keep getting pointermove/up even if drag starts
  if ((event.currentTarget as any).setPointerCapture) {
    (event.currentTarget as any).setPointerCapture(event.pointerId);
  }

  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  dragRef.current = {
    type: "resize",
    id,
    edge,
    originalStart: task.start,
    originalEnd: task.end,
  };

  // Seed preview and lastHoverDate with the current edge date
  setPreviewMap((m) => ({
    ...m,
    [id]: { start: task.start, end: task.end },
  }));

  // Try to seed from the day under pointer; otherwise edge date
  const dayEl = getDayCellAt(event.clientX, event.clientY);
  const seed =
    (dayEl && dayEl.getAttribute("data-date")) ||
    (edge === "left" ? task.start : task.end);
  lastHoverDateRef.current = parse(seed); // use your parse()

  setFloatingTask({
    task,
    width: event.currentTarget.getBoundingClientRect().width,
    x: event.clientX,
    y: event.clientY,
  });

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp);
};

const onPointerMove = (ev: PointerEvent) => {
  const dragState = dragRef.current;
  if (!dragState || dragState.type !== "resize") return;

  setFloatingTask((prev) =>
    prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null
  );

  const { id, edge, originalStart, originalEnd } = dragState;
  if (!originalStart || !originalEnd) return;

  // Update last valid hover date if a day cell is under the pointer
  const dayEl = getDayCellAt(ev.clientX, ev.clientY);
  const dayAttr = dayEl?.getAttribute("data-date");
  if (dayAttr) {
    lastHoverDateRef.current = parse(dayAttr);
  }

  // Use the latest known hover date; if none yet, fall back to edge date
  const fallback = edge === "left" ? parse(originalStart) : parse(originalEnd);
  const hoverDate = lastHoverDateRef.current ?? fallback;

  let newStart = parse(originalStart);
  let newEnd = parse(originalEnd);

  if (edge === "left") {
    newStart = isAfter(hoverDate, newEnd) ? newEnd : hoverDate;
  } else {
    newEnd = isBefore(hoverDate, newStart) ? newStart : hoverDate;
  }

  setPreviewMap((m) => ({
    ...m,
    [id]: { start: fmt(newStart), end: fmt(newEnd) },
  }));
};

const onPointerUp = () => {
  const dragState: any = dragRef.current;
  if (dragState?.type === "resize") {
    const { id, edge, originalStart, originalEnd } = dragState;
    if (!originalStart || !originalEnd) return;

    // Fall back to the corresponding edge date if we never got a valid hover date
    const fallback = edge === "left" ? parse(originalStart) : parse(originalEnd);
    const hoverDate = lastHoverDateRef.current ?? fallback;

    let newStart = parse(originalStart);
    let newEnd = parse(originalEnd);

    // Save previous values so cancel can restore
    dragState.previousStart = originalStart;
    dragState.previousEnd = originalEnd;

    if (edge === "left") {
      newStart = isAfter(hoverDate, newEnd) ? newEnd : hoverDate;
    } else {
      newEnd = isBefore(hoverDate, newStart) ? newStart : hoverDate;
    }

    // Commit task change
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, start: fmt(newStart), end: fmt(newEnd) } : t
      )
    );

    // Open modal with updated task
    const originalTask = tasks.find((t) => t.id === id);
    if (originalTask) {
      const updatedTask = { ...originalTask, start: fmt(newStart), end: fmt(newEnd) };
      setEditing(updatedTask);
      setForm(updatedTask);
      setModalOpen(true);
    }
  }

  // Cleanup
  dragRef.current = null;
  lastHoverDateRef.current = null;
  setFloatingTask(null);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
};


  const cancelEdit = () => {
  if (editing && dragRef.current?.type === "resize") {
    const origStart = dragRef.current.originalStart;
    const origEnd = dragRef.current.originalEnd;
    if (origStart && origEnd) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editing.id ? { ...t, start: origStart, end: origEnd } : t
        )
      );
    }
  }
  setPreviewMap({});
  setFloatingTask(null);
  dragRef.current = null;
  setEditing(null);
  setModalOpen(false);
};
const deleteTask = (id: string) => {
    setTasks((s) => s.filter((t) => t.id !== id));
  };

  /** Select a range of dates to create task */
  const onRangeSelect = (start: Date, end: Date) => {
    setForm({ title: "", start: fmt(start), end: fmt(end), category: "To Do" });
    setEditing(null);
    setModalOpen(true);
  };

  /** Toggle category filter */
  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev: any) =>
      prev.includes(status)
        ? prev.filter((s: any) => s !== status)
        : [...prev, status]
    );
  };

  /** Toggle filter dropdowns */
  const toggleDropdown = (type: "category" | "time") => {
    setOpenDropdown((prev) => (prev === type ? null : type));
  };

  /** Filtered positioned tasks */
  const filteredPositioned = positioned
    .filter((p) => p.task.title.toLowerCase().includes(search.toLowerCase()))
    .filter((p: any) => {
      if (!weeksFilter) return true;
      const monthStart = startOfMonth(cursorMonth);
      const weekStart = addDays(monthStart, (weeksFilter - 1) * 7);
      const weekEnd = addDays(weekStart, 6);
      const taskStart = parse(p.task.start);
      const taskEnd = parse(p.task.end);
      return taskStart <= weekEnd && taskEnd >= weekStart;
    })
    .filter((p: any) =>
      selectedStatuses.length > 0
        ? selectedStatuses.includes(p.task.category)
        : true
    );

  return (
    <div className="planner-root">
                <div className="month-label mb-4">Month View Task Planner</div>

      <div className="planner-header">
        <div className="nav">
          <button onClick={() => setCursorMonth((d) => addDays(startOfMonth(d), -1))} className="nav-btn">Prev</button>
          <div className="month-label">{format(cursorMonth, "MMMM yyyy")}</div>
          <button onClick={() => setCursorMonth((d) => addDays(endOfMonth(d), 1))} className="nav-btn">Next</button>
        </div>
        <div className="legend">
          {/* SEARCH FILTERT */}

          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          <div
            className="dropdown input filter-dropdown"
            onClick={() => setFilterOpen((prev) => !prev)}
          >
            <span>Filter</span>
          </div>

          {filterOpen && (
            <div className="input filter-panel">
              {/* CATEGORY FILTER */}
              <div className="dropdown-wrapper">
                <div
                  className="dropdown category-dropdown"
                  onClick={() => toggleDropdown("category")}
                >
                  Category Filters
                  <span className="dropdown-arrow">
                    {openDropdown === "category" ? "▲" : "▼"}
                  </span>
                </div>

                {openDropdown === "category" && (
                  <div className="category-options">
                    {[
                      { label: "To Do", color: "#00a3ff" },
                      { label: "In Progress", color: "#ffb020" },
                      { label: "Review", color: "#7C4DFF" },
                      { label: "Completed", color: "#2ECC71" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        onClick={() => toggleStatus(item.label)}
                        className="category-option"
                      >
                        <div
                          className="category-color-box"
                          style={{ background: item.color }}
                        >
                          {selectedStatuses.includes(item.label) && (
                            <span className="checkmark">✔</span>
                          )}
                        </div>
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TIME FILTER */}
              <div className="dropdown-wrapper">
                <div
                  className="dropdown time-dropdown"
                  onClick={() => toggleDropdown("time")}
                >
                  Time-Based Filters
                  <span className="dropdown-arrow">
                    {openDropdown === "time" ? "▲" : "▼"}
                  </span>
                </div>

                {openDropdown === "time" && (
                  <div className="time-options">
                    {[1, 2, 3, 4].map((num) => (
                      <label key={num} className="time-option">
                        <input
                          type="radio"
                          name="weeksFilter"
                          checked={weeksFilter === num}
                          onChange={() => setWeeksFilter(num)}
                        />
                        {num} week{num > 1 ? "s" : ""}
                      </label>
                    ))}

                    <label className="time-option">
                      <input
                        type="radio"
                        name="weeksFilter"
                        checked={weeksFilter === null}
                        onChange={() => setWeeksFilter(null)}
                      />
                      Show all
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}




        </div>
      </div>

      <Calendar
        yearMonth={cursorMonth}
        weeks={weeks}
        onDayClick={openCreateFor}
        onDropOnDay={onDropOnDay}
        renderDayContent={(d) => null}
        onRangeSelect={onRangeSelect}
      />
      {/* TASK BAR */}

      <div className="bars-overlay">
        {filteredPositioned.map((p, idx) => {
          const leftPercent = (p.left / 7) * 100;
          const widthPercent = (p.width / 7) * 100;
          return (
            <div
              key={`${p.task.id}-${idx}`}
              style={{
                top: `${p.weekIndex * 84 + 40}px`,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
              className="bar-wrapper"
              onClick={() => editTask(p.task)}
              // deleteTask(p.task.id)
            >
              <TaskBar
                task={p.task}
                onDragStart={onDragStart}
                onDoubleClick={editTask}
                onStartResize={(id, edge, e) => startResizing(id, edge, e)}
                style={{ width: "100%", height: 22 }}
              />

            </div>
          );
        })}
      </div>
      {floatingTask && (
        <div
          style={{
            position: "fixed",
            top: floatingTask.y + 8,
            left: floatingTask.x + 8,
            width: floatingTask.width,
            background: "#00a3ff",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            zIndex: 9999
          }}
        >
        </div>
      )}
      {/* CREATE/EDIT MODAL */}

      <ReactModal
        isOpen={modalOpen}
        onRequestClose={() =>
          cancelEdit}
        contentLabel="Task Modal"
        style={{

          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
          content: {
            maxWidth: "500px",
            margin: "auto",
            borderRadius: "22px",
            padding: "20px",
            maxHeight: '55vh'
          },
        }}
      >
        <div className="d-flex flex-column justify-content-between" style={{ height: "100%" }}>

          <div>
            <div className="d-flex justify-content-between ">
              <h3 style={{ marginTop: 0 }}>{editing ? "Edit Task" : "Create Task"}</h3>
              <div className="readonly-field">
                  {isValid(new Date(form.start)) && isValid(new Date(form.end))
                ? `${format(new Date(form.start), "dd-MMM-yyyy")} - ${format(new Date(form.end), "dd-MMM-yyyy")}`
                : ""}
              </div>
            </div>
            <label className="label">Task name</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            />


            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) =>
                setForm((s: any) => ({ ...s, category: e.target.value }))
              }
            >
              <option value="" disabled>
                -- Select a category --
              </option>

              <option>To Do</option>
              <option>In Progress</option>
              <option>Review</option>
              <option>Completed</option>
            </select>
          </div>
          <div style={{ textAlign: "right", marginTop: 12 }}>
            <button
              className="btn"
              onClick={() => setModalOpen(false)}
              style={{ marginRight: 8 }}
            >
              Cancel
            </button>
            <button className="btn primary" onClick={saveForm}>
              Save
            </button>
          </div>
        </div>
      </ReactModal>
    </div>
  );
}

function sampleTasks(): Task[] {
  const today = new Date();
  const dd = (d: Date, n: number) => {
    const x = new Date(d); x.setDate(d.getDate() + n); return x;
  };
  return [
    { id: uid(), title: "Task 1", start: fmt(dd(today, 3)), end: fmt(dd(today, 6)), category: "To Do" },
    { id: uid(), title: "Task 2", start: fmt(dd(today, 10)), end: fmt(dd(today, 12)), category: "In Progress" },
    { id: uid(), title: "Task 3", start: fmt(dd(today, 5)), end: fmt(dd(today, 10)), category: "Review" },
  ];
}
