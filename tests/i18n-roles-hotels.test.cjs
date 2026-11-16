const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const i18n=fs.readFileSync('assets/js/i18n.js','utf8');

test('hotel names keep the word Hotel in every language',()=>{
  assert.match(i18n,/const hotelWords=new Set\(\['Hôtel','Hotel','الفندق'\]\);/);
  assert.match(i18n,/if\(hotelWords\.has\(source\)&&\/ONOMO\/i\.test\(value\)\)continue;/);
});

test('role names, activity log title and auto-expiry entry are translated',()=>{
  const phrases={
    "'Administrateur':'admin_label'":1,"'IT Régional':'regional_it'":1,"'IT Hôtel':'role_it_hotel'":1,
    "'RH Régional':'role_hr_regional'":1,"'Directeur Hôtel':'role_hotel_director'":1,"'Directeur':'role_director'":1,
    "'Journal d’activité':'activity_log'":1,"'Session expirée automatiquement':'session_expired_auto'":1,
  };
  for(const phrase of Object.keys(phrases))assert.ok(i18n.includes(phrase),phrase);
  for(const key of ['role_it_hotel','role_hr_regional','role_hotel_director','role_director','session_expired_auto']){
    assert.equal((i18n.match(new RegExp(`[{,]${key}:'`,'g'))||[]).length,3,`${key} in FR/EN/AR`);
  }
});

test('the generic word Directeur is only translated when it is the whole text',()=>{
  assert.match(i18n,/const wholeNodeOnly=new Set\(\[[^\]]*'Directeur','Director','المدير'\]\);/);
});
