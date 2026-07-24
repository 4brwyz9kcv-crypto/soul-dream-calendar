/* Compact single-file build: only the lightweight poster PNGs are bundled.
   The animated GIF variants (up to ~17 MB each) would make the standalone
   HTML unusable on phones, so every slot points at the poster. */
import type { AngelSources } from "./angelAssets.full";

import seraphPoster from "../assets/angels/poster/seraph-eye-pcb-sigil.png";
import wingedPoster from "../assets/angels/poster/winged-eye-pcb.png";
import terminalPoster from "../assets/angels/poster/terminal-third-eye.png";
import spiralPoster from "../assets/angels/poster/spiral-eye-pcb-wings.png";

export const angelSources: AngelSources = {
  seraph: { fullSrc: seraphPoster, mobileSrc: seraphPoster, posterSrc: seraphPoster },
  winged: { fullSrc: wingedPoster, mobileSrc: wingedPoster, posterSrc: wingedPoster },
  terminal: { fullSrc: terminalPoster, mobileSrc: terminalPoster, posterSrc: terminalPoster },
  spiral: { fullSrc: spiralPoster, mobileSrc: spiralPoster, posterSrc: spiralPoster }
};
