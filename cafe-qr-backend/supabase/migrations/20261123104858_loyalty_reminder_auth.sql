create extension if not exists pg_net with schema extensions;
create or replace function public.loyalty_cron_authorized(p_secret text)
returns boolean language sql security definer set search_path='' as $$
select p_secret is not null and length(p_secret)>=32 and exists(select 1 from vault.decrypted_secrets where name='loyalty_cron_secret' and decrypted_secret=p_secret);
$$;
revoke all on function public.loyalty_cron_authorized(text) from public,anon,authenticated;
grant execute on function public.loyalty_cron_authorized(text) to service_role;
do $$ begin
if not exists(select 1 from vault.secrets where name='loyalty_cron_secret') then perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'loyalty_cron_secret'); end if;
if not exists(select 1 from vault.secrets where name='loyalty_project_url') then perform vault.create_secret('https://zpsxnhrufqkrswqphsjx.supabase.co','loyalty_project_url'); end if;
end $$;
