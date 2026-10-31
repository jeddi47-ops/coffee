// Chargement initial, temps réel (Supabase Realtime) et secours par polling toutes les 15 s.
import { useCallback, useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { staffRpc } from "../../lib/api";
import { fromPostgrest } from "../../lib/errors";
import { playCallSound, playOrderSound } from "../../lib/sound";
import { isActiveStatus, useStaffStore, ACTIVE_STATUSES } from "../../stores/staffStore";
import type {
  CafeTableRow, CategoryRow, ProductRow, StaffOrder, TableSessionRow, WaiterCallRow, OrderStatus,
} from "../../types/api";

const FALLBACK_POLL_MS = 15000;

interface OrderRowWithItems {
  id: string;
  order_number: number;
  status: OrderStatus;
  order_type: "dine_in" | "takeaway";
  table_id: string;
  session_id: string;
  note: string | null;
  total_cents: number;
  created_at: string;
  order_items: {
    id: string;
    product_id: string | null;
    name_snapshot: string;
    unit_price_cents_snapshot: number;
    quantity: number;
    note: string | null;
    created_at: string;
  }[];
}

const tableLabel = (tableId: string) =>
  useStaffStore.getState().tables.find((t) => t.id === tableId)?.label ?? "?";

async function fetchAllActiveOrders(): Promise<StaffOrder[]> {
  const all: StaffOrder[] = [];
  for (const status of ACTIVE_STATUSES) {
    let cursor: { created_at: string; id: string } | null = null;
    for (let page = 0; page < 10; page++) {
      const res = await staffRpc.listOrders({
        status,
        cursorCreatedAt: cursor?.created_at,
        cursorId: cursor?.id,
        limit: 100,
      });
      all.push(...res.items);
      cursor = res.next_cursor;
      if (!cursor) break;
    }
  }
  return all;
}

/** Recharge une commande avec ses lignes (plutôt que d'agréger des morceaux d'événements). */
async function fetchOrder(id: string): Promise<StaffOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, order_type, table_id, session_id, note, total_cents, created_at, order_items(id, product_id, name_snapshot, unit_price_cents_snapshot, quantity, note, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) return null;
  const row = data as unknown as OrderRowWithItems;
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    order_type: row.order_type,
    table_id: row.table_id,
    table_label: tableLabel(row.table_id),
    session_id: row.session_id,
    note: row.note,
    total_cents: row.total_cents,
    created_at: row.created_at,
    items: [...row.order_items]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((i) => ({
        id: i.id,
        product_id: i.product_id,
        name: i.name_snapshot,
        unit_price_cents: i.unit_price_cents_snapshot,
        quantity: i.quantity,
        note: i.note,
      })),
  };
}

export async function refreshSessionTotal(sessionId: string): Promise<void> {
  const total = await staffRpc.sessionTotal(sessionId);
  useStaffStore.getState().setSessionTotal(sessionId, Number(total) || 0);
}

export async function reloadOrder(id: string): Promise<void> {
  const order = await fetchOrder(id);
  const st = useStaffStore.getState();
  if (order && isActiveStatus(order.status)) st.upsertOrder(order);
  else st.removeOrder(id);
  if (order?.session_id) await refreshSessionTotal(order.session_id).catch(() => undefined);
}

export async function reloadCalls(): Promise<void> {
  const { data, error } = await supabase.from("waiter_calls").select("*").eq("status", "open").order("created_at");
  if (error) throw fromPostgrest(error);
  useStaffStore.getState().setCalls((data ?? []) as WaiterCallRow[]);
}

export async function reloadTables(): Promise<void> {
  const [tablesRes, sessionsRes] = await Promise.all([
    supabase.from("cafe_tables").select("id, cafe_id, label, qr_token, is_active, created_at").order("label"),
    supabase.from("table_sessions").select("*").eq("status", "open"),
  ]);
  if (tablesRes.error) throw fromPostgrest(tablesRes.error);
  if (sessionsRes.error) throw fromPostgrest(sessionsRes.error);
  const st = useStaffStore.getState();
  st.setTables((tablesRes.data ?? []) as CafeTableRow[]);
  const sessions = (sessionsRes.data ?? []) as TableSessionRow[];
  st.setSessions(sessions);
  await Promise.all(sessions.map((s) => refreshSessionTotal(s.id).catch(() => undefined)));
}

export async function reloadCatalog(): Promise<void> {
  const [cats, prods] = await Promise.all([
    supabase.from("categories").select("id, cafe_id, name, position, is_visible").order("position"),
    supabase.from("products").select("id, cafe_id, category_id, name, description, price_cents, image_path, is_available, is_promoted, promo_label, position").order("position"),
  ]);
  if (cats.error) throw fromPostgrest(cats.error);
  if (prods.error) throw fromPostgrest(prods.error);
  useStaffStore.getState().setCatalog((cats.data ?? []) as CategoryRow[], (prods.data ?? []) as ProductRow[]);
}

export async function reloadAll(): Promise<void> {
  await reloadTables(); // d'abord : les libellés de table servent aux commandes
  const [orders] = await Promise.all([fetchAllActiveOrders(), reloadCalls(), reloadCatalog()]);
  const st = useStaffStore.getState();
  st.setOrders(orders);
  st.setLoaded(true);
}

function maybePlay(kind: "order" | "call") {
  const st = useStaffStore.getState();
  if (!st.started || !st.soundOn) return;
  if (kind === "order") playOrderSound();
  else playCallSound();
}

type Row = Record<string, unknown>;
const rowId = (p: RealtimePostgresChangesPayload<Row>): string | null =>
  ((p.new as Row)?.id as string | undefined) ?? ((p.old as Row)?.id as string | undefined) ?? null;

export function useStaffData(cafeId: string, onError: (e: unknown) => void) {
  const pollTimer = useRef<number | undefined>(undefined);
  const wasOffline = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const safe = useCallback((fn: () => Promise<void>) => {
    fn().catch((e) => onErrorRef.current(e));
  }, []);

  useEffect(() => {
    const st = useStaffStore.getState();
    let disposed = false;
    safe(reloadAll);

    const stopPolling = () => {
      window.clearInterval(pollTimer.current);
      pollTimer.current = undefined;
    };
    const goOffline = () => {
      if (disposed) return;
      useStaffStore.getState().setOnline(false);
      wasOffline.current = true;
      if (pollTimer.current === undefined) {
        pollTimer.current = window.setInterval(() => safe(reloadAll), FALLBACK_POLL_MS);
      }
    };
    const goOnline = () => {
      if (disposed) return;
      useStaffStore.getState().setOnline(true);
      stopPolling();
      if (wasOffline.current) {
        wasOffline.current = false;
        safe(reloadAll); // resynchronisation complète à la reconnexion
      }
    };

    const filter = `cafe_id=eq.${cafeId}`;
    const channel = supabase
      .channel(`staff-${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, (p: RealtimePostgresChangesPayload<Row>) => {
        const id = rowId(p);
        if (p.eventType === "INSERT" && (p.new as Row)?.status === "pending") maybePlay("order");
        if (id) safe(() => reloadOrder(id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter }, (p: RealtimePostgresChangesPayload<Row>) => {
        if (p.eventType === "INSERT") maybePlay("call");
        safe(reloadCalls);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter }, () => {
        safe(reloadTables);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products", filter }, (p: RealtimePostgresChangesPayload<Row>) => {
        const id = rowId(p);
        if (!id) return;
        safe(async () => {
          const { data, error } = await supabase
            .from("products")
            .select("id, cafe_id, category_id, name, description, price_cents, image_path, is_available, is_promoted, promo_label, position")
            .eq("id", id)
            .maybeSingle();
          if (error) throw fromPostgrest(error);
          if (data) useStaffStore.getState().upsertProduct(data as ProductRow);
        });
      })
      .subscribe((status: string) => {
        const state = String(status);
        if (state === "SUBSCRIBED") goOnline();
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") goOffline();
      });

    const onBrowserOffline = () => goOffline();
    window.addEventListener("offline", onBrowserOffline);

    return () => {
      disposed = true;
      window.removeEventListener("offline", onBrowserOffline);
      stopPolling();
      void supabase.removeChannel(channel);
      st.setLoaded(false);
    };
  }, [cafeId, safe]);
}
