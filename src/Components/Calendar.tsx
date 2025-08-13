import React, { useRef, useState } from "react";
import { isSameMonth, format } from "date-fns";

interface CalendarProps {
  yearMonth: Date; // any date in the month to render
  weeks: Date[][];
  onDayClick: (date: Date) => void;
  onDropOnDay: (date: Date, data: DataTransfer) => void;
  renderDayContent?: (date: Date) => React.ReactNode;
  onRangeSelect?: (start: Date, end: Date) => void; // new
}

export default function Calendar({ yearMonth, weeks, onDayClick, onDropOnDay, renderDayContent, onRangeSelect }: CalendarProps) {
  // header
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // selection state
  const selectingRef = useRef<{ startDate: Date | null }>({ startDate: null });
  const [selectionRange, setSelectionRange] = useState<{ start: Date; end: Date } | null>(null);

  // pointer handlers for range select
  const onPointerDownCell = (ev: React.PointerEvent, day: Date) => {
    // ignore if pointer coming from draggable (a task) - let drag & drop handle that
    const target = ev.target as HTMLElement;
    if (target.closest(".task-bar")) return;
    // begin capture
    (ev.target as Element).setPointerCapture(ev.pointerId);
    selectingRef.current.startDate = day;
    setSelectionRange({ start: day, end: day });
  };

  const onPointerEnterCell = (ev: React.PointerEvent, day: Date) => {
    if (!selectingRef.current.startDate) return;
    const start = selectingRef.current.startDate;
    // normalize order
    const a = start <= day ? start : day;
    const b = start <= day ? day : start;
    setSelectionRange({ start: a, end: b });
  };

  const onPointerUpCell = (ev: React.PointerEvent, day: Date) => {
    const start = selectingRef.current.startDate;
    if (!start) return;
    // release capture
    try {
      (ev.target as Element).releasePointerCapture(ev.pointerId);
    } catch {}
    const a = start <= day ? start : day;
    const b = start <= day ? day : start;
    setSelectionRange(null);
    selectingRef.current.startDate = null;
    if (onRangeSelect) onRangeSelect(a, b);
  };

  return (
    <div className="calendar-root">
      <div className="calendar-header">
        {weekDays.map((d) => (
          <div key={d} className="weekday">{d}</div>
        ))}
      </div>

      <div className="calendar-body">
        {weeks.map((week, wi) => (
          <div key={wi} className="week-row">
            {week.map((day, di) => {
              const isCurrentMonth = isSameMonth(day, yearMonth);
              const isInSelection =
                selectionRange &&
                day >= selectionRange.start &&
                day <= selectionRange.end;

  const today = new Date();
  const isToday =
    day.getFullYear() === today.getFullYear() &&
    day.getMonth() === today.getMonth() &&
    day.getDate() === today.getDate();
              return (
                <div
                  key={di}
                  className={`day-cell ${isCurrentMonth ? "" : "muted"} ${isInSelection ? "selecting" : ""}${isToday ? "today" : ""}`}
                  onClick={() => onDayClick(day)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onDropOnDay(day, e.dataTransfer); }}
                   onPointerDown={(e) => onPointerDownCell(e, day)}
                  onPointerEnter={(e) => onPointerEnterCell(e, day)}
                  onPointerUp={(e) => onPointerUpCell(e, day)}
                   data-date={format(day, "yyyy-MM-dd")}
                >
                  <div className="day-number">{format(day, "d")}</div>
                  <div className="day-content">{renderDayContent ? renderDayContent(day) : null}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
