-- Keep only the owner's identity and expiry metadata readable after expiry,
-- so the owner can reach the renewal screen. Business data remains blocked by the helpers.
create policy cafes_expired_owner_select on public.cafes
  for select to authenticated
  using (
    access_until is not null
    and access_until <= now()
    and is_active
    and exists (
      select 1 from public.staff_members sm
      where sm.cafe_id = cafes.id
        and sm.id = (select auth.uid())
        and sm.role = 'owner'
        and sm.is_active
    )
  );

create policy staff_members_expired_owner_select on public.staff_members
  for select to authenticated
  using (
    id = (select auth.uid())
    and role = 'owner'
    and is_active
    and exists (
      select 1 from public.cafes c
      where c.id = staff_members.cafe_id
        and c.is_active
        and c.access_until is not null
        and c.access_until <= now()
    )
  );
