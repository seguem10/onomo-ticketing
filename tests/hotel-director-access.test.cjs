const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const features=fs.readFileSync('assets/js/modern-features.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/20261116170000_hotel_director_reads_hotel_tickets.sql','utf8');

test('hotel directors get the dashboard and reports in the interface',()=>{
  assert.match(features,/const POWER=\[[^\]]*'Directeur Hôtel'[^\]]*\];/);
  assert.match(features,/directeur_hotel:'Directeur Hôtel'/);
  assert.match(features,/\{name:'Directeur Hôtel',permissions:\[[^\]]*'ticket:read:all'[^\]]*'report:read'[^\]]*\]/);
});

test('hotel directors are not given admin-only pages',()=>{
  // Users, hotels and settings stay restricted to administrators/support.
  assert.match(features,/const adminOnly=\['hotels-admin','settings'\]/);
  assert.match(features,/\['Administrateur','IT Regional','IT Hotel'\]\.includes\(role\)/);
});

test('"My tickets" lists the tickets a hotel director created',()=>{
  const fn=html.match(/function isRequesterUser\([^)]*\)\{[^}]*\}/)[0];
  const isRequesterUser=new Function(`${fn};return isRequesterUser;`)();
  assert.equal(isRequesterUser({role:'directeur_hotel'}),true);
  assert.equal(isRequesterUser({role:'demandeur'}),true);
  assert.equal(isRequesterUser({role:'it_hotel'}),false);
});

test('database grant only adds hotel-scoped read and reports to Directeur Hôtel',()=>{
  assert.match(migration,/where name = 'Directeur Hôtel'/);
  assert.match(migration,/\["ticket:read:all","report:read"\]/);
  assert.doesNotMatch(migration,/ticket:update|\*|delete/i);
});
