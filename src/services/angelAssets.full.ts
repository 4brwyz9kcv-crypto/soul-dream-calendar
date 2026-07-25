import type { AngelAsset } from "../types";

/**
 * Die Engel-Grafiken fuer den regulaeren Build.
 *
 * Zwei Varianten pro Engel:
 * - `posterSrc`: Standbild (~80 KB), wird sofort geladen und angezeigt.
 * - `animatedSrc`: die Animation (~1,6 MB), wird erst nach dem ersten Paint
 *   nachgeholt und dann eingeblendet - siehe AngelCompanion.
 *
 * Beide sind WebP. Dieselben Bilder wogen als GIF 2,5 MB bzw. 0,5 MB; GIF
 * kennt nur 256 Farben und komprimiert Bewegtbild schlecht.
 *
 * Die 384-px-Originale in `../assets/angels/full/` (je ~16 MB) waren hier
 * frueher mit eingebunden, wurden aber nirgends angezeigt - sie lagen bloss
 * im Bundle. Sie bleiben als Quellmaterial im Repository und werden nicht
 * mehr importiert.
 */

import seraphAnimated from "../assets/angels/mobile/seraph-eye-pcb-sigil.webp";
import seraphPoster from "../assets/angels/poster/seraph-eye-pcb-sigil.webp";
import wingedAnimated from "../assets/angels/mobile/winged-eye-pcb.webp";
import wingedPoster from "../assets/angels/poster/winged-eye-pcb.webp";
import terminalAnimated from "../assets/angels/mobile/terminal-third-eye.webp";
import terminalPoster from "../assets/angels/poster/terminal-third-eye.webp";
import spiralAnimated from "../assets/angels/mobile/spiral-eye-pcb-wings.webp";
import spiralPoster from "../assets/angels/poster/spiral-eye-pcb-wings.webp";

export type AngelSources = Record<
  "seraph" | "winged" | "terminal" | "spiral",
  Pick<AngelAsset, "animatedSrc" | "posterSrc">
>;

export const angelSources: AngelSources = {
  seraph: { animatedSrc: seraphAnimated, posterSrc: seraphPoster },
  winged: { animatedSrc: wingedAnimated, posterSrc: wingedPoster },
  terminal: { animatedSrc: terminalAnimated, posterSrc: terminalPoster },
  spiral: { animatedSrc: spiralAnimated, posterSrc: spiralPoster }
};
