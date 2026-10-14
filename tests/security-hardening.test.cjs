const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('production ticket/message saves purge legacy cache instead of persisting sensitive content',()=>{
 const writes=[];const removals=[];const ctx={settings:{sbUrl:'https://example.supabase.co',sbKey:'public'},localStorage:{setItem:(...v)=>writes.push(v),removeItem:k=>removals.push(k)}};vm.createContext(ctx);
 for(const name of ['saveTickets','saveCommentaires']){const line=html.split('\n').find(l=>l.startsWith('function '+name+'('));vm.runInContext(line,ctx);ctx[name]([{private:'content'}]);}
 assert.equal(writes.length,0);assert.deepEqual(removals,['dh_tickets','dh_comments']);
 ctx.settings={};ctx.saveTickets([]);assert.equal(writes.length,1);
});
test('hotel export handlers never interpolate hotel values into executable inline JavaScript',()=>{
 assert.equal(html.includes("exportPDF('hotel','${sel}')"),false);
 assert.ok(html.includes('data-report-hotel="${esc(sel)}"'));
 assert.ok(html.includes("exportPDF('hotel',this.dataset.reportHotel)"));
});
