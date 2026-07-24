import type { AppView } from "../types";
import { toDayKey } from "./dates";

/**
 * Winziger Router ueber die Adresszeile - kein Framework, keine Abhaengigkeit.
 *
 * Vorher lebten Ansicht und gewaehlter Tag ausschliesslich im React-State.
 * Folge: der Zurueck-Knopf des Browsers verliess die App, ein Neuladen sprang
 * auf heute zurueck, und ein bestimmter Tag liess sich niemandem schicken.
 *
 * Bewusst Query-Parameter (`?v=oracle&d=2026-07-25`) statt Pfad-Segmenten: der
 * Pfad bleibt damit unveraendert, und GitHub Pages liefert beim Neuladen ohne
 * Umschreibregeln dieselbe index.html aus.
 */

export const APP_VIEWS: readonly AppView[] = ["calendar", "oracle", "journal", "review", "settings"];

export interface Route {
  view: AppView;
  /** Gewaehlter Tag als "yyyy-mm-dd". */
  iso: string;
}

export function isAppView(value: string | null): value is AppView {
  return value !== null && (APP_VIEWS as readonly string[]).includes(value);
}

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Akzeptiert nur echte Kalendertage. Die reine Musterpruefung liesse
 * "2026-02-31" durch, was danach als stiller Sprung in den Maerz auffiele.
 */
export function isValidIso(value: string | null): value is string {
  if (!value || !ISO_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

/**
 * Liest die aktuelle Adresse. Alles Unbekannte faellt still auf die
 * Standardansicht und den heutigen Tag zurueck - eine kaputte URL aus einem
 * Chat soll die App nicht in einen leeren Zustand schicken.
 */
export function readRoute(fallbackIso: string = toDayKey(new Date()).iso): Route {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("v");
  const iso = params.get("d");
  return {
    view: isAppView(view) ? view : "calendar",
    iso: isValidIso(iso) ? iso : fallbackIso
  };
}

/** Baut die teilbare Adresse zu einem Zustand (absolut, inklusive Herkunft). */
export function routeToUrl(route: Route): string {
  const url = new URL(window.location.href);
  url.search = `?v=${route.view}&d=${route.iso}`;
  url.hash = "";
  return url.toString();
}

/**
 * Schreibt den Zustand in die Adresszeile.
 *
 * `replace` ersetzt den aktuellen History-Eintrag, statt einen neuen anzulegen -
 * gedacht fuer den ersten Abgleich beim Start. Beim Blaettern durch Tage
 * entstehen dagegen echte Eintraege, damit "Zurueck" zum vorigen Tag fuehrt.
 */
export function writeRoute(route: Route, replace = false): void {
  const next = routeToUrl(route);
  if (next === window.location.href) return;
  if (replace) {
    window.history.replaceState(null, "", next);
  } else {
    window.history.pushState(null, "", next);
  }
}

/** Meldet Vor-/Zurueck-Navigation des Browsers. Liefert die Abmeldefunktion. */
export function onRouteChange(listener: (route: Route) => void): () => void {
  const handle = () => listener(readRoute());
  window.addEventListener("popstate", handle);
  return () => window.removeEventListener("popstate", handle);
}
