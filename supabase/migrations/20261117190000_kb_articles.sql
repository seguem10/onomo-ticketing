-- Knowledge base: short how-to articles written by the IT team. Everyone
-- signed in (MFA rules apply) reads published articles, in their own page and
-- as suggestions while creating a ticket. Technicians (ticket:update:all) and
-- administrators write, publish and delete them, and also see drafts.
begin;

create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 150),
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  category text not null default 'Général' check (char_length(btrim(category)) between 1 and 60),
  published boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kb_articles enable row level security;
revoke all on public.kb_articles from anon, authenticated;
grant select, delete on public.kb_articles to authenticated;
grant insert (title, body, category, published) on public.kb_articles to authenticated;
grant update (title, body, category, published) on public.kb_articles to authenticated;

drop policy if exists kb_articles_read on public.kb_articles;
create policy kb_articles_read on public.kb_articles for select to authenticated
  using ((select private.mfa_access_ok())
         and (published or (select public.has_permission('ticket:update:all'))));

drop policy if exists kb_articles_insert on public.kb_articles;
create policy kb_articles_insert on public.kb_articles for insert to authenticated
  with check ((select public.has_permission('ticket:update:all'))
              and created_by = (select auth.uid()));

drop policy if exists kb_articles_update on public.kb_articles;
create policy kb_articles_update on public.kb_articles for update to authenticated
  using ((select public.has_permission('ticket:update:all')))
  with check ((select public.has_permission('ticket:update:all')));

drop policy if exists kb_articles_delete on public.kb_articles;
create policy kb_articles_delete on public.kb_articles for delete to authenticated
  using ((select public.has_permission('ticket:update:all')));

-- Record who changed an article last; the client cannot set these columns.
create or replace function public.kb_articles_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists kb_articles_touch on public.kb_articles;
create trigger kb_articles_touch before update on public.kb_articles
  for each row execute function public.kb_articles_touch();

-- Starter articles, saved as drafts: the IT team reviews and publishes them.
insert into public.kb_articles (title, category, published, created_by, updated_by, body)
select v.title, v.category, false, null, null, v.body
from (values
  ('Le Wi-Fi ne fonctionne pas sur mon poste', 'Réseau',
   E'1. Vérifiez que le Wi-Fi de l''ordinateur est activé (icône en bas à droite).\n2. Oubliez le réseau puis reconnectez-vous avec le bon mot de passe.\n3. Redémarrez l''ordinateur.\n4. Si plusieurs collègues sont touchés, créez un ticket en priorité Haute en précisant la zone de l''hôtel.'),
  ('L''imprimante n''imprime plus', 'Matériel',
   E'1. Vérifiez que l''imprimante est allumée, sans erreur sur l''écran, avec du papier et du toner.\n2. Éteignez-la 30 secondes puis rallumez-la.\n3. Sur le poste, ouvrez la file d''impression et supprimez les documents bloqués.\n4. Toujours bloqué : créez un ticket avec le nom de l''imprimante et le message affiché.'),
  ('J''ai oublié mon mot de passe', 'Accès',
   E'Pour des raisons de sécurité, seule l''équipe IT peut réinitialiser un mot de passe.\nCréez un ticket (catégorie Accès) en indiquant l''application concernée. Ne communiquez jamais votre mot de passe par e-mail ou par téléphone.'),
  ('Mon ordinateur est très lent', 'Matériel',
   E'1. Enregistrez votre travail et redémarrez l''ordinateur (un redémarrage complet, pas une mise en veille).\n2. Fermez les onglets et applications inutiles.\n3. Laissez les mises à jour Windows se terminer.\n4. Si la lenteur continue, créez un ticket en indiquant depuis quand et dans quelle application.'),
  ('Je ne reçois plus mes e-mails', 'Messagerie',
   E'1. Vérifiez votre connexion Internet en ouvrant un site web.\n2. Regardez le dossier Courrier indésirable.\n3. Fermez puis rouvrez Outlook, ou essayez sur https://outlook.office.com.\n4. Si le problème persiste, créez un ticket avec l''adresse de l''expéditeur et l''heure d''envoi.')
) as v(title, category, body)
where not exists (select 1 from public.kb_articles);

commit;
