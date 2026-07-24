// Horoskop suite: zodiac boundaries (as implemented/documented in
// horoscope.ts), life-path numbers incl. master preservation, and the
// deterministic daily horoscope with lucky number/color.
import { describe, expect, it } from "vitest";
import { dayColors } from "../data/colors";
import {
  dailyHoroscope,
  lifePathNumber,
  zodiacSign,
  zodiacSignFromLongitude
} from "../services/horoscope";

describe("zodiacSign", () => {
  it("matches the documented boundary dates", () => {
    // [date, expected sign id] — start and end of every sign
    const cases: Array<[string, string]> = [
      ["2000-03-21", "widder"],
      ["2000-04-19", "widder"],
      ["2000-04-20", "stier"],
      ["2000-05-20", "stier"],
      ["2000-05-21", "zwillinge"],
      ["2000-06-20", "zwillinge"],
      ["2000-06-21", "krebs"],
      ["2000-07-22", "krebs"],
      ["2000-07-23", "loewe"],
      ["2000-08-22", "loewe"],
      ["2000-08-23", "jungfrau"],
      ["2000-09-22", "jungfrau"],
      ["2000-09-23", "waage"],
      ["2000-10-22", "waage"],
      ["2000-10-23", "skorpion"],
      ["2000-11-21", "skorpion"],
      ["2000-11-22", "schuetze"],
      ["2000-12-21", "schuetze"],
      ["2000-12-22", "steinbock"],
      ["2000-12-31", "steinbock"],
      ["2000-01-01", "steinbock"],
      ["2000-01-19", "steinbock"],
      ["2000-01-20", "wassermann"],
      ["2000-02-18", "wassermann"],
      ["2000-02-19", "fische"],
      ["2000-03-20", "fische"]
    ];
    for (const [date, id] of cases) {
      expect(zodiacSign(date)?.id, date).toBe(id);
    }
  });

  it("carries German name, glyph, range and element", () => {
    const widder = zodiacSign("1994-04-01");
    expect(widder).toEqual({
      id: "widder",
      name: "Widder",
      glyph: "♈",
      range: "21.03. – 19.04.",
      element: "Feuer"
    });
    expect(zodiacSign("1990-02-01")?.name).toBe("Wassermann");
    expect(zodiacSign("1990-02-01")?.element).toBe("Luft");
    expect(zodiacSign("1990-08-01")?.glyph).toBe("♌");
  });

  it("returns null for missing or unparseable input", () => {
    expect(zodiacSign(undefined)).toBeNull();
    expect(zodiacSign("")).toBeNull();
    expect(zodiacSign("not-a-date")).toBeNull();
    expect(zodiacSign("2000-13-40")).toBeNull();
  });
});

describe("lifePathNumber", () => {
  it("digit-sums the full yyyymmdd and reduces", () => {
    // 1+9+9+0+1+2+3+1 = 26 -> 8
    expect(lifePathNumber("1990-12-31")).toBe(8);
    // 2+0+2+5+0+5+2+4 = 20 -> 2
    expect(lifePathNumber("2025-05-24")).toBe(2);
    // 1+9+9+4+0+2+1+1 = 27 -> 9
    expect(lifePathNumber("1994-02-11")).toBe(9);
  });

  it("preserves the master numbers 11 and 22", () => {
    // 2+0+0+0+0+4+0+5 = 11 (master, not reduced to 2)
    expect(lifePathNumber("2000-04-05")).toBe(11);
    // 1+9+8+0+1+1+0+2 = 22 (master, not reduced to 4)
    expect(lifePathNumber("1980-11-02")).toBe(22);
  });

  it("returns null for missing or incomplete input", () => {
    expect(lifePathNumber(undefined)).toBeNull();
    expect(lifePathNumber("")).toBeNull();
    expect(lifePathNumber("1990-12")).toBeNull();
    expect(lifePathNumber("1990-12-315")).toBeNull();
  });
});

describe("dailyHoroscope", () => {
  const date = new Date(2025, 4, 24);
  const widder = zodiacSign("2000-04-01")!;
  const fische = zodiacSign("2000-03-01")!;

  it("is deterministic for the same sign, date and personal seed", () => {
    expect(dailyHoroscope(widder, date, 12345)).toEqual(dailyHoroscope(widder, date, 12345));
  });

  it("differs across signs, days and personal seeds", () => {
    const base = dailyHoroscope(widder, date, 0);
    expect(dailyHoroscope(fische, date, 0).text).not.toBe(base.text);
    expect(dailyHoroscope(widder, new Date(2025, 4, 25), 0).text).not.toBe(base.text);
    expect(dailyHoroscope(widder, date, 987654).text).not.toBe(base.text);
  });

  it("weaves the sign name into the text and speaks German", () => {
    const horoscope = dailyHoroscope(widder, date, 42);
    expect(horoscope.text).toContain("Widder");
    expect(horoscope.text.split(". ").length).toBeGreaterThanOrEqual(2);
  });

  it("yields a lucky number 1-99 and a lucky color from the day colors", () => {
    for (let day = 1; day <= 28; day += 1) {
      const horoscope = dailyHoroscope(widder, new Date(2025, 6, day), 777);
      expect(horoscope.luckyNumber).toBeGreaterThanOrEqual(1);
      expect(horoscope.luckyNumber).toBeLessThanOrEqual(99);
      expect(
        dayColors.some(
          (color) => color.hex === horoscope.luckyColorHex && color.name === horoscope.luckyColorName
        )
      ).toBe(true);
    }
  });

  it("appends a deterministic ascendant sentence WITHOUT touching the classic parts", () => {
    const base = dailyHoroscope(widder, date, 12345);
    const withAsc = dailyHoroscope(widder, date, 12345, fische);
    // classic three sentences stay a byte-identical prefix, lucky picks unchanged
    expect(withAsc.text.startsWith(base.text)).toBe(true);
    expect(withAsc.text.length).toBeGreaterThan(base.text.length);
    expect(withAsc.luckyNumber).toBe(base.luckyNumber);
    expect(withAsc.luckyColorHex).toBe(base.luckyColorHex);
    expect(withAsc.luckyColorName).toBe(base.luckyColorName);
    // the extra sentence weaves in the ascendant sign name and is deterministic
    expect(withAsc.text).toContain("Fische");
    expect(dailyHoroscope(widder, date, 12345, fische)).toEqual(withAsc);
    // omitted ascendant === explicit undefined (regression: legacy callers)
    expect(dailyHoroscope(widder, date, 12345, undefined)).toEqual(base);
    // a different ascendant yields a different accent
    const withWidderAsc = dailyHoroscope(widder, date, 12345, widder);
    expect(withWidderAsc.text).not.toBe(withAsc.text);
  });
});

describe("zodiacSignFromLongitude", () => {
  it("maps floor(λ/30) onto the German sign objects in Widder-first order", () => {
    expect(zodiacSignFromLongitude(0).id).toBe("widder");
    expect(zodiacSignFromLongitude(29.999).id).toBe("widder");
    expect(zodiacSignFromLongitude(30).id).toBe("stier");
    expect(zodiacSignFromLongitude(101.6).id).toBe("krebs"); // Einstein Asc
    expect(zodiacSignFromLongitude(173.3).id).toBe("jungfrau"); // Cobain Asc
    expect(zodiacSignFromLongitude(291.4).id).toBe("steinbock"); // Elizabeth II Asc
    expect(zodiacSignFromLongitude(359.9).id).toBe("fische");
    // normalization: negative and >360 inputs fold into the circle
    expect(zodiacSignFromLongitude(-10).id).toBe("fische");
    expect(zodiacSignFromLongitude(360).id).toBe("widder");
    expect(zodiacSignFromLongitude(390).id).toBe("stier");
    // carries the full German UI shape
    expect(zodiacSignFromLongitude(45)).toEqual({
      id: "stier",
      name: "Stier",
      glyph: "♉",
      range: "20.04. – 20.05.",
      element: "Erde"
    });
  });
});
