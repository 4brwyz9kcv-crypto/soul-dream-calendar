import { describe, expect, it } from "vitest";
import {
  AU_KM,
  MOON_MEAN_KM,
  MOON_VARIATION_KM,
  buildTravelComparisons,
  dayOfYear,
  formatDuration,
  getAstroSnapshot,
  moonDistanceKm,
  rides,
  sunDistanceAu
} from "../services/astro";

describe("astro", () => {
  it("computes dayOfYear as clamped days-since-Jan-1 (legacy quantity), including leap years", () => {
    // Legacy quantity is max(1, (date - Jan1).days): Jan 1 AND Jan 2 both yield 1.
    expect(dayOfYear({ year: 2024, month: 1, day: 1 })).toBe(1);
    expect(dayOfYear({ year: 2024, month: 1, day: 2 })).toBe(1);
    expect(dayOfYear({ year: 2024, month: 1, day: 3 })).toBe(2);

    // Feb 29 2024 is the 60th ordinal day, but days-since-Jan-1 is 59 — the
    // implementation intentionally returns 59 (verified against the legacy port).
    expect(dayOfYear({ year: 2024, month: 2, day: 29 })).toBe(59);
    expect(dayOfYear({ year: 2024, month: 3, day: 1 })).toBe(60);
    expect(dayOfYear({ year: 2023, month: 3, day: 1 })).toBe(59);

    // Dec 31: 365 in a leap year, 364 in a common year (again days-since-Jan-1).
    expect(dayOfYear({ year: 2024, month: 12, day: 31 })).toBe(365);
    expect(dayOfYear({ year: 2023, month: 12, day: 31 })).toBe(364);
  });

  it("keeps the sun distance within the eccentricity band for every day of the year", () => {
    // Because of the verbatim radians quirk the perihelion date is wrong, but
    // cos() is still bounded, so the distance always stays inside the band.
    const min = 1 - 0.0167086;
    const max = 1 + 0.0167086;
    for (let day = 1; day <= 366; day += 1) {
      const au = sunDistanceAu(day);
      expect(au).toBeGreaterThanOrEqual(min);
      expect(au).toBeLessThanOrEqual(max);
      const km = au * AU_KM;
      expect(km).toBeGreaterThanOrEqual(min * AU_KM);
      expect(km).toBeLessThanOrEqual(max * AU_KM);
    }
  });

  it("returns a deterministic moon distance within the variation window", () => {
    const dates = [
      { year: 2025, month: 5, day: 24 },
      { year: 2024, month: 2, day: 29 },
      { year: 1999, month: 12, day: 31 },
      { year: 2026, month: 7, day: 2 }
    ];
    for (const date of dates) {
      const km = moonDistanceKm(date);
      expect(km).toBe(moonDistanceKm(date)); // deterministic per date
      expect(Number.isInteger(km)).toBe(true);
      expect(km).toBeGreaterThanOrEqual(MOON_MEAN_KM - MOON_VARIATION_KM);
      expect(km).toBeLessThanOrEqual(MOON_MEAN_KM + MOON_VARIATION_KM);
    }
  });

  it("formats durations with the hours/days/years thresholds", () => {
    expect(formatDuration(10)).toBe("~ 10.0 Stunden");
    expect(formatDuration(47.5)).toBe("~ 47.5 Stunden");
    expect(formatDuration(48)).toBe("~ 2.0 Tage"); // >= 48h switches to days
    expect(formatDuration(240)).toBe("~ 10.0 Tage");
    expect(formatDuration(24 * 364)).toBe("~ 364.0 Tage");
    expect(formatDuration(24 * 365.25)).toBe("~ 1.00 Jahre"); // >= 365 days switches to years
    expect(formatDuration(24 * 365.25 * 9.5)).toBe("~ 9.50 Jahre");
    // >= 10 years rounds and uses the de-DE thousands separator
    expect(formatDuration(24 * 365.25 * 10)).toBe(`~ ${(10).toLocaleString("de-DE")} Jahre`);
    expect(formatDuration(24 * 365.25 * 12345)).toBe(`~ ${(12345).toLocaleString("de-DE")} Jahre`);
  });

  it("builds the four travel comparisons with monotonic durations (spaceship fastest, bike slowest)", () => {
    const sunKm = 149_000_000;
    const moonKm = 384_400;
    const comparisons = buildTravelComparisons(sunKm, moonKm);

    expect(comparisons).toHaveLength(4);
    expect(comparisons.map((entry) => entry.ride.id)).toEqual(["lambo", "train", "bike", "ship"]);
    expect(comparisons.map((entry) => entry.ride)).toEqual(rides);

    // Labels are wired to formatDuration over the real distance/speed quotient.
    for (const entry of comparisons) {
      expect(entry.sunLabel).toBe(formatDuration(sunKm / entry.ride.speedKmh));
      expect(entry.moonLabel).toBe(formatDuration(moonKm / entry.ride.speedKmh));
    }

    // Faster ride -> strictly shorter travel time; ship fastest, bike slowest.
    const bySpeedDesc = [...comparisons].sort((a, b) => b.ride.speedKmh - a.ride.speedKmh);
    expect(bySpeedDesc[0].ride.id).toBe("ship");
    expect(bySpeedDesc[bySpeedDesc.length - 1].ride.id).toBe("bike");
    const durations = bySpeedDesc.map((entry) => sunKm / entry.ride.speedKmh);
    for (let i = 1; i < durations.length; i += 1) {
      expect(durations[i]).toBeGreaterThan(durations[i - 1]);
    }
  });

  it("composes a consistent astro snapshot", () => {
    const snapshot = getAstroSnapshot({ year: 2025, month: 5, day: 24 });
    expect(snapshot.dayOfYear).toBe(143);
    expect(snapshot.sunDistanceAu).toBe(sunDistanceAu(143));
    expect(snapshot.sunDistanceKm).toBeCloseTo(snapshot.sunDistanceAu * AU_KM, 6);
    expect(snapshot.moonDistanceKm).toBe(moonDistanceKm({ year: 2025, month: 5, day: 24 }));
  });
});
