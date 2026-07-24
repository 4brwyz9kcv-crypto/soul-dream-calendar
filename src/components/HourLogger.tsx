import { AlarmClock, ChevronDown, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadHourLog, saveHourLog } from "../services/storage";
import type { HourLog } from "../types";

/**
 * The S.O.U.L Universal Logger: 24 hourly text fields ("0 Stunde" … "23
 * Stunde" in the 2021 Tkinter original), persisted per day in localStorage
 * (`sdc.hours.{iso}`). Slim left rail on desktop, collapsible accordion on
 * mobile. The current hour glows (only when viewing today), filled hours get
 * a subtle neon marker.
 */

const allHours = Array.from({ length: 24 }, (_, hour) => hour);

interface HourLoggerProps {
  dayKey: string;
  isToday: boolean;
}

export function HourLogger({ dayKey, isToday }: HourLoggerProps) {
  const [hours, setHours] = useState<HourLog>(() => loadHourLog(dayKey));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHours(loadHourLog(dayKey));
  }, [dayKey]);

  // Desktop console rail: center the current hour in the internal scroller on
  // mount / day switch (today only). Sets scrollTop directly instead of
  // scrollIntoView so surrounding page scroll positions are never touched;
  // no-op wherever the body isn't a scroll container (mobile accordion).
  useEffect(() => {
    if (!isToday) return;
    const body = bodyRef.current;
    if (!body || body.scrollHeight <= body.clientHeight) return;
    const row = body.querySelector<HTMLElement>(".hour-row.is-now");
    if (!row) return;
    body.scrollTop = Math.max(0, row.offsetTop - body.clientHeight / 2 + row.offsetHeight / 2);
  }, [dayKey, isToday]);

  useEffect(() => {
    if (!isToday) return;
    const timer = window.setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(timer);
  }, [isToday]);

  const updateHour = (hour: number, value: string) => {
    setHours((current) => {
      const next = { ...current, [hour]: value };
      saveHourLog(dayKey, next);
      return next;
    });
  };

  const filledCount = allHours.filter((hour) => (hours[hour] ?? "").trim().length > 0).length;

  return (
    <section className={`hour-logger${mobileOpen ? " is-open" : ""}`} aria-label="Stunden-Logger">
      <button
        type="button"
        className="hour-logger__toggle"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <AlarmClock size={16} aria-hidden="true" />
        Stunden-Logger
        <span className="hour-logger__count">{filledCount}/24</span>
        <ChevronDown size={16} className="hour-logger__chevron" aria-hidden="true" />
      </button>

      <header className="hour-logger__head">
        <AlarmClock size={16} aria-hidden="true" />
        <strong>Universal Logger</strong>
        <span className="hour-logger__count" title={`${filledCount} von 24 Stunden protokolliert`}>
          {filledCount}/24
        </span>
      </header>

      {/* Wrapper enables the motion-safe grid-template-rows accordion on mobile;
          on desktop it renders as a plain block. */}
      <div className="hour-logger__body" ref={bodyRef}>
        <div className="hour-logger__body-inner">
          <ol className="hour-logger__list">
            {allHours.map((hour) => {
              const value = hours[hour] ?? "";
              const filled = value.trim().length > 0;
              const isNow = isToday && hour === currentHour;
              return (
                <li
                  key={hour}
                  className={`hour-row${filled ? " has-entry" : ""}${isNow ? " is-now" : ""}`}
                >
                  <span className="hour-row__label" aria-hidden="true">
                    {String(hour).padStart(2, "0")}
                  </span>
                  <input
                    value={value}
                    onChange={(event) => updateHour(hour, event.target.value)}
                    aria-label={`${hour}. Stunde (${String(hour).padStart(2, "0")}:00 Uhr)`}
                    aria-current={isNow ? "time" : undefined}
                    placeholder={isNow ? "Jetzt…" : ""}
                    maxLength={160}
                  />
                </li>
              );
            })}
          </ol>

          <small className="hour-logger__hint">
            <Save size={12} aria-hidden="true" /> Lokal automatisch gespeichert
          </small>
        </div>
      </div>
    </section>
  );
}
