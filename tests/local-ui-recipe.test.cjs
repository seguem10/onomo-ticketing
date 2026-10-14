const test=require('node:test'),assert=require('node:assert/strict');
const {sanitize,handler,csp}=require('../scripts/local-ui-recipe.cjs');
test('UI recipe neutralizes production references and blocks API/worker connections',()=>{
 const result=sanitize('https://example.supabase.co sb_publishable_FAKE');
 assert.equal(result.includes('supabase.co'),false);assert.equal(result.includes('sb_publishable_'),false);
 assert.ok(csp.includes("connect-src 'none'"));assert.ok(csp.includes("worker-src 'none'"));
});
test('UI recipe never serves configuration, repo metadata or writable endpoints',()=>{
 for(const [url,method,status] of [['/.git/config','GET',404],['/.env','GET',404],['/supabase/config.toml','GET',404],['/assets/../index.html','GET',200],['/assets/%2e%2e/%2e%2e/.env','GET',404],['/','POST',405]]){
  let actual;handler({url,method},{setHeader(){},writeHead:s=>actual=s,end(){}});assert.equal(actual,status,url);
 }
});
