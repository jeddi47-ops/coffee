-- Only an expired cafe owner may read their staff identity and cafe expiry metadata.
-- SECURITY DEFINER avoids recursive RLS policy evaluation across cafes/staff_members.
create or replace function public.is_expired_cafe_owner(p_cafe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members sm
    join public.cafes c on c.id = sm.cafe_id
    where sm.cafe_id = p_cafe_id
      and sm.id = (select auth.uid())
      and sm.role = 'owner'
      and sm.is_active
      and c.is_active
      and c.access_until is not null
      and c.access_until <= now()
  );
$$;
revoke all on function public.is_expired_cafe_owner(uuid) from public, anon;
grant execute on function public.is_expired_cafe_owner(uuid) to authenticated, service_role;

create policy cafes_expired_owner_select on public.cafes
  for select to authenticated
  using (public.is_expired_cafe_owner(id));

create policy staff_members_expired_owner_select on public.staff_members
  for select to authenticated
  using (id = (select auth.uid()) and public.is_expired_cafe_owner(cafe_id));
