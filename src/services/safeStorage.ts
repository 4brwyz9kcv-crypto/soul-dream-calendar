/**
 * Duenne, unkaputtbare Huelle um localStorage.
 *
 * Zwei Faelle killen eine local-first App, wenn man sie nicht behandelt:
 *
 * 1. localStorage ist ueberhaupt nicht da - Safari im privaten Modus, ein
 *    eingebetteter iframe, abgeschaltete Cookies. Jeder Zugriff wirft dann,
 *    und weil `loadSettings()` schon im useState-Initializer laeuft, waere
 *    das eine weisse Seite direkt beim Start.
 * 2. Der Speicher laeuft voll (`QuotaExceededError`). Vorher hat die App das
 *    stillschweigend geschluckt - der Nutzer tippt weiter und merkt erst
 *    Tage spaeter, dass nichts mehr ankommt.
 *
 * Fall 1 faellt auf eine In-Memory-Map zurueck: die Sitzung funktioniert
 * vollstaendig, nur ohne Persistenz. Fall 2 meldet sich ueber `onStorageIssue`
 * an die UI, statt Daten lautlos zu verlieren.
 */

export type StorageIssueKind =
  /** Schreiben schlug fehl, weil der Speicher voll ist. */
  | "quota"
  /** localStorage existiert nicht - alles laeuft nur im Arbeitsspeicher. */
  | "unavailable";

export interface StorageIssue {
  kind: StorageIssueKind;
  /** ISO-Zeitpunkt des letzten Vorfalls. */
  at: string;
}

type IssueListener = (issue: StorageIssue | null) => void;

const listeners = new Set<IssueListener>();
let currentIssue: StorageIssue | null = null;

/** In-Memory-Ersatz, wenn localStorage nicht verfuegbar ist. */
const memory = new Map<string, string>();

/** null = noch nicht geprueft. Einmal ermittelt, dann gecached. */
let available: boolean | null = null;

/** Safari meldet Quota-Fehler unter abweichendem Namen und Code. */
function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22)
  );
}

function detectAvailability(): boolean {
  if (available !== null) return available;
  try {
    const probe = "sdc.__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    available = true;
  } catch (error) {
    // Ein voller Speicher ist NICHT dasselbe wie kein Speicher: Lesen
    // funktioniert weiterhin. Wuerde die Probe hier auf den fluechtigen
    // Arbeitsspeicher umschalten, saehe der Nutzer sein komplettes Journal
    // als leer - schlimmer als der Fehler, den diese Datei verhindern soll.
    available = true;
    if (isQuotaError(error)) {
      setIssue("quota");
    } else {
      available = false;
      setIssue("unavailable");
    }
  }
  return available;
}

function setIssue(kind: StorageIssueKind | null): void {
  if (kind === (currentIssue?.kind ?? null)) return;
  currentIssue = kind ? { kind, at: new Date().toISOString() } : null;
  for (const listener of listeners) listener(currentIssue);
}

/**
 * Abonniert Speicherprobleme. Ruft den Listener sofort mit dem aktuellen
 * Zustand auf und liefert die Abmeldefunktion zurueck.
 */
export function onStorageIssue(listener: IssueListener): () => void {
  listeners.add(listener);
  listener(currentIssue);
  return () => {
    listeners.delete(listener);
  };
}

export function getStorageIssue(): StorageIssue | null {
  return currentIssue;
}

/** Nur fuer Tests: setzt Erkennung und gemeldetes Problem zurueck. */
export function resetStorageIssue(): void {
  available = null;
  memory.clear();
  setIssue(null);
}

export function readKey(key: string): string | null {
  if (!detectAvailability()) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Schreibt einen Wert. Liefert false, wenn der Speicher voll ist - der Aufrufer
 * kann das ignorieren, die UI erfaehrt es ohnehin ueber `onStorageIssue`.
 */
export function writeKey(key: string, value: string): boolean {
  if (!detectAvailability()) {
    memory.set(key, value);
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    // Ein erfolgreicher Schreibvorgang loescht eine fruehere Voll-Meldung:
    // der Nutzer hat offenbar aufgeraeumt oder exportiert.
    if (currentIssue?.kind === "quota") setIssue(null);
    return true;
  } catch (error) {
    setIssue(isQuotaError(error) ? "quota" : "unavailable");
    return false;
  }
}

export function removeKey(key: string): void {
  if (!detectAvailability()) {
    memory.delete(key);
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nichts zu tun - der Schluessel ist so oder so nicht mehr erreichbar */
  }
}

/**
 * Alle Schluessel als Snapshot. Bewusst ein Array statt eines Index-Zugriffs
 * im Schleifenkopf: waehrend `localStorage.length` iteriert wird, verschiebt
 * ein zwischenzeitliches remove die Indizes und Eintraege werden uebersprungen.
 */
export function allKeys(): string[] {
  if (!detectAvailability()) return [...memory.keys()];
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key !== null) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}
