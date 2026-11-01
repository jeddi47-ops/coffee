// /m/:token : page d'entrée du QR (menu, panier, suivi de table, appel serveur).
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QrCode, Store } from "lucide-react";
import { publicApi } from "../../lib/api";
import { ApiError, errorMessage } from "../../lib/errors";
import { buildTheme } from "../../lib/theme";
import { fr } from "../../i18n/fr";
import type { Menu, MenuProduct } from "../../types/api";
import { totalQuantity, useCartStore, type CartLine } from "../../stores/cartStore";
import { MenuView } from "../../components/MenuView";
import { ThemeScope } from "../../components/ThemeScope";
import { ErrorView } from "../../components/ErrorView";
import { MenuSkeleton } from "../../components/Skeletons";
import { CartDrawer } from "./CartDrawer";
import { TableStatePanel } from "./TableStatePanel";
import { BottomNav, type CustomerView } from "./BottomNav";
import { TopBar, TOP_BAR_HEIGHT } from "./TopBar";
import { SideMenu } from "./SideMenu";
import { useTableState } from "./useTableState";
import { useCountdown } from "./useCountdown";

// Chargé à la demande : seul FollowDialog a besoin de supabase-js côté client.
const FollowDialog = lazy(() => import("./FollowDialog"));

const NO_LINES: CartLine[] = [];
const STALE_MS = 2 * 60 * 1000;

type LoadState = { kind: "loading" } | { kind: "ready"; menu: Menu } | { kind: "error"; error: ApiError | null };

export function MenuPage() {
  const { token = "" } = useParams();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const loadedAt = useRef(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState<CustomerView>("menu");
  const [sideOpen, setSideOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [callCooldown, startCallCooldown] = useCountdown();
  const [callOptimistic, setCallOptimistic] = useState(false);

  const lines = useCartStore((s) => s.linesByToken[token] ?? NO_LINES);
  const addToCart = useCartStore((s) => s.add);
  const table = useTableState(token);

  const fetchMenu = useCallback(async () => {
    try {
      const menu = await publicApi.getMenu(token);
      loadedAt.current = Date.now();
      setLoad({ kind: "ready", menu });
    } catch (e) {
      setLoad((prev) => (prev.kind === "ready" ? prev : { kind: "error", error: e instanceof ApiError ? e : null }));
    }
  }, [token]);

  useEffect(() => {
    void fetchMenu();
    // Le menu est en cache 30 s côté serveur : on ne le redemande qu'au retour après plus de 2 minutes.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > STALE_MS) void fetchMenu();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchMenu]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Le thème est calculé avant le premier affichage du menu (les squelettes restent neutres).
  const theme = useMemo(
    () => (load.kind === "ready" ? buildTheme(load.menu.cafe.theme?.accent, load.menu.cafe.theme?.mode) : null),
    [load],
  );

  const cartQty = useMemo(() => Object.fromEntries(lines.map((l) => [l.productId, l.quantity])), [lines]);
  const waiterOpen = Boolean(table.state?.waiter_call);
  useEffect(() => {
    if (table.state && !table.state.waiter_call) setCallOptimistic(false);
  }, [table.state]);

  if (load.kind === "loading") return <MenuSkeleton />;
  if (load.kind === "error") {
    const err = load.error;
    if (err?.status === 404) {
      return <ErrorView icon={<QrCode className="h-12 w-12" aria-hidden="true" />} title={fr.menu.invalidQrTitle} message={fr.menu.invalidQr} />;
    }
    if (err?.status === 403) {
      return <ErrorView icon={<Store className="h-12 w-12" aria-hidden="true" />} title={fr.menu.inactiveTitle} message={fr.menu.inactive} />;
    }
    return (
      <ErrorView
        title={fr.menu.loadError}
        message={errorMessage(err)}
        onRetry={() => { setLoad({ kind: "loading" }); void fetchMenu(); }}
      />
    );
  }

  const { menu } = load;
  const cafe = menu.cafe;
  const count = totalQuantity(lines);
  const tableActive = Boolean(table.state?.orders.some((o) => o.status !== "served" && o.status !== "cancelled"));

  const onAdd = (p: MenuProduct, quantity = 1) => {
    if (!p.is_available || !cafe.ordering_enabled) return;
    const res = addToCart(token, { productId: p.id, name: p.name, priceCents: p.price_cents }, quantity);
    setToast(res === "ok" ? fr.menu.addedToast(p.name, quantity) : res === "line_max" ? fr.cart.limit20 : fr.cart.limit50);
  };

  const callWaiter = async () => {
    if (callBusy || waiterOpen || callOptimistic || callCooldown > 0) return;
    setCallBusy(true);
    try {
      await publicApi.callWaiter(token);
      setCallOptimistic(true); // created: false = déjà ouvert -> même message, sans erreur
      setToast(fr.table.callSent);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) startCallCooldown(e.retryAfter ?? 60);
      setToast(errorMessage(e));
    } finally {
      setCallBusy(false);
      void table.refresh();
    }
  };

  return (
    <ThemeScope theme={theme!} className="min-h-screen">
      {!cafe.ordering_enabled && (
        <div role="status" className="bg-ink px-4 py-3 text-center text-sm font-semibold text-bg">
          {fr.menu.suspended}
        </div>
      )}
      <TopBar
        cartCount={count}
        showCart={cafe.ordering_enabled}
        onOpenMenu={() => setSideOpen(true)}
        onOpenCart={() => setCartOpen(true)}
      />

      <div className="pb-32">
        {view === "table" ? (
          <section className="mx-auto w-full max-w-2xl px-4" style={{ paddingTop: `calc(${TOP_BAR_HEIGHT + 16}px + env(safe-area-inset-top, 0px))` }}>
            <h1 className="text-2xl font-bold">{fr.table.title}</h1>
            <div className="mt-4">
              <TableStatePanel
                inline
                open
                onClose={() => setView("menu")}
                token={token}
                state={table.state}
                currency={cafe.currency}
                refresh={table.refresh}
                applyServerTotal={table.applyServerTotal}
              />
            </div>
          </section>
        ) : (
          <MenuView
            menu={menu}
            onAdd={cafe.ordering_enabled ? onAdd : undefined}
            cartQty={cartQty}
            stickyOffset={TOP_BAR_HEIGHT}
            footer={
              <div className="px-4 pb-6 pt-10 text-center">
                <button type="button" onClick={() => setFollowOpen(true)} className="min-h-[44px] text-sm font-semibold text-ink underline underline-offset-4">
                  {fr.menu.followCta}
                </button>
              </div>
            }
          />
        )}
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-card bg-ink px-4 py-3 text-center text-sm font-semibold text-bg shadow-lg">
          {toast}
        </div>
      )}

      <BottomNav
        view={view}
        tableActive={tableActive}
        showCall={cafe.call_waiter_enabled}
        waiterComing={waiterOpen || callOptimistic}
        callCooldown={callCooldown}
        callBusy={callBusy}
        onMenu={() => {
          setView("menu");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onTable={() => {
          setView("table");
          window.scrollTo({ top: 0 });
          void table.refresh();
        }}
        onCall={callWaiter}
      />

      <SideMenu
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        onFollow={() => {
          setSideOpen(false);
          setFollowOpen(true);
        }}
      />

      {cafe.ordering_enabled && (
        <CartDrawer
          open={cartOpen}
          token={token}
          currency={cafe.currency}
          onClose={() => setCartOpen(false)}
          onOrdered={(res) => {
            if (res) table.applyServerTotal(res.session_total_cents);
            void table.refresh();
          }}
          onShowTable={() => { setView("table"); window.scrollTo({ top: 0 }); }}
        />
      )}

      {followOpen && (
        <Suspense fallback={null}>
          <FollowDialog open={followOpen} onClose={() => setFollowOpen(false)} cafeName={cafe.name} cafeSlug={cafe.slug} />
        </Suspense>
      )}
    </ThemeScope>
  );
}
