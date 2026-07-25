/**
 * Erzeugt das Vorschaubild fuer geteilte Links (Open Graph / Twitter Card)
 * und das favicon.ico.
 *
 * Ohne og:image zeigen WhatsApp, Signal, Slack und Mastodon beim Teilen nur
 * einen grauen Kasten - fuer etwas, das ein Produkt sein soll, der erste
 * Eindruck.
 *
 * Aufruf: `npm run assets:og`
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const ANGEL = fileURLToPath(
  new URL("../src/assets/angels/poster/seraph-eye-pcb-sigil.webp", import.meta.url)
);

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#06070b";
const VIOLET = "#9b4dff";
const TEXT = "#f5f2ea";
const MUTED = "#a6aaa7";

/* Leiterbahn-Raster im Hintergrund - dieselbe Bildsprache wie die App. */
const traces = Array.from({ length: 14 }, (_, index) => {
  const y = 40 + index * 44;
  return `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${VIOLET}" stroke-width="1" opacity="0.07"/>`;
}).join("");

const layout = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
  ${traces}
  <rect x="0" y="0" width="6" height="${HEIGHT}" fill="${VIOLET}"/>
  <text x="72" y="250" font-family="Inter, Segoe UI, sans-serif" font-size="34"
        fill="${MUTED}" letter-spacing="10">S . O . U . L</text>
  <text x="70" y="332" font-family="Inter, Segoe UI, sans-serif" font-size="66"
        font-weight="700" fill="${TEXT}">Soul Dream Calendar</text>
  <text x="72" y="392" font-family="Inter, Segoe UI, sans-serif" font-size="27" fill="${MUTED}">
    Tagesorakel, Numerologie und Traum-Sigillen
  </text>
  <text x="72" y="432" font-family="Inter, Segoe UI, sans-serif" font-size="27" fill="${MUTED}">
    Lokal auf deinem Gerät. Kein Konto, kein Server.
  </text>
  <circle cx="${WIDTH - 232}" cy="315" r="196" fill="none" stroke="${VIOLET}" stroke-width="1" opacity="0.35"/>
  <circle cx="${WIDTH - 232}" cy="315" r="214" fill="none" stroke="${VIOLET}" stroke-width="1" opacity="0.18"/>
</svg>`;

const ANGEL_SIZE = 340;

/* Das Poster hat einen schwarzen, quadratischen Rand. Unmaskiert steht es als
   Kasten quer in den Ringen; die runde Maske laesst es stattdessen darin
   sitzen. Der weiche Rand blendet die Kante gegen den Hintergrund aus. */
const mask = Buffer.from(`
<svg width="${ANGEL_SIZE}" height="${ANGEL_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="fade">
      <stop offset="72%" stop-color="#fff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="${ANGEL_SIZE / 2}" cy="${ANGEL_SIZE / 2}" r="${ANGEL_SIZE / 2}" fill="url(#fade)"/>
</svg>`);

const angel = await sharp(ANGEL)
  .resize(ANGEL_SIZE, ANGEL_SIZE)
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();

const og = await sharp(Buffer.from(layout))
  .composite([{ input: angel, left: WIDTH - 232 - 170, top: 315 - 170 }])
  .png()
  .toBuffer();

await writeFile(new URL("../public/og-image.png", import.meta.url), og);
console.log(`og-image.png  ${(og.length / 1024).toFixed(0)} KB  ${WIDTH}x${HEIGHT}`);

/* favicon.ico: 32px reicht, moderne Browser nehmen ohnehin das PNG aus dem
   Manifest. Die .ico ist fuer alles, was blind /favicon.ico anfragt. */
const favicon = await sharp(ANGEL).resize(32, 32).toFormat("png").toBuffer();
await writeFile(new URL("../public/favicon.ico", import.meta.url), favicon);
console.log(`favicon.ico   ${(favicon.length / 1024).toFixed(1)} KB  32x32`);

await writeFile(
  new URL("../public/robots.txt", import.meta.url),
  ["User-agent: *", "Allow: /", ""].join("\n")
);
console.log("robots.txt");

console.log(`\nZiel: ${PUBLIC}\n`);
