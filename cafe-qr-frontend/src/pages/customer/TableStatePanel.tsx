import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ApiError, errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { fr } from "../../i18n/fr";
import { useCartStore } from "../../stores/cartStore";
import type { TableState } from "../../types/api";

// 15 s = 4 requêtes/min par onglet : reste sous la limite du backend (30/min par IP et par table),
// même avec 6 ou 7 téléphones d'une même table sur le wifi du café.
const POLL_MS = 15000;

export function TableStatePanel({
  token,
  currency,
  callEnabled,
  refreshSignal,
}: {
  token: string;
  currency: string;
  callEnabled: boolean;
  refreshSignal: number;
}) {
  const [state, setState] = useState<TableState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const cancelKeys = useCartStore((s) => s.cancelKeys);

  const refresh = useCallback(async () => {
    try {
      setState(await api.getTableState(token));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [token]);

  // Polling tant que l'onglet est visible ; pause sinon, reprise immédiate au retour.
  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else {
        window.clearInterval(timer);
      }
    };
    refresh();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (refreshSignal > 0) refresh();
  }, [refreshSignal, refresh]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const cancel = async (orderId: string) => {
    const key = cancelKeys[orderId];
    if (!key) {
      setError(fr.table.cancelUnavailable);
      return;
    }
    setBusy(true);
    try {
      await api.cancelOrder(token, orderId, key);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const callWaiter = async () => {
    setBusy(true);
    try {
      await api.callWaiter(token);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.retryAfter) setCooldown(e.retryAfter);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const waiterComing = Boolean(state?.waiter_call);

  return (
    <section className="mx-4 mt-8 rounded-card bg-white p-4 shadow-sm" aria-labelledby="table-title">
      <h2 id="table-title" className="font-semibold">{fr.table.title}</h2>

      {state && !state.session && <p className="mt-2 text-muted">{fr.table.none}</p>}

      {state?.orders.map((o) => (
        <div key={o.id} className="mt-3 border-t pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Commande n° {o.order_number}</span>
            <span className="text-muted">{fr.table.status[o.status] ?? o.status}</span>
          </div>
          <ul className={`mt-1 text-sm ${o.status === "cancelled" ? "text-muted line-through" : ""}`}>
            {o.items.map((it, i) => (
              <li key={i}>
                {it.quantity} × {it.name}
                {it.note ? <span className="text-muted"> ({it.note})</span> : null}
              </li>
            ))}
          </ul>
          {o.status === "pending" && cancelKeys[o.id] && (
            <button onClick={() => cancel(o.id)} disabled={busy} className="mt-2 text-sm underline disabled:opacity-50">
              {fr.table.cancel}
            </button>
          )}
          {o.status === "pending" && !cancelKeys[o.id] && (
            <p className="mt-2 text-xs text-muted">{fr.table.cancelUnavailable}</p>
          )}
        </div>
      ))}

      {state?.session && (
        <p className="mt-4 flex justify-between font-semibold">
          <span>{fr.table.total}</span>
          <span>{formatMoney(state.total_cents, state.currency || currency)}</span>
        </p>
      )}
      {state && <p className="mt-1 text-xs text-muted">{state.disclaimer}</p>}

      {error && <p role="alert" className="mt-3 text-sm text-accent">{error}</p>}

      {callEnabled && (
        <button
          onClick={callWaiter}
          disabled={busy || waiterComing || cooldown > 0}
          className="mt-4 w-full rounded-card bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {waiterComing
            ? fr.table.waiterComing
            : cooldown > 0
              ? `Patientez ${cooldown} s`
              : fr.table.callWaiter}
        </button>
      )}
    </section>
  );
}
