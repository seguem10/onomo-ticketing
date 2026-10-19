const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('temporary recipe launcher is no longer loaded or shipped',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(!html.includes('assets/js/recipe-panel.js'));
 assert.equal(fs.existsSync('assets/js/recipe-panel.js'),false);
});
