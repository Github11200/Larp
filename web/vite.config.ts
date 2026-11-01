import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// In dev, the API runs on :3000 and Vite proxies to it, so the web app always uses same-origin paths.
// In prod (Render static site), VITE_API_URL points at the API service.
// VITE_API_URL is baked in at build time. Blank on Render = every call hits the static site, so fail the build loudly.
if (process.env.RENDER && !process.env.VITE_API_URL?.trim()) {
  throw new Error("VITE_API_URL is not set. In Render → larp-web → Environment, set it to larp-api's URL (e.g. https://larp-api.onrender.com).");
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app: shell + fonts are precached so it opens instantly at the venue.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon.svg"],
      manifest: {
        name: "Larp: your networking earpiece",
        short_name: "Larp",
        description: "Larp as the most prepared person in the room.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#070707",
        theme_color: "#070707",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    host: true, // reachable from your phone on the same wifi
    proxy: {
      "/api": "http://localhost:3000",
      // Only the WebSocket goes to the API; a page load of /live is the app's own route.
      "/live": { target: "ws://localhost:3000", ws: true, bypass: (req) => (req.headers.upgrade ? undefined : "/index.html") },
    },
  },
});
