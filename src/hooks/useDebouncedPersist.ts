import { useEffect, useRef } from "react";

/**
 * Schreibt `value` erst dann weg, wenn `delayMs` lang nichts mehr passiert ist.
 *
 * Vorher hing jedes Speichern direkt an einem useEffect ohne Verzoegerung: ein
 * 400-Zeichen-Journal loeste 400 JSON.stringify-Laeufe und 400 localStorage-
 * Schreibvorgaenge aus. localStorage ist synchron - auf dem Handy ruckelt das
 * Tippen dadurch spuerbar.
 *
 * `key` ist der Tag, zu dem der Wert gehoert. Wechselt er, wird der noch
 * ausstehende Schreibvorgang fuer den *alten* Tag zuerst ausgefuehrt und der
 * frisch geladene Wert als Basis genommen - sonst wuerde schon das blosse
 * Ansehen eines Tages einen leeren Eintrag mit frischem updatedAt anlegen.
 */
export function useDebouncedPersist<T>(
  key: string,
  value: T,
  persist: (value: T) => void,
  delayMs = 500
): void {
  // Die Schreibfunktion wird ZUSAMMEN mit dem Wert gemerkt, nicht erst beim
  // Ausfuehren nachgeschlagen. Sonst schriebe ein beim Profilwechsel noch
  // ausstehender Journaleintrag in das gerade aktivierte Profil - fremde
  // Daten im fremden Journal.
  const pending = useRef<{ value: T; persist: (value: T) => void } | null>(null);
  const timer = useRef<number | null>(null);
  const baselineKey = useRef<string | null>(null);

  // Stabile Identitaet: liest ausschliesslich Refs, muss also nie neu erzeugt
  // werden und kann gefahrlos in Dependency-Arrays stehen.
  const flush = useRef(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const { value: pendingValue, persist: pendingPersist } = pending.current;
      pending.current = null;
      pendingPersist(pendingValue);
    }
  }).current;

  useEffect(() => {
    if (baselineKey.current !== key) {
      flush();
      baselineKey.current = key;
      return;
    }
    pending.current = { value, persist };
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delayMs);
  }, [key, value, delayMs, flush, persist]);

  useEffect(() => {
    // Tab schliessen, App wegwischen, Handy sperren: pagehide feuert dabei
    // zuverlaessig (auch auf iOS, wo unload uebersprungen wird), damit der
    // letzte getippte Satz nicht in der Verzoegerung verhungert.
    const handleHide = () => flush();
    window.addEventListener("pagehide", handleHide);
    document.addEventListener("visibilitychange", handleHide);
    return () => {
      window.removeEventListener("pagehide", handleHide);
      document.removeEventListener("visibilitychange", handleHide);
      flush();
    };
  }, [flush]);
}
