// POST /functions/v1/renew-access-key (verify_jwt=true)
// Owner only. Renewal extends from max(expiration, now), so an early renewal adds time.
import { fromDbError, handle, HttpError, json, requireMethod } from "../_shared/errors.ts";
import { adminClient, requireStaff } from "../_shared/supabase.ts";
import { enforceIpLimit, enforceRateLimit } from "../_shared/ratelimit.ts";
import { parseWith, readJsonBody, z } from "../_shared/validate.ts";

const schema = z.object({ access_key: z.string().trim().min(8).max(80) });
async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.toUpperCase()));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await enforceIpLimit(req, "renew-access-key", 10, 3600);
  const staff = await requireStaff(req, ["owner"]);
  await enforceRateLimit(`renew:${staff.userId}`, 8, 3600);
  const body = parseWith(schema, await readJsonBody(req, 1024));
  const { data, error } = await adminClient().rpc("renew_cafe_access_key", {
    p_user_id: staff.userId,
    p_code_hash: await sha256(body.access_key),
  });
  if (error) {
    if (error.message.includes("invalid_or_used_key")) {
      throw new HttpError(400, "invalid_or_used_key", "Cette clé est invalide ou déjà utilisée.");
    }
    throw fromDbError(error);
  }
  return json(req, { success: true, access_until: data.access_until, plan: data.plan });
}));
