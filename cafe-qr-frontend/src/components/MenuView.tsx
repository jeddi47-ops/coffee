// Rendu du menu, partagé par la zone client (/m/:token) et l'aperçu de l'admin.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { Menu } from "../types/api";
import { CafeHeader } from "./CafeHeader";
import { FeaturedCarousel, ProductCard, type AddHandler } from "./ProductCard";
import { ProductSheet } from "./ProductSheet";
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
  externalQuery,
  belowHeader,
}: {
  menu: Menu;
  onAdd?: AddHandler;
  cartQty?: Record<string, number>;
  showTable?: boolean;
  footer?: ReactNode;
  stickyOffset?: number;
  /** Si défini, la recherche est pilotée de l'extérieur (menu latéral) et le champ n'est pas affiché ici. */
  externalQuery?: string;
  belowHeader?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(menu.categories[0]?.id ?? null);
  const [openId, setOpenId] = useState<string | null>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const currency = menu.cafe.currency;
  const q = normalize((externalQuery ?? query).trim());

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

  // La pastille active reste visible dans la barre horizontale.
  useEffect(() => {
    if (!active || !pillsRef.current) return;
    const pill = pillsRef.current.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    pill?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <CafeHeader
        name={menu.cafe.name}
        logoUrl={menu.cafe.logo_url}
        tagline={menu.cafe.tagline}
        tableLabel={showTable ? fr.menu.tableLabel(menu.table.label) : undefined}
      />

      {belowHeader}

      {externalQuery === undefined && (
        <div className="px-4">
          <label htmlFor="menu-search" className="sr-only">{fr.menu.searchLabel}</label>
          <div className="flex min-h-[48px] items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:ring-2 focus-within:ring-accent">
            <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <input
              id="menu-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={fr.menu.searchPlaceholder}
              className="min-h-[46px] w-full bg-transparent text-base text-ink placeholder:text-muted focus-visible:outline-none"
              autoComplete="off"
            />
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <nav
          aria-label={fr.menu.categoriesNav}
          className="sticky z-20 mt-1 bg-bg py-2"
          style={{ top: `calc(${stickyOffset}px + env(safe-area-inset-top, 0px))` }}
        >
          <div ref={pillsRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                data-cat={c.id}
                onClick={() => goTo(c.id)}
                aria-current={active === c.id ? "true" : undefined}
                className={cn(
                  "min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
                  active === c.id ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-ink",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </nav>
      )}

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
        <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`cat-title-${c.id}`} className="scroll-mt-[9rem] px-4 pt-5">
          <h2 id={`cat-title-${c.id}`} className="mb-3 text-lg font-bold">{c.name}</h2>
          <div className="grid grid-cols-2 items-stretch gap-3">
            {[...c.products]
              .sort((a, b) => a.position - b.position)
              .map((p) => (
                <ProductCard key={p.id} product={p} currency={currency} onAdd={onAdd} onOpen={(x) => setOpenId(x.id)} />
              ))}
          </div>
        </section>
      ))}

      {footer}

      {openProduct && <ProductSheet product={openProduct} currency={currency} onClose={closeSheet} onAdd={onAdd} />}
    </div>
  );
}
