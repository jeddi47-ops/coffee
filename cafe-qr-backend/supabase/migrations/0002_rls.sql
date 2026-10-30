-- =============================================================================
-- Café QR (V1) : 0002_rls.sql
-- Fonctions d'aide, privilèges (défense en profondeur), activation RLS, policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'aide (SECURITY DEFINER, search_path = '')
-- Elles ne renvoient une valeur que si l'employé ET son café sont actifs :
-- désactiver un employé (ou un café) coupe l'accès à la requête suivante.
-- -----------------------------------------------------------------------------
create or replace function public.current_staff_cafe_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sm.cafe_id
  from public.staff_members sm
  join public.cafes c on c.id = sm.cafe_id
  where sm.id = (select auth.uid())
    and sm.is_active
    and c.is_active;
$$;

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select sm.role
  from public.staff_members sm
  join public.cafes c on c.id = sm.cafe_id
  where sm.id = (select auth.uid())
    and sm.is_active
    and c.is_active;
$$;

-- Utilisée par les policies de lecture publique du menu (anon n'a pas accès à cafes).
create or replace function public.is_cafe_active(p_cafe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.is_active from public.cafes c where c.id = p_cafe_id), false);
$$;

revoke all on function public.current_staff_cafe_id() from public, anon;
revoke all on function public.current_staff_role()    from public, anon;
revoke all on function public.is_cafe_active(uuid)    from public;
grant execute on function public.current_staff_cafe_id() to authenticated, service_role;
grant execute on function public.current_staff_role()    to authenticated, service_role;
grant execute on function public.is_cafe_active(uuid)    to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Privilèges de table (défense en profondeur, en plus de la RLS)
-- Supabase accorde par défaut ALL à anon/authenticated sur le schéma public :
-- on retire tout et on ré-accorde le strict nécessaire, colonne par colonne
-- quand c'est utile.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- anon : uniquement la lecture du menu public (filtrée par RLS).
grant select on public.categories, public.products to anon;

-- authenticated : lecture partout (filtrée par RLS)…
grant select on
  public.cafes, public.staff_members, public.cafe_tables, public.categories, public.products,
  public.table_sessions, public.orders, public.order_items, public.waiter_calls,
  public.customers, public.cafe_followers, public.announcements
to authenticated;

-- … et écritures limitées aux colonnes autorisées.
-- cafes : le patron modifie ses réglages (jamais is_active, slug, last_order_number).
grant update (name, logo_path, currency, ordering_enabled, call_waiter_enabled,
              order_rate_limit, waiter_call_cooldown_seconds, session_stale_hours)
  on public.cafes to authenticated;

-- cafe_tables : le jeton n'est jamais choisi par le client (défaut ou RPC de régénération).
grant insert (cafe_id, label, is_active) on public.cafe_tables to authenticated;
grant update (label, is_active)          on public.cafe_tables to authenticated;
grant delete                             on public.cafe_tables to authenticated;

-- categories / products : owner + manager (RLS).
grant insert, update, delete on public.categories to authenticated;
grant insert (cafe_id, category_id, name, description, price_cents, image_path, is_available,
              is_promoted, promo_label, position, station, options)
  on public.products to authenticated;
grant update (category_id, name, description, price_cents, image_path, is_available,
              is_promoted, promo_label, position, station, options)
  on public.products to authenticated;
grant delete on public.products to authenticated;

-- customers : le client ne modifie que son nom d'affichage.
grant update (display_name) on public.customers to authenticated;

-- cafe_followers : le client suit / se désabonne / ne suit plus.
grant insert (customer_id, cafe_id, notifications_opt_in) on public.cafe_followers to authenticated;
grant update (notifications_opt_in, unsubscribed_at)       on public.cafe_followers to authenticated;
grant delete                                                on public.cafe_followers to authenticated;

-- announcements : statut et compteurs ne sont modifiés que par send-announcement.
grant insert (cafe_id, title, body, image_path) on public.announcements to authenticated;
grant update (title, body, image_path)          on public.announcements to authenticated;
grant delete                                    on public.announcements to authenticated;

-- Aucune écriture directe (anon comme authenticated) sur :
-- staff_members, table_sessions, orders, order_items, waiter_calls, rate_limit_hits.
-- (déjà couvert par le "revoke all" ci-dessus, rien n'est ré-accordé)

-- -----------------------------------------------------------------------------
-- Activation RLS : toutes les tables du schéma public
-- -----------------------------------------------------------------------------
alter table public.cafes           enable row level security;
alter table public.staff_members   enable row level security;
alter table public.cafe_tables     enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.table_sessions  enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.waiter_calls    enable row level security;
alter table public.customers       enable row level security;
alter table public.cafe_followers  enable row level security;
alter table public.announcements   enable row level security;
alter table public.rate_limit_hits enable row level security;

-- -----------------------------------------------------------------------------
-- cafes
-- -----------------------------------------------------------------------------
create policy cafes_staff_select on public.cafes
  for select to authenticated
  using (id = (select public.current_staff_cafe_id()));

create policy cafes_owner_update on public.cafes
  for update to authenticated
  using (
    id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) = 'owner'
  )
  with check (
    id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) = 'owner'
  );

-- -----------------------------------------------------------------------------
-- staff_members : lecture des membres de son café. Écritures via fonctions.
-- -----------------------------------------------------------------------------
create policy staff_members_staff_select on public.staff_members
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

-- -----------------------------------------------------------------------------
-- cafe_tables
-- -----------------------------------------------------------------------------
create policy cafe_tables_staff_select on public.cafe_tables
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

create policy cafe_tables_manager_insert on public.cafe_tables
  for insert to authenticated
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy cafe_tables_manager_update on public.cafe_tables
  for update to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  )
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy cafe_tables_manager_delete on public.cafe_tables
  for delete to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create policy categories_public_select on public.categories
  for select to anon
  using (is_visible and public.is_cafe_active(cafe_id));

create policy categories_staff_select on public.categories
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

create policy categories_manager_insert on public.categories
  for insert to authenticated
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy categories_manager_update on public.categories
  for update to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  )
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy categories_manager_delete on public.categories
  for delete to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

-- -----------------------------------------------------------------------------
-- products (un waiter ne change que la disponibilité, via staff_set_product_availability)
-- -----------------------------------------------------------------------------
create policy products_public_select on public.products
  for select to anon
  using (
    public.is_cafe_active(cafe_id)
    and exists (
      select 1 from public.categories c
      where c.id = products.category_id
        and c.cafe_id = products.cafe_id
        and c.is_visible
    )
  );

create policy products_staff_select on public.products
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

create policy products_manager_insert on public.products
  for insert to authenticated
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy products_manager_update on public.products
  for update to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  )
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy products_manager_delete on public.products
  for delete to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

-- -----------------------------------------------------------------------------
-- table_sessions, orders, order_items, waiter_calls : lecture personnel uniquement.
-- Aucune policy d'écriture : tout passe par les fonctions de 0003.
-- -----------------------------------------------------------------------------
create policy table_sessions_staff_select on public.table_sessions
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

create policy orders_staff_select on public.orders
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

create policy order_items_staff_select on public.order_items
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

create policy waiter_calls_staff_select on public.waiter_calls
  for select to authenticated
  using (cafe_id = (select public.current_staff_cafe_id()));

-- -----------------------------------------------------------------------------
-- customers : chacun sa ligne.
-- -----------------------------------------------------------------------------
create policy customers_self_select on public.customers
  for select to authenticated
  using (id = (select auth.uid()));

create policy customers_self_update on public.customers
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- cafe_followers
-- -----------------------------------------------------------------------------
create policy cafe_followers_self_select on public.cafe_followers
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy cafe_followers_self_insert on public.cafe_followers
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and public.is_cafe_active(cafe_id)
  );

create policy cafe_followers_self_update on public.cafe_followers
  for update to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy cafe_followers_self_delete on public.cafe_followers
  for delete to authenticated
  using (customer_id = (select auth.uid()));

-- owner / manager : lecture seule des abonnés de leur café.
create policy cafe_followers_manager_select on public.cafe_followers
  for select to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

-- -----------------------------------------------------------------------------
-- announcements : owner + manager de ce café ; modifiables seulement en brouillon.
-- -----------------------------------------------------------------------------
create policy announcements_manager_select on public.announcements
  for select to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
  );

create policy announcements_manager_insert on public.announcements
  for insert to authenticated
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
    and status = 'draft'
  );

create policy announcements_manager_update on public.announcements
  for update to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
    and status = 'draft'
  )
  with check (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
    and status = 'draft'
  );

create policy announcements_manager_delete on public.announcements
  for delete to authenticated
  using (
    cafe_id = (select public.current_staff_cafe_id())
    and (select public.current_staff_role()) in ('owner', 'manager')
    and status = 'draft'
  );

-- -----------------------------------------------------------------------------
-- rate_limit_hits : aucune permission pour anon/authenticated.
-- Policy restrictive explicite "tout refuser" pour respecter la règle
-- "aucune table sans policy" sans rien autoriser.
-- -----------------------------------------------------------------------------
create policy rate_limit_hits_deny_all on public.rate_limit_hits
  as restrictive
  for all to anon, authenticated
  using (false)
  with check (false);

-- -----------------------------------------------------------------------------
-- Garde-fou : la migration échoue si une table de public n'a pas la RLS
-- activée ou n'a aucune policy.
-- -----------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      not c.relrowsecurity
      or not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    );

  if v_bad is not null then
    raise exception 'RLS manquante ou table sans policy : %', v_bad;
  end if;
end;
$$;
