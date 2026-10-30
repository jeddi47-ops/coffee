import type { Config } from "tailwindcss";

// Les couleurs passent par des variables CSS, alimentées par le thème du café.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
      },
      borderRadius: { card: "var(--radius)" },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
