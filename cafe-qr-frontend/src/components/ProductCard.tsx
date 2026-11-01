
/** `quantity` = nombre d'unités choisies avant de toucher « Ajouter ». */
export type AddHandler = (p: MenuProduct, quantity: number) => void;

export function useImage(url: string | null) {
  const [failed, setFailed] = useState(false);
  return { src: url && !failed ? url : null, onError: () => setFailed(true) };
}

export function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex shrink-0 items-center justify-center bg-surface-2 font-bold text-muted", className)}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

export function PromoBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-block max-w-full truncate rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-fg", className)}>
      {label}
    </span>
  );
}

/** Quantité « − 1 + » sur toute la largeur, boutons de 44 px minimum (pouce). */
export function QuantityStepper({
  value,
  onChange,
  name,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  name: string;
  className?: string;
}) {
  const btn = "flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-line disabled:opacity-35";
  return (
    <div
      role="group"
      aria-label={fr.cart.quantity}
      className={cn("flex w-full items-center justify-between rounded-full border border-line bg-surface-2", className)}
    >
      <button type="button" disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label={fr.cart.decrease(name)} className={btn}>
        <Minus className="h-5 w-5" aria-hidden="true" />
      </button>
      <span aria-live="polite" className="min-w-[2ch] text-center text-base font-bold tabular-nums">{value}</span>
      <button type="button" disabled={value >= MAX_PER_LINE} onClick={() => onChange(value + 1)} aria-label={fr.cart.increase(name)} className={btn}>
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Bouton « Ajouter » pleine largeur, à la couleur du café. */
export function AddToCartButton({ label, ariaLabel, onClick }: { label: string; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-accent px-4 text-base font-bold text-accent-fg shadow-sm active:scale-[0.98]"
    >
      {label}
    </button>
  );
}

/** Petit bouton « + » : ajout rapide d'une unité (carrousel « À la une »). */
function QuickAddButton({ product, qty, onAdd }: { product: MenuProduct; qty: number; onAdd?: AddHandler }) {
  if (!product.is_available) {
    return <span className="text-xs font-semibold uppercase tracking-wide text-muted">{fr.menu.unavailable}</span>;
  }
  if (!onAdd) return null;
  return (
    <button
      type="button"
      onClick={() => onAdd(product, 1)}
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

/**
 * Carte de la grille (2 colonnes) : photo + badge, nom sur 2 lignes max, prix, quantité, « Ajouter ».
 * La description complète est dans la fiche (ProductSheet), ouverte en touchant la photo ou le nom.
 */
export function ProductCard({
  product,
  currency,
  onAdd,
  onOpen,
}: {
  product: MenuProduct;
  currency: string;
  onAdd?: AddHandler;
  onOpen: (p: MenuProduct) => void;
}) {
  const img = useImage(product.image_url);
  const [qty, setQty] = useState(1);
  const unavailable = !product.is_available;
  const badge = product.is_promoted ? product.promo_label || fr.menu.offer : null;

  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface", unavailable && "opacity-60")}>
      {/* Le nom ci-dessous est le point d'accès clavier / lecteur d'écran ; la photo double juste le geste tactile. */}
      <button type="button" onClick={() => onOpen(product)} tabIndex={-1} aria-hidden="true" className="relative block w-full text-left">
        {img.src ? (
          <img
            src={img.src}
            onError={img.onError}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn("aspect-[4/3] w-full bg-surface-2 object-cover", unavailable && "grayscale")}
          />
        ) : (
          <Initial name={product.name} className="aspect-[4/3] w-full text-4xl" />
        )}
        {badge && <PromoBadge label={badge} className="absolute left-2 top-2 max-w-[calc(100%-1rem)] shadow-sm" />}
      </button>

      <div className="flex flex-1 flex-col p-3">
        <button type="button" onClick={() => onOpen(product)} aria-label={fr.menu.openAria(product.name)} className="text-left">
          <h3 className="line-clamp-2 font-semibold leading-snug">{product.name}</h3>
        </button>
        <p className="mt-1 text-lg font-bold">{formatMoney(product.price_cents, currency)}</p>

        <div className="mt-auto space-y-2 pt-3">
          {unavailable ? (
            <p className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">{fr.menu.unavailable}</p>
          ) : onAdd ? (
            <>
              <QuantityStepper value={qty} onChange={setQty} name={product.name} />
              <AddToCartButton
                label={fr.menu.add}
                ariaLabel={fr.menu.addAria(product.name)}
                onClick={() => {
                  onAdd(product, qty);
                  setQty(1);
                }}
              />
            </>
          ) : null}
        </div>
      </div>
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
  onOpen,
}: {
  product: MenuProduct;
  currency: string;
  qty: number;
  onAdd?: AddHandler;
  onOpen: (p: MenuProduct) => void;
}) {
  const img = useImage(product.image_url);
  const promo = product.promo_label || fr.menu.offer;

  return (
    <article
      className={cn("w-full shrink-0 snap-center overflow-hidden rounded-card border border-line bg-surface", !product.is_available && "opacity-60")}
    >
      {img.src && (
        <div className="relative">
          <button type="button" onClick={() => onOpen(product)} tabIndex={-1} aria-hidden="true" className="block w-full">
            <img
              src={img.src}
              onError={img.onError}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn("aspect-[16/9] w-full bg-surface-2 object-cover", !product.is_available && "grayscale")}
            />
          </button>
          <PromoBadge label={promo} className="pointer-events-none absolute left-3 top-3 shadow-sm" />
        </div>
      )}
      <div className={cn("flex items-end justify-between gap-3 p-4", !img.src && "bg-accent-soft")}>
        <div className="min-w-0">
          {!img.src && <PromoBadge label={promo} className="mb-2" />}
          <button type="button" onClick={() => onOpen(product)} aria-label={fr.menu.openAria(product.name)} className="text-left">
            <h3 className="line-clamp-2 text-lg font-bold leading-snug">{product.name}</h3>
          </button>
          <p className="mt-1 font-bold">{formatMoney(product.price_cents, currency)}</p>
        </div>
        <QuickAddButton product={product} qty={qty} onAdd={onAdd} />
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
  onOpen,
}: {
  products: MenuProduct[];
  currency: string;
  cartQty: Record<string, number>;
  onAdd?: AddHandler;
  onOpen: (p: MenuProduct) => void;
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
          <FeaturedSlide key={p.id} product={p} currency={currency} qty={cartQty[p.id] ?? 0} onAdd={onAdd} onOpen={onOpen} />
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
