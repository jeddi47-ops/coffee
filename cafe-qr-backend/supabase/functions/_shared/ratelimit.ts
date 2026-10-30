// Limitation de débit via la fonction SQL check_rate_limit (service_role).
// Les adresses IP sont hachées avant stockage (donnée personnelle).
import { adminClient } from "./supabase.ts";
import { fromDbError, HttpError } from "./errors.ts";

export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function enforceRateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
  const { data, error } = await adminClient().rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw fromDbError(error);
  if (data !== true) {
    throw new HttpError(429, "rate_limited", "Trop de requêtes, réessayez plus tard.", {
      retry_after_seconds: windowSeconds,
    });
  }
}

/** Limite par IP (et éventuellement par sous-clé, ex. jeton de table). */
export async function enforceIpLimit(
  req: Request,
  name: string,
  max: number,
  windowSeconds = 60,
  subKey = "",
): Promise<void> {
  const ipHash = await sha256Hex(clientIp(req));
  const sub = subKey ? `:${(await sha256Hex(subKey)).slice(0, 16)}` : "";
  await enforceRateLimit(`ip:${name}:${ipHash}${sub}`, max, windowSeconds);
}
