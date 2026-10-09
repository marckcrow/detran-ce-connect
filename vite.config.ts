import { defineConfig } from "vite";
// NOTE: @vitejs/plugin-react (Babel) used instead of @vitejs/plugin-react-swc.
// SWC's faster transpilation can produce module initialization order issues
// (TDZ: "Cannot access X before initialization") especially with Supabase's
// CJS/ESM interop. Babel's plugin-react is more predictable for production builds.
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Treat Lily modules as having side effects so Rollup doesn't tree-shake
  // the component bodies (used via dynamic event handlers / ref callbacks)
  build: {
    chunkSizeWarningLimit: 600,
    // Note: transformMixedEsModules removed — it reorders CJS/ESM init and causes TDZ.
    rollupOptions: {
      output: {
        // Safer code-split: only split HEAVY non-critical libs.
        // Keep React/Router/Supabase/UI in main bundle to avoid TDZ/circular-dep crashes.
        manualChunks(id) {
          // PDF generation (heavy, only used on-demand for exports)
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'vendor-pdf';
          // Charts (heavy, only on dashboard/admin pages)
          if (id.includes('recharts/') || id.includes('recharts.esm')) return 'vendor-charts';
          // Excel export (only used on export actions)
          if (id.includes('xlsx') || id.includes('sheetjs')) return 'vendor-xlsx';
          // html2canvas (heavy, only for print/share)
          if (id.includes('html2canvas')) return 'vendor-html2canvas';
          // Lily AI knowledge base (large JSON data)
          if (id.includes('lily-knowledge') || id.includes('lily-tutorials')) return 'vendor-lily-data';
        },
      },
      treeshake: {
        moduleSideEffects: (id: string) => {
          if (id.includes("lily/LilyChat") ||
              id.includes("lily/LilyContext") ||
              id.includes("lily/LilyFloat") ||
              id.includes("lily/LilyTutorialManager") ||
              id.includes("lily/ScreenHelpButton") ||
              id.includes("lily-knowledge") ||
              id.includes("lily-tutorials") ||
              id.includes("lily/TutorialOverlay")) {
            return true;
          }
          return undefined;
        },
      },
    },
  },
}));
