import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { fr } from "../../i18n/fr";
import { useCartStore, type CartLine } from "../../stores/cartStore";

const NO_LINES: CartLine[] = [];

const LINE_NOTE_MAX = 150;
const ORDER_NOTE_MAX = 300;
const MAX_ITEMS = 50;

export function CartDrawer({
  token,
  currency,
  onClose,
  onOrdered,
}: {
  token: string;
  currency: string;
  onClose: () => void;
  onOrdered: () => void;
}) {
  const lines = useCartStore((s) => s.linesByToken[token] ?? NO_LINES);
  const setLines = useCartStore((s) => s.setLines);
  const clear = useCartStore((s) => s.clear);
  const rememberCancelKey = useCartStore((s) => s.rememberCancelKey);
  const [orderNote, setOrderNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sending = useRef(false); // anti double clic, même avant le rendu

  const totalQty = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);

  const updateQty = (productId: string, delta: number) => {
    setLines(token, lines
      .map((l) => (l.productId === productId ? { ...l, quantity: Math.min(20, Math.max(1, l.quantity + delta)) } : l))
      .filter((l) => l.quantity >= 1));
  };

  const updateNote = (productId: string, note: string) => {
    setLines(token, lines.map((l) => (l.productId === productId ? { ...l, note: note.slice(0, LINE_NOTE_MAX) } : l)));
  };

  const submit = async () => {
    if (sending.current || lines.length === 0 || totalQty > MAX_ITEMS) return;
    sending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      // Aucun prix envoyé : seulement produit, quantité, note.
      const res = await api.createOrder(
        token,
        lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, note: l.note || undefined })),
        orderNote,
      );
      rememberCancelKey(res.order_id, res.cancel_key);
      clear(token);
      setOrderNote("");
      setMessage(fr.cart.success(res.order_number));
      onOrdered();
    } catch (e) {
      setMessage(errorMessage(e));
      onOrdered(); // l'état réel de la table peut avoir changé
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" role="dialog" aria-modal="true" aria-label={fr.cart.title}>
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-card bg-surface p-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{fr.cart.title}</h2>
          <button onClick={onClose} className="px-3 text-sm underline">{fr.common.close}</button>
        </div>

        {lines.length === 0 && !message && <p className="text-muted">{fr.cart.empty}</p>}

        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.productId} className="rounded-card bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{l.name}</span>
                <span>{formatMoney(l.priceCents * l.quantity, currency)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button onClick={() => updateQty(l.productId, -1)} className="h-11 w-11 rounded-card border" aria-label="Diminuer">−</button>
                <span aria-label={fr.cart.quantityLabel}>{l.quantity}</span>
                <button
                  onClick={() => updateQty(l.productId, 1)}
                  disabled={l.quantity >= 20 || totalQty >= MAX_ITEMS}
                  className="h-11 w-11 rounded-card border disabled:opacity-40"
                  aria-label="Augmenter"
                >+</button>
                <button onClick={() => setLines(token, lines.filter((x) => x.productId !== l.productId))} className="ml-auto text-sm underline">
                  {fr.cart.remove}
                </button>
              </div>
              <label className="mt-2 block text-sm text-muted">
                {fr.cart.lineNote}
                <input
                  value={l.note}
                  onChange={(e) => updateNote(l.productId, e.target.value)}
                  maxLength={LINE_NOTE_MAX}
                  className="mt-1 w-full rounded-card border border-black/10 p-2 text-ink"
                />
              </label>
            </li>
          ))}
        </ul>

        {lines.length > 0 && (
          <>
            <label className="mt-4 block text-sm text-muted">
              {fr.cart.orderNote}
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value.slice(0, ORDER_NOTE_MAX))}
                maxLength={ORDER_NOTE_MAX}
                className="mt-1 w-full rounded-card border border-black/10 p-2 text-ink"
                rows={2}
              />
            </label>
            <p className="mt-1 text-right text-xs text-muted">{orderNote.length}/{ORDER_NOTE_MAX}</p>
            <p className="mt-3 flex justify-between text-sm">
              <span>{fr.cart.subtotal}</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </p>
            {totalQty >= MAX_ITEMS && <p className="mt-2 text-sm text-accent">{fr.cart.limit50}</p>}
            <button
              onClick={submit}
              disabled={busy || totalQty > MAX_ITEMS}
              className="mt-4 w-full rounded-card bg-accent py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? fr.cart.submitting : fr.cart.submit}
            </button>
          </>
        )}

        {message && <p role="status" className="mt-4 rounded-card bg-white p-3 text-sm">{message}</p>}
      </div>
    </div>
  );
}
