import {
  Download,
  Gamepad2,
  KeyRound,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload
} from "lucide-react";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { UserSettings } from "../types";
import { PlacePicker } from "./PlacePicker";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { angelAssets } from "../services/angel";
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
  /** Wechsel/Anlegen/Loeschen eines Profils laedt den gesamten Zustand neu. */
  onProfileChange: () => void;
}

type KeyStatus = "idle" | "testing" | "ok" | "fail";
type ImportStatus = "idle" | "ok" | "fail";

export function SettingsPanel({ settings, onSettingsChange, onProfileChange }: SettingsPanelProps) {
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [hasKey, setHasKey] = useState(() => getOpenAiKey() !== null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <PlacePicker
            value={settings.birthPlace}
            onChange={(birthPlace) => onSettingsChange({ ...settings, birthPlace })}
          />
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

        <label className="toggle-card">
          <input
            type="checkbox"
            checked={settings.showPokemon}
            onChange={(event) => onSettingsChange({ ...settings, showPokemon: event.target.checked })}
          />
          <span><Gamepad2 size={16} /> Pokémon des Tages zeigen</span>
          <small className="setting-hint">
            Die Sprites stammen aus der PokeAPI und sind Material von Nintendo/Game Freak. Fuer den
            privaten Gebrauch unproblematisch — vor einer kommerziellen Veroeffentlichung besser aus.
          </small>
        </label>
      </div>

      <ProfileSwitcher onProfileChange={onProfileChange} />

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

      <article className="connect-panel privacy-panel">
        <header>
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <h3>Datenschutz</h3>
            <p>Was diese App speichert, sendet — und was nicht.</p>
          </div>
        </header>

        <dl className="privacy-list">
          <dt>Wo liegen deine Daten?</dt>
          <dd>
            Ausschließlich im Speicher dieses Browsers auf diesem Gerät. Es gibt keinen Server,
            kein Konto und keine Synchronisierung. Löschst du die Browserdaten, sind sie weg —
            deshalb der Export.
          </dd>

          <dt>Wer bekommt sie zu sehen?</dt>
          <dd>
            Niemand. Es gibt weder Analyse noch Tracking, weder Cookies noch Werbe-IDs, und keine
            Fehlerberichte werden verschickt.
          </dd>

          <dt>Welche Server werden überhaupt kontaktiert?</dt>
          <dd>
            Nur für die Zusatzinhalte des Tages und nur mit dem <em>Datum</em> als Information:
            Wikipedia, Numbers API{settings.showPokemon ? ", PokéAPI" : ""} sowie Open-Meteo beim
            Suchen eines Geburtsorts. Deine Notizen sind dabei nie im Spiel. Ohne Netz
            funktioniert die App vollständig weiter.
          </dd>

          <dt>Und OpenAI?</dt>
          <dd>
            Nur wenn du oben selbst einen Schlüssel hinterlegst. Dann geht das Tagesorakel
            (Farbe, Zahlen, Stimmung) an api.openai.com — <strong>nicht</strong> dein Journal.
            Ohne Schlüssel wird dorthin nichts gesendet.
          </dd>
        </dl>

        <p className="privacy-note">
          Rechtliches und die Lizenzen aller fremden Bestandteile stehen im Repository in
          LICENSE und THIRD-PARTY-NOTICES.md.
        </p>
      </article>
    </section>
  );
}
