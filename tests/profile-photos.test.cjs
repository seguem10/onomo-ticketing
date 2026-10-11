const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/profile-photos.js'),'utf8'),{window,document:{getElementById:()=>null}});
test('only supported raster images within size limit are accepted',()=>{
 assert.equal(window.ProfilePhotos.valid({type:'image/jpeg',size:1024}),true);
 for(const file of [{type:'image/svg+xml',size:20},{type:'image/png',size:0},{type:'image/png',size:6*1024*1024},{type:'text/html',size:100}])assert.equal(window.ProfilePhotos.valid(file),false);
});
