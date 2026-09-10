import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed to GitHub Pages at /subkill/, so assets need that base path.
// Navigation is state-based rather than URL-routed, so no SPA fallback is needed.
export default defineConfig({
  base: process.env.SUBKILL_BASE ?? "/subkill/",
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    host: true,
  },
});
