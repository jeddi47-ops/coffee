import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CartLine {
  productId: string;
  name: string;
  priceCents: number; // indicatif, remplacé par le total serveur après envoi
  quantity: number;
  note: string;
}

interface CartState {
  linesByToken: Record<string, CartLine[]>;
  // Clés d'annulation des commandes passées depuis cet appareil (orderId -> cancel_key).
  cancelKeys: Record<string, string>;
  setLines: (token: string, lines: CartLine[]) => void;
  clear: (token: string) => void;
  rememberCancelKey: (orderId: string, key: string) => void;
}

// sessionStorage : les données disparaissent avec l'onglet. Le jeton n'est jamais stocké ici.
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      linesByToken: {},
      cancelKeys: {},
      setLines: (token, lines) =>
        set((s) => ({ linesByToken: { ...s.linesByToken, [token]: lines } })),
      clear: (token) =>
        set((s) => ({ linesByToken: { ...s.linesByToken, [token]: [] } })),
      rememberCancelKey: (orderId, key) =>
        set((s) => ({ cancelKeys: { ...s.cancelKeys, [orderId]: key } })),
    }),
    { name: "cafeqr-cart", storage: createJSONStorage(() => sessionStorage) },
  ),
);
