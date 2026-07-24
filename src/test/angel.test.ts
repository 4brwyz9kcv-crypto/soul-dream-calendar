import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAngelSpeech } from "../services/angel";
import { getDayOracle } from "../services/oracle";
import { setOpenAiKey } from "../services/storage";
import type { JournalEntry, MoodEntry } from "../types";

const oracle = getDayOracle(new Date(2025, 4, 24), "Testname");

function journal(note: string): JournalEntry {
  return { dayKey: oracle.key.iso, note, promptResponses: {}, updatedAt: "" };
}

const mood: MoodEntry = { dayKey: oracle.key.iso, emoji: "🌙", label: "Ruhig", score: 4, updatedAt: "" };

const fetchMock = vi.fn();

describe("angel speech service", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("local mode returns several German lines and reacts to a saved journal note", async () => {
    const withNote = await getAngelSpeech(oracle, journal("Heute von Leiterbahnen getraeumt."), mood, "local");
    expect(withNote.length).toBeGreaterThan(2);
    expect(withNote.some((line) => line.text.includes("Deine Notiz ist gespeichert"))).toBe(true);
    expect(withNote.some((line) => line.text.includes("ruhig"))).toBe(true); // mood-aware

    const withoutNote = await getAngelSpeech(oracle, journal(""), null, "local");
    expect(withoutNote.length).toBeGreaterThan(2);
    expect(withoutNote.some((line) => line.text.includes("Noch keine Notiz"))).toBe(true);
    expect(withoutNote.some((line) => line.text.includes("Stimmung ist noch ungemessen"))).toBe(true);

    expect(fetchMock).not.toHaveBeenCalled(); // local mode never touches the network
  });

  it("openai mode without a key adds a glitch status line and still returns local lines", async () => {
    const lines = await getAngelSpeech(oracle, journal(""), null, "openai");

    expect(lines.length).toBeGreaterThan(2);
    const glitch = lines.find((line) => line.id === "openai-no-key");
    expect(glitch).toBeDefined();
    expect(glitch?.mood).toBe("glitch");
    expect(glitch?.source).toBe("openai");
    expect(glitch?.text).toContain("kein Schluessel");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("openai mode with a stored key uses the generated openai lines", async () => {
    setOpenAiKey("sk-test-123");
    const content = "Signal eins leuchtet.\nSignal zwei pulsiert.\nSignal drei flackert.\nSignal vier traeumt.";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] })
    });

    const lines = await getAngelSpeech(oracle, journal("Notiz."), mood, "openai", {
      angelName: "Seraph Eye PCB"
    });

    expect(lines.map((line) => line.text)).toEqual(content.split("\n"));
    expect(lines.every((line) => line.source === "openai")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/chat/completions");
  });

  it("openai mode with a key falls back to local lines plus a glitch notice when the API fails", async () => {
    setOpenAiKey("sk-test-123");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const lines = await getAngelSpeech(oracle, journal(""), null, "openai");

    expect(lines.length).toBeGreaterThan(2);
    const fallback = lines.find((line) => line.id === "openai-fallback");
    expect(fallback).toBeDefined();
    expect(fallback?.mood).toBe("glitch");
    expect(lines.some((line) => line.source === "journal")).toBe(true); // local lines survived
  });
});
