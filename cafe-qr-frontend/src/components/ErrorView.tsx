import type { ReactNode } from "react";
import { fr } from "../i18n/fr";

export function ErrorView({
  title,
  message,
  onRetry,
  icon,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  icon?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center p-6 text-center">
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      {title && <h1 className="text-xl font-semibold text-ink">{title}</h1>}
      <p className="mt-2 text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-6 min-h-[44px] rounded-card bg-accent px-5 font-semibold text-accent-fg">
          {fr.common.retry}
        </button>
      )}
    </main>
  );
}
