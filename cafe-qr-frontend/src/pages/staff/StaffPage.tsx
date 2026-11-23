import { StaffLoyalty } from "../Loyalty";
// /staff : écran de service en temps réel (commandes, appels, tables, ruptures).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Coffee, ConciergeBell, Grid2X2, ScanLine, MoreHorizontal, Bell, LogOut, Moon, Settings, Sun, Volume2, VolumeX } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useStaffStore } from "../../stores/staffStore";
import { staffRpc } from "../../lib/api";
import { ApiError, errorMessage } from "../../lib/errors";
import { unlockAudio } from "../../lib/sound";
import { enableWakeLock, disableWakeLock } from "../../lib/wakelock";
import { enablePush, ensurePushRegistered, getPushState, type PushState } from "../../lib/webpush";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { ConnectionBanner } from "../../components/ConnectionBanner";
import { ListSkeleton } from "../../components/Skeletons";
import type { OrderStatus, ProductRow, StaffOrder, TableSessionRow, WaiterCallRow } from "../../types/api";
import { OrderCard } from "./OrderCard";
import { PushBanner } from "./PushBanner";
import { minutesSince } from "../../lib/time";
import { TablesView } from "./TablesView";
import { AvailabilityList } from "./AvailabilityList";
import { reloadAll, reloadCalls, reloadOrder, reloadTables, useStaffData } from "./useStaffData";

type Tab = "orders" | "tables" | "stock" | "loyalty";

export default function StaffPage() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const st = useStaffStore();
  const [tab, setTab] = useState<Tab>("orders");
  const [now, setNow] = useState(Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushState>(() => getPushState());

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

  // Alertes push : remet l'abonnement du téléphone à jour si l'autorisation est déjà donnée.
  useEffect(() => {
    void ensurePushRegistered();
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

  const enableAlerts = () => enablePush().catch(() => getPushState());

  const start = async () => {
    // D'abord : la demande d'autorisation doit partir directement du toucher.
    const alerts = enableAlerts();
    await unlockAudio().catch(() => false);
    await enableWakeLock().catch(() => false);
    st.setStarted(true);
    setPushState(await alerts);
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

  const tabs = [
    { id: "orders", label: "Service", Icon: ConciergeBell },
    { id: "tables", label: "Tables", Icon: Grid2X2 },
    { id: "loyalty", label: "Scanner", Icon: ScanLine },
    { id: "stock", label: "Plus", Icon: MoreHorizontal },
  ] as const;
  const queue = [
    ...calls.map(call => ({ kind: "call" as const, item: call })),
    ...pending.map(order => ({ kind: "order" as const, item: order })),
  ].sort((a,b) => a.item.created_at.localeCompare(b.item.created_at));

  return (
    <div data-theme={st.night ? "dark" : "light"} className={cn("min-h-screen text-ink", st.night ? "staff-night bg-bg" : "bg-[#fbf7ef]")}>
      <header className="sticky top-0 z-30 bg-[#211a13] text-white">
        <ConnectionBanner online={st.online} />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <span className="flex items-center gap-2 text-xl font-bold text-[#ebc577]"><Coffee /> Café QR</span>
          <Button variant="ghost" size="icon" onClick={() => st.setSoundOn(!st.soundOn)} aria-label={fr.staff.sound} aria-pressed={st.soundOn}>{st.soundOn ? <Volume2/> : <VolumeX/>}</Button>
        </div>
      </header>
      <nav aria-label="Navigation du service" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-lg grid-cols-4">{tabs.map(({id,label,Icon}) => (
          <button key={id} type="button" aria-current={tab === id ? "page" : undefined}
            className={cn("flex min-h-[62px] flex-col items-center justify-center gap-1 text-xs font-bold",tab === id && (st.night ? "text-amber-300" : "text-[#875d0d]"))}
            onClick={() => { setTab(id); window.scrollTo(0,0); }}><Icon aria-hidden="true"/>{label}{id === "orders" && tab !== id && queue.length > 0 && ` (${queue.length})`}</button>
        ))}</div>
      </nav>
      {message && (
        <div role="alert" className="sticky top-[120px] z-20 mx-3 mt-3 rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">
          {message}
        </div>
      )}

      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-28 pt-5">
        <header><h1 className="text-3xl font-black">{tab === "orders" ? "Service en salle" : tabs.find(t => t.id === tab)?.label}</h1>
        <p className="mt-1 text-muted">{staff.staff.display_name} · {fr.admin.roles[staff.staff.role]} · {staff.cafe.name}</p></header>
        {tab === "loyalty" ? <StaffLoyalty /> : !st.loaded ? (
          <ListSkeleton rows={4} />
        ) : tab === "orders" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="col-pending">
              <h2 id="col-pending" className="mb-3 text-lg font-bold">À traiter · {queue.length}</h2>
              <div className="space-y-3">
                {!queue.length && <p className="text-muted">Aucune demande en attente.</p>}
                {queue.map(entry => entry.kind === "order" ? (
                  <OrderCard key={"order-"+entry.item.id} order={entry.item} currency={currency} now={now} busy={busyId === entry.item.id} onTransition={transition} />
                ) : (
                  <article key={"call-"+entry.item.id} className="rounded-card border border-line border-l-4 border-l-amber-600 bg-surface p-4">
                    <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold"><Bell size={18}/> Appel serveur</span><span className="text-sm text-muted">{minutesSince(entry.item.created_at,now)} min</span></div>
                    <h3 className="my-2 text-2xl font-black">{fr.staff.tableName(tableLabel(entry.item.table_id))}</h3>
                    <Button size="lg" className="w-full" disabled={busyId === entry.item.id} onClick={() => void handleCall(entry.item)}>Prendre en charge</Button>
                  </article>
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
          <div className="space-y-4">
            <PushBanner state={pushState} onEnable={() => void enableAlerts().then(setPushState)} />
            <Button variant="secondary" aria-pressed={st.night} onClick={() => st.setNight(!st.night)}>{st.night ? <Sun/> : <Moon/>} Mode nuit</Button>
            {staff.staff.role !== "waiter" && <Link className="flex min-h-11 items-center gap-2" to="/admin"><Settings/>Administration</Link>}
            <Button variant="ghost" onClick={() => void signOut(null)}><LogOut/> Se déconnecter</Button>
            <h2 className="text-xl font-bold">Disponibilité des produits</h2>
          <AvailabilityList categories={st.categories} products={st.products} busyId={busyId} onToggle={(p, out) => void toggleStock(p, out)} /></div>
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
