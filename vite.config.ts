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
        // Critical for token-by-token SSE: don't buffer, pass through as event-stream
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const auth = (req.headers as Record<string, string>)["authorization"]
            if (auth) proxyReq.setHeader("Authorization", auth)
            const dir = (req.headers as Record<string, string>)["x-opencode-directory"]
            if (dir) proxyReq.setHeader("x-opencode-directory", dir)
          })
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-cache"
            // Ensure Vite doesn't buffer SSE
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              // @ts-ignore - Node http headers
              proxyRes.headers["x-accel-buffering"] = "no"
            }
          })
        },
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
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const auth = (req.headers as Record<string, string>)["authorization"]
            if (auth) proxyReq.setHeader("Authorization", auth)
            const dir = (req.headers as Record<string, string>)["x-opencode-directory"]
            if (dir) proxyReq.setHeader("x-opencode-directory", dir)
          })
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-cache"
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              // @ts-ignore
              proxyRes.headers["x-accel-buffering"] = "no"
            }
          })
        },
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
