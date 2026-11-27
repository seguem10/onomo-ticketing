const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const assistant=fs.readFileSync('assets/js/it-assistant.js','utf8');
const fn=fs.readFileSync('supabase/functions/ai-it-assistant/index.ts','utf8');
const html=fs.readFileSync('index.html','utf8');

test('the assistant shows related knowledge base articles, from the server and from the page',()=>{
  assert.ok(assistant.includes("kb?.related?.(answer.kb_query||"));
  assert.ok(assistant.includes('onclick="window.KnowledgeBase?.open(this.dataset.kbId)"'));
  assert.ok(assistant.includes('data-kb-id="${esc(article.id)}"'),'article ids are escaped');
  assert.ok(assistant.includes('kb_articles:result.kb_articles||[],kb_query:message'));
  assert.ok(assistant.includes('await Promise.race([window.KnowledgeBase?.load?.(),'),'loading articles never blocks the assistant');
  assert.ok(assistant.includes('${shortAnswerHtml(answer)}${kbHtml}<details class="assistant-details">'),'short answer, then the articles, then the folded diagnosis');
});

test('the server reads published articles with the caller’s rights and gives them to the model',()=>{
  assert.ok(fn.includes("userClient.from('kb_articles').select('id,title,title_en,body,body_en,category').eq('published',true)"));
  assert.ok(fn.includes('Fiches de la base de connaissances ONOMO'));
  assert.ok(fn.includes(".split(/[^a-z0-9]+/).filter(word=>word.length>=2)"),'search terms are reduced to letters and digits before the filter');
  assert.equal((fn.match(/kb_articles:kbForClient/g)||[]).length,8,"every answer path, with or without AI, returns the articles");
});

test('the knowledge base migrations add English versions and twenty new draft articles',()=>{
  const schema=fs.readFileSync('supabase/migrations/20261126090000_kb_bilingual.sql','utf8');
  assert.ok(schema.includes('grant update (title_en, body_en) on public.kb_articles to authenticated;'));
  const content=fs.readFileSync('supabase/migrations/20261126091000_kb_articles_bilingual_content.sql','utf8');
  const rows=content.match(/^  \('/gm)||[];
  assert.equal(rows.length,20);
  assert.ok(content.includes("select v.title, v.title_en, v.category, false, null, null, v.body, v.body_en"),'new articles are drafts');
  assert.equal((content.match(/and title_en is null;/g)||[]).length,5,'the five starter articles get an English version');
  assert.ok(!/mot de passe\s*[:=]|password\s*[:=]/i.test(content),'no credential in the articles');
  assert.ok(html.includes('assets/js/it-assistant.js?v=20261127-short-1'));
});

test('a cut or unreadable AI answer is replaced by an article or the domain guide, never by the empty generic text',()=>{
  const fn=fs.readFileSync('supabase/functions/ai-it-assistant/index.ts','utf8');
  assert.equal((fn.match(/maxOutputTokens:8192/g)||[]).length,2,'room for thinking tokens and the full JSON');
  assert.ok(!fn.includes('maxOutputTokens:2200'));
  assert.ok(fn.includes("const safe={invalid:true,"));
  assert.ok(fn.includes('const unreadable=!providerUnavailable&&answer?.invalid===true;'));
  assert.ok(fn.includes("answer=topArticle?kbAnswer(topArticle):procedureGuide("));
  assert.ok(fn.includes("console.error('AI answer unreadable'"),'the stop reason is logged for diagnosis');
});
