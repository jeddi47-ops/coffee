import { fr } from "../i18n/fr";

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md p-6 text-center">
      <p className="text-lg">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 rounded-card bg-accent px-5 text-white">
          {fr.common.retry}
        </button>
      )}
    </div>
  );
}
