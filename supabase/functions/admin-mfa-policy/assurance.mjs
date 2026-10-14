// Call ONLY after Supabase Auth getUser(token) has authenticated this exact
// token. Decoding by itself does not verify a JWT signature.
export function authenticatedAssurance(token,verifiedUserId){
 try{
  const part=token.split('.')[1];
  const payload=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')));
  if(payload.sub!==verifiedUserId||!Number.isFinite(payload.exp)||payload.exp<=Date.now()/1000)return null;
  return payload.aal==='aal2'?'aal2':null;
 }catch(_){return null;}
}
