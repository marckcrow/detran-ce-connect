import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: {
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
