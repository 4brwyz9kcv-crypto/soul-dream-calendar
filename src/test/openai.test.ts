import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateAngelSpeech, testOpenAiKey, type AngelSpeechContext } from "../services/openai";
import { setOpenAiKey } from "../services/storage";

const context: AngelSpeechContext = {
  angelName: "Seraph Eye PCB",
  date: "24. Mai 2025",
  colorName: "cyan",
  pokemonName: "Pikachu",
  bibleVerse: "Ein Testvers.",
  numerology: { schicksal: 7, persoenlichkeit: 3, einstellung: 1 },
  sunDistanceKm: 151000000,
  mood: "Ruhig",
  hasJournalNote: true
};

function completion(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

const fetchMock = vi.fn();

describe("openai service", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("testOpenAiKey", () => {
    it("returns true for an ok response from GET /v1/models", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      await expect(testOpenAiKey("  sk-test ")).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/models");
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    });

    it("returns false on a 401 response", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401 });
      await expect(testOpenAiKey("sk-bad")).resolves.toBe(false);
    });

    it("returns false on a network error instead of throwing", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(testOpenAiKey("sk-test")).resolves.toBe(false);
    });

    it("returns false for a blank key without calling fetch", async () => {
      await expect(testOpenAiKey("   ")).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("generateAngelSpeech", () => {
    it("parses a chat completion into openai-sourced speech lines", async () => {
      setOpenAiKey("sk-test-123");
      fetchMock.mockResolvedValue(
        completion("- Erste Zeile\n2) Zweite Zeile\n• Dritte Zeile\n\n* Vierte Zeile")
      );

      const lines = await generateAngelSpeech(context);
      expect(lines).not.toBeNull();
      expect(lines?.map((line) => line.text)).toEqual([
        "Erste Zeile",
        "Zweite Zeile",
        "Dritte Zeile",
        "Vierte Zeile"
      ]);
      expect(lines?.every((line) => line.source === "openai")).toBe(true);
      expect(lines?.[0]?.mood).toBe("oracle");
      expect(lines?.[1]?.mood).toBe("coach");

      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/chat/completions");
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test-123");
      const body = JSON.parse(String(init.body)) as { model: string; messages: Array<{ content: string }> };
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.messages[1]?.content).toContain("Seraph Eye PCB");
    });

    it("caps the parsed speech at six lines", async () => {
      setOpenAiKey("sk-test-123");
      fetchMock.mockResolvedValue(completion("a1\na2\na3\na4\na5\na6\na7\na8"));

      const lines = await generateAngelSpeech(context);
      expect(lines).toHaveLength(6);
    });

    it("returns null when the response body is malformed JSON", async () => {
      setOpenAiKey("sk-test-123");
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        }
      });

      await expect(generateAngelSpeech(context)).resolves.toBeNull();
    });

    it("returns null when the completion has no usable content", async () => {
      setOpenAiKey("sk-test-123");
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [] }) });
      await expect(generateAngelSpeech(context)).resolves.toBeNull();

      fetchMock.mockResolvedValue(completion("   \n  \n"));
      await expect(generateAngelSpeech(context)).resolves.toBeNull();
    });

    it("returns null on a non-ok response", async () => {
      setOpenAiKey("sk-test-123");
      fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
      await expect(generateAngelSpeech(context)).resolves.toBeNull();
    });

    it("returns null on a network exception instead of throwing", async () => {
      setOpenAiKey("sk-test-123");
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(generateAngelSpeech(context)).resolves.toBeNull();
    });

    it("returns null without calling fetch when no key is stored", async () => {
      await expect(generateAngelSpeech(context)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
