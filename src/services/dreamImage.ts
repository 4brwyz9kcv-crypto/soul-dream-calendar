/**
 * Procedural dream-image generator: a deterministic SVG data URL replacing
 * the legacy Pixabay/DALL-E day image with a zero-key local generator.
 *
 * v2 — ARCHETYPE SYSTEM: the seed selects one of nine distinct composition
 * archetypes (all-seeing eye, radial mandala, circuit world-tree, serpent
 * wave, crystal cluster, winged sigil, planetary scape, rune constellation,
 * labyrinth grid). Palettes are seeded color schemes (complementary /
 * triadic / analogous / split) rotated by a seeded hue shift, backgrounds
 * (nebula gradients, starfields, faint grids, vignettes) are seeded
 * independently of the archetype, and every count/radius/angle/opacity comes
 * from the seeded PRNG — so each archetype yields effectively unlimited
 * variants. Subtle <animate> pulses appear only when motion is allowed.
 * The archetype name is embedded as <desc>archetype:…</desc> and as a
 * data-archetype attribute for debugging and tests.
 */

const WIDTH = 640;
const HEIGHT = 400;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

export const dreamArchetypes = [
  "all-seeing-eye",
  "radial-mandala",
  "circuit-world-tree",
  "serpent-wave",
  "crystal-cluster",
  "winged-sigil",
  "planetary-scape",
  "rune-constellation",
  "labyrinth-grid"
] as const;

export type DreamArchetype = (typeof dreamArchetypes)[number];

/** mulberry32 PRNG, inlined on purpose (this module stays dependency-free). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255 || 0;
  const g = parseInt(full.slice(2, 4), 16) / 255 || 0;
  const b = parseInt(full.slice(4, 6), 16) / 255 || 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue.toFixed(1)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
}

function round(value: number): string {
  return value.toFixed(1);
}

/** Seeded animate pulse fragment (only ever emitted when motion is allowed). */
function pulse(attr: string, values: string, dur: number): string {
  return `<animate attributeName="${attr}" values="${values}" dur="${dur.toFixed(1)}s" repeatCount="indefinite"/>`;
}

/* ------------------------------------------------------------------ */
/* Palette: seeded scheme + hue rotation derived from the day color    */
/* ------------------------------------------------------------------ */

interface Palette {
  hues: readonly [number, number, number];
  sat: number;
  primary: string;
  secondary: string;
  tertiary: string;
  faint: string;
}

function buildPalette(rand: () => number, colorHex: string): Palette {
  const base = hexToHsl(colorHex);
  const schemeIndex = Math.floor(rand() * 4);
  const shift = rand() * 72 - 36; // seeded hue rotation on top of the day color
  const h = base.h + shift;
  const sat = Math.min(Math.max(base.s, 0.55), 0.96);
  const hues: [number, number, number] =
    schemeIndex === 0
      ? [h, h + 180, h + 28] // complementary
      : schemeIndex === 1
        ? [h, h + 120, h + 240] // triadic
        : schemeIndex === 2
          ? [h, h + 32, h - 32] // analogous
          : [h, h + 150, h - 150]; // split-complementary
  return {
    hues,
    sat,
    primary: hsl(hues[0], sat, 0.52 + rand() * 0.2),
    secondary: hsl(hues[1], sat, 0.56 + rand() * 0.14),
    tertiary: hsl(hues[2], sat, 0.58 + rand() * 0.14),
    faint: hsl(hues[0], sat * 0.55, 0.44 + rand() * 0.1)
  };
}

/** Rotating stroke pick from the three palette hues. */
function stroke(p: Palette, index: number): string {
  return index % 3 === 0 ? p.primary : index % 3 === 1 ? p.secondary : p.tertiary;
}

/* ------------------------------------------------------------------ */
/* Background: seeded independently of the archetype                   */
/* ------------------------------------------------------------------ */

function background(rand: () => number, p: Palette, motion: boolean): string[] {
  const parts: string[] = [];
  const baseL = 0.025 + rand() * 0.03;
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${hsl(p.hues[0], 0.32, baseL)}"/>`);

  // nebula radial gradients (0-2, random positions/colors)
  const nebulaCount = rand() < 0.78 ? 1 + Math.floor(rand() * 2) : 0;
  for (let i = 0; i < nebulaCount; i += 1) {
    const gx = (0.15 + rand() * 0.7).toFixed(2);
    const gy = (0.15 + rand() * 0.7).toFixed(2);
    const gr = (0.35 + rand() * 0.4).toFixed(2);
    const tint = i % 2 === 0 ? p.secondary : p.tertiary;
    const op = (0.12 + rand() * 0.16).toFixed(2);
    parts.push(
      `<radialGradient id="neb${i}" cx="${gx}" cy="${gy}" r="${gr}">` +
        `<stop offset="0" stop-color="${tint}" stop-opacity="${op}"/>` +
        `<stop offset="1" stop-color="${tint}" stop-opacity="0"/>` +
        `</radialGradient>`,
      `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#neb${i})"/>`
    );
  }

  // central glow — always present; carries the guaranteed motion pulse
  const glowOp = (0.14 + rand() * 0.12).toFixed(2);
  parts.push(
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="${(0.5 + rand() * 0.2).toFixed(2)}">` +
      `<stop offset="0" stop-color="${p.primary}" stop-opacity="${glowOp}"/>` +
      `<stop offset="1" stop-color="${p.primary}" stop-opacity="0"/>` +
      `</radialGradient>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"${motion ? `>${pulse("opacity", "1;0.55;1", 6 + rand() * 4)}</rect>` : "/>"}`
  );

  // starfield: none / sparse / dense
  const starMode = Math.floor(rand() * 3);
  const starCount = starMode === 1 ? 22 + Math.floor(rand() * 22) : starMode === 2 ? 66 + Math.floor(rand() * 50) : 0;
  for (let i = 0; i < starCount; i += 1) {
    const sx = round(rand() * WIDTH);
    const sy = round(rand() * HEIGHT);
    const sr = (0.4 + rand() * 1.1).toFixed(1);
    const so = (0.12 + rand() * 0.5).toFixed(2);
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#f5f2ea" fill-opacity="${so}"/>`);
  }

  // faint PCB grid
  if (rand() < 0.5) {
    const spacing = 32 + Math.floor(rand() * 4) * 8;
    const gridOp = (0.035 + rand() * 0.035).toFixed(3);
    for (let x = spacing; x < WIDTH; x += spacing) {
      parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="${p.faint}" stroke-opacity="${gridOp}"/>`);
    }
    for (let y = spacing; y < HEIGHT; y += spacing) {
      parts.push(`<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${p.faint}" stroke-opacity="${gridOp}"/>`);
    }
  }

  // vignette
  if (rand() < 0.6) {
    parts.push(
      `<radialGradient id="vig" cx="0.5" cy="0.5" r="0.72">` +
        `<stop offset="0.55" stop-color="#000" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="#000" stop-opacity="${(0.3 + rand() * 0.25).toFixed(2)}"/>` +
        `</radialGradient>`,
      `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vig)"/>`
    );
  }

  return parts;
}

/* ------------------------------------------------------------------ */
/* Archetype renderers                                                 */
/* ------------------------------------------------------------------ */

type Renderer = (rand: () => number, p: Palette, motion: boolean) => string[];

/** 1 · The original all-seeing eye: traces, occult rings, star, iris. */
const allSeeingEye: Renderer = (rand, p, motion) => {
  const parts: string[] = [];

  const traceCount = 6 + Math.floor(rand() * 6); // 6..11
  for (let i = 0; i < traceCount; i += 1) {
    const angle = (i / traceCount) * Math.PI * 2 + rand() * 0.5;
    const startRadius = 220 + rand() * 100;
    const midRadius = 145 + rand() * 55;
    const endRadius = 88 + rand() * 30;
    const bend = (rand() < 0.5 ? -1 : 1) * (Math.PI / 8 + rand() * (Math.PI / 8));
    const x1 = CX + Math.cos(angle) * startRadius;
    const y1 = CY + Math.sin(angle) * startRadius * 0.72;
    const x2 = CX + Math.cos(angle) * midRadius;
    const y2 = CY + Math.sin(angle) * midRadius * 0.72;
    const x3 = CX + Math.cos(angle + bend) * endRadius;
    const y3 = CY + Math.sin(angle + bend) * endRadius * 0.72;
    const col = stroke(p, i);
    parts.push(
      `<polyline points="${round(x1)},${round(y1)} ${round(x2)},${round(y2)} ${round(x3)},${round(y3)}" ` +
        `fill="none" stroke="${col}" stroke-width="${(1 + rand() * 0.8).toFixed(1)}" stroke-opacity="${(0.5 + rand() * 0.3).toFixed(2)}" stroke-linejoin="round"/>`,
      `<circle cx="${round(x2)}" cy="${round(y2)}" r="2.6" fill="#06070b" stroke="${col}" stroke-width="1.2"/>`,
      `<circle cx="${round(x3)}" cy="${round(y3)}" r="3.4" fill="${col}" fill-opacity="0.85"${motion && i % 2 === 0 ? `>${pulse("fill-opacity", "0.85;0.3;0.85", 2.6 + rand() * 2.4)}</circle>` : "/>"}`
    );
  }

  const ringCount = 3 + Math.floor(rand() * 3); // 3..5
  for (let i = 0; i < ringCount; i += 1) {
    const radius = 56 + i * (30 + rand() * 14);
    const col = i % 2 === 0 ? p.primary : p.secondary;
    const dash = rand() < 0.5 ? ` stroke-dasharray="${(4 + rand() * 8).toFixed(1)} ${(6 + rand() * 10).toFixed(1)}"` : "";
    parts.push(
      `<ellipse cx="${CX}" cy="${CY}" rx="${round(radius)}" ry="${round(radius * 0.72)}" ` +
        `fill="none" stroke="${col}" stroke-width="${i === 0 ? 1.6 : 1}" stroke-opacity="${(0.55 - i * 0.07).toFixed(2)}"${dash}/>`
    );
  }

  const starPoints = 5 + Math.floor(rand() * 4); // 5..8
  const outer = 62 + rand() * 22;
  const inner = 24 + rand() * 12;
  const rot = rand() * Math.PI;
  const coords: string[] = [];
  for (let q = 0; q < starPoints * 2; q += 1) {
    const r = q % 2 === 0 ? outer : inner;
    const a = rot + (q / (starPoints * 2)) * Math.PI * 2;
    coords.push(`${round(CX + Math.cos(a) * r)},${round(CY + Math.sin(a) * r * 0.78)}`);
  }
  parts.push(`<polygon points="${coords.join(" ")}" fill="none" stroke="${p.tertiary}" stroke-width="1.1" stroke-opacity="0.65"/>`);

  const lidW = 48 + rand() * 16;
  const lidH = 32 + rand() * 14;
  parts.push(
    `<path d="M ${CX - lidW} ${CY} Q ${CX} ${CY - lidH} ${CX + lidW} ${CY} Q ${CX} ${CY + lidH} ${CX - lidW} ${CY} Z" ` +
      `fill="#0d1115" stroke="${p.primary}" stroke-width="1.8" stroke-opacity="0.9"${motion ? `>${pulse("stroke-opacity", "0.9;0.5;0.9", 7)}</path>` : "/>"}`,
    `<circle cx="${CX}" cy="${CY}" r="${round(lidH * 0.62)}" fill="none" stroke="${p.secondary}" stroke-width="1.4" stroke-opacity="0.8"/>`,
    `<circle cx="${CX}" cy="${CY}" r="${round(lidH * 0.42)}" fill="${p.primary}" fill-opacity="0.9"${motion ? `>${pulse("r", `${round(lidH * 0.42)};${round(lidH * 0.5)};${round(lidH * 0.42)}`, 5)}</circle>` : "/>"}`,
    `<circle cx="${CX}" cy="${CY}" r="4.5" fill="#06070b"/>`,
    `<circle cx="${round(CX + 5)}" cy="${round(CY - 6)}" r="2" fill="#f5f2ea" fill-opacity="0.85"/>`
  );
  return parts;
};

/** 2 · Radial mandala with seeded N-fold rotational symmetry (N 5..12). */
const radialMandala: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  const n = 5 + Math.floor(rand() * 8); // 5..12
  const layers = 2 + Math.floor(rand() * 3); // 2..4
  for (let layer = 0; layer < layers; layer += 1) {
    const r0 = 36 + layer * (30 + rand() * 20);
    const petalLen = 24 + rand() * 36;
    const petalW = 7 + rand() * 15;
    const col = stroke(p, layer);
    const rot0 = rand() * 360;
    const tipY = CY - r0 - petalLen;
    const d =
      `M ${round(CX)} ${round(CY - r0)} ` +
      `C ${round(CX + petalW)} ${round(CY - r0 - petalLen * 0.35)} ${round(CX + petalW * 0.55)} ${round(tipY + petalLen * 0.15)} ${round(CX)} ${round(tipY)} ` +
      `C ${round(CX - petalW * 0.55)} ${round(tipY + petalLen * 0.15)} ${round(CX - petalW)} ${round(CY - r0 - petalLen * 0.35)} ${round(CX)} ${round(CY - r0)} Z`;
    for (let i = 0; i < n; i += 1) {
      const angle = rot0 + (i * 360) / n;
      parts.push(
        `<path d="${d}" fill="${col}" fill-opacity="${(0.05 + rand() * 0.06).toFixed(2)}" stroke="${col}" stroke-width="1.1" stroke-opacity="${(0.5 + rand() * 0.25).toFixed(2)}" transform="rotate(${angle.toFixed(1)} ${CX} ${CY})"/>`
      );
    }
    const dash = rand() < 0.6 ? ` stroke-dasharray="${(3 + rand() * 6).toFixed(1)} ${(4 + rand() * 8).toFixed(1)}"` : "";
    parts.push(`<circle cx="${CX}" cy="${CY}" r="${round(r0)}" fill="none" stroke="${p.faint}" stroke-opacity="0.5"${dash}/>`);
  }
  parts.push(
    `<circle cx="${CX}" cy="${CY}" r="${round(10 + rand() * 12)}" fill="none" stroke="${p.primary}" stroke-width="1.5" stroke-opacity="0.85"/>`,
    `<circle cx="${CX}" cy="${CY}" r="${round(3 + rand() * 4)}" fill="${p.secondary}" fill-opacity="0.9"${motion ? `>${pulse("fill-opacity", "0.9;0.4;0.9", 4 + rand() * 3)}</circle>` : "/>"}`
  );
  return parts;
};

/** 3 · Circuit world-tree: trunk, branching traces, glowing leaf nodes. */
const circuitWorldTree: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  let leafIndex = 0;

  const branch = (x: number, y: number, angle: number, len: number, depth: number): void => {
    const x2 = x + Math.cos(angle) * len;
    const y2 = y - Math.sin(angle) * len;
    parts.push(
      `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${depth > 2 ? p.primary : p.secondary}" stroke-width="${(0.8 + depth * 0.5).toFixed(1)}" stroke-opacity="${(0.45 + depth * 0.1).toFixed(2)}" stroke-linecap="round"/>`
    );
    if (depth === 0) {
      leafIndex += 1;
      const r = 2.2 + rand() * 2.2;
      const glow = motion && leafIndex % 4 === 0;
      parts.push(
        `<circle cx="${round(x2)}" cy="${round(y2)}" r="${r.toFixed(1)}" fill="${stroke(p, leafIndex)}" fill-opacity="0.85"${glow ? `>${pulse("fill-opacity", "0.85;0.25;0.85", 2.4 + rand() * 3)}</circle>` : "/>"}`
      );
      return;
    }
    parts.push(`<circle cx="${round(x2)}" cy="${round(y2)}" r="1.8" fill="#06070b" stroke="${p.faint}" stroke-width="1"/>`);
    const kids = rand() < 0.3 ? 3 : 2;
    for (let k = 0; k < kids; k += 1) {
      const spread = (k - (kids - 1) / 2) * (0.5 + rand() * 0.35) + (rand() * 0.24 - 0.12);
      branch(x2, y2, angle + spread, len * (0.62 + rand() * 0.16), depth - 1);
    }
  };

  const rootX = CX + (rand() * 60 - 30);
  const rootY = HEIGHT - 22;
  // roots
  const rootCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < rootCount; i += 1) {
    const a = -Math.PI / 2 + (rand() * 1.4 - 0.7);
    branchlessRoot(parts, p, rootX, rootY, a, 22 + rand() * 26);
  }
  branch(rootX, rootY, Math.PI / 2 + (rand() * 0.24 - 0.12), 64 + rand() * 30, 4);
  return parts;
};

function branchlessRoot(parts: string[], p: Palette, x: number, y: number, angle: number, len: number): void {
  const x2 = x + Math.cos(angle) * len;
  const y2 = y - Math.sin(angle) * len;
  parts.push(
    `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${p.faint}" stroke-width="1.6" stroke-opacity="0.55" stroke-linecap="round"/>`
  );
}

/** 4 · Serpent wave: layered sine paths with scale nodes and a head. */
const serpentWave: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  const layerCount = 3 + Math.floor(rand() * 4); // 3..6
  let mainPoints: Array<[number, number]> = [];
  for (let layer = 0; layer < layerCount; layer += 1) {
    const amp = 18 + rand() * 52;
    const cycles = 1 + rand() * 2.2;
    const phase = rand() * Math.PI * 2;
    const yMid = 80 + rand() * 240;
    const pts: Array<[number, number]> = [];
    for (let x = -8; x <= WIDTH + 8; x += 16) {
      const y = yMid + Math.sin((x / WIDTH) * cycles * Math.PI * 2 + phase) * amp;
      pts.push([x, y]);
    }
    const col = stroke(p, layer);
    parts.push(
      `<polyline points="${pts.map(([x, y]) => `${round(x)},${round(y)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="${(1 + rand() * 1.6).toFixed(1)}" stroke-opacity="${(0.3 + rand() * 0.4).toFixed(2)}" stroke-linejoin="round"/>`
    );
    if (layer === 0) mainPoints = pts;
  }
  // scales along the main serpent
  for (let i = 2; i < mainPoints.length - 2; i += 2) {
    const [x, y] = mainPoints[i];
    parts.push(
      `<circle cx="${round(x)}" cy="${round(y)}" r="${(1.8 + rand() * 1.6).toFixed(1)}" fill="${i % 4 === 0 ? p.secondary : p.tertiary}" fill-opacity="${(0.4 + rand() * 0.4).toFixed(2)}"/>`
    );
  }
  // head at the right end
  const [hx, hy] = mainPoints[mainPoints.length - 1];
  const headR = 5 + rand() * 4;
  parts.push(
    `<circle cx="${round(hx - 6)}" cy="${round(hy)}" r="${headR.toFixed(1)}" fill="${p.primary}" fill-opacity="0.9"${motion ? `>${pulse("fill-opacity", "0.9;0.5;0.9", 3 + rand() * 3)}</circle>` : "/>"}`,
    `<circle cx="${round(hx - 6 + headR * 0.3)}" cy="${round(hy - headR * 0.3)}" r="1.6" fill="#06070b"/>`
  );
  return parts;
};

/** 5 · Crystal cluster: sharp seeded polygons with facet highlights. */
const crystalCluster: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  const count = 5 + Math.floor(rand() * 5); // 5..9
  const baseX = CX + (rand() * 90 - 45);
  const baseY = CY + 74 + rand() * 40;
  parts.push(
    `<ellipse cx="${round(baseX)}" cy="${round(baseY + 8)}" rx="${round(90 + rand() * 60)}" ry="${round(14 + rand() * 10)}" fill="${p.faint}" fill-opacity="0.14"/>`
  );
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI / 2 + (rand() * 1.7 - 0.85);
    const len = 58 + rand() * 108;
    const w = 9 + rand() * 24;
    const bx = baseX + (rand() * 110 - 55);
    const apexX = bx + Math.cos(angle) * len;
    const apexY = baseY - Math.sin(angle) * len;
    const perp = angle + Math.PI / 2;
    const lx = bx + Math.cos(perp) * w;
    const ly = baseY - Math.sin(perp) * w;
    const rx = bx - Math.cos(perp) * w;
    const ry = baseY + Math.sin(perp) * w;
    const col = stroke(p, i);
    parts.push(
      `<polygon points="${round(lx)},${round(ly)} ${round(apexX)},${round(apexY)} ${round(rx)},${round(ry)}" fill="${col}" fill-opacity="${(0.1 + rand() * 0.14).toFixed(2)}" stroke="${col}" stroke-width="1.2" stroke-opacity="${(0.55 + rand() * 0.3).toFixed(2)}" stroke-linejoin="round"/>`,
      `<line x1="${round(apexX)}" y1="${round(apexY)}" x2="${round(bx)}" y2="${round(baseY)}" stroke="#f5f2ea" stroke-width="0.7" stroke-opacity="${(0.2 + rand() * 0.25).toFixed(2)}"/>`
    );
    if (rand() < 0.5) {
      const sx = apexX + (rand() * 18 - 9);
      const sy = apexY - 6 - rand() * 12;
      const sl = 3 + rand() * 4;
      const spark =
        `<line x1="${round(sx - sl)}" y1="${round(sy)}" x2="${round(sx + sl)}" y2="${round(sy)}" stroke="#f5f2ea" stroke-width="0.8" stroke-opacity="0.7"/>` +
        `<line x1="${round(sx)}" y1="${round(sy - sl)}" x2="${round(sx)}" y2="${round(sy + sl)}" stroke="#f5f2ea" stroke-width="0.8" stroke-opacity="0.7"/>`;
      parts.push(motion && i % 3 === 0 ? `<g opacity="0.8">${pulse("opacity", "0.8;0.2;0.8", 2 + rand() * 3)}${spark}</g>` : spark);
    }
  }
  return parts;
};

/** 6 · Winged sigil: bilateral wing pairs around a core glyph. */
const wingedSigil: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  const feathers = 4 + Math.floor(rand() * 4); // 4..7 per wing
  const wingSpan = 150 + rand() * 90;
  const lift = 0.35 + rand() * 0.5;
  for (const side of [-1, 1]) {
    for (let f = 0; f < feathers; f += 1) {
      const t = f / (feathers - 1);
      const len = wingSpan * (0.55 + t * 0.45) * (0.92 + rand() * 0.16);
      const upAngle = lift * (1 - t) + rand() * 0.08;
      const tipX = CX + side * (24 + Math.cos(upAngle) * len);
      const tipY = CY - Math.sin(upAngle) * len + t * (30 + rand() * 24);
      const ctrlX = CX + side * (30 + len * 0.4);
      const ctrlY = CY - len * (0.5 + lift * 0.5) + t * 16;
      const col = stroke(p, f);
      parts.push(
        `<path d="M ${round(CX + side * 18)} ${round(CY)} Q ${round(ctrlX)} ${round(ctrlY)} ${round(tipX)} ${round(tipY)}" fill="none" stroke="${col}" stroke-width="${(1 + rand() * 1).toFixed(1)}" stroke-opacity="${(0.4 + rand() * 0.35).toFixed(2)}"/>`,
        `<circle cx="${round(tipX)}" cy="${round(tipY)}" r="${(1.6 + rand() * 1.6).toFixed(1)}" fill="${col}" fill-opacity="0.8"/>`
      );
    }
  }
  const coreR = 15 + rand() * 11;
  const glyphSides = 3 + Math.floor(rand() * 3); // 3..5 core polygon
  const rot = rand() * Math.PI;
  const coords: string[] = [];
  for (let q = 0; q < glyphSides; q += 1) {
    const a = rot + (q / glyphSides) * Math.PI * 2;
    coords.push(`${round(CX + Math.cos(a) * coreR * 0.62)},${round(CY + Math.sin(a) * coreR * 0.62)}`);
  }
  parts.push(
    `<circle cx="${CX}" cy="${CY}" r="${round(coreR + 8)}" fill="none" stroke="${p.faint}" stroke-opacity="0.5" stroke-dasharray="3 5"/>`,
    `<circle cx="${CX}" cy="${CY}" r="${round(coreR)}" fill="#0d1115" stroke="${p.primary}" stroke-width="1.6" stroke-opacity="0.9"${motion ? `>${pulse("stroke-opacity", "0.9;0.5;0.9", 5 + rand() * 3)}</circle>` : "/>"}`,
    `<polygon points="${coords.join(" ")}" fill="${p.secondary}" fill-opacity="0.5" stroke="${p.secondary}" stroke-width="1"/>`
  );
  return parts;
};

/** 7 · Planetary scape: planet, ring systems, moons and comet trails. */
const planetaryScape: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  const planetR = 52 + rand() * 56;
  const px = CX + (rand() * 160 - 80);
  const py = CY + (rand() * 56 - 28);
  parts.push(
    `<clipPath id="pl"><circle cx="${round(px)}" cy="${round(py)}" r="${round(planetR)}"/></clipPath>`,
    `<circle cx="${round(px)}" cy="${round(py)}" r="${round(planetR)}" fill="${hsl(p.hues[1], p.sat * 0.5, 0.14)}" stroke="${p.primary}" stroke-width="1.4" stroke-opacity="0.85"/>`
  );
  const bands = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < bands; i += 1) {
    const by = py - planetR + (i + 0.5) * ((planetR * 2) / bands) + (rand() * 8 - 4);
    parts.push(
      `<ellipse cx="${round(px)}" cy="${round(by)}" rx="${round(planetR * 1.05)}" ry="${round(4 + rand() * 9)}" fill="none" stroke="${stroke(p, i + 1)}" stroke-opacity="${(0.25 + rand() * 0.3).toFixed(2)}" clip-path="url(#pl)"/>`
    );
  }
  const rings = 1 + Math.floor(rand() * 3);
  const tilt = rand() * 40 - 20;
  for (let i = 0; i < rings; i += 1) {
    const rx = planetR * (1.35 + i * 0.28 + rand() * 0.12);
    parts.push(
      `<ellipse cx="${round(px)}" cy="${round(py)}" rx="${round(rx)}" ry="${round(rx * (0.2 + rand() * 0.12))}" fill="none" stroke="${i % 2 === 0 ? p.secondary : p.tertiary}" stroke-width="${(0.8 + rand() * 0.8).toFixed(1)}" stroke-opacity="${(0.4 + rand() * 0.3).toFixed(2)}" transform="rotate(${tilt.toFixed(1)} ${round(px)} ${round(py)})"/>`
    );
  }
  const moons = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < moons; i += 1) {
    const orbitR = planetR * (1.9 + i * 0.5 + rand() * 0.3);
    const a = rand() * Math.PI * 2;
    const mx = px + Math.cos(a) * orbitR;
    const my = py + Math.sin(a) * orbitR * 0.42;
    parts.push(
      `<ellipse cx="${round(px)}" cy="${round(py)}" rx="${round(orbitR)}" ry="${round(orbitR * 0.42)}" fill="none" stroke="${p.faint}" stroke-opacity="0.3" stroke-dasharray="2 6"/>`,
      `<circle cx="${round(mx)}" cy="${round(my)}" r="${(3 + rand() * 4).toFixed(1)}" fill="${stroke(p, i)}" fill-opacity="0.9"${motion && i === 0 ? `>${pulse("fill-opacity", "0.9;0.45;0.9", 3.5 + rand() * 3)}</circle>` : "/>"}`
    );
  }
  const comets = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < comets; i += 1) {
    const cx0 = 40 + rand() * (WIDTH - 80);
    const cy0 = 24 + rand() * 120;
    const dx = 26 + rand() * 40;
    const dy = 8 + rand() * 18;
    parts.push(
      `<line x1="${round(cx0 - dx)}" y1="${round(cy0 - dy)}" x2="${round(cx0)}" y2="${round(cy0)}" stroke="${p.tertiary}" stroke-width="1" stroke-opacity="0.5"/>`,
      `<circle cx="${round(cx0)}" cy="${round(cy0)}" r="${(1.6 + rand() * 1.4).toFixed(1)}" fill="#f5f2ea" fill-opacity="0.85"/>`
    );
  }
  return parts;
};

/** 8 · Rune constellation: glyph nodes connected by faint traces. */
const runeConstellation: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  const glyphs = ["◈", "✦", "⌬", "⏣", "☽", "◇", "△", "⌖", "✧"];
  const count = 7 + Math.floor(rand() * 8); // 7..14
  const nodes: Array<[number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    nodes.push([48 + rand() * (WIDTH - 96), 40 + rand() * (HEIGHT - 80)]);
  }
  // sequential trace + a few cross links
  for (let i = 1; i < count; i += 1) {
    parts.push(
      `<line x1="${round(nodes[i - 1][0])}" y1="${round(nodes[i - 1][1])}" x2="${round(nodes[i][0])}" y2="${round(nodes[i][1])}" stroke="${p.faint}" stroke-width="0.8" stroke-opacity="${(0.22 + rand() * 0.2).toFixed(2)}"/>`
    );
  }
  for (let i = 0; i + 3 < count; i += 3) {
    parts.push(
      `<line x1="${round(nodes[i][0])}" y1="${round(nodes[i][1])}" x2="${round(nodes[i + 3][0])}" y2="${round(nodes[i + 3][1])}" stroke="${p.secondary}" stroke-width="0.6" stroke-opacity="0.18"/>`
    );
  }
  for (let i = 0; i < count; i += 1) {
    const [x, y] = nodes[i];
    const size = 13 + Math.floor(rand() * 18);
    const glyph = glyphs[Math.floor(rand() * glyphs.length)];
    const col = stroke(p, i);
    if (rand() < 0.4) {
      parts.push(`<circle cx="${round(x)}" cy="${round(y)}" r="${round(size * 0.75)}" fill="${col}" fill-opacity="0.07"/>`);
    }
    const glow = motion && i % 5 === 0;
    parts.push(
      `<text x="${round(x)}" y="${round(y + size * 0.34)}" font-size="${size}" fill="${col}" fill-opacity="${(0.6 + rand() * 0.35).toFixed(2)}" text-anchor="middle"${glow ? `>${pulse("fill-opacity", "0.9;0.35;0.9", 2.8 + rand() * 3)}${glyph}</text>` : `>${glyph}</text>`}`
    );
  }
  return parts;
};

/** 9 · Labyrinth grid: orthogonal maze traces around a glowing center. */
const labyrinthGrid: Renderer = (rand, p, motion) => {
  const parts: string[] = [];
  const cell = 40 + Math.floor(rand() * 2) * 8; // 40 or 48
  const clearR = 64 + rand() * 28;
  let idx = 0;
  for (let gx = cell / 2; gx < WIDTH; gx += cell) {
    for (let gy = cell / 2; gy < HEIGHT; gy += cell) {
      const dx = gx - CX;
      const dy = gy - CY;
      if (Math.sqrt(dx * dx + dy * dy) < clearR) continue;
      idx += 1;
      const h = cell * 0.5 - 4;
      const orient = Math.floor(rand() * 4);
      const col = idx % 4 === 0 ? p.secondary : idx % 7 === 0 ? p.tertiary : p.faint;
      const op = (0.24 + rand() * 0.3).toFixed(2);
      // L-shaped circuit elbow in one of four orientations
      const d =
        orient === 0
          ? `M ${round(gx - h)} ${round(gy)} L ${round(gx)} ${round(gy)} L ${round(gx)} ${round(gy - h)}`
          : orient === 1
            ? `M ${round(gx + h)} ${round(gy)} L ${round(gx)} ${round(gy)} L ${round(gx)} ${round(gy - h)}`
            : orient === 2
              ? `M ${round(gx - h)} ${round(gy)} L ${round(gx)} ${round(gy)} L ${round(gx)} ${round(gy + h)}`
              : `M ${round(gx + h)} ${round(gy)} L ${round(gx)} ${round(gy)} L ${round(gx)} ${round(gy + h)}`;
      parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.1" stroke-opacity="${op}"/>`);
      if (rand() < 0.16) {
        parts.push(`<circle cx="${round(gx)}" cy="${round(gy)}" r="1.8" fill="#06070b" stroke="${col}" stroke-width="1" stroke-opacity="0.6"/>`);
      }
    }
  }
  // glowing center
  const rings = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < rings; i += 1) {
    const s = 18 + i * (14 + rand() * 8);
    parts.push(
      `<rect x="${round(CX - s)}" y="${round(CY - s)}" width="${round(s * 2)}" height="${round(s * 2)}" fill="none" stroke="${i % 2 === 0 ? p.primary : p.secondary}" stroke-width="1.3" stroke-opacity="${(0.6 - i * 0.12).toFixed(2)}" transform="rotate(${(rand() * 8 - 4).toFixed(1)} ${CX} ${CY})"/>`
    );
  }
  parts.push(
    `<circle cx="${CX}" cy="${CY}" r="${round(7 + rand() * 6)}" fill="${p.primary}" fill-opacity="0.85"${motion ? `>${pulse("fill-opacity", "0.85;0.35;0.85", 3.5 + rand() * 3)}</circle>` : "/>"}`
  );
  return parts;
};

const renderers: Record<DreamArchetype, Renderer> = {
  "all-seeing-eye": allSeeingEye,
  "radial-mandala": radialMandala,
  "circuit-world-tree": circuitWorldTree,
  "serpent-wave": serpentWave,
  "crystal-cluster": crystalCluster,
  "winged-sigil": wingedSigil,
  "planetary-scape": planetaryScape,
  "rune-constellation": runeConstellation,
  "labyrinth-grid": labyrinthGrid
};

/** Archetype the given seed resolves to (exposed for tests/debugging). */
export function dreamArchetypeFor(seed: number): DreamArchetype {
  return dreamArchetypes[(seed >>> 0) % dreamArchetypes.length];
}

/**
 * Deterministic dream image for the day. Returns an URL-encoded
 * `data:image/svg+xml;utf8,...` string, crisp at ~640x400.
 */
export function dreamImageDataUrl(seed: number, colorHex: string, reduceMotion: boolean): string {
  const s = seed >>> 0;
  const archetype = dreamArchetypeFor(s);
  const rand = mulberry32((s ^ 0x51ed270b) >>> 0); // archetype parameters
  const bgRand = mulberry32((s ^ 0x9e3779b9) >>> 0); // background, independent of archetype
  const palRand = mulberry32((s ^ 0x85ebca6b) >>> 0); // palette scheme + hue shift
  const palette = buildPalette(palRand, colorHex);
  const motion = !reduceMotion;

  const parts = [...background(bgRand, palette, motion), ...renderers[archetype](rand, palette, motion)];

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" data-archetype="${archetype}">` +
    `<desc>archetype:${archetype}</desc>` +
    parts.join("") +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
