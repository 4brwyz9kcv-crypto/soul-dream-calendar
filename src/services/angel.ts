import type {
  AngelAsset,
  AngelSpeechLine,
  DayOracle,
  JournalEntry,
  MoodEntry,
  ProviderMode
} from "../types";
import { stableSeed } from "./dates";
import { generateAngelSpeech } from "./openai";
import { getOpenAiKey } from "./storage";

import { angelSources } from "@angel-assets";

export const angelAssets: AngelAsset[] = [
  { id: "seraph", name: "Seraph Eye PCB", ...angelSources.seraph, mood: "oracle" },
  { id: "winged", name: "Winged Signal", ...angelSources.winged, mood: "coach" },
  { id: "terminal", name: "Terminal Third Eye", ...angelSources.terminal, mood: "glitch" },
  { id: "spiral", name: "Spiral PCB Wings", ...angelSources.spiral, mood: "oracle" }
];

/** Optional live enrichment for the local speech lines. */
export interface AngelSpeechExtras {
  /** Live PokeAPI name of the day, when the fetch succeeded. */
  livePokemonName?: string;
  /** Name of the selected angel persona (for the OpenAI system context). */
  angelName?: string;
}

export async function getAngelSpeech(
  dayOracle: DayOracle,
  journalEntry: JournalEntry,
  moodEntry: MoodEntry | null,
  providerMode: ProviderMode,
  extras?: AngelSpeechExtras
): Promise<AngelSpeechLine[]> {
  const hasNote = journalEntry.note.trim().length > 0;
  const moodText = moodEntry ? `Deine Stimmung funkt ${moodEntry.label.toLowerCase()}.` : "Die Stimmung ist noch ungemessen.";
  const seed = stableSeed(`${dayOracle.key.iso}:${journalEntry.note}:${moodEntry?.label ?? "none"}`);
  const pokemonName = extras?.livePokemonName ?? dayOracle.pokemon.name;
  const destiny = dayOracle.numerology.destiny;
  const sunKm = Math.round(dayOracle.astro.sunDistanceKm).toLocaleString("de-DE");

  const lines: AngelSpeechLine[] = [
    {
      id: "color",
      source: "color",
      mood: "oracle",
      text: `Das ${dayOracle.color.name}-Signal ist heute stark. ${pokemonName} wartet am Rand des Traums.`
    },
    {
      id: "destiny",
      source: "date",
      mood: "oracle",
      text: `Deine Schicksalszahl flackert auf ${destiny.number}${destiny.isMaster ? " - eine Meisterzahl" : ""} (${destiny.title}). Der Tag traegt ihre Frequenz.`
    },
    {
      id: "sun",
      source: "travel",
      mood: "coach",
      text: `Die Sonne sendet heute aus ${sunKm} km Entfernung. Der Mond ist naeher als dein Ausweichgedanke - schreib einen Satz, bevor das Portal schliesst.`
    },
    {
      id: "numbers",
      source: "date",
      mood: "oracle",
      text: `Dein Tagesorakel flackert: Farbe, Zahl und Stimmung wollen verbunden werden.`
    },
    {
      id: "mood",
      source: "mood",
      mood: "coach",
      text: `${moodText} Der Engel protokolliert nur, er urteilt nicht.`
    },
    {
      id: "journal",
      source: "journal",
      mood: hasNote ? "oracle" : "coach",
      text: hasNote
        ? "Deine Notiz ist gespeichert. Eine kleine Leiterbahn weniger im Nebel."
        : "Noch keine Notiz. Lass einen Satz fallen, auch wenn er unfertig ist."
    }
  ];

  if (providerMode === "openai") {
    if (getOpenAiKey()) {
      const generated = await generateAngelSpeech({
        angelName: extras?.angelName ?? "PCB-Engel",
        date: dayOracle.title,
        colorName: dayOracle.color.name,
        pokemonName,
        bibleVerse: dayOracle.bibleVerse,
        numerology: {
          schicksal: dayOracle.numerology.destiny.number,
          persoenlichkeit: dayOracle.numerology.personality.number,
          einstellung: dayOracle.numerology.attitude.number
        },
        sunDistanceKm: Math.round(dayOracle.astro.sunDistanceKm),
        mood: moodEntry?.label ?? null,
        hasJournalNote: hasNote
      });
      if (generated && generated.length > 0) {
        return generated;
      }
      lines.push({
        id: "openai-fallback",
        source: "openai",
        mood: "glitch",
        text: "OpenAI antwortet gerade nicht - das lokale Signal uebernimmt nahtlos."
      });
    } else {
      lines.push({
        id: "openai-no-key",
        source: "openai",
        mood: "glitch",
        text: "OpenAI-Modus ist aktiv, aber kein Schluessel hinterlegt. Trage ihn in den Einstellungen ein - er bleibt nur auf diesem Geraet."
      });
    }
  }

  return [...lines.slice(seed % 2), ...lines.slice(0, seed % 2)];
}
