const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {html,loadUsersPage}=require('./users-page-harness.cjs');

function editHarness({password='',confirm=true,rows}={}){
  const calls=[],toasts=[],resets=[],events=[];
  const page=loadUsersPage({
    currentUser:{id:'p1',role:'admin',prenom:'Old'},
    DEMO_USERS:[{id:'p1',prenom:'Old'},{id:'p2',prenom:'Other'}],
    document:{getElementById:id=>id==='uPwd'?{value:password}:null},
    window:{
      confirm:()=>confirm,
      sbFetch:async(path,options)=>{calls.push([path,JSON.parse(options.body),options.method]);return rows??[{id:'p1',auth_user_id:'auth-1',...JSON.parse(options.body)}];},
      OnomoAuth:{resetUserPassword:async(id,value)=>resets.push([id,value])}
    },
    showToast:(message,kind)=>toasts.push([message,kind]),
    dbRowToUser:row=>({...row,mapped:true}),
    saveUsers:()=>events.push('saveUsers'),
    populateSelects:()=>events.push('populateSelects'),
    closeModal:id=>events.push(`close:${id}`)
  });
  page.renderUsers=()=>events.push('renderUsers');
  return {page,calls,toasts,resets,events};
}
const form=(role,extra={})=>({prenom:'Awa',nom:'Diop',email:'awa@example.invalid',role,hotel:null,hotels:[],...extra});

test('an edit patches the Supabase profile row and refreshes the page',async()=>{
  const h=editHarness();
  assert.equal(await h.page.saveUserEdit('p1',form('it_hotel',{hotel:' Onomo Dakar '})),true);
  assert.equal(JSON.stringify(h.calls),JSON.stringify([['utilisateurs?id=eq.p1',{prenom:'Awa',nom:'Diop',email:'awa@example.invalid',role:'it_hotel',hotel:'Onomo Dakar',hotels:[],roles:['it_hotel']},'PATCH']]));
  assert.deepEqual(h.events,['saveUsers','populateSelects','close:modalUser','renderUsers']);
  assert.equal(h.page.DEMO_USERS[0].mapped,true);
  assert.equal(h.page.currentUser.prenom,'Awa');
  assert.equal(h.toasts.at(-1)[1],'ok');
  assert.equal(h.resets.length,0);
});

test('hotel scopes follow the role',async()=>{
  const cases=[
    [form('demandeur',{hotel:'Onomo Lomé'}),'Onomo Lomé',['Onomo Lomé'],'demandeur'],
    [form('requester',{hotel:'Onomo Lomé'}),'Onomo Lomé',['Onomo Lomé'],'demandeur'],
    [form('it_regional',{hotels:['Onomo Dakar','',null,'Onomo Abidjan']}),null,['Onomo Dakar','Onomo Abidjan'],'it_regional'],
    [form('directeur_hotel',{hotel:'Onomo Dakar'}),'Onomo Dakar',[],'directeur_hotel'],
    [form('rh_regional',{hotels:['Onomo Dakar']}),null,['Onomo Dakar'],'rh_regional'],
    [form('admin'),null,[],'admin']
  ];
  for(const [data,hotel,hotels,role] of cases){
    const h=editHarness();
    assert.equal(await h.page.saveUserEdit('p1',data),true,data.role);
    const body=h.calls[0][1];
    assert.equal(body.hotel,hotel,data.role);assert.deepEqual(body.hotels,hotels,data.role);assert.equal(body.role,role);assert.deepEqual(body.roles,[role]);
  }
});

test('missing hotels block the edit before any request',async()=>{
  for(const data of [form('it_hotel'),form('it_regional'),form('demandeur')]){
    const h=editHarness();
    assert.equal(await h.page.saveUserEdit('p1',data),false);
    assert.equal(h.calls.length,0);assert.equal(h.toasts[0][1],'err');
  }
});

test('a temporary password must be strong, confirmed, and goes to the Edge Function only',async()=>{
  const weak=editHarness({password:'short'});
  assert.equal(await weak.page.saveUserEdit('p1',form('admin')),false);
  assert.equal(weak.calls.length,0);

  const declined=editHarness({password:'Str0ng!Password',confirm:false});
  assert.equal(await declined.page.saveUserEdit('p1',form('admin')),false);
  assert.equal(declined.calls.length,0);

  const h=editHarness({password:'Str0ng!Password'});
  assert.equal(await h.page.saveUserEdit('p1',form('admin')),true);
  assert.ok(!JSON.stringify(h.calls).includes('Str0ng!Password'));
  assert.deepEqual(h.resets,[['auth-1','Str0ng!Password']]);
  assert.match(h.toasts.at(-1)[0],/Mot de passe temporaire défini/);
});

test('a rejected update keeps the modal open',async()=>{
  const h=editHarness({rows:[]});
  assert.equal(await h.page.saveUserEdit('p1',form('admin')),false);
  assert.deepEqual(h.events,[]);
  assert.equal(h.toasts.at(-1)[1],'err');
});

test('the users table filters on the search box and shows actions to administrators only',()=>{
  const rows=[{id:'a',prenom:'Awa',nom:'Diop',email:'awa@example.invalid',role:'it_hotel',hotel:'Onomo Dakar'},{id:'b',prenom:'Ben',nom:'Sow',email:'ben@example.invalid',role:'admin'}];
  const admin=loadUsersPage({currentUser:{role:'admin'},searchQ:'dakar'});
  const table=admin.usersTableHtml(rows);
  assert.match(table,/Awa Diop/);assert.ok(!table.includes('Ben Sow'));
  assert.match(table,/data-user-id="a"[^>]*onclick="openEditUser\(this\.dataset\.userId\)"/);
  assert.match(table,/data-user-id="a"[^>]*onclick="askDeleteUser\(this\.dataset\.userId\)"/);
  const staff=loadUsersPage({currentUser:{role:'it_hotel'}}).usersTableHtml(rows);
  assert.match(staff,/Ben Sow/);assert.match(staff,/Tous les hôtels/);
  assert.ok(!staff.includes('openEditUser'));assert.ok(!staff.includes('askDeleteUser'));
});

test('the router, the search box and the wrappers use the integrated page',()=>{
  const switchView=html.slice(html.indexOf('function switchView(v,el){'));
  assert.match(switchView.slice(0,200),/if\(v==="users"\)return openUsersView\(el\);/);
  assert.match(html,/function onSearch\(v\)\{searchQ=v;if\(currentView==="users"\)\{void refreshUsersList\(\);return;\}/);
  assert.match(html,/if\(editId\)\{\r?\n    return saveUserEdit\(editId,\{prenom,nom,email,role,hotel,hotels\}\);/);
  assert.match(fs.readFileSync('assets/js/modern-features.js','utf8'),/ensureRequesterHotelField\(\);\s*\/\/[^\n]*\n\s*if\(document\.getElementById\('uEditId'\)\?\.value\)return originalSubmitUser\(\);/);
  assert.match(fs.readFileSync('assets/js/runtime-sync.js','utf8'),/if\(document\.getElementById\('uEditId'\)\?\.value\)return previousSubmitUser\(\);/);
});

test('the former user administration patches are gone',()=>{
  const i18n=fs.readFileSync('assets/js/i18n.js','utf8');
  for(const name of ['user-admin-fix.js','user-save-fix.js']){
    assert.ok(!html.includes(name),name);assert.ok(!i18n.includes(name),name);
    assert.ok(!fs.existsSync(`assets/js/${name}`),name);
  }
  assert.ok(!fs.readFileSync('assets/js/admin-activity.js','utf8').includes('loadUsersFix'));
});
