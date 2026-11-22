-- Activation atomique des clés et renouvellement des accès.
-- Toutes les mutations sont réservées au service_role via les Edge Functions.
create or replace function public.register_cafe_with_access_key(
  p_user_id uuid,
  p_cafe_name text,
  p_slug text,
  p_owner_name text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.access_keys%rowtype;
  v_cafe_id uuid;
  v_until timestamptz;
begin
  if p_user_id is null
    or char_length(btrim(coalesce(p_cafe_name, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_owner_name, ''))) not between 1 and 80
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(p_slug) not between 2 and 60
    or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_registration';
  end if;

  select * into v_key
  from public.access_keys
  where code_hash = p_code_hash
  for update;

  if not found or v_key.activated_at is not null then
    raise exception using errcode = 'P0001', message = 'invalid_or_used_key';
  end if;

  insert into public.cafes (name, slug, access_plan, access_until)
  values (
    btrim(p_cafe_name), p_slug, v_key.plan,
    now() + case when v_key.plan = 'monthly' then interval '1 month' else interval '1 year' end
  )
  returning id, access_until into v_cafe_id, v_until;

  insert into public.staff_members (id, cafe_id, role, display_name)
  values (p_user_id, v_cafe_id, 'owner', btrim(p_owner_name));

  insert into public.cafe_tables (cafe_id, label)
  values (v_cafe_id, 'Table 1'), (v_cafe_id, 'Table 2'), (v_cafe_id, 'Table 3');

  insert into public.categories (cafe_id, name, position)
  values (v_cafe_id, 'Boissons', 0), (v_cafe_id, 'Plats', 1), (v_cafe_id, 'Desserts', 2);

  update public.access_keys
  set activated_at = now(), redeemed_cafe_id = v_cafe_id
  where id = v_key.id;

  return jsonb_build_object('cafe_id', v_cafe_id, 'access_until', v_until, 'plan', v_key.plan);
end;
$$;

create or replace function public.renew_cafe_access_key(
  p_user_id uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.access_keys%rowtype;
  v_cafe_id uuid;
  v_until timestamptz;
begin
  if p_user_id is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_renewal';
  end if;

  select s.cafe_id into v_cafe_id
  from public.staff_members s
  where s.id = p_user_id and s.role = 'owner' and s.is_active
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'active_owner_required';
  end if;

  select * into v_key
  from public.access_keys
  where code_hash = p_code_hash
  for update;

  if not found or v_key.activated_at is not null then
    raise exception using errcode = 'P0001', message = 'invalid_or_used_key';
  end if;

  update public.cafes
  set access_until = greatest(coalesce(access_until, now()), now())
      + case when v_key.plan = 'monthly' then interval '1 month' else interval '1 year' end,
      access_plan = v_key.plan
  where id = v_cafe_id
  returning access_until into v_until;

  update public.access_keys
  set activated_at = now(), redeemed_cafe_id = v_cafe_id
  where id = v_key.id;

  return jsonb_build_object('cafe_id', v_cafe_id, 'access_until', v_until, 'plan', v_key.plan);
end;
$$;

revoke all on function public.register_cafe_with_access_key(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.renew_cafe_access_key(uuid, text) from public, anon, authenticated;
grant execute on function public.register_cafe_with_access_key(uuid, text, text, text, text) to service_role;
grant execute on function public.renew_cafe_access_key(uuid, text) to service_role;
