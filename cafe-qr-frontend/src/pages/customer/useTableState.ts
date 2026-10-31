import { useCallback, useEffect, useRef, useState } from "react";
import { publicApi } from "../../lib/api";
import type { TableState } from "../../types/api";

// 8 s tant qu'une commande est en attente (le bouton « Annuler » disparaît en moins de 10 s
// après acceptation), 15 s sinon (marge sur la limite de 30 req/min par IP et par table).
const FAST_MS = 8000;
const SLOW_MS = 15000;

export function useTableState(token: string) {
  const [state, setState] = useState<TableState | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setState(await publicApi.getTableState(token));
      setFailed(false);
    } catch {
      setFailed(true); // pas de réessai en boucle : le prochain cycle de polling réessaie
    } finally {
      inFlight.current = false;
    }
  }, [token]);

  const hasPending = Boolean(state?.orders.some((o) => o.status === "pending"));

  // Polling uniquement onglet visible : pause quand il est caché, reprise immédiate au retour.
  useEffect(() => {
    let timer: number | undefined;
    const delay = hasPending ? FAST_MS : SLOW_MS;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await refresh();
          schedule();
        }
      }, delay);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        schedule();
      } else {
        window.clearTimeout(timer);
      }
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, hasPending]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Applique immédiatement le total renvoyé par le serveur (create-order / cancel-order). */
  const applyServerTotal = useCallback((totalCents: number) => {
    setState((s) => (s ? { ...s, total_cents: totalCents } : s));
  }, []);

  return { state, failed, refresh, applyServerTotal };
}
