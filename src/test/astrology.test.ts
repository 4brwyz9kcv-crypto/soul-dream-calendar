// Real-astronomy suite: Julian Date, GMST, timezone conversion (incl. DST
// and the round(lon/15) fallback), ascendant and low-precision lunar
// longitude. Every expected value below is cross-checked against published
// references, cited inline:
//  - Meeus, "Astronomical Algorithms": example 12.a (GMST) and example 47.a
//    (lunar longitude 1992-04-12 0h TD = 133.162655°).
//  - astro-databank (Rodden AA birth data): Albert Einstein (Asc Krebs,
//    Mond Schütze), Kurt Cobain (Asc Jungfrau, Mond Krebs) and
//    Elizabeth II (Asc ~21° Steinbock, Mond Löwe).
//  - Eclipse geometry: at a total LUNAR eclipse the moon is exactly opposite
//    the sun, at a total SOLAR eclipse exactly conjunct.
import { describe, expect, it } from "vitest";
import {
  ascendantFromRamc,
  ascendantLongitude,
  bigThree,
  birthInstantUtc,
  gmstDegrees,
  julianDate,
  longitudeFallbackOffsetMinutes,
  moonLongitude,
  normalizeDegrees,
  obliquityDegrees,
  utcOffsetMinutes
} from "../services/astrology";

const WIEN = { name: "Wien", lat: 48.208, lon: 16.373, timezone: "Europe/Vienna" };

describe("julianDate + gmst + obliquity", () => {
  it("JD of the J2000.0 epoch (2000-01-01 12:00 UTC) is exactly 2451545.0", () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12))).toBe(2451545.0);
  });

  it("JD of 1987-04-10 00:00 UTC is 2446895.5 (Meeus example 12.a)", () => {
    expect(julianDate(Date.UTC(1987, 3, 10))).toBe(2446895.5);
  });

  it("GMST matches Meeus example 12.a: 197.693195° at JD 2446895.5", () => {
    expect(gmstDegrees(2446895.5)).toBeCloseTo(197.693195, 4);
  });

  it("GMST at J2000.0 is the polynomial constant 280.46061837°", () => {
    expect(gmstDegrees(2451545.0)).toBeCloseTo(280.46061837, 6);
  });

  it("obliquity at J2000.0 is 23.4392911°", () => {
    expect(obliquityDegrees(2451545.0)).toBeCloseTo(23.4392911, 7);
  });

  it("normalizeDegrees folds into [0, 360)", () => {
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(720.5)).toBeCloseTo(0.5, 10);
    expect(normalizeDegrees(359.9)).toBeCloseTo(359.9, 10);
  });
});

describe("utcOffsetMinutes + birthInstantUtc", () => {
  it("resolves Berlin summer (+120) vs. winter (+60) — the DST case", () => {
    expect(utcOffsetMinutes("Europe/Berlin", Date.UTC(2023, 6, 1, 10))).toBe(120);
    expect(utcOffsetMinutes("Europe/Berlin", Date.UTC(2023, 0, 1, 10))).toBe(60);
  });

  it("resolves historical LMT offsets (Europe/Berlin 1879 = +0:53:28)", () => {
    const offset = utcOffsetMinutes("Europe/Berlin", Date.UTC(1879, 2, 14, 10, 50));
    expect(offset).not.toBeNull();
    expect(offset!).toBeCloseTo(53 + 28 / 60, 2);
  });

  it("returns null for unknown timezone ids", () => {
    expect(utcOffsetMinutes("Mordor/Barad-dur", Date.UTC(2023, 0, 1))).toBeNull();
  });

  it("converts local birth time to UTC through the zone (Berlin DST case)", () => {
    // 12:00 Berlin summer = 10:00 UTC; 12:00 Berlin winter = 11:00 UTC
    const summer = birthInstantUtc("2023-07-01", "12:00", { lon: 13.405, timezone: "Europe/Berlin" });
    expect(summer).toEqual({ utcMs: Date.UTC(2023, 6, 1, 10), approximate: false });
    const winter = birthInstantUtc("2023-01-01", "12:00", { lon: 13.405, timezone: "Europe/Berlin" });
    expect(winter).toEqual({ utcMs: Date.UTC(2023, 0, 1, 11), approximate: false });
  });

  it("falls back to round(lon/15) hours without a usable timezone (approximate)", () => {
    expect(longitudeFallbackOffsetMinutes(16.373)).toBe(60); // Wien
    expect(longitudeFallbackOffsetMinutes(-123.816)).toBe(-480); // Aberdeen, WA
    const fallback = birthInstantUtc("2023-07-01", "12:00", { lon: 16.373, timezone: "Kaputt/Zone" });
    expect(fallback).toEqual({ utcMs: Date.UTC(2023, 6, 1, 11), approximate: true });
  });

  it("treats the wall time as UTC without any place (approximate)", () => {
    expect(birthInstantUtc("2023-07-01", "08:30")).toEqual({
      utcMs: Date.UTC(2023, 6, 1, 8, 30),
      approximate: true
    });
  });

  it("rejects unparseable date/time input", () => {
    expect(birthInstantUtc("not-a-date", "12:00")).toBeNull();
    expect(birthInstantUtc("2023-07-01", "25:99")).toBeNull();
    expect(birthInstantUtc("2023-07-01", "")).toBeNull();
  });
});

describe("ascendant", () => {
  it("satisfies the analytic equator identities (Asc = RAMC + 90° at lat 0)", () => {
    // At the equator tan(φ)=0 and the horizon geometry gives Asc exactly
    // RAMC+90° for RAMC 0/90/180/270 — independent of the obliquity.
    expect(ascendantFromRamc(0, 0, 23.44)).toBeCloseTo(90, 8);
    expect(ascendantFromRamc(90, 0, 23.44)).toBeCloseTo(180, 8);
    expect(ascendantFromRamc(180, 0, 23.44)).toBeCloseTo(270, 8);
    expect(ascendantFromRamc(270, 0, 23.44)).toBeCloseTo(0, 8);
  });

  it("matches Albert Einstein's documented Krebs ascendant (astro-databank AA)", () => {
    // 1879-03-14 11:30 LMT Ulm (LMT = UT +39.95min for lon 9.99°E) ->
    // 10:50 UT. astro-databank charts show ~11° Cancer rising (λ ≈ 101°).
    const asc = ascendantLongitude(Date.UTC(1879, 2, 14, 10, 50, 2), 48.4011, 9.9876);
    expect(asc).toBeGreaterThan(96);
    expect(asc).toBeLessThan(107);
  });

  it("matches Kurt Cobain's documented Jungfrau ascendant (astro-databank AA)", () => {
    // 1967-02-20 19:38 PST Aberdeen WA -> 1967-02-21 03:38 UT; the real
    // America/Los_Angeles conversion is exercised end-to-end here.
    const instant = birthInstantUtc("1967-02-20", "19:38", {
      lon: -123.8157,
      timezone: "America/Los_Angeles"
    });
    expect(instant).toEqual({ utcMs: Date.UTC(1967, 1, 21, 3, 38), approximate: false });
    const asc = ascendantLongitude(instant!.utcMs, 46.9754, -123.8157);
    expect(asc).toBeGreaterThan(150); // Jungfrau spans 150°–180°
    expect(asc).toBeLessThan(180);
  });

  it("matches Elizabeth II's documented ~21° Steinbock ascendant incl. 1926 BST", () => {
    // 1926-04-21 02:40 London. British Summer Time 1926 began April 18th —
    // tzdata must resolve +60min here, giving 01:40 UT and λ_asc ≈ 291°.
    const instant = birthInstantUtc("1926-04-21", "02:40", {
      lon: -0.1278,
      timezone: "Europe/London"
    });
    expect(instant).toEqual({ utcMs: Date.UTC(1926, 3, 21, 1, 40), approximate: false });
    const asc = ascendantLongitude(instant!.utcMs, 51.5074, -0.1278);
    expect(asc).toBeGreaterThan(286);
    expect(asc).toBeLessThan(296);
  });
});

describe("moonLongitude", () => {
  it("matches Meeus example 47.a within the series' 0.3° accuracy", () => {
    // 1992-04-12 0h TD: full-theory apparent λ = 133.162655° (JDE 2448724.5).
    // ΔT(1992) ≈ 59s shifts the low-precision value by < 0.01° — negligible.
    expect(moonLongitude((2448724.5 - 2440587.5) * 86400000)).toBeCloseTo(133.1626, 0);
    expect(Math.abs(moonLongitude((2448724.5 - 2440587.5) * 86400000) - 133.1626)).toBeLessThan(0.3);
  });

  it("is opposite the sun at the 2015-09-28 total lunar eclipse (4.6° Widder)", () => {
    const lon = moonLongitude(Date.UTC(2015, 8, 28, 2, 47));
    expect(lon).toBeGreaterThan(3.5);
    expect(lon).toBeLessThan(5.5);
  });

  it("is conjunct the sun at the 2024-04-08 total solar eclipse (~19.4° Widder)", () => {
    const lon = moonLongitude(Date.UTC(2024, 3, 8, 18, 18));
    expect(lon).toBeGreaterThan(18.4);
    expect(lon).toBeLessThan(20.4);
  });

  it("reproduces documented natal moon signs (Einstein/Cobain/Elizabeth II)", () => {
    // Schütze 240°–270°, Krebs 90°–120°, Löwe 120°–150°.
    const einstein = moonLongitude(Date.UTC(1879, 2, 14, 10, 50, 2));
    expect(einstein).toBeGreaterThan(240);
    expect(einstein).toBeLessThan(270);
    const cobain = moonLongitude(Date.UTC(1967, 1, 21, 3, 38));
    expect(cobain).toBeGreaterThan(90);
    expect(cobain).toBeLessThan(120);
    const elizabeth = moonLongitude(Date.UTC(1926, 3, 21, 1, 40));
    expect(elizabeth).toBeGreaterThan(120);
    expect(elizabeth).toBeLessThan(150);
  });
});

describe("bigThree", () => {
  it("computes sun + approximate noon-moon without birth time, but no ascendant", () => {
    const result = bigThree("1994-02-11");
    expect(result.sun?.id).toBe("wassermann");
    expect(result.moon).not.toBeNull(); // computed from assumed 12:00 noon
    expect(result.moon?.approximate).toBe(true);
    expect(result.ascendant).toBeNull(); // ascendant NEEDS a real time
  });

  it("returns nothing without a birth date", () => {
    expect(bigThree(undefined, "08:30", WIEN)).toEqual({ sun: null, moon: null, ascendant: null });
  });

  it("computes all großen Drei with date + time + place, exactly (Wien case)", () => {
    const result = bigThree("1994-02-11", "08:30", WIEN);
    expect(result.sun?.id).toBe("wassermann");
    expect(result.moon).not.toBeNull();
    expect(result.moon?.approximate).toBe(false);
    expect(result.ascendant).not.toBeNull();
    expect(result.ascendant?.approximate).toBe(false);
    // deterministic: same input, same signs and longitudes
    expect(bigThree("1994-02-11", "08:30", WIEN)).toEqual(result);
    // sign objects carry the German UI fields
    expect(result.moon?.name.length).toBeGreaterThan(0);
    expect(result.moon?.glyph.length).toBeGreaterThan(0);
    expect(result.ascendant?.element).toMatch(/^(Feuer|Erde|Luft|Wasser)$/);
    // longitudes map onto the returned signs (floor(λ/30) consistency)
    const signIds = [
      "widder", "stier", "zwillinge", "krebs", "loewe", "jungfrau",
      "waage", "skorpion", "schuetze", "steinbock", "wassermann", "fische"
    ];
    expect(signIds[Math.floor(result.moon!.longitude / 30)]).toBe(result.moon!.id);
    expect(signIds[Math.floor(result.ascendant!.longitude / 30)]).toBe(result.ascendant!.id);
  });

  it("marks moon + ascendant approximate when only the lon/15 fallback works", () => {
    const result = bigThree("1994-02-11", "08:30", { ...WIEN, timezone: "Kaputt/Zone" });
    expect(result.moon?.approximate).toBe(true);
    expect(result.ascendant?.approximate).toBe(true);
  });
});
