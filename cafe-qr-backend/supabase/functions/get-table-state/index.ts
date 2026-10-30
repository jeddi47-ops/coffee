// GET /functions/v1/get-table-state?token=<qr_token>   (public, verify_jwt = false)
// Interrogé en polling (5 à 10 s) par le frontend en V1.
import { fromDbError, handle, json, requireMethod } from "../_shared/errors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { enforceIpLimit } from "../_shared/ratelimit.ts";
import { requireTableToken } from "../_shared/validate.ts";

Deno.serve(handle(async (req) => {
  requireMethod(req, ["GET"]);
  const rawToken = new URL(req.url).searchParams.get("token") ?? "";
  // Limite par (IP, table) : plusieurs tables d'un même café partagent souvent la même IP (wifi).
  await enforceIpLimit(req, "get-table-state", 30, 60, rawToken);
  await enforceIpLimit(req, "get-table-state-ip", 600, 60);

  const token = requireTableToken(rawToken);

  const { data, error } = await adminClient().rpc("get_table_state_tx", { p_table_token: token });
  if (error) throw fromDbError(error);

  return json(req, data, 200);
}));
