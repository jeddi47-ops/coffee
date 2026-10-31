// /staff : écran de service en temps réel (commandes, appels, tables, ruptures).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, LogOut, Moon, Settings, Sun, Volume2, VolumeX } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useStaffStore } from "../../stores/staffStore";
import { staffRpc } from "../../lib/api";
import { ApiError, errorMessage } from "../../lib/errors";
import { unlockAudio } from "../../lib/sound";
import { enableWakeLock, disableWakeLock } from "../../lib/wakelock";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { ConnectionBanner } from "../../components/ConnectionBanner";
import { ListSkeleton } from "../../components/Skeletons";
import type { OrderStatus, ProductRow, StaffOrder, TableSessionRow, WaiterCallRow } from "../../types/api";
import { OrderCard } from "./OrderCard";
import { CallsPanel } from "./CallsPanel";
import { TablesView } from "./TablesView";
import { AvailabilityList } from "./AvailabilityList";
import { reloadAll, reloadCalls, reloadOrder, reloadTables, useStaffData } from "./useStaffData";

type Tab = "orders" | "calls" | "tables" | "stock";

export default function StaffPage() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const st = useStaffStore();
  const [tab, setTab] = useState<Tab>("orders");
  const [now, setNow] = useState(Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const staff = profile?.kind === "staff" ? profile : null;
  const cafeId = staff?.staff.cafe_id ?? "";
  const currency = staff?.cafe.currency ?? "EUR";

  // Toute erreur : message clair + rechargement complet. Un employé désactivé est déconnecté.
  const handleError = useCallback(
    async (e: unknown) => {
      setMessage(errorMessage(e));
      if (e instanceof ApiError && (e.code === "forbidden" || e.status === 401)) {
        const p = await loadProfile().catch(() => null);
        if (p?.kind !== "staff") {
          await signOut(fr.auth.deactivated);
          return;
        }
      }
      await reloadAll().catch(() => undefined);
    },
    [loadProfile, signOut],
  );

  useStaffData(cafeId, (e) => void handleError(e));

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(t);
  }, [message]);

  // PWA : service worker minimal (installation uniquement, aucun cache de données).
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      void disableWakeLock();
    };
  }, []);

  const orders = useMemo(
    () => Object.values(st.orders).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [st.orders],
  );
  const pending = orders.filter((o) => o.status === "pending");
  const inProgress = orders.filter((o) => o.status === "accepted" || o.status === "preparing");
  const calls = useMemo(
    () => Object.values(st.calls).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [st.calls],
  );
  const callTables = useMemo(() => new Set(calls.map((c) => c.table_id)), [calls]);
  const tableLabel = (id: string) => st.tables.find((t) => t.id === id)?.label ?? "?";

  if (!staff) return null;

  const start = async () => {
    await unlockAudio().catch(() => false);
    await enableWakeLock().catch(() => false);
    st.setStarted(true);
  };

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } catch (e) {
      await handleError(e);
    } finally {
      setBusyId(null);
    }
  };

  const transition = (order: StaffOrder, to: OrderStatus) =>
    run(order.id, async () => {
      await staffRpc.updateOrderStatus(order.id, to);
      await reloadOrder(order.id); // l'écran reflète la vérité du serveur
    });

  const handleCall = (call: WaiterCallRow) =>
    run(call.id, async () => {
      await staffRpc.handleWaiterCall(call.id);
      await reloadCalls();
    });

  const settle = (session: TableSessionRow) =>
    run(session.id, async () => {
      await staffRpc.closeSession(session.id);
      await Promise.all([reloadTables(), reloadCalls()]);
    });

  const toggleStock = (product: ProductRow, outOfStock: boolean) =>
    run(product.id, async () => {
      const updated = await staffRpc.setProductAvailability(product.id, !outOfStock);
      useStaffStore.getState().upsertProduct(updated);
    });

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "orders", label: fr.staff.tabs.orders, count: pending.length },
    { id: "calls", label: fr.staff.tabs.calls, count: calls.length },
    { id: "tables", label: fr.staff.tabs.tables },
    { id: "stock", label: fr.staff.tabs.stock },
  ];

  return (
    <div data-theme={st.night ? "dark" : "light"} className={cn("min-h-screen bg-bg text-ink", st.night && "staff-night")}>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <ConnectionBanner online={st.online} />
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{staff.cafe.name}</p>
            <p className="truncate text-xs text-muted">{staff.staff.display_name} · {fr.admin.roles[staff.staff.role]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => st.setSoundOn(!st.soundOn)} aria-label={fr.staff.sound} aria-pressed={st.soundOn}>
            {st.soundOn ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => st.setNight(!st.night)} aria-label={fr.staff.night} aria-pressed={st.night}>
            {st.night ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </Button>
          {staff.staff.role !== "waiter" && (
            <Link to="/admin" aria-label={fr.staff.adminLink} className="flex h-11 w-11 items-center justify-center rounded-card hover:bg-surface-2">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={() => void signOut(null)} aria-label={fr.common.logout}>
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-2" aria-label={fr.staff.title}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex min-h-[48px] shrink-0 items-center gap-2 rounded-card px-4 text-base font-bold",
                tab === t.id ? "bg-accent text-accent-fg" : "text-ink hover:bg-surface-2",
              )}
            >
              {t.id === "calls" && <Bell className="h-4 w-4" aria-hidden="true" />}
              {t.label}
              {t.count ? (
                <span className={cn("flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs", t.id === "calls" ? "bg-danger text-danger-fg" : "bg-surface-2 text-ink")}>
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      {message && (
        <div role="alert" className="sticky top-[120px] z-20 mx-3 mt-3 rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">
          {message}
        </div>
      )}

      <main className="p-3 pb-10">
        {!st.loaded ? (
          <ListSkeleton rows={4} />
        ) : tab === "orders" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="col-pending">
              <h2 id="col-pending" className="mb-3 text-lg font-bold">{fr.staff.toAccept} ({pending.length})</h2>
              <div className="space-y-3">
                {pending.length === 0 && <p className="text-muted">{fr.staff.noPending}</p>}
                {pending.map((o) => (
                  <OrderCard key={o.id} order={o} currency={currency} now={now} busy={busyId === o.id} onTransition={transition} />
                ))}
              </div>
            </section>
            <section aria-labelledby="col-progress">
              <h2 id="col-progress" className="mb-3 text-lg font-bold">{fr.staff.inProgress} ({inProgress.length})</h2>
              <div className="space-y-3">
                {inProgress.length === 0 && <p className="text-muted">{fr.staff.noInProgress}</p>}
                {inProgress.map((o) => (
                  <OrderCard key={o.id} order={o} currency={currency} now={now} busy={busyId === o.id} onTransition={transition} />
                ))}
              </div>
            </section>
          </div>
        ) : tab === "calls" ? (
          <section aria-label={fr.staff.calls}>
            <CallsPanel calls={calls} tableLabel={tableLabel} now={now} busyId={busyId} onHandle={(c) => void handleCall(c)} />
          </section>
        ) : tab === "tables" ? (
          <TablesView
            tables={st.tables}
            sessionsByTable={st.sessionsByTable}
            sessionTotals={st.sessionTotals}
            callTables={callTables}
            currency={currency}
            staleHours={staff.cafe.session_stale_hours}
            onSettle={settle}
          />
        ) : (
          <AvailabilityList categories={st.categories} products={st.products} busyId={busyId} onToggle={(p, out) => void toggleStock(p, out)} />
        )}
      </main>

      {!st.started && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-6">
          <div className="w-full max-w-sm rounded-card bg-surface p-6 text-center">
            <h2 className="text-xl font-bold">{fr.staff.startTitle}</h2>
            <p className="mt-2 text-sm text-muted">{fr.staff.startText}</p>
            <Button size="lg" className="mt-6 w-full text-lg" onClick={() => void start()}>{fr.staff.start}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
