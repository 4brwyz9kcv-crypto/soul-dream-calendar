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
  const imageSrc = reduceMotion ? asset.posterSrc : asset.mobileSrc;

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
        <img src={imageSrc} alt={`${asset.name} animierter PCB Engel`} loading="lazy" />
      </div>

      <div className="speech-bubble" aria-live="polite">
        <div className="speech-meta">
          <span>{asset.name}</span>
          <span>{sourceLabel}</span>
        </div>
        <p>{muted ? "Der Engel ist stummgeschaltet. Das Signal bleibt sichtbar." : line?.text}</p>
      </div>

      <div className="angel-controls" aria-label="Engel Steuerung">
        <button type="button" onClick={() => onMutedChange(!muted)} title={muted ? "Engel aktivieren" : "Engel stummschalten"}>
          {muted ? <BellOff size={16} /> : <Volume2 size={16} />}
        </button>
        <button type="button" onClick={() => setLineIndex((current) => current + 1)} title="Naechste Engelsbotschaft">
          <span aria-hidden="true">↻</span>
        </button>
        <button type="button" onClick={() => onPinnedChange(!pinned)} title={pinned ? "Engel loesen" : "Engel anheften"}>
          {pinned ? <Pin size={16} /> : <PinOff size={16} />}
        </button>
      </div>
    </aside>
  );
}
