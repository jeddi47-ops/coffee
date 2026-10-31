// Barre du bas (3 entrées) : Menu, Ma table, Serveur.
// L'entrée de la vue affichée est repérée par une barre et une pastille aux couleurs du café (--accent).
import { BellRing, ClipboardList, Clock, UtensilsCrossed } from "lucide-react";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";

export type CustomerView = "menu" | "table";

export function BottomNav({
  view,
  tableActive,
  showCall,
  waiterComing,
  callCooldown,
  callBusy,
  onMenu,
  onTable,
  onCall,
}: {
  view: CustomerView;
  tableActive: boolean;
  showCall: boolean;
  waiterComing: boolean;
  callCooldown: number;
  callBusy: boolean;
  onMenu: () => void;
  onTable: () => void;
  onCall: () => void;
}) {
  const callDisabled = waiterComing || callCooldown > 0 || callBusy;

  const item = (active: boolean) =>
    cn(
      "relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold",
      active ? "text-ink" : "text-muted",
    );
  // Pastille derrière l'icône : accent-soft = teinte claire de la couleur du café.
  const pill = (active: boolean) =>
    cn("relative flex h-7 w-14 items-center justify-center rounded-full transition-colors", active && "bg-accent-soft");
  const bar = <span aria-hidden="true" className="absolute left-1/2 top-0 h-[3px] w-10 -translate-x-1/2 rounded-b-full bg-accent" />;

  return (
    <nav aria-label={fr.nav.label} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface safe-bottom">
      <div className="mx-auto flex max-w-2xl items-stretch px-2">
        <button type="button" onClick={onMenu} aria-current={view === "menu" ? "page" : undefined} className={item(view === "menu")}>
          {view === "menu" && bar}
          <span className={pill(view === "menu")}>
            <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
          </span>
          {fr.nav.menu}
        </button>

        <button
          type="button"
          onClick={onTable}
          aria-current={view === "table" ? "page" : undefined}
          aria-label={tableActive ? fr.nav.tableActive : fr.nav.table}
          className={item(view === "table")}
        >
          {view === "table" && bar}
          <span className={pill(view === "table")}>
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            {tableActive && <span className="absolute right-3 top-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />}
          </span>
          {fr.nav.table}
        </button>

        {showCall && (
          <button
            type="button"
            onClick={onCall}
            disabled={callDisabled}
            aria-label={waiterComing ? fr.nav.waiterComingAria : fr.nav.callAria}
            className={cn(item(false), waiterComing && "text-ink", "disabled:cursor-not-allowed")}
          >
            <span className={cn(pill(false), waiterComing && "bg-accent-soft")}>
              {callCooldown > 0 ? <Clock className="h-5 w-5" aria-hidden="true" /> : <BellRing className="h-5 w-5" aria-hidden="true" />}
            </span>
            {waiterComing ? fr.nav.waiterComing : callCooldown > 0 ? `${callCooldown} s` : fr.nav.call}
          </button>
        )}
      </div>
    </nav>
  );
}
