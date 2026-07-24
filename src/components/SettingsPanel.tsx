import {
  Download,
  KeyRound,
  MapPin,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { LiveStatus, UserSettings } from "../types";
import { angelAssets } from "../services/angel";
import { searchPlaces, type GeoPlace } from "../services/geo";
import { testOpenAiKey } from "../services/openai";
import {
  clearOpenAiKey,
  exportAllData,
  getOpenAiKey,
  importAllData,
  loadSettings,
  setOpenAiKey
} from "../services/storage";

interface SettingsPanelProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

type KeyStatus = "idle" | "testing" | "ok" | "fail";
type ImportStatus = "idle" | "ok" | "fail";
type GeoUiStatus = "idle" | "searching" | LiveStatus;

const GEO_DEBOUNCE_MS = 400;

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [hasKey, setHasKey] = useState(() => getOpenAiKey() !== null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Geburtsort search: debounced Open-Meteo suggestions with offline fallback.
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState<GeoPlace[]>([]);
  const [geoStatus, setGeoStatus] = useState<GeoUiStatus>("idle");
  // Source of the picked place (live API vs. built-in list) for the LED;
  // session-local — after a reload the stored place simply shows its data.
  const [placeSource, setPlaceSource] = useState<LiveStatus | null>(null);

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      setPlaceSuggestions([]);
      setGeoStatus("idle");
      return;
    }
    let cancelled = false;
    setGeoStatus("searching");
    const timer = setTimeout(() => {
      searchPlaces(query).then((result) => {
        if (cancelled) return;
        setPlaceSuggestions(result.places);
        setGeoStatus(result.status);
      });
    }, GEO_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placeQuery]);

  const pickPlace = (place: GeoPlace) => {
    setPlaceSource(geoStatus === "live" ? "live" : "offline");
    setPlaceQuery("");
    setPlaceSuggestions([]);
    setGeoStatus("idle");
    onSettingsChange({
      ...settings,
      birthPlace: { name: place.name, lat: place.lat, lon: place.lon, timezone: place.timezone }
    });
  };

  const clearPlace = () => {
    setPlaceSource(null);
    onSettingsChange({ ...settings, birthPlace: undefined });
  };

  const connectKey = async () => {
    if (!keyInput.trim() || keyStatus === "testing") return;
    setKeyStatus("testing");
    const valid = await testOpenAiKey(keyInput);
    if (valid) {
      setOpenAiKey(keyInput);
      setHasKey(true);
      setKeyInput("");
      setKeyStatus("ok");
      onSettingsChange({ ...settings, providerMode: "openai" });
    } else {
      setKeyStatus("fail");
    }
  };

  const removeKey = () => {
    clearOpenAiKey();
    setHasKey(false);
    setKeyStatus("idle");
    onSettingsChange({ ...settings, providerMode: "local" });
  };

  const downloadExport = () => {
    const blob = new Blob([exportAllData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "soul-dream-calendar-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    if (importAllData(text)) {
      setImportStatus("ok");
      onSettingsChange(loadSettings());
    } else {
      setImportStatus("fail");
    }
  };

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <SlidersHorizontal size={18} />
        <div>
          <h2>Einstellungen</h2>
          <p>Lokales Ritual zuerst — alles Weitere ist optional.</p>
        </div>
      </div>

      <div className="settings-grid">
        <label className="setting-card">
          <span>Dein Name</span>
          <input
            value={settings.name}
            onChange={(event) => onSettingsChange({ ...settings, name: event.target.value })}
          />
        </label>

        <label className="setting-card">
          <span>Geburtsdatum</span>
          <input
            type="date"
            value={settings.birthDate ?? ""}
            onChange={(event) => onSettingsChange({ ...settings, birthDate: event.target.value })}
          />
          <small className="setting-hint">
            Macht dein Tagesorakel einzigartig und schaltet das Horoskop frei.
          </small>
        </label>

        <label className="setting-card">
          <span>Geburtszeit</span>
          <input
            type="time"
            value={settings.birthTime ?? ""}
            onChange={(event) =>
              onSettingsChange({ ...settings, birthTime: event.target.value || undefined })
            }
          />
          <small className="setting-hint">
            Weckt dein Mondzeichen — zusammen mit dem Geburtsort auch den Aszendenten.
          </small>
        </label>

        <div className="setting-card geo-card">
          <span>Geburtsort</span>
          {settings.birthPlace ? (
            <div className="geo-resolved">
              <MapPin size={14} aria-hidden="true" />
              <div className="geo-resolved-meta">
                <strong>{settings.birthPlace.name}</strong>
                <small>
                  {settings.birthPlace.lat.toFixed(2)}° / {settings.birthPlace.lon.toFixed(2)}° ·{" "}
                  {settings.birthPlace.timezone}
                </small>
              </div>
              {placeSource && (
                <span className={`live-badge is-${placeSource}`} title={placeSource === "live" ? "Live-Quelle" : "Offline-Quelle"}>
                  <span className="led-dot" aria-hidden="true" />
                  <span className="visually-hidden">
                    {placeSource === "live" ? "Live-Quelle" : "Offline-Quelle"}
                  </span>
                </span>
              )}
              <button
                type="button"
                className="geo-clear"
                onClick={clearPlace}
                title="Geburtsort entfernen"
                aria-label="Geburtsort entfernen"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="geo-search">
              <input
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.target.value)}
                placeholder="Stadt suchen, z. B. Wien"
                autoComplete="off"
                aria-label="Geburtsort suchen"
                aria-expanded={placeSuggestions.length > 0}
                aria-controls="geo-suggest-list"
              />
              {geoStatus !== "idle" && (
                <span
                  className={`live-badge is-${geoStatus === "searching" ? "loading" : geoStatus}`}
                  title={
                    geoStatus === "searching"
                      ? "Suche läuft…"
                      : geoStatus === "live"
                        ? "Live-Quelle (Open-Meteo)"
                        : "Offline-Quelle (eingebaute Liste)"
                  }
                >
                  <span className="led-dot" aria-hidden="true" />
                  <span className="visually-hidden">
                    {geoStatus === "searching" ? "Suche läuft" : geoStatus === "live" ? "Live" : "Offline"}
                  </span>
                </span>
              )}
              {placeSuggestions.length > 0 && (
                <ul className="geo-suggest" id="geo-suggest-list">
                  {placeSuggestions.map((place) => (
                    <li key={`${place.name}:${place.lat}:${place.lon}`}>
                      <button type="button" onClick={() => pickPlace(place)}>
                        <MapPin size={13} aria-hidden="true" />
                        <span className="geo-suggest-label">{place.label}</span>
                        <small>{place.timezone}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {geoStatus === "offline" && placeSuggestions.length === 0 && (
                <small className="setting-hint">Keine Stadt gefunden — anders schreiben?</small>
              )}
            </div>
          )}
          <small className="setting-hint">
            Aszendent und Mondzeichen brauchen Geburtszeit und Geburtsort — erst dann kann der
            Cogitator den Himmel deiner Geburtsminute berechnen.
          </small>
        </div>

        <label className="setting-card">
          <span>Engel Auswahl</span>
          <select
            value={settings.selectedAngelId}
            onChange={(event) => onSettingsChange({ ...settings, selectedAngelId: event.target.value })}
          >
            {angelAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </label>

        <label className="toggle-card">
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(event) => onSettingsChange({ ...settings, reduceMotion: event.target.checked })}
          />
          <span><Moon size={16} /> Bewegung reduzieren</span>
        </label>

        <label className="toggle-card">
          <input
            type="checkbox"
            checked={settings.angelPinned}
            onChange={(event) => onSettingsChange({ ...settings, angelPinned: event.target.checked })}
          />
          <span><ShieldCheck size={16} /> Engel anheften</span>
        </label>
      </div>

      <article className="connect-panel">
        <header>
          <KeyRound size={20} />
          <div>
            <h3>OpenAI verbinden (eigener Schlüssel)</h3>
            <p>
              {hasKey
                ? `Verbunden — der Engel spricht im ${settings.providerMode === "openai" ? "OpenAI" : "lokalen"}-Modus.`
                : "Optional: eigener API-Schlüssel für persönliche Engelsbotschaften."}
            </p>
          </div>
        </header>

        {!hasKey && (
          <div className="key-row">
            <input
              type="password"
              value={keyInput}
              onChange={(event) => {
                setKeyInput(event.target.value);
                setKeyStatus("idle");
              }}
              placeholder="sk-..."
              autoComplete="off"
              aria-label="OpenAI API-Schlüssel"
            />
            <button type="button" onClick={connectKey} disabled={keyStatus === "testing" || !keyInput.trim()}>
              <KeyRound size={16} />
              {keyStatus === "testing" ? "Prüfe…" : "Testen & Verbinden"}
            </button>
          </div>
        )}

        {hasKey && (
          <button type="button" onClick={removeKey}>
            <Trash2 size={16} /> Schlüssel entfernen
          </button>
        )}

        {keyStatus === "ok" && <p className="key-status is-ok">✓ Schlüssel gültig — OpenAI-Modus aktiviert.</p>}
        {keyStatus === "fail" && <p className="key-status is-fail">✗ Schlüssel ungültig oder keine Verbindung.</p>}

        <p className="privacy-note">
          Der Schlüssel bleibt nur auf diesem Gerät (localStorage) und wird ausschließlich an api.openai.com
          gesendet. Kein Schlüssel wird mitgeliefert, exportiert oder an Dritte übertragen.
        </p>
      </article>

      <article className="connect-panel data-panel">
        <header>
          <Download size={20} />
          <div>
            <h3>Daten exportieren / importieren</h3>
            <p>Einstellungen, Notizen und Stimmungen als JSON — ohne API-Schlüssel.</p>
          </div>
        </header>
        <div className="data-actions">
          <button type="button" onClick={downloadExport}>
            <Download size={16} /> Export als JSON
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> Import aus JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            hidden
          />
        </div>
        {importStatus === "ok" && <p className="key-status is-ok">✓ Import erfolgreich — Daten übernommen.</p>}
        {importStatus === "fail" && <p className="key-status is-fail">✗ Import fehlgeschlagen — Datei ungültig.</p>}
      </article>
    </section>
  );
}
