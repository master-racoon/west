import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: "./dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    host: "0.0.0.0", // Listen on all network interfaces
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/core"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          "react-vendor": ["react", "react-dom", "react-router-dom"],

          // State management & data fetching
          "state-vendor": ["zustand", "@tanstack/react-query"],

          // Canvas/Drawing libraries (large - lazy load candidates)
          "konva-vendor": ["konva", "react-konva"],

          // FFmpeg (very large - should be lazy loaded)
          "ffmpeg-vendor": ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
