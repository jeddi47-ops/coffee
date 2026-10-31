// Session Supabase + profil (employé ou client). Le rôle se lit dans staff_members.
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { fromPostgrest } from "../lib/errors";
import type { CafeRow, StaffMemberRow, StaffRole } from "../types/api";
import { fr } from "../i18n/fr";

export type Profile =
  | { kind: "staff"; staff: StaffMemberRow; cafe: CafeRow }
  | { kind: "customer" }
  | { kind: "none" };

interface AuthState {
  status: "idle" | "loading" | "ready";
  session: Session | null;
  profile: Profile | null;
  notice: string | null;
  init: () => Promise<void>;
  loadProfile: () => Promise<Profile | null>;
  refreshCafe: () => Promise<void>;
  signOut: (notice?: string | null) => Promise<void>;
  setNotice: (notice: string | null) => void;
}

let initPromise: Promise<void> | null = null;
let manualSignOut = false;

export function homeFor(role: StaffRole): string {
  return role === "waiter" ? "/staff" : "/admin";
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: "idle",
  session: null,
  profile: null,
  notice: null,

  init: () => {
    if (!initPromise) {
      initPromise = (async () => {
        set({ status: "loading" });
        const { data } = await supabase.auth.getSession();
        set({ session: data.session });
        if (data.session) await get().loadProfile();
        set({ status: "ready" });

        supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_OUT") {
            const wasStaff = get().profile?.kind === "staff";
            set({
              session: null,
              profile: null,
              notice: !manualSignOut && wasStaff ? fr.auth.sessionExpired : get().notice,
            });
            manualSignOut = false;
            return;
          }
          set({ session });
          if (event === "SIGNED_IN" || event === "USER_UPDATED") {
            // Hors du callback (recommandation supabase-js : pas d'appel bloquant ici).
            setTimeout(() => void get().loadProfile(), 0);
          }
        });
      })();
    }
    return initPromise;
  },

  loadProfile: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      set({ profile: null });
      return null;
    }
    // RLS : la ligne n'est visible que si l'employé et son café sont actifs.
    const { data: staff, error } = await supabase
      .from("staff_members")
      .select("id, cafe_id, role, display_name, is_active, created_at")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw fromPostgrest(error);

    let profile: Profile;
    if (staff && staff.is_active) {
      const { data: cafe, error: cafeError } = await supabase.from("cafes").select("*").eq("id", staff.cafe_id).single();
      if (cafeError) throw fromPostgrest(cafeError);
      profile = { kind: "staff", staff: staff as StaffMemberRow, cafe: cafe as CafeRow };
    } else {
      const { data: customer } = await supabase.from("customers").select("id").eq("id", uid).maybeSingle();
      profile = customer ? { kind: "customer" } : { kind: "none" };
    }
    set({ profile });
    return profile;
  },

  refreshCafe: async () => {
    const p = get().profile;
    if (p?.kind !== "staff") return;
    const { data, error } = await supabase.from("cafes").select("*").eq("id", p.staff.cafe_id).single();
    if (error) throw fromPostgrest(error);
    set({ profile: { ...p, cafe: data as CafeRow } });
  },

  signOut: async (notice = null) => {
    manualSignOut = true;
    set({ notice });
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  setNotice: (notice) => set({ notice }),
}));
