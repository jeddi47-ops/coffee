import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Type de lien d'authentification présent dans l'URL au chargement (invite, recovery, magiclink…).
// Lu AVANT createClient, qui nettoie le fragment de l'URL après avoir ouvert la session.
function readInitialAuthType(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  return hash.get("type") ?? search.get("type");
}
function readInitialAuthError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  return hash.get("error_code") ?? hash.get("error") ?? search.get("error_code") ?? search.get("error");
}

export const initialAuthType = readInitialAuthType();
export const initialAuthError = readInitialAuthError();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});
