import type { HourLog, JournalEntry, MoodEntry, Profile, UserSettings } from "../types";
import { allKeys, readKey, removeKey, writeKey } from "./safeStorage";

/**
 * Profile trennen mehrere Menschen auf einem Geraet.
 *
 * Das Standardprofil benutzt bewusst weiterhin die urspruenglichen
 * Schluesselnamen (`sdc.journal.2026-07-25`). Jede bestehende Installation
 * behaelt damit ihre Daten, ohne dass eine Migration laufen muesste; nur
 * zusaetzlich angelegte Profile bekommen ein Praefix (`sdc.p.{id}.journal.…`).
 */
export const DEFAULT_PROFILE_ID = "default";

const PROFILES_KEY = "sdc.profiles";
const ACTIVE_PROFILE_KEY = "sdc.profile.active";

const SETTINGS_SUFFIX = "settings";
const JOURNAL_SUFFIX = "journal.";
const MOOD_SUFFIX = "mood.";
const HOURS_SUFFIX = "hours.";

/** Der OpenAI-Schluessel gilt fuer das Geraet, nicht pro Profil. */
const OPENAI_KEY = "sdc.openai.key";

function scoped(suffix: string, profileId = getActiveProfileId()): string {
  return profileId === DEFAULT_PROFILE_ID ? `sdc.${suffix}` : `sdc.p.${profileId}.${suffix}`;
}

const SETTINGS_KEY = () => scoped(SETTINGS_SUFFIX);
const JOURNAL_PREFIX = () => scoped(JOURNAL_SUFFIX);
const MOOD_PREFIX = () => scoped(MOOD_SUFFIX);
const HOURS_PREFIX = () => scoped(HOURS_SUFFIX);

export const defaultProfile: Profile = {
  id: DEFAULT_PROFILE_ID,
  name: "Ich",
  createdAt: new Date(0).toISOString()
};

export function listProfiles(): Profile[] {
  const raw = readKey(PROFILES_KEY);
  if (!raw) return [defaultProfile];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [defaultProfile];
    const profiles = parsed.filter(
      (entry): entry is Profile =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Profile).id === "string" &&
        typeof (entry as Profile).name === "string"
    );
    // Das Standardprofil ist nicht loeschbar und muss immer dabei sein.
    return profiles.some((profile) => profile.id === DEFAULT_PROFILE_ID)
      ? profiles
      : [defaultProfile, ...profiles];
  } catch {
    return [defaultProfile];
  }
}

export function getActiveProfileId(): string {
  const stored = readKey(ACTIVE_PROFILE_KEY);
  if (!stored) return DEFAULT_PROFILE_ID;
  // Ein Profil, das nicht mehr existiert (geloescht, Import von woanders),
  // darf nicht in einen leeren Zustand fuehren.
  return listProfiles().some((profile) => profile.id === stored) ? stored : DEFAULT_PROFILE_ID;
}

export function setActiveProfileId(profileId: string): void {
  writeKey(ACTIVE_PROFILE_KEY, profileId);
}

/** Legt ein Profil an und liefert es zurueck. Der Name muss nicht eindeutig sein. */
export function createProfile(name: string): Profile {
  const profile: Profile = {
    // crypto.randomUUID gibt es in jedem Browser, der auch React 19 traegt.
    id: crypto.randomUUID().slice(0, 8),
    name: name.trim() || "Ohne Namen",
    createdAt: new Date().toISOString()
  };
  writeKey(PROFILES_KEY, JSON.stringify([...listProfiles(), profile]));
  return profile;
}

export function renameProfile(profileId: string, name: string): void {
  const profiles = listProfiles().map((profile) =>
    profile.id === profileId ? { ...profile, name: name.trim() || profile.name } : profile
  );
  writeKey(PROFILES_KEY, JSON.stringify(profiles));
}

/**
 * Loescht ein Profil samt aller zugehoerigen Eintraege. Das Standardprofil
 * bleibt bestehen - es ist der Ruecksprungpunkt, wenn das aktive weg ist.
 */
export function deleteProfile(profileId: string): boolean {
  if (profileId === DEFAULT_PROFILE_ID) return false;
  const remaining = listProfiles().filter((profile) => profile.id !== profileId);
  writeKey(PROFILES_KEY, JSON.stringify(remaining));

  const prefix = `sdc.p.${profileId}.`;
  for (const key of allKeys()) {
    if (key.startsWith(prefix)) removeKey(key);
  }
  if (getActiveProfileId() === profileId) setActiveProfileId(DEFAULT_PROFILE_ID);
  return true;
}

export const defaultSettings: UserSettings = {
  // Leer statt eines erfundenen Namens: der Onboarding-Dialog fragt beim
  // ersten Start danach, und bis dahin spricht die App neutral.
  name: "",
  providerMode: "local",
  angelMuted: false,
  angelPinned: true,
  reduceMotion: false,
  selectedAngelId: "seraph",
  showPokemon: true,
  onboarded: false
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
  return safeParse<UserSettings>(readKey(SETTINGS_KEY()), defaultSettings);
}

/**
 * `profileId` explizit angeben, wenn der Schreibvorgang zu einem Profil gehoert,
 * das inzwischen nicht mehr das aktive ist - etwa ein verzoegerter Schreibvorgang,
 * der einen Profilwechsel ueberlebt hat.
 */
export function saveSettings(settings: UserSettings, profileId?: string): void {
  writeKey(scoped(SETTINGS_SUFFIX, profileId ?? getActiveProfileId()), JSON.stringify(settings));
}

export function loadJournalEntry(dayKey: string): JournalEntry {
  return safeParse<JournalEntry>(readKey(JOURNAL_PREFIX() + dayKey), {
    dayKey,
    note: "",
    promptResponses: {},
    updatedAt: new Date(0).toISOString()
  });
}

export function saveJournalEntry(entry: JournalEntry, profileId?: string): void {
  writeKey(
    scoped(JOURNAL_SUFFIX, profileId ?? getActiveProfileId()) + entry.dayKey,
    JSON.stringify({ ...entry, updatedAt: new Date().toISOString() })
  );
}

export function loadMoodEntry(dayKey: string): MoodEntry | null {
  const value = readKey(MOOD_PREFIX() + dayKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as MoodEntry;
  } catch {
    return null;
  }
}

export function saveMoodEntry(entry: MoodEntry, profileId?: string): void {
  writeKey(
    scoped(MOOD_SUFFIX, profileId ?? getActiveProfileId()) + entry.dayKey,
    JSON.stringify({ ...entry, updatedAt: new Date().toISOString() })
  );
}

/**
 * The OpenAI key lives ONLY in localStorage on this device (bring-your-own-key);
 * it is never bundled, never exported and never sent anywhere except api.openai.com.
 */
export function getOpenAiKey(): string | null {
  const value = readKey(OPENAI_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function setOpenAiKey(key: string): void {
  writeKey(OPENAI_KEY, key.trim());
}

export function clearOpenAiKey(): void {
  removeKey(OPENAI_KEY);
}

/**
 * ISO day keys (yyyy-mm-dd) of all journal entries with real content (a note
 * or at least one prompt response). One localStorage pass — callers should
 * invoke this once per render/mount, not per calendar cell.
 */
export function listJournalDayKeys(): string[] {
  const keys: string[] = [];
  // Einmal aufloesen statt pro Schluessel: das Praefix haengt am aktiven
  // Profil, dessen Ermittlung selbst wieder localStorage liest.
  const prefix = JOURNAL_PREFIX();
  for (const storageKey of allKeys()) {
    if (!storageKey.startsWith(prefix)) continue;
    try {
      const entry = JSON.parse(readKey(storageKey) ?? "") as Partial<JournalEntry>;
      const hasNote = typeof entry.note === "string" && entry.note.trim().length > 0;
      const hasPrompts =
        !!entry.promptResponses &&
        Object.values(entry.promptResponses).some((value) => typeof value === "string" && value.trim().length > 0);
      if (hasNote || hasPrompts) keys.push(storageKey.slice(prefix.length));
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
  const raw = readKey(HOURS_PREFIX() + dayKey);
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
export function saveHourLog(dayKey: string, hours: HourLog, profileId?: string): void {
  const compact: HourLog = {};
  for (const [key, value] of Object.entries(hours)) {
    const hour = Number(key);
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && value.trim().length > 0) {
      compact[hour] = value;
    }
  }
  const key = scoped(HOURS_SUFFIX, profileId ?? getActiveProfileId()) + dayKey;
  if (Object.keys(compact).length === 0) {
    removeKey(key);
    return;
  }
  writeKey(key, JSON.stringify(compact));
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
  // Praefixe einmal aufloesen - sie haengen am aktiven Profil.
  const journalPrefix = JOURNAL_PREFIX();
  const moodPrefix = MOOD_PREFIX();
  const hoursPrefix = HOURS_PREFIX();
  for (const storageKey of allKeys()) {
    const raw = readKey(storageKey);
    if (!raw) continue;
    try {
      if (storageKey.startsWith(journalPrefix)) {
        journal[storageKey.slice(journalPrefix.length)] = JSON.parse(raw) as JournalEntry;
      } else if (storageKey.startsWith(moodPrefix)) {
        moods[storageKey.slice(moodPrefix.length)] = JSON.parse(raw) as MoodEntry;
      } else if (storageKey.startsWith(hoursPrefix)) {
        const dayKey = storageKey.slice(hoursPrefix.length);
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
    writeKey(JOURNAL_PREFIX() + dayKey, JSON.stringify({ ...entry, dayKey }));
  }
  for (const [dayKey, entry] of Object.entries(moods)) {
    if (!isRecord(entry)) continue;
    writeKey(MOOD_PREFIX() + dayKey, JSON.stringify({ ...entry, dayKey }));
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
