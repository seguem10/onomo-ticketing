const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const runtime=fs.readFileSync('assets/js/runtime-sync.js','utf8');
const i18n=fs.readFileSync('assets/js/i18n.js','utf8');
const profileBlock=html.slice(html.indexOf('function profileText('),html.indexOf('function changeMyPassword('));
const escSource=html.match(/function esc\(s\)\{.*?\}(?=\r?\n)/)[0];

function harness({row,user={prenom:'Awa',nom:'Diop',email:'awa@example.invalid',role:'it_hotel',hotel:'Onomo Dakar'},fetch}={}){
  const main={innerHTML:'before'},title={textContent:''};
  const context=vm.createContext({
    console:{warn(){}},currentUser:user,currentView:'profile',
    document:{getElementById:id=>({mainContent:main,topbarTitle:title}[id]||null)},
    window:{
      OnomoAuth:{getSession:async()=>({user:{id:'auth-1'}})},
      sbFetch:fetch||(async path=>{assert.equal(path,'utilisateurs?auth_user_id=eq.auth-1&limit=1');return row?[row]:[];})
    }
  });
  vm.runInContext(`${escSource}\n${profileBlock}`,context);
  return {context,main,title};
}

test('profile shows the latest profile row and the password form',async()=>{
  const {context,main,title}=harness({row:{prenom:'Awa',nom:'Diop',email:'awa@example.invalid',role:'it_regional',hotel:null,hotels:['Onomo Dakar','Onomo Abidjan']}});
  await context.renderMyProfile();
  assert.equal(title.textContent,'Mon profil');
  assert.match(main.innerHTML,/Awa Diop/);
  assert.match(main.innerHTML,/IT Régional/);
  assert.match(main.innerHTML,/Onomo Dakar, Onomo Abidjan/);
  for(const id of ['pOld','pNew','pConfirm'])assert.match(main.innerHTML,new RegExp(`id="${id}" type="password"`));
  assert.match(main.innerHTML,/<button id="pSubmit" class="btn-primary" type="button" onclick="changeMyPassword\(\)">/);
});

test('profile escapes user data',async()=>{
  const {context,main}=harness({row:{prenom:'<img src=x>',nom:'',email:'a@example.invalid',role:'demandeur',hotel:'Onomo "Lomé"'}});
  await context.renderMyProfile();
  assert.ok(!main.innerHTML.includes('<img src=x>'));
  assert.match(main.innerHTML,/&lt;img src=x&gt;/);
  assert.match(main.innerHTML,/Onomo &quot;Lomé&quot;/);
  assert.match(main.innerHTML,/>Demandeur</);
});

test('profile falls back to the session user when Supabase is unavailable',async()=>{
  const {context,main}=harness({fetch:async()=>{throw new Error('offline');}});
  await context.renderMyProfile();
  assert.match(main.innerHTML,/Awa Diop/);
  assert.match(main.innerHTML,/IT Hôtel/);
  assert.match(main.innerHTML,/Onomo Dakar/);
});

test('profile shows an error card without any user',async()=>{
  const {context,main}=harness({user:null,fetch:async()=>[]});
  await context.renderMyProfile();
  assert.match(main.innerHTML,/Impossible de charger les informations du profil/);
});

test('profile does not overwrite a page opened while it was loading',async()=>{
  let release;
  const {context,main}=harness({fetch:()=>new Promise(resolve=>{release=resolve;})});
  const pending=context.renderMyProfile();
  await new Promise(resolve=>setImmediate(resolve));
  context.currentView='tickets';
  release([{prenom:'Late',nom:'Row',role:'admin'}]);
  await pending;
  assert.equal(main.innerHTML,'before');
});

test('password change keeps the button busy while Supabase works',()=>{
  assert.match(runtime,/async function changeOwnPassword\(\)\{/);
  const wrapper=runtime.slice(runtime.indexOf("if(typeof window.changeMyPassword==='function')window.changeMyPassword="));
  assert.match(wrapper,/const button=document\.getElementById\('pSubmit'\);/);
  assert.match(wrapper,/button\.disabled=true;button\.setAttribute\('aria-busy','true'\)/);
  assert.match(wrapper,/try\{return await changeOwnPassword\(\);\}\s*finally\{if\(button\)\{button\.disabled=false;button\.removeAttribute\('aria-busy'\);\}\}/);
});

test('the former profile and password patches are no longer loaded',()=>{
  for(const name of ['profile-navigation-fix.js','password-change-fix.js']){
    assert.ok(!i18n.includes(name),name);
    assert.ok(!html.includes(name),name);
    assert.ok(!fs.existsSync(`assets/js/${name}`),name);
  }
});
