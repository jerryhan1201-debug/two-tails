import { defineConfig } from "vite";
const backend = process.env.GAME_BACKEND_URL || "http://127.0.0.1:8787";
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/ws": { target: backend.replace(/^http/, "ws"), ws: true },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 9000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Editable models grow independently. Keep each export below the
          // hosting per-file limit instead of concatenating every mesh in one JS.
          if (id.includes(".geometry.json"))
            return "model-" + id.split(/[\\/]/).at(-1)!.replace(/\.geometry\.json.*$/, "");
          if (id.includes("/node_modules/@babylonjs/")) return "babylon";
        },
      },
    },
  },
});
