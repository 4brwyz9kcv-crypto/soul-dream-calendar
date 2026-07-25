import { Check, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { routeToUrl, type Route } from "../services/router";

/**
 * Teilt den gerade betrachteten Tag als Link.
 *
 * Auf dem Handy uebernimmt das System-Teilen-Blatt, sonst wandert die Adresse
 * in die Zwischenablage. Beides kann fehlschlagen (kein HTTPS, verweigerte
 * Berechtigung, abgebrochener Dialog) - dann erscheint die Adresse zum
 * Selbstkopieren, statt dass der Knopf wirkungslos bleibt.
 */
export function ShareDayButton({ route, title }: { route: Route; title: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    []
  );

  const flash = (next: "copied" | "manual") => {
    setState(next);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState("idle"), next === "copied" ? 2000 : 8000);
  };

  const share = async () => {
    const target = routeToUrl(route);
    setUrl(target);

    if (navigator.share) {
      try {
        await navigator.share({ title: `S.O.U.L - ${title}`, url: target });
        return;
      } catch (error) {
        // AbortError heisst: der Nutzer hat den Dialog bewusst geschlossen.
        // Dann ist Nichtstun die richtige Antwort, kein Ersatzweg.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(target);
      flash("copied");
    } catch {
      flash("manual");
    }
  };

  return (
    <div className="share-day">
      <button type="button" onClick={share} aria-label={`Link zu ${title} teilen`}>
        {state === "copied" ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
        <span>{state === "copied" ? "Kopiert" : "Teilen"}</span>
      </button>
      {state === "manual" && (
        <input
          className="share-day__manual"
          value={url}
          readOnly
          aria-label="Adresse zum Kopieren"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
