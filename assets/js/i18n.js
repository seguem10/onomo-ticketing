/* Onomo Support IT - robust FR/EN/AR language layer. */
(function(){
  const fallback=window.OnomoLocaleData||{fr:{app_name:'Onomo Support IT',support_it:'Support IT'},en:{app_name:'Onomo Support IT',support_it:'IT Support'},ar:{app_name:'أونومو دعم تقنية المعلومات',support_it:'دعم تقنية المعلومات'}};
  let dictionary={fr:{...(fallback.fr||{})},en:{...(fallback.en||{})},ar:{...(fallback.ar||{})}},active='fr',translating=false,observerTimer=null;
  const normalize=v=>['fr','en','ar'].includes(v)?v:'fr';
  const detect=()=>normalize((navigator.languages?.[0]||navigator.language||'fr').toLowerCase().split('-')[0]);
  const t=key=>dictionary[active]?.[key]??dictionary.fr?.[key]??key;
  const extra={
    'Support Desk · Hôtellerie':{fr:'Support IT',en:'IT Support',ar:'دعم تقنية المعلومات'},'Support Desk':{fr:'Support IT',en:'IT Support',ar:'دعم تقنية المعلومات'},'Service Desk':{fr:'Service Desk',en:'Service Desk',ar:'مكتب الخدمة'},'Bienvenue':{fr:'Bienvenue',en:'Welcome',ar:'مرحباً'},'Bienvenue sur votre espace Support IT':{fr:'Bienvenue sur votre espace Support IT',en:'Welcome to your IT Support area',ar:'مرحباً بكم في مساحة دعم تقنية المعلومات'},'Vue d’ensemble':{fr:'Vue d’ensemble',en:'Overview',ar:'نظرة عامة'},'Vue globale':{fr:'Vue globale',en:'Global overview',ar:'نظرة شاملة'},'Créer un ticket':{fr:'Créer un ticket',en:'Create ticket',ar:'إنشاء تذكرة'},'Nouveau rôle':{fr:'Nouveau rôle',en:'New role',ar:'دور جديد'},'Enregistrer':{fr:'Enregistrer',en:'Save',ar:'حفظ'},'Annuler':{fr:'Annuler',en:'Cancel',ar:'إلغاء'},'Créer':{fr:'Créer',en:'Create',ar:'إنشاء'},'Modifier':{fr:'Modifier',en:'Edit',ar:'تعديل'},'Supprimer':{fr:'Supprimer',en:'Delete',ar:'حذف'},'Détails':{fr:'Détails',en:'Details',ar:'التفاصيل'},'Détail du ticket':{fr:'Détail du ticket',en:'Ticket details',ar:'تفاصيل التذكرة'},'Historique':{fr:'Historique',en:'History',ar:'السجل'},'Historique du ticket':{fr:'Historique du ticket',en:'Ticket history',ar:'سجل التذكرة'},'Ajouter un commentaire':{fr:'Ajouter un commentaire',en:'Add comment',ar:'إضافة تعليق'},'Envoyer':{fr:'Envoyer',en:'Send',ar:'إرسال'},'Actualiser':{fr:'Actualiser',en:'Refresh',ar:'تحديث'},'Filtrer':{fr:'Filtrer',en:'Filter',ar:'تصفية'},'Réinitialiser':{fr:'Réinitialiser',en:'Reset',ar:'إعادة تعيين'},'Sélectionner':{fr:'Sélectionner',en:'Select',ar:'اختيار'},'Sélectionner l’hôtel':{fr:'Sélectionner l’hôtel',en:'Select hotel',ar:'اختيار الفندق'},'Hôtel concerné':{fr:'Hôtel concerné',en:'Concerned hotel',ar:'الفندق المعني'},'Demandeur':{fr:'Demandeur',en:'Requester',ar:'طالب الخدمة'},'Administrateur':{fr:'Administrateur',en:'Administrator',ar:'المسؤول'},'IT Regional':{fr:'IT Regional',en:'Regional IT',ar:'تقنية المعلومات الإقليمية'},'IT Hotel':{fr:'IT Hotel',en:'Hotel IT',ar:'تقنية معلومات الفندق'},'Directeur':{fr:'Directeur',en:'Director',ar:'المدير'},'Aucune permission':{fr:'Aucune permission',en:'No permission',ar:'لا توجد صلاحيات'},'Accès complet':{fr:'Accès complet',en:'Full access',ar:'صلاحيات كاملة'},'Système':{fr:'Système',en:'System',ar:'النظام'},'Nom du rôle :':{fr:'Nom du rôle :',en:'Role name:',ar:'اسم الدور:'},'Ce rôle existe déjà.':{fr:'Ce rôle existe déjà.',en:'This role already exists.',ar:'هذا الدور موجود بالفعل.'},'Les rôles système ne peuvent pas être supprimés.':{fr:'Les rôles système ne peuvent pas être supprimés.',en:'System roles cannot be deleted.',ar:'لا يمكن حذف أدوار النظام.'},'Votre session a expiré.':{fr:'Votre session a expiré.',en:'Your session has expired.',ar:'انتهت صلاحية جلستك.'},'Veuillez sélectionner l’hôtel concerné.':{fr:'Veuillez sélectionner l’hôtel concerné.',en:'Please select the concerned hotel.',ar:'يرجى اختيار الفندق المعني.'},'Accès non autorisé.':{fr:'Accès non autorisé.',en:'Access denied.',ar:'غير مسموح بالوصول.'},'Ce module est en cours de préparation.':{fr:'Ce module est en cours de préparation.',en:'This module is being prepared.',ar:'هذا القسم قيد الإعداد.'}
  };
  function buildEntries(){
    const entries=[];
    Object.entries(dictionary.fr||{}).forEach(([key,source])=>{if(typeof source==='string'&&source.trim())entries.push([source,t(key)]);});
    Object.entries(extra).forEach(([source,values])=>entries.push([source,values[active]||source]));
    const seen=new Set();
    return entries.filter(([source])=>{if(seen.has(source))return false;seen.add(source);return true;}).sort((a,b)=>b[0].length-a[0].length);
  }
  function translateValue(value,entries){
    if(!value||typeof value!=='string')return value;
    let out=value;
    entries.forEach(([source,target])=>{if(source&&target&&source!==target&&out.includes(source))out=out.split(source).join(target);});
    return out;
  }
  function translateTextNodes(root=document.body){
    if(!root||translating)return;
    translating=true;
    try{
      const entries=buildEntries(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(n=>{
        const p=n.parentElement;
        if(!p||['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(p.tagName)||p.closest('[data-i18n]'))return;
        if(!n.dataset.onomoSource)n.dataset.onomoSource=n.nodeValue;
        const next=translateValue(n.dataset.onomoSource,entries);
        if(n.nodeValue!==next)n.nodeValue=next;
      });
      root.querySelectorAll('input,textarea,select,button,[title],[aria-label],[placeholder]').forEach(el=>{
        ['placeholder','title','aria-label'].forEach(attr=>{
          if(!el.hasAttribute(attr))return;
          const key='onomoSource'+attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()).replace(/^./,c=>c.toUpperCase());
          if(!el.dataset[key])el.dataset[key]=el.getAttribute(attr);
          const next=translateValue(el.dataset[key],entries);
          if(next!==el.getAttribute(attr))el.setAttribute(attr,next);
        });
      });
      root.querySelectorAll('option').forEach(el=>{
        if(!el.dataset.onomoSource)el.dataset.onomoSource=el.textContent;
        const next=translateValue(el.dataset.onomoSource,entries);
        if(el.textContent!==next)el.textContent=next;
      });
    }finally{translating=false;}
  }
  function setI18nText(el,value){
    const textNodes=[];
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())textNodes.push(walker.currentNode);
    if(textNodes.length)textNodes[textNodes.length-1].nodeValue=value;
    else el.textContent=value;
  }
  function updateStatic(){
    document.documentElement.lang=active;
    document.documentElement.dir=active==='ar'?'rtl':'ltr';
    document.body?.setAttribute('dir',active==='ar'?'rtl':'ltr');
    document.title=t('app_name');
    document.querySelectorAll('[data-i18n]').forEach(el=>setI18nText(el,t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));
    document.querySelectorAll('[data-i18n-title]').forEach(el=>el.title=t(el.dataset.i18nTitle));
    document.querySelectorAll('.sb-logo-sub').forEach(el=>setI18nText(el,t('support_it')));
    translateTextNodes();
    document.querySelectorAll('.language-selector').forEach(el=>el.value=active);
  }
  async function loadLocale(lang){
    try{
      const response=await fetch(`locales/${lang}.json?lang=${lang}&v=3`,{cache:'no-store'});
      if(response.ok){const loaded=await response.json();dictionary[lang]={...(dictionary[lang]||{}),...loaded};}
    }catch(_){/* fallback dictionary remains available */}
  }
  async function setLanguage(value,persist=true){
    active=normalize(value);
    await loadLocale(active);
    if(persist)localStorage.setItem('onomo_language',active);
    if(persist&&window.currentUser){currentUser.language=active;if(window.sbOK?.())window.sbUpdateUser?.(currentUser.id,{language:active});}
    updateStatic();
    enforceSelectors();
  }
  function makeSelector(id){
    const select=document.createElement('select');
    select.id=id;select.className='language-selector';select.setAttribute('aria-label','Language');
    select.innerHTML='<option value="fr">FR</option><option value="en">EN</option><option value="ar">العربية</option>';
    select.value=active;select.addEventListener('change',e=>setLanguage(e.target.value));
    return select;
  }
  function enforceSelectors(){
    const app=document.getElementById('appScreen'),topbar=app?.querySelector('.topbar'),search=topbar?.querySelector('.search-box'),loginScreen=document.getElementById('loginScreen');
    document.querySelectorAll('.language-selector').forEach(el=>{if(el.id!=='languageSelector-login'&&el.id!=='languageSelector-app')el.remove();});
    if(loginScreen){
      let login=document.getElementById('languageSelector-login');
      if(!login)login=makeSelector('languageSelector-login');
      if(login.parentElement!==loginScreen)loginScreen.appendChild(login);
      login.style.setProperty('position','fixed','important');login.style.setProperty('top','18px','important');login.style.setProperty('right','18px','important');login.style.setProperty('left','auto','important');login.style.setProperty('bottom','auto','important');login.style.setProperty('z-index','9999','important');login.style.setProperty('display','block','important');
    }else document.getElementById('languageSelector-login')?.remove();
    if(topbar&&search){
      let appSelect=document.getElementById('languageSelector-app');
      if(!appSelect)appSelect=makeSelector('languageSelector-app');
      topbar.insertBefore(appSelect,search);
      appSelect.style.setProperty('position','static','important');appSelect.style.setProperty('margin','0 8px','important');appSelect.style.setProperty('width','auto','important');appSelect.style.setProperty('min-width','82px','important');appSelect.style.setProperty('height','36px','important');appSelect.style.setProperty('display','inline-block','important');
    }else document.getElementById('languageSelector-app')?.remove();
  }
  window.OnomoI18n={t,setLanguage,get language(){return active},validate(){const keys=Object.keys(dictionary.fr||{});return ['en','ar'].flatMap(lang=>keys.filter(k=>!(k in (dictionary[lang]||{}))).map(k=>`${lang}:${k}`));}};
  document.addEventListener('DOMContentLoaded',async()=>{
    active=normalize(localStorage.getItem('onomo_language')||detect());
    enforceSelectors();
    await setLanguage(active,false);
    const observer=new MutationObserver(()=>{clearTimeout(observerTimer);observerTimer=setTimeout(()=>{enforceSelectors();translateTextNodes();},80);});
    observer.observe(document.body,{childList:true,subtree:true});
  });
})();
