import { useState } from "react";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { publicApi } from "../../lib/api";
import { ApiError, errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { formatTime } from "../../lib/time";
import { fr } from "../../i18n/fr";
import { useCartStore } from "../../stores/cartStore";
import type { TableState } from "../../types/api";
import { cn } from "../../lib/utils";

export function TableStatePanel({
  open,
  onClose,
  token,
  state,
  currency,
  refresh,
  applyServerTotal,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  state: TableState | null;
  currency: string;
  refresh: () => Promise<void>;
  applyServerTotal: (cents: number) => void;
}) {
  const cancelKeys = useCartStore((s) => s.cancelKeys);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cancel = async (orderId: string) => {
    const key = cancelKeys[orderId];
    if (!key) return;
    setBusyId(orderId);
    setMessage(null);
    try {
      const res = await publicApi.cancelOrder(token, orderId, key);
      applyServerTotal(res.session_total_cents);
    } catch (e) {
      setMessage(e instanceof ApiError && e.code === "order_not_pending" ? fr.table.alreadyTaken : errorMessage(e));
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  const cur = state?.currency || currency;

  return (
    <Dialog open={open} onClose={onClose} title={fr.table.title} side="bottom" className="mx-auto max-w-2xl">
      {!state ? (
        <p className="py-6 text-center text-muted">{fr.common.loading}</p>
      ) : (
        <>
          {(!state.session || state.orders.length === 0) && (
            <p className="py-4 text-center text-muted">{fr.table.none}</p>
          )}

          <ul className="space-y-3">
            {state.orders.map((o) => {
              const cancelled = o.status === "cancelled";
              return (
                <li key={o.id} className="rounded-card border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{fr.table.order(o.order_number)}</span>
                    <span className="text-xs text-muted">{formatTime(o.created_at)}</span>
                  </div>
                  <p className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    o.status === "pending" ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink")}>
                    {fr.table.status[o.status] ?? o.status}
                  </p>
                  <ul className={cn("mt-2 space-y-0.5 text-sm", cancelled && "text-muted line-through")}>
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.quantity} × {it.name}
                        {it.note ? <span className="text-muted"> ({it.note})</span> : null}
                      </li>
                    ))}
                  </ul>
                  {o.note && <p className={cn("mt-1 text-xs text-muted", cancelled && "line-through")}>{o.note}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={cn("text-sm font-semibold", cancelled && "text-muted line-through")}>
                      {formatMoney(o.total_cents, cur)}
                    </span>
                    {cancelled && <span className="text-xs text-muted">{fr.table.excluded}</span>}
                    {o.status === "pending" && cancelKeys[o.id] && (
                      <Button variant="secondary" size="sm" onClick={() => cancel(o.id)} disabled={busyId === o.id}>
                        {fr.table.cancel}
                      </Button>
                    )}
                  </div>
                  {o.status === "pending" && !cancelKeys[o.id] && (
                    <p className="mt-2 text-xs text-muted">{fr.table.cancelUnavailable}</p>
                  )}
                </li>
              );
            })}
          </ul>

          {message && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{message}</p>}

          <div className="mt-4 rounded-card bg-surface-2 p-3">
            <p className="flex justify-between text-lg font-bold">
              <span>{fr.table.total}</span>
              <span>{formatMoney(state.session ? state.total_cents : 0, cur)}</span>
            </p>
            <p className="mt-1 text-xs text-muted">{state.disclaimer}</p>
          </div>
        </>
      )}
    </Dialog>
  );
}
