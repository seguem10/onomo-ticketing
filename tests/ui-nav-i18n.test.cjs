const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const i18n=fs.readFileSync('assets/js/i18n.js','utf8');

test('mobile "New" button uses an existing Tabler icon',()=>{
  assert.doesNotMatch(html,/ti-plus-circle/);
  assert.match(html,/id="mbNewTicketBtn"[\s\S]{0,400}ti ti-circle-plus/);
});

test('switching page keeps the mobile bottom bar in sync',()=>{
  const start=html.indexOf('function switchView(v,el){');
  const body=html.slice(start,html.indexOf('\n}',start));
  assert.match(body,/updateMobileNav\(\)/);
});

test('settings category title is translated in every language',()=>{
  assert.match(i18n,/'Catégories de tickets':'ticket_categories'/);
  for(const value of ["ticket_categories:'Catégories de tickets'","ticket_categories:'Ticket categories'","ticket_categories:'فئات التذاكر'"])assert.ok(i18n.includes(value),value);
});

test('translation audit matches whole words only',()=>{
  const line=i18n.split('\n').find(l=>l.includes('const containsWord='));
  const containsWord=new Function(`${line.trim()};return containsWord;`)();
  assert.equal(containsWord('Administration','Admin'),false);
  assert.equal(containsWord('Administrator','Admin'),false);
  assert.equal(containsWord('Rôle : Admin','Admin'),true);
  assert.equal(containsWord('Catégories de tickets','Catégorie'),false);
  assert.equal(containsWord('Catégorie *','Catégorie'),true);
});
