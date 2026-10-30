// POST /functions/v1/create-order   (public, verify_jwt = false)
// Corps : { token, items: [{ product_id, quantity, note?, options? }], note?, order_type? }
// Les prix éventuellement envoyés par le client sont ignorés (clés inconnues supprimées).
import { fromDbError, handle, json, requireMethod } from "../_shared/errors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { enforceIpLimit } from "../_shared/ratelimit.ts";
import { parseWith, readJsonBody, requireTableToken, z } from "../_shared/validate.ts";

const optionValue = z.union([z.string().max(100), z.number(), z.boolean(), z.null()]);
const option = z.union([z.string().max(100), z.record(z.string().max(50), optionValue)]);

const schema = z.object({
  token: z.string().max(100),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
    note: z.string().max(1000).nullish(),     // tronquée à 150 caractères côté SQL
    options: z.array(option).max(20).nullish(),
  })).min(1).max(50),
  note: z.string().max(2000).nullish(),       // tronquée à 300 caractères côté SQL
  order_type: z.enum(["dine_in", "takeaway"]).nullish(),
});

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await enforceIpLimit(req, "create-order", 10, 60);

  const body = parseWith(schema, await readJsonBody(req, 32 * 1024));
  const token = requireTableToken(body.token);

  const totalQty = body.items.reduce((sum, i) => sum + i.quantity, 0);
  if (totalQty > 50) {
    return json(req, { error: { code: "too_many_items", message: "Maximum 50 articles par commande." } }, 400);
  }

  const items = body.items.map((i) => ({
    product_id: i.product_id,
    quantity: i.quantity,
    note: i.note ?? null,
    options: i.options ?? [],
  }));

  const { data, error } = await adminClient().rpc("create_order_tx", {
    p_table_token: token,
    p_items: items,
    p_note: body.note ?? null,
    p_order_type: body.order_type ?? "dine_in",
  });
  if (error) throw fromDbError(error);

  return json(req, data, 201);
}));
