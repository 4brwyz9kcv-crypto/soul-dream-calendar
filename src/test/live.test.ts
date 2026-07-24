import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dateDigitSum,
  fetchNumberFact,
  fetchPokemonOfDay,
  fetchWikiOnThisDay,
  loadLiveDayData,
  localNumberFact
} from "../services/live";
import { getDayOracle } from "../services/oracle";

const oracle = getDayOracle(new Date(2025, 4, 24), "Testname");

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

const fetchMock = vi.fn();

describe("live data service", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns live pokemon data and caches it per id", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: oracle.pokemonSeed,
        name: "pikachu",
        height: 4,
        types: [{ type: { name: "electric" } }],
        sprites: { front_default: "https://img/front.png", front_shiny: "https://img/shiny.png" }
      })
    );

    const first = await fetchPokemonOfDay(oracle);
    expect(first.status).toBe("live");
    expect(first.name).toBe("Pikachu");
    expect(first.types).toEqual(["electric"]);
    expect(first.heightDm).toBe(4);
    expect(first.spriteUrl).toBe("https://img/front.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`/pokemon/${oracle.pokemonSeed}`);
    expect(localStorage.getItem(`sdc.pokemon.${oracle.pokemonSeed}`)).not.toBeNull();

    const second = await fetchPokemonOfDay(oracle);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1); // served from cache
  });

  it("falls back to the seeded oracle pokemon with offline status when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await fetchPokemonOfDay(oracle);
    expect(result.status).toBe("offline");
    expect(result.name).toBe(oracle.pokemon.name);
    expect(result.types).toEqual(oracle.pokemon.type.split("/").map((entry) => entry.trim()));
    expect(result.glyph).toBe(oracle.pokemon.glyph);
    expect(result.heightDm).toBeNull();
    // failures are not cached, so the next call retries
    expect(localStorage.getItem(`sdc.pokemon.${oracle.pokemonSeed}`)).toBeNull();
  });

  it("picks a wiki event deterministically and generates fake news from the event corpus", async () => {
    const events = [
      { year: 1969, text: "Die erste Mondlandung veraendert alles fuer immer." },
      { year: 1912, text: "Die Titanic sinkt im kalten Nordatlantik." },
      { year: 1989, text: "Die Mauer faellt in Berlin ohne Vorwarnung." }
    ];
    fetchMock.mockResolvedValue(jsonResponse({ events }));

    const fact = await fetchWikiOnThisDay(oracle);
    expect(fact.status).toBe("live");

    const picked = events[oracle.imageSeed % events.length];
    expect(fact.fact).toBe(`${picked.year} – ${picked.text}`);

    // the Markov fake news is trained on ALL event texts, so every word of it
    // (modulo the sentence-final period the generator may append) must come
    // from the corpus
    expect(fact.fakeNews.length).toBeGreaterThan(0);
    const corpusWords = new Set(
      events.flatMap((event) => event.text.split(/\s+/)).map((word) => word.replace(/\.$/, ""))
    );
    for (const word of fact.fakeNews.split(/\s+/)) {
      expect(corpusWords.has(word.replace(/\.$/, ""))).toBe(true);
    }

    // cached per MM-DD with TTL: second call is deterministic and fetch-free
    expect(localStorage.getItem("sdc.wiki.05-24")).not.toBeNull();
    const again = await fetchWikiOnThisDay(oracle);
    expect(again).toEqual(fact);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the oracle wiki fact with offline status when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const fact = await fetchWikiOnThisDay(oracle);
    expect(fact).toEqual({ status: "offline", fact: oracle.wikipediaFact, fakeNews: oracle.fakeNews });
  });

  it("produces a German fallback number fact mentioning the digit sum", async () => {
    fetchMock.mockRejectedValue(new Error("cors blocked"));

    const n = dateDigitSum(oracle); // 2+0+2+5+0+5+2+4 = 20 for 2025-05-24
    expect(n).toBe(20);

    const fact = await fetchNumberFact(oracle);
    expect(fact.status).toBe("offline");
    expect(fact.number).toBe(n);
    expect(fact.text).toBe(localNumberFact(n));
    expect(fact.text).toContain("Quersumme");
    expect(fact.text).toContain(String(n));
    expect(fact.text).toContain("gerade");
  });

  it("caches a live number fact per ISO day", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ text: "20 is a tetrahedral number.", found: true }));

    const fact = await fetchNumberFact(oracle);
    expect(fact.status).toBe("live");
    expect(fact.text).toBe("20 is a tetrahedral number.");

    const again = await fetchNumberFact(oracle);
    expect(again).toEqual(fact);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loadLiveDayData resolves with offline fallbacks even when every fetch throws", async () => {
    fetchMock.mockImplementation(() => {
      throw new Error("total network failure");
    });

    const data = await loadLiveDayData(oracle);
    expect(data.pokemon.status).toBe("offline");
    expect(data.wiki.status).toBe("offline");
    expect(data.numberFact.status).toBe("offline");
    expect(data.numberFact.number).toBe(dateDigitSum(oracle));
  });
});
