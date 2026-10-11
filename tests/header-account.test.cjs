const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('account identity IDs remain unique and sidebar footer is removed',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const id of ['sbAv','sbName','sbRole','headerAccount'])assert.equal(html.split(`id="${id}"`).length-1,1);
 assert.equal(html.includes('<div class="sb-foot">'),false);
 assert.match(html,/<details class="header-account"/);
});
test('account menu closes outside and Escape returns focus',()=>{
 const handlers={};let focused=false;
 const account={open:true,contains:target=>target==='inside',querySelector:()=>({focus:()=>{focused=true;}})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/header-account.js'),'utf8'),{document:{getElementById:()=>account,addEventListener:(name,handler)=>handlers[name]=handler}});
 handlers.click({target:'inside'});assert.equal(account.open,true);
 handlers.click({target:'outside'});assert.equal(account.open,false);
 account.open=true;handlers.keydown({key:'Escape'});assert.equal(account.open,false);assert.equal(focused,true);
});
