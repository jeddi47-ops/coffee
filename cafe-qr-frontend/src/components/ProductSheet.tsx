// Fiche produit : s'ouvre en touchant la photo ou le nom d'une carte.
// Photos qu'on fait glisser (si plusieurs), puis même quantité et même bouton « Ajouter · prix » que la carte, fixés en bas.
import { useRef, useState } from "react";
import type { MenuProduct } from "../types/api";
import { Dialog } from "./ui/dialog";
import { AddToCartButton, Initial, PromoBadge, QuantityStepper, type AddHandler } from "./ProductCard";
import { formatMoney } from "../lib/money";
import { fr } from "../i18n/fr";
import { cn } from "../lib/utils";

/** Photos du produit : une seule = image fixe ; plusieurs = défilement horizontal avec compteur et points. */
function PhotoCarousel({ urls, name, grayscale, badge }: { urls: string[]; name: string; grayscale: boolean; badge: string | null }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const shown = urls.filter((u) => !failed.includes(u));

  const onScroll = () => {
    const el = scroller.current;
    if (el && el.clientWidth > 0) setIndex(Math.min(shown.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };

  return (
    <div className="relative overflow-hidden rounded-card">
      {shown.length === 0 ? (
        <Initial name={name} className="aspect-[4/3] w-full text-5xl" />
      ) : (
        <div
          ref={scroller}
          onScroll={onScroll}
          role={shown.length > 1 ? "region" : undefined}
          aria-roledescription={shown.length > 1 ? "carrousel" : undefined}
          aria-label={shown.length > 1 ? fr.menu.photosLabel(name) : undefined}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {shown.map((url) => (
            <img
              key={url}
              src={url}
              onError={() => setFailed((f) => [...f, url])}
              alt=""
              decoding="async"
              className={cn("aspect-[4/3] w-full shrink-0 snap-center bg-surface-2 object-cover", grayscale && "grayscale")}
            />
          ))}
        </div>
      )}
      {badge && <PromoBadge label={badge} className="absolute left-3 top-3 shadow-sm" />}
      {shown.length > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-bg" aria-label={fr.menu.photoCounter(index + 1, shown.length)}>
            {index + 1}/{shown.length}
          </span>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {shown.map((url, i) => (
              <span key={url} className={cn("h-2 rounded-full bg-surface shadow transition-all", i === index ? "w-5" : "w-2 opacity-60")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProductSheet({
  product,
  currency,
  onClose,
  onAdd,
}: {
  product: MenuProduct;
  currency: string;
  onClose: () => void;
  onAdd?: AddHandler;
}) {
  const [qty, setQty] = useState(1);
  const unavailable = !product.is_available;
  const badge = product.is_promoted ? product.promo_label || fr.menu.offer : null;
  const urls = product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : [];

  return (
    <Dialog open onClose={onClose} title={product.name} side="bottom">
      <PhotoCarousel urls={urls} name={product.name} grayscale={unavailable} badge={badge} />

      <p className="mt-4 text-2xl font-bold">{formatMoney(product.price_cents, currency)}</p>
      {product.description && <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">{product.description}</p>}
      {unavailable && <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">{fr.menu.unavailable}</p>}

      {!unavailable && onAdd && (
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 space-y-3 border-t border-line bg-surface p-4">
          <QuantityStepper value={qty} onChange={setQty} name={product.name} />
          <AddToCartButton
            label={fr.menu.addWithPrice(formatMoney(product.price_cents * qty, currency))}
            ariaLabel={fr.menu.addAria(product.name)}
            onClick={() => {
              onAdd(product, qty);
              onClose();
            }}
          />
        </div>
      )}
    </Dialog>
  );
}
