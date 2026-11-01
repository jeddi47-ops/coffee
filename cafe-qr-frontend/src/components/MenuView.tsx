// Rendu du menu, partagé par la zone client (/m/:token) et l'aperçu de l'admin.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import type { Menu } from "../types/api";
import { CafeHeader } from "./CafeHeader";
import { FeaturedCarousel, ProductCard, type AddHandler } from "./ProductCard";
import { ProductSheet } from "./ProductSheet";
import { Dialog } from "./ui/dialog";
import { fr } from "../i18n/fr";
import { cn } from "../lib/utils";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function MenuView({
  menu,
  onAdd,
  cartQty = {},
  showTable = true,
  footer,
  stickyOffset = 0,
}: {
  menu: Menu;
  onAdd?: AddHandler;
  cartQty?: Record<string, number>;
  showTable?: boolean;
  footer?: ReactNode;
  stickyOffset?: number;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(menu.categories[0]?.id ?? null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const currency = menu.cafe.currency;
  const q = normalize(query.trim());

  const categories = useMemo(() => {
    const sorted = [...menu.categories].sort((a, b) => a.position - b.position);
    if (!q) return sorted;
    return sorted
      .map((c) => ({
        ...c,
        products: c.products.filter((p) => normalize(`${p.name} ${p.description ?? ""}`).includes(q)),
      }))
      .filter((c) => c.products.length > 0);
  }, [menu.categories, q]);

  const featured = useMemo(
    () => (q ? [] : menu.categories.flatMap((c) => c.products).filter((p) => p.is_promoted)),
    [menu.categories, q],
  );

  // La fiche est retrouvée par id : elle reste à jour si le menu est rechargé pendant qu'elle est ouverte.
  const openProduct = useMemo(
    () => (openId ? menu.categories.flatMap((c) => c.products).find((p) => p.id === openId) ?? null : null),
    [menu.categories, openId],
  );
  const closeSheet = useCallback(() => setOpenId(null), []);

  // La pastille active suit le défilement : dernière section dont le titre est passé sous la barre collante.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const limit = stickyOffset + 100;
      let current: string | null = categories[0]?.id ?? null;
      for (const c of categories) {
        const el = document.getElementById(`cat-${c.id}`);
        if (el && el.getBoundingClientRect().top <= limit) current = c.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [categories, stickyOffset]);

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const closeCats = useCallback(() => setCatsOpen(false), []);
  const pickCategory = (id: string) => {
    setCatsOpen(false);
    // On attend que la fenêtre soit fermée (elle bloque le défilement) avant de descendre à la section.
    window.setTimeout(() => goTo(id), 60);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <CafeHeader
        name={menu.cafe.name}
        logoUrl={menu.cafe.logo_url}
        tagline={menu.cafe.tagline}
        tableLabel={showTable ? fr.menu.tableLabel(menu.table.label) : undefined}
      />

      {/* Barre collante : recherche + bouton « catégories », sous la barre du haut. */}
      <div role="search" className="sticky z-20 mt-1 bg-bg px-4 py-2" style={{ top: `calc(${stickyOffset}px + env(safe-area-inset-top, 0px))` }}>
        <div className="flex items-center gap-2">
          <label htmlFor="menu-search" className="sr-only">{fr.menu.searchLabel}</label>
          <div className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface pl-4 pr-1 focus-within:ring-2 focus-within:ring-accent">
            <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <input
              id="menu-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={fr.menu.searchPlaceholder}
              className="min-h-[46px] w-full min-w-0 bg-transparent text-base text-ink placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={fr.menu.clearSearch}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-2"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={() => setCatsOpen(true)}
              aria-label={fr.menu.filterAria}
              aria-haspopup="dialog"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink active:bg-surface-2"
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {featured.length > 0 && (
        <section aria-labelledby="featured-title" className="px-4 pt-2">
          <h2 id="featured-title" className="text-lg font-bold">{fr.menu.featured}</h2>
          <div className="mt-3">
            <FeaturedCarousel products={featured} currency={currency} cartQty={cartQty} onAdd={onAdd} onOpen={(p) => setOpenId(p.id)} />
          </div>
        </section>
      )}

      {menu.categories.length === 0 && <p className="px-4 py-10 text-center text-muted">{fr.menu.empty}</p>}
      {q && categories.length === 0 && <p className="px-4 py-10 text-center text-muted">{fr.menu.noResults}</p>}

      {categories.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`cat-title-${c.id}`} className="scroll-mt-[8rem] px-4 pt-5">
          <h2 id={`cat-title-${c.id}`} className="mb-3 text-lg font-bold">{c.name}</h2>
          <div className="grid grid-cols-3 items-stretch gap-2">
            {[...c.products]
              .sort((a, b) => a.position - b.position)
              .map((p) => (
                <ProductCard key={p.id} product={p} currency={currency} onAdd={onAdd} onOpen={(x) => setOpenId(x.id)} />
              ))}
          </div>
        </section>
      ))}

      {footer}

      <Dialog open={catsOpen} onClose={closeCats} title={fr.menu.categoriesNav} side="bottom">
        <ul className="space-y-1">
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pickCategory(c.id)}
                aria-current={active === c.id ? "true" : undefined}
                className={cn(
                  "flex min-h-[48px] w-full items-center justify-between gap-3 rounded-card px-3 text-left text-base font-semibold active:bg-surface-2",
                  active === c.id && "bg-accent-soft",
                )}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-sm font-normal text-muted">
                  {fr.menu.categoryCount(c.products.length)}
                  {active === c.id && <Check className="h-4 w-4 text-ink" aria-hidden="true" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      {openProduct && <ProductSheet product={openProduct} currency={currency} onClose={closeSheet} onAdd={onAdd} />}
    </div>
  );
}
