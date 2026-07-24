import { beforeEach, describe, expect, it } from "vitest";
import { exportAllData, importAllData, loadHourLog, saveHourLog } from "../services/storage";

describe("hour log export/import", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("roundtrips hour logs through export and import", () => {
    saveHourLog("2026-07-02", { 6: "Traum notiert", 20: "Orakel gelesen" });
    const exported = exportAllData();

    localStorage.clear();
    expect(loadHourLog("2026-07-02")).toEqual({});

    expect(importAllData(exported)).toBe(true);
    expect(loadHourLog("2026-07-02")).toEqual({ 6: "Traum notiert", 20: "Orakel gelesen" });
  });

  it("rejects exports with invalid hour day keys without writing", () => {
    saveHourLog("2026-07-02", { 8: "bleibt" });
    const payload = JSON.parse(exportAllData()) as Record<string, unknown>;
    payload.hours = { "nicht-ein-datum": { 3: "kaputt" } };

    expect(importAllData(JSON.stringify(payload))).toBe(false);
    expect(loadHourLog("2026-07-02")).toEqual({ 8: "bleibt" });
  });

  it("still imports legacy exports without an hours field", () => {
    const payload = JSON.parse(exportAllData()) as Record<string, unknown>;
    delete payload.hours;

    expect(importAllData(JSON.stringify(payload))).toBe(true);
  });
});
