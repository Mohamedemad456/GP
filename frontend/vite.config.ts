import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh optimizations
      fastRefresh: true,
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    dedupe: ["react", "react-dom"],
    exclude: ["@gp/design-system"],
  },
  ssr: {
    noExternal: ["@gp/design-system"],
  },
  build: {
    // Enable minification
    minify: "esbuild",
    // Chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": ["framer-motion", "lucide-react"],
          "i18n-vendor": [
            "i18next",
            "react-i18next",
            "i18next-browser-languagedetector",
          ],
          "query-vendor": ["@tanstack/react-query"],
        },
        // Optimize chunk file names
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
      },
    },
    // Enable source maps for production debugging (optional)
    sourcemap: false,
    // Target modern browsers for smaller bundles
    target: "esnext",
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling: true,
    },
    fs: {
      allow: [".."],
    },
  },
});
