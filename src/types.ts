export type ProviderMode = "local" | "openai";

export type AppView = "calendar" | "oracle" | "journal" | "review" | "settings";

export type AngelMood = "oracle" | "coach" | "glitch";

export type SpeechSource =
  | "date"
  | "color"
  | "pokemon"
  | "verse"
  | "travel"
  | "mood"
  | "journal"
  | "openai";

export interface AngelAsset {
  id: string;
  name: string;
  fullSrc: string;
  mobileSrc: string;
  posterSrc: string;
  mood: AngelMood;
}

export interface AngelSpeechLine {
  id: string;
  text: string;
  source: SpeechSource;
  mood: AngelMood;
}

export interface DayKey {
  iso: string;
  year: number;
  month: number;
  day: number;
}

export interface DailyColor {
  name: string;
  hex: string;
}

export interface PokemonOfDay {
  id: number;
  name: string;
  type: string;
  glyph: string;
}

export interface TravelRide {
  id: string;
  label: string;
  speedKmh: number;
  glyph: string;
}

export interface TravelComparison {
  ride: TravelRide;
  sunLabel: string;
  moonLabel: string;
}

export type NumerologyCategoryKey =
  | "destiny"
  | "personality"
  | "attitude"
  | "character"
  | "soul"
  | "agenda"
  | "purpose";

export interface NumerologyCategory {
  key: NumerologyCategoryKey;
  title: string;
  number: number;
  isMaster: boolean;
  meaning: string;
  description: string;
}

export interface NumerologyReading {
  destiny: NumerologyCategory;
  personality: NumerologyCategory;
  attitude: NumerologyCategory;
  character: NumerologyCategory | null;
  soul: NumerologyCategory | null;
  agenda: NumerologyCategory | null;
  purpose: NumerologyCategory | null;
}

export interface AstroSnapshot {
  dayOfYear: number;
  sunDistanceAu: number;
  sunDistanceKm: number;
  moonDistanceKm: number;
}

export interface DayOracle {
  key: DayKey;
  title: string;
  subtitle: string;
  color: DailyColor;
  pokemon: PokemonOfDay;
  bibleVerse: string;
  fakeBibleVerse: string;
  numberSignal: string;
  wikipediaFact: string;
  fakeNews: string;
  travel: TravelComparison[];
  angelAssetId: string;
  numerology: NumerologyReading;
  astro: AstroSnapshot;
  pokemonSeed: number;
  imageSeed: number;
}

/** Whether a value came from a live web API or the local deterministic fallback. */
export type LiveStatus = "live" | "offline";

/** Pokemon of the day, unified over PokeAPI live data and the local fallback. */
export interface LivePokemon {
  status: LiveStatus;
  id: number;
  name: string;
  types: string[];
  /** PokeAPI height in decimetres; null when only fallback data is available. */
  heightDm: number | null;
  spriteUrl: string | null;
  shinySpriteUrl: string | null;
  glyph: string;
}

/** Wikipedia "an diesem Tag" fact plus the Markov fake news trained on it. */
export interface LiveWikiFact {
  status: LiveStatus;
  fact: string;
  fakeNews: string;
}

/** Numbers-API style fun fact about the digit sum of the date. */
export interface LiveNumberFact {
  status: LiveStatus;
  number: number;
  text: string;
}

/** Aggregated async day data; every field degrades gracefully to offline. */
export interface LiveDayData {
  pokemon: LivePokemon;
  wiki: LiveWikiFact;
  numberFact: LiveNumberFact;
}

/**
 * Hourly Universal-Logger entries for one day (the legacy "0 Stunde" …
 * "23 Stunde" fields): hour (0-23) -> logged text. Sparse — only filled
 * hours are stored.
 */
export type HourLog = Record<number, string>;

export interface MoodEntry {
  dayKey: string;
  emoji: string;
  label: string;
  score: number;
  updatedAt: string;
}

export interface JournalEntry {
  dayKey: string;
  note: string;
  promptResponses: Record<string, string>;
  updatedAt: string;
}

/**
 * Resolved birth place: display name plus the coordinates and IANA timezone
 * needed for the real Aszendent/Mondzeichen astronomy. Picked from the
 * Open-Meteo geocoding suggestions or the built-in offline city list.
 */
export interface BirthPlace {
  name: string;
  lat: number;
  lon: number;
  timezone: string;
}

export interface UserSettings {
  name: string;
  providerMode: ProviderMode;
  angelMuted: boolean;
  angelPinned: boolean;
  reduceMotion: boolean;
  selectedAngelId: string;
  /**
   * Whether the "Pokemon des Tages" block is shown. The sprites come from
   * PokeAPI and are Nintendo/Game Freak artwork — fine for a personal build,
   * not something a commercial release should ship by default. The switch
   * lets the same codebase serve both cases; everything else about the day
   * (the deterministic seed included) is unaffected.
   */
  showPokemon: boolean;
  /**
   * Set once the user has been through the welcome flow. Absent/false means a
   * fresh install, which opens onboarding instead of guessing a name.
   */
  onboarded: boolean;
  /**
   * Optional birth date as ISO "yyyy-mm-dd" (or absent/empty when unset).
   * Feeds the personal seed that makes every oracle unique per person and
   * drives the Horoskop tab. Absent by default so fresh installs behave
   * exactly like before.
   */
  birthDate?: string;
  /**
   * Optional birth time as "HH:MM". Unlocks the Mondzeichen (with birthDate)
   * and, together with birthPlace, the Aszendent plus the Impulszahl.
   * Absent by default; the personal seed only shifts when this is set.
   */
  birthTime?: string;
  /**
   * Optional resolved birth place. Unlocks the Aszendent (with birthTime),
   * sharpens the Mondzeichen via the historical timezone offset and feeds
   * the Ortszahl. Absent by default; the personal seed only shifts when set.
   */
  birthPlace?: BirthPlace;
}
