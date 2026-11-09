-- follow_cafe : crée la fiche client si elle manque (compte déjà existant sans ligne customers).
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
  if v_uid is null then
    perform public.api_error(401, 'not_authenticated', 'Connexion requise.');
  end if;

  if exists (select 1 from public.staff_members sm where sm.id = v_uid) then
    perform public.api_error(403, 'staff_account', 'Un compte employé ne peut pas suivre un café.');
  end if;

  insert into public.customers (id, email)
  select u.id, coalesce(u.email, '')
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null
  on conflict (id) do nothing;

  if not exists (select 1 from public.customers c where c.id = v_uid) then
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
