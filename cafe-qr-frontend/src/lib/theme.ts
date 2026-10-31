// Thème par café (section 14) : variables CSS et contraste garanti ≥ 4,5:1.
export type ThemeMode = "light" | "dark";

export const DEFAULT_ACCENT = "#8B5E3C";
export const DEFAULT_MODE: ThemeMode = "light";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#141414";
const MIN_CONTRAST = 4.5;

export interface CafeTheme {
  mode: ThemeMode;
  accent: string;
  accentForeground: string;
  vars: Record<string, string>;
}

export const SUGGESTED_ACCENTS = [
  "#8B5E3C", "#C0392B", "#2F6B4F", "#1F4E79", "#6B3FA0", "#D4813A", "#2B2B2B", "#B5487A",
];

export function isValidHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = toRgb(hex);
  return toHex([r + (target[0] - r) * amount, g + (target[1] - g) * amount, b + (target[2] - b) * amount]);
}

/**
 * Couleur du texte posé sur l'accent : blanc ou quasi noir, celui qui contraste le plus.
 * Si aucun n'atteint 4,5:1, on assombrit (texte blanc) ou on éclaircit (texte sombre) l'accent.
 */
export function readableOn(accentHex: string): { accent: string; foreground: string } {
  let accent = accentHex.toLowerCase();
  const useLight = contrast(accent, LIGHT_TEXT) >= contrast(accent, DARK_TEXT);
  const fg = useLight ? LIGHT_TEXT : DARK_TEXT;
  const target: [number, number, number] = useLight ? [0, 0, 0] : [255, 255, 255];
  for (let i = 0; i < 20 && contrast(accent, fg) < MIN_CONTRAST; i++) {
    accent = mix(accent, target, 0.08);
  }
  return { accent, foreground: fg };
}

const MODE_VARS: Record<ThemeMode, Record<string, string>> = {
  light: {
    "--bg": "#f6f3ee",
    "--surface": "#ffffff",
    "--surface-2": "#efebe4",
    "--ink": "#1c1a17",
    "--muted": "#6b645b",
    "--line": "#e3ddd3",
    "--overlay": "rgba(20, 18, 15, 0.55)",
  },
  dark: {
    "--bg": "#121110",
    "--surface": "#1d1b19",
    "--surface-2": "#2a2724",
    "--ink": "#f4efe8",
    "--muted": "#b0a89d",
    "--line": "#34302b",
    "--overlay": "rgba(0, 0, 0, 0.65)",
  },
};

/**
 * Un accent presque noir sur fond sombre (ou presque blanc sur fond clair) rendrait boutons et
 * pastilles invisibles : on l'éclaircit (ou l'assombrit) jusqu'à un écart minimal avec le fond.
 */
function visibleOnBackground(hex: string, mode: ThemeMode): string {
  const bg = MODE_VARS[mode]["--bg"];
  const min = mode === "dark" ? 2 : 1.25;
  const target: [number, number, number] = mode === "dark" ? [255, 255, 255] : [0, 0, 0];
  let accent = hex.toLowerCase();
  for (let i = 0; i < 20 && contrast(accent, bg) < min; i++) accent = mix(accent, target, 0.08);
  return accent;
}

/** Construit les variables CSS du thème. Valeurs absentes ou invalides : thème par défaut, sans erreur. */
export function buildTheme(accentInput?: unknown, modeInput?: unknown): CafeTheme {
  const mode: ThemeMode = modeInput === "dark" || modeInput === "light" ? modeInput : DEFAULT_MODE;
  const base = isValidHex(accentInput) ? accentInput : DEFAULT_ACCENT;
  const { accent, foreground } = readableOn(visibleOnBackground(base, mode));
  const soft = mode === "dark" ? mix(accent, [29, 27, 25], 0.72) : mix(accent, [255, 255, 255], 0.86);
  return {
    mode,
    accent,
    accentForeground: foreground,
    vars: {
      ...MODE_VARS[mode],
      "--accent": accent,
      "--accent-foreground": foreground,
      "--accent-soft": soft,
    },
  };
}
