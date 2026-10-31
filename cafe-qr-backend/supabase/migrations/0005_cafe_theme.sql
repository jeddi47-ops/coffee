-- =============================================================================
-- Café QR : 0005_cafe_theme.sql
-- Thème par café : couleur d'accent, mode clair/sombre, phrase d'accroche.
-- À exécuter UNE SEULE FOIS (SQL Editor de Supabase). Sans risque de doublon :
-- les colonnes sont ajoutées seulement si elles n'existent pas.
-- =============================================================================

alter table public.cafes
  add column if not exists theme_accent text
    check (theme_accent is null or theme_accent ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists theme_mode text not null default 'light'
    check (theme_mode in ('light', 'dark')),
  add column if not exists tagline text
    check (tagline is null or char_length(btrim(tagline)) between 1 and 100);

-- Le patron peut modifier ces 3 colonnes (la policy cafes_owner_update limite déjà
-- l'écriture au patron de son propre café).
grant update (theme_accent, theme_mode, tagline) on public.cafes to authenticated;

-- Menu public : ajoute le thème et la phrase d'accroche à la réponse de get-menu.
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
