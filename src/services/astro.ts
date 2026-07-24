import type { AstroSnapshot, TravelComparison, TravelRide } from "../types";
import { mulberry32 } from "./markov";

/**
 * Port of the legacy earth-sun distance approximation (main.py) plus the
 * travel-time comparisons (calendar_day.py). The moon distance is a modern
 * addition (the legacy app had none) feeding the existing travel UI.
 */

/** One astronomical unit in kilometres. */
export const AU_KM = 149_597_870.7;

/** Mean earth-moon distance in kilometres. */
export const MOON_MEAN_KM = 384_400;

/** Deterministic daily variation applied to the mean moon distance (+/- km). */
export const MOON_VARIATION_KM = 21_000;

export interface SimpleDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Days since Jan 1 of the same year, clamped to a minimum of 1 — the exact
 * legacy quantity: max(1, (selected_date - Jan1).days), i.e. Jan 1 and Jan 2
 * both yield 1.
 */
export function dayOfYear(date: SimpleDate): number {
  const millis = Date.UTC(date.year, date.month - 1, date.day) - Date.UTC(date.year, 0, 1);
  return Math.max(1, Math.round(millis / 86_400_000));
}

/**
 * Exact port of main.py: 1 - (0.0167086 * math.cos(0.9856 * (days - 4))).
 * Note: the legacy code feeds 0.9856*(days-4) straight into math.cos, i.e. it
 * treats the value as RADIANS (no degrees-to-radians conversion), and we
 * reproduce that byte-for-byte rather than "fixing" the astronomy.
 */
export function sunDistanceAu(daysThisYear: number): number {
  return 1 - 0.0167086 * Math.cos(0.9856 * (daysThisYear - 4));
}

/**
 * Deterministic moon distance for the date: mean 384,400 km plus a seeded
 * +/- 21,000 km daily variation (mulberry32 over a yyyymmdd seed).
 */
export function moonDistanceKm(date: SimpleDate): number {
  const seed = date.year * 10_000 + date.month * 100 + date.day;
  const roll = mulberry32(seed)();
  return Math.round(MOON_MEAN_KM + (roll * 2 - 1) * MOON_VARIATION_KM);
}

/**
 * Real distances for the given date, all deterministic.
 */
export function getAstroSnapshot(date: SimpleDate): AstroSnapshot {
  const days = dayOfYear(date);
  const au = sunDistanceAu(days);
  return {
    dayOfYear: days,
    sunDistanceAu: au,
    sunDistanceKm: au * AU_KM,
    moonDistanceKm: moonDistanceKm(date)
  };
}

/** The four rides of the apocalypse, as known from the legacy fun facts. */
export const rides: TravelRide[] = [
  { id: "lambo", label: "Lambo Gallardo", speedKmh: 325, glyph: "🏎" },
  { id: "train", label: "Zug", speedKmh: 230, glyph: "🚆" },
  { id: "bike", label: "Fahrrad", speedKmh: 22, glyph: "🚲" },
  { id: "ship", label: "Raumschiff", speedKmh: 28000, glyph: "🚀" }
];

export function formatDuration(hours: number): string {
  const days = hours / 24;
  const years = days / 365.25;
  if (hours < 48) return `~ ${hours.toFixed(1)} Stunden`;
  if (days < 365) return `~ ${days.toFixed(1)} Tage`;
  if (years < 10) return `~ ${years.toFixed(2)} Jahre`;
  return `~ ${Math.round(years).toLocaleString("de-DE")} Jahre`;
}

/**
 * Travel-time comparisons for all rides, computed from the REAL sun and moon
 * distances of the day.
 */
export function buildTravelComparisons(sunKm: number, moonKm: number): TravelComparison[] {
  return rides.map((ride) => ({
    ride,
    sunLabel: formatDuration(sunKm / ride.speedKmh),
    moonLabel: formatDuration(moonKm / ride.speedKmh)
  }));
}
