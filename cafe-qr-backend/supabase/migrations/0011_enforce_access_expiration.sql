-- Une échéance coupe l'accès staff et le menu public, sans désactiver le café dans l'admin.
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
    and c.is_active
    and (c.access_until is null or c.access_until > now());
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
    and c.is_active
    and (c.access_until is null or c.access_until > now());
$$;

create or replace function public.is_cafe_active(p_cafe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.is_active and (c.access_until is null or c.access_until > now())
    from public.cafes c where c.id = p_cafe_id
  ), false);
$$;
