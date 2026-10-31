// Squelettes neutres (aucun thème de café appliqué pendant le chargement).
export function MenuSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 pt-6" aria-busy="true" aria-label="Chargement">
      <div className="mx-auto h-16 w-16 rounded-full bg-surface-2" />
      <div className="mx-auto mt-3 h-5 w-40 rounded bg-surface-2" />
      <div className="mt-5 h-11 rounded-full bg-surface-2" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 w-24 rounded-full bg-surface-2" />)}
      </div>
      {[0, 1, 2, 3].map((i) => <div key={i} className="mt-4 h-24 rounded-card bg-surface-2" />)}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-16 rounded-card bg-surface-2" />)}
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true" aria-label="Chargement">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" />
    </div>
  );
}
