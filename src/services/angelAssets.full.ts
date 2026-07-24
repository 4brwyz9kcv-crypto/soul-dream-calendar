import type { AngelAsset } from "../types";

import seraphFull from "../assets/angels/full/seraph-eye-pcb-sigil.gif";
import seraphMobile from "../assets/angels/mobile/seraph-eye-pcb-sigil.gif";
import seraphPoster from "../assets/angels/poster/seraph-eye-pcb-sigil.png";
import wingedFull from "../assets/angels/full/winged-eye-pcb.gif";
import wingedMobile from "../assets/angels/mobile/winged-eye-pcb.gif";
import wingedPoster from "../assets/angels/poster/winged-eye-pcb.png";
import terminalFull from "../assets/angels/full/terminal-third-eye.gif";
import terminalMobile from "../assets/angels/mobile/terminal-third-eye.gif";
import terminalPoster from "../assets/angels/poster/terminal-third-eye.png";
import spiralFull from "../assets/angels/full/spiral-eye-pcb-wings.gif";
import spiralMobile from "../assets/angels/mobile/spiral-eye-pcb-wings.gif";
import spiralPoster from "../assets/angels/poster/spiral-eye-pcb-wings.png";

export type AngelSources = Record<
  "seraph" | "winged" | "terminal" | "spiral",
  Pick<AngelAsset, "fullSrc" | "mobileSrc" | "posterSrc">
>;

export const angelSources: AngelSources = {
  seraph: { fullSrc: seraphFull, mobileSrc: seraphMobile, posterSrc: seraphPoster },
  winged: { fullSrc: wingedFull, mobileSrc: wingedMobile, posterSrc: wingedPoster },
  terminal: { fullSrc: terminalFull, mobileSrc: terminalMobile, posterSrc: terminalPoster },
  spiral: { fullSrc: spiralFull, mobileSrc: spiralMobile, posterSrc: spiralPoster }
};
