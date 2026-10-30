// POST /functions/v1/call-waiter   (public, verify_jwt = false)
// Corps : { token } — idempotent si un appel est déjà ouvert ; 429 pendant le délai de répit.
import { fromDbError, handle, json, requireMethod } from "../_shared/errors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { enforceIpLimit } from "../_shared/ratelimit.ts";
import { parseWith, readJsonBody, requireTableToken, z } from "../_shared/validate.ts";

const schema = z.object({ token: z.string().max(100) });

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await enforceIpLimit(req, "call-waiter", 10, 60);

  const body = parseWith(schema, await readJsonBody(req, 1024));
  const token = requireTableToken(body.token);

  const { data, error } = await adminClient().rpc("call_waiter_tx", { p_table_token: token });
  if (error) throw fromDbError(error);

  return json(req, data, data?.created ? 201 : 200);
}));
