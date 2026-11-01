// Outils partagés de l'espace patron / manager.
import { supabase } from "../../lib/supabase";
import { publicAssetUrl } from "../../lib/env";
import { fromPostgrest, ApiError } from "../../lib/errors";
import { toWebp, ImageError } from "../../lib/image";
import { fr } from "../../i18n/fr";
import { useAuthStore } from "../../stores/authStore";
import type { CafeRow, CategoryRow, Menu, ProductRow, StaffMemberRow } from "../../types/api";

export function useStaffProfile(): { staff: StaffMemberRow; cafe: CafeRow } {
  const profile = useAuthStore((s) => s.profile);
  if (profile?.kind !== "staff") throw new Error("Profil employé requis");
  return { staff: profile.staff, cafe: profile.cafe };
}

export type AssetFolder = "products" | "logo" | "announcements";

/** Convertit en WebP puis envoie dans cafe-assets/{cafe_id}/{folder}/<uuid>.webp. Renvoie le chemin. */
export async function uploadImage(cafeId: string, folder: AssetFolder, file: File): Promise<string> {
  const blob = await toWebp(file);
  const path = `${cafeId}/${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("cafe-assets")
    .upload(path, blob, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
  if (error) throw new ApiError(403, "upload_failed");
  return path;
}

export async function removeImage(path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabase.storage.from("cafe-assets").remove([path]).then(() => undefined, () => undefined);
}

export function imageErrorMessage(e: unknown): string {
  if (e instanceof ImageError) return fr.admin.photoErrors[e.reason];
  return fr.admin.photoErrors.upload;
}

export async function loadCatalog(): Promise<{ categories: CategoryRow[]; products: ProductRow[] }> {
  const [cats, prods] = await Promise.all([
    supabase.from("categories").select("id, cafe_id, name, position, is_visible").order("position").order("name"),
    supabase
      .from("products")
      .select("id, cafe_id, category_id, name, description, price_cents, image_path, extra_image_paths, is_available, is_promoted, promo_label, position")
      .order("position")
      .order("name"),
  ]);
  if (cats.error) throw fromPostgrest(cats.error);
  if (prods.error) throw fromPostgrest(prods.error);
  return { categories: (cats.data ?? []) as CategoryRow[], products: (prods.data ?? []) as ProductRow[] };
}

/** Photos d'un produit dans l'ordre : photo principale, puis les supplémentaires. */
export function productPhotoUrls(p: Pick<ProductRow, "image_path" | "extra_image_paths">): string[] {
  return [p.image_path, ...(p.extra_image_paths ?? [])].map((path) => publicAssetUrl(path)).filter((u): u is string => Boolean(u));
}

/** Menu tel que le client le reçoit de get-menu (catégories visibles uniquement), pour l'aperçu. */
export function buildPreviewMenu(
  cafe: CafeRow,
  categories: CategoryRow[],
  products: ProductRow[],
  themeOverride?: { accent: string; mode: string; tagline: string | null },
): Menu {
  return {
    cafe: {
      name: cafe.name,
      slug: cafe.slug,
      logo_url: publicAssetUrl(cafe.logo_path),
      currency: cafe.currency,
      ordering_enabled: cafe.ordering_enabled,
      call_waiter_enabled: cafe.call_waiter_enabled,
      theme: themeOverride
        ? { accent: themeOverride.accent, mode: themeOverride.mode }
        : { accent: cafe.theme_accent ?? null, mode: cafe.theme_mode ?? null },
      tagline: themeOverride ? themeOverride.tagline : cafe.tagline ?? null,
    },
    table: { label: "1" },
    categories: categories
      .filter((c) => c.is_visible)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        products: products
          .filter((p) => p.category_id === c.id)
          .sort((a, b) => a.position - b.position)
          .map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price_cents: p.price_cents,
            image_url: productPhotoUrls(p)[0] ?? null,
            image_urls: productPhotoUrls(p),
            is_available: p.is_available,
            is_promoted: p.is_promoted,
            promo_label: p.promo_label,
            position: p.position,
          })),
      })),
  };
}

/** Réordonne une liste (déplacement de ±1) et renvoie les positions à enregistrer (1..n). */
export function reorder<T extends { id: string; position: number }>(items: T[], id: string, delta: -1 | 1): { id: string; position: number }[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sorted.length) return [];
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((x, idx) => ({ id: x.id, position: idx + 1 })).filter((x) => items.find((o) => o.id === x.id)?.position !== x.position);
}

/** update ... .select() : 0 ligne renvoyée = écriture refusée par la RLS. */
export function assertWritten<T>(data: T[] | null, error: { code?: string; message?: string } | null): T {
  if (error) throw fromPostgrest(error);
  if (!data || data.length === 0) throw new ApiError(403, "forbidden");
  return data[0];
}
