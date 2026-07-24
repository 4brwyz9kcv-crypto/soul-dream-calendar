import {
  CalendarDays,
  CircleUserRound,
  CircuitBoard,
  NotebookPen,
  Settings,
  Sparkles
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AngelCompanion } from "./components/AngelCompanion";
import { CalendarGrid } from "./components/CalendarGrid";
import { HourLogger } from "./components/HourLogger";
import { JournalPanel } from "./components/JournalPanel";
import { OracleCards } from "./components/OracleCards";
import { SettingsPanel } from "./components/SettingsPanel";
import { SoulDetail } from "./components/SoulDetail";
import { angelAssets, getAngelSpeech } from "./services/angel";
import { toDayKey } from "./services/dates";
import { dreamImageDataUrl } from "./services/dreamImage";
import { zodiacSign } from "./services/horoscope";
import { loadLiveDayData } from "./services/live";
import { getDayOracle } from "./services/oracle";
import {
  loadJournalEntry,
  loadMoodEntry,
  loadSettings,
  saveJournalEntry,
  saveMoodEntry,
  saveSettings
} from "./services/storage";
import type {
  AngelSpeechLine,
  AppView,
  JournalEntry,
  LiveDayData,
  MoodEntry,
  UserSettings
} from "./types";

const navItems: Array<{ id: AppView; label: string; icon: typeof CalendarDays }> = [
  { id: "calendar", label: "Kalender", icon: CalendarDays },
  { id: "oracle", label: "Tagesorakel", icon: Sparkles },
  { id: "journal", label: "Notizen", icon: NotebookPen },
  { id: "settings", label: "Einstellungen", icon: Settings }
];

export default function App() {
  const todayIso = toDayKey(new Date()).iso;
  const [view, setView] = useState<AppView>("calendar");
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [journalEntry, setJournalEntry] = useState<JournalEntry>(() => loadJournalEntry(todayIso));
  const [moodEntry, setMoodEntry] = useState<MoodEntry | null>(() => loadMoodEntry(todayIso));
  const [speechLines, setSpeechLines] = useState<AngelSpeechLine[]>([]);
  const [liveData, setLiveData] = useState<LiveDayData | null>(null);

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedIso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedIso]);

  const oracle = useMemo(
    () =>
      getDayOracle(
        selectedDate,
        settings.name,
        settings.birthDate,
        settings.birthTime,
        settings.birthPlace?.name
      ),
    [selectedDate, settings.name, settings.birthDate, settings.birthTime, settings.birthPlace]
  );
  const zodiac = useMemo(() => zodiacSign(settings.birthDate), [settings.birthDate]);
  const angelAsset = useMemo(
    () => angelAssets.find((asset) => asset.id === settings.selectedAngelId) ?? angelAssets.find((asset) => asset.id === oracle.angelAssetId) ?? angelAssets[0],
    [oracle.angelAssetId, settings.selectedAngelId]
  );

  useEffect(() => {
    setJournalEntry(loadJournalEntry(selectedIso));
    setMoodEntry(loadMoodEntry(selectedIso));
  }, [selectedIso]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveJournalEntry(journalEntry);
  }, [journalEntry]);

  useEffect(() => {
    if (moodEntry) saveMoodEntry(moodEntry);
  }, [moodEntry]);

  // Live day data (PokeAPI, Wikipedia, Numbers API) — null while loading,
  // every field degrades to the deterministic offline fallback on its own.
  useEffect(() => {
    let cancelled = false;
    setLiveData(null);
    loadLiveDayData(oracle).then((data) => {
      if (!cancelled) setLiveData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [oracle]);

  const dreamImage = useMemo(
    () => dreamImageDataUrl(oracle.imageSeed, oracle.color.hex, settings.reduceMotion),
    [oracle.imageSeed, oracle.color.hex, settings.reduceMotion]
  );

  useEffect(() => {
    let cancelled = false;
    getAngelSpeech(oracle, journalEntry, moodEntry, settings.providerMode, {
      livePokemonName: liveData?.pokemon.status === "live" ? liveData.pokemon.name : undefined,
      angelName: angelAsset.name
    }).then((lines) => {
      if (!cancelled) setSpeechLines(lines);
    });
    return () => {
      cancelled = true;
    };
  }, [oracle, journalEntry, moodEntry, settings.providerMode, liveData, angelAsset.name]);

  const updateSettings = (next: UserSettings) => {
    setSettings(next);
  };

  const renderMain = () => {
    if (view === "journal") {
      return (
        <div className="content-pair">
          <JournalPanel
            entry={journalEntry}
            mood={moodEntry}
            onEntryChange={setJournalEntry}
            onMoodChange={setMoodEntry}
          />
          <AngelCompanion
            asset={angelAsset}
            lines={speechLines}
            muted={settings.angelMuted}
            pinned={settings.angelPinned}
            reduceMotion={settings.reduceMotion}
            onMutedChange={(angelMuted) => updateSettings({ ...settings, angelMuted })}
            onPinnedChange={(angelPinned) => updateSettings({ ...settings, angelPinned })}
          />
        </div>
      );
    }

    if (view === "settings") {
      return <SettingsPanel settings={settings} onSettingsChange={updateSettings} />;
    }

    if (view === "oracle") {
      // Slim MMO-style buff bar ("Cogitator-Leiste") replacing the tall header:
      // date, day color chip, numbers triad, mood, angel and live diode at a glance.
      const weekday = selectedDate.toLocaleDateString("de-DE", { weekday: "long" });
      const liveStatus: "live" | "offline" | "loading" = liveData
        ? [liveData.pokemon.status, liveData.wiki.status, liveData.numberFact.status].includes("live")
          ? "live"
          : "offline"
        : "loading";
      const liveLabel = liveStatus === "live" ? "Live" : liveStatus === "offline" ? "Offline" : "Lädt…";
      return (
        <div
          className="soul-detail-screen"
          data-reduce-motion={settings.reduceMotion ? "true" : undefined}
          style={{ "--day-accent": oracle.color.hex } as CSSProperties}
        >
          <header className="cogitator-bar" aria-label="Cogitator-Leiste">
            <div className="cog-cell cog-cell--date">
              <span className="cog-label">Kalender Detail Ansicht</span>
              <h1 className="cog-value">
                {weekday}, {oracle.title}
                {zodiac && (
                  <span
                    className="cog-zodiac"
                    title={`${zodiac.name} · ${zodiac.range}`}
                    aria-label={`Sternzeichen ${zodiac.name}`}
                  >
                    {zodiac.glyph}
                  </span>
                )}
              </h1>
              <span className="cog-sub">{oracle.subtitle}</span>
            </div>
            <div className="cog-cell cog-cell--color">
              <span className="cog-label">Die Farbe des Tages ist:</span>
              <span className="cog-color">
                <b className="day-color-swatch" style={{ background: oracle.color.hex }} aria-hidden="true" />
                <strong>{oracle.color.name}</strong>
                <span className="cog-hex">{oracle.color.hex}</span>
              </span>
            </div>
            <div className="cog-cell cog-cell--numbers">
              <span className="cog-label">Zahlen des Tages</span>
              <strong className="cog-value">{oracle.numberSignal.split("·")[0]?.trim()}</strong>
            </div>
            <div className="cog-cell cog-cell--mood" title={moodEntry?.label}>
              <span className="cog-label">Stimmung</span>
              <strong className="cog-value">{moodEntry ? moodEntry.emoji : "—"}</strong>
            </div>
            <div className="cog-cell cog-cell--angel">
              <span className="cog-label">Engel</span>
              <strong className="cog-value">{angelAsset.name}</strong>
            </div>
            <div className="cog-cell cog-cell--status">
              <span className={`live-badge is-${liveStatus}`} title={liveLabel}>
                <span className="led-dot" aria-hidden="true" />
              </span>
              <span className="cog-status-text">{liveLabel}</span>
            </div>
          </header>
          <div className="soul-detail-layout">
            <HourLogger dayKey={selectedIso} isToday={selectedIso === todayIso} />
            <div className="soul-center">
              <OracleCards oracle={oracle} dreamImage={dreamImage} />
            </div>
            <div className="soul-rail-zone">
              <SoulDetail
                oracle={oracle}
                live={liveData}
                mood={moodEntry}
                name={settings.name}
                birthDate={settings.birthDate}
                birthTime={settings.birthTime}
                birthPlace={settings.birthPlace}
                reduceMotion={settings.reduceMotion}
                onNameChange={(name) => updateSettings({ ...settings, name })}
                onBirthDateChange={(birthDate) => updateSettings({ ...settings, birthDate })}
              />
              <AngelCompanion
                asset={angelAsset}
                lines={speechLines}
                muted={settings.angelMuted}
                pinned={settings.angelPinned}
                reduceMotion={settings.reduceMotion}
                onMutedChange={(angelMuted) => updateSettings({ ...settings, angelMuted })}
                onPinnedChange={(angelPinned) => updateSettings({ ...settings, angelPinned })}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="calendar-screen">
        <section className="welcome-panel">
          <span>Soul Dream Calendar</span>
          <h1>Wähle deinen Tag</h1>
          <p>Jeder Tag ist eine Einladung an deine Seele.</p>
          <label>
            Dein Name
            <input
              value={settings.name}
              onChange={(event) => updateSettings({ ...settings, name: event.target.value })}
            />
          </label>
          <button type="button" onClick={() => setView("oracle")}>
            Tag öffnen
            <Sparkles size={18} />
          </button>
        </section>
        <CalendarGrid selectedIso={selectedIso} onSelect={(date) => setSelectedIso(toDayKey(date).iso)} />
        <section className="quick-oracle">
          <article>
            <small>Zahlen des Tages</small>
            <strong>{oracle.numberSignal.split("·")[0]}</strong>
          </article>
          <article>
            <small>Farbe des Tages</small>
            <b style={{ background: oracle.color.hex }} />
            <span>{oracle.color.name}</span>
          </article>
          <article>
            <small>Reise zur Sonne</small>
            <strong>{oracle.travel[0].sunLabel}</strong>
          </article>
          <article>
            <small>Engel</small>
            <span>{angelAsset.name}</span>
          </article>
        </section>
      </div>
    );
  };

  return (
    <div className="app-shell" data-reduce-motion={settings.reduceMotion ? "true" : undefined}>
      <div className="circuit-bg" aria-hidden="true" />
      <aside className="sidebar">
        <div className="brand">
          <CircuitBoard size={26} />
          <div>
            <strong>Soul Dream Calendar</strong>
            <span>PCB Oracle OS</span>
          </div>
        </div>
        <nav aria-label="Hauptnavigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={view === item.id ? "is-active" : ""}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="profile-card">
          <CircleUserRound size={22} />
          <span>Dein Name</span>
          <strong>{settings.name || "Unbenannt"}</strong>
        </div>
      </aside>

      <main className="main-surface">
        {renderMain()}
      </main>

      <nav className="mobile-nav" aria-label="Mobile Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={view === item.id ? "is-active" : ""}
              onClick={() => setView(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
