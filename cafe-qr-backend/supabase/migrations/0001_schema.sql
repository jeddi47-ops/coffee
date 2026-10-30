-- =============================================================================
-- Café QR (V1) : 0001_schema.sql
-- Enums, tables, index, triggers.
-- Multi-tenant : chaque ligne métier porte un cafe_id. Les clés étrangères
-- composites (xxx_id, cafe_id) empêchent physiquement de relier une ligne
-- d'un café à une ligne d'un autre café.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.staff_role          as enum ('owner', 'manager', 'waiter');
create type public.session_status      as enum ('open', 'closed');
create type public.order_type          as enum ('dine_in', 'takeaway');
create type public.order_status        as enum ('pending', 'accepted', 'preparing', 'served', 'cancelled');
create type public.waiter_call_status  as enum ('open', 'handled');
create type public.announcement_status as enum ('draft', 'sending', 'sent');

-- -----------------------------------------------------------------------------
-- Fonctions utilitaires génériques
-- -----------------------------------------------------------------------------

-- Jeton de QR : 18 octets aléatoires = 36 caractères hexadécimaux.
create or replace function public.generate_qr_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(18), 'hex');
$$;

-- Maintien de updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- cafes
-- -----------------------------------------------------------------------------
create table public.cafes (
  id                            uuid primary key default gen_random_uuid(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  name                          text not null check (char_length(btrim(name)) between 1 and 120),
  slug                          text not null unique
                                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  logo_path                     text,
  currency                      text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  is_active                     boolean not null default true,
  -- Réglages
  ordering_enabled              boolean not null default true,
  call_waiter_enabled           boolean not null default true,
  order_rate_limit              integer not null default 5   check (order_rate_limit between 1 and 100),
  waiter_call_cooldown_seconds  integer not null default 60  check (waiter_call_cooldown_seconds between 0 and 3600),
  session_stale_hours           integer not null default 3   check (session_stale_hours between 1 and 48),
  last_order_number             integer not null default 0   check (last_order_number >= 0),
  -- Le logo doit vivre dans le dossier du café.
  constraint cafes_logo_path_in_own_folder
    check (logo_path is null or logo_path like (id::text || '/logo/%'))
);

-- -----------------------------------------------------------------------------
-- staff_members (1 utilisateur = 1 café en V1 : garanti par la PK sur id)
-- -----------------------------------------------------------------------------
create table public.staff_members (
  id            uuid primary key references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  cafe_id       uuid not null references public.cafes (id) on delete cascade,
  role          public.staff_role not null,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 80),
  is_active     boolean not null default true
);

-- Un seul owner par café.
create unique index staff_members_one_owner_per_cafe
  on public.staff_members (cafe_id) where role = 'owner';

-- -----------------------------------------------------------------------------
-- cafe_tables
-- -----------------------------------------------------------------------------
create table public.cafe_tables (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  cafe_id     uuid not null references public.cafes (id) on delete cascade,
  label       text not null check (char_length(btrim(label)) between 1 and 40),
  qr_token    text not null default public.generate_qr_token()
                check (qr_token ~ '^[0-9a-f]{36}$'),
  is_active   boolean not null default true,
  constraint cafe_tables_cafe_label_key unique (cafe_id, label),
  constraint cafe_tables_id_cafe_key unique (id, cafe_id)
);

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  cafe_id     uuid not null references public.cafes (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  position    integer not null default 0,
  is_visible  boolean not null default true,
  constraint categories_id_cafe_key unique (id, cafe_id)
);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  cafe_id       uuid not null references public.cafes (id) on delete cascade,
  category_id   uuid not null,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  description   text check (description is null or char_length(description) <= 1000),
  price_cents   integer not null check (price_cents >= 0),
  image_path    text,
  is_available  boolean not null default true,
  is_promoted   boolean not null default false,
  promo_label   text check (promo_label is null or char_length(promo_label) <= 60),
  position      integer not null default 0,
  -- Préparation restaurants (stockées, aucune logique en V1)
  station       text check (station is null or char_length(station) <= 40),
  options       jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  constraint products_category_same_cafe_fk
    foreign key (category_id, cafe_id) references public.categories (id, cafe_id),  -- NO ACTION : vider la catégorie avant de la supprimer
  constraint products_image_path_in_own_folder
    check (image_path is null or image_path like (cafe_id::text || '/%'))
);

-- -----------------------------------------------------------------------------
-- table_sessions
-- -----------------------------------------------------------------------------
create table public.table_sessions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  cafe_id           uuid not null references public.cafes (id) on delete cascade,
  table_id          uuid not null,
  status            public.session_status not null default 'open',
  opened_at         timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  closed_at         timestamptz,
  closed_by         uuid,
  constraint table_sessions_id_cafe_key unique (id, cafe_id),
  -- NO ACTION : une table avec historique ne peut pas être supprimée (la désactiver).
  constraint table_sessions_table_same_cafe_fk
    foreign key (table_id, cafe_id) references public.cafe_tables (id, cafe_id),
  constraint table_sessions_closed_consistency
    check ((status = 'open' and closed_at is null) or (status = 'closed' and closed_at is not null))
);

-- Une seule session ouverte par table.
create unique index table_sessions_one_open_per_table
  on public.table_sessions (table_id) where status = 'open';

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  cafe_id       uuid not null references public.cafes (id) on delete cascade,
  session_id    uuid not null,
  table_id      uuid not null,
  order_number  integer not null check (order_number > 0),
  order_type    public.order_type not null default 'dine_in',
  status        public.order_status not null default 'pending',
  note          text check (note is null or char_length(note) <= 300),
  total_cents   integer not null default 0 check (total_cents >= 0),
  accepted_at   timestamptz,
  accepted_by   uuid,
  served_at     timestamptz,
  cancelled_at  timestamptz,
  cancelled_by  text,  -- 'customer' ou id (uuid) d'un employé
  cancel_key_hash text,  -- sha256 de la clé d'annulation, remise uniquement au client qui a passé la commande
  constraint orders_id_cafe_key unique (id, cafe_id),
  constraint orders_cafe_number_key unique (cafe_id, order_number),
  constraint orders_session_same_cafe_fk
    foreign key (session_id, cafe_id) references public.table_sessions (id, cafe_id),
  constraint orders_table_same_cafe_fk
    foreign key (table_id, cafe_id) references public.cafe_tables (id, cafe_id)
);

-- -----------------------------------------------------------------------------
-- order_items (snapshots : changer un prix ne modifie pas les anciennes commandes)
-- -----------------------------------------------------------------------------
create table public.order_items (
  id                         uuid primary key default gen_random_uuid(),
  created_at                 timestamptz not null default now(),
  order_id                   uuid not null,
  cafe_id                    uuid not null references public.cafes (id) on delete cascade,
  product_id                 uuid references public.products (id) on delete set null,
  name_snapshot              text not null,
  unit_price_cents_snapshot  integer not null check (unit_price_cents_snapshot >= 0),
  quantity                   integer not null check (quantity between 1 and 20),
  note                       text check (note is null or char_length(note) <= 150),
  options                    jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  station                    text,
  constraint order_items_order_same_cafe_fk
    foreign key (order_id, cafe_id) references public.orders (id, cafe_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- waiter_calls
-- -----------------------------------------------------------------------------
create table public.waiter_calls (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  cafe_id     uuid not null references public.cafes (id) on delete cascade,
  table_id    uuid not null,
  session_id  uuid,
  status      public.waiter_call_status not null default 'open',
  handled_at  timestamptz,
  handled_by  uuid,
  constraint waiter_calls_table_same_cafe_fk
    foreign key (table_id, cafe_id) references public.cafe_tables (id, cafe_id),
  constraint waiter_calls_session_same_cafe_fk
    foreign key (session_id, cafe_id) references public.table_sessions (id, cafe_id)
);

-- Un seul appel ouvert par table.
create unique index waiter_calls_one_open_per_table
  on public.waiter_calls (table_id) where status = 'open';

-- -----------------------------------------------------------------------------
-- customers (pas de cafe_id : un client suit plusieurs cafés)
-- -----------------------------------------------------------------------------
create table public.customers (
  id            uuid primary key references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  email         text not null,
  display_name  text check (display_name is null or char_length(display_name) <= 80)
);

-- -----------------------------------------------------------------------------
-- cafe_followers
-- -----------------------------------------------------------------------------
create table public.cafe_followers (
  customer_id           uuid not null references public.customers (id) on delete cascade,
  cafe_id               uuid not null references public.cafes (id) on delete cascade,
  notifications_opt_in  boolean not null default true,
  unsubscribed_at       timestamptz,
  created_at            timestamptz not null default now(),
  primary key (customer_id, cafe_id)
);

-- -----------------------------------------------------------------------------
-- announcements (nouveautés)
-- -----------------------------------------------------------------------------
create table public.announcements (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  cafe_id             uuid not null references public.cafes (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 1 and 150),
  body                text not null check (char_length(btrim(body)) between 1 and 5000),
  image_path          text,
  status              public.announcement_status not null default 'draft',
  sent_count          integer not null default 0 check (sent_count >= 0),
  sending_started_at  timestamptz,
  sent_at             timestamptz,
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  constraint announcements_image_path_in_own_folder
    check (image_path is null or image_path like (cafe_id::text || '/%'))
);

-- -----------------------------------------------------------------------------
-- rate_limit_hits (accès uniquement via fonction ou service_role)
-- -----------------------------------------------------------------------------
create table public.rate_limit_hits (
  id          bigint generated always as identity primary key,
  key         text not null check (char_length(key) <= 200),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Index obligatoires (+ index de support des FK)
-- -----------------------------------------------------------------------------
create index orders_cafe_status_created_idx     on public.orders (cafe_id, status, created_at desc);
create index orders_session_idx                 on public.orders (session_id);
create index orders_table_created_idx           on public.orders (table_id, created_at desc);
create index orders_cafe_created_id_idx         on public.orders (cafe_id, created_at desc, id desc);
create index order_items_order_idx              on public.order_items (order_id);
create index order_items_product_idx            on public.order_items (product_id);
create index waiter_calls_cafe_status_idx       on public.waiter_calls (cafe_id, status);
create index waiter_calls_table_handled_idx     on public.waiter_calls (table_id, handled_at desc);
create index products_cafe_category_pos_idx     on public.products (cafe_id, category_id, position);
create index products_category_idx              on public.products (category_id, cafe_id);
create index categories_cafe_pos_idx            on public.categories (cafe_id, position);
-- cafe_tables (qr_token) : unique
create unique index cafe_tables_qr_token_key    on public.cafe_tables (qr_token);
create index staff_members_cafe_idx             on public.staff_members (cafe_id);
create index cafe_followers_cafe_optin_idx      on public.cafe_followers (cafe_id, notifications_opt_in);
create index cafe_followers_cafe_created_idx    on public.cafe_followers (cafe_id, created_at desc, customer_id);
create index table_sessions_table_idx           on public.table_sessions (table_id, cafe_id);
create index announcements_cafe_status_idx      on public.announcements (cafe_id, status, sending_started_at desc);
create index rate_limit_hits_key_created_idx    on public.rate_limit_hits (key, created_at);
create index rate_limit_hits_created_idx        on public.rate_limit_hits (created_at);

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------
create trigger cafes_set_updated_at          before update on public.cafes          for each row execute function public.set_updated_at();
create trigger staff_members_set_updated_at  before update on public.staff_members  for each row execute function public.set_updated_at();
create trigger cafe_tables_set_updated_at    before update on public.cafe_tables    for each row execute function public.set_updated_at();
create trigger categories_set_updated_at     before update on public.categories     for each row execute function public.set_updated_at();
create trigger products_set_updated_at       before update on public.products       for each row execute function public.set_updated_at();
create trigger orders_set_updated_at         before update on public.orders         for each row execute function public.set_updated_at();
create trigger customers_set_updated_at      before update on public.customers      for each row execute function public.set_updated_at();
create trigger announcements_set_updated_at  before update on public.announcements  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Inscription client : profil + abonnement.
-- Règles :
--  - customers : créé à l'inscription client (signup_type = 'customer'), confirmé ou non.
--  - cafe_followers : créé UNIQUEMENT quand l'email est confirmé. Donc à l'insertion
--    si le compte est déjà confirmé, sinon au moment de la confirmation.
--    Un email non confirmé ne peut donc jamais être abonné par un tiers.
--  - notifications_opt_in : vrai seulement si le client a coché explicitement
--    (métadonnée newsletter_opt_in = true). Sinon faux.
-- Les inscriptions d'employés ne créent jamais de ligne customers.
-- -----------------------------------------------------------------------------
create or replace function public.apply_customer_signup(
  p_user_id   uuid,
  p_email     text,
  p_meta      jsonb,
  p_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug     text;
  v_cafe_id  uuid;
  v_name     text;
  v_optin    boolean;
begin
  if coalesce(p_meta ->> 'signup_type', '') is distinct from 'customer' then
    return;
  end if;

  v_name := nullif(left(btrim(coalesce(p_meta ->> 'display_name', '')), 80), '');

  insert into public.customers (id, email, display_name)
  values (p_user_id, coalesce(p_email, ''), v_name)
  on conflict (id) do nothing;

  if not p_confirmed then
    return;
  end if;

  v_slug := lower(btrim(coalesce(p_meta ->> 'cafe_slug', '')));
  if v_slug = '' then
    return;
  end if;

  select c.id into v_cafe_id
  from public.cafes c
  where c.slug = v_slug and c.is_active;

  if v_cafe_id is null then
    return;
  end if;

  v_optin := coalesce((p_meta ->> 'newsletter_opt_in') = 'true', false);

  insert into public.cafe_followers (customer_id, cafe_id, notifications_opt_in)
  values (p_user_id, v_cafe_id, v_optin)
  on conflict (customer_id, cafe_id) do nothing;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_customer_signup(
    new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb), new.email_confirmed_at is not null
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Confirmation de l'email (premier passage à email_confirmed_at non null).
create or replace function public.handle_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.apply_customer_signup(
      new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb), true
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_confirmed();

revoke all on function public.apply_customer_signup(uuid, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.handle_auth_user_confirmed() from public, anon, authenticated;

-- Garder l'email du profil client synchronisé avec auth.users.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.customers set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

revoke all on function public.handle_new_auth_user()          from public, anon, authenticated;
revoke all on function public.handle_auth_user_email_change() from public, anon, authenticated;
revoke all on function public.set_updated_at()                from public, anon, authenticated;
-- generate_qr_token est utilisée comme valeur par défaut : l'insertion par un
-- manager l'évalue avec ses droits, il doit donc pouvoir l'exécuter.
revoke all on function public.generate_qr_token() from public, anon;
grant execute on function public.generate_qr_token() to authenticated, service_role;
