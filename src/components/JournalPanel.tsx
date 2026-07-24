import { Heart, Save, Sparkle } from "lucide-react";
import type { JournalEntry, MoodEntry } from "../types";

const moods = [
  { emoji: "☹", label: "Sehr schlecht", score: 1 },
  { emoji: "🙁", label: "Schlecht", score: 2 },
  { emoji: "😐", label: "Neutral", score: 3 },
  { emoji: "🙂", label: "Gut", score: 4 },
  { emoji: "☺", label: "Grossartig", score: 5 }
];

const prompts = [
  { id: "sign", title: "Was war heute ein Zeichen?", hint: "Welche Momente fuehlten sich bedeutsam an?" },
  { id: "release", title: "Was moechtest du loslassen?", hint: "Was hat dir heute Energie genommen?" },
  { id: "gratitude", title: "Wofuer bist du dankbar?", hint: "Was hat dir heute Freude geschenkt?" }
];

interface JournalPanelProps {
  entry: JournalEntry;
  mood: MoodEntry | null;
  onEntryChange: (entry: JournalEntry) => void;
  onMoodChange: (mood: MoodEntry) => void;
}

export function JournalPanel({ entry, mood, onEntryChange, onMoodChange }: JournalPanelProps) {
  return (
    <section className="journal-panel">
      <div className="section-heading">
        <Heart size={18} />
        <div>
          <h2>Tages-Check-in</h2>
          <p>Wie war dein Tag?</p>
        </div>
      </div>

      <div className="mood-row" role="radiogroup" aria-label="Wie hast du dich gefuehlt?">
        {moods.map((item) => (
          <button
            type="button"
            key={item.label}
            className={mood?.score === item.score ? "is-selected" : ""}
            onClick={() => onMoodChange({ ...item, dayKey: entry.dayKey, updatedAt: new Date().toISOString() })}
            role="radio"
            aria-checked={mood?.score === item.score}
          >
            <span>{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="prompt-list">
        <h3><Sparkle size={16} /> Journal-Hilfe</h3>
        {prompts.map((prompt) => (
          <label key={prompt.id} className="prompt-card">
            <span>{prompt.title}</span>
            <small>{prompt.hint}</small>
            <input
              value={entry.promptResponses[prompt.id] ?? ""}
              onChange={(event) =>
                onEntryChange({
                  ...entry,
                  promptResponses: { ...entry.promptResponses, [prompt.id]: event.target.value }
                })
              }
              placeholder="Kurze Antwort..."
            />
          </label>
        ))}
      </div>

      <label className="note-card">
        <span>Notizen</span>
        <textarea
          value={entry.note}
          onChange={(event) => onEntryChange({ ...entry, note: event.target.value })}
          placeholder="Schreibe deine Gedanken..."
          maxLength={1000}
        />
        <small>{entry.note.length} / 1000</small>
      </label>

      <div className="save-hint">
        <Save size={16} />
        Lokal automatisch gespeichert
      </div>
    </section>
  );
}
