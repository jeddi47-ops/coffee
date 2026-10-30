import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import { ApiError } from "./errors";
import type { CallResult, Menu, OrderCreated, TableState } from "../types/api";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      ...init,
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", ...(init?.headers ?? {}) },
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
    );
  }
  return body as T;
}

const q = (token: string) => `token=${encodeURIComponent(token)}`;

export const api = {
  getMenu: (token: string) => call<Menu>(`get-menu?${q(token)}`),
  getTableState: (token: string) => call<TableState>(`get-table-state?${q(token)}`),
  // Aucun prix n'est envoyé : le serveur recalcule tout.
  createOrder: (token: string, items: { product_id: string; quantity: number; note?: string }[], note: string) =>
    call<OrderCreated>("create-order", {
      method: "POST",
      body: JSON.stringify({ token, items, note: note || null, order_type: "dine_in" }),
    }),
  cancelOrder: (token: string, orderId: string, cancelKey: string) =>
    call<{ order_id: string; status: string }>("cancel-order", {
      method: "POST",
      body: JSON.stringify({ token, order_id: orderId, cancel_key: cancelKey }),
    }),
  callWaiter: (token: string) =>
    call<CallResult>("call-waiter", { method: "POST", body: JSON.stringify({ token }) }),
};
