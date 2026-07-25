import type { AllProfileData, HourLog, JournalEntry, MoodEntry } from "../types";
import { monthName, toDayKey } from "./dates";
import { colorOfTheDay } from "./oracle";

/**
 * Auswertung ueber alle gesammelten Tage: der Rueckblick.
 *
 * Bisher konnte man nur einen Tag nach dem anderen ansehen. Nach ein paar
 * Monaten Nutzung liegt der Wert aber im Muster - welche Tage beschrieben
 * wurden, wie die Stimmung lief, wo ein bestimmter Gedanke stand.
 *
 * Alles hier ist reine Berechnung auf uebergebenen Daten, kein Speicherzugriff.
 * Das macht die Funktionen testbar und haelt sie vom aktiven Profil unabhaengig.
 */

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DaySummary {
  iso: string;
  day: number;
  /** Farbe des Tages nach der Legacy-Formel - auch fuer leere Tage. */
  colorHex: string;
  colorName: string;
  hasNote: boolean;
  noteLength: number;
  hoursLogged: number;
  mood: MoodEntry | null;
}

/** True, wenn ein Journaleintrag echten Inhalt hat (Notiz oder Antwort). */
export function hasContent(entry: JournalEntry | undefined): boolean {
  if (!entry) return false;
  if (typeof entry.note === "string" && entry.note.trim().length > 0) return true;
  return Object.values(entry.promptResponses ?? {}).some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

/**
 * Ein Monat als Farbstreifen. Enthaelt jeden Tag des Monats, auch die leeren -
 * die Luecken sind schliesslich die halbe Aussage.
 */
export function monthSummary(year: number, month: number, data: AllProfileData): DaySummary[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const summaries: DaySummary[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const color = colorOfTheDay(day, month, year);
    const entry = data.journal[iso];
    const hours: HourLog = data.hours[iso] ?? {};
    summaries.push({
      iso,
      day,
      colorHex: color.hex,
      colorName: color.name,
      hasNote: hasContent(entry),
      noteLength: (entry?.note ?? "").trim().length,
      hoursLogged: Object.values(hours).filter((text) => text.trim().length > 0).length,
      mood: data.moods[iso] ?? null
    });
  }

  return summaries;
}

export interface StreakInfo {
  /** Ununterbrochene Tage mit Eintrag bis einschliesslich heute (oder gestern). */
  current: number;
  /** Laengste je erreichte Serie. */
  longest: number;
  /** Anzahl aller Tage mit Eintrag. */
  total: number;
}

/**
 * Serien ueber die Tage mit Inhalt.
 *
 * Die laufende Serie bricht bewusst erst ab, wenn auch *gestern* leer ist:
 * wer morgens die App oeffnet, hat fuer heute noch nichts geschrieben und
 * soll deshalb nicht seine Serie verlieren.
 */
export function streaks(dayKeys: string[], today = toDayKey(new Date()).iso): StreakInfo {
  const days = [...new Set(dayKeys.filter((key) => ISO_PATTERN.test(key)))].sort();
  if (days.length === 0) return { current: 0, longest: 0, total: 0 };

  const asNumber = (iso: string) => Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  );
  const DAY_MS = 86_400_000;

  let longest = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    const gap = (asNumber(days[index]) - asNumber(days[index - 1])) / DAY_MS;
    run = gap === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const todayMs = asNumber(today);
  const lastMs = asNumber(days[days.length - 1]);
  const sinceLast = (todayMs - lastMs) / DAY_MS;

  let current = 0;
  if (sinceLast === 0 || sinceLast === 1) {
    current = 1;
    for (let index = days.length - 1; index > 0; index -= 1) {
      const gap = (asNumber(days[index]) - asNumber(days[index - 1])) / DAY_MS;
      if (gap !== 1) break;
      current += 1;
    }
  }

  return { current, longest, total: days.length };
}

export interface SearchHit {
  iso: string;
  /** Woher der Treffer stammt - fuer die Kennzeichnung in der Liste. */
  source: "note" | "prompt" | "hour";
  /** Bei Stunden-Treffern die Stunde, bei Prompt-Treffern dessen Id. */
  label: string;
  /** Textausschnitt um den Treffer herum. */
  excerpt: string;
}

/** Schneidet einen Ausschnitt um die Fundstelle, damit lange Notizen die Liste nicht sprengen. */
function excerptAround(text: string, index: number, radius = 60): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Volltextsuche ueber Notizen, Journal-Antworten und den Stundenlogger.
 * Ohne Akzent- oder Stammformbehandlung - fuer eine lokale Notizsuche ist
 * "enthaelt, Gross-/Kleinschreibung egal" die ehrlichere Zusage.
 */
export function searchEntries(query: string, data: AllProfileData, limit = 80): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const hits: SearchHit[] = [];

  const push = (iso: string, source: SearchHit["source"], label: string, text: string) => {
    const index = text.toLowerCase().indexOf(needle);
    if (index === -1) return;
    hits.push({ iso, source, label, excerpt: excerptAround(text, index) });
  };

  for (const [iso, entry] of Object.entries(data.journal)) {
    push(iso, "note", "Notiz", entry.note ?? "");
    for (const [promptId, answer] of Object.entries(entry.promptResponses ?? {})) {
      push(iso, "prompt", promptId, answer ?? "");
    }
  }

  for (const [iso, log] of Object.entries(data.hours)) {
    for (const [hour, text] of Object.entries(log)) {
      push(iso, "hour", `${String(hour).padStart(2, "0")}:00`, text);
    }
  }

  // Neueste zuerst: der jüngste Gedanke ist meist der gesuchte.
  hits.sort((a, b) => (a.iso === b.iso ? a.label.localeCompare(b.label) : b.iso.localeCompare(a.iso)));
  return hits.slice(0, limit);
}

/**
 * Der gesamte Bestand als Markdown.
 *
 * Das JSON aus exportAllData ist zum Wiedereinlesen da, aber niemand liest es.
 * Markdown geht in Obsidian, Notion, jeden Editor und laesst sich ausdrucken -
 * fuer ein Tagebuch die naheliegendere Form, es aus der App herauszubekommen.
 */
export function toMarkdown(data: AllProfileData, profileName: string): string {
  const days = [...new Set([
    ...Object.keys(data.journal),
    ...Object.keys(data.moods),
    ...Object.keys(data.hours)
  ])]
    .filter((iso) => ISO_PATTERN.test(iso))
    .sort();

  const lines: string[] = [
    `# Soul Dream Calendar${profileName ? ` — ${profileName}` : ""}`,
    "",
    `Exportiert am ${new Date().toLocaleDateString("de-DE")} · ${days.length} Tage`,
    ""
  ];

  let lastMonth = "";
  for (const iso of days) {
    const [year, month, day] = iso.split("-").map(Number);
    const entry = data.journal[iso];
    const mood = data.moods[iso];
    const hours = data.hours[iso] ?? {};
    const filledHours = Object.entries(hours).filter(([, text]) => text.trim().length > 0);

    // Voellig leere Tage wuerden das Dokument nur strecken.
    if (!hasContent(entry) && !mood && filledHours.length === 0) continue;

    const monthKey = `${year}-${month}`;
    if (monthKey !== lastMonth) {
      lines.push(`## ${monthName(month)} ${year}`, "");
      lastMonth = monthKey;
    }

    const color = colorOfTheDay(day, month, year);
    lines.push(`### ${day}. ${monthName(month)} ${year}`, "");
    lines.push(`*Farbe des Tages: ${color.name} (${color.hex})*`, "");

    if (mood) lines.push(`**Stimmung:** ${mood.emoji} ${mood.label}`, "");

    if (entry?.note?.trim()) lines.push(entry.note.trim(), "");

    const answers = Object.entries(entry?.promptResponses ?? {}).filter(([, value]) =>
      value?.trim()
    );
    if (answers.length > 0) {
      for (const [promptId, value] of answers) lines.push(`- **${promptId}:** ${value.trim()}`);
      lines.push("");
    }

    if (filledHours.length > 0) {
      lines.push("**Universal Logger**", "");
      for (const [hour, text] of filledHours.sort((a, b) => Number(a[0]) - Number(b[0]))) {
        lines.push(`- \`${String(hour).padStart(2, "0")}:00\` ${text.trim()}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
