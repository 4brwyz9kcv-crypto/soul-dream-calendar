import { bibleVerses } from "../data/verses";

/**
 * In-house replacement for the legacy markovify usage (bible.py fake_verse):
 * a word-level, order-2 Markov chain with a seeded PRNG so that output is
 * fully deterministic for a given seed. No external dependencies.
 */

export interface MarkovChain {
  /** All observed sentence-starting word pairs (duplicates keep frequency weighting). */
  starts: ReadonlyArray<readonly [string, string]>;
  /** "word1 word2" -> observed following words (duplicates keep frequency weighting). */
  transitions: ReadonlyMap<string, readonly string[]>;
}

export interface GenerateOptions {
  /** Hard cap on the number of words (default 25, matching the legacy short-sentence feel). */
  maxWords?: number;
}

const DEFAULT_MAX_WORDS = 25;
const SENTENCE_END = /[.!?]$/;
const TRAILING_PUNCTUATION = /[,;:]+$/;

/**
 * mulberry32 — tiny deterministic PRNG. Same seed, same sequence, everywhere.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a word-level order-2 chain from the given corpus entries.
 */
export function buildChain(corpus: readonly string[]): MarkovChain {
  const starts: Array<readonly [string, string]> = [];
  const transitions = new Map<string, string[]>();

  for (const entry of corpus) {
    const words = entry.split(/\s+/).filter((word) => word.length > 0);
    if (words.length < 2) continue;
    starts.push([words[0], words[1]]);
    for (let i = 0; i + 2 < words.length; i += 1) {
      const key = `${words[i]} ${words[i + 1]}`;
      const bucket = transitions.get(key);
      if (bucket) {
        bucket.push(words[i + 2]);
      } else {
        transitions.set(key, [words[i + 2]]);
      }
    }
  }

  return { starts, transitions };
}

/**
 * Deterministically generates a sentence from the chain: walks the order-2
 * transitions with a mulberry32 PRNG, stops at sentence-final punctuation when
 * possible and otherwise caps the walk at maxWords, cleaning up the ending.
 */
export function generate(chain: MarkovChain, seed: number, opts?: GenerateOptions): string {
  const maxWords = opts?.maxWords ?? DEFAULT_MAX_WORDS;
  if (chain.starts.length === 0) return "";

  const rand = mulberry32(seed);
  const start = chain.starts[Math.floor(rand() * chain.starts.length)];
  const words: string[] = [start[0], start[1]];

  while (words.length < maxWords && !SENTENCE_END.test(words[words.length - 1])) {
    const key = `${words[words.length - 2]} ${words[words.length - 1]}`;
    const bucket = chain.transitions.get(key);
    if (!bucket || bucket.length === 0) break;
    words.push(bucket[Math.floor(rand() * bucket.length)]);
  }

  let sentence = words.join(" ");
  if (!SENTENCE_END.test(sentence)) {
    sentence = sentence.replace(TRAILING_PUNCTUATION, "") + ".";
  }
  return sentence;
}

let bibleChain: MarkovChain | null = null;

/**
 * Deterministic fake bible verse, trained lazily (and memoized) on the bundled
 * bibleVerses corpus. Replacement for the legacy Bible.fake_verse.
 */
export function fakeVerse(seed: number, opts?: GenerateOptions): string {
  if (!bibleChain) {
    bibleChain = buildChain(bibleVerses);
  }
  return generate(bibleChain, seed, opts);
}
