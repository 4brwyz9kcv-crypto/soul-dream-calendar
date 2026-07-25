/**
 * Wandelt die Engel-Assets in moderne Formate um.
 *
 * Ausgangslage: vier animierte GIFs zu je ~2,5 MB in der Mobil-Variante und
 * vier Poster-PNGs zu je ~0,5 MB. GIF kann nur 256 Farben und komprimiert
 * Bewegtbild miserabel - fuer denselben Bildinhalt braucht animiertes WebP
 * typisch ein Zehntel.
 *
 * Aufruf: `npm run assets:convert`. Die Quellen bleiben unangetastet im
 * Repository liegen, damit sich jederzeit neu kodieren laesst.
 */
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../src/assets/angels", import.meta.url));

/** Qualitaet fuer die Animation. 72 ist der Punkt, ab dem die Leiterbahnen
 *  in den dunklen Flaechen anfangen zu blocken - darueber wird es nur groesser. */
const ANIMATED_QUALITY = 72;
const POSTER_QUALITY = 82;

function format(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function convert(dir, animated) {
  const folder = join(ROOT, dir);
  const files = (await readdir(folder)).filter((name) =>
    [".gif", ".png"].includes(extname(name).toLowerCase())
  );

  let before = 0;
  let after = 0;

  for (const file of files) {
    const source = join(folder, file);
    const target = join(folder, `${basename(file, extname(file))}.webp`);

    await sharp(source, { animated })
      .webp({
        quality: animated ? ANIMATED_QUALITY : POSTER_QUALITY,
        // Bei Animationen kostet ein hoeherer Aufwand nur Rechenzeit im Build,
        // nicht beim Nutzer - also maximal.
        effort: 6
      })
      .toFile(target);

    const sourceSize = (await stat(source)).size;
    const targetSize = (await stat(target)).size;
    before += sourceSize;
    after += targetSize;

    const saved = (100 - (targetSize / sourceSize) * 100).toFixed(0);
    console.log(`  ${file.padEnd(32)} ${format(sourceSize).padStart(9)} -> ${format(targetSize).padStart(9)}  (-${saved}%)`);
  }

  return { before, after };
}

console.log("\nmobile (animiert):");
const mobile = await convert("mobile", true);
console.log("\nposter (Standbild):");
const poster = await convert("poster", false);

const before = mobile.before + poster.before;
const after = mobile.after + poster.after;
console.log(
  `\nGesamt: ${format(before)} -> ${format(after)} (-${(100 - (after / before) * 100).toFixed(0)}%)\n`
);
