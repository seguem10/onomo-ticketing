const test=require('node:test'),assert=require('node:assert/strict');
const roster=import('../supabase/functions/admin-import-it-roster/roster.mjs');
test('confirmed roster has eleven unique emails and ten hotel IT accounts',async()=>{
 const {ROSTER,accountBody}=await roster;
 assert.equal(ROSTER.length,11);assert.equal(new Set(ROSTER.map(r=>r.email)).size,11);
 const bodies=ROSTER.map(r=>accountBody(r,'temporary-placeholder'));
 assert.equal(bodies.filter(r=>r.role==='it_hotel').length,10);
 assert.equal(bodies.some(r=>r.roles.includes('admin')),false);
 assert.equal(bodies.find(r=>r.email==='it.massira@onomohotel.com').hotel,'CASA CITY CENTER');
});
test('Martial is regional with exactly the two confirmed Abidjan hotels',async()=>{
 const {ROSTER,accountBody}=await roster;const body=accountBody(ROSTER.find(r=>r.email==='it.abidjan@onomohotel.com'),'temporary-placeholder');
 assert.equal(body.role,'it_regional');assert.equal(body.hotel,null);
 assert.deepEqual(body.hotels,['ONOMO Allure Abidjan Baobab','ONOMO Hotel Abidjan Airport']);
});
