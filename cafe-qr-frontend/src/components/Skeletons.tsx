export function MenuSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-4 p-4" aria-hidden="true">
      <div className="h-24 rounded-card bg-black/5" />
      <div className="h-8 w-1/3 rounded bg-black/5" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 rounded-card bg-black/5" />
      ))}
    </div>
  );
}
