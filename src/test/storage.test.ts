import { beforeEach, describe, expect, it } from "vitest";
import {
  clearOpenAiKey,
  defaultSettings,
  exportAllData,
  getOpenAiKey,
  importAllData,
  listJournalDayKeys,
  loadJournalEntry,
  loadMoodEntry,
  loadSettings,
  saveJournalEntry,
  saveMoodEntry,
  saveSettings,
  setOpenAiKey
} from "../services/storage";
import type { JournalEntry, MoodEntry, UserSettings } from "../types";

const DAY = "2025-05-24";

function makeJournal(overrides?: Partial<JournalEntry>): JournalEntry {
  return {
    dayKey: DAY,
    note: "Traum von Leiterbahnen und Nebel.",
    promptResponses: { symbol: "Auge" },
    updatedAt: "",
    ...overrides
  };
}

function makeMood(overrides?: Partial<MoodEntry>): MoodEntry {
  return { dayKey: DAY, emoji: "🌙", label: "Ruhig", score: 4, updatedAt: "", ...overrides };
}

describe("storage service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("roundtrips settings through save and load", () => {
    const settings: UserSettings = {
      name: "Testname",
      providerMode: "openai",
      angelMuted: true,
      angelPinned: false,
      reduceMotion: true,
      selectedAngelId: "terminal"
    };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("roundtrips a journal entry and stamps a fresh updatedAt", () => {
    const entry = makeJournal();
    saveJournalEntry(entry);
    const loaded = loadJournalEntry(DAY);
    expect(loaded.dayKey).toBe(DAY);
    expect(loaded.note).toBe(entry.note);
    expect(loaded.promptResponses).toEqual(entry.promptResponses);
    expect(new Date(loaded.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it("roundtrips a mood entry", () => {
    saveMoodEntry(makeMood());
    const loaded = loadMoodEntry(DAY);
    expect(loaded).not.toBeNull();
    expect(loaded?.label).toBe("Ruhig");
    expect(loaded?.emoji).toBe("🌙");
    expect(loaded?.score).toBe(4);
  });

  it("returns safe defaults for missing or corrupted data without throwing", () => {
    localStorage.setItem("sdc.settings", "{definitely not json");
    localStorage.setItem("sdc.journal." + DAY, "%%% corrupted %%%");
    localStorage.setItem("sdc.mood." + DAY, "{broken");

    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toEqual(defaultSettings);

    const journal = loadJournalEntry(DAY);
    expect(journal.dayKey).toBe(DAY);
    expect(journal.note).toBe("");
    expect(journal.promptResponses).toEqual({});

    expect(loadMoodEntry(DAY)).toBeNull();
    expect(loadMoodEntry("2099-01-01")).toBeNull();
  });

  it("sets, trims, gets and clears the OpenAI key", () => {
    expect(getOpenAiKey()).toBeNull();
    setOpenAiKey("  sk-test-123  ");
    expect(getOpenAiKey()).toBe("sk-test-123");
    clearOpenAiKey();
    expect(getOpenAiKey()).toBeNull();
    // whitespace-only keys are treated as absent
    setOpenAiKey("   ");
    expect(getOpenAiKey()).toBeNull();
  });

  it("exports journal and moods but never the OpenAI key", () => {
    setOpenAiKey("sk-super-secret-999");
    saveJournalEntry(makeJournal());
    saveMoodEntry(makeMood());

    const exported = exportAllData();
    expect(exported).not.toContain("sk-super-secret-999");
    expect(exported.toLowerCase()).not.toContain("openai");

    const payload = JSON.parse(exported) as {
      app: string;
      version: number;
      settings: UserSettings;
      journal: Record<string, JournalEntry>;
      moods: Record<string, MoodEntry>;
    };
    expect(payload.app).toBe("soul-dream-calendar");
    expect(payload.settings).toEqual(loadSettings());
    expect(payload.journal[DAY]?.note).toBe("Traum von Leiterbahnen und Nebel.");
    expect(payload.moods[DAY]?.label).toBe("Ruhig");
  });

  it("restores an export via importAllData", () => {
    saveSettings({ ...defaultSettings, name: "Exportname", providerMode: "openai" });
    saveJournalEntry(makeJournal());
    saveMoodEntry(makeMood());
    const exported = exportAllData();

    localStorage.clear();
    expect(importAllData(exported)).toBe(true);

    expect(loadSettings().name).toBe("Exportname");
    expect(loadSettings().providerMode).toBe("openai");
    expect(loadJournalEntry(DAY).note).toBe("Traum von Leiterbahnen und Nebel.");
    expect(loadMoodEntry(DAY)?.label).toBe("Ruhig");
  });

  it("rejects garbage imports and leaves existing data intact", () => {
    saveSettings({ ...defaultSettings, name: "Keeper" });
    saveJournalEntry(makeJournal({ note: "original" }));

    expect(importAllData("not json at all")).toBe(false);
    expect(importAllData("false")).toBe(false);
    expect(importAllData(JSON.stringify({ app: "some-other-app", settings: {} }))).toBe(false);
    expect(importAllData(JSON.stringify({ app: "soul-dream-calendar" }))).toBe(false);
    // invalid day key in the journal map must abort before anything is written
    expect(
      importAllData(
        JSON.stringify({
          app: "soul-dream-calendar",
          settings: { name: "Intruder" },
          journal: { "not-a-day": { note: "evil" } }
        })
      )
    ).toBe(false);

    expect(loadSettings().name).toBe("Keeper");
    expect(loadJournalEntry(DAY).note).toBe("original");
  });

  it("lists only journal days that have real content", () => {
    saveJournalEntry(makeJournal({ dayKey: "2025-01-01", note: "hat Inhalt", promptResponses: {} }));
    saveJournalEntry(makeJournal({ dayKey: "2025-01-02", note: "", promptResponses: {} }));
    saveJournalEntry(makeJournal({ dayKey: "2025-01-03", note: "   ", promptResponses: { p: "  " } }));
    saveJournalEntry(makeJournal({ dayKey: "2025-01-04", note: "", promptResponses: { p: "Antwort" } }));
    localStorage.setItem("sdc.journal.2025-01-05", "{corrupted");
    localStorage.setItem("sdc.mood.2025-01-06", JSON.stringify(makeMood({ dayKey: "2025-01-06" })));

    expect(listJournalDayKeys().sort()).toEqual(["2025-01-01", "2025-01-04"]);
  });
});
