/* Private storage: writes are owner-only, reads inherit visible profiles/messages. */
(function(){
 'use strict';
 const bucket='profile-photos',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const urls=new Map();let cacheActor='';
 const labels=()=>({fr:{title:'Photo de profil',choose:'Choisir une photo',hint:'PNG, JPG ou WebP — 5 Mo maximum. Photo personnelle uniquement.',saved:'Photo enregistrée',failed:'Photo non enregistrée. Vérifiez le format et la configuration du stockage.'},en:{title:'Profile photo',choose:'Choose photo',hint:'PNG, JPG or WebP — up to 5 MB. Personal photo only.',saved:'Photo saved',failed:'Photo not saved. Check format and storage configuration.'},ar:{title:'صورة الملف الشخصي',choose:'اختيار صورة',hint:'PNG أو JPG أو WebP — حتى 5 ميغابايت. صورة شخصية فقط.',saved:'تم حفظ الصورة',failed:'لم تُحفظ الصورة. تحقق من التنسيق وإعدادات التخزين.'}})[document.getElementById('languageSelector-app')?.value||'fr'];
 function valid(file){return !!file&&['image/png','image/jpeg','image/webp'].includes(file.type)&&file.size>0&&file.size<=5*1024*1024;}
 async function normalize(file){
  if(!valid(file))throw new Error('Invalid image');
  const bitmap=await createImageBitmap(file);
  try{
   if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('Image dimensions too large');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const size=Math.min(bitmap.width,bitmap.height);
   canvas.getContext('2d').drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob||blob.size>1048576)throw new Error('Image encoding failed');return blob;
  }finally{bitmap.close();}
 }
 async function display(target,id){
  if(!target||!uuid.test(id||'')||!window.currentUser?.auth_user_id)return;
  const client=window.OnomoAuth?.getClient?.();if(!client)return;
  const actor=window.currentUser.auth_user_id;
  if(cacheActor!==actor){urls.clear();cacheActor=actor;}
  let cached=urls.get(id);
  if(!cached||cached.expires<Date.now()){
   cached={expires:Date.now()+45000,result:client.storage.from(bucket).createSignedUrl(`${id}/avatar.png`,60).catch(()=>({error:true}))};urls.set(id,cached);
  }
  const {data,error}=await cached.result;
  if(error||!data?.signedUrl||!target.isConnected||window.currentUser?.auth_user_id!==actor)return;
  const image=document.createElement('img');image.alt='';image.src=data.signedUrl;image.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';
  image.onload=()=>{if(target.isConnected&&window.currentUser?.auth_user_id===actor)target.replaceChildren(image);};
 }
 function mount(){
  const id=window.currentUser?.auth_user_id;if(!uuid.test(id||''))return;
  void display(document.getElementById('sbAv'),id);
  document.querySelectorAll('[data-photo-user]').forEach(target=>void display(target,target.dataset.photoUser));
  if(document.getElementById('myProfilePage')&&!document.getElementById('profilePhotoControl')){
   const card=document.querySelector('#mainContent .card');if(!card)return;
   const box=document.createElement('section');box.id='profilePhotoControl';box.style.cssText='padding:12px 0;border-top:1px solid var(--border)';
   const title=document.createElement('h3');title.textContent=labels().title;
   const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.setAttribute('aria-label',labels().choose);
   const hint=document.createElement('p');hint.textContent=labels().hint;hint.style.cssText='font-size:11px;color:var(--tx3)';
   input.onchange=async()=>{const file=input.files?.[0];if(!file)return;input.disabled=true;
    try{const blob=await normalize(file);if(window.currentUser?.auth_user_id!==id)throw new Error('Session changed');
     const client=window.OnomoAuth.getClient();const {error}=await client.storage.from(bucket).upload(`${id}/avatar.png`,blob,{contentType:'image/png',upsert:true,cacheControl:'60'});if(error)throw error;
     urls.delete(id);await display(document.getElementById('sbAv'),id);
     document.querySelectorAll('[data-photo-user]').forEach(target=>void display(target,target.dataset.photoUser));window.showToast?.(labels().saved,'ok');
    }catch{window.showToast?.(labels().failed,'err');}finally{input.disabled=false;input.value='';}
   };
   box.append(title,input,hint);card.appendChild(box);
  }
 }
 window.ProfilePhotos={mount,display,valid};
 const root=document.getElementById?.('mainContent');
 if(root){new MutationObserver(()=>mount()).observe(root,{childList:true});mount();}
})();
