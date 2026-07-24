import { describe, expect, it } from "vitest";
import {
  analyzeNumerology,
  impulseNumberMeaning,
  isMasterNumber,
  placeNumber,
  placeNumberMeaning,
  reduceDigits,
  timeImpulseNumber
} from "../services/numerology";

const refDate = { year: 2025, month: 5, day: 24 };

describe("numerology edge cases", () => {
  it("preserves numeric master numbers in reduceDigits, but digit-sums master strings once (Python parity)", () => {
    // Numeric 11/22 are master numbers and are never reduced.
    expect(reduceDigits(11)).toBe(11);
    expect(reduceDigits(22)).toBe(22);
    // Reductions that land on a master number stop there.
    expect(reduceDigits(29)).toBe(11); // 2+9
    expect(reduceDigits(2054)).toBe(11); // 2+0+5+4
    expect(reduceDigits(499)).toBe(22); // 4+9+9
    // Ported Python quirk: a raw digit STRING is digit-summed once first
    // (in Python `"11" == 11` is False), so string masters do NOT survive.
    expect(reduceDigits("11")).toBe(2);
    expect(reduceDigits("22")).toBe(4);
    // ...but if the first digit-sum of a string lands on a master, it sticks.
    expect(reduceDigits("29")).toBe(11);
    expect(isMasterNumber(11)).toBe(true);
    expect(isMasterNumber(22)).toBe(true);
    expect(isMasterNumber(33)).toBe(false);
  });

  it("keeps master numbers 11/22 unreduced in the reading categories", () => {
    // 2025+5+24 = 2054 -> 11 (destiny), 5+24 = 29 -> 11 (attitude)
    const reading = analyzeNumerology("Max Mustermann", refDate);
    expect(reading.destiny.number).toBe(11);
    expect(reading.destiny.isMaster).toBe(true);
    expect(reading.destiny.meaning.length).toBeGreaterThan(0);
    expect(reading.attitude.number).toBe(11);
    expect(reading.attitude.isMaster).toBe(true);

    // day 22 -> personality 22 stays a master number
    const day22 = analyzeNumerology("Max", { year: 2000, month: 1, day: 22 });
    expect(day22.personality.number).toBe(22);
    expect(day22.personality.isMaster).toBe(true);
    expect(day22.personality.meaning.length).toBeGreaterThan(0);
  });

  it("treats an initial Y before a non-1 letter as a consonant", () => {
    // "Yo": Y starts the name and the next letter O maps to 6 (not 1),
    // so Y (=7) lands in the consonants -> agenda 7, vowels only O (=6) -> soul 6.
    const yo = analyzeNumerology("Yo", refDate);
    expect(yo.soul?.number).toBe(6);
    expect(yo.agenda?.number).toBe(7);
    expect(yo.character?.number).toBe(4); // "76" -> 13 -> 4

    // "Yolanda": same rule; Y counts as consonant.
    // vowels O,A,A = 6+1+1 = 8; consonants Y,L,N,D = 7+3+5+4 = 19 -> 10 -> 1
    const yolanda = analyzeNumerology("Yolanda", refDate);
    expect(yolanda.soul?.number).toBe(8);
    expect(yolanda.agenda?.number).toBe(1);
  });

  it("treats Y as a vowel before a 1-letter, after a consonant, at name end and before a space", () => {
    // NOTE: in "Yara" the Y is a VOWEL per the ported legacy rule, because the
    // NEXT letter A maps to the number 1 (the rule fires even at name start).
    // vowels Y,A,A = 7+1+1 = "711" -> 9; consonants R = 9
    const yara = analyzeNumerology("Yara", refDate);
    expect(yara.soul?.number).toBe(9);
    expect(yara.agenda?.number).toBe(9);

    // "May": Y ends the name -> vowel. vowels A,Y = "17" -> 8; consonants M -> 4
    const may = analyzeNumerology("May", refDate);
    expect(may.soul?.number).toBe(8);
    expect(may.agenda?.number).toBe(4);

    // "Lynn": Y follows the consonant L -> vowel. vowels Y = 7; consonants L,N,N = "355" -> 13 -> 4
    const lynn = analyzeNumerology("Lynn", refDate);
    expect(lynn.soul?.number).toBe(7);
    expect(lynn.agenda?.number).toBe(4);

    // "Kay Smith": the character after Y is a space (legacy raised KeyError,
    // the port treats it like end-of-name -> vowel).
    // vowels A,Y,I = "179" -> 17 -> 8; consonants K,S,M,T,H = "21428" -> 17 -> 8
    const kay = analyzeNumerology("Kay Smith", refDate);
    expect(kay.soul?.number).toBe(8);
    expect(kay.agenda?.number).toBe(8);
  });

  it("returns date categories and null name categories for empty or whitespace names", () => {
    for (const name of ["", "   ", "\t \n"]) {
      const reading = analyzeNumerology(name, refDate);
      expect(reading.destiny.number).toBe(11);
      expect(reading.personality.number).toBe(6); // 24 -> 6
      expect(reading.attitude.number).toBe(11);
      expect(reading.character).toBeNull();
      expect(reading.soul).toBeNull();
      expect(reading.agenda).toBeNull();
      expect(reading.purpose).toBeNull();
    }
  });

  it("yields agenda null for all-vowel names but keeps the other name categories", () => {
    // "Aia": A,I,A = "191" -> 11 (master) for character and soul; no consonants.
    const reading = analyzeNumerology("Aia", refDate);
    expect(reading.agenda).toBeNull();
    expect(reading.character?.number).toBe(11);
    expect(reading.character?.isMaster).toBe(true);
    expect(reading.soul?.number).toBe(11);
    // purpose = reduceDigits(destiny 11 + character 11 = 22) -> master preserved
    expect(reading.purpose?.number).toBe(22);
    expect(reading.purpose?.isMaster).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    expect(analyzeNumerology("Max Mustermann", refDate)).toEqual(analyzeNumerology("Max Mustermann", refDate));
    expect(analyzeNumerology("", refDate)).toEqual(analyzeNumerology("", refDate));
  });

  it("does not crash on umlauts or non-letter characters", () => {
    // Umlauts are outside A-Z and are skipped like the legacy loop.
    const joergMueller = analyzeNumerology("Jörg Müller", refDate);
    expect(joergMueller.character).not.toBeNull(); // E in "Müller" is a vowel
    expect(joergMueller.destiny.number).toBe(11);

    // "Jörg" alone has no A-Z vowel once ö is skipped -> name categories null.
    const joerg = analyzeNumerology("Jörg", refDate);
    expect(joerg.character).toBeNull();
    expect(joerg.soul).toBeNull();
    expect(joerg.agenda).toBeNull();
    expect(joerg.purpose).toBeNull();

    // Digits and dashes are skipped; no vowels among R,D -> name categories null.
    const droid = analyzeNumerology("R2-D2!", refDate);
    expect(droid.character).toBeNull();

    // Mixed non-letters with a vowel still work.
    const lisa = analyzeNumerology("L1sa", refDate);
    expect(lisa.soul?.number).toBe(1);
  });
});

describe("S.O.U.L extensions: Ortszahl + Impulszahl", () => {
  it("computes the Ortszahl with the legacy letter map", () => {
    // Wien: W5 I9 E5 N5 = 24 -> 6
    expect(placeNumber("Wien")).toBe(6);
    // Berlin: B2 E5 R9 L3 I9 N5 = 33 -> 6
    expect(placeNumber("Berlin")).toBe(6);
    // Rom: R9 O6 M4 = 19 -> 10 -> 1
    expect(placeNumber("Rom")).toBe(1);
    // Graz: G7 R9 A1 Z8 = 25 -> 7
    expect(placeNumber("Graz")).toBe(7);
  });

  it("preserves master numbers in the Ortszahl", () => {
    // London: L3 O6 N5 D4 O6 N5 = 29 -> 11 (Meisterzahl, not reduced to 2)
    expect(placeNumber("London")).toBe(11);
  });

  it("transliterates umlauts instead of dropping them", () => {
    // Zürich -> ZUERICH: 8+3+5+9+9+3+8 = 45 -> 9 (a dropped ü would give
    // ZRICH = 8+9+9+3+8 = 37 -> 10 -> 1)
    expect(placeNumber("Zürich")).toBe(9);
    expect(placeNumber("Zuerich")).toBe(9);
    expect(placeNumber("Zürich")).not.toBe(placeNumber("Zrich"));
  });

  it("returns null for letterless place names", () => {
    expect(placeNumber("")).toBeNull();
    expect(placeNumber("123 !?")).toBeNull();
  });

  it("carries a German meaning for every possible Ortszahl", () => {
    for (const value of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22]) {
      expect(placeNumberMeaning(value).length).toBeGreaterThan(10);
    }
    expect(placeNumberMeaning(11)).toContain("Meisterort");
    expect(placeNumberMeaning(13)).toBe("");
  });

  it("computes the Impulszahl from HHMM incl. the master case", () => {
    // 08:30 -> 0+8+3+0 = 11 (Meisterzahl preserved)
    expect(timeImpulseNumber("08:30")).toBe(11);
    expect(isMasterNumber(timeImpulseNumber("08:30")!)).toBe(true);
    // 12:34 -> 10 -> 1
    expect(timeImpulseNumber("12:34")).toBe(1);
    // 23:59 -> 19 -> 10 -> 1
    expect(timeImpulseNumber("23:59")).toBe(1);
    // 00:00 -> 0 (die stille Stunde)
    expect(timeImpulseNumber("00:00")).toBe(0);
    // 20:02 -> 4
    expect(timeImpulseNumber("20:02")).toBe(4);
  });

  it("rejects missing or malformed times", () => {
    expect(timeImpulseNumber(undefined)).toBeNull();
    expect(timeImpulseNumber("")).toBeNull();
    expect(timeImpulseNumber("24:00")).toBeNull();
    expect(timeImpulseNumber("8:30")).toBeNull();
    expect(timeImpulseNumber("08:61")).toBeNull();
  });

  it("carries a German impulse meaning for every reachable value", () => {
    for (const value of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22]) {
      expect(impulseNumberMeaning(value).length).toBeGreaterThan(10);
    }
    expect(impulseNumberMeaning(11)).toContain("Meisterimpuls");
  });
});
