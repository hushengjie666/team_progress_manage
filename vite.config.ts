import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { autoraLocalPlugin } from "./scripts/autora-local.mjs";

const tauriPlatform = process.env.TAURI_ENV_PLATFORM;
const isTauriDebug = Boolean(process.env.TAURI_ENV_DEBUG);

export default defineConfig(({ mode }) => ({
  plugins: [react(), autoraLocalPlugin({ ...loadEnv(mode, process.cwd(), "AUTORA_"), ...process.env })],
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
}));
