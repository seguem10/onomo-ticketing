const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');

test('kanban treats malicious ticket IDs and text as data, never handler code',()=>{
 const ctx={STAT_L:{nouveau:'New'},pBadge:()=>'',slaHTML:()=>''};vm.createContext(ctx);
 vm.runInContext(html.split('\n').find(l=>l.startsWith('function esc(')),ctx);
 const start=html.indexOf('function renderKanban(list){');
 vm.runInContext(html.slice(start,html.indexOf('\n}\n',start)+3),ctx);
 const id="x');alert(1);//\"";
 const rendered=ctx.renderKanban([{id,statut:'nouveau',titre:'<img src=x onerror=alert(1)>',numero:'<script>',hotel:'<svg>'}]);
 assert.ok(rendered.includes('data-ticket-id="'+ctx.esc(id)+'"'));
 assert.ok(rendered.includes('onclick="openDetail(this.dataset.ticketId)"'));
 assert.equal(rendered.includes("onclick=\"openDetail('"),false);
 assert.equal(rendered.includes('<img src=x'),false);
 assert.equal(rendered.includes('<svg>'),false);
});

test('configured profile cache ignores and purges legacy users; demo remains usable',()=>{
 const saved=new Map([['dh_users',JSON.stringify([{email:'private@example.com',pwd:'legacy'}])]]);
 const ctx={settings:{sbUrl:'https://example.supabase.co',sbKey:'public'},DEFAULT_USERS:[],localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)}};
 vm.createContext(ctx);
 vm.runInContext(html.slice(html.indexOf('function loadUsers(){'),html.indexOf('let DEMO_USERS=[];')),ctx);
 assert.equal(ctx.loadUsers().length,0);assert.equal(saved.has('dh_users'),false);
 ctx.saveUsers([{pwd:'secret'}]);assert.equal(saved.has('dh_users'),false);
 ctx.settings={};ctx.saveUsers([{id:'demo'}]);assert.equal(ctx.loadUsers()[0].id,'demo');
 assert.ok(html.indexOf('DEMO_USERS = loadUsers();')>html.indexOf('let settings = loadSettings();'));
});
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
