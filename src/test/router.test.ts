import { beforeEach, describe, expect, it } from "vitest";
import { isValidIso, readRoute, routeToUrl, writeRoute } from "../services/router";

// Gleiche Herkunft wie das jsdom-Fenster - history.replaceState verweigert
// alles andere. Der Unterpfad bildet die GitHub-Pages-Situation nach.
const BASE = `${window.location.origin}/soul-dream-calendar/`;

function goTo(search: string): void {
  window.history.replaceState(null, "", BASE + search);
}

describe("router", () => {
  beforeEach(() => {
    goTo("");
  });

  it("erkennt nur echte Kalendertage", () => {
    expect(isValidIso("2026-07-25")).toBe(true);
    expect(isValidIso("2024-02-29")).toBe(true);
    // Musterpruefung allein wuerde diese durchlassen; sie kippen still weiter.
    expect(isValidIso("2026-02-31")).toBe(false);
    expect(isValidIso("2025-02-29")).toBe(false);
    expect(isValidIso("2026-13-01")).toBe(false);
    expect(isValidIso("2026-00-10")).toBe(false);
    expect(isValidIso("25.07.2026")).toBe(false);
    expect(isValidIso(null)).toBe(false);
  });

  it("liest Ansicht und Tag aus der Adresse", () => {
    goTo("?v=oracle&d=2026-07-25");
    expect(readRoute()).toEqual({ view: "oracle", iso: "2026-07-25" });
  });

  it("faellt bei unbrauchbaren Parametern auf sichere Werte zurueck", () => {
    goTo("?v=hackerview&d=nicht-real");
    expect(readRoute("2026-01-01")).toEqual({ view: "calendar", iso: "2026-01-01" });

    goTo("?d=2026-03-09");
    expect(readRoute("2026-01-01")).toEqual({ view: "calendar", iso: "2026-03-09" });
  });

  it("schreibt einen teilbaren Link und laesst den Pfad unangetastet", () => {
    writeRoute({ view: "journal", iso: "2026-12-24" });
    // Der Pfad muss bleiben, sonst liefert GitHub Pages beim Neuladen 404.
    expect(window.location.pathname).toBe("/soul-dream-calendar/");
    expect(window.location.search).toBe("?v=journal&d=2026-12-24");
    expect(routeToUrl({ view: "journal", iso: "2026-12-24" })).toBe(
      BASE + "?v=journal&d=2026-12-24"
    );
  });

  it("legt beim Blaettern History-Eintraege an, beim Ersetzen nicht", () => {
    const start = window.history.length;
    writeRoute({ view: "oracle", iso: "2026-07-01" });
    writeRoute({ view: "oracle", iso: "2026-07-02" });
    expect(window.history.length).toBe(start + 2);

    writeRoute({ view: "oracle", iso: "2026-07-03" }, true);
    expect(window.history.length).toBe(start + 2);
    expect(readRoute()).toEqual({ view: "oracle", iso: "2026-07-03" });
  });

  it("schreibt nicht, wenn sich die Adresse gar nicht aendert", () => {
    writeRoute({ view: "oracle", iso: "2026-07-01" });
    const length = window.history.length;
    writeRoute({ view: "oracle", iso: "2026-07-01" });
    expect(window.history.length).toBe(length);
  });
});
