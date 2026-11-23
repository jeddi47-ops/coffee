-- Run after deploying loyalty-reminders and configuring matching Edge/Vault secrets.
-- pg_cron and pg_net must be enabled in this environment.
do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='loyalty_cron_secret')
 or not exists(select 1 from vault.decrypted_secrets where name='loyalty_project_url') then
   raise exception 'Configure loyalty_cron_secret and loyalty_project_url in Vault first';
 end if;
end $$;
select cron.schedule('loyalty-reminders', '0 12 * * *', $job$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='loyalty_project_url') || '/functions/v1/loyalty-reminders',
   headers := jsonb_build_object('Content-Type','application/json','x-loyalty-secret',
     (select decrypted_secret from vault.decrypted_secrets where name='loyalty_cron_secret')),
   body := '{}'::jsonb,
   timeout_milliseconds := 10000
 );
$job$);
