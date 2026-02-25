import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = process.env.VITE_API_TARGET || "http://localhost:3009";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    watch: {
      usePolling: true,
      interval: 200
    },
    proxy: {
      "/auth": apiTarget,
      "/api": apiTarget,
      "/health": apiTarget
    }
  }
});
