-- =============================================================================
-- Café QR : 0008_push_subscriptions.sql
-- Alertes push du personnel (Web Push) : une ligne par téléphone abonné.
-- Aucun accès direct : les employés passent par les 2 fonctions ci-dessous,
-- l'envoi des notifications se fait avec service_role (Edge Functions).
-- =============================================================================

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  cafe_id       uuid not null references public.cafes (id) on delete cascade,
  staff_id      uuid not null references public.staff_members (id) on delete cascade,
  endpoint      text not null check (char_length(endpoint) between 20 and 2000),
  p256dh        text not null check (char_length(p256dh) between 20 and 300),
  auth_key      text not null check (char_length(auth_key) between 8 and 100),
  user_agent    text check (user_agent is null or char_length(user_agent) <= 300),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index push_subscriptions_cafe_idx  on public.push_subscriptions (cafe_id);
create index push_subscriptions_staff_idx on public.push_subscriptions (staff_id);

-- RLS activée, aucune policy : fermé pour anon et authenticated.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Enregistre (ou reprend) l'abonnement push d'un téléphone pour l'employé connecté.
-- Si le téléphone était déjà abonné pour un autre employé, il est repris.
create or replace function public.staff_register_push(
  p_endpoint   text,
  p_p256dh     text,
  p_auth_key   text,
  p_user_agent text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cafe_id uuid := public.assert_staff(array['owner', 'manager', 'waiter']::public.staff_role[]);
begin
  insert into public.push_subscriptions (cafe_id, staff_id, endpoint, p256dh, auth_key, user_agent)
  values (v_cafe_id, (select auth.uid()), p_endpoint, p_p256dh, p_auth_key, left(p_user_agent, 300))
  on conflict (endpoint) do update set
    cafe_id      = excluded.cafe_id,
    staff_id     = excluded.staff_id,
    p256dh       = excluded.p256dh,
    auth_key     = excluded.auth_key,
    user_agent   = excluded.user_agent,
    last_seen_at = now();
end;
$$;

-- Retire l'abonnement d'un téléphone (uniquement le sien).
create or replace function public.staff_unregister_push(p_endpoint text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_staff(array['owner', 'manager', 'waiter']::public.staff_role[]);
  delete from public.push_subscriptions
  where endpoint = p_endpoint and staff_id = (select auth.uid());
end;
$$;

revoke all on function public.staff_register_push(text, text, text, text) from public, anon, authenticated;
revoke all on function public.staff_unregister_push(text)                  from public, anon, authenticated;
grant execute on function public.staff_register_push(text, text, text, text) to authenticated;
grant execute on function public.staff_unregister_push(text)                  to authenticated;
