import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_PER_LINE = 20;
export const MAX_ITEMS = 50;
export const LINE_NOTE_MAX = 150;
export const ORDER_NOTE_MAX = 300;

export interface CartLine {
  productId: string;
  name: string;
  /** Indicatif uniquement : jamais envoyé, remplacé par le total serveur après la commande. */
  priceCents: number;
  quantity: number;
  note: string;
}

interface CartState {
  linesByToken: Record<string, CartLine[]>;
  noteByToken: Record<string, string>;
  /** Clés d'annulation des commandes passées depuis cet onglet (order_id -> cancel_key). */
  cancelKeys: Record<string, string>;
  add: (token: string, line: Omit<CartLine, "quantity" | "note">, quantity?: number) => "ok" | "line_max" | "total_max";
  setQuantity: (token: string, productId: string, quantity: number) => void;
  setLineNote: (token: string, productId: string, note: string) => void;
  remove: (token: string, productId: string) => void;
  setOrderNote: (token: string, note: string) => void;
  clear: (token: string) => void;
  rememberCancelKey: (orderId: string, key: string) => void;
}

export const totalQuantity = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

// Persisté en sessionStorage (disparaît avec l'onglet), indexé par jeton de table.
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      linesByToken: {},
      noteByToken: {},
      cancelKeys: {},
      add: (token, line, quantity = 1) => {
        const lines = get().linesByToken[token] ?? [];
        const existing = lines.find((l) => l.productId === line.productId);
        const wanted = Math.max(1, Math.floor(quantity));
        const roomTotal = MAX_ITEMS - totalQuantity(lines);
        const roomLine = MAX_PER_LINE - (existing?.quantity ?? 0);
        if (roomTotal <= 0) return "total_max";
        if (roomLine <= 0) return "line_max";
        // Si la quantité demandée dépasse une limite, on ajoute ce qui rentre et on le signale.
        const toAdd = Math.min(wanted, roomTotal, roomLine);
        const next = existing
          ? lines.map((l) => (l.productId === line.productId ? { ...l, quantity: l.quantity + toAdd } : l))
          : [...lines, { ...line, quantity: toAdd, note: "" }];
        set((s) => ({ linesByToken: { ...s.linesByToken, [token]: next } }));
        if (toAdd === wanted) return "ok";
        return toAdd === roomLine ? "line_max" : "total_max";
      },
      setQuantity: (token, productId, quantity) => {
        const lines = get().linesByToken[token] ?? [];
        const others = totalQuantity(lines.filter((l) => l.productId !== productId));
        const q = Math.max(1, Math.min(MAX_PER_LINE, Math.floor(quantity), MAX_ITEMS - others));
        set((s) => ({
          linesByToken: { ...s.linesByToken, [token]: lines.map((l) => (l.productId === productId ? { ...l, quantity: q } : l)) },
        }));
      },
      setLineNote: (token, productId, note) =>
        set((s) => ({
          linesByToken: {
            ...s.linesByToken,
            [token]: (s.linesByToken[token] ?? []).map((l) =>
              l.productId === productId ? { ...l, note: note.slice(0, LINE_NOTE_MAX) } : l,
            ),
          },
        })),
      remove: (token, productId) =>
        set((s) => ({
          linesByToken: { ...s.linesByToken, [token]: (s.linesByToken[token] ?? []).filter((l) => l.productId !== productId) },
        })),
      setOrderNote: (token, note) =>
        set((s) => ({ noteByToken: { ...s.noteByToken, [token]: note.slice(0, ORDER_NOTE_MAX) } })),
      clear: (token) =>
        set((s) => ({ linesByToken: { ...s.linesByToken, [token]: [] }, noteByToken: { ...s.noteByToken, [token]: "" } })),
      rememberCancelKey: (orderId, key) => set((s) => ({ cancelKeys: { ...s.cancelKeys, [orderId]: key } })),
    }),
    { name: "cafeqr-cart", storage: createJSONStorage(() => sessionStorage) },
  ),
);
