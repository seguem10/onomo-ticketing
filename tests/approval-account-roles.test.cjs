const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('approval roles expose only their selected hotel scope',()=>{
 const fn=html.slice(html.indexOf('function userHotels(u){'),html.indexOf('// Peut créer / modifier'));
 const ctx={HOTELS:[{nom:'Airport'},{nom:'Sidi Maarouf'}]};vm.createContext(ctx);vm.runInContext(fn,ctx);
 assert.deepEqual(Array.from(ctx.userHotels({role:'directeur_hotel',hotel:'Airport'})),['Airport']);
 assert.deepEqual(Array.from(ctx.userHotels({role:'rh_regional',hotels:['Sidi Maarouf']})),['Sidi Maarouf']);
 assert.deepEqual(Array.from(ctx.userHotels({role:'rh_regional'})),[]);
});
test('role picker uses single hotel for director and multiple for regional HR',()=>{
 const fn=html.slice(html.indexOf('function onRoleChange(v){'),html.indexOf('function openModalUser(){'));
 const nodes=Object.fromEntries(['uHotelWrap','uHotelSingle','uHotelMulti','uRoleDesc'].map(id=>[id,{style:{},querySelector:()=>({})}]));
 const ctx={document:{getElementById:id=>nodes[id]},ROLE_L:{},ROLE_DESC:{},populateHotelCheckboxes:()=>{}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);
 ctx.onRoleChange('directeur_hotel');assert.equal(nodes.uHotelSingle.style.display,'block');assert.equal(nodes.uHotelMulti.style.display,'none');
 ctx.onRoleChange('rh_regional');assert.equal(nodes.uHotelMulti.style.display,'block');assert.equal(nodes.uHotelSingle.style.display,'none');
});
