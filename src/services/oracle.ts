import type { DailyColor, DayOracle, PokemonOfDay } from "../types";
import { dayColors } from "../data/colors";
import { bibleVerses } from "../data/verses";
import { buildTravelComparisons, getAstroSnapshot } from "./astro";
import { monthName, pickBySeed, stableSeed, toDayKey } from "./dates";
import { fakeVerse } from "./markov";
import { analyzeNumerology } from "./numerology";

/**
 * The daily oracle engine. Backs every card of the day view with the ported
 * legacy algorithms: the xkcd color formula, the King James verse formula, the
 * Markov fake verse, the earth-sun distance travel facts, the full numerology
 * reading and the PokeAPI seed formula.
 */

export { rides } from "./astro";

/**
 * Fallback Pokemon until the live PokeAPI fetch (separate subassignment)
 * lands; the real id for the day is exposed as DayOracle.pokemonSeed.
 */
export const fallbackPokemon: PokemonOfDay[] = [
  { id: 25, name: "Pikachu", type: "electric", glyph: "⚡" },
  { id: 133, name: "Evoli", type: "normal", glyph: "✦" },
  { id: 94, name: "Gengar", type: "ghost / poison", glyph: "☽" },
  { id: 150, name: "Mewtu", type: "psychic", glyph: "◌" },
  { id: 197, name: "Nachtara", type: "dark", glyph: "●" },
  { id: 282, name: "Guardevoir", type: "psychic / fairy", glyph: "◇" },
  { id: 479, name: "Rotom", type: "electric / ghost", glyph: "⌁" },
  { id: 778, name: "Mimigma", type: "ghost / fairy", glyph: "△" }
];

/**
 * Fallback facts until the live Wikipedia extraction (separate subassignment)
 * lands.
 */
export const fallbackFacts = [
  "Heute ist ein guter Tag, um ein altes Muster als Schaltplan zu betrachten.",
  "Wikipedia wuerde sagen: An jedem Datum stapeln sich Geschichte, Zufall und Wiederholung.",
  "Kalender sind Zeitmaschinen mit schlechter Benutzeroberflaeche.",
  "Die Erde sendet jeden Tag ein anderes kleines Rauschen ins Archiv."
];

/**
 * Fallback fake news until the live generator (separate subassignment) lands.
 */
export const fallbackFakeNews = [
  "Baeume kommunizieren heimlich mit WLAN-Studien beweisen es irgendwo.",
  "Der Mond hat heute eine Support-Anfrage an die Sonne geschlossen.",
  "Forscher entdecken: Notizen werden mutiger, wenn ein PCB-Engel zusieht.",
  "Ein verschollener Kalender behauptet, Mittwoch sei nur ein Firmware-Update."
];

const angelIds = ["seraph", "winged", "terminal", "spiral"];

/**
 * Legacy color-of-the-day formula (calendar_day.py):
 * index = (day^3 + month^2 + year) % len(colors), over the full xkcd list.
 */
export function colorOfTheDay(day: number, month: number, year: number): DailyColor {
  const index = (day ** 3 + month ** 2 + year) % dayColors.length;
  return dayColors[index];
}

/**
 * Legacy bible-verse formula (bible.py):
 * verse_id = abs(int(((day^7 + month*12 + year*40) * 1.111) / 666)) % len(verses).
 * Python's int() truncates toward zero, hence Math.trunc.
 */
export function bibleVerseIndex(day: number, month: number, year: number): number {
  return Math.abs(Math.trunc(((day ** 7 + month * 12 + year * 40) * 1.111) / 666)) % bibleVerses.length;
}

/**
 * Legacy PokeAPI id formula (pokemon.py):
 * int(2.58496*day^2 + month^2.92193 + (year*sin(year))*month^2/day) % 901.
 * Python's int() truncates toward zero and % is always non-negative, both
 * reproduced here; +1 keeps the id a valid PokeAPI id (the legacy could
 * produce 0, which the API rejects). The day division is guarded.
 */
export function pokemonSeedFor(day: number, month: number, year: number): number {
  const safeDay = day > 0 ? day : 1;
  const raw = 2.58496 * safeDay ** 2 + month ** 2.92193 + (year * Math.sin(year)) * month ** 2 / safeDay;
  return ((Math.trunc(raw) % 901) + 901) % 901 + 1;
}

/**
 * Personal seed derived from name + birth date (+ optional birth time and
 * birth place): the offset that makes every person's day unique. Returns 0
 * when everything is empty/unset, so fresh users get exactly the legacy
 * oracle.
 *
 * SEED STABILITY GUARANTEE: birthTime/birthPlaceName segments are appended
 * ONLY when set, so users who have configured just name/birthDate keep the
 * exact seed (and therefore the exact oracle picks) of every previous build.
 * Covered by a regression test in personal.test.ts.
 */
export function personalSeed(
  name: string,
  birthDate?: string,
  birthTime?: string,
  birthPlaceName?: string
): number {
  const normalized = name.trim().toLowerCase();
  const birth = birthDate ?? "";
  const time = (birthTime ?? "").trim();
  const place = (birthPlaceName ?? "").trim().toLowerCase();
  if (normalized.length === 0 && birth.length === 0 && time.length === 0 && place.length === 0) {
    return 0;
  }
  let key = `${normalized}|${birth}`;
  if (time.length > 0) key += `|${time}`;
  if (place.length > 0) key += `|${place}`;
  return stableSeed(key);
}

/**
 * Daily oracle for one person. The pure legacy formulas (colorOfTheDay,
 * bibleVerseIndex, pokemonSeedFor) stay untouched — the personal seed is
 * mixed into every pick strictly as an OFFSET on top of them, so an empty
 * name without birth date (pSeed 0) reproduces the legacy values exactly.
 * birthTime/birthPlaceName only shift the seed when they are actually set
 * (see personalSeed), keeping every existing user's oracle stable.
 */
export function getDayOracle(
  date: Date,
  userName: string,
  birthDate?: string,
  birthTime?: string,
  birthPlaceName?: string
): DayOracle {
  const key = toDayKey(date);
  const pSeed = personalSeed(userName, birthDate, birthTime, birthPlaceName);
  const seed = stableSeed(`${key.iso}:${userName || "anonymous"}`);
  const colorIndex =
    (((key.day ** 3 + key.month ** 2 + key.year) % dayColors.length) + pSeed) % dayColors.length;
  const color = dayColors[colorIndex];
  const verseIndex = (bibleVerseIndex(key.day, key.month, key.year) + pSeed) % bibleVerses.length;
  const pokemonSeed = ((pokemonSeedFor(key.day, key.month, key.year) - 1 + pSeed) % 901 + 901) % 901 + 1;
  const selectedPokemon = pickBySeed(fallbackPokemon, seed + key.day + pSeed);
  const digits = `${key.day}${key.month}${key.year}`.split("").map(Number);
  const digitSum = digits.reduce((sum, value) => sum + value, 0);
  // The triad stays date-based: it feeds the legacy digit-sum identity.
  const triad = [digitSum % 9 || 9, (digitSum + key.month) % 9 || 9, (digitSum + key.day) % 9 || 9];
  const astro = getAstroSnapshot(key);

  return {
    key,
    title: `${key.day}. ${monthName(key.month)} ${key.year}`,
    subtitle: `Dein taegliches Seelenritual fuer ${userName || "dich"}`,
    color,
    pokemon: selectedPokemon,
    bibleVerse: bibleVerses[verseIndex],
    fakeBibleVerse: fakeVerse(stableSeed(`fake-verse:${key.iso}`) + pSeed),
    numberSignal: `${triad.join("  ")} · Schwingung: ${pickBySeed(["Harmonie", "Mut", "Vertrauen", "Loslassen"], seed + pSeed)}`,
    wikipediaFact: pickBySeed(fallbackFacts, seed + key.month + pSeed),
    fakeNews: pickBySeed(fallbackFakeNews, seed + key.day + pSeed),
    travel: buildTravelComparisons(astro.sunDistanceKm, astro.moonDistanceKm),
    angelAssetId: pickBySeed(angelIds, seed + 99 + pSeed),
    numerology: analyzeNumerology(userName, { year: key.year, month: key.month, day: key.day }),
    astro,
    pokemonSeed,
    // imageSeed shifts with both name and birth date (via pSeed) while staying
    // byte-identical to the previous builds for anonymous users. live.ts picks
    // the wiki event and Markov fake news from this seed, so personalization
    // flows through the live layer automatically.
    imageSeed: stableSeed(`image:${key.iso}:${userName || "anonymous"}`) + pSeed
  };
}
