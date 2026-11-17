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
  assert.equal(JSON.stringify(h.calls),JSON.stringify([
    ['rpc/admin_set_user_roles',{target_profile:'p1',role_names:['IT Hotel']},'POST'],
    ['utilisateurs?id=eq.p1',{prenom:'Awa',nom:'Diop',email:'awa@example.invalid',role:'it_hotel',hotel:'Onomo Dakar',hotels:[],roles:['IT Hotel']},'PATCH']
  ]));
  assert.deepEqual(h.events,['saveUsers','populateSelects','close:modalUser','renderUsers']);
  assert.equal(h.page.DEMO_USERS[0].mapped,true);
  assert.equal(h.page.currentUser.prenom,'Awa');
  assert.equal(h.toasts.at(-1)[1],'ok');
  assert.equal(h.resets.length,0);
});

test('hotel scopes follow the role',async()=>{
  const cases=[
    [form('demandeur',{hotel:'Onomo Lomé'}),'Onomo Lomé',['Onomo Lomé'],'demandeur','Demandeur'],
    [form('requester',{hotel:'Onomo Lomé'}),'Onomo Lomé',['Onomo Lomé'],'demandeur','Demandeur'],
    [form('it_regional',{hotels:['Onomo Dakar','',null,'Onomo Abidjan']}),null,['Onomo Dakar','Onomo Abidjan'],'it_regional','IT Regional'],
    [form('directeur_hotel',{hotel:'Onomo Dakar'}),'Onomo Dakar',[],'directeur_hotel','Directeur Hôtel'],
    [form('rh_regional',{hotels:['Onomo Dakar']}),null,['Onomo Dakar'],'rh_regional','RH Régional'],
    [form('admin'),null,[],'admin','Administrateur']
  ];
  for(const [data,hotel,hotels,role,name] of cases){
    const h=editHarness();
    assert.equal(await h.page.saveUserEdit('p1',data),true,data.role);
    const body=h.calls[1][1];
    assert.equal(body.hotel,hotel,data.role);assert.deepEqual(body.hotels,hotels,data.role);assert.equal(body.role,role);assert.deepEqual(body.roles,[name]);
    assert.deepEqual(h.calls[0][1].role_names,[name]);
  }
});

test('additional roles are saved with the main role, in app_user_roles first',async()=>{
  const h=editHarness();
  assert.equal(await h.page.saveUserEdit('p1',form('it_hotel',{hotel:'Onomo Dakar',roles:['IT Hotel','Directeur','RH Régional','admin','']})),true);
  assert.deepEqual(h.calls.map(c=>c[0]),['rpc/admin_set_user_roles','utilisateurs?id=eq.p1']);
  assert.deepEqual(h.calls[0][1].role_names,['IT Hotel','Directeur','RH Régional','Administrateur']);
  assert.deepEqual(h.calls[1][1].roles,['IT Hotel','Directeur','RH Régional','Administrateur']);
});

test('a refused role change leaves the profile untouched and the modal open',async()=>{
  const calls=[],toasts=[],events=[];
  const page=loadUsersPage({
    currentUser:{id:'p1',role:'admin'},DEMO_USERS:[{id:'p1'}],
    document:{getElementById:()=>null},
    window:{confirm:()=>true,sbFetch:async path=>{calls.push(path);throw new Error('Vous ne pouvez pas retirer votre propre rôle Administrateur');}},
    showToast:(message,kind)=>toasts.push([message,kind]),
    dbRowToUser:row=>row,saveUsers:()=>events.push('saveUsers'),populateSelects:()=>{},closeModal:()=>events.push('close')
  });
  assert.equal(await page.saveUserEdit('p1',form('it_hotel',{hotel:'Onomo Dakar'})),false);
  assert.deepEqual(calls,['rpc/admin_set_user_roles']);assert.deepEqual(events,[]);
  assert.deepEqual(toasts.at(-1),['Vous ne pouvez pas retirer votre propre rôle Administrateur','err']);
});

test('admin_set_user_roles is admin-only and replaces roles in both tables',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261117090000_admin_set_user_roles.sql','utf8').replace(/\r\n/g,'\n');
  for(const fragment of [
    "security definer\nset search_path = ''",
    "if not public.is_admin() then\n    raise exception",
    "target_auth = auth.uid() and not ('Administrateur' = any(names))",
    "not exists (select 1 from public.app_roles r where r.name = n)",
    "delete from public.app_user_roles where user_id = target_auth and role_id <> all(wanted)",
    "update public.utilisateurs set roles = to_jsonb(names)",
    "revoke all on function public.admin_set_user_roles(text, text[]) from public, anon;"
  ])assert.ok(sql.includes(fragment),fragment);
});

test('the role boxes follow the main role and the list loads saved roles',()=>{
  const modern=fs.readFileSync('assets/js/modern-features.js','utf8');
  assert.ok(modern.includes("select.addEventListener('change',()=>{const previous=roleName(select.dataset.previousRole||''),next=roleName(select.value);"));
  assert.ok(modern.includes('input.checked=input.value===roleName(select.value)'));
  assert.ok(html.includes('utilisateurs?select=id,auth_user_id,email,prenom,nom,role,roles,'));
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
  assert.match(html,/if\(editId\)\{\r?\n    const roles=Array\.from\(document\.querySelectorAll\('#uRoleChoices input:checked'\)\)\.map\(input=>input\.value\);\r?\n    return saveUserEdit\(editId,\{prenom,nom,email,role,hotel,hotels,roles\}\);/);
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
