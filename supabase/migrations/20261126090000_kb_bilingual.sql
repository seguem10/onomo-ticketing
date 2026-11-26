-- Knowledge base in French and English: every article keeps its French title
-- and text, and may carry an English version shown when the app is in
-- English. Search covers both languages.
begin;

alter table public.kb_articles
  add column if not exists title_en text,
  add column if not exists body_en text;

alter table public.kb_articles drop constraint if exists kb_articles_title_en_check;
alter table public.kb_articles add constraint kb_articles_title_en_check
  check (title_en is null or char_length(btrim(title_en)) between 3 and 150);
alter table public.kb_articles drop constraint if exists kb_articles_body_en_check;
alter table public.kb_articles add constraint kb_articles_body_en_check
  check (body_en is null or char_length(btrim(body_en)) between 1 and 8000);

grant insert (title_en, body_en) on public.kb_articles to authenticated;
grant update (title_en, body_en) on public.kb_articles to authenticated;

commit;
