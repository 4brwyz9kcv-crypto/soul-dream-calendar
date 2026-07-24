import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { fromIsoDate, monthName, toDayKey } from "../services/dates";
import { listJournalDayKeys } from "../services/storage";

interface CalendarGridProps {
  selectedIso: string;
  onSelect: (date: Date) => void;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function startOffset(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function CalendarGrid({ selectedIso, onSelect }: CalendarGridProps) {
  const selectedDate = fromIsoDate(selectedIso);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;
  const total = daysInMonth(year, month);
  const offset = startOffset(year, month);
  const cells = Array.from({ length: offset + total }, (_, index) => (index < offset ? null : index - offset + 1));
  const todayIso = toDayKey(new Date()).iso;
  // One localStorage pass per month view, never per cell.
  const journalDays = useMemo(() => new Set(listJournalDayKeys()), [selectedIso]);

  const moveMonth = (delta: number) => {
    onSelect(new Date(year, month - 1 + delta, Math.min(selectedDate.getDate(), 28)));
  };

  return (
    <section className="calendar-board" aria-label="Monatskalender">
      <div className="calendar-board__header">
        <button type="button" onClick={() => moveMonth(-1)} title="Vorheriger Monat">
          <ChevronLeft size={18} />
        </button>
        <h2>{monthName(month)} {year}</h2>
        <button type="button" onClick={() => moveMonth(1)} title="Naechster Monat">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="weekday-grid" aria-hidden="true">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="date-grid">
        {cells.map((day, index) => {
          if (!day) return <span className="date-cell is-empty" key={`empty-${index}`} />;
          const date = new Date(year, month - 1, day);
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          const hasEntry = journalDays.has(iso);
          const hue = (day * 31 + month * 19) % 360;
          return (
            <button
              type="button"
              className={`date-cell ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${hasEntry ? "has-entry" : ""}`}
              key={iso}
              onClick={() => onSelect(date)}
              style={{ "--trace-hue": `${hue}deg` } as CSSProperties}
              aria-pressed={isSelected}
              title={`${isToday ? "Heute" : ""}${isToday && hasEntry ? " · " : ""}${hasEntry ? "Notiz vorhanden" : ""}` || undefined}
            >
              <span>{day}</span>
              <i />
              {hasEntry && <em className="entry-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
