/* Compact single-file build: `npm run build:compact` produces one standalone
   HTML file (dist-compact/index.html) with all JS/CSS/images inlined, using
   the poster-only angel assets so the file stays phone-friendly. */
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      // The standalone file has no sidecar assets, so PWA links would only 404.
      name: "strip-pwa-links",
      transformIndexHtml(html) {
        return html
          .replace(/^\s*<link rel="manifest".*\r?\n/m, "")
          .replace(/^\s*<link rel="apple-touch-icon".*\r?\n/m, "");
      }
    }
  ],
  resolve: {
    alias: {
      "@angel-assets": fileURLToPath(new URL("./src/services/angelAssets.compact.ts", import.meta.url))
    }
  },
  publicDir: false,
  build: {
    outDir: "dist-compact",
    emptyOutDir: true
  }
});
