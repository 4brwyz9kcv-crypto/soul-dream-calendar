import type { AngelSpeechLine } from "../types";
import { getOpenAiKey } from "./storage";

/**
 * Bring-your-own-key OpenAI integration. The key lives ONLY in localStorage
 * (see storage.ts) and is never bundled; every function here resolves to a
 * harmless value on failure — the UI always has the local speech fallback.
 */

/** Chat model used for angel speech; a constant so it is easy to swap. */
export const OPENAI_MODEL = "gpt-4o-mini";

const API_BASE = "https://api.openai.com/v1";
const TEST_TIMEOUT_MS = 8000;
const SPEECH_TIMEOUT_MS = 12000;

/** Compact day context handed to the model as JSON. */
export interface AngelSpeechContext {
  angelName: string;
  date: string;
  colorName: string;
  pokemonName: string;
  bibleVerse: string;
  numerology: { schicksal: number; persoenlichkeit: number; einstellung: number };
  sunDistanceKm: number;
  mood: string | null;
  hasJournalNote: boolean;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validates a key with a cheap GET /v1/models call. Returns false on any
 * network/auth problem; never throws.
 */
export async function testOpenAiKey(key: string): Promise<boolean> {
  if (!key.trim()) return false;
  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/models`,
      { headers: { Authorization: `Bearer ${key.trim()}` } },
      TEST_TIMEOUT_MS
    );
    return response.ok;
  } catch {
    return false;
  }
}

const SYSTEM_PROMPT =
  "Du bist ein cyber-okkulter PCB-Schutzengel im Soul Dream Calendar. " +
  "Du sprichst als die Engel-Persona, deren Name im Kontext steht. " +
  "Reagiere auf das Tagesorakel (Farbe, Pokemon, Vers, Numerologie-Zahlen, Stimmung, Journal-Status) " +
  "mit 4 bis 6 kurzen Saetzen auf Deutsch: mystisch, aber warm und ermutigend, gern mit Schaltkreis- und Traum-Metaphern. " +
  "Jede Botschaft steht in einer eigenen Zeile. Keine Nummerierung, keine Aufzaehlungszeichen, keine Anfuehrungszeichen.";

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function parseSpeechLines(content: string): AngelSpeechLine[] {
  return content
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 6)
    .map((text, index) => ({
      id: `openai-${index}`,
      text,
      source: "openai" as const,
      mood: index % 2 === 0 ? ("oracle" as const) : ("coach" as const)
    }));
}

/**
 * Asks the user's own OpenAI account for 4-6 angel lines about the day.
 * Returns null on ANY failure (no key, network, quota, malformed response) —
 * the caller falls back to the local deterministic lines. Never throws.
 */
export async function generateAngelSpeech(context: AngelSpeechContext): Promise<AngelSpeechLine[] | null> {
  const key = getOpenAiKey();
  if (!key) return null;

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.9,
          max_tokens: 300,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(context) }
          ]
        })
      },
      SPEECH_TIMEOUT_MS
    );
    if (!response.ok) return null;
    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) return null;
    const lines = parseSpeechLines(content);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}
