// Fiche produit : s'ouvre en touchant la photo ou le nom d'une carte.
// Même quantité et même bouton « Ajouter · prix » que la carte, fixés en bas de la fiche.
import { useState } from "react";
import type { MenuProduct } from "../types/api";
import { Dialog } from "./ui/dialog";
import { AddToCartButton, Initial, PromoBadge, QuantityStepper, useImage, type AddHandler } from "./ProductCard";
import { formatMoney } from "../lib/money";
import { fr } from "../i18n/fr";
import { cn } from "../lib/utils";

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
  const img = useImage(product.image_url);
  const [qty, setQty] = useState(1);
  const unavailable = !product.is_available;
  const badge = product.is_promoted ? product.promo_label || fr.menu.offer : null;

  return (
    <Dialog open onClose={onClose} title={product.name} side="bottom">
      <div className="relative overflow-hidden rounded-card">
        {img.src ? (
          <img
            src={img.src}
            onError={img.onError}
            alt=""
            decoding="async"
            className={cn("aspect-[4/3] w-full bg-surface-2 object-cover", unavailable && "grayscale")}
          />
        ) : (
          <Initial name={product.name} className="aspect-[4/3] w-full text-5xl" />
        )}
        {badge && <PromoBadge label={badge} className="absolute left-3 top-3 shadow-sm" />}
      </div>

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
