import type { Config } from "tailwindcss";

// Aucune couleur fixe : tout passe par des variables CSS (jetons de design).
// Zone client : variables alimentées par le thème du café (src/lib/theme.ts).
// /staff, /admin, /compte : thème neutre de la plateforme (src/index.css).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        "accent-fg": "var(--accent-foreground)",
        "accent-soft": "var(--accent-soft)",
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        overlay: "var(--overlay)",
        danger: "var(--danger)",
        "danger-fg": "var(--danger-foreground)",
        success: "var(--success)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
      },
      borderRadius: { card: "var(--radius)" },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
