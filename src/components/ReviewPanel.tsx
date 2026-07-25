import { ChevronLeft, ChevronRight, Download, Flame, History, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import { monthName } from "../services/dates";
import { hasContent, monthSummary, searchEntries, streaks, toMarkdown } from "../services/review";
import { loadAllProfileData } from "../services/storage";

/**
 * Rueckblick: der Monat als Farbstreifen, die Serie, und eine Suche ueber
 * alles Geschriebene.
 *
 * Die Farben stammen aus derselben Legacy-Formel wie im Tagesorakel und
 * stehen auch fuer leere Tage - der Streifen zeigt damit gleichzeitig den
 * Rhythmus des Monats und die Luecken darin.
 */

interface ReviewPanelProps {
  /** Wechselt beim Profilwechsel und erzwingt so ein Neulesen. */
  profileId: string;
  selectedIso: string;
  onSelectDay: (iso: string) => void;
  profileName: string;
}

export function ReviewPanel({ profileId, selectedIso, onSelectDay, profileName }: ReviewPanelProps) {
  const [year, setYear] = useState(() => Number(selectedIso.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(selectedIso.slice(5, 7)));
  const [query, setQuery] = useState("");

  // Ein einziger Speicherdurchlauf pro Profil, nicht pro Tastendruck.
  const data = useMemo(() => loadAllProfileData(), [profileId]);

  const days = useMemo(() => monthSummary(year, month, data), [year, month, data]);
  const streak = useMemo(
    () => streaks(Object.keys(data.journal).filter((iso) => hasContent(data.journal[iso]))),
    [data]
  );

  // Die Suche laeuft ueber den gesamten Bestand; useDeferredValue haelt die
  // Eingabe fluessig, waehrend die Trefferliste hinterherzieht.
  const deferredQuery = useDeferredValue(query);
  const hits = useMemo(() => searchEntries(deferredQuery, data), [deferredQuery, data]);

  const shift = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([toMarkdown(data, profileName)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soul-dream-calendar-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const written = days.filter((day) => day.hasNote).length;

  return (
    <section className="review-panel">
      <div className="section-heading">
        <History size={18} aria-hidden="true" />
        <div>
          <h2>Rueckblick</h2>
          <p>Dein Muster ueber die Zeit — Farben, Serien und alles Geschriebene.</p>
        </div>
      </div>

      <div className="review-stats">
        <article>
          <Flame size={16} aria-hidden="true" />
          <strong>{streak.current}</strong>
          <small>Tage in Folge</small>
        </article>
        <article>
          <strong>{streak.longest}</strong>
          <small>Laengste Serie</small>
        </article>
        <article>
          <strong>{streak.total}</strong>
          <small>Tage insgesamt</small>
        </article>
        <button type="button" className="review-export" onClick={downloadMarkdown}>
          <Download size={15} aria-hidden="true" />
          Als Markdown
        </button>
      </div>

      <div className="review-month">
        <header>
          <button type="button" onClick={() => shift(-1)} aria-label="Vorheriger Monat">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <h3>
            {monthName(month)} {year}
          </h3>
          <button type="button" onClick={() => shift(1)} aria-label="Naechster Monat">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span className="review-month__count">{written}/{days.length} beschrieben</span>
        </header>

        <ol className="color-strip">
          {days.map((day) => (
            <li key={day.iso}>
              <button
                type="button"
                className={`color-cell${day.hasNote ? " has-note" : ""}${day.iso === selectedIso ? " is-selected" : ""}`}
                style={{ "--cell": day.colorHex } as CSSProperties}
                onClick={() => onSelectDay(day.iso)}
                aria-label={
                  `${day.day}. ${monthName(month)}: ${day.colorName}` +
                  (day.hasNote ? ", mit Notiz" : ", ohne Notiz") +
                  (day.mood ? `, Stimmung ${day.mood.label}` : "") +
                  (day.hoursLogged > 0 ? `, ${day.hoursLogged} Stunden protokolliert` : "")
                }
              >
                <span className="color-cell__day" aria-hidden="true">{day.day}</span>
                {day.mood && <span className="color-cell__mood" aria-hidden="true">{day.mood.emoji}</span>}
              </button>
            </li>
          ))}
        </ol>
        <p className="review-legend">
          Jeder Tag traegt seine Farbe nach derselben Formel wie im Tagesorakel. Ein heller Rand
          heisst: an diesem Tag steht etwas geschrieben.
        </p>
      </div>

      <div className="review-search">
        <label className="review-search__field">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="In allen Notizen und Stunden suchen…"
            type="search"
            aria-label="Volltextsuche"
          />
        </label>

        {deferredQuery.trim().length >= 2 && (
          <p className="review-search__count" aria-live="polite">
            {hits.length === 0 ? "Nichts gefunden." : `${hits.length} Treffer`}
          </p>
        )}

        <ol className="review-hits">
          {hits.map((hit, index) => (
            <li key={`${hit.iso}:${hit.source}:${hit.label}:${index}`}>
              <button type="button" onClick={() => onSelectDay(hit.iso)}>
                <span className="review-hit__meta">
                  <strong>{hit.iso}</strong>
                  <small>{hit.source === "hour" ? hit.label : hit.source === "note" ? "Notiz" : hit.label}</small>
                </span>
                <span className="review-hit__text">{hit.excerpt}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
