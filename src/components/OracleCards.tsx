import { CircuitBoard, Moon, Sparkles, Sun } from "lucide-react";
import type { DayOracle } from "../types";

/**
 * Center zone of the "Kalender Detail Ansicht": the big procedural day image
 * (the legacy DeepDream plate) plus the deterministic number signal and the
 * sun/moon travel table docked underneath. The former card grid moved into
 * the three-zone layout — the right-rail items live in SoulDetail, the hourly
 * logger in HourLogger.
 */

interface OracleCardsProps {
  oracle: DayOracle;
  dreamImage: string;
}

export function OracleCards({ oracle, dreamImage }: OracleCardsProps) {
  return (
    <>
      <article className="ritual-card image-card">
        <header>
          <Sparkles size={16} aria-hidden="true" /> Tagesbild
        </header>
        <div className="dream-plate">
          <img
            src={dreamImage}
            alt={`Prozedurales Traum-Sigil des Tages in ${oracle.color.name}`}
            loading="lazy"
          />
        </div>
        <small>Traum-Sigil · lokal erzeugt · {oracle.color.name}</small>
      </article>

      <article className="ritual-card numbers-card">
        <header>
          <CircuitBoard size={16} aria-hidden="true" /> Zahlen des Tages
        </header>
        <strong>{oracle.numberSignal.split("·")[0]}</strong>
        <p>{oracle.numberSignal.split("·")[1]?.trim()}</p>
      </article>

      <article className="ritual-card travel-card">
        <header>
          <Sun size={16} aria-hidden="true" /> Reise zur Sonne <Moon size={16} aria-hidden="true" /> Reise
          zum Mond
        </header>
        {/* Auto im Weltall: purely decorative starfield with the four rides
            gliding toward the sun on their own PCB orbit lanes. Loop times
            mirror the relative speeds (Rakete > Lambo > Zug > Fahrrad). */}
        <div className="space-scene" aria-hidden="true">
          <div className="space-stars space-stars--far" />
          <div className="space-stars space-stars--near" />
          <span className="space-moon" />
          <span className="space-sun" />
          {oracle.travel.map((item) => (
            <div className={`orbit-lane orbit-lane--${item.ride.id}`} key={item.ride.id}>
              <span className="orbit-glider">
                <span className="orbit-glider__icon">{item.ride.glyph}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="travel-head" aria-hidden="true">
          <span>Gefährt</span>
          <b>Sonne</b>
          <b>Mond</b>
        </div>
        {oracle.travel.map((item) => (
          <div className="travel-row" key={item.ride.id}>
            <span>
              {item.ride.glyph} {item.ride.label}
            </span>
            <b>{item.sunLabel}</b>
            <b>{item.moonLabel}</b>
          </div>
        ))}
      </article>
    </>
  );
}
