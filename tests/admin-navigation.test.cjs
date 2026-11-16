const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const fn=html.match(/function adminNavigationAccess\(user\)\{.*\}\n/)[0];
const adminNavigationAccess=new Function(`${fn};return adminNavigationAccess;`)();

test('administrators are recognised by alias or by role label',()=>{
  for(const user of [{role:'admin'},{role:'it_hotel',roles:['Administrateur']},{roles:['administrator']}]){
    assert.deepEqual(adminNavigationAccess(user),{admin:true,support:true});
  }
});

test('IT staff reach the users directory but not the admin section',()=>{
  for(const user of [{role:'it_hotel'},{role:'x',roles:['IT Regional']},{roles:['IT Hotel']}]){
    assert.deepEqual(adminNavigationAccess(user),{admin:false,support:true});
  }
});

test('other roles and missing profiles get neither',()=>{
  for(const user of [{role:'demandeur'},{role:'directeur_hotel',roles:['Directeur Hôtel']},null,undefined]){
    assert.deepEqual(adminNavigationAccess(user),{admin:false,support:false});
  }
});

test('initSession applies the access to the admin section and the users entry',()=>{
  const body=html.slice(html.indexOf('function initSession(){'),html.indexOf('function showScreen('));
  assert.match(body,/const navAccess=adminNavigationAccess\(currentUser\);/);
  assert.match(body,/getElementById\("sbAdminSec"\)\.style\.display=navAccess\.admin\?"block":"none"/);
  assert.match(body,/usersNav\.style\.display=navAccess\.support\?"flex":"none"/);
  assert.ok(!html.includes('admin-navigation-fix.js'));
  assert.ok(!fs.existsSync('assets/js/admin-navigation-fix.js'));
});
