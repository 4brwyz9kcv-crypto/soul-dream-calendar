import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Meldet eine bereitstehende neue Version.
 *
 * Der Service Worker uebernimmt bewusst nicht mehr von selbst (kein
 * skipWaiting beim Install): waehrend jemand tippt, unter der laufenden Seite
 * die Assets zu tauschen, ist der schnellste Weg zu einem kaputten Zustand.
 * Stattdessen wartet die neue Fassung, bis hier zugestimmt wird.
 */
export function UpdateNotice() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration || cancelled) return;

      // Beim Laden koennte schon eine Fassung warten (Tab war lange offen).
      if (registration.waiting) setWaiting(registration.waiting);

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // "installed" bei vorhandenem controller heisst: es gab schon eine
          // Version, das hier ist ein Update - nicht die Erstinstallation.
          if (installing.state === "installed" && navigator.serviceWorker.controller && !cancelled) {
            setWaiting(installing);
          }
        });
      });
    });

    // Sobald die neue Fassung uebernommen hat, einmal neu laden. `once`,
    // damit ein spaeterer Wechsel keine Schleife ausloest.
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="update-notice" role="status">
      <Sparkles size={16} aria-hidden="true" />
      <span>Eine neue Version steht bereit.</span>
      <button type="button" onClick={() => waiting.postMessage("sdc-skip-waiting")}>
        <RefreshCw size={14} aria-hidden="true" />
        Jetzt laden
      </button>
    </div>
  );
}
