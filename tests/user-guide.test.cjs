const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('the user guide adds eight published bilingual articles without credentials',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261127090000_kb_user_guide.sql','utf8');
  const rows=sql.match(/^  \('Guide/gm)||[];
  assert.equal(rows.length,8);
  assert.ok(sql.includes("select v.title, v.title_en, 'Guide', true, null, null, v.body, v.body_en"));
  assert.ok(sql.includes('where not exists (select 1 from public.kb_articles k where k.title = v.title);'),'running it twice adds nothing');
  assert.ok(!/(mot de passe|password)\s*[:=]/i.test(sql));
  for(const role of ['première connexion','créer un ticket','suivre mon ticket','Assistant IT','Guide IT : traiter','inventaire et maintenance','Guide direction','Guide administrateur'])assert.ok(sql.includes(role),role);
});

test('the Guide category is translated',()=>{
  const kb=fs.readFileSync('assets/js/knowledge-base.js','utf8');
  assert.ok(kb.includes("'guide':'Guide'")&&kb.includes("'guide':'دليل'"));
});
