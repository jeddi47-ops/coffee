// POST /functions/v1/create-staff   (personnel, verify_jwt = true)
// owner uniquement. Corps : { email, display_name, role: "manager" | "waiter" }
// Le cafe_id est toujours celui de l'appelant (tout cafe_id envoyé est ignoré).
import { fromDbError, handle, HttpError, json, requireMethod } from "../_shared/errors.ts";
import { adminClient, requireStaff } from "../_shared/supabase.ts";
import { enforceIpLimit, enforceRateLimit } from "../_shared/ratelimit.ts";
import { parseWith, readJsonBody, z } from "../_shared/validate.ts";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  display_name: z.string().trim().min(1).max(80),
  role: z.enum(["manager", "waiter"]), // jamais "owner"
});

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await enforceIpLimit(req, "create-staff", 20, 60);

  const caller = await requireStaff(req, ["owner"]);
  await enforceRateLimit(`user:create-staff:${caller.userId}`, 20, 3600);

  const body = parseWith(schema, await readJsonBody(req, 2 * 1024));
  const admin = adminClient();
  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: { signup_type: "staff", display_name: body.display_name },
    redirectTo: siteUrl ? `${siteUrl}/staff` : undefined,
  });

  if (inviteError || !invited?.user) {
    const msg = inviteError?.message ?? "";
    // deno-lint-ignore no-explicit-any
    const code = (inviteError as any)?.code ?? "";
    if (code === "email_exists" || /already (been )?registered|already exists/i.test(msg)) {
      throw new HttpError(409, "email_already_registered", "Un compte existe déjà avec cet email.");
    }
    console.error("inviteUserByEmail a échoué", inviteError);
    throw new HttpError(500, "invite_failed", "L'invitation n'a pas pu être envoyée.");
  }

  const { data: member, error: insertError } = await admin
    .from("staff_members")
    .insert({
      id: invited.user.id,
      cafe_id: caller.cafeId,
      role: body.role,
      display_name: body.display_name,
    })
    .select("id, cafe_id, role, display_name, is_active, created_at")
    .single();

  if (insertError) {
    // Pas de compte orphelin : on annule l'invitation.
    await admin.auth.admin.deleteUser(invited.user.id).catch((e) => console.error("rollback deleteUser", e));
    throw fromDbError(insertError);
  }

  return json(req, { staff_member: { ...member, email: body.email } }, 201);
}));
