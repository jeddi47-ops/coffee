// POST /functions/v1/register-cafe (verify_jwt=false)
// Invitation email is sent only after input validation. Key consumption + setup are atomic in Postgres.
import { fromDbError, handle, HttpError, json, requireMethod } from "../_shared/errors.ts";
import { adminClient } from "../_shared/supabase.ts";
import { enforceIpLimit, enforceRateLimit } from "../_shared/ratelimit.ts";
import { parseWith, readJsonBody, z } from "../_shared/validate.ts";

const schema = z.object({
  cafe_name: z.string().trim().min(1).max(120),
  owner_name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  access_key: z.string().trim().min(8).max(80),
});

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.toUpperCase()));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
function slugify(value: string): string {
  const base = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/g, "");
  return base.length >= 2 ? base : `cafe-${crypto.randomUUID().slice(0, 8)}`;
}

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await enforceIpLimit(req, "register-cafe", 8, 3600);
  const body = parseWith(schema, await readJsonBody(req, 2 * 1024));
  await enforceRateLimit(`register:${body.email}`, 3, 3600);

  const admin = adminClient();
  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: { signup_type: "staff", display_name: body.owner_name },
    redirectTo: siteUrl ? `${siteUrl}/auth/callback` : undefined,
  });
  if (error || !data?.user) {
    const message = error?.message ?? "";
    // deno-lint-ignore no-explicit-any
    const code = (error as any)?.code ?? "";
    if (code === "email_exists" || /already (been )?registered|already exists/i.test(message)) {
      throw new HttpError(409, "email_already_registered", "Un compte existe déjà avec cet email.");
    }
    console.error("Invitation inscription impossible", error);
    throw new HttpError(500, "invite_failed", "L'invitation n'a pas pu être envoyée.");
  }

  const { data: result, error: rpcError } = await admin.rpc("register_cafe_with_access_key", {
    p_user_id: data.user.id,
    p_cafe_name: body.cafe_name,
    p_slug: slugify(body.cafe_name),
    p_owner_name: body.owner_name,
    p_code_hash: codeHash,
  });
  if (rpcError) {
    await admin.auth.admin.deleteUser(data.user.id).catch((e) => console.error("rollback invitation", e));
    if (rpcError.message.includes("invalid_or_used_key")) {
      throw new HttpError(400, "invalid_or_used_key", "Cette clé est invalide ou déjà utilisée.");
    }
    if (rpcError.code === "23505") {
      throw new HttpError(409, "cafe_name_conflict", "Un café utilise déjà ce nom. Essaie un autre nom.");
    }
    console.error("Création du café impossible", rpcError);
    throw fromDbError(rpcError);
  }

  return json(req, { success: true, access_until: result.access_until }, 201);
}));
