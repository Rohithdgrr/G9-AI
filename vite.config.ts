import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      // Proxy OpenCode API requests to avoid CORS issues in dev
      "/global": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/session": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/provider": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/config": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/event": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/find": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/file": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/mcp": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/lsp": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/path": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/vcs": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/agent": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/command": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/tui": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/instance": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/pty": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
      "/doc": {
        target: "http://localhost:4096",
        changeOrigin: true,
      },
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
