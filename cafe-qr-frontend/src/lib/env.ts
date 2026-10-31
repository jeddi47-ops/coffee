// Configuration publique. Seule la clé ANON existe dans le frontend.
// Ce module n'importe pas supabase-js : la page du QR reste légère.
export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL ?? window.location.origin).replace(/\/+$/, "");

/** URL publique d'un fichier du bucket cafe-assets. */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/cafe-assets/${encoded}`;
}

/** URL encodée dans le QR d'une table. */
export function tableUrl(qrToken: string): string {
  return `${SITE_URL}/m/${qrToken}`;
}
