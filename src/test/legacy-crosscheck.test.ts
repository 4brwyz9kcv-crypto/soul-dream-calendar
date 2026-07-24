// Port-verification suite: every expected value below was computed by running
// the legacy Python implementation (motivational_number.py, bible.py,
// pokemon.py, calendar_day.py, main.py) so the TypeScript ports stay
// bit-compatible with the original algorithms.
import { describe, expect, it } from "vitest";
import { dayColors } from "../data/colors";
import { dayOfYear, sunDistanceAu, AU_KM } from "../services/astro";
import { analyzeNumerology } from "../services/numerology";
import { bibleVerseIndex, colorOfTheDay, pokemonSeedFor } from "../services/oracle";
import { fakeVerse } from "../services/markov";

describe("legacy cross-check", () => {
  it("matches legacy numerology numbers", () => {
    const pick = (r: ReturnType<typeof analyzeNumerology>) => ({
      destiny: r.destiny.number,
      personality: r.personality.number,
      attitude: r.attitude.number,
      character: r.character?.number ?? null,
      soul: r.soul?.number ?? null,
      agenda: r.agenda?.number ?? null,
      purpose: r.purpose?.number ?? null
    });

    expect(pick(analyzeNumerology("Max Mustermann", { year: 2025, month: 5, day: 24 }))).toEqual({
      destiny: 11, personality: 6, attitude: 11, character: 5, soul: 1, agenda: 4, purpose: 7
    });
    expect(pick(analyzeNumerology("Lukas", { year: 2025, month: 5, day: 24 }))).toEqual({
      destiny: 11, personality: 6, attitude: 11, character: 1, soul: 4, agenda: 6, purpose: 3
    });
    expect(pick(analyzeNumerology("Yolanda", { year: 1990, month: 12, day: 31 }))).toEqual({
      destiny: 8, personality: 4, attitude: 7, character: 9, soul: 8, agenda: 1, purpose: 8
    });
    expect(pick(analyzeNumerology("Maya", { year: 2000, month: 1, day: 1 }))).toEqual({
      destiny: 4, personality: 1, attitude: 2, character: 4, soul: 9, agenda: 4, purpose: 8
    });
    expect(pick(analyzeNumerology("May", { year: 2011, month: 11, day: 11 }))).toEqual({
      destiny: 8, personality: 11, attitude: 22, character: 3, soul: 8, agenda: 4, purpose: 11
    });
    expect(pick(analyzeNumerology("Lynn", { year: 2026, month: 7, day: 2 }))).toEqual({
      destiny: 1, personality: 2, attitude: 9, character: 2, soul: 7, agenda: 4, purpose: 3
    });

    const reading = analyzeNumerology("May", { year: 2011, month: 11, day: 11 });
    expect(reading.personality.isMaster).toBe(true);
    expect(reading.attitude.isMaster).toBe(true);
    expect(reading.purpose?.isMaster).toBe(true);
    expect(reading.destiny.isMaster).toBe(false);

    // empty / letterless names keep only the date-based categories
    const empty = analyzeNumerology("   ", { year: 2026, month: 7, day: 2 });
    expect(empty.destiny.number).toBe(1);
    expect(empty.character).toBeNull();
    expect(empty.soul).toBeNull();
    expect(empty.agenda).toBeNull();
    expect(empty.purpose).toBeNull();
  });

  it("matches legacy verse indices (mod 500)", () => {
    expect(bibleVerseIndex(24, 5, 2025)).toBe(140);
    expect(bibleVerseIndex(2, 7, 2026)).toBe(135);
    expect(bibleVerseIndex(31, 12, 1999)).toBe(300);
    expect(bibleVerseIndex(1, 1, 2000)).toBe(133);
    expect(bibleVerseIndex(11, 11, 2011)).toBe(142);
    expect(bibleVerseIndex(29, 2, 2024)).toBe(329);
  });

  it("matches legacy pokemon ids (+1)", () => {
    expect(pokemonSeedFor(24, 5, 2025)).toBe(43);
    expect(pokemonSeedFor(2, 7, 2026)).toBe(43);
    expect(pokemonSeedFor(31, 12, 1999)).toBe(633);
    expect(pokemonSeedFor(1, 1, 2000)).toBe(62);
    expect(pokemonSeedFor(11, 11, 2011)).toBe(627);
    expect(pokemonSeedFor(29, 2, 2024)).toBe(583);
  });

  it("matches legacy color indices", () => {
    expect(colorOfTheDay(24, 5, 2025)).toEqual(dayColors[690]);
    expect(colorOfTheDay(2, 7, 2026)).toEqual(dayColors[185]);
    expect(colorOfTheDay(31, 12, 1999)).toEqual(dayColors[617]);
    expect(colorOfTheDay(1, 1, 2000)).toEqual(dayColors[104]);
    expect(colorOfTheDay(11, 11, 2011)).toEqual(dayColors[616]);
    expect(colorOfTheDay(29, 2, 2024)).toEqual(dayColors[794]);
  });

  it("matches legacy sun distances", () => {
    const cases: Array<[number, number, number, number, number]> = [
      [2025, 5, 24, 143, 0.9944417683790457],
      [2026, 7, 2, 182, 0.9852762780004257],
      [1999, 12, 31, 364, 1.0164266460598297],
      [2000, 1, 1, 1, 1.0164241255611535],
      [2011, 11, 11, 314, 1.0116228503443983],
      [2024, 2, 29, 59, 1.0116299030123952]
    ];
    for (const [year, month, day, days, au] of cases) {
      expect(dayOfYear({ year, month, day })).toBe(days);
      expect(sunDistanceAu(days)).toBeCloseTo(au, 12);
    }
    // legacy km: distance_to_sun(m) / 1000 == au * AU_KM
    expect(sunDistanceAu(143) * AU_KM).toBeCloseTo(148766371.08464783, 3);
  });

  it("generates deterministic fake verses", () => {
    const a = fakeVerse(123456);
    const b = fakeVerse(123456);
    const c = fakeVerse(654321);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.split(" ").length).toBeLessThanOrEqual(25);
    expect(/[.!?]$/.test(a)).toBe(true);
    expect(c).not.toBe(a);
  });
});
