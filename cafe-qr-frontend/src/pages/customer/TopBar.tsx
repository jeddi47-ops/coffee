// Barre du haut de la zone client : transparente en haut de page (elle laisse le logo respirer),
// elle prend un fond léger dès que l'on défile pour que les icônes restent lisibles.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu as MenuIcon, ShoppingBag, User } from "lucide-react";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";

export const TOP_BAR_HEIGHT = 56;

export function TopBar({
  cartCount,
  showCart,
  onOpenMenu,
  onOpenCart,
}: {
  cartCount: number;
  showCart: boolean;
  onOpenMenu: () => void;
  onOpenCart: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const iconBtn = "relative flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface-2";

  return (
    <div
      className={cn("fixed inset-x-0 top-0 z-30 border-b transition-colors", scrolled ? "border-line" : "border-transparent")}
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: scrolled ? "color-mix(in srgb, var(--bg) 90%, transparent)" : "transparent",
        backdropFilter: scrolled ? "blur(8px)" : undefined,
        WebkitBackdropFilter: scrolled ? "blur(8px)" : undefined,
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between px-2" style={{ height: TOP_BAR_HEIGHT }}>
        <button type="button" onClick={onOpenMenu} aria-label={fr.nav.openMenu} className={iconBtn}>
          <MenuIcon className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-1">
          {showCart && (
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={cartCount > 0 ? fr.nav.cartWithCount(cartCount) : fr.nav.cart}
              className={iconBtn}
            >
              <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg">
                  {cartCount}
                </span>
              )}
            </button>
          )}
          {/* Sous 440 px de large, l'icône seule laisse la place au logo centré. */}
          <Link
            to="/compte"
            aria-label={fr.nav.accountAria}
            className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink"
          >
            <User className="h-5 w-5" aria-hidden="true" />
            <span className="hidden min-[440px]:inline">{fr.nav.account}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
