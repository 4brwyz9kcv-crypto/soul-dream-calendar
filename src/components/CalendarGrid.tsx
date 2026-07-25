import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef } from "react";
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

  /**
   * Nach einer Pfeiltaste soll der Fokus auf den neuen Tag wandern - sonst
   * bleibt er auf der alten Zelle haengen und die naechste Taste rechnet
   * wieder vom alten Datum aus.
   *
   * Bewusst ein Effect und kein requestAnimationFrame: rAF laeuft nicht,
   * solange der Tab keine Frames zeichnet, und der Fokus haenge dann fest.
   * Nur gesetzt, wenn die Aenderung wirklich von der Tastatur kam - beim
   * ersten Rendern oder einem Mausklick wird nichts angesprungen.
   */
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const iso = pendingFocus.current;
    if (!iso) return;
    pendingFocus.current = null;
    document.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus();
  });

  /**
   * Tastaturbedienung wie in jedem Datumsfeld: Pfeile um einen Tag bzw. eine
   * Woche, Bild auf/ab um einen Monat, Pos1/Ende an den Monatsrand. Vorher war
   * jeder Tag zwar per Tab erreichbar - durch einen Monat zu kommen hiess aber
   * bis zu 31 Tabstopps.
   *
   * Der Fokus wandert mit: nach dem Neurendern steht der neue Tag im DOM und
   * wird ueber seine ISO-Kennung wieder angesprungen.
   */
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7
    };

    let target: Date | null = null;
    if (event.key in steps) {
      target = new Date(year, month - 1, date.getDate() + steps[event.key]);
    } else if (event.key === "PageUp") {
      target = new Date(year, month - 2, Math.min(date.getDate(), 28));
    } else if (event.key === "PageDown") {
      target = new Date(year, month, Math.min(date.getDate(), 28));
    } else if (event.key === "Home") {
      target = new Date(year, month - 1, 1);
    } else if (event.key === "End") {
      target = new Date(year, month - 1, total);
    }

    if (!target) return;
    event.preventDefault();
    // Der Fokus wird nach dem naechsten Render nachgezogen (siehe unten).
    pendingFocus.current = toDayKey(target).iso;
    onSelect(target);
  };

  return (
    <section className="calendar-board" aria-label="Monatskalender">
      <div className="calendar-board__header">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Vorheriger Monat">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2>{monthName(month)} {year}</h2>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Naechster Monat">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="weekday-grid" aria-hidden="true">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="date-grid" role="grid">
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
              data-iso={iso}
              onClick={() => onSelect(date)}
              onKeyDown={(event) => handleKey(event, date)}
              style={{ "--trace-hue": `${hue}deg` } as CSSProperties}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              // Nur der ausgewaehlte Tag liegt im Tab-Fluss - so ueberspringt
              // Tab das Gitter, und innerhalb wird mit den Pfeilen navigiert.
              tabIndex={isSelected ? 0 : -1}
              aria-label={
                `${day}. ${monthName(month)} ${year}` +
                (isToday ? ", heute" : "") +
                (hasEntry ? ", Notiz vorhanden" : "")
              }
            >
              <span aria-hidden="true">{day}</span>
              <i />
              {hasEntry && <em className="entry-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
