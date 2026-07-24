import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the same build works on GitHub Pages subpaths, LAN preview and Tauri.
  base: "./",
  plugins: [react()],
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
