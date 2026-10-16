const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
for(const file of fs.readdirSync('assets/js').filter(f=>f.endsWith('.js'))){
 const result=spawnSync(process.execPath,['--check',path.join('assets/js',file)],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
