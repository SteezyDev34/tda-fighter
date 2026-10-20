import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "TDA Fighter",
        short_name: "TDA Fighter",
        description: "Assistant quotidien pour les personnes TDAH : tâches, sport et nutrition.",
        lang: "fr",
        theme_color: "#2f4bff",
        background_color: "#f3f4f8",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // The AI endpoints always need the network.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
