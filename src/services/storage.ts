import type { HourLog, JournalEntry, MoodEntry, UserSettings } from "../types";

const SETTINGS_KEY = "sdc.settings";
const JOURNAL_PREFIX = "sdc.journal.";
const MOOD_PREFIX = "sdc.mood.";
const HOURS_PREFIX = "sdc.hours.";
const OPENAI_KEY = "sdc.openai.key";

export const defaultSettings: UserSettings = {
  name: "Lukas",
  providerMode: "local",
  angelMuted: false,
  angelPinned: true,
  reduceMotion: false,
  selectedAngelId: "seraph"
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return { ...fallback, ...JSON.parse(value) };
  } catch {
    return fallback;
  }
}

export function loadSettings(): UserSettings {
  return safeParse<UserSettings>(localStorage.getItem(SETTINGS_KEY), defaultSettings);
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadJournalEntry(dayKey: string): JournalEntry {
  return safeParse<JournalEntry>(localStorage.getItem(JOURNAL_PREFIX + dayKey), {
    dayKey,
    note: "",
    promptResponses: {},
    updatedAt: new Date(0).toISOString()
  });
}

export function saveJournalEntry(entry: JournalEntry): void {
  localStorage.setItem(
    JOURNAL_PREFIX + entry.dayKey,
    JSON.stringify({ ...entry, updatedAt: new Date().toISOString() })
  );
}

export function loadMoodEntry(dayKey: string): MoodEntry | null {
  const value = localStorage.getItem(MOOD_PREFIX + dayKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as MoodEntry;
  } catch {
    return null;
  }
}

export function saveMoodEntry(entry: MoodEntry): void {
  localStorage.setItem(
    MOOD_PREFIX + entry.dayKey,
    JSON.stringify({ ...entry, updatedAt: new Date().toISOString() })
  );
}

/**
 * The OpenAI key lives ONLY in localStorage on this device (bring-your-own-key);
 * it is never bundled, never exported and never sent anywhere except api.openai.com.
 */
export function getOpenAiKey(): string | null {
  const value = localStorage.getItem(OPENAI_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function setOpenAiKey(key: string): void {
  localStorage.setItem(OPENAI_KEY, key.trim());
}

export function clearOpenAiKey(): void {
  localStorage.removeItem(OPENAI_KEY);
}

/**
 * ISO day keys (yyyy-mm-dd) of all journal entries with real content (a note
 * or at least one prompt response). One localStorage pass — callers should
 * invoke this once per render/mount, not per calendar cell.
 */
export function listJournalDayKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (!storageKey || !storageKey.startsWith(JOURNAL_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(storageKey) ?? "") as Partial<JournalEntry>;
      const hasNote = typeof entry.note === "string" && entry.note.trim().length > 0;
      const hasPrompts =
        !!entry.promptResponses &&
        Object.values(entry.promptResponses).some((value) => typeof value === "string" && value.trim().length > 0);
      if (hasNote || hasPrompts) keys.push(storageKey.slice(JOURNAL_PREFIX.length));
    } catch {
      // ignore unreadable entries
    }
  }
  return keys;
}

/**
 * Loads the hourly Universal-Logger record for one ISO day (yyyy-mm-dd) from
 * `sdc.hours.{iso}`. Unknown shapes and out-of-range hours are dropped, so a
 * corrupted row degrades to an empty log instead of throwing.
 */
export function loadHourLog(dayKey: string): HourLog {
  const raw = localStorage.getItem(HOURS_PREFIX + dayKey);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const hours: HourLog = {};
    for (const [key, value] of Object.entries(parsed)) {
      const hour = Number(key);
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && typeof value === "string" && value.length > 0) {
        hours[hour] = value;
      }
    }
    return hours;
  } catch {
    return {};
  }
}

/**
 * Persists the hourly Universal-Logger record under `sdc.hours.{iso}`.
 * Empty/whitespace-only hours are compacted away; a fully empty log removes
 * the key entirely so localStorage never accumulates blank days.
 */
export function saveHourLog(dayKey: string, hours: HourLog): void {
  const compact: HourLog = {};
  for (const [key, value] of Object.entries(hours)) {
    const hour = Number(key);
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && value.trim().length > 0) {
      compact[hour] = value;
    }
  }
  if (Object.keys(compact).length === 0) {
    localStorage.removeItem(HOURS_PREFIX + dayKey);
    return;
  }
  localStorage.setItem(HOURS_PREFIX + dayKey, JSON.stringify(compact));
}

interface ExportPayload {
  app: string;
  version: number;
  exportedAt: string;
  settings: UserSettings;
  journal: Record<string, JournalEntry>;
  moods: Record<string, MoodEntry>;
  hours?: Record<string, HourLog>;
}

/**
 * Serializes settings plus all journal and mood entries as JSON. The OpenAI
 * key is deliberately EXCLUDED — it never leaves this device.
 */
export function exportAllData(): string {
  const journal: Record<string, JournalEntry> = {};
  const moods: Record<string, MoodEntry> = {};
  const hours: Record<string, HourLog> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (!storageKey) continue;
    const raw = localStorage.getItem(storageKey);
    if (!raw) continue;
    try {
      if (storageKey.startsWith(JOURNAL_PREFIX)) {
        journal[storageKey.slice(JOURNAL_PREFIX.length)] = JSON.parse(raw) as JournalEntry;
      } else if (storageKey.startsWith(MOOD_PREFIX)) {
        moods[storageKey.slice(MOOD_PREFIX.length)] = JSON.parse(raw) as MoodEntry;
      } else if (storageKey.startsWith(HOURS_PREFIX)) {
        const dayKey = storageKey.slice(HOURS_PREFIX.length);
        const log = loadHourLog(dayKey);
        if (Object.keys(log).length > 0) hours[dayKey] = log;
      }
    } catch {
      // skip corrupted rows
    }
  }
  const payload: ExportPayload = {
    app: "soul-dream-calendar",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    journal,
    moods,
    hours
  };
  return JSON.stringify(payload, null, 2);
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Restores an export created by exportAllData. Validates the envelope and each
 * day key before writing anything; returns false (and writes nothing) on any
 * structural problem. Never touches the OpenAI key.
 */
export function importAllData(json: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (!isRecord(parsed) || parsed.app !== "soul-dream-calendar" || !isRecord(parsed.settings)) return false;
  const journal = isRecord(parsed.journal) ? parsed.journal : {};
  const moods = isRecord(parsed.moods) ? parsed.moods : {};
  const hours = isRecord(parsed.hours) ? parsed.hours : {};
  for (const dayKey of [...Object.keys(journal), ...Object.keys(moods), ...Object.keys(hours)]) {
    if (!DAY_KEY_PATTERN.test(dayKey)) return false;
  }

  saveSettings({ ...defaultSettings, ...(parsed.settings as Partial<UserSettings>) });
  for (const [dayKey, entry] of Object.entries(journal)) {
    if (!isRecord(entry)) continue;
    localStorage.setItem(JOURNAL_PREFIX + dayKey, JSON.stringify({ ...entry, dayKey }));
  }
  for (const [dayKey, entry] of Object.entries(moods)) {
    if (!isRecord(entry)) continue;
    localStorage.setItem(MOOD_PREFIX + dayKey, JSON.stringify({ ...entry, dayKey }));
  }
  for (const [dayKey, entry] of Object.entries(hours)) {
    if (!isRecord(entry)) continue;
    const log: HourLog = {};
    for (const [hourKey, text] of Object.entries(entry)) {
      const hour = Number(hourKey);
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && typeof text === "string") {
        log[hour] = text;
      }
    }
    saveHourLog(dayKey, log);
  }
  return true;
}
