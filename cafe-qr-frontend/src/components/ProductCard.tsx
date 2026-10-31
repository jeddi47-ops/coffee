// Carte produit. Doit rester propre sans photo : carte compacte avec l'initiale, jamais d'image cassée.
import { useState } from "react";
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

/** Carte verticale de la section « À la une ». */
export function FeaturedCard({
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
  const promo = product.promo_label || fr.menu.featured;

  return (
    <article
      className={cn(
        "flex w-[11.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-card border border-line bg-surface",
        !product.is_available && "opacity-60",
      )}
    >
      {img.src ? (
        <div className="relative">
          <img
            src={img.src}
            onError={img.onError}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn("aspect-[4/3] w-full bg-surface-2 object-cover", !product.is_available && "grayscale")}
          />
          <PromoBadge label={promo} className="absolute left-2 top-2 shadow-sm" />
        </div>
      ) : (
        <div className="px-3 pt-3">
          <PromoBadge label={promo} />
        </div>
      )}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        {product.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{product.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="font-bold">{formatMoney(product.price_cents, currency)}</span>
          <AddButton product={product} qty={qty} onAdd={onAdd} />
        </div>
      </div>
    </article>
  );
}
