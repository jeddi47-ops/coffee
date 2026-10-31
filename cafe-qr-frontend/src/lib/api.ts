// Fonctions typées pour chaque Edge Function et chaque RPC du backend (docs/API.md).
// Les fonctions publiques n'importent pas supabase-js (page du QR légère) ;
// les fonctions authentifiées le chargent à la demande.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { ApiError, fromPostgrest } from "./errors";
import type {
  AnnouncementSent, CallResult, FollowedCafe, FollowersPage, Menu, OrderCancelled, OrderCreated,
  StaffCreated, StaffOrdersPage, OrderStatus, TableState, CafeTableRow, StaffMemberRow, ProductRow,
  TableSessionRow, WaiterCallRow,
} from "../types/api";

async function callFunction<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken ?? SUPABASE_ANON_KEY}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "network");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ApiError(
      res.status,
      typeof e.code === "string" ? e.code : "unknown",
      typeof e.retry_after_seconds === "number" ? e.retry_after_seconds : undefined,
      e,
    );
  }
  return body as T;
}

async function authedToken(): Promise<string> {
  const { supabase } = await import("./supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthorized");
  return token;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw fromPostgrest(error);
  return data as T;
}

const tokenQuery = (token: string) => `token=${encodeURIComponent(token)}`;

// ---------- Edge Functions publiques ----------
export const publicApi = {
  getMenu: (token: string) => callFunction<Menu>(`get-menu?${tokenQuery(token)}`),
  getTableState: (token: string) => callFunction<TableState>(`get-table-state?${tokenQuery(token)}`),
  /** Aucun prix n'est envoyé : le serveur recalcule tout. options toujours [], order_type toujours dine_in. */
  createOrder: (token: string, items: { product_id: string; quantity: number; note?: string }[], note: string) =>
    callFunction<OrderCreated>("create-order", {
      method: "POST",
      body: JSON.stringify({ token, items, note: note.trim() || undefined, order_type: "dine_in" }),
    }),
  cancelOrder: (token: string, orderId: string, cancelKey: string) =>
    callFunction<OrderCancelled>("cancel-order", {
      method: "POST",
      body: JSON.stringify({ token, order_id: orderId, cancel_key: cancelKey }),
    }),
  callWaiter: (token: string) =>
    callFunction<CallResult>("call-waiter", { method: "POST", body: JSON.stringify({ token }) }),
};

// ---------- Edge Functions personnel (JWT) ----------
export const staffFunctions = {
  createStaff: async (input: { email: string; display_name: string; role: "manager" | "waiter" }) =>
    callFunction<StaffCreated>("create-staff", { method: "POST", body: JSON.stringify(input) }, await authedToken()),
  sendAnnouncement: async (announcementId: string) =>
    callFunction<AnnouncementSent>(
      "send-announcement",
      { method: "POST", body: JSON.stringify({ announcement_id: announcementId }) },
      await authedToken(),
    ),
};

// ---------- RPC ----------
export const staffRpc = {
  listOrders: (args: { status?: OrderStatus; cursorCreatedAt?: string; cursorId?: string; limit?: number }) =>
    rpc<StaffOrdersPage>("staff_list_orders", {
      p_status: args.status ?? null,
      p_cursor_created_at: args.cursorCreatedAt ?? null,
      p_cursor_id: args.cursorId ?? null,
      p_limit: args.limit ?? 100,
    }),
  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    rpc<unknown>("staff_update_order_status", { p_order_id: orderId, p_new_status: status }),
  handleWaiterCall: (callId: string) => rpc<WaiterCallRow>("staff_handle_waiter_call", { p_call_id: callId }),
  closeSession: (sessionId: string) => rpc<TableSessionRow>("staff_close_session", { p_session_id: sessionId }),
  setProductAvailability: (productId: string, available: boolean) =>
    rpc<ProductRow>("staff_set_product_availability", { p_product_id: productId, p_available: available }),
  regenerateTableToken: (tableId: string) => rpc<CafeTableRow>("staff_regenerate_table_token", { p_table_id: tableId }),
  setStaffActive: (staffId: string, active: boolean) =>
    rpc<StaffMemberRow>("owner_set_staff_active", { p_staff_id: staffId, p_active: active }),
  listFollowers: (limit = 1) => rpc<FollowersPage>("staff_list_followers", { p_limit: limit }),
  sessionTotal: (sessionId: string) => rpc<number>("session_total_cents", { p_session_id: sessionId }),
};

export const customerRpc = {
  followCafe: (slug: string) => rpc<unknown>("follow_cafe", { p_slug: slug }),
  myFollowedCafes: () => rpc<FollowedCafe[]>("my_followed_cafes"),
  deleteMyAccount: () => rpc<null>("delete_my_account"),
};
