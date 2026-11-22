// POST /functions/v1/create-access-keys { plan: "monthly"|"annual", quantity: 1..500 }
// Les codes en clair ne sont renvoyés qu'une fois; seule leur empreinte SHA-256 est stockée.
import { handle, HttpError, json, requireMethod } from "../_shared/errors.ts";
import { adminClient, requirePlatformAdmin } from "../_shared/supabase.ts";
import { parseWith, readJsonBody, z } from "../_shared/validate.ts";

const schema = z.object({
  plan: z.enum(["monthly", "annual"]),
  quantity: z.number().int().min(1).max(500),
});

const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
function createCode(plan: "monthly" | "annual"): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const token = hex(random).toUpperCase();
  const prefix = plan === "monthly" ? "M" : "A";
  return `CAFE-${prefix}-${token.slice(0, 8)}-${token.slice(8, 16)}-${token.slice(16, 24)}-${token.slice(24)}`;
}

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  const caller = await requirePlatformAdmin(req);
  const body = parseWith(schema, await readJsonBody(req, 1024));
  const batchId = crypto.randomUUID();
  const codes = Array.from({ length: body.quantity }, () => createCode(body.plan));
  const rows = await Promise.all(codes.map(async (code) => ({
    batch_id: batchId,
    code_hash: await sha256(code),
    code_suffix: code.slice(-8),
    plan: body.plan,
    created_by: caller.userId,
  })));

  const { error } = await adminClient().from("access_keys").insert(rows);
  if (error) {
    console.error("create-access-keys insert failed", error);
    throw new HttpError(500, "key_generation_failed", "Le lot de clés n'a pas pu être enregistré.");
  }
  return json(req, { batch_id: batchId, plan: body.plan, quantity: codes.length, codes }, 201);
}));
