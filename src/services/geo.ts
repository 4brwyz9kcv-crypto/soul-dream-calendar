import type { LiveStatus } from "../types";

/**
 * Geburtsort geocoding: free, keyless, CORS-enabled Open-Meteo geocoding API
 * (https://geocoding-api.open-meteo.com) with a 6s hard timeout and a
 * built-in offline city list (D-A-CH thoroughly + world capitals) matched by
 * folded prefix. Follows the live.ts contract: never throws, every failure
 * degrades to the offline source, tagged with a LiveStatus for the LED.
 */

const GEO_TIMEOUT_MS = 6000;
const MAX_RESULTS = 5;

export interface GeoPlace {
  /** Short city name, e.g. "Wien" — stored as BirthPlace.name, feeds the Ortszahl. */
  name: string;
  /** Display label incl. region/country, e.g. "Wien, Wien, Österreich". */
  label: string;
  lat: number;
  lon: number;
  /** IANA timezone id, e.g. "Europe/Vienna". */
  timezone: string;
}

export interface GeoSearchResult {
  status: LiveStatus;
  places: GeoPlace[];
}

interface OpenMeteoGeoResponse {
  results?: Array<{
    name?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    country?: string;
    admin1?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/* Offline fallback: D-A-CH cities + world capitals                    */
/* ------------------------------------------------------------------ */

type CityRow = [name: string, region: string, lat: number, lon: number, timezone: string];

const berlinTz = "Europe/Berlin";
const viennaTz = "Europe/Vienna";
const zurichTz = "Europe/Zurich";

/** ~80 built-in cities: Deutschland/Österreich/Schweiz dicht + Welthauptstädte. */
const offlineCities: readonly CityRow[] = [
  // Deutschland
  ["Berlin", "Deutschland", 52.52, 13.405, berlinTz],
  ["Hamburg", "Deutschland", 53.551, 9.994, berlinTz],
  ["München", "Deutschland", 48.137, 11.575, berlinTz],
  ["Köln", "Deutschland", 50.937, 6.96, berlinTz],
  ["Frankfurt am Main", "Deutschland", 50.11, 8.682, berlinTz],
  ["Stuttgart", "Deutschland", 48.775, 9.183, berlinTz],
  ["Düsseldorf", "Deutschland", 51.228, 6.773, berlinTz],
  ["Leipzig", "Deutschland", 51.34, 12.375, berlinTz],
  ["Dortmund", "Deutschland", 51.514, 7.466, berlinTz],
  ["Essen", "Deutschland", 51.456, 7.012, berlinTz],
  ["Bremen", "Deutschland", 53.079, 8.801, berlinTz],
  ["Dresden", "Deutschland", 51.05, 13.738, berlinTz],
  ["Hannover", "Deutschland", 52.375, 9.732, berlinTz],
  ["Nürnberg", "Deutschland", 49.454, 11.077, berlinTz],
  ["Duisburg", "Deutschland", 51.435, 6.762, berlinTz],
  ["Bochum", "Deutschland", 51.482, 7.216, berlinTz],
  ["Wuppertal", "Deutschland", 51.264, 7.178, berlinTz],
  ["Bielefeld", "Deutschland", 52.03, 8.532, berlinTz],
  ["Bonn", "Deutschland", 50.734, 7.095, berlinTz],
  ["Münster", "Deutschland", 51.961, 7.626, berlinTz],
  ["Karlsruhe", "Deutschland", 49.007, 8.404, berlinTz],
  ["Mannheim", "Deutschland", 49.489, 8.467, berlinTz],
  ["Augsburg", "Deutschland", 48.371, 10.898, berlinTz],
  ["Wiesbaden", "Deutschland", 50.083, 8.24, berlinTz],
  ["Kiel", "Deutschland", 54.322, 10.136, berlinTz],
  ["Freiburg im Breisgau", "Deutschland", 47.999, 7.842, berlinTz],
  ["Rostock", "Deutschland", 54.089, 12.14, berlinTz],
  ["Mainz", "Deutschland", 49.999, 8.273, berlinTz],
  ["Erfurt", "Deutschland", 50.978, 11.029, berlinTz],
  ["Kassel", "Deutschland", 51.312, 9.479, berlinTz],
  ["Saarbrücken", "Deutschland", 49.235, 6.996, berlinTz],
  ["Magdeburg", "Deutschland", 52.127, 11.629, berlinTz],
  ["Ulm", "Deutschland", 48.401, 9.987, berlinTz],
  ["Regensburg", "Deutschland", 49.013, 12.101, berlinTz],
  // Österreich
  ["Wien", "Österreich", 48.208, 16.373, viennaTz],
  ["Graz", "Österreich", 47.071, 15.439, viennaTz],
  ["Linz", "Österreich", 48.306, 14.286, viennaTz],
  ["Salzburg", "Österreich", 47.81, 13.055, viennaTz],
  ["Innsbruck", "Österreich", 47.263, 11.394, viennaTz],
  ["Klagenfurt", "Österreich", 46.624, 14.305, viennaTz],
  ["Villach", "Österreich", 46.611, 13.856, viennaTz],
  ["St. Pölten", "Österreich", 48.204, 15.626, viennaTz],
  ["Bregenz", "Österreich", 47.503, 9.747, viennaTz],
  // Schweiz
  ["Zürich", "Schweiz", 47.377, 8.541, zurichTz],
  ["Bern", "Schweiz", 46.948, 7.447, zurichTz],
  ["Basel", "Schweiz", 47.559, 7.588, zurichTz],
  ["Genf", "Schweiz", 46.204, 6.143, zurichTz],
  ["Lausanne", "Schweiz", 46.52, 6.632, zurichTz],
  ["Winterthur", "Schweiz", 47.5, 8.724, zurichTz],
  ["Luzern", "Schweiz", 47.05, 8.306, zurichTz],
  ["St. Gallen", "Schweiz", 47.424, 9.377, zurichTz],
  ["Lugano", "Schweiz", 46.005, 8.951, zurichTz],
  // Welt (Hauptstädte + Metropolen)
  ["London", "Vereinigtes Königreich", 51.507, -0.128, "Europe/London"],
  ["Paris", "Frankreich", 48.857, 2.352, "Europe/Paris"],
  ["Rom", "Italien", 41.893, 12.483, "Europe/Rome"],
  ["Madrid", "Spanien", 40.417, -3.703, "Europe/Madrid"],
  ["Lissabon", "Portugal", 38.722, -9.139, "Europe/Lisbon"],
  ["Amsterdam", "Niederlande", 52.373, 4.891, "Europe/Amsterdam"],
  ["Brüssel", "Belgien", 50.847, 4.352, "Europe/Brussels"],
  ["Kopenhagen", "Dänemark", 55.676, 12.568, "Europe/Copenhagen"],
  ["Stockholm", "Schweden", 59.329, 18.069, "Europe/Stockholm"],
  ["Oslo", "Norwegen", 59.913, 10.752, "Europe/Oslo"],
  ["Helsinki", "Finnland", 60.17, 24.938, "Europe/Helsinki"],
  ["Warschau", "Polen", 52.23, 21.012, "Europe/Warsaw"],
  ["Prag", "Tschechien", 50.075, 14.438, "Europe/Prague"],
  ["Budapest", "Ungarn", 47.498, 19.04, "Europe/Budapest"],
  ["Athen", "Griechenland", 37.984, 23.728, "Europe/Athens"],
  ["Dublin", "Irland", 53.349, -6.26, "Europe/Dublin"],
  ["Moskau", "Russland", 55.756, 37.617, "Europe/Moscow"],
  ["Istanbul", "Türkei", 41.008, 28.978, "Europe/Istanbul"],
  ["Washington", "USA", 38.907, -77.037, "America/New_York"],
  ["New York", "USA", 40.713, -74.006, "America/New_York"],
  ["Los Angeles", "USA", 34.052, -118.244, "America/Los_Angeles"],
  ["Mexiko-Stadt", "Mexiko", 19.433, -99.133, "America/Mexico_City"],
  ["Ottawa", "Kanada", 45.421, -75.697, "America/Toronto"],
  ["Rio de Janeiro", "Brasilien", -22.907, -43.173, "America/Sao_Paulo"],
  ["Buenos Aires", "Argentinien", -34.604, -58.382, "America/Argentina/Buenos_Aires"],
  ["Kairo", "Ägypten", 30.044, 31.236, "Africa/Cairo"],
  ["Kapstadt", "Südafrika", -33.925, 18.424, "Africa/Johannesburg"],
  ["Lagos", "Nigeria", 6.524, 3.379, "Africa/Lagos"],
  ["Nairobi", "Kenia", -1.292, 36.822, "Africa/Nairobi"],
  ["Dubai", "VAE", 25.204, 55.271, "Asia/Dubai"],
  ["Neu-Delhi", "Indien", 28.614, 77.209, "Asia/Kolkata"],
  ["Bangkok", "Thailand", 13.756, 100.502, "Asia/Bangkok"],
  ["Singapur", "Singapur", 1.352, 103.82, "Asia/Singapore"],
  ["Hongkong", "China", 22.319, 114.169, "Asia/Hong_Kong"],
  ["Peking", "China", 39.904, 116.407, "Asia/Shanghai"],
  ["Seoul", "Südkorea", 37.566, 126.978, "Asia/Seoul"],
  ["Tokio", "Japan", 35.677, 139.65, "Asia/Tokyo"],
  ["Sydney", "Australien", -33.869, 151.209, "Australia/Sydney"],
  ["Auckland", "Neuseeland", -36.849, 174.764, "Pacific/Auckland"]
];

/** The built-in offline places, exposed for tests and completeness. */
export const offlinePlaces: readonly GeoPlace[] = offlineCities.map(
  ([name, region, lat, lon, timezone]) => ({
    name,
    label: `${name}, ${region}`,
    lat,
    lon,
    timezone
  })
);

/**
 * Search-folding: lowercase, ß→ss, umlauts/diacritics reduced to their base
 * letter, "ae/oe/ue" digraphs collapsed — so "Zür", "Zuer" and "Zur" all
 * find Zürich and "Muen"/"Mün"/"Mun" all find München.
 */
function foldQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u");
}

/** Prefix match over the built-in city list (max 5, folded comparison). */
export function offlinePlaceSearch(query: string): GeoPlace[] {
  const folded = foldQuery(query.trim());
  if (folded.length === 0) return [];
  return offlinePlaces
    .filter((place) => foldQuery(place.name).startsWith(folded))
    .slice(0, MAX_RESULTS);
}

async function fetchJson<T>(url: string, timeoutMs = GEO_TIMEOUT_MS): Promise<T> {
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

/**
 * Place suggestions for a settings query: live Open-Meteo geocoding first
 * (German labels, includes the IANA timezone we need for the Aszendent
 * math), offline prefix match over the built-in list on any failure or when
 * the API knows nothing. Never throws.
 */
export async function searchPlaces(query: string): Promise<GeoSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { status: "offline", places: [] };

  try {
    const data = await fetchJson<OpenMeteoGeoResponse>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=${MAX_RESULTS}&language=de&format=json`
    );
    const places: GeoPlace[] = (data.results ?? [])
      .filter(
        (row) =>
          typeof row.name === "string" &&
          row.name.length > 0 &&
          typeof row.latitude === "number" &&
          Number.isFinite(row.latitude) &&
          typeof row.longitude === "number" &&
          Number.isFinite(row.longitude) &&
          typeof row.timezone === "string" &&
          row.timezone.length > 0
      )
      .slice(0, MAX_RESULTS)
      .map((row) => ({
        name: row.name as string,
        label: [row.name, row.admin1, row.country]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(", "),
        lat: row.latitude as number,
        lon: row.longitude as number,
        timezone: row.timezone as string
      }));
    if (places.length > 0) return { status: "live", places };
    const local = offlinePlaceSearch(trimmed);
    return { status: local.length > 0 ? "offline" : "live", places: local };
  } catch {
    return { status: "offline", places: offlinePlaceSearch(trimmed) };
  }
}
