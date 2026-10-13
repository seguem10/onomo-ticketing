// Only explicit, non-secret fields can enter the security journal.
export function auditRow(actor,action,target,metadata={}){
 const safe={target};
 for(const key of ['email','target_email','roles','reason','identity_confirmed','factors_removed']){
  if(Object.hasOwn(metadata,key))safe[key]=metadata[key];
 }
 return {id:crypto.randomUUID(),user:actor,action,detail:JSON.stringify(safe),timestamp:new Date().toISOString()};
}
