import { describe, expect, it } from "vitest";
import { hasContent, monthSummary, searchEntries, streaks, toMarkdown } from "../services/review";
import type { AllProfileData } from "../types";

function daten(overrides: Partial<AllProfileData> = {}): AllProfileData {
  return { journal: {}, moods: {}, hours: {}, ...overrides };
}

function eintrag(note: string, promptResponses: Record<string, string> = {}) {
  return { dayKey: "", note, promptResponses, updatedAt: "" };
}

describe("hasContent", () => {
  it("zaehlt nur echten Inhalt", () => {
    expect(hasContent(undefined)).toBe(false);
    expect(hasContent(eintrag(""))).toBe(false);
    expect(hasContent(eintrag("   "))).toBe(false);
    expect(hasContent(eintrag("", { a: "   " }))).toBe(false);
    expect(hasContent(eintrag("Traum"))).toBe(true);
    expect(hasContent(eintrag("", { a: "Antwort" }))).toBe(true);
  });
});

describe("monthSummary", () => {
  it("liefert jeden Tag des Monats, auch die leeren", () => {
    const februar2024 = monthSummary(2024, 2, daten());
    expect(februar2024).toHaveLength(29); // Schaltjahr
    expect(monthSummary(2026, 2, daten())).toHaveLength(28);
    expect(monthSummary(2026, 7, daten())).toHaveLength(31);
  });

  it("verbindet Farbe, Notiz, Stunden und Stimmung pro Tag", () => {
    const data = daten({
      journal: { "2026-07-03": eintrag("Ein Traum von Leiterbahnen") },
      hours: { "2026-07-03": { 8: "Kaffee", 9: "   ", 14: "Spaziergang" } },
      moods: {
        "2026-07-03": { dayKey: "2026-07-03", emoji: "🙂", label: "Gut", score: 4, updatedAt: "" }
      }
    });
    const dritter = monthSummary(2026, 7, data)[2];
    expect(dritter.iso).toBe("2026-07-03");
    expect(dritter.hasNote).toBe(true);
    // Die leere 9-Uhr-Zeile darf nicht mitzaehlen.
    expect(dritter.hoursLogged).toBe(2);
    expect(dritter.mood?.label).toBe("Gut");
    expect(dritter.colorHex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("streaks", () => {
  it("zaehlt aufeinanderfolgende Tage", () => {
    const result = streaks(["2026-07-20", "2026-07-21", "2026-07-22"], "2026-07-22");
    expect(result).toEqual({ current: 3, longest: 3, total: 3 });
  });

  it("laesst die Serie bestehen, wenn heute noch nichts geschrieben wurde", () => {
    // Morgens um 9 hat niemand schon getippt - die Serie von gestern zu
    // kassieren waere die falsche Botschaft.
    const result = streaks(["2026-07-20", "2026-07-21"], "2026-07-22");
    expect(result.current).toBe(2);
  });

  it("bricht die Serie ab, wenn zwei Tage fehlen", () => {
    const result = streaks(["2026-07-20", "2026-07-21"], "2026-07-23");
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it("findet die laengste Serie auch mitten in der Historie", () => {
    const result = streaks(
      ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-03-01", "2026-03-02"],
      "2026-03-02"
    );
    expect(result.longest).toBe(4);
    expect(result.current).toBe(2);
    expect(result.total).toBe(6);
  });

  it("kommt ueber Monats- und Jahresgrenzen", () => {
    expect(streaks(["2026-01-31", "2026-02-01"], "2026-02-01").current).toBe(2);
    expect(streaks(["2025-12-31", "2026-01-01"], "2026-01-01").current).toBe(2);
    // Ueber den Sommerzeitwechsel hinweg - deshalb rechnet streaks in UTC.
    expect(streaks(["2026-03-28", "2026-03-29", "2026-03-30"], "2026-03-30").current).toBe(3);
  });

  it("ignoriert Duplikate und Unsinn", () => {
    const result = streaks(["2026-07-20", "2026-07-20", "kaputt", ""], "2026-07-20");
    expect(result.total).toBe(1);
    expect(result.current).toBe(1);
  });

  it("kommt mit leerem Bestand klar", () => {
    expect(streaks([], "2026-07-20")).toEqual({ current: 0, longest: 0, total: 0 });
  });
});

describe("searchEntries", () => {
  const data = daten({
    journal: {
      "2026-07-01": eintrag("Ein Traum von Leiterbahnen im Nebel"),
      "2026-07-05": eintrag("Nichts besonderes", { gratitude: "Dankbar fuer den Nebel" })
    },
    hours: { "2026-07-09": { 14: "Nebelspaziergang am Fluss" } }
  });

  it("findet quer ueber Notiz, Antwort und Stundenlogger", () => {
    const hits = searchEntries("nebel", data);
    expect(hits).toHaveLength(3);
    expect(hits.map((hit) => hit.source).sort()).toEqual(["hour", "note", "prompt"]);
  });

  it("sortiert die neuesten Treffer nach oben", () => {
    expect(searchEntries("nebel", data)[0].iso).toBe("2026-07-09");
  });

  it("ignoriert Gross- und Kleinschreibung und zu kurze Anfragen", () => {
    expect(searchEntries("NEBEL", data)).toHaveLength(3);
    expect(searchEntries("n", data)).toHaveLength(0);
    expect(searchEntries("  ", data)).toHaveLength(0);
  });

  it("kuerzt lange Notizen auf einen Ausschnitt", () => {
    const lang = daten({
      journal: { "2026-07-01": eintrag(`${"x".repeat(300)} Suchwort ${"y".repeat(300)}`) }
    });
    const [hit] = searchEntries("Suchwort", lang);
    expect(hit.excerpt).toContain("Suchwort");
    expect(hit.excerpt.length).toBeLessThan(160);
    expect(hit.excerpt.startsWith("…")).toBe(true);
    expect(hit.excerpt.endsWith("…")).toBe(true);
  });
});

describe("toMarkdown", () => {
  const data = daten({
    journal: { "2026-07-03": eintrag("Ein Traum", { gratitude: "Fuer den Regen" }) },
    moods: {
      "2026-07-03": { dayKey: "2026-07-03", emoji: "🙂", label: "Gut", score: 4, updatedAt: "" }
    },
    hours: { "2026-07-03": { 8: "Kaffee" } }
  });

  it("schreibt Ueberschriften, Stimmung, Notiz, Antworten und Stunden", () => {
    const markdown = toMarkdown(data, "Remy");
    expect(markdown).toContain("# Soul Dream Calendar — Remy");
    expect(markdown).toContain("## Juli 2026");
    expect(markdown).toContain("### 3. Juli 2026");
    expect(markdown).toContain("**Stimmung:** 🙂 Gut");
    expect(markdown).toContain("Ein Traum");
    expect(markdown).toContain("Fuer den Regen");
    expect(markdown).toContain("`08:00` Kaffee");
  });

  it("laesst voellig leere Tage weg", () => {
    const mitLeeren = daten({
      journal: { "2026-07-01": eintrag(""), "2026-07-03": eintrag("Ein Traum") }
    });
    const markdown = toMarkdown(mitLeeren, "");
    expect(markdown).toContain("### 3. Juli 2026");
    expect(markdown).not.toContain("### 1. Juli 2026");
  });

  it("kommt mit leerem Bestand klar", () => {
    expect(toMarkdown(daten(), "")).toContain("0 Tage");
  });
});
