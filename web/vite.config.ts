import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev, the API runs on :3000 and Vite proxies to it, so the web app always uses same-origin paths.
// In prod (Render static site), VITE_API_URL points at the API service.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // reachable from your phone on the same wifi
    proxy: {
      "/api": "http://localhost:3000",
      "/live": { target: "ws://localhost:3000", ws: true },
    },
  },
});
