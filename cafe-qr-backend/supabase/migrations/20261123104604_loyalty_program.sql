-- Loyalty balances are changed only by authenticated, audited transactions.
create table public.loyalty_programs (
 cafe_id uuid primary key references public.cafes on delete cascade,
 enabled boolean not null default false,
 rule text not null default '' check(length(rule)<=1000),
 reward text not null default '' check(length(reward)<=200),
 color text not null default '#b9842d' check(color ~ '^#[0-9a-fA-F]{6}$'),
 logo_path text check(logo_path is null or logo_path like cafe_id::text||'/logo/%'),
 target integer not null default 10 check(target between 2 and 100),
 cooldown_minutes integer not null default 60 check(cooldown_minutes between 1 and 10080),
 reminder_days integer not null default 14 check(reminder_days between 1 and 365),
 check(not enabled or (length(trim(rule))>0 and length(trim(reward))>0))
);
create table public.loyalty_identities (
 customer_id uuid primary key references public.customers(id) on delete cascade,
 token text not null unique default public.generate_qr_token()
);
create table public.loyalty_cards (
 id uuid primary key default gen_random_uuid(),
 cafe_id uuid not null references public.cafes on delete cascade,
 customer_id uuid not null references public.customers on delete cascade,
 stamps integer not null default 0 check(stamps between 0 and 100000),
 last_visit_at timestamptz,
 reminded_at timestamptz,
 unique(cafe_id,customer_id)
);
create index loyalty_cards_customer_idx on public.loyalty_cards(customer_id);
create table public.loyalty_events (
 id uuid primary key default gen_random_uuid(),
 card_id uuid not null references public.loyalty_cards on delete cascade,
 actor_id uuid references auth.users on delete set null,
 actor_name text not null,
 kind text not null check(kind in ('scan','reward','adjust')),
 delta integer not null,
 balance integer not null,
 note text not null default '' check(length(note)<=300),
 request_id uuid not null unique,
 created_at timestamptz not null default now()
);
create index loyalty_events_card_idx on public.loyalty_events(card_id,created_at desc);
alter table public.loyalty_programs enable row level security;
alter table public.loyalty_identities enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.loyalty_events enable row level security;
revoke all on public.loyalty_programs,public.loyalty_identities,public.loyalty_cards,public.loyalty_events from anon,authenticated;
grant select,insert,update on public.loyalty_programs to authenticated;
create policy loyalty_program_owner on public.loyalty_programs for all to authenticated
 using(cafe_id=(select public.current_staff_cafe_id()) and (select public.current_staff_role())='owner')
 with check(cafe_id=(select public.current_staff_cafe_id()) and (select public.current_staff_role())='owner');

create function public.loyalty_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null or not exists(select 1 from public.customers where id=u) then perform public.api_error(403,'not_a_customer','Compte client requis.'); end if;
 insert into public.loyalty_identities(customer_id) values(u) on conflict do nothing;
 select jsonb_build_object('token',(select token from public.loyalty_identities where customer_id=u),'cards',coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'name',f.name,'stamps',c.stamps,'target',p.target,'reward',p.reward,'rule',p.rule,'color',p.color,'logo_path',coalesce(p.logo_path,f.logo_path),'enabled',p.enabled) order by f.name) filter(where c.id is not null),'[]'::jsonb)) into result
 from public.loyalty_cards c join public.cafes f on f.id=c.cafe_id join public.loyalty_programs p on p.cafe_id=c.cafe_id where c.customer_id=u;
 return result;
end $$;

create function public.loyalty_owner_cards() returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.assert_staff(array['owner']::public.staff_role[]);
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'customer_name',coalesce(nullif(u.display_name,''),u.email),'stamps',c.stamps,'last_visit_at',c.last_visit_at,
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select kind,delta,balance,note,actor_name,created_at from public.loyalty_events where card_id=c.id order by created_at desc limit 50)e),'[]'::jsonb)) order by c.last_visit_at desc nulls last)
 from public.loyalty_cards c join public.customers u on u.id=c.customer_id where c.cafe_id=cid),'[]'::jsonb);
end $$;

create function public.loyalty_action(p_action text,p_request_id uuid,p_token text default null,p_card_id uuid default null,p_delta integer default 0,p_note text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.assert_staff(array['owner','manager','waiter']::public.staff_role[]); u uuid; c public.loyalty_cards; p public.loyalty_programs; d integer; ev public.loyalty_events;
begin
 if p_request_id is null or p_action is null or p_action not in ('scan','reward','adjust') then perform public.api_error(400,'validation_error','Action invalide.'); end if;
 select * into p from public.loyalty_programs where cafe_id=cid for share;
 if not found or not p.enabled then perform public.api_error(409,'loyalty_disabled','Fidélité désactivée.'); end if;
 if p_action='adjust' then
  if public.current_staff_role()<>'owner' then perform public.api_error(403,'forbidden_role','Patron uniquement.'); end if;
  if p_delta is null or p_delta=0 or abs(p_delta)>100 or length(trim(coalesce(p_note,'')))=0 then perform public.api_error(400,'validation_error','Indiquez un motif et entre 1 et 100 tampons.'); end if;
  select * into c from public.loyalty_cards where id=p_card_id and cafe_id=cid for update;
 else
  select customer_id into u from public.loyalty_identities where token=p_token;
  if u is null then perform public.api_error(404,'loyalty_qr_invalid','QR client invalide.'); end if;
  insert into public.loyalty_cards(cafe_id,customer_id) values(cid,u) on conflict do nothing;
  select * into c from public.loyalty_cards where cafe_id=cid and customer_id=u for update;
 end if;
 if c.id is null then perform public.api_error(404,'loyalty_qr_invalid','Carte introuvable.'); end if;
 select * into ev from public.loyalty_events where request_id=p_request_id;
 if found then
  if ev.card_id<>c.id or ev.actor_id<>auth.uid() or ev.kind<>p_action then perform public.api_error(409,'validation_error','Requête déjà utilisée.'); end if;
 else
  if p_action='scan' then
   if c.last_visit_at is not null and c.last_visit_at+make_interval(mins=>p.cooldown_minutes)>now() then perform public.api_error(429,'loyalty_cooldown','Tampon déjà ajouté récemment.',ceil(extract(epoch from c.last_visit_at+make_interval(mins=>p.cooldown_minutes)-now()))::text); end if;
   d:=1;
  elsif p_action='reward' then
   if c.stamps<p.target then perform public.api_error(409,'loyalty_reward_unavailable','Pas assez de tampons.'); end if;
   d:=-p.target;
  else d:=p_delta;
  end if;
  if c.stamps+d<0 or c.stamps+d>100000 then perform public.api_error(400,'validation_error','Solde invalide.'); end if;
  update public.loyalty_cards set stamps=stamps+d,last_visit_at=case when p_action='scan' then now() else last_visit_at end,reminded_at=case when p_action='scan' then null else reminded_at end where id=c.id returning * into c;
  insert into public.loyalty_events(card_id,actor_id,actor_name,kind,delta,balance,note,request_id)
  select c.id,auth.uid(),display_name,p_action,d,c.stamps,coalesce(p_note,''),p_request_id from public.staff_members where id=auth.uid();
 end if;
 return jsonb_build_object('id',c.id,'stamps',c.stamps,'target',p.target,'reward',p.reward,'rule',p.rule,'customer_name',(select coalesce(nullif(display_name,''),'Client') from public.customers where id=c.customer_id));
end $$;
revoke all on function public.loyalty_account(),public.loyalty_owner_cards(),public.loyalty_action(text,uuid,text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.loyalty_account(),public.loyalty_owner_cards(),public.loyalty_action(text,uuid,text,uuid,integer,text) to authenticated;

create table public.loyalty_push (
 customer_id uuid not null references public.customers on delete cascade,
 endpoint text primary key check(length(endpoint) between 20 and 2000 and endpoint like 'https://%'),
 p256dh text not null check(length(p256dh) between 20 and 300),
 auth_key text not null check(length(auth_key) between 8 and 100)
);
create index loyalty_push_customer_idx on public.loyalty_push(customer_id);
alter table public.loyalty_push enable row level security;
revoke all on public.loyalty_push from anon,authenticated;
create function public.loyalty_register_push(p_endpoint text,p_p256dh text,p_auth_key text,p_user_agent text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.customers where id=auth.uid()) then perform public.api_error(403,'not_a_customer','Compte client requis.'); end if;
 insert into public.loyalty_push values(auth.uid(),p_endpoint,p_p256dh,p_auth_key)
 on conflict(endpoint) do update set customer_id=excluded.customer_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key;
end $$;
create function public.loyalty_unregister_push(p_endpoint text) returns void language sql security definer set search_path='' as $$
 delete from public.loyalty_push where endpoint=p_endpoint and customer_id=auth.uid();
$$;
-- Claims are committed before sending: at most one attempt per absence, even after a timeout.
create function public.loyalty_claim_reminders() returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
 with due as (
 select c.id from public.loyalty_cards c join public.loyalty_programs p on p.cafe_id=c.cafe_id
 where p.enabled and public.is_cafe_active(c.cafe_id) and p.target-c.stamps between 1 and 2
 and c.reminded_at is null and c.last_visit_at<now()-make_interval(days=>p.reminder_days)
 and exists(select 1 from public.loyalty_push s where s.customer_id=c.customer_id)
 order by c.last_visit_at limit 100 for update of c skip locked
 ), claimed as(update public.loyalty_cards set reminded_at=now() where id in(select id from due) returning *)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',f.name,'remaining',p.target-c.stamps,'reward',p.reward,
 'subscriptions',(select jsonb_agg(to_jsonb(s)) from public.loyalty_push s where s.customer_id=c.customer_id))),'[]'::jsonb)
 into result from claimed c join public.cafes f on f.id=c.cafe_id join public.loyalty_programs p on p.cafe_id=c.cafe_id;
 return result;
end $$;
revoke all on function public.loyalty_register_push(text,text,text,text),public.loyalty_unregister_push(text),public.loyalty_claim_reminders() from public,anon,authenticated;
grant execute on function public.loyalty_register_push(text,text,text,text),public.loyalty_unregister_push(text) to authenticated;
grant execute on function public.loyalty_claim_reminders() to service_role;
grant all on public.loyalty_programs,public.loyalty_identities,public.loyalty_cards,public.loyalty_events,public.loyalty_push to service_role;

-- Read after a cooldown refusal so an earned reward can still be handed over.
create function public.loyalty_lookup(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.assert_staff(array['owner','manager','waiter']::public.staff_role[]);
begin
 return (select jsonb_build_object('id',c.id,'stamps',c.stamps,'target',p.target,'reward',p.reward,'rule',p.rule,'customer_name',coalesce(nullif(u.display_name,''),'Client'))
 from public.loyalty_identities i join public.loyalty_cards c on c.customer_id=i.customer_id join public.loyalty_programs p on p.cafe_id=c.cafe_id join public.customers u on u.id=c.customer_id
 where i.token=p_token and c.cafe_id=cid and p.enabled);
end $$;
revoke all on function public.loyalty_lookup(text) from public,anon,authenticated;
grant execute on function public.loyalty_lookup(text) to authenticated;
