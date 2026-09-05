/* Onomo Support IT - reliable FR / EN / AR UI translation */
(function(){
  'use strict';
  const LANGS=['fr','en','ar'];
  const fallback=window.OnomoLocaleData||{};
  const dict={fr:{...(fallback.fr||{})},en:{...(fallback.en||{})},ar:{...(fallback.ar||{})}};
  const sourceMap=new WeakMap();
  const attrMap=new WeakMap();
  let active=localStorage.getItem('onomo_language')||((navigator.languages&&navigator.languages[0])||navigator.language||'fr').toLowerCase().split('-')[0];
  if(!LANGS.includes(active))active='fr';
  let busy=false;
  const extra={
    'Support Desk · Hôtellerie':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Support Desk':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Support Hôtelier':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Support hôtelier':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Support hôtelière':['Support IT','IT Support','دعم تقنية المعلومات'],
    'Service Desk':['Service Desk','Service Desk','مكتب الخدمة'],
    'Tableau de bord':['Tableau de bord','Dashboard','لوحة التحكم'],
    'Tickets récents':['Tickets récents','Recent tickets','أحدث التذاكر'],
    'Activité récente':['Activité récente','Recent activity','النشاط الأخير'],
    'Aucune activité':['Aucune activité','No activity','لا يوجد نشاط'],
    'Aucun ticket trouvé':['Aucun ticket trouvé','No ticket found','لم يتم العثور على تذكرة'],
    'Tickets urgents':['Tickets urgents','Urgent tickets','التذاكر العاجلة'],
    'Mes tickets assignés':['Mes tickets assignés','My assigned tickets','تذاكري المعيّنة'],
    'Tous les tickets':['Tous les tickets','All tickets','كل التذاكر'],
    'Nouveau ticket':['Nouveau ticket','New ticket','تذكرة جديدة'],
    'Créer le ticket':['Créer le ticket','Create ticket','إنشاء التذكرة'],
    'Ticket créé avec succès':['Ticket créé avec succès','Ticket created successfully','تم إنشاء التذكرة بنجاح'],
    'Ticket mis à jour':['Ticket mis à jour','Ticket updated','تم تحديث التذكرة'],
    'Chargement des données…':['Chargement des données…','Loading data…','جارٍ تحميل البيانات…'],
    'Rechercher un ticket…':['Rechercher un ticket…','Search a ticket…','البحث عن تذكرة…'],
    'Notifications':['Notifications','Notifications','الإشعارات'],
    'Tout lire':['Tout lire','Mark all as read','قراءة الكل'],
    'Aucune notification':['Aucune notification','No notifications','لا توجد إشعارات'],
    'Mode sombre':['Mode sombre','Dark mode','الوضع الداكن'],
    'Vue liste':['Vue liste','List view','عرض القائمة'],
    'Vue Kanban':['Vue Kanban','Kanban view','عرض كانبان'],
    'Filtres avancés':['Filtres avancés','Advanced filters','فلاتر متقدمة'],
    'Sujet':['Sujet','Subject','الموضوع'],'Hôtel':['Hôtel','Hotel','الفندق'],'Hôtels':['Hôtels','Hotels','الفنادق'],
    'Catégorie':['Catégorie','Category','الفئة'],'Priorité':['Priorité','Priority','الأولوية'],'Statut':['Statut','Status','الحالة'],
    'Assigné à':['Assigné à','Assigned to','مُعيّن إلى'],'Créé':['Créé','Created','تم الإنشاء'],'Créé le':['Créé le','Created on','تاريخ الإنشاء'],
    'Description':['Description','Description','الوصف'],'Commentaires':['Commentaires','Comments','التعليقات'],
    'Ajouter un commentaire…':['Ajouter un commentaire…','Add a comment…','إضافة تعليق…'],'Retour':['Retour','Back','رجوع'],
    'Modifier le statut':['Modifier le statut','Edit status','تعديل الحالة'],'Nouveau statut':['Nouveau statut','New status','الحالة الجديدة'],
    'Enregistrer':['Enregistrer','Save','حفظ'],'Annuler':['Annuler','Cancel','إلغاء'],'Fermer':['Fermer','Close','إغلاق'],
    'Rouvrir':['Rouvrir','Reopen','إعادة فتح'],'Supprimer':['Supprimer','Delete','حذف'],'Modifier':['Modifier','Edit','تعديل'],
    'Créer':['Créer','Create','إنشاء'],'Rechercher':['Rechercher','Search','بحث'],'Actualiser':['Actualiser','Refresh','تحديث'],
    'Filtrer':['Filtrer','Filter','تصفية'],'Réinitialiser':['Réinitialiser','Reset','إعادة تعيين'],
    'Tous':['Tous','All','الكل'],'Nouveau':['Nouveau','New','جديد'],'En cours':['En cours','In progress','قيد المعالجة'],
    'En attente':['En attente','Pending','قيد الانتظار'],'Résolu':['Résolu','Resolved','تم الحل'],'Fermé':['Fermé','Closed','مغلق'],
    'Urgents':['Urgents','Urgent','عاجل'],'Haute':['Haute','High','عالية'],'Normale':['Normale','Normal','عادية'],
    'Basse':['Basse','Low','منخفضة'],'Urgente':['Urgente','Urgent','عاجلة'],'Critique':['Critique','Critical','حرجة'],
    'Maintenance':['Maintenance','Maintenance','الصيانة'],'IT / Réseau':['IT / Network','IT / Network','تقنية المعلومات / الشبكة'],
    'Chambres':['Chambres','Rooms','الغرف'],'Restauration':['Restauration','Food & Beverage','المطعم'],'Sécurité':['Sécurité','Security','الأمن'],
    'Ménage':['Ménage','Housekeeping','التدبير المنزلي'],'Autre':['Autre','Other','أخرى'],'Non assigné':['Non assigné','Unassigned','غير معيّن'],
    'Rapports':['Rapports','Reports','التقارير'],'Administration':['Administration','Administration','الإدارة'],'Paramètres':['Paramètres','Settings','الإعدادات'],
    'Utilisateurs':['Utilisateurs','Users','المستخدمون'],'Mon profil':['Mon profil','My profile','ملفي الشخصي'],
    'Rôles et permissions':['Rôles et permissions','Roles and permissions','الأدوار والصلاحيات'],
    'Gestion des comptes':['Gestion des comptes','Account management','إدارة الحسابات'],'Ajouter un compte':['Ajouter un compte','Add account','إضافة حساب'],
    'Nouvel utilisateur':['Nouvel utilisateur','New user','مستخدم جديد'],'Prénom':['Prénom','First name','الاسم'],'Nom':['Nom','Last name','النسب'],
    'Email':['Email','Email','البريد الإلكتروني'],'Adresse email':['Adresse email','Email address','البريد الإلكتروني'],'Mot de passe':['Mot de passe','Password','كلمة المرور'],
    'Rôle':['Rôle','Role','الدور'],'IT Régional':['IT Régional','Regional IT','تقنية المعلومات الإقليمية'],'IT Hôtel':['IT Hôtel','Hotel IT','تقنية معلومات الفندق'],
    'Direction':['Direction','Management','الإدارة'],'Admin':['Admin','Admin','مسؤول'],'Ville':['Ville','City','المدينة'],'Pays':['Pays','Country','البلد'],
    'Clair':['Clair','Light','فاتح'],'Sombre':['Sombre','Dark','داكن'],'Thème':['Thème','Theme','المظهر'],
    'Bienvenue':['Bienvenue','Welcome','مرحباً'],'Accès non autorisé.':['Accès non autorisé.','Access denied.','غير مسموح بالوصول.'],
    'Aucune permission':['Aucune permission','No permission','لا توجد صلاحيات'],'Accès complet':['Accès complet','Full access','صلاحيات كاملة'],
    'Votre session a expiré.':['Votre session a expiré.','Your session has expired.','انتهت صلاحية جلستك.'],
    'La dictée vocale n’est pas disponible dans ce navigateur.':['La dictée vocale n’est pas disponible dans ce navigateur.','Voice dictation is not available in this browser.','الإملاء الصوتي غير متاح في هذا المتصفح.'],
    'Dicter automatiquement':['Dicter automatiquement','Dictate automatically','الإملاء تلقائياً'],'Arrêter la dictée':['Arrêter la dictée','Stop dictation','إيقاف الإملاء']
  };

  async function load(lang){
    try{const r=await fetch('locales/'+lang+'.json?v=6',{cache:'no-store'});if(r.ok)Object.assign(dict[lang],await r.json());}catch(_){ }
  }
  function triples(){
    const out=[];
    Object.keys(dict.fr||{}).forEach(k=>{const a=dict.fr[k],b=dict.en[k]??a,c=dict.ar[k]??a;if(typeof a==='string')out.push([a,b,c]);});
    Object.values(extra).forEach(v=>out.push(v));
    return out;
  }
  function translate(value){
    if(typeof value!=='string'||!value.trim())return value;
    const s=value.trim();
    for(const row of triples()){
      for(let i=0;i<3;i++)if(row[i]===s)return value.replace(s,row[['fr','en','ar'].indexOf(active)]);
    }
    let out=value;
    for(const row of triples()){
      const target=row[['fr','en','ar'].indexOf(active)];
      for(const source of row){if(source&&target&&source!==target&&out.includes(source))out=out.split(source).join(target);}
    }
    return out;
  }
  function textSource(node){let s=sourceMap.get(node);if(s===undefined){s=node.nodeValue;sourceMap.set(node,s);}return s;}
  function attrSource(el,attr){let m=attrMap.get(el);if(!m){m={};attrMap.set(el,m);}if(m[attr]===undefined)m[attr]=el.getAttribute(attr)||'';return m[attr];}
  function translateTree(root=document.body){
    if(!root||busy)return;busy=true;
    try{
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(n=>{const p=n.parentElement;if(!p||['SCRIPT','STYLE'].includes(p.tagName))return;if(p.closest('[data-i18n]'))return;const src=textSource(n);const next=translate(src);if(n.nodeValue!==next)n.nodeValue=next;});
      root.querySelectorAll('input,textarea,button,[title],[aria-label],[placeholder]').forEach(el=>['placeholder','title','aria-label'].forEach(a=>{if(el.hasAttribute(a)){const src=attrSource(el,a),next=translate(src);if(next!==el.getAttribute(a))el.setAttribute(a,next);}}));
      root.querySelectorAll('option').forEach(o=>{const src=textSource(o.firstChild||o);const next=translate(src);if(o.textContent!==next)o.textContent=next;});
      root.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;const value=dict[active]?.[key]??dict.fr?.[key]??key;el.textContent=value;});
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.placeholder=dict[active]?.[el.dataset.i18nPlaceholder]??el.dataset.i18nPlaceholder);
      root.querySelectorAll('[data-i18n-title]').forEach(el=>el.title=dict[active]?.[el.dataset.i18nTitle]??el.dataset.i18nTitle);
    }finally{busy=false;}
  }
  function selector(id){
    let s=document.getElementById(id);if(s)return s;
    s=document.createElement('select');s.id=id;s.className='language-selector';s.setAttribute('aria-label','Language');
    s.innerHTML='<option value="fr">FR</option><option value="en">EN</option><option value="ar">العربية</option>';s.value=active;s.addEventListener('change',()=>setLanguage(s.value,true));return s;
  }
  function selectors(){
    const login=document.getElementById('loginScreen'),app=document.getElementById('appScreen'),top=app?.querySelector('.topbar'),search=top?.querySelector('.search-box');
    if(login){const s=selector('languageSelector-login');if(!s.parentElement||s.parentElement!==login)login.appendChild(s);Object.assign(s.style,{position:'fixed',top:'18px',right:'18px',zIndex:'99999',display:'block',minWidth:'82px'});s.value=active;}
    if(top&&search){const s=selector('languageSelector-app');if(s.parentElement!==top)top.insertBefore(s,search);Object.assign(s.style,{display:'inline-block',minWidth:'82px'});s.value=active;}
  }
  async function setLanguage(lang,persist=true){
    active=LANGS.includes(lang)?lang:'fr';if(persist)localStorage.setItem('onomo_language',active);await load(active);
    document.documentElement.lang=active;document.documentElement.dir=active==='ar'?'rtl':'ltr';document.body?.setAttribute('dir',active==='ar'?'rtl':'ltr');
    const appName=dict[active]?.app_name||'Onomo Support IT';document.title=appName;translateTree(document.body);selectors();
    try{if(window.currentUser)currentUser.language=active;}catch(_){ }
  }
  function t(key){return dict[active]?.[key]??dict.fr?.[key]??key;}
  window.OnomoI18n={get language(){return active},t,setLanguage,refresh:()=>{translateTree(document.body);selectors()}};
  window.setLanguage=setLanguage;
  document.addEventListener('DOMContentLoaded',async()=>{await Promise.all([load('fr'),load('en'),load('ar')]);await setLanguage(active,false);const obs=new MutationObserver(()=>{clearTimeout(window.__onomoI18nTimer);window.__onomoI18nTimer=setTimeout(()=>{selectors();translateTree(document.body);},100);});obs.observe(document.body,{childList:true,subtree:true});});
})();
