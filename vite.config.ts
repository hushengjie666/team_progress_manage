import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const tauriPlatform = process.env.TAURI_ENV_PLATFORM;
const isTauriDebug = Boolean(process.env.TAURI_ENV_DEBUG);

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: tauriPlatform === "windows" ? "chrome105" : "safari13",
    minify: isTauriDebug ? false : "esbuild",
    sourcemap: isTauriDebug,
  },
  envPrefix: ["VITE_", "TAURI_"],
});
