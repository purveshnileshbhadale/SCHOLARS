import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split stable vendors into their own long-lived chunks: app deploys
        // no longer invalidate react/supabase downloads, and the entry chunk
        // drops under the 500 kB warning. Anything not matched (e.g. xlsx)
        // stays with its importer so AdminImport keeps it out of the entry.
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
