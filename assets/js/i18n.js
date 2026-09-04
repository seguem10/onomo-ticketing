/* Onomo Support IT - complete FR/EN/AR language layer. */
(function(){
  const fallback={fr:{app_name:'Onomo Support IT',support_it:'Support IT'},en:{app_name:'Onomo Support IT',support_it:'IT Support'},ar:{app_name:'أونومو دعم تقنية المعلومات',support_it:'دعم تقنية المعلومات'}};
  let dictionary=window.OnomoLocaleData||fallback;
  let active='fr';

  const normalize=v=>['fr','en','ar'].includes(v)?v:'fr';
  const detect=()=>normalize((navigator.languages?.[0]||navigator.language||'fr').toLowerCase().split('-')[0]);
  const t=key=>dictionary[active]?.[key]??dictionary.fr?.[key]??key;

  /* Text generated directly by JavaScript which is not represented by a data-i18n key. */
  const extra={
    fr:{
      'Support Desk · Hôtellerie':'Support IT','Support Desk':'Support IT','Service Desk':'Service Desk','Bienvenue':'Bienvenue','Bienvenue sur votre espace Support IT':'Bienvenue sur votre espace Support IT','Vue d’ensemble':'Vue d’ensemble','Vue globale':'Vue globale','Créer un ticket':'Créer un ticket','Nouveau rôle':'Nouveau rôle','Enregistrer':'Enregistrer','Annuler':'Annuler','Créer':'Créer','Modifier':'Modifier','Supprimer':'Supprimer','Détails':'Détails','Détail du ticket':'Détail du ticket','Historique':'Historique','Historique du ticket':'Historique du ticket','Ajouter un commentaire':'Ajouter un commentaire','Envoyer':'Envoyer','Actualiser':'Actualiser','Filtrer':'Filtrer','Réinitialiser':'Réinitialiser','Sélectionner':'Sélectionner','Sélectionner l’hôtel':'Sélectionner l’hôtel','Hôtel concerné':'Hôtel concerné','Demandeur':'Demandeur','Administrateur':'Administrateur','IT Regional':'IT Regional','IT Hotel':'IT Hotel','Directeur':'Directeur','Aucune permission':'Aucune permission','Accès complet':'Accès complet','Système':'Système','Nom du rôle :':'Nom du rôle :','Ce rôle existe déjà.':'Ce rôle existe déjà.','Les rôles système ne peuvent pas être supprimés.':'Les rôles système ne peuvent pas être supprimés.','Dicter automatiquement':'Dicter automatiquement','Arrêter la dictée':'Arrêter la dictée','La dictée vocale n’est pas disponible dans ce navigateur.':'La dictée vocale n’est pas disponible dans ce navigateur.','Écoute active — détection automatique en cours.':'Écoute active — détection automatique en cours.','Dictée arrêtée.':'Dictée arrêtée.','Votre session a expiré.':'Votre session a expiré.','Veuillez sélectionner l’hôtel concerné.':'Veuillez sélectionner l’hôtel concerné.','Accès non autorisé.':'Accès non autorisé.','Nom du rôle :':'Nom du rôle :','Ce module est en cours de préparation.':'Ce module est en cours de préparation.','module en cours de préparation.':'module en cours de préparation.'
    },
    en:{
      'Support Desk · Hôtellerie':'IT Support','Support Desk':'IT Support','Service Desk':'Service Desk','Bienvenue':'Welcome','Bienvenue sur votre espace Support IT':'Welcome to your IT Support area','Vue d’ensemble':'Overview','Vue globale':'Global overview','Créer un ticket':'Create ticket','Nouveau rôle':'New role','Enregistrer':'Save','Annuler':'Cancel','Créer':'Create','Modifier':'Edit','Supprimer':'Delete','Détails':'Details','Détail du ticket':'Ticket details','Historique':'History','Historique du ticket':'Ticket history','Ajouter un commentaire':'Add comment','Envoyer':'Send','Actualiser':'Refresh','Filtrer':'Filter','Réinitialiser':'Reset','Sélectionner':'Select','Sélectionner l’hôtel':'Select hotel','Hôtel concerné':'Concerned hotel','Demandeur':'Requester','Administrateur':'Administrator','IT Regional':'Regional IT','IT Hotel':'Hotel IT','Directeur':'Director','Aucune permission':'No permission','Accès complet':'Full access','Système':'System','Nom du rôle :':'Role name:','Ce rôle existe déjà.':'This role already exists.','Les rôles système ne peuvent pas être supprimés.':'System roles cannot be deleted.','Dicter automatiquement':'Dictate automatically','Arrêter la dictée':'Stop dictation','La dictée vocale n’est pas disponible dans ce navigateur.':'Voice dictation is not available in this browser.','Écoute active — détection automatique en cours.':'Listening — automatic detection is active.','Dictée arrêtée.':'Dictation stopped.','Votre session a expiré.':'Your session has expired.','Veuillez sélectionner l’hôtel concerné.':'Please select the concerned hotel.','Accès non autorisé.':'Access denied.','Ce module est en cours de préparation.':'This module is being prepared.','module en cours de préparation.':'module is being prepared.'
    },
    ar:{
      'Support Desk · Hôtellerie':'دعم تقنية المعلومات','Support Desk':'دعم تقنية المعلومات','Service Desk':'مكتب الخدمة','Bienvenue':'مرحباً','Bienvenue sur votre espace Support IT':'مرحباً بكم في مساحة دعم تقنية المعلومات','Vue d’ensemble':'نظرة عامة','Vue globale':'نظرة شاملة','Créer un ticket':'إنشاء تذكرة','Nouveau rôle':'دور جديد','Enregistrer':'حفظ','Annuler':'إلغاء','Créer':'إنشاء','Modifier':'تعديل','Supprimer':'حذف','Détails':'التفاصيل','Détail du ticket':'تفاصيل التذكرة','Historique':'السجل','Historique du ticket':'سجل التذكرة','Ajouter un commentaire':'إضافة تعليق','Envoyer':'إرسال','Actualiser':'تحديث','Filtrer':'تصفية','Réinitialiser':'إعادة تعيين','Sélectionner':'اختيار','Sélectionner l’hôtel':'اختيار الفندق','Hôtel concerné':'الفندق المعني','Demandeur':'طالب الخدمة','Administrateur':'المسؤول','IT Regional':'تقنية المعلومات الإقليمية','IT Hotel':'تقنية معلومات الفندق','Directeur':'المدير','Aucune permission':'لا توجد صلاحيات','Accès complet':'صلاحيات كاملة','Système':'النظام','Nom du rôle :':'اسم الدور:','Ce rôle existe déjà.':'هذا الدور موجود بالفعل.','Les rôles système ne peuvent pas être supprimés.':'لا يمكن حذف أدوار النظام.','Dicter automatiquement':'الإملاء تلقائياً','Arrêter la dictée':'إيقاف الإملاء','La dictée vocale n’est pas disponible dans ce navigateur.':'الإملاء الصوتي غير متاح في هذا المتصفح.','Écoute active — détection automatique en cours.':'الاستماع نشط — جارٍ الكشف التلقائي.','Dictée arrêtée.':'تم إيقاف الإملاء.','Votre session a expiré.':'انتهت صلاحية جلستك.','Veuillez sélectionner l’hôtel concerné.':'يرجى اختيار الفندق المعني.','Accès non autorisé.':'غير مسموح بالوصول.','Ce module est en cours de préparation.':'هذا القسم قيد الإعداد.','module en cours de préparation.':'القسم قيد الإعداد.'
    }
  };

  function buildEntries(){
    const entries=[];
    ['fr','en','ar'].forEach(lang=>Object.entries(dictionary[lang]||{}).forEach(([key,value])=>{
      if(typeof value==='string'&&value.trim()) entries.push([value,key]);
    }));
    Object.entries(extra[active]||{}).forEach(([source,target])=>entries.push([source,target]));
    const seen=new Set();
    return entries.filter(([source])=>{if(seen.has(source))return false;seen.add(source);return true;}).sort((a,b)=>b[0].length-a[0].length);
  }

  function translateValue(value,entries){
    if(!value||typeof value!=='string')return value;
    let out=value;
    for(const [source,targetOrKey] of entries){
      const target=(dictionary[active]?.[targetOrKey]!==undefined&&targetOrKey===Object.keys(dictionary[active]||{}).find(k=>dictionary[active][k]===dictionary[active][targetOrKey]))?t(targetOrKey):targetOrKey;
      if(source&&target&&source!==target&&out.includes(source))out=out.split(source).join(target);
    }
    return out;
  }

  function translateTextNode(node,entries){
    if(!node||!node.parentElement)return;
    const parent=node.parentElement;
    if(['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName))return;
    if(!node.dataset.onomoSource)node.dataset.onomoSource=node.nodeValue;
    const source=node.dataset.onomoSource;
    const next=translateValue(source,entries);
    if(node.nodeValue!==next)node.nodeValue=next;
  }

  function translateElement(el,entries){
    if(!el)return;
    ['placeholder','title','aria-label'].forEach(attr=>{
      if(el.hasAttribute(attr)){
        const key='onomoSource'+attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()).replace(/^./,c=>c.toUpperCase());
        if(!el.dataset[key])el.dataset[key]=el.getAttribute(attr);
        const next=translateValue(el.dataset[key],entries);
        if(next!==el.getAttribute(attr))el.setAttribute(attr,next);
      }
    });
    if(el.tagName==='OPTION'){
      if(!el.dataset.onomoSource)el.dataset.onomoSource=el.textContent;
      el.textContent=translateValue(el.dataset.onomoSource,entries);
    }
  }

  function translateLegacy(root=document.body){
    if(!root)return;
    const entries=buildEntries();
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>translateTextNode(n,entries));
    root.querySelectorAll('input,textarea,select,button,[title],[aria-label],[placeholder]').forEach(el=>translateElement(el,entries));
  }

  function updateStatic(){
    document.documentElement.lang=active;
    document.documentElement.dir=active==='ar'?'rtl':'ltr';
    document.title=t('app_name');
    document.body?.setAttribute('dir',active==='ar'?'rtl':'ltr');
    document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));
    document.querySelectorAll('.sb-logo-sub').forEach(el=>el.textContent=t('support_it'));
    translateLegacy();
    document.querySelectorAll('.language-selector').forEach(el=>el.value=active);
  }

  async function setLanguage(value,persist=true){
    active=normalize(value);
    try{
      const response=await fetch(`locales/${active}.json`,{cache:'no-store'});
      if(response.ok){const loaded=await response.json();dictionary={...dictionary,[active]:loaded};}
    }catch(_){/* keep embedded dictionary */}
    if(persist)localStorage.setItem('onomo_language',active);
    if(persist&&window.currentUser){currentUser.language=active;if(window.sbOK?.())window.sbUpdateUser(currentUser.id,{language:active});}
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
    const app=document.getElementById('appScreen');
    const topbar=app?.querySelector('.topbar');
    const search=topbar?.querySelector('.search-box');
    const loginBrand=document.querySelector('.login-brand');
    const loginVisible=!!document.getElementById('loginScreen')&&!document.getElementById('loginScreen').classList.contains('hidden');

    /* Remove every accidental/legacy duplicate. */
    document.querySelectorAll('.language-selector').forEach(el=>{
      if(el.id!=='languageSelector-login'&&el.id!=='languageSelector-app')el.remove();
    });

    if(loginBrand){
      let login=document.getElementById('languageSelector-login');
      if(!login){login=makeSelector('languageSelector-login');loginBrand.append(login);}
      login.style.setProperty('position','absolute','important');
      login.style.setProperty('top','18px','important');
      login.style.setProperty('right','18px','important');
      login.style.setProperty('left','auto','important');
      login.style.setProperty('bottom','auto','important');
      login.style.setProperty('z-index','20','important');
    }

    if(topbar&&search){
      let appSelect=document.getElementById('languageSelector-app');
      if(!appSelect)appSelect=makeSelector('languageSelector-app');
      /* Always put it exactly between the notification area and ticket search. */
      topbar.insertBefore(appSelect,search);
      ['position','top','right','left','bottom','z-index','order'].forEach(p=>appSelect.style.removeProperty(p));
      appSelect.style.setProperty('position','static','important');
      appSelect.style.setProperty('margin','0 8px','important');
      appSelect.style.setProperty('width','auto','important');
      appSelect.style.setProperty('min-width','82px','important');
      appSelect.style.setProperty('height','36px','important');
      appSelect.style.setProperty('display','inline-block','important');
    }

    /* On the login page only the login selector is allowed to be visible. */
    if(loginVisible&&!app){document.getElementById('languageSelector-app')?.remove();}
    if(!app){document.getElementById('languageSelector-app')?.remove();}
  }

  window.OnomoI18n={t,setLanguage,get language(){return active},validate(){const keys=Object.keys(dictionary.fr||{});return ['en','ar'].flatMap(lang=>keys.filter(k=>!(k in (dictionary[lang]||{}))).map(k=>`${lang}:${k}`));}};

  document.addEventListener('DOMContentLoaded',()=>{
    active=normalize(localStorage.getItem('onomo_language')||detect());
    enforceSelectors();
    setLanguage(active,false);
    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.addedNodes.length||m.type==='attributes')){
        enforceSelectors();
        translateLegacy();
      }
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','placeholder','title','aria-label']});
  });
})();
