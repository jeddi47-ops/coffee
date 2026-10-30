-- =============================================================================
-- Café QR (V1) : 0004_realtime_storage.sql
-- Publication Realtime, bucket cafe-assets et policies Storage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Realtime : orders, waiter_calls, table_sessions, products.
-- Jamais : customers, cafe_followers, announcements, rate_limit_hits.
-- La RLS (policies SELECT de 0002) s'applique aux abonnements postgres_changes.
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach v_table in array array['orders', 'waiter_calls', 'table_sessions', 'products'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;

  -- Sécurité : retire les tables sensibles si quelqu'un les avait ajoutées.
  foreach v_table in array array['customers', 'cafe_followers', 'announcements', 'rate_limit_hits',
                                 'staff_members', 'cafes', 'cafe_tables', 'order_items'] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', v_table);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage : bucket public cafe-assets (jpeg / png / webp, 2 Mo max)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cafe-assets', 'cafe-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Chemins autorisés : {cafe_id}/products/...  {cafe_id}/logo/...  {cafe_id}/announcements/...
-- Écriture / mise à jour / suppression : owner et manager dont le cafe_id = 1er segment.
-- La lecture publique passe par l'URL publique du bucket (pas de policy SELECT anon :
-- le listing des fichiers n'est pas exposé).

create policy cafe_assets_staff_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cafe-assets'
    and (storage.foldername(name))[1] = (select public.current_staff_cafe_id())::text
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy cafe_assets_manager_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cafe-assets'
    and (storage.foldername(name))[1] = (select public.current_staff_cafe_id())::text
    and (storage.foldername(name))[2] in ('products', 'logo', 'announcements')
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy cafe_assets_manager_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cafe-assets'
    and (storage.foldername(name))[1] = (select public.current_staff_cafe_id())::text
    and (select public.current_staff_role()) in ('owner', 'manager')
  )
  with check (
    bucket_id = 'cafe-assets'
    and (storage.foldername(name))[1] = (select public.current_staff_cafe_id())::text
    and (storage.foldername(name))[2] in ('products', 'logo', 'announcements')
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy cafe_assets_manager_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cafe-assets'
    and (storage.foldername(name))[1] = (select public.current_staff_cafe_id())::text
    and (select public.current_staff_role()) in ('owner', 'manager')
  );
