(function(){
 'use strict';let busy=false;
 window.OnomoRosterImport={async run(){
  if(busy)return;
  if(!window.confirm('Créer les 11 comptes de la liste confirmée : 10 IT Hôtel et Martial limité aux deux hôtels d’Abidjan ? Les comptes existants ne seront pas modifiés.'))return;
  const client=window.OnomoAuth?.getClient?.();if(!client)return window.showToast?.('Session administrateur requise','err');
  busy=true;
  try{
   const result=await client.functions.invoke('admin-import-it-roster',{body:{confirm:'IMPORT_IT_20261012'}});
   if(result.error||result.data?.error)throw new Error(result.data?.error||'Import refusé ou indisponible');
   const data=result.data;let credentials=data.results.filter(r=>r.status==='created').map(r=>r.email+'\t'+r.temporary_password).join('\n');
   // Secrets are never placed in localStorage, sessionStorage, downloads or
   // the DOM until the human administrator explicitly reveals them.
   const panel=document.createElement('div');panel.className='overlay open';
   panel.innerHTML='<div class="modal" style="max-width:650px"><h2>Résultat de l’import IT</h2><p>'+Number(data.created)+' créés · '+Number(data.existing)+' existants inchangés · '+Number(data.failed)+' échecs</p><p>Les nouveaux utilisateurs devront changer leur mot de passe puis configurer le MFA. Communiquez les mots de passe individuellement par un canal sécurisé, jamais dans ce chat.</p><p>Les identifiants ne seront plus consultables après fermeture. Si nécessaire, utilisez ensuite la réinitialisation administrateur.</p><button type="button" class="btn btn-outline" data-roster-reveal>Afficher les identifiants temporaires</button><textarea data-roster-credentials class="field-ctrl" rows="12" readonly hidden aria-label="Identifiants temporaires confidentiels"></textarea><button type="button" class="btn btn-gold" data-roster-close style="margin-top:12px">Fermer et effacer</button></div>';
   panel.querySelector('[data-roster-reveal]').addEventListener('click',()=>{const field=panel.querySelector('textarea');field.value=credentials;field.hidden=false;});
   panel.querySelector('[data-roster-close]').addEventListener('click',()=>{if(credentials&&!window.confirm('Avez-vous conservé les identifiants dans un emplacement sécurisé ? Fermer les effacera de cet écran.'))return;credentials='';panel.querySelector('textarea').value='';panel.remove();});
   document.body.appendChild(panel);void window.renderUsers?.();
  }catch(error){window.showToast?.(error.message,'err');}finally{busy=false;}
 }};
})();
