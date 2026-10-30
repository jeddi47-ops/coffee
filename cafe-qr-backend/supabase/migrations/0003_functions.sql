-- =============================================================================
-- Café QR (V1) : 0003_functions.sql
-- Fonctions RPC du personnel, fonctions internes (service_role), révocations.
--
-- Convention d'erreur : les fonctions lèvent SQLSTATE 'PT<code HTTP>'
-- (ex. PT404). PostgREST renvoie alors directement ce code HTTP, et les Edge
-- Functions le convertissent au format { "error": { code, message } }.
--   MESSAGE = code machine (ex. 'invalid_transition')
--   DETAIL  = message lisible (français)
--   HINT    = retry_after_seconds pour les 429
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------
create or replace function public.api_error(
  p_status  integer,
  p_code    text,
  p_message text,
  p_hint    text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'PT' || p_status::text,
    message = p_code,
    detail  = p_message,
    hint    = coalesce(p_hint, '');
end;
$$;

-- Vérifie que l'appelant est un employé actif d'un café actif, avec un rôle autorisé.
-- Renvoie son cafe_id.
create or replace function public.assert_staff(p_roles public.staff_role[])
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.current_staff_cafe_id();
  v_role    public.staff_role := public.current_staff_role();
begin
  if v_cafe_id is null or v_role is null then
    perform public.api_error(403, 'forbidden', 'Accès réservé au personnel actif d''un café actif.');
  end if;
  if not (v_role = any (p_roles)) then
    perform public.api_error(403, 'forbidden_role', 'Votre rôle ne permet pas cette action.');
  end if;
  return v_cafe_id;
end;
$$;

-- Addition indicative d'une session : somme des commandes non annulées.
create or replace function public.session_total_cents(p_session_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(o.total_cents), 0)::bigint
  from public.orders o
  where o.session_id = p_session_id
    and o.status <> 'cancelled';
$$;

-- =============================================================================
-- Fonctions pour le personnel (RPC, authenticated)
-- =============================================================================

-- Transitions autorisées :
--   pending -> accepted -> preparing -> served
--   pending | accepted | preparing -> cancelled
create or replace function public.staff_update_order_status(
  p_order_id   uuid,
  p_new_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.assert_staff(array['owner', 'manager', 'waiter']::public.staff_role[]);
  v_uid     uuid := (select auth.uid());
  v_order   public.orders;
begin
  select * into v_order
  from public.orders o
  where o.id = p_order_id and o.cafe_id = v_cafe_id
  for update;

  if not found then
    perform public.api_error(404, 'order_not_found', 'Commande introuvable.');
  end if;

  if not (
       (v_order.status = 'pending'   and p_new_status in ('accepted', 'cancelled'))
    or (v_order.status = 'accepted'  and p_new_status in ('preparing', 'cancelled'))
    or (v_order.status = 'preparing' and p_new_status in ('served', 'cancelled'))
  ) then
    perform public.api_error(
      400, 'invalid_transition',
      format('Transition de statut refusée : %s -> %s.', v_order.status, p_new_status)
    );
  end if;

  update public.orders o set
    status       = p_new_status,
    accepted_at  = case when p_new_status = 'accepted'  then now()      else o.accepted_at  end,
    accepted_by  = case when p_new_status = 'accepted'  then v_uid      else o.accepted_by  end,
    served_at    = case when p_new_status = 'served'    then now()      else o.served_at    end,
    cancelled_at = case when p_new_status = 'cancelled' then now()      else o.cancelled_at end,
    cancelled_by = case when p_new_status = 'cancelled' then v_uid::text else o.cancelled_by end
  where o.id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.staff_handle_waiter_call(p_call_id uuid)
returns public.waiter_calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.assert_staff(array['owner', 'manager', 'waiter']::public.staff_role[]);
  v_call    public.waiter_calls;
begin
  select * into v_call
  from public.waiter_calls w
  where w.id = p_call_id and w.cafe_id = v_cafe_id
  for update;

  if not found then
    perform public.api_error(404, 'waiter_call_not_found', 'Appel introuvable.');
  end if;

  -- Idempotent : un appel déjà traité est renvoyé tel quel.
  if v_call.status = 'open' then
    update public.waiter_calls w set
      status     = 'handled',
      handled_at = now(),
      handled_by = (select auth.uid())
    where w.id = v_call.id
    returning * into v_call;
  end if;

  return v_call;
end;
$$;

create or replace function public.staff_close_session(p_session_id uuid)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.assert_staff(array['owner', 'manager', 'waiter']::public.staff_role[]);
  v_uid     uuid := (select auth.uid());
  v_session public.table_sessions;
begin
  select * into v_session
  from public.table_sessions s
  where s.id = p_session_id and s.cafe_id = v_cafe_id
  for update;

  if not found then
    perform public.api_error(404, 'session_not_found', 'Session introuvable.');
  end if;

  if v_session.status = 'open' then
    update public.table_sessions s set
      status    = 'closed',
      closed_at = now(),
      closed_by = v_uid
    where s.id = v_session.id
    returning * into v_session;

    -- Les appels serveur encore ouverts de cette table sont considérés traités.
    update public.waiter_calls w set
      status     = 'handled',
      handled_at = now(),
      handled_by = v_uid
    where w.table_id = v_session.table_id
      and w.cafe_id = v_cafe_id
      and w.status = 'open';
  end if;

  return v_session;
end;
$$;

create or replace function public.staff_set_product_availability(
  p_product_id uuid,
  p_available  boolean
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.assert_staff(array['owner', 'manager', 'waiter']::public.staff_role[]);
  v_product public.products;
begin
  if p_available is null then
    perform public.api_error(400, 'validation_error', 'p_available est obligatoire.');
  end if;

  update public.products p set is_available = p_available
  where p.id = p_product_id and p.cafe_id = v_cafe_id
  returning * into v_product;

  if not found then
    perform public.api_error(404, 'product_not_found', 'Produit introuvable.');
  end if;

  return v_product;
end;
$$;

create or replace function public.staff_regenerate_table_token(p_table_id uuid)
returns public.cafe_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.assert_staff(array['owner', 'manager']::public.staff_role[]);
  v_table   public.cafe_tables;
begin
  update public.cafe_tables t set qr_token = public.generate_qr_token()
  where t.id = p_table_id and t.cafe_id = v_cafe_id
  returning * into v_table;

  if not found then
    perform public.api_error(404, 'table_not_found', 'Table introuvable.');
  end if;

  return v_table;
end;
$$;

create or replace function public.owner_set_staff_active(
  p_staff_id uuid,
  p_active   boolean
)
returns public.staff_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.assert_staff(array['owner']::public.staff_role[]);
  v_member  public.staff_members;
begin
  if p_active is null then
    perform public.api_error(400, 'validation_error', 'p_active est obligatoire.');
  end if;

  if p_staff_id = (select auth.uid()) then
    perform public.api_error(409, 'cannot_deactivate_self', 'Impossible de modifier votre propre activation.');
  end if;

  update public.staff_members sm set is_active = p_active
  where sm.id = p_staff_id and sm.cafe_id = v_cafe_id
  returning * into v_member;

  if not found then
    perform public.api_error(404, 'staff_not_found', 'Employé introuvable.');
  end if;

  return v_member;
end;
$$;

-- Historique des commandes, pagination par curseur (created_at, id) décroissant.
-- SECURITY INVOKER : la RLS s'applique en plus du filtre explicite.
create or replace function public.staff_list_orders(
  p_status            public.order_status default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id         uuid default null,
  p_limit             integer default 50
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.current_staff_cafe_id();
  v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows    jsonb;
  v_count   integer;
  v_last    jsonb;
begin
  if v_cafe_id is null then
    perform public.api_error(403, 'forbidden', 'Accès réservé au personnel actif d''un café actif.');
  end if;

  with page as (
    select o.*
    from public.orders o
    where o.cafe_id = v_cafe_id
      and (p_status is null or o.status = p_status)
      and (
        p_cursor_created_at is null
        or (o.created_at, o.id) < (p_cursor_created_at, coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    order by o.created_at desc, o.id desc
    limit v_limit + 1
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'order_number', p.order_number, 'status', p.status, 'order_type', p.order_type,
        'table_id', p.table_id, 'table_label', t.label, 'session_id', p.session_id,
        'note', p.note, 'total_cents', p.total_cents, 'created_at', p.created_at,
        'accepted_at', p.accepted_at, 'served_at', p.served_at, 'cancelled_at', p.cancelled_at,
        'cancelled_by', p.cancelled_by,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', i.id, 'product_id', i.product_id, 'name', i.name_snapshot,
                   'unit_price_cents', i.unit_price_cents_snapshot, 'quantity', i.quantity,
                   'note', i.note, 'options', i.options, 'station', i.station)
                 order by i.created_at, i.id)
          from public.order_items i where i.order_id = p.id
        ), '[]'::jsonb)
      ) order by p.created_at desc, p.id desc
    ), '[]'::jsonb),
    count(*)
  into v_rows, v_count
  from page p
  join public.cafe_tables t on t.id = p.table_id;

  if v_count > v_limit then
    v_rows := v_rows - v_limit;  -- retire l'élément sentinelle
    v_last := v_rows -> (v_limit - 1);
    return jsonb_build_object(
      'items', v_rows,
      'next_cursor', jsonb_build_object('created_at', v_last -> 'created_at', 'id', v_last -> 'id')
    );
  end if;

  return jsonb_build_object('items', v_rows, 'next_cursor', null);
end;
$$;

-- Abonnés du café (owner / manager), pagination par curseur (created_at, customer_id).
-- Les emails ne sont pas exposés au personnel.
create or replace function public.staff_list_followers(
  p_cursor_created_at  timestamptz default null,
  p_cursor_customer_id uuid default null,
  p_limit              integer default 50
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.current_staff_cafe_id();
  v_role    public.staff_role := public.current_staff_role();
  v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows    jsonb;
  v_count   integer;
  v_last    jsonb;
  v_active  bigint;
begin
  if v_cafe_id is null or v_role not in ('owner', 'manager') then
    perform public.api_error(403, 'forbidden_role', 'Réservé au patron et aux managers.');
  end if;

  with page as (
    select f.*
    from public.cafe_followers f
    where f.cafe_id = v_cafe_id
      and (
        p_cursor_created_at is null
        or (f.created_at, f.customer_id) < (p_cursor_created_at, coalesce(p_cursor_customer_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    order by f.created_at desc, f.customer_id desc
    limit v_limit + 1
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'customer_id', p.customer_id, 'notifications_opt_in', p.notifications_opt_in,
      'unsubscribed_at', p.unsubscribed_at, 'created_at', p.created_at
    ) order by p.created_at desc, p.customer_id desc), '[]'::jsonb),
    count(*)
  into v_rows, v_count
  from page p;

  select count(*) into v_active
  from public.cafe_followers f
  where f.cafe_id = v_cafe_id and f.notifications_opt_in and f.unsubscribed_at is null;

  if v_count > v_limit then
    v_rows := v_rows - v_limit;
    v_last := v_rows -> (v_limit - 1);
    return jsonb_build_object(
      'items', v_rows, 'active_subscribers', v_active,
      'next_cursor', jsonb_build_object('created_at', v_last -> 'created_at', 'customer_id', v_last -> 'customer_id')
    );
  end if;

  return jsonb_build_object('items', v_rows, 'active_subscribers', v_active, 'next_cursor', null);
end;
$$;

-- =============================================================================
-- Fonctions pour les clients connectés (RPC, authenticated)
-- =============================================================================

-- Suivre un café par son slug (ou se réabonner).
create or replace function public.follow_cafe(p_slug text)
returns public.cafe_followers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_cafe_id uuid;
  v_row     public.cafe_followers;
begin
  if v_uid is null or not exists (select 1 from public.customers c where c.id = v_uid) then
    perform public.api_error(403, 'not_a_customer', 'Réservé aux comptes clients.');
  end if;

  select c.id into v_cafe_id from public.cafes c
  where c.slug = lower(btrim(coalesce(p_slug, ''))) and c.is_active;

  if v_cafe_id is null then
    perform public.api_error(404, 'cafe_not_found', 'Café introuvable.');
  end if;

  insert into public.cafe_followers (customer_id, cafe_id, notifications_opt_in, unsubscribed_at)
  values (v_uid, v_cafe_id, true, null)
  on conflict (customer_id, cafe_id)
  do update set notifications_opt_in = true, unsubscribed_at = null
  returning * into v_row;

  return v_row;
end;
$$;

-- Cafés suivis par le client connecté (les clients n'ont pas accès à la table cafes).
create or replace function public.my_followed_cafes()
returns table (
  cafe_id              uuid,
  name                 text,
  slug                 text,
  logo_path            text,
  notifications_opt_in boolean,
  unsubscribed_at      timestamptz,
  followed_at          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.slug, c.logo_path, f.notifications_opt_in, f.unsubscribed_at, f.created_at
  from public.cafe_followers f
  join public.cafes c on c.id = f.cafe_id
  where f.customer_id = (select auth.uid())
    and c.is_active
  order by f.created_at desc;
$$;

-- Droit à l'effacement : supprime le compte client et ses abonnements (cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    perform public.api_error(401, 'not_authenticated', 'Connexion requise.');
  end if;

  if exists (select 1 from public.staff_members sm where sm.id = v_uid) then
    perform public.api_error(403, 'staff_account', 'Un compte employé ne peut pas être supprimé par cette fonction.');
  end if;

  delete from public.cafe_followers f where f.customer_id = v_uid;
  delete from public.customers c where c.id = v_uid;
  delete from auth.users u where u.id = v_uid;
end;
$$;

-- =============================================================================
-- Fonctions internes (service_role uniquement : appelées par les Edge Functions)
-- =============================================================================

-- Limitation de débit générique. Renvoie true si autorisé (et enregistre le hit).
-- Seuls les hits autorisés sont enregistrés : la table reste bornée à
-- p_max lignes par clé et par fenêtre.
create or replace function public.check_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or p_max is null or p_max < 1 or p_window_seconds is null or p_window_seconds < 1 then
    perform public.api_error(400, 'validation_error', 'Paramètres de limitation invalides.');
  end if;

  -- Sérialise les appels concurrents sur une même clé.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key, 0));

  -- Nettoyage opportuniste (≈1 appel sur 100) si pg_cron n'est pas disponible.
  if pg_catalog.random() < 0.01 then
    delete from public.rate_limit_hits h where h.created_at < now() - interval '1 hour';
  end if;

  select count(*) into v_count
  from public.rate_limit_hits h
  where h.key = p_key
    and h.created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (key) values (p_key);
  return true;
end;
$$;

-- Menu public complet en une seule requête.
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
      'call_waiter_enabled', v_cafe.call_waiter_enabled
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

-- État de la table : session ouverte non périmée, commandes + lignes, total,
-- appel serveur ouvert. Ne lit que les données de la table du jeton.
create or replace function public.get_table_state_tx(p_table_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table   public.cafe_tables;
  v_cafe    public.cafes;
  v_session public.table_sessions;
  v_orders  jsonb := '[]'::jsonb;
  v_total   bigint := 0;
  v_call    jsonb;
begin
  select * into v_table from public.cafe_tables t where t.qr_token = p_table_token;
  if not found or not v_table.is_active then
    perform public.api_error(404, 'table_not_found', 'QR code inconnu ou désactivé.');
  end if;

  select * into v_cafe from public.cafes c where c.id = v_table.cafe_id;
  if not v_cafe.is_active then
    perform public.api_error(403, 'cafe_inactive', 'Ce café n''est pas disponible.');
  end if;

  select * into v_session
  from public.table_sessions s
  where s.table_id = v_table.id
    and s.cafe_id = v_cafe.id
    and s.status = 'open'
    and s.last_activity_at >= now() - make_interval(hours => v_cafe.session_stale_hours);

  if found then
    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'status', o.status,
          'order_type', o.order_type,
          'note', o.note,
          'total_cents', o.total_cents,
          'created_at', o.created_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'name', i.name_snapshot,
                     'unit_price_cents', i.unit_price_cents_snapshot,
                     'quantity', i.quantity,
                     'note', i.note,
                     'options', i.options
                   ) order by i.created_at, i.id)
            from public.order_items i
            where i.order_id = o.id
          ), '[]'::jsonb)
        ) order by o.created_at
      ), '[]'::jsonb),
      coalesce(sum(o.total_cents) filter (where o.status <> 'cancelled'), 0)
    into v_orders, v_total
    from public.orders o
    where o.session_id = v_session.id
      and o.table_id = v_table.id;
  end if;

  select jsonb_build_object('id', w.id, 'status', w.status, 'created_at', w.created_at)
  into v_call
  from public.waiter_calls w
  where w.table_id = v_table.id and w.status = 'open';

  return jsonb_build_object(
    'table', jsonb_build_object('label', v_table.label),
    'session', case when v_session.id is null then null
                    else jsonb_build_object('id', v_session.id, 'opened_at', v_session.opened_at) end,
    'orders', v_orders,
    'total_cents', v_total,
    'currency', v_cafe.currency,
    'waiter_call', v_call,
    'disclaimer', 'Montant indicatif, pas un ticket de caisse'
  );
end;
$$;

-- Création de commande : une seule transaction (voir section 7 du cahier des charges).
create or replace function public.create_order_tx(
  p_table_token text,
  p_items       jsonb,
  p_note        text default null,
  p_order_type  text default 'dine_in'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_table         public.cafe_tables;
  v_cafe          public.cafes;
  v_session       public.table_sessions;
  v_session_id    uuid;
  v_order_type    public.order_type;
  v_recent        integer;
  v_oldest        timestamptz;
  v_item          jsonb;
  v_product       public.products;
  v_product_id    uuid;
  v_qty_num       numeric;
  v_qty           integer;
  v_item_note     text;
  v_options       jsonb;
  v_lines         jsonb := '[]'::jsonb;
  v_total         bigint := 0;
  v_total_qty     integer := 0;
  v_order_number  integer;
  v_order         public.orders;
  v_session_total bigint;
  v_cancel_key    text;
begin
  -- (1) table par jeton, verrouillée : sérialise les commandes d'une même table
  select * into v_table
  from public.cafe_tables t
  where t.qr_token = p_table_token
  for update;

  if not found or not v_table.is_active then
    perform public.api_error(404, 'table_not_found', 'QR code inconnu ou désactivé.');
  end if;

  -- (2) café actif, commande activée
  select * into v_cafe from public.cafes c where c.id = v_table.cafe_id;
  if not v_cafe.is_active then
    perform public.api_error(403, 'cafe_inactive', 'Ce café n''est pas disponible.');
  end if;
  if not v_cafe.ordering_enabled then
    perform public.api_error(403, 'ordering_disabled', 'La commande depuis la table est désactivée.');
  end if;

  begin
    v_order_type := coalesce(nullif(btrim(p_order_type), ''), 'dine_in')::public.order_type;
  exception when invalid_text_representation then
    perform public.api_error(400, 'invalid_order_type', 'order_type doit valoir dine_in ou takeaway.');
  end;

  -- (3) limite par table : order_rate_limit commandes / 10 minutes
  select count(*), min(o.created_at) into v_recent, v_oldest
  from public.orders o
  where o.table_id = v_table.id
    and o.created_at > now() - interval '10 minutes';

  if v_recent >= v_cafe.order_rate_limit then
    perform public.api_error(
      429, 'table_rate_limited',
      'Trop de commandes pour cette table. Réessayez dans quelques minutes.',
      greatest(1, ceil(extract(epoch from (v_oldest + interval '10 minutes' - now()))))::integer::text
    );
  end if;

  -- (5) validation des articles (prix lus en base, jamais depuis le client)
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform public.api_error(400, 'empty_order', 'La commande doit contenir au moins un article.');
  end if;
  if jsonb_array_length(p_items) > 50 then
    perform public.api_error(400, 'too_many_items', 'Maximum 50 articles par commande.');
  end if;

  for v_item in select e.value from jsonb_array_elements(p_items) as e(value) loop
    if jsonb_typeof(v_item) <> 'object' then
      perform public.api_error(400, 'invalid_item', 'Article invalide.');
    end if;

    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
    exception when invalid_text_representation then
      perform public.api_error(400, 'invalid_product_id', 'product_id invalide.');
    end;
    if v_product_id is null then
      perform public.api_error(400, 'invalid_product_id', 'product_id manquant.');
    end if;

    if jsonb_typeof(v_item -> 'quantity') is distinct from 'number' then
      perform public.api_error(400, 'invalid_quantity', 'La quantité doit être un entier entre 1 et 20.');
    end if;
    v_qty_num := (v_item ->> 'quantity')::numeric;
    if v_qty_num <> trunc(v_qty_num) or v_qty_num < 1 or v_qty_num > 20 then
      perform public.api_error(400, 'invalid_quantity', 'La quantité doit être un entier entre 1 et 20.');
    end if;
    v_qty := v_qty_num::integer;

    v_total_qty := v_total_qty + v_qty;
    if v_total_qty > 50 then
      perform public.api_error(400, 'too_many_items', 'Maximum 50 articles par commande.');
    end if;

    v_item_note := nullif(left(btrim(coalesce(v_item ->> 'note', '')), 150), '');

    v_options := coalesce(v_item -> 'options', '[]'::jsonb);
    if jsonb_typeof(v_options) = 'null' then
      v_options := '[]'::jsonb;
    end if;
    if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) > 20 then
      perform public.api_error(400, 'invalid_options', 'options doit être une liste (20 éléments max).');
    end if;

    select p.* into v_product
    from public.products p
    join public.categories c on c.id = p.category_id and c.cafe_id = p.cafe_id
    where p.id = v_product_id
      and p.cafe_id = v_cafe.id
      and c.is_visible;

    if not found then
      perform public.api_error(404, 'product_not_found', 'Produit introuvable dans ce café.');
    end if;
    if not v_product.is_available then
      perform public.api_error(409, 'product_unavailable',
        format('Le produit « %s » n''est plus disponible.', v_product.name));
    end if;

    v_total := v_total + v_product.price_cents::bigint * v_qty;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'price', v_product.price_cents,
      'qty', v_qty,
      'note', v_item_note,
      'options', v_options,
      'station', v_product.station
    ));
  end loop;

  if v_total > 2147483647 then
    perform public.api_error(400, 'total_too_large', 'Montant de commande trop élevé.');
  end if;

  -- (4) session : fermeture paresseuse si périmée, ouverture si besoin
  select * into v_session
  from public.table_sessions s
  where s.table_id = v_table.id and s.status = 'open'
  for update;

  if found then
    if v_session.last_activity_at < now() - make_interval(hours => v_cafe.session_stale_hours) then
      update public.table_sessions s
      set status = 'closed', closed_at = now(), closed_by = null
      where s.id = v_session.id;
    else
      v_session_id := v_session.id;
    end if;
  end if;

  if v_session_id is null then
    insert into public.table_sessions (cafe_id, table_id)
    values (v_cafe.id, v_table.id)
    returning id into v_session_id;
  end if;

  -- (6) numéro de commande séquentiel par café, incrément atomique
  update public.cafes c
  set last_order_number = c.last_order_number + 1
  where c.id = v_cafe.id
  returning c.last_order_number into v_order_number;

  -- (7) + (8) commande + lignes avec snapshots, total calculé côté serveur
  -- Clé d'annulation : renvoyée une seule fois au client, seule son empreinte est stockée.
  v_cancel_key := encode(extensions.gen_random_bytes(18), 'hex');

  insert into public.orders (cafe_id, session_id, table_id, order_number, order_type, status, note, total_cents, cancel_key_hash)
  values (
    v_cafe.id, v_session_id, v_table.id, v_order_number, v_order_type, 'pending',
    nullif(left(btrim(coalesce(p_note, '')), 300), ''),
    v_total::integer,
    encode(extensions.digest(v_cancel_key, 'sha256'), 'hex')
  )
  returning * into v_order;

  insert into public.order_items
    (order_id, cafe_id, product_id, name_snapshot, unit_price_cents_snapshot, quantity, note, options, station)
  select
    v_order.id, v_cafe.id,
    (l ->> 'product_id')::uuid,
    l ->> 'name',
    (l ->> 'price')::integer,
    (l ->> 'qty')::integer,
    l ->> 'note',
    l -> 'options',
    l ->> 'station'
  from jsonb_array_elements(v_lines) as l;

  -- (9) activité de la session
  update public.table_sessions s set last_activity_at = now() where s.id = v_session_id;

  v_session_total := public.session_total_cents(v_session_id);

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'order_total_cents', v_order.total_cents,
    'session_id', v_session_id,
    'session_total_cents', v_session_total,
    'cancel_key', v_cancel_key,
    'currency', v_cafe.currency
  );
end;
$$;

-- Annulation : réservée au client qui a passé la commande (clé d'annulation obligatoire).
-- Sans clé valide, la commande est traitée comme introuvable (404) : rien n'est révélé.
create or replace function public.cancel_order_tx(
  p_table_token text,
  p_order_id    uuid,
  p_cancel_key  text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_table   public.cafe_tables;
  v_cafe    public.cafes;
  v_order   public.orders;
  v_session public.table_sessions;
begin
  select * into v_table from public.cafe_tables t where t.qr_token = p_table_token for update;
  if not found or not v_table.is_active then
    perform public.api_error(404, 'table_not_found', 'QR code inconnu ou désactivé.');
  end if;

  select * into v_cafe from public.cafes c where c.id = v_table.cafe_id;
  if not v_cafe.is_active then
    perform public.api_error(403, 'cafe_inactive', 'Ce café n''est pas disponible.');
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id and o.table_id = v_table.id and o.cafe_id = v_cafe.id
  for update;

  if not found
     or p_cancel_key is null
     or v_order.cancel_key_hash is distinct from encode(extensions.digest(p_cancel_key, 'sha256'), 'hex') then
    perform public.api_error(404, 'order_not_found', 'Commande introuvable pour cette table.');
  end if;

  select * into v_session from public.table_sessions s where s.id = v_order.session_id;
  if v_session.status <> 'open'
     or v_session.last_activity_at < now() - make_interval(hours => v_cafe.session_stale_hours) then
    perform public.api_error(409, 'order_not_cancellable', 'Cette commande appartient à une session terminée.');
  end if;

  if v_order.status <> 'pending' then
    perform public.api_error(409, 'order_not_pending', 'La commande a déjà été prise en charge, elle ne peut plus être annulée.');
  end if;

  update public.orders o
  set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer'
  where o.id = v_order.id
  returning * into v_order;

  update public.table_sessions s set last_activity_at = now() where s.id = v_session.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'session_total_cents', public.session_total_cents(v_session.id),
    'currency', v_cafe.currency
  );
end;
$$;

-- Appel serveur : idempotent si un appel est déjà ouvert, délai de répit après traitement.
create or replace function public.call_waiter_tx(p_table_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_table       public.cafe_tables;
  v_cafe        public.cafes;
  v_call        public.waiter_calls;
  v_last        timestamptz;
  v_session_id  uuid;
begin
  select * into v_table from public.cafe_tables t where t.qr_token = p_table_token for update;
  if not found or not v_table.is_active then
    perform public.api_error(404, 'table_not_found', 'QR code inconnu ou désactivé.');
  end if;

  select * into v_cafe from public.cafes c where c.id = v_table.cafe_id;
  if not v_cafe.is_active then
    perform public.api_error(403, 'cafe_inactive', 'Ce café n''est pas disponible.');
  end if;
  if not v_cafe.call_waiter_enabled then
    perform public.api_error(403, 'call_waiter_disabled', 'L''appel serveur est désactivé dans ce café.');
  end if;

  select * into v_call from public.waiter_calls w where w.table_id = v_table.id and w.status = 'open';
  if found then
    return jsonb_build_object(
      'created', false,
      'call', jsonb_build_object('id', v_call.id, 'status', v_call.status, 'created_at', v_call.created_at)
    );
  end if;

  select max(w.handled_at) into v_last
  from public.waiter_calls w
  where w.table_id = v_table.id and w.status = 'handled';

  if v_last is not null
     and v_last > now() - make_interval(secs => v_cafe.waiter_call_cooldown_seconds) then
    perform public.api_error(
      429, 'waiter_call_cooldown',
      'Un serveur vient de passer. Merci de patienter avant de rappeler.',
      greatest(1, ceil(extract(epoch from (
        v_last + make_interval(secs => v_cafe.waiter_call_cooldown_seconds) - now()
      ))))::integer::text
    );
  end if;

  select s.id into v_session_id
  from public.table_sessions s
  where s.table_id = v_table.id
    and s.status = 'open'
    and s.last_activity_at >= now() - make_interval(hours => v_cafe.session_stale_hours);

  insert into public.waiter_calls (cafe_id, table_id, session_id)
  values (v_cafe.id, v_table.id, v_session_id)
  returning * into v_call;

  return jsonb_build_object(
    'created', true,
    'call', jsonb_build_object('id', v_call.id, 'status', v_call.status, 'created_at', v_call.created_at)
  );
end;
$$;

-- Démarrage d'un envoi d'annonce : draft -> sending de façon atomique.
-- Quota : 3 annonces (sending ou sent) par café et par 24 heures.
create or replace function public.begin_announcement_send(
  p_announcement_id uuid,
  p_cafe_id         uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cafe   public.cafes;
  v_ann    public.announcements;
  v_count  integer;
  v_oldest timestamptz;
begin
  -- Verrou sur le café : sérialise les envois concurrents d'un même café.
  select * into v_cafe from public.cafes c where c.id = p_cafe_id for update;
  if not found or not v_cafe.is_active then
    perform public.api_error(403, 'cafe_inactive', 'Ce café n''est pas disponible.');
  end if;

  select * into v_ann
  from public.announcements a
  where a.id = p_announcement_id and a.cafe_id = p_cafe_id
  for update;

  if not found then
    perform public.api_error(404, 'announcement_not_found', 'Annonce introuvable.');
  end if;
  if v_ann.status <> 'draft' then
    perform public.api_error(409, 'announcement_already_sent', 'Cette annonce a déjà été envoyée (ou est en cours d''envoi).');
  end if;

  select count(*), min(a.sending_started_at) into v_count, v_oldest
  from public.announcements a
  where a.cafe_id = p_cafe_id
    and a.status in ('sending', 'sent')
    and a.sending_started_at > now() - interval '24 hours';

  if v_count >= 3 then
    perform public.api_error(
      429, 'announcement_quota',
      'Maximum 3 annonces envoyées par 24 heures.',
      greatest(1, ceil(extract(epoch from (v_oldest + interval '24 hours' - now()))))::integer::text
    );
  end if;

  update public.announcements a
  set status = 'sending', sending_started_at = now()
  where a.id = v_ann.id
  returning * into v_ann;

  return jsonb_build_object(
    'id', v_ann.id,
    'title', v_ann.title,
    'body', v_ann.body,
    'image_path', v_ann.image_path,
    'cafe_name', v_cafe.name,
    'cafe_slug', v_cafe.slug,
    'sending_started_at', v_ann.sending_started_at
  );
end;
$$;

-- Destinataires d'une annonce, pagination par curseur sur customer_id.
create or replace function public.announcement_recipients(
  p_cafe_id uuid,
  p_after   uuid default null,
  p_limit   integer default 100
)
returns table (customer_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.customer_id, cu.email
  from public.cafe_followers f
  join public.customers cu on cu.id = f.customer_id
  join auth.users au on au.id = f.customer_id
  where f.cafe_id = p_cafe_id
    and f.notifications_opt_in
    and f.unsubscribed_at is null
    and au.email_confirmed_at is not null
    and au.email = cu.email
    and cu.email <> ''
    and (p_after is null or f.customer_id > p_after)
  order by f.customer_id
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.finish_announcement_send(
  p_announcement_id uuid,
  p_sent_count      integer
)
returns public.announcements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ann public.announcements;
begin
  update public.announcements a
  set status = 'sent', sent_at = now(), sent_count = greatest(coalesce(p_sent_count, 0), 0)
  where a.id = p_announcement_id and a.status = 'sending'
  returning * into v_ann;

  if not found then
    perform public.api_error(409, 'announcement_not_sending', 'Annonce non en cours d''envoi.');
  end if;

  return v_ann;
end;
$$;

-- Envoi sans aucun email transmis : sending -> draft (libère le quota de 24 h).
create or replace function public.revert_announcement_send(p_announcement_id uuid)
returns public.announcements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ann public.announcements;
begin
  update public.announcements a
  set status = 'draft', sending_started_at = null, sent_count = 0
  where a.id = p_announcement_id and a.status = 'sending'
  returning * into v_ann;

  if not found then
    perform public.api_error(409, 'announcement_not_sending', 'Annonce non en cours d''envoi.');
  end if;
  return v_ann;
end;
$$;

-- Désabonnement (lien signé vérifié dans l'Edge Function unsubscribe).
-- p_commit = false : lecture seule (vérification du lien). p_commit = true : désabonne.
create or replace function public.unsubscribe_follower(
  p_customer_id uuid,
  p_cafe_id     uuid,
  p_commit      boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_row   public.cafe_followers;
  v_found boolean;
begin
  select c.name into v_name from public.cafes c where c.id = p_cafe_id;

  select * into v_row
  from public.cafe_followers f
  where f.customer_id = p_customer_id and f.cafe_id = p_cafe_id
  for update;
  v_found := found;

  if v_found and p_commit and v_row.unsubscribed_at is null then
    update public.cafe_followers f
    set notifications_opt_in = false, unsubscribed_at = now()
    where f.customer_id = p_customer_id and f.cafe_id = p_cafe_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'cafe_name', v_name,
    'found', v_found,
    'unsubscribed', v_found and v_row.unsubscribed_at is not null
  );
end;
$$;

-- =============================================================================
-- Droits d'exécution
-- Par défaut Postgres/Supabase accordent EXECUTE à public/anon/authenticated :
-- on révoque tout, puis on ré-accorde explicitement.
-- =============================================================================
revoke all on function public.api_error(integer, text, text, text)                     from public, anon, authenticated;
revoke all on function public.assert_staff(public.staff_role[])                         from public, anon, authenticated;
revoke all on function public.session_total_cents(uuid)                                 from public, anon, authenticated;

revoke all on function public.staff_update_order_status(uuid, public.order_status)      from public, anon, authenticated;
revoke all on function public.staff_handle_waiter_call(uuid)                            from public, anon, authenticated;
revoke all on function public.staff_close_session(uuid)                                 from public, anon, authenticated;
revoke all on function public.staff_set_product_availability(uuid, boolean)             from public, anon, authenticated;
revoke all on function public.staff_regenerate_table_token(uuid)                        from public, anon, authenticated;
revoke all on function public.owner_set_staff_active(uuid, boolean)                     from public, anon, authenticated;
revoke all on function public.staff_list_orders(public.order_status, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.staff_list_followers(timestamptz, uuid, integer)          from public, anon, authenticated;
revoke all on function public.follow_cafe(text)                                         from public, anon, authenticated;
revoke all on function public.my_followed_cafes()                                       from public, anon, authenticated;
revoke all on function public.delete_my_account()                                       from public, anon, authenticated;

revoke all on function public.check_rate_limit(text, integer, integer)                  from public, anon, authenticated;
revoke all on function public.get_menu_tx(text)                                         from public, anon, authenticated;
revoke all on function public.get_table_state_tx(text)                                  from public, anon, authenticated;
revoke all on function public.create_order_tx(text, jsonb, text, text)                  from public, anon, authenticated;
revoke all on function public.cancel_order_tx(text, uuid, text)                               from public, anon, authenticated;
revoke all on function public.call_waiter_tx(text)                                      from public, anon, authenticated;
revoke all on function public.begin_announcement_send(uuid, uuid)                       from public, anon, authenticated;
revoke all on function public.announcement_recipients(uuid, uuid, integer)              from public, anon, authenticated;
revoke all on function public.finish_announcement_send(uuid, integer)                   from public, anon, authenticated;
revoke all on function public.unsubscribe_follower(uuid, uuid, boolean)                          from public, anon, authenticated;

-- Utilitaires appelés par les fonctions SECURITY INVOKER du personnel.
grant execute on function public.api_error(integer, text, text, text) to authenticated, service_role;
grant execute on function public.session_total_cents(uuid)            to authenticated, service_role;
grant execute on function public.assert_staff(public.staff_role[])    to service_role;

-- Personnel (RPC authentifiées)
grant execute on function public.staff_update_order_status(uuid, public.order_status)  to authenticated;
grant execute on function public.staff_handle_waiter_call(uuid)                        to authenticated;
grant execute on function public.staff_close_session(uuid)                             to authenticated;
grant execute on function public.staff_set_product_availability(uuid, boolean)         to authenticated;
grant execute on function public.staff_regenerate_table_token(uuid)                    to authenticated;
grant execute on function public.owner_set_staff_active(uuid, boolean)                 to authenticated;
grant execute on function public.staff_list_orders(public.order_status, timestamptz, uuid, integer) to authenticated;
grant execute on function public.staff_list_followers(timestamptz, uuid, integer)      to authenticated;

-- Clients connectés
grant execute on function public.follow_cafe(text)      to authenticated;
grant execute on function public.my_followed_cafes()    to authenticated;
grant execute on function public.delete_my_account()    to authenticated;

-- Internes : service_role uniquement
grant execute on function public.check_rate_limit(text, integer, integer)     to service_role;
grant execute on function public.get_menu_tx(text)                            to service_role;
grant execute on function public.get_table_state_tx(text)                     to service_role;
grant execute on function public.create_order_tx(text, jsonb, text, text)     to service_role;
grant execute on function public.cancel_order_tx(text, uuid, text)                  to service_role;
grant execute on function public.call_waiter_tx(text)                         to service_role;
grant execute on function public.begin_announcement_send(uuid, uuid)          to service_role;
grant execute on function public.announcement_recipients(uuid, uuid, integer) to service_role;
grant execute on function public.finish_announcement_send(uuid, integer)      to service_role;
grant execute on function public.unsubscribe_follower(uuid, uuid, boolean)             to service_role;

revoke all on function public.revert_announcement_send(uuid) from public, anon, authenticated;
grant execute on function public.revert_announcement_send(uuid) to service_role;

-- =============================================================================
-- Nettoyage de rate_limit_hits via pg_cron (si disponible).
-- Sinon : nettoyage opportuniste dans check_rate_limit.
-- =============================================================================
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponible (%), nettoyage opportuniste uniquement.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cafe_qr_rate_limit_cleanup',
      '*/15 * * * *',
      $cron$delete from public.rate_limit_hits where created_at < now() - interval '1 hour'$cron$
    );
  end if;
end;
$$;
