import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { ApiError, errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { fr } from "../../i18n/fr";
import type { Menu, MenuProduct } from "../../types/api";
import { useCartStore, type CartLine } from "../../stores/cartStore";
import { CartDrawer } from "./CartDrawer";
import { TableStatePanel } from "./TableStatePanel";
import { ErrorView } from "../../components/ErrorView";
import { MenuSkeleton } from "../../components/Skeletons";

const NO_LINES: CartLine[] = [];
const STALE_MS = 2 * 60 * 1000; // rechargement au retour sur l'onglet après 2 minutes

export function MenuPage() {
  const { token = "" } = useParams();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [tableVersion, setTableVersion] = useState(0);
  const loadedAt = useRef(0);

  const lines: CartLine[] = useCartStore((s) => s.linesByToken[token] ?? NO_LINES);
  const setLines = useCartStore((s) => s.setLines);

  const load = useCallback(async () => {
    try {
      setMenu(await api.getMenu(token));
      loadedAt.current = Date.now();
      setError(null);
      setNotFound(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(errorMessage(e));
    }
  }, [token]);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > STALE_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  if (notFound) {
    return <ErrorView message="Ce QR code n'est plus valide. Demandez de l'aide au personnel." />;
  }
  if (error && !menu) return <ErrorView message={error} onRetry={load} />;
  if (!menu) return <MenuSkeleton />;

  const currency = menu.cafe.currency;
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);

  const addProduct = (p: MenuProduct) => {
    if (!p.is_available) return;
    const existing = lines.find((l) => l.productId === p.id);
    const next = existing
      ? lines.map((l) =>
          l.productId === p.id ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l,
        )
      : [...lines, { productId: p.id, name: p.name, priceCents: p.price_cents, quantity: 1, note: "" }];
    setLines(token, next);
  };

  return (
    <div className="mx-auto max-w-2xl pb-40">
      <header className="flex items-center gap-3 p-4">
        {menu.cafe.logo_url ? (
          <img src={menu.cafe.logo_url} alt="" className="h-12 w-12 rounded-card object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-card bg-accent text-white" aria-hidden="true">
            {menu.cafe.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold">{menu.cafe.name}</h1>
          <p className="text-sm text-muted">{fr.menu.tableLabel(menu.table.label)}</p>
        </div>
      </header>

      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-surface px-4 py-2" aria-label="Catégories">
        {menu.categories.map((c) => (
          <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 rounded-full border border-black/10 px-4 py-2 text-sm">
            {c.name}
          </a>
        ))}
      </nav>

      {menu.categories.length === 0 && <p className="p-4 text-muted">{fr.menu.empty}</p>}

      {menu.categories.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="px-4 pt-6">
          <h2 className="mb-3 text-base font-semibold">{c.name}</h2>
          <ul className="space-y-3">
            {c.products.map((p) => (
              <li
                key={p.id}
                className={`flex gap-3 rounded-card bg-white p-3 shadow-sm ${p.is_available ? "" : "opacity-50"}`}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-card object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-card bg-black/5" aria-hidden="true" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  {p.is_promoted && p.promo_label && (
                    <span className="mb-1 w-fit rounded bg-accent/10 px-2 py-0.5 text-xs text-accent">{p.promo_label}</span>
                  )}
                  <h3 className="font-medium">{p.name}</h3>
                  {p.description && <p className="text-sm text-muted">{p.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-semibold">{formatMoney(p.price_cents, currency)}</span>
                    {p.is_available ? (
                      <button
                        onClick={() => addProduct(p)}
                        className="rounded-card bg-accent px-4 text-sm text-white"
                        aria-label={`Ajouter ${p.name}`}
                      >
                        {fr.menu.add}
                      </button>
                    ) : (
                      <span className="text-sm text-muted">{fr.menu.unavailable}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <TableStatePanel
        token={token}
        currency={currency}
        callEnabled={menu.cafe.call_waiter_enabled}
        refreshSignal={tableVersion}
      />

      {menu.cafe.ordering_enabled && count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 left-4 right-4 z-20 mx-auto flex max-w-2xl justify-between rounded-card bg-ink px-5 text-white shadow-lg"
        >
          <span>{fr.menu.cartButton(count)}</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </button>
      )}

      {!menu.cafe.ordering_enabled && (
        <p className="mx-4 mt-6 rounded-card bg-black/5 p-4 text-sm">{fr.cart.suspended}</p>
      )}

      {cartOpen && (
        <CartDrawer
          token={token}
          currency={currency}
          onClose={() => setCartOpen(false)}
          onOrdered={() => setTableVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
