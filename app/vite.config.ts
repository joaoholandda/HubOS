import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração recomendada pelo Tauri: porta fixa e sem limpar o terminal.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // WebView2 é Chromium atual: dá para mirar em JS moderno.
    target: "es2022",
    sourcemap: false,
  },
});
