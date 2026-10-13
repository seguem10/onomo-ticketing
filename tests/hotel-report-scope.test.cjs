const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const helpers=html.slice(html.indexOf('function userHotels(u)'),html.indexOf('function canManageTickets(u)'));
test('hotel report scope is single for local IT, assigned list for regional and all for admin',()=>{
 const context={HOTELS:[{nom:'Square'},{nom:'Abidjan'},{nom:'Maputo'}],currentUser:{role:'it_hotel',hotel:'Square'}};vm.createContext(context);vm.runInContext(helpers,context);
 assert.equal(JSON.stringify(context.scopedHotelRows()),JSON.stringify([{nom:'Square'}]));
 assert.equal(context.scopedTicketRows([{hotel:'Maputo'},{hotel:'Square'}]).length,1);
 context.currentUser={role:'it_regional',hotels:['Abidjan','Maputo']};assert.equal(context.scopedHotelRows().length,2);
 context.currentUser={role:'admin'};assert.equal(context.scopedHotelRows().length,3);
 context.currentUser=null;assert.equal(context.scopedHotelRows().length,0);
});
