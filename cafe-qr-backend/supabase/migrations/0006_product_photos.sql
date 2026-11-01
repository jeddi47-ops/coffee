-- =============================================================================
-- Café QR : 0006_product_photos.sql
-- Plusieurs photos par produit : la photo principale reste dans image_path,
-- jusqu'à 3 photos supplémentaires dans extra_image_paths (4 au total).
-- À exécuter UNE SEULE FOIS dans le SQL Editor de Supabase (sans danger si relancé).
-- =============================================================================

alter table public.products
  add column if not exists extra_image_paths text[] not null default '{}';

-- Vérifie que tous les chemins sont dans le dossier du café (même règle que image_path).
create or replace function public.paths_in_cafe_folder(p_paths text[], p_cafe uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(x like (p_cafe::text || '/%')), true) from unnest(p_paths) as x;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_extra_images_max') then
    alter table public.products
      add constraint products_extra_images_max check (cardinality(extra_image_paths) <= 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_extra_images_in_own_folder') then
    alter table public.products
      add constraint products_extra_images_in_own_folder check (public.paths_in_cafe_folder(extra_image_paths, cafe_id));
  end if;
end;
$$;

-- Les droits d'écriture sont donnés colonne par colonne : on ajoute la nouvelle.
grant insert (extra_image_paths) on public.products to authenticated;
grant update (extra_image_paths) on public.products to authenticated;

-- Menu public : renvoie aussi les photos supplémentaires.
create or replace function public.get_menu_tx(p_table_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table public.cafe_tables;
  v_cafe  public.cafes;
begin
  select * into v_table from public.cafe_tables t where t.qr_token = p_table_token;
  if not found or not v_table.is_active then
    perform public.api_error(404, 'table_not_found', 'QR code inconnu ou désactivé.');
  end if;

  select * into v_cafe from public.cafes c where c.id = v_table.cafe_id;
  if not v_cafe.is_active then
    perform public.api_error(403, 'cafe_inactive', 'Ce café n''est pas disponible.');
  end if;

  return jsonb_build_object(
    'cafe', jsonb_build_object(
      'name', v_cafe.name,
      'slug', v_cafe.slug,
      'logo_path', v_cafe.logo_path,
      'currency', v_cafe.currency,
      'ordering_enabled', v_cafe.ordering_enabled,
      'call_waiter_enabled', v_cafe.call_waiter_enabled,
      'theme', jsonb_build_object('accent', v_cafe.theme_accent, 'mode', v_cafe.theme_mode),
      'tagline', v_cafe.tagline
    ),
    'table', jsonb_build_object('label', v_table.label),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'position', c.position,
          'products', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'price_cents', p.price_cents,
                'image_path', p.image_path,
                'extra_image_paths', p.extra_image_paths,
                'is_available', p.is_available,
                'is_promoted', p.is_promoted,
                'promo_label', p.promo_label,
                'position', p.position,
                'options', p.options
              ) order by p.position, p.name
            )
            from public.products p
            where p.category_id = c.id and p.cafe_id = v_cafe.id
          ), '[]'::jsonb)
        ) order by c.position, c.name
      )
      from public.categories c
      where c.cafe_id = v_cafe.id and c.is_visible
    ), '[]'::jsonb)
  );
end;
$$;
