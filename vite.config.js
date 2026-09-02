import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {
      /**
       * Cloudflare's API sends no CORS headers at all, so a browser refuses to
       * call it — with or without a key. Verified on 2026-09-02: even an
       * unauthenticated request throws "Failed to fetch" before it leaves the
       * page. Everything else we talk to (Google, OpenAI, Mistral,
       * Pollinations) allows it fine.
       *
       * So browser requests go through here instead. Node has no such rule, so
       * the MCP server still calls Cloudflare directly.
       */
      "/cf-api": {
        target: "https://api.cloudflare.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cf-api/, ""),
      },
    },
  },
});
