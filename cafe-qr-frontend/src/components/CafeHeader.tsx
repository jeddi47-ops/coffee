// En-tête de la zone client : logo et nom centrés, phrase d'accroche, libellé de table.
import { useState } from "react";

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function CafeHeader({
  name,
  logoUrl,
  tagline,
  tableLabel,
}: {
  name: string;
  logoUrl: string | null;
  tagline?: string | null;
  tableLabel?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;
  const cleanTagline = tagline?.trim();

  return (
    <header className="px-4 pb-2 text-center" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}>
      {showLogo ? (
        <img
          src={logoUrl as string}
          alt=""
          width={64}
          height={64}
          onError={() => setLogoFailed(true)}
          className="mx-auto h-16 w-16 rounded-full border border-line bg-surface object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-bold tracking-wide text-accent-fg"
        >
          {initials(name)}
        </div>
      )}
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{name}</h1>
      {cleanTagline && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{cleanTagline}</p>}
      {tableLabel && (
        <p className="mt-2 inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
          {tableLabel}
        </p>
      )}
    </header>
  );
}
