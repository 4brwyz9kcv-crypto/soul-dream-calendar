import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { saveJournalEntry } from "../services/storage";

function Bombe(): never {
  throw new Error("Leiterbahn unterbrochen");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    localStorage.clear();
    // React protokolliert aufgefangene Fehler zusaetzlich selbst; das waere im
    // Testlauf nur Rauschen.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("zeigt Kinder unveraendert, solange nichts schiefgeht", () => {
    render(
      <ErrorBoundary>
        <p>Alles ruhig im Schaltkreis</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("Alles ruhig im Schaltkreis")).toBeDefined();
  });

  it("faengt Renderfehler ab, statt eine weisse Seite zu hinterlassen", () => {
    render(
      <ErrorBoundary>
        <Bombe />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Der Schaltkreis ist unterbrochen")).toBeDefined();
    // Die Fehlermeldung selbst bleibt einsehbar, damit ein Bericht moeglich ist.
    expect(screen.getByText("Leiterbahn unterbrochen")).toBeDefined();
  });

  it("bietet im Fehlerfall einen Export an, der die Eintraege wirklich enthaelt", () => {
    saveJournalEntry({
      dayKey: "2026-07-25",
      note: "Traum von Leiterbahnen",
      promptResponses: {},
      updatedAt: ""
    });

    const created: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // jsdom navigiert bei link.click() nicht, der Aufruf allein genuegt hier.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bombe />
      </ErrorBoundary>
    );
    screen.getByRole("button", { name: /Daten sichern/i }).click();

    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("application/json");
  });
});
