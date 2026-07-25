import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Die Systemeinstellung "Bewegung reduzieren".
 *
 * Das Stylesheet beachtet sie laengst, die Ladeentscheidung fuer die
 * Engel-Animation bisher nicht: wer sie systemweit abgeschaltet hat, bekam
 * trotzdem 1,6 MB Animation ueber die Leitung, die er nie zu sehen bekommt.
 *
 * Der Wert wird live nachgefuehrt - die Einstellung laesst sich waehrend der
 * Sitzung umstellen (in Windows und macOS ein Schalter im Systemmenue).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    // matchMedia fehlt in aelteren Testumgebungen; dort gilt "keine Praeferenz".
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(QUERY);
    const update = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}
