// État de l'écran de service. Reflète toujours la vérité du serveur (aucune mise à jour optimiste).
import { create } from "zustand";
import type { CafeTableRow, CategoryRow, ProductRow, StaffOrder, TableSessionRow, WaiterCallRow } from "../types/api";
import { loadSoundPref, saveSoundPref } from "../lib/sound";

const NIGHT_KEY = "cafeqr-night";

interface StaffState {
  orders: Record<string, StaffOrder>;
  calls: Record<string, WaiterCallRow>;
  tables: CafeTableRow[];
  sessionsByTable: Record<string, TableSessionRow>;
  sessionTotals: Record<string, number>;
  products: ProductRow[];
  categories: CategoryRow[];
  online: boolean;
  started: boolean;
  soundOn: boolean;
  night: boolean;
  loaded: boolean;

  setOrders: (orders: StaffOrder[]) => void;
  upsertOrder: (order: StaffOrder) => void;
  removeOrder: (id: string) => void;
  setCalls: (calls: WaiterCallRow[]) => void;
  upsertCall: (call: WaiterCallRow) => void;
  removeCall: (id: string) => void;
  setTables: (tables: CafeTableRow[]) => void;
  setSessions: (sessions: TableSessionRow[]) => void;
  upsertSession: (s: TableSessionRow) => void;
  removeSessionForTable: (tableId: string) => void;
  setSessionTotal: (sessionId: string, cents: number) => void;
  setCatalog: (categories: CategoryRow[], products: ProductRow[]) => void;
  upsertProduct: (p: ProductRow) => void;
  setOnline: (online: boolean) => void;
  setStarted: (started: boolean) => void;
  setSoundOn: (on: boolean) => void;
  setNight: (on: boolean) => void;
  setLoaded: (loaded: boolean) => void;
}

export const ACTIVE_STATUSES = ["pending", "accepted", "preparing"] as const;
export const isActiveStatus = (s: string) => (ACTIVE_STATUSES as readonly string[]).includes(s);

export const useStaffStore = create<StaffState>()((set) => ({
  orders: {},
  calls: {},
  tables: [],
  sessionsByTable: {},
  sessionTotals: {},
  products: [],
  categories: [],
  online: true,
  started: false,
  soundOn: loadSoundPref(),
  night: localStorage.getItem(NIGHT_KEY) === "on",
  loaded: false,

  setOrders: (orders) => set({ orders: Object.fromEntries(orders.map((o) => [o.id, o])) }),
  upsertOrder: (order) => set((s) => ({ orders: { ...s.orders, [order.id]: order } })),
  removeOrder: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.orders;
      return { orders: rest };
    }),
  setCalls: (calls) => set({ calls: Object.fromEntries(calls.map((c) => [c.id, c])) }),
  upsertCall: (call) => set((s) => ({ calls: { ...s.calls, [call.id]: call } })),
  removeCall: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.calls;
      return { calls: rest };
    }),
  setTables: (tables) => set({ tables }),
  setSessions: (sessions) => set({ sessionsByTable: Object.fromEntries(sessions.map((x) => [x.table_id, x])) }),
  upsertSession: (session) => set((s) => ({ sessionsByTable: { ...s.sessionsByTable, [session.table_id]: session } })),
  removeSessionForTable: (tableId) =>
    set((s) => {
      const { [tableId]: _removed, ...rest } = s.sessionsByTable;
      return { sessionsByTable: rest };
    }),
  setSessionTotal: (sessionId, cents) => set((s) => ({ sessionTotals: { ...s.sessionTotals, [sessionId]: cents } })),
  setCatalog: (categories, products) => set({ categories, products }),
  upsertProduct: (p) =>
    set((s) => ({
      products: s.products.some((x) => x.id === p.id) ? s.products.map((x) => (x.id === p.id ? p : x)) : [...s.products, p],
    })),
  setOnline: (online) => set({ online }),
  setStarted: (started) => set({ started }),
  setSoundOn: (on) => {
    saveSoundPref(on);
    set({ soundOn: on });
  },
  setNight: (on) => {
    localStorage.setItem(NIGHT_KEY, on ? "on" : "off");
    set({ night: on });
  },
  setLoaded: (loaded) => set({ loaded }),
}));
