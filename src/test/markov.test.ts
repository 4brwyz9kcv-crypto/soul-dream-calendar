import { describe, expect, it } from "vitest";
import { buildChain, fakeVerse, generate } from "../services/markov";

const corpus = [
  "der traum flackert im kupfer und schlaeft weiter.",
  "der traum wandert durch die platine ohne ziel.",
  "im kupfer wohnt ein engel der leise summt.",
  "die platine traeumt von einem kalender aus licht."
];

/**
 * generate() can only emit corpus words verbatim, except the very last word,
 * which may have trailing [,;:] stripped and a "." appended.
 */
function extendedVocabulary(entries: readonly string[]): Set<string> {
  const vocab = new Set<string>();
  for (const entry of entries) {
    for (const word of entry.split(/\s+/).filter((w) => w.length > 0)) {
      vocab.add(word);
      const stripped = word.replace(/[,;:]+$/, "");
      vocab.add(stripped);
      vocab.add(`${stripped}.`);
    }
  }
  return vocab;
}

describe("markov chain", () => {
  it("produces identical output for the same seed", () => {
    const chain = buildChain(corpus);
    for (const seed of [0, 1, 42, 123456, 2 ** 31 - 1]) {
      expect(generate(chain, seed)).toBe(generate(chain, seed));
    }
  });

  it("produces at least one differing output across five seeds", () => {
    const chain = buildChain(corpus);
    const outputs = [1, 2, 3, 4, 5].map((seed) => generate(chain, seed));
    expect(new Set(outputs).size).toBeGreaterThan(1);
  });

  it("only emits words from the corpus vocabulary", () => {
    const chain = buildChain(corpus);
    const vocab = extendedVocabulary(corpus);
    for (const seed of [1, 7, 99, 1234, 987654]) {
      const sentence = generate(chain, seed);
      expect(sentence.length).toBeGreaterThan(0);
      for (const word of sentence.split(" ")) {
        expect(vocab.has(word)).toBe(true);
      }
    }
  });

  it("respects the maxWords cap and closes the sentence", () => {
    // Cyclic corpus without sentence-final punctuation: the walk only stops at the cap.
    const cyclic = buildChain(["om tak lo om tak lo om tak lo om tak"]);
    const sentence = generate(cyclic, 5, { maxWords: 6 });
    expect(sentence.split(" ")).toHaveLength(6);
    expect(sentence.endsWith(".")).toBe(true);

    // Default cap is 25 words.
    const chain = buildChain(corpus);
    for (const seed of [3, 17, 555]) {
      expect(generate(chain, seed).split(" ").length).toBeLessThanOrEqual(25);
    }
  });

  it("returns an empty string for an empty chain and skips one-word entries", () => {
    expect(generate(buildChain([]), 42)).toBe("");
    expect(generate(buildChain(["solo", " "]), 42)).toBe("");
  });

  it("generates deterministic fake verses", () => {
    const a = fakeVerse(20250524);
    expect(a).toBe(fakeVerse(20250524));
    expect(a.length).toBeGreaterThan(0);
    expect(a.split(" ").length).toBeLessThanOrEqual(25);
    expect(/[.!?]$/.test(a)).toBe(true);

    // Custom cap flows through to the generator.
    const short = fakeVerse(20250524, { maxWords: 4 });
    expect(short.split(" ").length).toBeLessThanOrEqual(4);
    expect(short).toBe(fakeVerse(20250524, { maxWords: 4 }));

    // Different seeds usually differ; assert at least one of five does.
    const outputs = [11, 22, 33, 44, 55].map((seed) => fakeVerse(seed));
    expect(new Set(outputs).size).toBeGreaterThan(1);
  });
});
