// Menu latéral (icône à gauche de la barre du haut) : nouveautés du café, compte client.
// La recherche est maintenant dans la page du menu (MenuView), sous l'en-tête.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BellRing, User, X } from "lucide-react";
import { fr } from "../../i18n/fr";

export function SideMenu({
  open,
  onClose,
  onFollow,
}: {
  open: boolean;
  onClose: () => void;
  onFollow: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const row = "flex min-h-[48px] w-full items-center gap-3 rounded-card px-3 text-left text-base font-semibold text-ink active:bg-surface-2";

  return (
    <div
      className="fixed inset-0 z-50 flex bg-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={fr.nav.sideTitle}
        className="h-full w-[85%] max-w-xs overflow-y-auto bg-surface p-4 text-ink shadow-xl"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{fr.nav.sideTitle}</h2>
          <button type="button" onClick={onClose} aria-label={fr.nav.closeMenu} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-4 space-y-1">
          <button type="button" onClick={onFollow} className={row}>
            <BellRing className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            {fr.menu.followCta}
          </button>
          <Link to="/compte" className={row}>
            <User className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            {fr.nav.account}
          </Link>
        </nav>
      </aside>
    </div>
  );
}
