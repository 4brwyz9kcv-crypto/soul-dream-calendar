// Personal-seed suite: name + birth date personalize every oracle pick as an
// offset on top of the untouched legacy formulas. The pSeed-0 case (empty
// name, no birth date) must reproduce the legacy helper outputs exactly.
import { describe, expect, it } from "vitest";
import { bibleVerses } from "../data/verses";
import { stableSeed } from "../services/dates";
import { fakeVerse } from "../services/markov";
import {
  bibleVerseIndex,
  colorOfTheDay,
  getDayOracle,
  personalSeed,
  pokemonSeedFor
} from "../services/oracle";

const DATE = new Date(2025, 4, 24); // 24.05.2025

describe("personalSeed", () => {
  it("returns 0 for empty/whitespace name without birth date", () => {
    expect(personalSeed("")).toBe(0);
    expect(personalSeed("   ")).toBe(0);
    expect(personalSeed("", undefined)).toBe(0);
    expect(personalSeed("", "")).toBe(0);
  });

  it("is non-zero once a name or birth date is set", () => {
    expect(personalSeed("Lukas")).not.toBe(0);
    expect(personalSeed("", "1994-02-11")).not.toBe(0);
  });

  it("normalizes the name (trim + lowercase)", () => {
    expect(personalSeed("  Lukas  ", "1994-02-11")).toBe(personalSeed("lukas", "1994-02-11"));
  });
});

describe("seed stability (birthTime/birthPlace are strictly additive)", () => {
  it("unset birth time/place reproduce the EXACT previous seed", () => {
    // The pre-birthTime/-birthPlace formula was stableSeed(`${name}|${birth}`);
    // its outputs are frozen here as regression anchors.
    expect(personalSeed("Lukas", "1994-02-11")).toBe(stableSeed("lukas|1994-02-11"));
    expect(personalSeed("Lukas")).toBe(stableSeed("lukas|"));
    // old-style call === new-style call with unset/empty extras
    expect(personalSeed("Lukas", "1994-02-11", undefined, undefined)).toBe(
      personalSeed("Lukas", "1994-02-11")
    );
    expect(personalSeed("Lukas", "1994-02-11", "", "")).toBe(personalSeed("Lukas", "1994-02-11"));
    expect(personalSeed("Lukas", "1994-02-11", "  ", " ")).toBe(personalSeed("Lukas", "1994-02-11"));
    // all-empty still yields the legacy zero seed
    expect(personalSeed("", undefined, undefined, undefined)).toBe(0);
    expect(personalSeed("", "", "", "")).toBe(0);
  });

  it("keeps the full oracle byte-identical between old- and new-style calls", () => {
    const oldStyle = getDayOracle(DATE, "Lukas", "1994-02-11");
    const newStyle = getDayOracle(DATE, "Lukas", "1994-02-11", undefined, undefined);
    expect(newStyle).toEqual(oldStyle);
    const anonymousOld = getDayOracle(DATE, "");
    const anonymousNew = getDayOracle(DATE, "", undefined, undefined, undefined);
    expect(anonymousNew).toEqual(anonymousOld);
  });

  it("shifts the seed once birth time or place are actually set", () => {
    const base = personalSeed("Lukas", "1994-02-11");
    expect(personalSeed("Lukas", "1994-02-11", "08:30")).not.toBe(base);
    expect(personalSeed("Lukas", "1994-02-11", undefined, "Wien")).not.toBe(base);
    expect(personalSeed("Lukas", "1994-02-11", "08:30", "Wien")).not.toBe(
      personalSeed("Lukas", "1994-02-11", "08:31", "Wien")
    );
    expect(personalSeed("Lukas", "1994-02-11", "08:30", "Wien")).not.toBe(
      personalSeed("Lukas", "1994-02-11", "08:30", "Graz")
    );
    // …and clearing them reverts the oracle picks exactly
    const withExtras = getDayOracle(DATE, "Lukas", "1994-02-11", "08:30", "Wien");
    expect(withExtras).not.toEqual(getDayOracle(DATE, "Lukas", "1994-02-11"));
    expect(getDayOracle(DATE, "Lukas", "1994-02-11", undefined, undefined)).toEqual(
      getDayOracle(DATE, "Lukas", "1994-02-11")
    );
  });

  it("normalizes the place name (trim + lowercase) but not the time", () => {
    expect(personalSeed("Lukas", "1994-02-11", "08:30", "  Wien ")).toBe(
      personalSeed("Lukas", "1994-02-11", "08:30", "wien")
    );
  });
});

describe("personalized oracle", () => {
  it("is deterministic for the same date, name and birth date", () => {
    const a = getDayOracle(DATE, "Lukas", "1994-02-11");
    const b = getDayOracle(DATE, "Lukas", "1994-02-11");
    expect(a).toEqual(b);
  });

  it("gives two different names different color, pokemon and verse", () => {
    const anna = getDayOracle(DATE, "Anna", "1990-01-01");
    const ben = getDayOracle(DATE, "Ben", "1990-01-01");
    expect(anna.color).not.toEqual(ben.color);
    expect(anna.pokemonSeed).not.toBe(ben.pokemonSeed);
    expect(anna.bibleVerse).not.toBe(ben.bibleVerse);
    expect(anna.imageSeed).not.toBe(ben.imageSeed);
  });

  it("gives the same name different picks for different birth dates", () => {
    const early = getDayOracle(DATE, "Lukas", "1990-01-01");
    const late = getDayOracle(DATE, "Lukas", "2001-12-24");
    expect(early.color).not.toEqual(late.color);
    expect(early.pokemonSeed).not.toBe(late.pokemonSeed);
    expect(early.bibleVerse).not.toBe(late.bibleVerse);
    expect(early.imageSeed).not.toBe(late.imageSeed);
  });

  it("matches the pure legacy helpers exactly when pSeed is 0", () => {
    const oracle = getDayOracle(DATE, "");
    expect(oracle.color).toEqual(colorOfTheDay(24, 5, 2025));
    expect(oracle.bibleVerse).toBe(bibleVerses[bibleVerseIndex(24, 5, 2025)]);
    expect(oracle.pokemonSeed).toBe(pokemonSeedFor(24, 5, 2025));
    expect(oracle.fakeBibleVerse).toBe(fakeVerse(stableSeed("fake-verse:2025-05-24")));
    expect(oracle.imageSeed).toBe(stableSeed("image:2025-05-24:anonymous"));
  });

  it("keeps the date-based numerology triad independent of the person", () => {
    const anna = getDayOracle(DATE, "Anna", "1990-01-01");
    const ben = getDayOracle(DATE, "Ben", "2001-12-24");
    const triad = (signal: string) => signal.split("·")[0].trim();
    expect(triad(anna.numberSignal)).toBe(triad(ben.numberSignal));
  });
});
