import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Traegt eine echte Version in den Service Worker ein.
 *
 * public/sw.js wird von Vite unveraendert kopiert, kann also keinen
 * Build-Hash von sich aus kennen. Ohne diesen Schritt bliebe der Cache-Name
 * ueber alle Deploys hinweg derselbe - Nutzer haetten alte Dateien behalten,
 * ohne dass es jemandem auffaellt.
 *
 * Die Version ist ein Hash der tatsaechlich ausgelieferten Dateinamen. Aendert
 * sich am Bundle nichts, bleibt sie gleich und der Cache ueberlebt zu Recht.
 */
function serviceWorkerVersion(): Plugin {
  return {
    name: "sdc-service-worker-version",
    apply: "build",

    /**
     * Der Service Worker wird als Build-Asset ERZEUGT, nicht aus public/
     * kopiert.
     *
     * Der naheliegende Weg - public/sw.js nachtraeglich im Ausgabeordner
     * ersetzen - funktioniert nicht: Vite kopiert public/ nach allen
     * Bundle-Hooks und buegelt die Ersetzung wieder weg. Als emittiertes
     * Asset ist sw.js Teil des Bundles, und die Frage der Reihenfolge
     * stellt sich gar nicht erst.
     */
    async generateBundle(_options, bundle) {
      // Vor dem Emit lesen, damit sw.js nicht in den eigenen Hash eingeht.
      const fingerprint = Object.keys(bundle).sort().join("|");
      const version = createHash("sha256").update(fingerprint).digest("hex").slice(0, 12);

      const template = await readFile(
        fileURLToPath(new URL("./src/sw.js", import.meta.url)),
        "utf8"
      );
      if (!template.includes("__SDC_VERSION__")) {
        this.warn("src/sw.js hat keinen Versions-Platzhalter - Cache-Name bliebe statisch.");
      }

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        // replaceAll, nicht replace: der Platzhalter kommt auch im
        // Dateikommentar vor, und replace haette nur diesen ersten Treffer
        // ersetzt - die Konstante darunter waere unveraendert geblieben.
        source: template.replaceAll("__SDC_VERSION__", version)
      });
      this.info(`Service-Worker-Cache: sdc-${version}`);
    }
  };
}

/**
 * Setzt die absolute Adresse fuer og:image.
 *
 * Open-Graph-Scraper loesen relative Bildpfade nicht zuverlaessig auf, die
 * Adresse muss also absolut im HTML stehen. Sie ist aber je Deployment
 * verschieden - Hauptseite und Vorschau liegen unter verschiedenen Pfaden.
 *
 * `SDC_SITE_URL` ueberschreibt die Vorgabe, z. B.:
 *   SDC_SITE_URL=https://user.github.io/soul-dream-calendar-next/ npm run build
 */
function siteUrl(): Plugin {
  const CANONICAL = "https://4brwyz9kcv-crypto.github.io/soul-dream-calendar/";
  const base = (process.env.SDC_SITE_URL ?? CANONICAL).replace(/\/?$/, "/");

  return {
    name: "sdc-site-url",
    transformIndexHtml(html) {
      return html.replaceAll("%SDC_SITE_URL%", base);
    }
  };
}

export default defineConfig({
  // Relative base so the same build works on GitHub Pages subpaths, LAN preview and Tauri.
  base: "./",
  plugins: [react(), serviceWorkerVersion(), siteUrl()],
  resolve: {
    alias: {
      "@angel-assets": fileURLToPath(new URL("./src/services/angelAssets.full.ts", import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: false
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
