// POST /functions/v1/cancel-order   (public, verify_jwt = false)
// Corps : { token, order_id, cancel_key } — cancel_key est renvoyée une seule fois par create-order.
import { fromDbError, handle, json, requireMethod } from "../_shared/errors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { enforceIpLimit } from "../_shared/ratelimit.ts";
import { parseWith, readJsonBody, requireTableToken, z } from "../_shared/validate.ts";

const schema = z.object({
  token: z.string().max(100),
  order_id: z.string().uuid(),
  cancel_key: z.string().regex(/^[0-9a-f]{36}$/),
});

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await enforceIpLimit(req, "cancel-order", 20, 60);

  const body = parseWith(schema, await readJsonBody(req, 2 * 1024));
  const token = requireTableToken(body.token);

  const { data, error } = await adminClient().rpc("cancel_order_tx", {
    p_table_token: token,
    p_order_id: body.order_id,
    p_cancel_key: body.cancel_key,
  });
  if (error) throw fromDbError(error);

  return json(req, data, 200);
}));
