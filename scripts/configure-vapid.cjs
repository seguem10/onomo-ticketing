// Run explicitly for the ONOMO project. Generated secret data is held in an
// ephemeral local file so it never appears in CLI arguments, logs or Git.
const {createECDH}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const project='aljnwqrjplqvehctsdqj';
const cliEntry=process.argv[2];
const cli=(args)=>execFileSync(cliEntry?process.execPath:'supabase',cliEntry?[cliEntry,...args]:args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
try{
 const listed=JSON.parse(cli(['secrets','list','--project-ref',project,'--output','json']));
 const names=new Set(listed.map(row=>row.name));
 const hasPublic=names.has('WEB_PUSH_VAPID_PUBLIC_KEY'),hasPrivate=names.has('WEB_PUSH_VAPID_PRIVATE_KEY');
 if(hasPublic!==hasPrivate)throw new Error('incomplete_existing_pair');
 if(hasPublic){process.stdout.write('VAPID keys already configured; no rotation performed.\n');process.exit(0);}
 const key=createECDH('prime256v1');key.generateKeys();
 const publicKey=key.getPublicKey().toString('base64url');
 const privateKey=key.getPrivateKey().toString('base64url');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'onomo-vapid-'));
 const file=path.join(directory,'generated.env');
 try{
  fs.writeFileSync(file,'WEB_PUSH_VAPID_PUBLIC_KEY='+publicKey+'\nWEB_PUSH_VAPID_PRIVATE_KEY='+privateKey+'\nWEB_PUSH_VAPID_SUBJECT=mailto:it@onomohotel.com\n',{mode:0o600});
  cli(['secrets','set','--env-file',file,'--project-ref',project]);
 }finally{
  if(fs.existsSync(file))fs.unlinkSync(file);
  fs.rmdirSync(directory);
 }
 process.stdout.write('VAPID public/private keys and contact configured. Private key was not printed. Temporary secret file removed.\n');
}catch(_){
 // Do not print errors containing command input or generated credentials.
 process.stderr.write('VAPID configuration failed; no secret value is logged. Inspect secret names and CLI access before retrying.\n');process.exitCode=1;
}
