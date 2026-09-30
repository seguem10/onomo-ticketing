-- ONOMO Support IT — review workflow for locally managed diagnostic guides.
-- Run after p21_ai_it_assistant.sql. Existing approved procedures remain
-- approved. Review templates are visible only in the applicable hotel scope.

begin;

alter table public.it_procedures
  add column if not exists approval_status text not null default 'draft'
  check (approval_status in ('draft','review','approved')),
  add column if not exists language text not null default 'fr'
  check (language in ('fr','en','ar'));

update public.it_procedures
set approval_status=case when is_validated then 'approved' else 'draft' end
where approval_status='draft';

create index if not exists it_procedures_status_domain_language_idx
  on public.it_procedures(approval_status,domain,language,effective_date desc);

drop policy if exists it_procedures_read_validated on public.it_procedures;
create policy it_procedures_read_published_or_review on public.it_procedures
  for select to authenticated using (
    (approval_status in ('approved','review') or is_validated)
    and (hotel is null or public.user_has_hotel_scope(hotel))
  );

insert into public.it_procedures
  (title,domain,content,source_label,effective_date,hotel,is_validated,approval_status,language)
select
  'Modèle ONOMO — diagnostic réseau initial',
  'network',
  'Modèle de diagnostic : qualifier le périmètre, relever le message exact, tester depuis un autre poste et escalader sans redémarrer d’équipement réseau. Ne pas partager d’identifiants ni de données clients.',
  'Modèle initial ONOMO — validation IT requise',
  current_date,
  null,
  false,
  'review',
  'fr'
where not exists (
  select 1 from public.it_procedures
  where title='Modèle ONOMO — diagnostic réseau initial'
    and source_label='Modèle initial ONOMO — validation IT requise'
);

commit;
