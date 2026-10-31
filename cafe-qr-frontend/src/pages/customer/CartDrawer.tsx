import { useRef, useState } from "react";
import { Minus, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Textarea, Input } from "../../components/ui/input";
import { publicApi } from "../../lib/api";
import { ApiError, errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { fr } from "../../i18n/fr";
import {
  LINE_NOTE_MAX, MAX_ITEMS, MAX_PER_LINE, ORDER_NOTE_MAX, totalQuantity, useCartStore, type CartLine,
} from "../../stores/cartStore";
import type { OrderCreated } from "../../types/api";
import { useCountdown } from "./useCountdown";

const NO_LINES: CartLine[] = [];

export function CartDrawer({
  open,
  token,
  currency,
  onClose,
  onOrdered,
  onShowTable,
}: {
  open: boolean;
  token: string;
  currency: string;
  onClose: () => void;
  onOrdered: (res: OrderCreated | null) => void;
  onShowTable: () => void;
}) {
  const lines = useCartStore((s) => s.linesByToken[token] ?? NO_LINES);
  const orderNote = useCartStore((s) => s.noteByToken[token] ?? "");
  const { setQuantity, setLineNote, remove, setOrderNote, clear, rememberCancelKey } = useCartStore.getState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const [cooldown, startCooldown] = useCountdown();
  const sending = useRef(false); // anti double clic, même avant le rendu suivant

  const totalQty = totalQuantity(lines);
  const subtotal = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);

  const submit = async () => {
    if (sending.current || lines.length === 0 || totalQty > MAX_ITEMS || cooldown > 0) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await publicApi.createOrder(
        token,
        lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, ...(l.note.trim() ? { note: l.note.trim() } : {}) })),
        orderNote,
      );
      rememberCancelKey(res.order_id, res.cancel_key);
      clear(token);
      setSuccess(res.order_number);
      onOrdered(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) startCooldown(e.retryAfter ?? 60);
      setError(errorMessage(e));
      onOrdered(null); // l'état réel de la table a pu changer
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const close = () => {
    setSuccess(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={fr.cart.title} side="bottom" className="mx-auto max-w-2xl">
      {success !== null ? (
        <div className="py-6 text-center" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold">{fr.cart.success(success)}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={() => { close(); onShowTable(); }}>{fr.table.title}</Button>
            <Button variant="secondary" onClick={close}>{fr.common.close}</Button>
          </div>
        </div>
      ) : lines.length === 0 ? (
        <p className="py-8 text-center text-muted">{fr.cart.empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.productId} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{l.name}</span>
                  <span className="shrink-0 font-semibold">{formatMoney(l.priceCents * l.quantity, currency)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => (l.quantity <= 1 ? remove(token, l.productId) : setQuantity(token, l.productId, l.quantity - 1))}
                    aria-label={l.quantity <= 1 ? fr.cart.remove(l.name) : fr.cart.decrease(l.name)}
                  >
                    {l.quantity <= 1 ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <Minus className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                  <span className="w-8 text-center font-bold" aria-label={fr.cart.quantity}>{l.quantity}</span>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setQuantity(token, l.productId, l.quantity + 1)}
                    disabled={l.quantity >= MAX_PER_LINE || totalQty >= MAX_ITEMS}
                    aria-label={fr.cart.increase(l.name)}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {l.quantity >= MAX_PER_LINE && <span className="text-xs text-muted">{fr.cart.limit20}</span>}
                </div>
                <label className="mt-2 block">
                  <span className="flex justify-between text-xs text-muted">
                    <span>{fr.cart.lineNote}</span>
                    <span>{fr.common.chars(l.note.length, LINE_NOTE_MAX)}</span>
                  </span>
                  <Input
                    value={l.note}
                    onChange={(e) => setLineNote(token, l.productId, e.target.value)}
                    maxLength={LINE_NOTE_MAX}
                    placeholder={fr.cart.lineNotePlaceholder}
                    className="mt-1"
                  />
                </label>
              </li>
            ))}
          </ul>

          <label className="mt-2 block">
            <span className="flex justify-between text-sm font-medium">
              <span>{fr.cart.orderNote}</span>
              <span className="text-xs text-muted">{fr.common.chars(orderNote.length, ORDER_NOTE_MAX)}</span>
            </span>
            <Textarea
              value={orderNote}
              onChange={(e) => setOrderNote(token, e.target.value)}
              maxLength={ORDER_NOTE_MAX}
              rows={2}
              placeholder={fr.cart.orderNotePlaceholder}
              className="mt-1"
            />
          </label>

          <div className="mt-4 rounded-card bg-surface-2 p-3">
            <p className="flex justify-between font-semibold">
              <span>{fr.cart.subtotal}</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </p>
            <p className="mt-1 text-xs text-muted">{fr.cart.subtotalHint}</p>
          </div>

          {totalQty >= MAX_ITEMS && <p className="mt-3 text-sm font-semibold text-danger">{fr.cart.limit50}</p>}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}

          <Button size="lg" className="mt-4 w-full" onClick={submit} disabled={busy || totalQty > MAX_ITEMS || cooldown > 0}>
            {busy ? fr.cart.submitting : cooldown > 0 ? fr.common.secondsLeft(cooldown) : fr.cart.submit}
          </Button>
        </>
      )}
    </Dialog>
  );
}
