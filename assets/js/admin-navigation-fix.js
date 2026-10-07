/* Keep the account-management entry visible for authorised roles even when
   the profile stores role labels ("Administrateur") instead of old aliases. */
(function(){
  const roles=user=>[user?.role,...(Array.isArray(user?.roles)?user.roles:[])].filter(Boolean).map(value=>String(value).trim().toLowerCase());
  const apply=()=>{
    const values=roles(window.currentUser);
    const admin=values.some(value=>['admin','administrateur','administrator'].includes(value));
    const support=admin||values.some(value=>['it regional','it_regional','it hotel','it_hotel'].includes(value));
    const section=document.getElementById('sbAdminSec');
    if(section)section.style.display=admin?'block':'none';
    const users=document.querySelector('[data-view="users"]');
    if(users)users.style.display=support?'flex':'none';
  };
  const previous=window.initSession;
  if(typeof previous==='function'&&!previous.__onomoAdminNavigation){
    const wrapped=function(){const result=previous.apply(this,arguments);apply();return result;};
    wrapped.__onomoAdminNavigation=true;window.initSession=wrapped;
  }
  window.addEventListener('onomo:profile-ready',apply);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
