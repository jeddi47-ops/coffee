// Validation stricte des entrées, taille de corps limitée, jetons signés.
import { z } from "npm:zod@3.23.8";
import { HttpError } from "./errors.ts";

export { z };

export const TABLE_TOKEN_RE = /^[0-9a-f]{36}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Jeton de table : un format invalide est traité comme un jeton inconnu (404). */
export function requireTableToken(value: unknown): string {
  if (typeof value !== "string" || !TABLE_TOKEN_RE.test(value)) {
    throw new HttpError(404, "table_not_found", "QR code inconnu ou désactivé.");
  }
  return value;
}

/** Lit un corps JSON en refusant tout dépassement de maxBytes (413). */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "invalid_content_type", "Content-Type application/json attendu.");
  }
  const declared = Number(req.headers.get("Content-Length") ?? "0");
  if (declared > maxBytes) {
    throw new HttpError(413, "payload_too_large", `Corps de requête trop volumineux (max ${maxBytes} octets).`);
  }
  if (!req.body) throw new HttpError(400, "validation_error", "Corps de requête manquant.");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large", `Corps de requête trop volumineux (max ${maxBytes} octets).`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "invalid_json", "JSON invalide.");
  }
}

export function parseWith<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 10).map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new HttpError(400, "validation_error", "Données invalides.", { issues });
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Jeton de désabonnement : <customer_id>.<cafe_id>.<base64url(HMAC-SHA256("customer_id:cafe_id"))>
// ---------------------------------------------------------------------------
function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(message: string): Promise<Uint8Array> {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET") ?? "";
  if (secret.length < 32) throw new Error("UNSUBSCRIBE_SECRET manquant ou trop court (32 caractères min.)");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signUnsubscribeToken(customerId: string, cafeId: string): Promise<string> {
  const c = customerId.toLowerCase();
  const f = cafeId.toLowerCase();
  const sig = await hmac(`${c}:${f}`);
  return `${c}.${f}.${base64url(sig)}`;
}

export async function verifyUnsubscribeToken(
  token: string | null,
): Promise<{ customerId: string; cafeId: string } | null> {
  if (!token || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [customerId, cafeId, sig] = parts;
  if (!UUID_RE.test(customerId) || !UUID_RE.test(cafeId)) return null;
  const given = fromBase64url(sig);
  if (!given) return null;
  const expected = await hmac(`${customerId.toLowerCase()}:${cafeId.toLowerCase()}`);
  return timingSafeEqual(given, expected)
    ? { customerId: customerId.toLowerCase(), cafeId: cafeId.toLowerCase() }
    : null;
}
