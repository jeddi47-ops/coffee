// Une catégorie du menu : titre + rangée qu'on fait glisser, avec « Voir tout » (grille de tous les produits).
// Pendant une recherche, la catégorie est toujours en grille (plus lisible que des rangées).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Menu, MenuProduct } from "../types/api";
import { ProductCard, type AddHandler } from "./ProductCard";
import { fr } from "../i18n/fr";
import { cn } from "../lib/utils";

type Category = Menu["categories"][number];

/** Au-delà de ce nombre de produits, on propose « Voir tout ». */
const VIEW_ALL_FROM = 3;

function ArrowButton({ dir, onClick, label }: { dir: "left" | "right"; onClick: () => void; label: string }) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // Flèches seulement avec une souris : au doigt, on glisse.
      className={cn(
        "absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md [@media(hover:hover)]:flex",
        dir === "left" ? "left-1" : "right-1",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function ScrollRow({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const scrollBy = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        role="group"
        aria-label={label}
        tabIndex={0}
        className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {edge.left && <ArrowButton dir="left" onClick={() => scrollBy(-1)} label={fr.menu.scrollPrev} />}
      {edge.right && <ArrowButton dir="right" onClick={() => scrollBy(1)} label={fr.menu.scrollNext} />}
    </div>
  );
}

export function CategorySection({
  category,
  currency,
  onAdd,
  onOpen,
  forceGrid = false,
}: {
  category: Category;
  currency: string;
  onAdd?: AddHandler;
  onOpen: (p: MenuProduct) => void;
  forceGrid?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const products = useMemo(() => [...category.products].sort((a, b) => a.position - b.position), [category.products]);
  const canExpand = !forceGrid && products.length >= VIEW_ALL_FROM;
  const grid = forceGrid || expanded;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    // En réduisant, la page raccourcit : on remet le titre de la catégorie en haut pour ne pas perdre le client.
    if (!next) requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <section ref={sectionRef} id={`cat-${category.id}`} aria-labelledby={`cat-title-${category.id}`} className="scroll-mt-[8rem] pt-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-4">
        <h2 id={`cat-title-${category.id}`} className="min-w-0 truncate text-lg font-bold">{category.name}</h2>
        {canExpand && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="-my-2 flex shrink-0 items-center gap-0.5 py-2 text-sm font-semibold text-ink underline-offset-4 active:underline"
          >
            {expanded ? fr.menu.collapse : fr.menu.viewAll}
            {!expanded && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>

      {grid ? (
        <div className="grid grid-cols-2 items-stretch gap-3 px-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} currency={currency} onAdd={onAdd} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <ScrollRow label={category.name}>
          {products.map((p) => (
            // ~2,5 cartes visibles sur téléphone : la suivante dépasse, ce qui montre qu'on peut glisser.
            <div key={p.id} className="w-[40vw] min-w-[9rem] max-w-[11.5rem] shrink-0 snap-start">
              <ProductCard product={p} currency={currency} onAdd={onAdd} onOpen={onOpen} />
            </div>
          ))}
        </ScrollRow>
      )}
    </section>
  );
}
