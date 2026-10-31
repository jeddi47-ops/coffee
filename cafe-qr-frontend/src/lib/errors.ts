// Traduction des codes d'erreur (Edge Functions, RPC, PostgREST) en messages français.
// Aucun message technique brut n'est montré à l'utilisateur.
import { fr } from "../i18n/fr";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: number,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/** Convertit une erreur supabase-js (PostgREST / RPC / Storage) en ApiError. */
export function fromPostgrest(err: PostgrestLikeError | null | undefined): ApiError {
  if (!err) return new ApiError(500, "unknown");
  const pt = /^PT(\d{3})$/.exec(err.code ?? "");
  if (pt) {
    const status = Number(pt[1]);
    const retry = Number(err.hint);
    return new ApiError(status, err.message || "unknown", Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  switch (err.code) {
    case "23503": return new ApiError(409, "has_dependencies");
    case "23505": return new ApiError(409, "duplicate");
    case "23514": return new ApiError(400, "check_violation");
    case "22P02": return new ApiError(400, "validation_error");
    case "42501": return new ApiError(403, "forbidden");
    case "PGRST301":
    case "PGRST302": return new ApiError(401, "unauthorized");
  }
  const msg = (err.message ?? "").toLowerCase();
  if (msg.includes("row-level security") || msg.includes("permission denied") || msg.includes("unauthorized")) {
    return new ApiError(403, "forbidden");
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) return new ApiError(0, "network");
  return new ApiError(500, "unknown");
}

export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return fr.errors.generic;
  if (err.status === 0) return fr.errors.network;
  const specific = (fr.errors.codes as Record<string, string>)[err.code];
  if (specific) return specific;
  if (err.status === 429) return fr.errors.rateLimited(err.retryAfter);
  if (err.status === 401) return fr.errors.codes.unauthorized;
  if (err.status === 403) return fr.errors.codes.forbidden;
  if (err.status >= 500) return fr.errors.server;
  return fr.errors.generic;
}

export const isRetryable = (err: unknown): boolean =>
  err instanceof ApiError && (err.status === 0 || err.status >= 500);
