/* Kompakter Einzeldatei-Build: nur die leichten Poster kommen mit hinein.
   Die Animationen (~1,6 MB je Engel) stuenden als Base64 im HTML und machten
   die Datei auf dem Handy unbrauchbar, also zeigen hier beide Varianten
   dasselbe Standbild. */
import type { AngelSources } from "./angelAssets.full";

import seraphPoster from "../assets/angels/poster/seraph-eye-pcb-sigil.webp";
import wingedPoster from "../assets/angels/poster/winged-eye-pcb.webp";
import terminalPoster from "../assets/angels/poster/terminal-third-eye.webp";
import spiralPoster from "../assets/angels/poster/spiral-eye-pcb-wings.webp";

export const angelSources: AngelSources = {
  seraph: { animatedSrc: seraphPoster, posterSrc: seraphPoster },
  winged: { animatedSrc: wingedPoster, posterSrc: wingedPoster },
  terminal: { animatedSrc: terminalPoster, posterSrc: terminalPoster },
  spiral: { animatedSrc: spiralPoster, posterSrc: spiralPoster }
};
