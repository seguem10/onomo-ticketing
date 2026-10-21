const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n?/g,'\n');

test('connected UI session stores only a tab-scoped marker and purges legacy business caches',()=>{
 const runtime=fs.readFileSync('assets/js/runtime-sync.js','utf8');
 const persistent=new Map(['dh_tickets','dh_comments','dh_users','dh_hotels','session','activity'].map(k=>[k,'private']));const tab=new Map();
 const ctx={currentUser:{id:'user',email:'private@example.com',pwd:'secret',mfaSecret:'private'},hasAuthConfiguration:()=>true,SESSION_KEY:'session',ACTIVITY_KEY:'activity',localStorage:{removeItem:k=>persistent.delete(k),setItem:(k,v)=>persistent.set(k,v)},sessionStorage:{removeItem:k=>tab.delete(k),setItem:(k,v)=>tab.set(k,v)}};
 vm.createContext(ctx);
 const start=runtime.indexOf("  const LOCAL_DATA_KEYS=");const end=runtime.indexOf('  const clearSession=',start);
 vm.runInContext(runtime.slice(start,end)+'\nwriteSession();purgeConnectedBrowserCache();',ctx);
 assert.equal(persistent.size,0);const marker=JSON.parse(tab.get('session'));
 assert.deepEqual(Object.keys(marker).sort(),['at','id']);assert.equal(marker.id,'user');
 assert.equal(JSON.stringify(marker).includes('private'),false);assert.equal(JSON.stringify(marker).includes('secret'),false);
 ctx.currentUser=null;tab.clear();vm.runInContext('writeSession();',ctx);assert.equal(tab.size,0);
});

test('advanced filters escape option labels and values without losing selection',()=>{
 const hostile='\"><img src=x onerror=alert(1)>';
 const ctx={scopedHotelRows:()=>[{nom:hostile}],PRIOS:[hostile],CATS:[hostile],DEMO_USERS:[{role:'it_hotel',prenom:hostile,nom:'Name'}],advFilters:{hotel:hostile,priorite:hostile,categorie:hostile,assigne:hostile+' Name'},advOpen:true};
 vm.createContext(ctx);vm.runInContext(html.split('\n').find(l=>l.startsWith('function esc(')),ctx);
 vm.runInContext(html.slice(html.indexOf('function advFiltersBarHTML(){')).match(/^[\s\S]*?\r?\n\}/)[0],ctx);
 const result=ctx.advFiltersBarHTML();assert.equal(result.includes('<img'),false);
 assert.equal((result.match(/ selected/g)||[]).length,4);
 assert.ok(result.includes('value="'+ctx.esc(hostile)+'" selected'));
 assert.ok(result.includes(ctx.esc(hostile+' Name')+'</option>'));
});

test('agent report escapes names, initials, translated role labels and hotels',()=>{
 const host={innerHTML:''};const ctx={DEMO_USERS:[{role:'it_hotel',prenom:'<img>',nom:'&',hotel:'<svg>'}],tickets:[],ROLE_STYLES:{it_hotel:{bg:'blue',color:'white'}},ROLE_L:{it_hotel:'<script>role</script>'},document:{getElementById:()=>host}};
 vm.createContext(ctx);
 for(const name of ['esc','initials'])vm.runInContext(html.split('\n').find(l=>l.startsWith('function '+name+'(')),ctx);
 const start=html.indexOf('function renderReportAgents(){');
 vm.runInContext(html.slice(start,html.indexOf('function renderReportMy(){',start)),ctx);ctx.renderReportAgents();
 assert.ok(host.innerHTML.includes('&lt;&amp;'));
 assert.ok(host.innerHTML.includes('&lt;script&gt;role&lt;/script&gt;'));
 assert.equal(host.innerHTML.includes('<img>'),false);assert.equal(host.innerHTML.includes('<svg>'),false);
});

test('hotel administration isolates malicious IDs in escaped data attributes',()=>{
 const host={innerHTML:''};const id="x');alert(1);//\"";
 const ctx={HOTELS:[{id,nom:'<img src=x>',code:'"',ville:'<svg>',pays:'&'}],tickets:[],document:{getElementById:()=>host}};
 vm.createContext(ctx);vm.runInContext(html.split('\n').find(l=>l.startsWith('function esc(')),ctx);
 const start=html.indexOf('function renderHotelsAdmin(){');
 vm.runInContext(html.slice(start,html.indexOf('function openAddHotel(){',start)),ctx);ctx.renderHotelsAdmin();
 assert.ok(host.innerHTML.includes('data-hotel-id="'+ctx.esc(id)+'"'));
 assert.ok(host.innerHTML.includes('onclick="openEditHotel(this.dataset.hotelId)"'));
 assert.ok(host.innerHTML.includes('onclick="deleteHotel(this.dataset.hotelId)"'));
 assert.equal(host.innerHTML.includes('<img src=x>'),false);
 for(const action of ['openEditUser','disableMFA','openMFASetup','askDeleteUser'])assert.ok(html.includes(action+'(this.dataset.userId)'));
});

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
