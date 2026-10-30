// Contrats des Edge Functions publiques (voir docs/API.md du backend).
export interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  is_available: boolean;
  is_promoted: boolean;
  promo_label: string | null;
  position: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  position: number;
  products: MenuProduct[];
}

export interface Menu {
  cafe: {
    name: string;
    slug: string;
    logo_url: string | null;
    currency: string;
    ordering_enabled: boolean;
    call_waiter_enabled: boolean;
  };
  table: { label: string };
  categories: MenuCategory[];
}

export type OrderStatus = "pending" | "accepted" | "preparing" | "served" | "cancelled";

export interface TableOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  order_type: "dine_in" | "takeaway";
  note: string | null;
  total_cents: number;
  created_at: string;
  items: { name: string; unit_price_cents: number; quantity: number; note: string | null }[];
}

export interface TableState {
  table: { label: string };
  session: { id: string; opened_at: string } | null;
  orders: TableOrder[];
  total_cents: number;
  currency: string;
  waiter_call: { id: string; status: string; created_at: string } | null;
  disclaimer: string;
}

export interface OrderCreated {
  order_id: string;
  order_number: number;
  status: OrderStatus;
  order_total_cents: number;
  session_id: string;
  session_total_cents: number;
  currency: string;
  cancel_key: string;
}

export interface CallResult {
  created: boolean;
  call: { id: string; status: string; created_at: string };
}
