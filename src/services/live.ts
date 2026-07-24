import type {
  DayOracle,
  LiveDayData,
  LiveNumberFact,
  LivePokemon,
  LiveWikiFact
} from "../types";
import { buildChain, generate } from "./markov";

/**
 * Live data layer: PokeAPI, Wikipedia "an diesem Tag" and Numbers API.
 *
 * Every fetcher follows the same contract:
 *  - hard timeout via AbortSignal (~6s), no hanging spinners
 *  - localStorage caching (the legacy app cached the same data in SQLite)
 *  - graceful fallback to the deterministic local oracle data, tagged with a
 *    discriminated `status` so the UI can render a live/offline badge.
 *
 * Nothing in here ever throws to the caller — offline, CORS failures and
 * malformed payloads all resolve to the local fallback.
 */

const FETCH_TIMEOUT_MS = 6000;
const POKEMON_CACHE_PREFIX = "sdc.pokemon.";
const WIKI_CACHE_PREFIX = "sdc.wiki.";
const NUMBERS_CACHE_PREFIX = "sdc.numbers.";
const WIKI_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchJson<T>(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or storage unavailable — caching is best-effort only
  }
}

/* ------------------------------------------------------------------ */
/* a) Pokemon of the day (PokeAPI)                                     */
/* ------------------------------------------------------------------ */

interface PokeApiResponse {
  id: number;
  name: string;
  height: number;
  types: Array<{ type: { name: string } }>;
  sprites: { front_default: string | null; front_shiny: string | null };
}

interface CachedPokemon {
  id: number;
  name: string;
  types: string[];
  heightDm: number;
  spriteUrl: string | null;
  shinySpriteUrl: string | null;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

function livePokemonFromCache(cached: CachedPokemon): LivePokemon {
  return { status: "live", glyph: "◉", ...cached };
}

function fallbackPokemonOfDay(oracle: DayOracle): LivePokemon {
  return {
    status: "offline",
    id: oracle.pokemon.id,
    name: oracle.pokemon.name,
    types: oracle.pokemon.type.split("/").map((entry) => entry.trim()),
    heightDm: null,
    spriteUrl: null,
    shinySpriteUrl: null,
    glyph: oracle.pokemon.glyph
  };
}

/**
 * Pokemon of the day via the legacy pokemonSeed id (1-901). Cached per id
 * forever — the legacy app cached the same rows in SQLite.
 */
export async function fetchPokemonOfDay(oracle: DayOracle): Promise<LivePokemon> {
  const id = oracle.pokemonSeed;
  const cacheKey = POKEMON_CACHE_PREFIX + id;
  const cached = readCache<CachedPokemon>(cacheKey);
  if (cached && typeof cached.name === "string") {
    return livePokemonFromCache(cached);
  }

  try {
    const data = await fetchJson<PokeApiResponse>(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const entry: CachedPokemon = {
      id: data.id,
      name: capitalize(data.name),
      types: data.types.map((slot) => slot.type.name),
      heightDm: data.height,
      spriteUrl: data.sprites.front_default,
      shinySpriteUrl: data.sprites.front_shiny
    };
    writeCache(cacheKey, entry);
    return livePokemonFromCache(entry);
  } catch {
    return fallbackPokemonOfDay(oracle);
  }
}

/* ------------------------------------------------------------------ */
/* b) Wikipedia "an diesem Tag" + Markov fake news                     */
/* ------------------------------------------------------------------ */

interface WikiOnThisDayResponse {
  events: Array<{ year?: number; text?: string }>;
}

interface CachedWikiEvents {
  fetchedAt: number;
  events: Array<{ year: number; text: string }>;
}

function fallbackWikiFact(oracle: DayOracle): LiveWikiFact {
  return { status: "offline", fact: oracle.wikipediaFact, fakeNews: oracle.fakeNews };
}

function wikiFactFromEvents(events: CachedWikiEvents["events"], seed: number): LiveWikiFact | null {
  if (events.length === 0) return null;
  const picked = events[seed % events.length];
  const chain = buildChain(events.map((event) => event.text));
  const generated = generate(chain, seed, { maxWords: 28 });
  return {
    status: "live",
    fact: `${picked.year} – ${picked.text}`,
    fakeNews: generated.length > 0 ? generated : events[(seed + 1) % events.length].text
  };
}

/**
 * Real "an diesem Tag" event from the German Wikipedia feed, picked
 * deterministically by imageSeed, plus a Markov fake-news line trained on ALL
 * fetched event texts (the legacy app did exactly this with markovify).
 * Cached per MM-DD with a 7-day TTL.
 */
export async function fetchWikiOnThisDay(oracle: DayOracle): Promise<LiveWikiFact> {
  const mm = String(oracle.key.month).padStart(2, "0");
  const dd = String(oracle.key.day).padStart(2, "0");
  const cacheKey = `${WIKI_CACHE_PREFIX}${mm}-${dd}`;
  const seed = oracle.imageSeed;

  const cached = readCache<CachedWikiEvents>(cacheKey);
  if (cached && Array.isArray(cached.events) && Date.now() - cached.fetchedAt < WIKI_TTL_MS) {
    return wikiFactFromEvents(cached.events, seed) ?? fallbackWikiFact(oracle);
  }

  try {
    const data = await fetchJson<WikiOnThisDayResponse>(
      `https://de.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`
    );
    const events = (data.events ?? [])
      .filter((event) => typeof event.year === "number" && typeof event.text === "string" && event.text.length > 0)
      .map((event) => ({ year: event.year as number, text: event.text as string }));
    const fact = wikiFactFromEvents(events, seed);
    if (!fact) return fallbackWikiFact(oracle);
    writeCache(cacheKey, { fetchedAt: Date.now(), events } satisfies CachedWikiEvents);
    return fact;
  } catch {
    return fallbackWikiFact(oracle);
  }
}

/**
 * The cached "an diesem Tag" event corpus for the oracle's MM-DD, or null when
 * nothing has been fetched yet (offline day). Additive helper backing the
 * "Neue Facts" / "Neue Fake News" regenerate buttons — TTL is deliberately
 * ignored here: a stale corpus is still a perfectly good corpus to cycle.
 */
export function getCachedWikiEvents(oracle: DayOracle): Array<{ year: number; text: string }> | null {
  const mm = String(oracle.key.month).padStart(2, "0");
  const dd = String(oracle.key.day).padStart(2, "0");
  const cached = readCache<CachedWikiEvents>(`${WIKI_CACHE_PREFIX}${mm}-${dd}`);
  if (!cached || !Array.isArray(cached.events) || cached.events.length === 0) return null;
  return cached.events;
}

/**
 * A fresh deterministic Markov fake-news line over the cached wiki event
 * corpus: same chain as fetchWikiOnThisDay, but seeded with
 * imageSeed + nonce·7919 so every button press yields a new — yet fully
 * reproducible — sentence. Returns null when no corpus is cached.
 */
export function generateFakeNewsFromCache(oracle: DayOracle, nonce: number): string | null {
  const events = getCachedWikiEvents(oracle);
  if (!events) return null;
  const chain = buildChain(events.map((event) => event.text));
  const generated = generate(chain, oracle.imageSeed + nonce * 7919, { maxWords: 28 });
  return generated.length > 0 ? generated : events[(oracle.imageSeed + nonce) % events.length].text;
}

/* ------------------------------------------------------------------ */
/* c) Numbers API fun fact about the date digit sum                    */
/* ------------------------------------------------------------------ */

interface NumbersApiResponse {
  text?: string;
  found?: boolean;
}

/** Legacy numbersapi.py quantity: digit sum of the YYYYMMDD string. */
export function dateDigitSum(oracle: DayOracle): number {
  const digits = `${oracle.key.year}${String(oracle.key.month).padStart(2, "0")}${String(oracle.key.day).padStart(2, "0")}`;
  let sum = 0;
  for (const digit of digits) sum += digit.charCodeAt(0) - 48;
  return sum;
}

function isPrime(value: number): boolean {
  if (value < 2) return false;
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) return false;
  }
  return true;
}

/** Locally computed German fallback line about the digit sum. */
export function localNumberFact(n: number): string {
  const traits: string[] = [n % 2 === 0 ? "gerade" : "ungerade"];
  if (isPrime(n)) traits.push("eine Primzahl");
  const root = Math.sqrt(n);
  if (Number.isInteger(root)) traits.push(`das Quadrat von ${root}`);
  if (n % 9 === 0) traits.push("durch 9 teilbar");
  return `Die Quersumme des Datums ist ${n}: ${traits.join(", ")}.`;
}

/**
 * Numbers API math fact about the digit sum of YYYYMMDD (legacy
 * numbersapi.py). Cached per ISO day; falls back to a locally computed German
 * line when the API is unreachable (CORS/mixed content/offline).
 */
export async function fetchNumberFact(oracle: DayOracle): Promise<LiveNumberFact> {
  const n = dateDigitSum(oracle);
  const cacheKey = NUMBERS_CACHE_PREFIX + oracle.key.iso;

  const cached = readCache<LiveNumberFact>(cacheKey);
  if (cached && typeof cached.text === "string" && cached.status === "live") {
    return cached;
  }

  try {
    const data = await fetchJson<NumbersApiResponse>(`https://numbersapi.com/${n}/math?json`);
    if (typeof data.text !== "string" || data.text.length === 0) throw new Error("empty numbers fact");
    const fact: LiveNumberFact = { status: "live", number: n, text: data.text };
    writeCache(cacheKey, fact);
    return fact;
  } catch {
    return { status: "offline", number: n, text: localNumberFact(n) };
  }
}

/* ------------------------------------------------------------------ */
/* Aggregate                                                           */
/* ------------------------------------------------------------------ */

/**
 * Loads all three live sources in parallel. Individual failures degrade to
 * their offline fallback; this function itself never rejects.
 */
export async function loadLiveDayData(oracle: DayOracle): Promise<LiveDayData> {
  const [pokemon, wiki, numberFact] = await Promise.all([
    fetchPokemonOfDay(oracle),
    fetchWikiOnThisDay(oracle),
    fetchNumberFact(oracle)
  ]);
  return { pokemon, wiki, numberFact };
}
