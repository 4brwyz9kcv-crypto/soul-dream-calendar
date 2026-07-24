import { beforeEach, describe, expect, it } from "vitest";
import {
  createProfile,
  DEFAULT_PROFILE_ID,
  deleteProfile,
  getActiveProfileId,
  listProfiles,
  loadJournalEntry,
  loadSettings,
  renameProfile,
  saveJournalEntry,
  saveSettings,
  setActiveProfileId,
  defaultSettings
} from "../services/storage";

describe("Profile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("startet mit genau einem Standardprofil", () => {
    expect(listProfiles()).toHaveLength(1);
    expect(getActiveProfileId()).toBe(DEFAULT_PROFILE_ID);
  });

  it("laesst die Daten des Standardprofils unter den alten Schluesseln liegen", () => {
    // Entscheidend fuer bestehende Installationen: eine Migration gibt es nicht,
    // also muss der alte Schluesselname weiter der richtige sein.
    saveJournalEntry({ dayKey: "2026-07-25", note: "alt", promptResponses: {}, updatedAt: "" });
    expect(localStorage.getItem("sdc.journal.2026-07-25")).not.toBeNull();
  });

  it("trennt Journal und Einstellungen zwischen Profilen", () => {
    saveJournalEntry({ dayKey: "2026-07-25", note: "Remys Traum", promptResponses: {}, updatedAt: "" });
    saveSettings({ ...defaultSettings, name: "Remy" });

    const zweites = createProfile("Gast");
    setActiveProfileId(zweites.id);

    expect(loadJournalEntry("2026-07-25").note).toBe("");
    expect(loadSettings().name).toBe("");

    saveJournalEntry({ dayKey: "2026-07-25", note: "Gasttraum", promptResponses: {}, updatedAt: "" });
    saveSettings({ ...defaultSettings, name: "Gast" });
    expect(loadJournalEntry("2026-07-25").note).toBe("Gasttraum");

    setActiveProfileId(DEFAULT_PROFILE_ID);
    expect(loadJournalEntry("2026-07-25").note).toBe("Remys Traum");
    expect(loadSettings().name).toBe("Remy");
  });

  it("loescht ein Profil samt seiner Eintraege und kehrt zum Standard zurueck", () => {
    const gast = createProfile("Gast");
    setActiveProfileId(gast.id);
    saveJournalEntry({ dayKey: "2026-07-25", note: "verschwindet", promptResponses: {}, updatedAt: "" });
    expect(Object.keys(localStorage).some((key) => key.startsWith(`sdc.p.${gast.id}.`))).toBe(true);

    expect(deleteProfile(gast.id)).toBe(true);
    expect(Object.keys(localStorage).some((key) => key.startsWith(`sdc.p.${gast.id}.`))).toBe(false);
    expect(getActiveProfileId()).toBe(DEFAULT_PROFILE_ID);
    expect(listProfiles()).toHaveLength(1);
  });

  it("schuetzt das Standardprofil vor dem Loeschen", () => {
    expect(deleteProfile(DEFAULT_PROFILE_ID)).toBe(false);
    expect(listProfiles().some((profile) => profile.id === DEFAULT_PROFILE_ID)).toBe(true);
  });

  it("faellt auf den Standard zurueck, wenn das aktive Profil verschwunden ist", () => {
    // Etwa nach einem Import von einem anderen Geraet - ohne diesen Schutz
    // saehe der Nutzer eine leere App ohne erkennbaren Grund.
    localStorage.setItem("sdc.profile.active", "gibtesnicht");
    expect(getActiveProfileId()).toBe(DEFAULT_PROFILE_ID);
  });

  it("benennt um, ohne die Daten anzufassen", () => {
    const gast = createProfile("Gast");
    setActiveProfileId(gast.id);
    saveJournalEntry({ dayKey: "2026-07-25", note: "bleibt", promptResponses: {}, updatedAt: "" });

    renameProfile(gast.id, "Besuch");
    expect(listProfiles().find((profile) => profile.id === gast.id)?.name).toBe("Besuch");
    expect(loadJournalEntry("2026-07-25").note).toBe("bleibt");
  });

  it("uebersteht eine beschaedigte Profilliste", () => {
    localStorage.setItem("sdc.profiles", "{kaputt");
    expect(listProfiles()).toEqual([expect.objectContaining({ id: DEFAULT_PROFILE_ID })]);
  });
});
