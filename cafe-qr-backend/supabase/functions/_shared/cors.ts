// CORS limité aux origines listées dans ALLOWED_ORIGINS (séparées par des virgules).
// Les appels serveur à serveur (curl, sans en-tête Origin) ne sont pas concernés.

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // pas un appel navigateur cross-origin
  return ALLOWED_ORIGINS.includes(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

/** Répond aux pré-requêtes OPTIONS. Renvoie null si la requête n'est pas un preflight. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
