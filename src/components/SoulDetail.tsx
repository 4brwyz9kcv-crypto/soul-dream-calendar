import {
  BookOpen,
  Car,
  Gem,
  Hash,
  MapPin,
  Moon,
  Newspaper,
  RefreshCw,
  Ruler,
  ScrollText,
  Sigma,
  Sparkles,
  Star,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { bigThree } from "../services/astrology";
import { fromIsoDate } from "../services/dates";
import { dailyHoroscope, lifePathMeaning, lifePathNumber, zodiacSign } from "../services/horoscope";
import { generateFakeNewsFromCache, getCachedWikiEvents } from "../services/live";
import {
  impulseNumberMeaning,
  isMasterNumber,
  placeNumber,
  placeNumberMeaning,
  timeImpulseNumber
} from "../services/numerology";
import { fallbackFacts, fallbackFakeNews, personalSeed } from "../services/oracle";
import type {
  BirthPlace,
  DayOracle,
  LiveDayData,
  LiveStatus,
  MoodEntry,
  NumerologyCategory
} from "../types";

/**
 * The right rail of the "Kalender Detail Ansicht" — the exact legacy S.O.U.L
 * stack, ported sentence by sentence, now grouped into two MMO-style tabs
 * ("◈ Orakel" / "⌬ Numerologie") so the console fits on one screen:
 *  Tab Orakel:
 *   1. Pokemon des Tages (+ sprite + types)
 *   2. Erde–Sonne-Abstand in Pokemon-Längen
 *   3. Lamborghini-Gallardo-Jahre zur Sonne
 *   4. Bibelvers            5. Fake Bibelvers
 *   6. Ereignisse + Markov-Fake-News
 *   7. Zahlen-Fakt (Quersumme)
 *   9. "Neue Fake News" / "Neue Facts" (deterministische Basis + Nonce)
 *  Tab Numerologie:
 *   8. Name + "Berechne deine Zahlen" -> 7 Kategorien als Stat-Sheet
 * Tab state is pure component state; both panels stay mounted (CSS toggles
 * visibility) so inputs and nonces survive tab switches.
 */

interface SoulDetailProps {
  oracle: DayOracle;
  live: LiveDayData | null;
  mood: MoodEntry | null;
  name: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: BirthPlace;
  reduceMotion: boolean;
  /** Aus: der Pokemon-Block entfaellt, und die PokeAPI wird gar nicht erst
   *  angefragt (siehe THIRD-PARTY-NOTICES.md). */
  showPokemon: boolean;
  onNameChange: (name: string) => void;
  onBirthDateChange: (birthDate: string) => void;
}

type RailTab = "orakel" | "numerologie" | "horoskop";

const deNumber = new Intl.NumberFormat("de-DE");

/**
 * True on devices with a real pointer that can hover (mouse/trackpad).
 * On touch screens `mouseenter` fires on tap and never "leaves", which
 * would fight the click toggle of the shiny sprite — so hover-to-preview
 * is desktop-only, matching the `@media (hover: hover)` CSS effects.
 */
const canHover =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(hover: hover)").matches
    : false;

/**
 * Real heights (decimetres) of the offline fallback Pokemon, so the
 * sun-distance sentence still works when PokeAPI is unreachable.
 */
const fallbackHeightsDm: Record<number, number> = {
  25: 4, // Pikachu
  133: 3, // Evoli
  94: 15, // Gengar
  150: 20, // Mewtu
  197: 10, // Nachtara
  282: 16, // Guardevoir
  479: 3, // Rotom
  778: 2 // Mimigma
};

const numerologyRows: Array<{ label: string; pick: (o: DayOracle) => NumerologyCategory | null }> = [
  { label: "Schicksal", pick: (o) => o.numerology.destiny },
  { label: "Persönlichkeit", pick: (o) => o.numerology.personality },
  { label: "Einstellung", pick: (o) => o.numerology.attitude },
  { label: "Charakter", pick: (o) => o.numerology.character },
  { label: "Seele", pick: (o) => o.numerology.soul },
  { label: "Agenda", pick: (o) => o.numerology.agenda },
  { label: "Bestimmung", pick: (o) => o.numerology.purpose }
];

/** Status LED (green=live, copper=offline, violet=lädt) with hidden text label. */
function LiveBadge({ status }: { status: LiveStatus | "loading" }) {
  const label = status === "live" ? "Live" : status === "offline" ? "Offline" : "Lädt…";
  return (
    <span className={`live-badge is-${status}`} title={label}>
      <span className="led-dot" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

function SkeletonLines({ widths }: { widths: number[] }) {
  return (
    <div className="skeleton-group" aria-hidden="true">
      {widths.map((width, index) => (
        <span key={index} className="skeleton-line" style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}

export function SoulDetail({
  oracle,
  live,
  mood,
  name,
  birthDate,
  birthTime,
  birthPlace,
  reduceMotion,
  showPokemon,
  onNameChange,
  onBirthDateChange
}: SoulDetailProps) {
  const [tab, setTab] = useState<RailTab>("orakel");
  const [showShiny, setShowShiny] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [fakeNonce, setFakeNonce] = useState(0);
  const [factNonce, setFactNonce] = useState(0);

  const iso = oracle.key.iso;
  useEffect(() => {
    setFakeNonce(0);
    setFactNonce(0);
  }, [iso]);

  const pokemon = live?.pokemon ?? null;
  const pokemonStatus: LiveStatus | "loading" = pokemon ? pokemon.status : "loading";
  const wikiStatus: LiveStatus | "loading" = live ? live.wiki.status : "loading";
  const numberStatus: LiveStatus | "loading" = live ? live.numberFact.status : "loading";
  const spriteUrl = pokemon
    ? showShiny
      ? pokemon.shinySpriteUrl ?? pokemon.spriteUrl
      : pokemon.spriteUrl
    : null;

  // 2) Earth-sun distance measured in stacked Pokemon of the day.
  const heightDm = pokemon ? pokemon.heightDm ?? fallbackHeightsDm[pokemon.id] ?? null : null;
  const pokemonUnits =
    heightDm != null && heightDm > 0
      ? Math.round((oracle.astro.sunDistanceKm * 1000) / (heightDm / 10))
      : null;

  // 3) Lamborghini Gallardo (325 km/h) years to the sun — the legacy fun fact.
  const lamboYears = oracle.astro.sunDistanceKm / 325 / 24 / 365.25;
  const lamboLabel = lamboYears.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  // 6+9) Deterministic base + nonce cycling over the cached wiki corpus.
  const cachedEvents = useMemo(() => getCachedWikiEvents(oracle), [oracle, live]);

  const factText = useMemo(() => {
    if (!live) return null;
    if (factNonce === 0) return live.wiki.fact;
    if (cachedEvents && cachedEvents.length > 0) {
      const picked = cachedEvents[(oracle.imageSeed + factNonce) % cachedEvents.length];
      return `${picked.year} – ${picked.text}`;
    }
    return fallbackFacts[(oracle.imageSeed + oracle.key.month + factNonce) % fallbackFacts.length];
  }, [live, factNonce, cachedEvents, oracle]);

  const fakeNewsText = useMemo(() => {
    if (!live) return null;
    if (fakeNonce === 0) return live.wiki.fakeNews;
    return (
      generateFakeNewsFromCache(oracle, fakeNonce) ??
      fallbackFakeNews[(oracle.imageSeed + oracle.key.day + fakeNonce) % fallbackFakeNews.length]
    );
  }, [live, fakeNonce, oracle]);

  const canCycleFacts = (cachedEvents?.length ?? fallbackFacts.length) > 1;
  const canCycleFakeNews = cachedEvents != null || fallbackFakeNews.length > 1;
  const factsDisabled = !live || !canCycleFacts;
  const fakeDisabled = !live || !canCycleFakeNews;
  const loadingTitle = "Live-Daten werden noch geladen";

  // Horoskop: Sternzeichen, Lebenszahl und Tagestext — deterministisch pro
  // Person (Name + Geburtsdatum, optional Geburtszeit/-ort) und Tag.
  const sign = useMemo(() => zodiacSign(birthDate), [birthDate]);
  const lifePath = useMemo(() => lifePathNumber(birthDate), [birthDate]);
  // Die großen Drei: Sonne aus den Almanach-Grenzen, Mond/Aszendent aus
  // echter Astronomie (astrology.ts), sobald Zeit/Ort gesetzt sind.
  const big3 = useMemo(
    () => bigThree(birthDate, birthTime, birthPlace),
    [birthDate, birthTime, birthPlace]
  );
  const horoscope = useMemo(
    () =>
      sign
        ? dailyHoroscope(
            sign,
            fromIsoDate(iso),
            personalSeed(name, birthDate, birthTime, birthPlace?.name),
            big3.ascendant ?? undefined
          )
        : null,
    [sign, iso, name, birthDate, birthTime, birthPlace, big3.ascendant]
  );

  // S.O.U.L-Erweiterungen der Numerologie: Ortszahl + Impulszahl.
  const ortszahl = useMemo(
    () => (birthPlace ? placeNumber(birthPlace.name) : null),
    [birthPlace]
  );
  const impulszahl = useMemo(() => timeImpulseNumber(birthTime), [birthTime]);

  return (
    <section className="soul-rail" aria-label="Orakel des Tages">
      <div className="soul-tabs" role="tablist" aria-label="Orakel Konsole">
        <button
          type="button"
          role="tab"
          id="soul-tab-orakel"
          aria-selected={tab === "orakel"}
          aria-controls="soul-panel-orakel"
          className={tab === "orakel" ? "is-active" : ""}
          onClick={() => setTab("orakel")}
        >
          <span className="soul-tab-glyph" aria-hidden="true">◈</span> Orakel
        </button>
        <button
          type="button"
          role="tab"
          id="soul-tab-numerologie"
          aria-selected={tab === "numerologie"}
          aria-controls="soul-panel-numerologie"
          className={tab === "numerologie" ? "is-active" : ""}
          onClick={() => setTab("numerologie")}
        >
          <span className="soul-tab-glyph" aria-hidden="true">⌬</span> Numerologie
        </button>
        <button
          type="button"
          role="tab"
          id="soul-tab-horoskop"
          aria-selected={tab === "horoskop"}
          aria-controls="soul-panel-horoskop"
          className={tab === "horoskop" ? "is-active" : ""}
          onClick={() => setTab("horoskop")}
        >
          <span className="soul-tab-glyph" aria-hidden="true">✦</span> Horoskop
        </button>
      </div>

      <div
        className={`soul-tab-panel${tab === "orakel" ? " is-active" : ""}`}
        role="tabpanel"
        id="soul-panel-orakel"
        aria-labelledby="soul-tab-orakel"
      >
        {/* 1 · Pokemon des Tages — entfaellt vollstaendig, wenn abgeschaltet */}
        {showPokemon && (
        <article className="trace-row" aria-busy={!pokemon}>
          <header>
            <Zap size={15} aria-hidden="true" /> Pokemon des Tages
            <LiveBadge status={pokemonStatus} />
          </header>
          {pokemon ? (
            <>
              <p className="trace-sentence">
                Das Pokemon des Tages ist: <strong>{pokemon.name}</strong>
              </p>
              {spriteUrl ? (
                <button
                  type="button"
                  className={`pokemon-sprite${showShiny ? " is-shiny" : ""}`}
                  onClick={() => setShowShiny((current) => !current)}
                  onMouseEnter={canHover ? () => setShowShiny(true) : undefined}
                  onMouseLeave={canHover ? () => setShowShiny(false) : undefined}
                  title={showShiny ? "Normale Form zeigen" : "Shiny-Form zeigen"}
                >
                  {/* key remounts the img per form/day, replaying the entrance animation */}
                  <img
                    key={spriteUrl}
                    src={spriteUrl}
                    alt={`${pokemon.name} Sprite${showShiny ? " (Shiny)" : ""}`}
                  />
                  <span>{showShiny ? "✨ Shiny" : "Shiny bei Hover/Tipp"}</span>
                </button>
              ) : (
                <div className="pokemon-mark" aria-hidden="true">{pokemon.glyph}</div>
              )}
              <p className="pokemon-types">{pokemon.types.join("/")}</p>
              {pokemon.heightDm != null && (
                <p className="pokemon-height">
                  Größe: {(pokemon.heightDm / 10).toLocaleString("de-DE", { maximumFractionDigits: 1 })} m
                </p>
              )}
            </>
          ) : (
            <SkeletonLines widths={[68, 42]} />
          )}
        </article>
        )}

        {/* 2 · Erde–Sonne, gemessen in Pokemon-Längen — ohne Pokemon in km */}
        <article className="trace-row" aria-busy={showPokemon && !pokemon}>
          <header>
            <Ruler size={15} aria-hidden="true" /> Abstand zur Sonne
            {showPokemon && <LiveBadge status={pokemonStatus} />}
          </header>
          {!showPokemon ? (
            <p className="trace-sentence">
              An dem Tag ist die Erde etwa{" "}
              <strong>{deNumber.format(Math.round(oracle.astro.sunDistanceKm))}</strong> km von der
              Sonne entfernt.
            </p>
          ) : pokemon && pokemonUnits != null ? (
            <p className="trace-sentence">
              An dem Tag ist die Erde etwa <strong>{deNumber.format(pokemonUnits)}</strong> {pokemon.name}{" "}
              von der Sonne entfernt.
            </p>
          ) : pokemon ? (
            <p className="trace-sentence">
              Die Größe von {pokemon.name} ist unbekannt — der Sonnenabstand beträgt heute{" "}
              <strong>{deNumber.format(Math.round(oracle.astro.sunDistanceKm))}</strong> km.
            </p>
          ) : (
            <SkeletonLines widths={[92, 58]} />
          )}
        </article>

        {/* 3 · Lamborghini Gallardo */}
        <article className="trace-row">
          <header>
            <Car size={15} aria-hidden="true" /> Sonnenfahrt
          </header>
          <p className="trace-sentence">
            Mit einem Lamborghini Gallardo würdest du heute <strong>{lamboLabel}</strong> Jahre zur Sonne
            brauchen.
          </p>
        </article>

        {/* 4 · Bibelvers */}
        <article className="trace-row">
          <header>
            <BookOpen size={15} aria-hidden="true" /> Bibelvers
          </header>
          <p className="trace-sentence">
            Der Bibelvers von dem Tag ist: <em>{oracle.bibleVerse}</em>
          </p>
        </article>

        {/* 5 · Fake Bibelvers */}
        <article className="trace-row">
          <header>
            <ScrollText size={15} aria-hidden="true" /> Fake Bibelvers
          </header>
          <p className="trace-sentence">
            Der Fake Bibelvers von dem Tag ist: <em>{oracle.fakeBibleVerse}</em>
          </p>
        </article>

        {/* 6 · Ereignisse + Fake News */}
        <article className="trace-row" aria-busy={!live}>
          <header>
            <Newspaper size={15} aria-hidden="true" /> Ereignisse
            <LiveBadge status={wikiStatus} />
          </header>
          {live ? (
            <>
              <p className="trace-sentence">Ereignisse: {factText}</p>
              <p className="danger-text">Fake News: {fakeNewsText}</p>
            </>
          ) : (
            <SkeletonLines widths={[95, 78, 60]} />
          )}
        </article>

        {/* 7 · Zahlen-Fakt (Quersumme des Datums) */}
        <article className="trace-row" aria-busy={!live}>
          <header>
            <Hash size={15} aria-hidden="true" /> Zahlen-Fakt
            <LiveBadge status={numberStatus} />
          </header>
          {live ? <p className="trace-sentence">{live.numberFact.text}</p> : <SkeletonLines widths={[86]} />}
        </article>

        {/* 9 · Neue Fake News / Neue Facts */}
        <article className="trace-row">
          <header>
            <RefreshCw size={15} aria-hidden="true" /> Neu würfeln
          </header>
          <div className="regen-buttons">
            <button
              type="button"
              className="rail-button"
              disabled={fakeDisabled}
              title={
                !live
                  ? loadingTitle
                  : !canCycleFakeNews
                    ? "Offline — keine weiteren Fake News verfügbar"
                    : "Erzeugt eine neue Markov-Fake-News"
              }
              onClick={() => setFakeNonce((nonce) => nonce + 1)}
            >
              Neue Fake News
            </button>
            <button
              type="button"
              className="rail-button"
              disabled={factsDisabled}
              title={
                !live
                  ? loadingTitle
                  : !canCycleFacts
                    ? "Offline — keine weiteren Ereignisse verfügbar"
                    : "Wählt ein anderes echtes Ereignis"
              }
              onClick={() => setFactNonce((nonce) => nonce + 1)}
            >
              Neue Facts
            </button>
          </div>
        </article>

        {/* Stimmungsstatus (bestehende Funktion, ans Ende gedockt) */}
        <article className="trace-row">
          <header>
            <Moon size={15} aria-hidden="true" /> Stimmungsstatus
          </header>
          <p className="trace-sentence">
            {mood ? `${mood.emoji} ${mood.label} · gespeichert` : "Noch keine Stimmung gewaehlt."}
          </p>
        </article>
      </div>

      <div
        className={`soul-tab-panel${tab === "numerologie" ? " is-active" : ""}`}
        role="tabpanel"
        id="soul-panel-numerologie"
        aria-labelledby="soul-tab-numerologie"
      >
        {/* 8 · Numerologie — Stat-Sheet der 7 Kategorien */}
        <article className="trace-row">
          <header>
            <Sigma size={15} aria-hidden="true" /> Numerologie
          </header>
          <div className="numer-form">
            <label>
              Gib deinen Namen ein
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Dein Name"
                autoComplete="name"
              />
            </label>
            <button
              type="button"
              className="rail-button"
              aria-expanded={revealed}
              aria-controls="numer-rows"
              onClick={() => setRevealed(true)}
            >
              <Sigma size={14} aria-hidden="true" /> Berechne deine Zahlen
            </button>
          </div>
        </article>
        {revealed && (
          <ol id="numer-rows" className="numer-list">
            {numerologyRows.map(({ label, pick }, index) => {
              const category = pick(oracle);
              return (
                <li
                  key={label}
                  className={category?.isMaster ? "is-master" : ""}
                  style={reduceMotion ? undefined : { animationDelay: `${index * 70}ms` }}
                >
                  <span className="numer-number" aria-hidden="true">
                    {category ? category.number : "—"}
                  </span>
                  <div>
                    <strong>
                      {label}
                      {category ? ` · ${category.title}` : ""}
                    </strong>
                    {category?.isMaster && <span className="master-tag">Meisterzahl</span>}
                    {category ? (
                      <details className="numer-details">
                        <summary>{category.meaning}</summary>
                        <p className="numerology-description">{category.description}</p>
                      </details>
                    ) : (
                      <p>Trage deinen Namen ein, um diese Zahl zu berechnen.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* S.O.U.L-Erweiterung: Ortszahl (Geburtsort) + Impulszahl (Geburtszeit) */}
        <article className="trace-row">
          <header>
            <MapPin size={15} aria-hidden="true" /> S.O.U.L Ortung
          </header>
          {ortszahl != null && birthPlace ? (
            <div className={`soul-ext-plate${isMasterNumber(ortszahl) ? " is-master" : ""}`}>
              <span className="numer-number" aria-hidden="true">{ortszahl}</span>
              <div>
                <strong>Ortszahl · {birthPlace.name}</strong>
                {isMasterNumber(ortszahl) && <span className="master-tag">Meisterzahl</span>}
                <p>{placeNumberMeaning(ortszahl)}</p>
              </div>
            </div>
          ) : (
            <p className="soul-ext-hint">Geburtsort in den Einstellungen setzen — er trägt eine eigene Zahl.</p>
          )}
          {impulszahl != null && birthTime ? (
            <div className={`soul-ext-plate${isMasterNumber(impulszahl) ? " is-master" : ""}`}>
              <span className="numer-number" aria-hidden="true">{impulszahl}</span>
              <div>
                <strong>Impulszahl · {birthTime} Uhr</strong>
                {isMasterNumber(impulszahl) && <span className="master-tag">Meisterzahl</span>}
                <p>{impulseNumberMeaning(impulszahl)}</p>
              </div>
            </div>
          ) : (
            <p className="soul-ext-hint">Geburtszeit in den Einstellungen setzen — deine Minute hat einen Impuls.</p>
          )}
        </article>
      </div>

      <div
        className={`soul-tab-panel${tab === "horoskop" ? " is-active" : ""}`}
        role="tabpanel"
        id="soul-panel-horoskop"
        aria-labelledby="soul-tab-horoskop"
      >
        {sign && lifePath != null && horoscope ? (
          <>
            {/* Die großen Drei: Sonne / Mond / Aszendent */}
            <article className="trace-row">
              <header>
                <Star size={15} aria-hidden="true" /> Die großen Drei
              </header>
              <div className="big-three">
                <div className="big3-plate" title={`${sign.name} · ${sign.range}`}>
                  <small>Sonne</small>
                  <span className="big3-glyph" aria-hidden="true">{sign.glyph}</span>
                  <strong>{sign.name}</strong>
                  <span className="big3-element">{sign.element}</span>
                </div>
                {big3.moon ? (
                  <div
                    className="big3-plate"
                    title={`Mond bei ${big3.moon.longitude.toFixed(1)}° ekliptikaler Länge`}
                  >
                    <small>Mond</small>
                    <span className="big3-glyph" aria-hidden="true">{big3.moon.glyph}</span>
                    <strong>{big3.moon.name}</strong>
                    <span className="big3-element">{big3.moon.element}</span>
                    {big3.moon.approximate && <span className="approx-tag">ungefähr</span>}
                  </div>
                ) : (
                  <div className="big3-plate is-missing">
                    <small>Mond</small>
                    <span className="big3-glyph" aria-hidden="true">☽</span>
                    <span className="big3-hint">Geburtszeit/-ort in den Einstellungen setzen</span>
                  </div>
                )}
                {big3.ascendant ? (
                  <div
                    className="big3-plate"
                    title={`Aszendent bei ${big3.ascendant.longitude.toFixed(1)}° ekliptikaler Länge`}
                  >
                    <small>Aszendent</small>
                    <span className="big3-glyph" aria-hidden="true">{big3.ascendant.glyph}</span>
                    <strong>{big3.ascendant.name}</strong>
                    <span className="big3-element">{big3.ascendant.element}</span>
                    {big3.ascendant.approximate && <span className="approx-tag">ungefähr</span>}
                  </div>
                ) : (
                  <div className="big3-plate is-missing">
                    <small>Aszendent</small>
                    <span className="big3-glyph" aria-hidden="true">☍</span>
                    <span className="big3-hint">Geburtszeit/-ort in den Einstellungen setzen</span>
                  </div>
                )}
              </div>
            </article>

            {/* Lebenszahl-Platte */}
            <article className="trace-row">
              <header>
                <Hash size={15} aria-hidden="true" /> Lebenszahl
              </header>
              <div className={`horo-life${isMasterNumber(lifePath) ? " is-master" : ""}`}>
                <span className="numer-number" aria-hidden="true">{lifePath}</span>
                <div>
                  <strong>Lebenszahl {lifePath}</strong>
                  {isMasterNumber(lifePath) && <span className="master-tag">Meisterzahl</span>}
                  <p>{lifePathMeaning(lifePath)}</p>
                </div>
              </div>
            </article>

            {/* Tageshoroskop */}
            <article className="trace-row">
              <header>
                <Sparkles size={15} aria-hidden="true" /> Tageshoroskop
              </header>
              <p className="trace-sentence horo-text">{horoscope.text}</p>
            </article>

            {/* Glückssignale */}
            <article className="trace-row">
              <header>
                <Gem size={15} aria-hidden="true" /> Glückssignale
              </header>
              <div className="lucky-chips">
                <span className="lucky-chip">
                  <small>Glückszahl</small>
                  <strong>{horoscope.luckyNumber}</strong>
                </span>
                <span className="lucky-chip">
                  <small>Glücksfarbe</small>
                  <b
                    className="lucky-swatch"
                    style={{ background: horoscope.luckyColorHex }}
                    aria-hidden="true"
                  />
                  <strong>{horoscope.luckyColorName}</strong>
                </span>
              </div>
            </article>
          </>
        ) : (
          <article className="trace-row">
            <header>
              <Star size={15} aria-hidden="true" /> Horoskop
            </header>
            <p className="trace-sentence">
              Trage dein Geburtsdatum ein — es macht deinen Tag einzigartig und weckt dein
              persönliches Horoskop.
            </p>
            <label className="horo-birth-form">
              Geburtsdatum
              <input
                type="date"
                value={birthDate ?? ""}
                onChange={(event) => onBirthDateChange(event.target.value)}
              />
            </label>
          </article>
        )}
      </div>
    </section>
  );
}
