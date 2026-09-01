import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://your-project.supabase.co"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    hmr: {
      overlay: false,
      clientPort: 5173,
    },
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/coverage/**"],
    },
    proxy: {
      "/api/deezer": {
        target: "https://api.deezer.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deezer/, ""),
      },
      "/.proxy/api/supabase": {
        target: SUPABASE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/\.proxy\/api\/supabase/, ""),
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("Supabase proxy error:", err);
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
})
