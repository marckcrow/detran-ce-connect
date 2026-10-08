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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libs into separate chunks for faster mobile loading
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js', '@tanstack/react-query'],
          'vendor-ui': [
            '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar', '@radix-ui/react-checkbox', '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card', '@radix-ui/react-label', '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu', '@radix-ui/react-popover', '@radix-ui/react-progress',
            '@radix-ui/react-radio-group', '@radix-ui/react-scroll-area', '@radix-ui/react-select',
            '@radix-ui/react-separator', '@radix-ui/react-slider', '@radix-ui/react-slot',
            '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-tooltip',
            'class-variance-authority', 'clsx', 'tailwind-merge', 'tailwindcss-animate'
          ],
          'vendor-charts': ['recharts'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-date': ['date-fns', 'react-day-picker'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-carousel': ['embla-carousel-react', 'vaul'],
          'vendor-lucide': ['lucide-react'],
          'vendor-misc': ['cmdk', 'input-otp', 'next-themes', 'sonner', 'xlsx'],
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
