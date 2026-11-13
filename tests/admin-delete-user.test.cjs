const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const fn=fs.readFileSync('supabase/functions/admin-delete-user/index.ts','utf8');
const config=fs.readFileSync('supabase/config.toml','utf8');

function loadConfirmDelete(deleteImpl){
  const start=html.indexOf('let userDeletionPending=false;');
  const end=html.indexOf('function deleteUser(id)',start);
  assert.ok(start>0&&end>start,'confirmDeleteUser block not found');
  const toasts=[];const saved=[];const closed=[];
  const button={disabled:false};
  const ctx={
    DEMO_USERS:[{id:'u1',prenom:'A',nom:'B'},{id:'u2',prenom:'C',nom:'D'}],
    document:{getElementById:()=>({value:'u1'}),querySelector:()=>button},
    window:{OnomoAuth:{deleteUser:deleteImpl}},
    sbOK:()=>true,
    appText:(_k,fallback)=>fallback,
    showToast:(message,type)=>toasts.push([message,type]),
    saveUsers:list=>saved.push(list.map(u=>u.id)),
    populateSelects:()=>{},closeModal:id=>closed.push(id),addNotif:()=>{},renderUsers:()=>{}
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(start,end)+';this.confirmDeleteUser=confirmDeleteUser;',ctx);
  return {ctx,toasts,saved,closed,button};
}

test('user deletion reports success only after the server confirms',async()=>{
  const calls=[];
  const {ctx,toasts,saved,closed,button}=loadConfirmDelete(async id=>{calls.push(id);return {ok:true};});
  await ctx.confirmDeleteUser();
  assert.deepEqual(calls,['u1']);
  assert.deepEqual(saved,[['u2']]);
  assert.deepEqual(closed,['modalConfirmUser']);
  assert.deepEqual(toasts,[['Compte supprimé','ok']]);
  assert.equal(button.disabled,false);
});

test('a server failure keeps the user and shows the error',async()=>{
  const {ctx,toasts,saved,closed}=loadConfirmDelete(async()=>{throw new Error('Impossible de supprimer le dernier administrateur.');});
  await ctx.confirmDeleteUser();
  assert.equal(ctx.DEMO_USERS.length,2);
  assert.deepEqual(saved,[]);
  assert.deepEqual(closed,[]);
  assert.deepEqual(toasts,[['Impossible de supprimer le dernier administrateur.','err']]);
});

test('admin-delete-user is admin-only, guarded and deletes the Auth login',()=>{
  assert.match(fn,/rpc\("is_admin"\)/);
  assert.match(fn,/isAdmin !== true\) return reply\(req, \{ error: "Accès réservé aux administrateurs\." \}, 403\)/);
  assert.match(fn,/Impossible de supprimer votre propre compte/);
  assert.match(fn,/Impossible de supprimer le dernier administrateur/);
  assert.match(fn,/auth\.admin\.deleteUser\(profile\.auth_user_id\)/);
  assert.match(fn,/auditRow\(auth\.user\.id, "user_deleted"/);
  assert.match(config,/\[functions\.admin-delete-user\]\s*enabled = true\s*verify_jwt = true/);
});
