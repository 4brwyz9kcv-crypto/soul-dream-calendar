import { ArrowRight, CircuitBoard, Clock, MapPin, ShieldCheck, SkipForward } from "lucide-react";
import { useState } from "react";
import { PlacePicker } from "./PlacePicker";
import type { UserSettings } from "../types";

/**
 * Erster Start.
 *
 * Vorher hiess jeder neue Nutzer "Lukas" - der Name stand als Vorgabe im Code.
 * Statt eines Formulars fuehrt der Dialog in drei Schritten durch das, was das
 * Orakel wirklich schaerfer macht, und sagt bei jedem Schritt dazu, was er
 * freischaltet. Alles ausser dem Namen ist ueberspringbar: die App muss auch
 * ohne persoenliche Daten vollstaendig funktionieren.
 */

interface OnboardingProps {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
  onDone: (settings: UserSettings) => void;
}

const STEPS = 3;

export function Onboarding({ settings, onChange, onDone }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const finish = () => onDone({ ...settings, onboarded: true });
  const next = () => (step + 1 >= STEPS ? finish() : setStep(step + 1));

  const nameReady = settings.name.trim().length > 0;

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <header>
          <CircuitBoard size={26} aria-hidden="true" />
          <div>
            <span>S.O.U.L</span>
            <h1 id="onboarding-title">
              {step === 0 && "Wie soll der Cogitator dich nennen?"}
              {step === 1 && "Wann hat dein Signal begonnen?"}
              {step === 2 && "Wo wurde es empfangen?"}
            </h1>
          </div>
        </header>

        {step === 0 && (
          <div className="onboarding-body">
            <p>
              Dein Name geht in den Startwert deines Tagesorakels ein — Farbe, Zahlen und Engel
              fallen damit fuer dich anders aus als fuer jeden anderen.
            </p>
            <label className="setting-card">
              <span>Dein Name</span>
              <input
                value={settings.name}
                onChange={(event) => onChange({ ...settings, name: event.target.value })}
                placeholder="z. B. Remy"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && nameReady) next();
                }}
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-body">
            <p>
              Das Geburtsdatum schaltet die vollstaendige Numerologie und das Horoskop frei. Mit
              der Uhrzeit kommt dein Mondzeichen dazu.
            </p>
            <div className="onboarding-pair">
              <label className="setting-card">
                <span>Geburtsdatum</span>
                <input
                  type="date"
                  value={settings.birthDate ?? ""}
                  onChange={(event) =>
                    onChange({ ...settings, birthDate: event.target.value || undefined })
                  }
                />
              </label>
              <label className="setting-card">
                <span>
                  <Clock size={13} aria-hidden="true" /> Geburtszeit
                </span>
                <input
                  type="time"
                  value={settings.birthTime ?? ""}
                  onChange={(event) =>
                    onChange({ ...settings, birthTime: event.target.value || undefined })
                  }
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-body">
            <p>
              Geburtsort und -zeit zusammen ergeben deinen Aszendenten — dafuer rechnet der
              Cogitator den Himmel deiner Geburtsminute nach.
            </p>
            <div className="setting-card geo-card">
              <span>
                <MapPin size={13} aria-hidden="true" /> Geburtsort
              </span>
              <PlacePicker
                value={settings.birthPlace}
                onChange={(birthPlace) => onChange({ ...settings, birthPlace })}
                listId="onboarding-geo-list"
              />
            </div>
          </div>
        )}

        <p className="onboarding-privacy">
          <ShieldCheck size={14} aria-hidden="true" />
          Alles bleibt auf diesem Geraet. Es gibt keinen Server, kein Konto und keine Uebertragung.
        </p>

        <footer>
          <div className="onboarding-dots" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, index) => (
              <span key={index} className={index === step ? "is-active" : ""} />
            ))}
          </div>
          <div className="onboarding-actions">
            <button type="button" className="is-ghost" onClick={finish}>
              <SkipForward size={15} aria-hidden="true" />
              {step === 0 ? "Ueberspringen" : "Fertig"}
            </button>
            <button type="button" className="is-primary" onClick={next} disabled={step === 0 && !nameReady}>
              {step + 1 >= STEPS ? "Los geht's" : "Weiter"}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
