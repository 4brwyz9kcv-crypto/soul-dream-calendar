import { BellOff, Pin, PinOff, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AngelAsset, AngelSpeechLine } from "../types";

interface AngelCompanionProps {
  asset: AngelAsset;
  lines: AngelSpeechLine[];
  muted: boolean;
  pinned: boolean;
  reduceMotion: boolean;
  onMutedChange: (muted: boolean) => void;
  onPinnedChange: (pinned: boolean) => void;
}

export function AngelCompanion({
  asset,
  lines,
  muted,
  pinned,
  reduceMotion,
  onMutedChange,
  onPinnedChange
}: AngelCompanionProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const line = lines[lineIndex % Math.max(lines.length, 1)];

  // Das Poster (~80 KB) ist sofort da, die Animation (~1,6 MB) kommt erst,
  // wenn der Browser ohnehin Luft hat. Vorher blockierte die Animation den
  // Rest der Seite um Sekunden - im Mobilfunknetz um viele.
  const [animatedReady, setAnimatedReady] = useState(false);

  useEffect(() => {
    setAnimatedReady(false);
    // Bei reduzierter Bewegung wird die Animation gar nicht erst geholt:
    // sie wuerde nie gezeigt, waere also reines Datenvolumen.
    if (reduceMotion) return;

    let cancelled = false;
    const load = () => {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setAnimatedReady(true);
      };
      image.src = asset.animatedSrc;
    };

    // requestIdleCallback fehlt in Safari; dort tut ein kurzer Timer dasselbe.
    const idle = "requestIdleCallback" in window;
    const handle = idle
      ? window.requestIdleCallback(load, { timeout: 3000 })
      : window.setTimeout(load, 1200);

    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [asset.animatedSrc, reduceMotion]);

  const imageSrc = animatedReady ? asset.animatedSrc : asset.posterSrc;

  useEffect(() => {
    setLineIndex(0);
  }, [asset.id, lines]);

  const sourceLabel = useMemo(() => {
    if (!line) return "Signal";
    return {
      date: "Datum",
      color: "Farbe",
      pokemon: "Pokemon",
      verse: "Vers",
      travel: "Reise",
      mood: "Stimmung",
      journal: "Journal",
      openai: "OpenAI"
    }[line.source];
  }, [line]);

  return (
    <aside className={`angel-companion ${pinned ? "is-pinned" : ""}`} aria-label="PCB Engel Begleiter">
      <div className="angel-frame">
        <img
          src={imageSrc}
          alt={`${asset.name} — PCB-Engel`}
          width={384}
          height={384}
          // Nicht lazy: der Engel ist bei beiden Ansichten sofort im Bild, und
          // die 80 KB des Posters sind billiger als ein nachtraeglicher Umbruch.
          decoding="async"
        />
      </div>

      <div className="speech-bubble" aria-live="polite">
        <div className="speech-meta">
          <span>{asset.name}</span>
          <span>{sourceLabel}</span>
        </div>
        <p>{muted ? "Der Engel ist stummgeschaltet. Das Signal bleibt sichtbar." : line?.text}</p>
      </div>

      {/* title allein reicht nicht: Screenreader lesen es unzuverlaessig, und
          per Tastatur ist es gar nicht erreichbar. Deshalb ueberall aria-label. */}
      <div className="angel-controls" role="group" aria-label="Engel Steuerung">
        <button
          type="button"
          onClick={() => onMutedChange(!muted)}
          aria-pressed={muted}
          aria-label={muted ? "Engel aktivieren" : "Engel stummschalten"}
        >
          {muted ? <BellOff size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => setLineIndex((current) => current + 1)}
          aria-label="Naechste Engelsbotschaft"
        >
          <span aria-hidden="true">↻</span>
        </button>
        <button
          type="button"
          onClick={() => onPinnedChange(!pinned)}
          aria-pressed={pinned}
          aria-label={pinned ? "Engel loesen" : "Engel anheften"}
        >
          {pinned ? <Pin size={16} aria-hidden="true" /> : <PinOff size={16} aria-hidden="true" />}
        </button>
      </div>
    </aside>
  );
}
