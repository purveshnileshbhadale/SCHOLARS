import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { compression } from "vite-plugin-compression2";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Pre-compress assets at build time so the CDN serves .br instantly
    // instead of compressing on every request. Brotli quality 11 = smallest.
    compression({
      algorithm: "brotliCompress",
      compressionOptions: { level: 11 },
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  build: {
    target: "es2020",
    // Drop console/debugger from production — removes ~10-15% of app JS.
    minify: "esbuild",
    esbuild: { drop: ["console", "debugger"] },
    cssMinify: true,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys no longer invalidate
        // react/supabase downloads. xlsx stays with AdminImport (340 kB).
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "vendor-react";
          if (/node_modules[\\/]react-dom[\\/]/.test(id)) return "vendor-react";
          if (/node_modules[\\/]react[\\/]/.test(id)) return "vendor-react";
          if (id.includes("@supabase")) return "vendor-supabase";
          return undefined;
        },
      },
    },
  },
});
