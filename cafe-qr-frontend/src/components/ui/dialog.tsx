import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { fr } from "../../i18n/fr";

/** Fenêtre modale accessible (Échap ferme, focus déplacé dans la fenêtre, défilement bloqué). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  side = "center",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: "center" | "bottom";
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={cn("fixed inset-0 z-50 flex bg-overlay", side === "bottom" ? "items-end" : "items-center justify-center p-4")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto bg-surface text-ink shadow-xl outline-none",
          side === "bottom" ? "rounded-t-[calc(var(--radius)*1.6)] safe-bottom" : "max-w-lg rounded-card",
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={fr.common.close} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
