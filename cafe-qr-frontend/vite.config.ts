import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /staff et /admin sont chargés à la demande (React.lazy dans src/routes.tsx).
// supabase-js est isolé dans son propre fichier pour ne pas alourdir la page du QR.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ["@supabase/supabase-js"],
          qrcode: ["qrcode"],
        },
      },
    },
  },
});
