-- ONOMO Support IT — invoke the secure SLA e-mail function every five minutes.
-- The scheduler secret lives in Supabase Vault, never in this repository.

begin;

create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'onomo_project_url') then
    perform vault.create_secret('https://aljnwqrjplqvehctsdqj.supabase.co', 'onomo_project_url');
  end if;
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'onomo-sla-escalation-email';

select cron.schedule(
  'onomo-sla-escalation-email',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'onomo_project_url') || '/functions/v1/sla-escalation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-onomo-sla-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'onomo_sla_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);

commit;
