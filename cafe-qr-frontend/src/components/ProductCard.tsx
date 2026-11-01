// Carte produit. Doit rester propre sans photo : carte compacte avec l'initiale, jamais d'image cassée.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { MenuProduct } from "../types/api";
import { formatMoney } from "../lib/money";
import { fr } from "../i18n/fr";
import { cn } from "../lib/utils";

function useImage(url: string | null) {
  const [failed, setFailed] = useState(false);
  return { src: url && !failed ? url : null, onError: () => setFailed(true) };
}

function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex shrink-0 items-center justify-center bg-surface-2 font-bold text-muted", className)}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function AddButton({ product, qty, onAdd }: { product: MenuProduct; qty: number; onAdd?: (p: MenuProduct) => void }) {
  if (!product.is_available) {
    return <span className="text-xs font-semibold uppercase tracking-wide text-muted">{fr.menu.unavailable}</span>;
  }
  if (!onAdd) return null;
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      aria-label={fr.menu.addAria(product.name)}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm active:scale-95"
    >
      <Plus className="h-5 w-5" aria-hidden="true" />
      {qty > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-ink px-1 text-[11px] font-bold text-bg">
          {qty}
        </span>
      )}
    </button>
  );
}

function PromoBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-block max-w-full truncate rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-fg", className)}>
      {label}
    </span>
  );
}

/** Ligne de catégorie : texte à gauche, photo 4:3 à droite (ou initiale compacte à gauche). */
export function ProductRow({
  product,
  currency,
  qty = 0,
  onAdd,
}: {
  product: MenuProduct;
  currency: string;
  qty?: number;
  onAdd?: (p: MenuProduct) => void;
}) {
  const img = useImage(product.image_url);
  const promo = product.is_promoted && product.promo_label ? product.promo_label : null;

  return (
    <article className={cn("flex gap-3 rounded-card border border-line bg-surface p-3", !product.is_available && "opacity-60")}>
      {!img.src && <Initial name={product.name} className="h-12 w-12 rounded-card text-lg" />}
      <div className="flex min-w-0 flex-1 flex-col">
        {promo && <PromoBadge label={promo} className="mb-1.5 self-start" />}
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        {product.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{product.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-bold">{formatMoney(product.price_cents, currency)}</span>
          {!img.src && <AddButton product={product} qty={qty} onAdd={onAdd} />}
        </div>
      </div>
      {img.src && (
        <div className="relative w-28 shrink-0 self-start">
          <img
            src={img.src}
            onError={img.onError}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn("aspect-[4/3] w-full rounded-card bg-surface-2 object-cover", !product.is_available && "grayscale")}
          />
          <div className="mt-2 flex justify-end">
            <AddButton product={product} qty={qty} onAdd={onAdd} />
          </div>
        </div>
      )}
    </article>
  );
}

const SLIDE_GAP = 12; // px, = gap-3

/** Une mise en avant, pleine largeur. Avec photo : photo 16:9 ; sans photo : bloc teinté, jamais d'image cassée. */
function FeaturedSlide({
  product,
  currency,
  qty,
  onAdd,
}: {
  product: MenuProduct;
  currency: string;
  qty: number;
  onAdd?: (p: MenuProduct) => void;
}) {
  const img = useImage(product.image_url);
  const promo = product.promo_label || fr.menu.featured;

  return (
    <article
      className={cn("w-full shrink-0 snap-center overflow-hidden rounded-card border border-line bg-surface", !product.is_available && "opacity-60")}
    >
      {img.src && (
        <div className="relative">
          <img
            src={img.src}
            onError={img.onError}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn("aspect-[16/9] w-full bg-surface-2 object-cover", !product.is_available && "grayscale")}
          />
          <PromoBadge label={promo} className="absolute left-3 top-3 shadow-sm" />
        </div>
      )}
      <div className={cn("flex items-end justify-between gap-3 p-4", !img.src && "bg-accent-soft")}>
        <div className="min-w-0">
          {!img.src && <PromoBadge label={promo} className="mb-2" />}
          <h3 className="text-lg font-bold leading-snug">{product.name}</h3>
          {product.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{product.description}</p>}
          <p className="mt-2 font-bold">{formatMoney(product.price_cents, currency)}</p>
        </div>
        <AddButton product={product} qty={qty} onAdd={onAdd} />
      </div>
    </article>
  );
}

/** Carrousel « À la une » : une seule carte visible, on fait glisser pour voir les suivantes. */
export function FeaturedCarousel({
  products,
  currency,
  cartQty,
  onAdd,
}: {
  products: MenuProduct[];
  currency: string;
  cartQty: Record<string, number>;
  onAdd?: (p: MenuProduct) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Le carrousel prend la hauteur de la carte affichée : une carte sans photo ne s'étire pas à la taille d'une carte avec photo.
  const measure = () => {
    const slide = scroller.current?.children[index] as HTMLElement | undefined;
    if (slide) setHeight(slide.offsetHeight);
  };
  useLayoutEffect(measure, [index, products]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const step = () => (scroller.current?.clientWidth ?? 0) + SLIDE_GAP;
  const onScroll = () => {
    const width = step();
    if (width > SLIDE_GAP) setIndex(Math.min(products.length - 1, Math.max(0, Math.round((scroller.current?.scrollLeft ?? 0) / width))));
  };
  const goTo = (i: number) => scroller.current?.scrollTo({ left: i * step(), behavior: "smooth" });

  return (
    <div>
      <div
        ref={scroller}
        onScroll={onScroll}
        role="region"
        aria-roledescription="carrousel"
        aria-label={fr.menu.featured}
        style={{ height }}
        className="no-scrollbar flex snap-x snap-mandatory items-start gap-3 overflow-x-auto overflow-y-hidden transition-[height] duration-200"
      >
        {products.map((p) => (
          <FeaturedSlide key={p.id} product={p} currency={currency} qty={cartQty[p.id] ?? 0} onAdd={onAdd} />
        ))}
      </div>
      {products.length > 1 && (
        <div className="mt-1 flex justify-center">
          {products.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={fr.menu.featuredSlide(i + 1, products.length)}
              aria-current={i === index ? "true" : undefined}
              className="flex h-8 w-6 items-center justify-center"
            >
              <span className={cn("h-2 rounded-full transition-all", i === index ? "w-5 bg-accent" : "w-2 bg-muted opacity-40")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
