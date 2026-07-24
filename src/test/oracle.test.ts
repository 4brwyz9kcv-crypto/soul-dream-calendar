import { describe, expect, it } from "vitest";
import { getAngelSpeech } from "../services/angel";
import { getDayOracle } from "../services/oracle";

describe("oracle engine", () => {
  it("is deterministic for date, name and birth date", () => {
    const date = new Date(2025, 4, 24);
    expect(getDayOracle(date, "Lukas")).toEqual(getDayOracle(date, "Lukas"));
    expect(getDayOracle(date, "Lukas", "1994-02-11")).toEqual(getDayOracle(date, "Lukas", "1994-02-11"));
  });

  it("returns travel comparisons for all rides", () => {
    const oracle = getDayOracle(new Date(2025, 4, 24), "Lukas");
    expect(oracle.travel).toHaveLength(4);
    expect(oracle.travel.map((item) => item.ride.id)).toEqual(["lambo", "train", "bike", "ship"]);
  });

  it("generates angel speech without journal or mood", async () => {
    const oracle = getDayOracle(new Date(2025, 4, 24), "Lukas");
    const lines = await getAngelSpeech(
      oracle,
      { dayKey: oracle.key.iso, note: "", promptResponses: {}, updatedAt: "" },
      null,
      "local"
    );
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.some((line) => line.source === "journal")).toBe(true);
  });
});
