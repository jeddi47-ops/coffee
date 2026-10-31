// Contrats du backend (docs/API.md) : réponses des Edge Functions et lignes des tables.

export type StaffRole = "owner" | "manager" | "waiter";
export type OrderStatus = "pending" | "accepted" | "preparing" | "served" | "cancelled";
export type AnnouncementStatus = "draft" | "sending" | "sent";

// ---------- Edge Functions publiques ----------
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

export interface MenuCafe {
  name: string;
  slug: string;
  logo_url: string | null;
  currency: string;
  ordering_enabled: boolean;
  call_waiter_enabled: boolean;
  /** Section 14 : peut être absent (ancienne réponse en cache) -> thème par défaut. */
  theme?: { accent?: string | null; mode?: string | null } | null;
  tagline?: string | null;
}

export interface Menu {
  cafe: MenuCafe;
  table: { label: string };
  categories: MenuCategory[];
}

export interface TableOrderItem {
  name: string;
  unit_price_cents: number;
  quantity: number;
  note: string | null;
}

export interface TableOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  order_type: "dine_in" | "takeaway";
  note: string | null;
  total_cents: number;
  created_at: string;
  items: TableOrderItem[];
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

export interface OrderCancelled {
  order_id: string;
  order_number: number;
  status: OrderStatus;
  session_total_cents: number;
  currency: string;
}

export interface CallResult {
  created: boolean;
  call: { id: string; status: string; created_at: string };
}

// ---------- Edge Functions personnel ----------
export interface StaffCreated {
  staff_member: StaffMemberRow & { email: string };
}

export interface AnnouncementSent {
  announcement_id: string;
  status: "sent" | "partial";
  sent_count: number;
  failed_count: number;
}

// ---------- Lignes des tables (PostgREST) ----------
export interface CafeRow {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  currency: string;
  is_active: boolean;
  ordering_enabled: boolean;
  call_waiter_enabled: boolean;
  order_rate_limit: number;
  waiter_call_cooldown_seconds: number;
  session_stale_hours: number;
  theme_accent?: string | null;
  theme_mode?: string | null;
  tagline?: string | null;
}

export interface StaffMemberRow {
  id: string;
  cafe_id: string;
  role: StaffRole;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface CafeTableRow {
  id: string;
  cafe_id: string;
  label: string;
  qr_token: string;
  is_active: boolean;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  cafe_id: string;
  name: string;
  position: number;
  is_visible: boolean;
}

export interface ProductRow {
  id: string;
  cafe_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_path: string | null;
  is_available: boolean;
  is_promoted: boolean;
  promo_label: string | null;
  position: number;
}

export interface TableSessionRow {
  id: string;
  cafe_id: string;
  table_id: string;
  status: "open" | "closed";
  opened_at: string;
  last_activity_at: string;
  closed_at: string | null;
}

export interface WaiterCallRow {
  id: string;
  cafe_id: string;
  table_id: string;
  session_id: string | null;
  status: "open" | "handled";
  created_at: string;
  handled_at: string | null;
}

export interface AnnouncementRow {
  id: string;
  cafe_id: string;
  title: string;
  body: string;
  image_path: string | null;
  status: AnnouncementStatus;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
}

export interface FollowedCafe {
  cafe_id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  notifications_opt_in: boolean;
  unsubscribed_at: string | null;
  followed_at: string;
}

// ---------- RPC personnel ----------
export interface StaffOrderItem {
  id?: string;
  product_id: string | null;
  name: string;
  unit_price_cents: number;
  quantity: number;
  note: string | null;
}

export interface StaffOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  order_type: "dine_in" | "takeaway";
  table_id: string;
  table_label: string;
  session_id: string;
  note: string | null;
  total_cents: number;
  created_at: string;
  items: StaffOrderItem[];
}

export interface StaffOrdersPage {
  items: StaffOrder[];
  next_cursor: { created_at: string; id: string } | null;
}

export interface FollowersPage {
  items: { customer_id: string; notifications_opt_in: boolean; unsubscribed_at: string | null; created_at: string }[];
  active_subscribers: number;
  next_cursor: { created_at: string; customer_id: string } | null;
}
