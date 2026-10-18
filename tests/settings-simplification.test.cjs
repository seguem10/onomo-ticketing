const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function renderSettings(){'),html.indexOf('function selectColor('));
for(const connected of [true,false])test(`settings render without technical controls; configured=${connected}`,()=>{
 const root={innerHTML:''};const settings=Object.freeze({brandName:'ONOMO',brandColor:'#C9972A',sbUrl:'https://fixture.invalid',sbKey:'public-fixture'});
 const context={document:{getElementById:id=>{assert.equal(id,'mainContent');return root;}},settings,BRAND_PRESETS:[],darkMode:false,getCats:()=>['IT / Réseau'],esc:s=>String(s??''),sbOK:()=>connected};
 vm.runInNewContext(source+';renderSettings();',context);
 assert.match(root.innerHTML,/Personnalisation & Thème/);assert.match(root.innerHTML,/Services de l’application/);
 assert.match(root.innerHTML,connected?/Connexion aux données configurée/:/Connexion aux données non configurée/);
 for(const forbidden of ['sSbUrl','sSbKey','saveSbConfig','SQL d\'initialisation','mode NAS','localStorage','EmailJS','Resend','SMTP','ANTHROPIC_API_KEY','Tout effacer','fixture.invalid','public-fixture'])assert.ok(!root.innerHTML.includes(forbidden),forbidden);
 assert.equal(settings.sbUrl,'https://fixture.invalid');assert.equal(settings.sbKey,'public-fixture');
});
test('inline scripts remain syntactically valid and connection defaults remain present',()=>{
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc=|application\/ld\+json/i.test(match[1]))continue;new vm.Script(match[2]);}
 assert.match(html,/var SUPABASE_URL = "https:\/\/aljnwqrjplqvehctsdqj\.supabase\.co"/);
 assert.ok(!html.includes('function saveSbConfig('));
});
