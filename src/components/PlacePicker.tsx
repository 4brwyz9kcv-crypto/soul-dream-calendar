import { MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { searchPlaces, type GeoPlace } from "../services/geo";
import type { BirthPlace, LiveStatus } from "../types";

/**
 * Geburtsort-Suche mit Vorschlaegen von Open-Meteo und eingebauter
 * Offline-Liste als Rueckfall. Aus dem Einstellungs-Panel herausgeloest,
 * damit der Onboarding-Dialog exakt dieselbe Auswahl anbietet - ein zweiter
 * Nachbau waere sonst zwangslaeufig irgendwann auseinandergelaufen.
 */

type GeoUiStatus = "idle" | "searching" | LiveStatus;

const GEO_DEBOUNCE_MS = 400;

interface PlacePickerProps {
  value: BirthPlace | undefined;
  onChange: (place: BirthPlace | undefined) => void;
  /** Eindeutig pro Einbaustelle, damit aria-controls nicht doppelt vorkommt. */
  listId?: string;
}

export function PlacePicker({ value, onChange, listId = "geo-suggest-list" }: PlacePickerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [status, setStatus] = useState<GeoUiStatus>("idle");
  // Herkunft der Auswahl (Live-API oder eingebaute Liste) fuer die Diode.
  // Nur fuer diese Sitzung - nach dem Neuladen zeigt der Ort schlicht seine Daten.
  const [source, setSource] = useState<LiveStatus | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("searching");
    const timer = setTimeout(() => {
      searchPlaces(trimmed).then((result) => {
        if (cancelled) return;
        setSuggestions(result.places);
        setStatus(result.status);
      });
    }, GEO_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pick = (place: GeoPlace) => {
    setSource(status === "live" ? "live" : "offline");
    setQuery("");
    setSuggestions([]);
    setStatus("idle");
    onChange({ name: place.name, lat: place.lat, lon: place.lon, timezone: place.timezone });
  };

  if (value) {
    return (
      <div className="geo-resolved">
        <MapPin size={14} aria-hidden="true" />
        <div className="geo-resolved-meta">
          <strong>{value.name}</strong>
          <small>
            {value.lat.toFixed(2)}° / {value.lon.toFixed(2)}° · {value.timezone}
          </small>
        </div>
        {source && (
          <span className={`live-badge is-${source}`}>
            <span className="led-dot" aria-hidden="true" />
            <span className="visually-hidden">
              {source === "live" ? "Live-Quelle" : "Offline-Quelle"}
            </span>
          </span>
        )}
        <button
          type="button"
          className="geo-clear"
          onClick={() => {
            setSource(null);
            onChange(undefined);
          }}
          aria-label="Geburtsort entfernen"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="geo-search">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Stadt suchen, z. B. Wien"
        autoComplete="off"
        aria-label="Geburtsort suchen"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
      />
      {status !== "idle" && (
        <span className={`live-badge is-${status === "searching" ? "loading" : status}`}>
          <span className="led-dot" aria-hidden="true" />
          <span className="visually-hidden">
            {status === "searching" ? "Suche läuft" : status === "live" ? "Live" : "Offline"}
          </span>
        </span>
      )}
      {suggestions.length > 0 && (
        <ul className="geo-suggest" id={listId}>
          {suggestions.map((place) => (
            <li key={`${place.name}:${place.lat}:${place.lon}`}>
              <button type="button" onClick={() => pick(place)}>
                <MapPin size={13} aria-hidden="true" />
                <span className="geo-suggest-label">{place.label}</span>
                <small>{place.timezone}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {status === "offline" && suggestions.length === 0 && (
        <small className="setting-hint">Keine Stadt gefunden — anders schreiben?</small>
      )}
    </div>
  );
}
