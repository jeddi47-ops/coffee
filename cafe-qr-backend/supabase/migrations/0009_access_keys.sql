-- Café QR : inventaire des clés d'accès et comptes administrateurs plateforme.
-- Les écritures passent exclusivement par les Edge Functions service_role.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.access_keys (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  code_suffix text not null check (char_length(code_suffix) = 8),
  plan text not null check (plan in ('monthly', 'annual')),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.platform_admins(user_id),
  activated_at timestamptz,
  redeemed_cafe_id uuid references public.cafes(id) on delete restrict,
  constraint access_keys_activation_pair check (
    (activated_at is null and redeemed_cafe_id is null)
    or (activated_at is not null and redeemed_cafe_id is not null)
  )
);

create index access_keys_batch_idx on public.access_keys(batch_id);
create index access_keys_created_idx on public.access_keys(created_at desc);
create index access_keys_activated_idx on public.access_keys(activated_at desc) where activated_at is not null;
create index access_keys_redeemed_cafe_idx on public.access_keys(redeemed_cafe_id);

-- Chaque café peut conserver son historique d'accès. NULL = ancien café non soumis
-- au nouveau système jusqu'à migration/activation explicite.
alter table public.cafes
  add column access_until timestamptz,
  add column access_plan text check (access_plan is null or access_plan in ('monthly', 'annual'));

alter table public.platform_admins enable row level security;
alter table public.access_keys enable row level security;
revoke all on public.platform_admins, public.access_keys from anon, authenticated;
