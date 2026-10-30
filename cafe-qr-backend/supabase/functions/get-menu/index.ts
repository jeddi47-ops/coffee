// GET /functions/v1/get-menu?token=<qr_token>   (public, verify_jwt = false)
import { fromDbError, handle, json, requireMethod } from "../_shared/errors.ts";
import { adminClient, publicAssetUrl } from "../_shared/supabase.ts";
import { enforceIpLimit } from "../_shared/ratelimit.ts";
import { requireTableToken } from "../_shared/validate.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

Deno.serve(handle(async (req) => {
  requireMethod(req, ["GET"]);
  await enforceIpLimit(req, "get-menu", 60, 60);

  const token = requireTableToken(new URL(req.url).searchParams.get("token"));

  const { data, error } = await adminClient().rpc("get_menu_tx", { p_table_token: token });
  if (error) throw fromDbError(error);

  const menu: Json = data;
  menu.cafe.logo_url = publicAssetUrl(menu.cafe.logo_path);
  for (const category of menu.categories ?? []) {
    for (const product of category.products ?? []) {
      product.image_url = publicAssetUrl(product.image_path);
    }
  }

  return json(req, menu, 200, { "Cache-Control": "public, max-age=30" });
}));
