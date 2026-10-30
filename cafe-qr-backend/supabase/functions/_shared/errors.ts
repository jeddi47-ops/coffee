// Format d'erreur unique : { "error": { "code": "...", "message": "..." } }
import { corsHeaders, handlePreflight, isOriginAllowed } from "./cors.ts";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type DbError = { code?: string; message?: string; details?: string | null; hint?: string | null };

/**
 * Convertit une erreur PostgREST / Postgres en HttpError.
 * Les fonctions SQL lèvent SQLSTATE 'PT<status>' : MESSAGE = code, DETAIL = message,
 * HINT = retry_after_seconds (429).
 */
export function fromDbError(err: DbError): HttpError {
  const match = /^PT(\d{3})$/.exec(err.code ?? "");
  if (match) {
    const status = Number(match[1]);
    const extra: Record<string, unknown> = {};
    if (status === 429) {
      const retry = Number(err.hint);
      extra.retry_after_seconds = Number.isFinite(retry) && retry > 0 ? retry : 60;
    }
    return new HttpError(status, err.message || "error", err.details || err.message || "Erreur.", extra);
  }
  if (err.code === "23505") return new HttpError(409, "conflict", "Conflit avec une ressource existante.");
  if (err.code === "23503") return new HttpError(400, "invalid_reference", "Référence invalide.");
  if (err.code === "22P02") return new HttpError(400, "validation_error", "Format de donnée invalide.");
  console.error("Erreur base de données inattendue", err);
  return new HttpError(500, "internal_error", "Erreur interne.");
}

export function json(
  req: Request,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function errorResponse(req: Request, err: unknown): Response {
  const e = err instanceof HttpError
    ? err
    : (() => {
      console.error("Erreur inattendue", err);
      return new HttpError(500, "internal_error", "Erreur interne.");
    })();
  const headers: Record<string, string> = {};
  const retry = e.extra.retry_after_seconds;
  if (e.status === 429 && typeof retry === "number") headers["Retry-After"] = String(Math.ceil(retry));
  return json(req, { error: { code: e.code, message: e.message, ...e.extra } }, e.status, headers);
}

export function requireMethod(req: Request, methods: string[]): void {
  if (!methods.includes(req.method)) {
    throw new HttpError(405, "method_not_allowed", `Méthode non autorisée (attendu : ${methods.join(", ")}).`);
  }
}

/** Enveloppe commune : preflight CORS, refus des origines non autorisées, gestion d'erreurs. */
export function handle(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;
    try {
      if (!isOriginAllowed(req.headers.get("Origin"))) {
        throw new HttpError(403, "origin_not_allowed", "Origine non autorisée.");
      }
      return await fn(req);
    } catch (err) {
      return errorResponse(req, err);
    }
  };
}
