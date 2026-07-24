import { describe, expect, it } from "vitest";
import { dreamArchetypes, dreamImageDataUrl } from "../services/dreamImage";

const PREFIX = "data:image/svg+xml;utf8,";

function decode(url: string): string {
  return decodeURIComponent(url.slice(PREFIX.length));
}

function archetypeOf(url: string): string {
  const match = /<desc>archetype:([a-z-]+)<\/desc>/.exec(decode(url));
  return match ? match[1] : "";
}

describe("dream image generator", () => {
  it("is deterministic for the same seed, color and motion flag", () => {
    const a = dreamImageDataUrl(1234567, "#00ff00", false);
    const b = dreamImageDataUrl(1234567, "#00ff00", false);
    expect(a).toBe(b);
  });

  it("produces different images for different seeds", () => {
    const a = dreamImageDataUrl(1, "#00ff00", false);
    const b = dreamImageDataUrl(2, "#00ff00", false);
    expect(a).not.toBe(b);
  });

  it("returns an svg data url", () => {
    const url = dreamImageDataUrl(42, "#3366cc", true);
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    const svg = decode(url);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 640 400"');
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("derives the palette from the day color", () => {
    // The generator maps the day color to seeded HSL schemes (with hue
    // rotation) instead of embedding the raw hex, so we assert that the
    // palette is hsl-based and that a different day color changes the image.
    const svg = decode(dreamImageDataUrl(42, "#00ff00", true));
    expect(svg).toContain("hsl(");
    expect(dreamImageDataUrl(42, "#00ff00", true)).not.toBe(dreamImageDataUrl(42, "#ff0000", true));
  });

  it("omits all <animate> elements when reduced motion is requested", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      expect(decode(dreamImageDataUrl(seed, "#00ff00", true))).not.toContain("<animate");
    }
  });

  it("includes <animate> pulses when motion is allowed", () => {
    for (let seed = 1; seed <= 9; seed += 1) {
      expect(decode(dreamImageDataUrl(seed, "#00ff00", false))).toContain("<animate");
    }
  });

  it("embeds a valid archetype marker", () => {
    const url = dreamImageDataUrl(7, "#3366cc", true);
    const marker = archetypeOf(url);
    expect(dreamArchetypes).toContain(marker);
    expect(decode(url)).toContain(`data-archetype="${marker}"`);
  });

  it("spans at least 5 distinct archetypes across 40 sequential seeds", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      seen.add(archetypeOf(dreamImageDataUrl(seed, "#3366cc", true)));
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    for (const name of seen) {
      expect(dreamArchetypes).toContain(name);
    }
  });

  it("stays reasonably sized (< 25 KB per SVG)", () => {
    for (let seed = 1; seed <= 18; seed += 1) {
      const svg = decode(dreamImageDataUrl(seed, "#3366cc", false));
      expect(svg.length).toBeLessThan(25 * 1024);
    }
  });
});
