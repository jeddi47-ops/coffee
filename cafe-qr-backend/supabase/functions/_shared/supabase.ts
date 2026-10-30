// Client service_role (jamais exposé au navigateur) et contrôle d'accès du personnel.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fromDbError, HttpError } from "./errors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!admin) {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
    }
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return admin;
}

export function supabaseUrl(): string {
  return SUPABASE_URL;
}

/** URL publique d'un fichier du bucket cafe-assets. */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/cafe-assets/${encoded}`;
}

export type StaffRole = "owner" | "manager" | "waiter";

export interface StaffContext {
  userId: string;
  cafeId: string;
  role: StaffRole;
  displayName: string;
}

/**
 * Revérifie côté code (en plus de verify_jwt) : JWT valide, employé actif,
 * café actif, rôle autorisé.
 */
export async function requireStaff(req: Request, roles: StaffRole[]): Promise<StaffContext> {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, "unauthorized", "Jeton d'authentification manquant.");

  const { data: userData, error: userError } = await adminClient().auth.getUser(match[1]);
  if (userError || !userData?.user) {
    throw new HttpError(401, "unauthorized", "Session invalide ou expirée.");
  }

  const { data: staff, error } = await adminClient()
    .from("staff_members")
    .select("id, cafe_id, role, is_active, display_name, cafes!inner(is_active)")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) throw fromDbError(error);

  // deno-lint-ignore no-explicit-any
  const cafe: any = Array.isArray(staff?.cafes) ? staff?.cafes[0] : staff?.cafes;
  if (!staff || !staff.is_active || !cafe?.is_active) {
    throw new HttpError(403, "forbidden", "Accès réservé au personnel actif d'un café actif.");
  }
  if (!roles.includes(staff.role as StaffRole)) {
    throw new HttpError(403, "forbidden_role", "Votre rôle ne permet pas cette action.");
  }

  return {
    userId: staff.id,
    cafeId: staff.cafe_id,
    role: staff.role as StaffRole,
    displayName: staff.display_name,
  };
}
