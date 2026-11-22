// POST /functions/v1/platform-dashboard { month: "YYYY-MM" }
// Statistiques calculées à partir des activations de clés, indépendamment de Chariow.
import { handle, HttpError, json, requireMethod } from "../_shared/errors.ts";
import { adminClient, requirePlatformAdmin } from "../_shared/supabase.ts";
import { parseWith, readJsonBody, z } from "../_shared/validate.ts";

const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

Deno.serve(handle(async (req) => {
  requireMethod(req, ["POST"]);
  await requirePlatformAdmin(req);
  const { month } = parseWith(schema, await readJsonBody(req, 1024));
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new HttpError(400, "invalid_month", "Mois invalide.");
  const start = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString();

  const admin = adminClient();
  const [cafeResult, keyResult, monthlyResult] = await Promise.all([
    admin.from("cafes").select("id, is_active, access_until"),
    admin.from("access_keys").select("id, plan, activated_at, redeemed_cafe_id"),
    admin.from("access_keys").select("plan").not("activated_at", "is", null).gte("activated_at", start).lt("activated_at", end),
  ]);
  if (cafeResult.error || keyResult.error || monthlyResult.error) {
    console.error("platform-dashboard query failed", cafeResult.error ?? keyResult.error ?? monthlyResult.error);
    throw new HttpError(500, "dashboard_failed", "Les statistiques ne sont pas disponibles.");
  }

  const cafes = cafeResult.data ?? [];
  const keys = keyResult.data ?? [];
  const activated = monthlyResult.data ?? [];
  const monthly = activated.filter((key) => key.plan === "monthly").length;
  const annual = activated.filter((key) => key.plan === "annual").length;
  const now = Date.now();
  const activeCafes = cafes.filter((cafe) =>
    cafe.is_active && (!cafe.access_until || new Date(cafe.access_until).getTime() > now)
  ).length;

  return json(req, {
    month,
    cafes: { total: cafes.length, active: activeCafes },
    keys: {
      total: keys.length,
      activated: keys.filter((key) => key.activated_at).length,
      available: keys.filter((key) => !key.activated_at).length,
    },
    activations: { monthly, annual, total: monthly + annual },
    revenue_usd: monthly * 10 + annual * 110,
  });
}));
