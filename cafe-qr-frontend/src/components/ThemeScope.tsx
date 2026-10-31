import type { CSSProperties, ReactNode } from "react";
import type { CafeTheme } from "../lib/theme";
import { cn } from "../lib/utils";

/** Applique le thème d'un café (variables CSS + data-theme) à tout ce qu'il contient. */
export function ThemeScope({ theme, children, className }: { theme: CafeTheme; children: ReactNode; className?: string }) {
  return (
    <div data-theme={theme.mode} style={theme.vars as CSSProperties} className={cn("bg-bg text-ink", className)}>
      {children}
    </div>
  );
}
