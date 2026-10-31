// Barre du bas (section 13) : Menu, Panier (central), Ma table, Appeler un serveur.
import { BellRing, ClipboardList, ShoppingBag, UtensilsCrossed, Clock } from "lucide-react";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";

export function BottomNav({
  cartCount,
  showCart,
  tableActive,
  showCall,
  waiterComing,
  callCooldown,
  callBusy,
  onMenu,
  onCart,
  onTable,
  onCall,
}: {
  cartCount: number;
  showCart: boolean;
  tableActive: boolean;
  showCall: boolean;
  waiterComing: boolean;
  callCooldown: number;
  callBusy: boolean;
  onMenu: () => void;
  onCart: () => void;
  onTable: () => void;
  onCall: () => void;
}) {
  const item = "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted";
  const callDisabled = waiterComing || callCooldown > 0 || callBusy;

  return (
    <nav aria-label={fr.nav.label} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface safe-bottom">
      <div className="mx-auto flex max-w-2xl items-end px-2">
        <button type="button" onClick={onMenu} className={item}>
          <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
          {fr.nav.menu}
        </button>

        {showCart && (
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={onCart}
              aria-label={cartCount > 0 ? fr.nav.cartWithCount(cartCount) : fr.nav.cart}
              className="relative -mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-bg bg-accent text-accent-fg shadow-lg"
            >
              <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              <span className="text-[10px] font-bold">{fr.nav.cart}</span>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface bg-ink px-1 text-xs font-bold text-bg">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        )}

        <button type="button" onClick={onTable} className={item} aria-label={tableActive ? fr.nav.tableActive : fr.nav.table}>
          <span className="relative">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            {tableActive && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />}
          </span>
          {fr.nav.table}
        </button>

        {showCall && (
          <button
            type="button"
            onClick={onCall}
            disabled={callDisabled}
            aria-label={waiterComing ? fr.nav.waiterComingAria : fr.nav.callAria}
            className={cn(item, waiterComing && "text-ink", "disabled:cursor-not-allowed")}
          >
            {callCooldown > 0 ? <Clock className="h-5 w-5" aria-hidden="true" /> : <BellRing className="h-5 w-5" aria-hidden="true" />}
            {waiterComing ? fr.nav.waiterComing : callCooldown > 0 ? `${callCooldown} s` : fr.nav.call}
          </button>
        )}
      </div>
    </nav>
  );
}
