import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allKeys,
  getStorageIssue,
  onStorageIssue,
  readKey,
  removeKey,
  resetStorageIssue,
  writeKey,
  type StorageIssue
} from "../services/safeStorage";

/**
 * Die Faelle hier sind genau die, die eine local-first App unbemerkt Daten
 * kosten: voller Speicher und gar kein Speicher. Beide sind im Browser schwer
 * herbeizufuehren, deshalb wird localStorage gezielt manipuliert.
 */

function quotaError(): DOMException {
  return new DOMException("quota", "QuotaExceededError");
}

describe("safeStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStorageIssue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetStorageIssue();
  });

  it("liest und schreibt normal, solange localStorage funktioniert", () => {
    expect(writeKey("sdc.test", "wert")).toBe(true);
    expect(readKey("sdc.test")).toBe("wert");
    expect(allKeys()).toContain("sdc.test");
    removeKey("sdc.test");
    expect(readKey("sdc.test")).toBeNull();
    expect(getStorageIssue()).toBeNull();
  });

  it("meldet einen vollen Speicher, statt den Fehler zu schlucken", () => {
    const seen: Array<StorageIssue | null> = [];
    const unsubscribe = onStorageIssue((issue) => seen.push(issue));
    // Der Listener wird sofort mit dem Ausgangszustand aufgerufen.
    expect(seen).toEqual([null]);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError();
    });

    expect(writeKey("sdc.test", "zu gross")).toBe(false);
    expect(getStorageIssue()?.kind).toBe("quota");
    expect(seen.at(-1)?.kind).toBe("quota");
    unsubscribe();
  });

  it("nimmt die Warnung zurueck, sobald wieder geschrieben werden kann", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError();
    });
    expect(writeKey("sdc.test", "a")).toBe(false);
    expect(getStorageIssue()?.kind).toBe("quota");

    setItem.mockRestore();
    expect(writeKey("sdc.test", "b")).toBe(true);
    expect(getStorageIssue()).toBeNull();
  });

  it("weicht auf den Arbeitsspeicher aus, wenn localStorage komplett fehlt", () => {
    // Safari im privaten Modus wirft schon beim Schreiben der Probe.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("verboten", "SecurityError");
    });
    resetStorageIssue();

    // Kein Absturz, und die Sitzung bleibt benutzbar - nur eben fluechtig.
    expect(writeKey("sdc.test", "fluechtig")).toBe(false);
    expect(readKey("sdc.test")).toBe("fluechtig");
    expect(allKeys()).toContain("sdc.test");
    expect(getStorageIssue()?.kind).toBe("unavailable");

    removeKey("sdc.test");
    expect(readKey("sdc.test")).toBeNull();
  });

  it("liefert einen stabilen Schluessel-Snapshot", () => {
    writeKey("sdc.a", "1");
    writeKey("sdc.b", "2");
    const keys = allKeys();
    // Waehrend ueber den Snapshot iteriert wird, darf Loeschen die restlichen
    // Eintraege nicht verschieben - genau daran krankte die Index-Schleife.
    for (const key of keys) removeKey(key);
    expect(allKeys()).toEqual([]);
  });
});
