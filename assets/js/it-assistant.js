/* ONOMO Support IT — advisory assistant UI.
   No provider secret lives in this file: every model request goes through the
   authenticated Supabase Edge Function. */
(function(){
  'use strict';
  const state={conversationId:null,domain:'general',messages:[],lastAnswer:null,conversations:[],photos:[],uploadedPhotos:[]};
  const domainKeys=['microsoft365','sage1000','citrix','opera','pos','network','maintenance','general'];
  const DOMAIN_LABELS={
    fr:{microsoft365:'Microsoft 365',sage1000:'Sage 1000',citrix:'Citrix',opera:'OPERA PMS',pos:'Caisse / POS',network:'IT / Réseau',maintenance:'Maintenance',general:'Support IT'},
    en:{microsoft365:'Microsoft 365',sage1000:'Sage 1000',citrix:'Citrix',opera:'OPERA PMS',pos:'Till / POS',network:'IT / Network',maintenance:'Maintenance',general:'IT support'},
    ar:{microsoft365:'Microsoft 365',sage1000:'Sage 1000',citrix:'Citrix',opera:'OPERA PMS',pos:'نقطة البيع',network:'الشبكة',maintenance:'الصيانة',general:'دعم تقنية المعلومات'}
  };
  // Labels follow the page language (kept as an object for existing callers).
  const domainLabels=new Proxy({},{get:(_,key)=>(DOMAIN_LABELS[window.OnomoI18n?.language||localStorage.getItem('onomo_language')||'fr']||DOMAIN_LABELS.fr)[key]});
  // Common hotel problems, one click to ask them.
  const SUGGESTIONS=[
    {domain:'microsoft365',icon:'ti-mail',fr:'Outlook ne s’ouvre pas ou n’envoie plus mes e-mails',en:'Outlook does not open or no longer sends my e-mails',ar:'Outlook لا يفتح أو لا يرسل رسائلي'},
    {domain:'network',icon:'ti-wifi',fr:'Un client n’arrive pas à se connecter au Wi-Fi',en:'A guest cannot connect to the Wi-Fi',ar:'نزيل لا يستطيع الاتصال بشبكة Wi-Fi'},
    {domain:'maintenance',icon:'ti-key',fr:'La carte de chambre d’un client ne fonctionne pas',en:'A guest’s key card does not work',ar:'بطاقة غرفة النزيل لا تعمل'},
    {domain:'pos',icon:'ti-cash-register',fr:'La caisse Micros est figée ou très lente',en:'The Micros till is frozen or very slow',ar:'صندوق Micros متوقف أو بطيء جدًا'},
    {domain:'opera',icon:'ti-building',fr:'Je n’arrive pas à me connecter à Opera',en:'I cannot sign in to Opera',ar:'لا أستطيع تسجيل الدخول إلى Opera'},
    {domain:'maintenance',icon:'ti-printer',fr:'L’imprimante n’imprime plus',en:'The printer no longer prints',ar:'الطابعة لا تطبع'},
    {domain:'microsoft365',icon:'ti-device-mobile',fr:'J’ai changé de téléphone et la double authentification ne marche plus',en:'I changed phone and two-step verification no longer works',ar:'غيّرت هاتفي ولم تعد المصادقة الثنائية تعمل'},
    {domain:'general',icon:'ti-alert-triangle',fr:'J’ai reçu un e-mail suspect',en:'I received a suspicious e-mail',ar:'تلقيت رسالة بريد مشبوهة'}
  ];
  // Knowledge base categories of each domain (their articles come first).
  const DOMAIN_CATEGORIES={microsoft365:['Messagerie','Accès','Logiciels','Sécurité'],sage1000:['Sage 1000'],citrix:['Citrix'],opera:['OPERA PMS','Serrures'],pos:['Caisse'],network:['Réseau'],maintenance:['Matériel','Serrures','Téléphonie'],general:[]};
  // Frequent questions of each domain, shown when that domain is chosen.
  const DOMAIN_SUGGESTIONS={
    microsoft365:[
      {icon:'ti-mail',fr:'Outlook ne s’ouvre pas ou n’envoie plus mes e-mails',en:'Outlook does not open or no longer sends my e-mails',ar:'Outlook لا يفتح أو لا يرسل رسائلي'},
      {icon:'ti-inbox',fr:'Je ne vois pas la boîte partagée de la réception',en:'I cannot see the reception shared mailbox',ar:'لا أرى صندوق البريد المشترك للاستقبال'},
      {icon:'ti-video',fr:'Teams : pas de son ou pas de caméra en réunion',en:'Teams: no sound or no camera in a meeting',ar:'Teams: لا صوت أو لا كاميرا في الاجتماع'},
      {icon:'ti-device-mobile',fr:'J’ai changé de téléphone et la double authentification ne marche plus',en:'I changed phone and two-step verification no longer works',ar:'غيّرت هاتفي ولم تعد المصادقة الثنائية تعمل'}],
    sage1000:[
      {icon:'ti-lock',fr:'Sage 1000 refuse la connexion',en:'Sage 1000 refuses sign-in',ar:'Sage 1000 يرفض تسجيل الدخول'},
      {icon:'ti-hourglass',fr:'Sage 1000 est bloqué pendant un traitement',en:'Sage 1000 is stuck during a process',ar:'Sage 1000 متوقف أثناء معالجة'},
      {icon:'ti-printer',fr:'Je n’arrive pas à imprimer un état Sage',en:'I cannot print a Sage report',ar:'لا أستطيع طباعة تقرير Sage'},
      {icon:'ti-calendar-check',fr:'Préparer la clôture de fin de mois dans Sage',en:'Prepare the month-end closing in Sage',ar:'تحضير إقفال نهاية الشهر في Sage'}],
    citrix:[
      {icon:'ti-apps',fr:'Citrix ne s’ouvre pas ou mon application n’apparaît pas',en:'Citrix does not open or my application is missing',ar:'Citrix لا يفتح أو تطبيقي غير ظاهر'},
      {icon:'ti-plug-connected-x',fr:'Ma session Citrix se déconnecte ou se fige',en:'My Citrix session disconnects or freezes',ar:'جلسة Citrix تنقطع أو تتجمد'},
      {icon:'ti-printer',fr:'Je n’arrive pas à imprimer depuis Citrix',en:'I cannot print from Citrix',ar:'لا أستطيع الطباعة من Citrix'}],
    opera:[
      {icon:'ti-login',fr:'Je n’arrive pas à me connecter à Opera',en:'I cannot sign in to Opera',ar:'لا أستطيع تسجيل الدخول إلى Opera'},
      {icon:'ti-hourglass',fr:'Opera est lent ou figé',en:'Opera is slow or frozen',ar:'Opera بطيء أو متجمد'},
      {icon:'ti-moon',fr:'La clôture de nuit (Night Audit) est bloquée',en:'The Night Audit is stuck',ar:'الإقفال الليلي (Night Audit) متوقف'},
      {icon:'ti-key',fr:'La carte de chambre ne s’encode pas depuis Opera',en:'The key card does not encode from Opera',ar:'بطاقة الغرفة لا تُبرمج من Opera'}],
    pos:[
      {icon:'ti-cash-register',fr:'La caisse Micros est figée ou très lente',en:'The Micros till is frozen or very slow',ar:'صندوق Micros متوقف أو بطيء جدًا'},
      {icon:'ti-credit-card',fr:'Le paiement par carte (TPE) est refusé ou hors ligne',en:'Card payment is declined or the terminal is offline',ar:'الدفع بالبطاقة مرفوض أو الجهاز غير متصل'},
      {icon:'ti-receipt',fr:'L’imprimante de tickets du bar n’imprime pas',en:'The bar receipt printer does not print',ar:'طابعة إيصالات البار لا تطبع'},
      {icon:'ti-tag',fr:'Un article ou un prix manque sur la caisse',en:'An item or price is missing on the till',ar:'صنف أو سعر غير موجود في الصندوق'}],
    network:[
      {icon:'ti-world',fr:'Internet est lent ou coupé dans tout l’hôtel',en:'Internet is slow or down across the hotel',ar:'الإنترنت بطيء أو مقطوع في كل الفندق'},
      {icon:'ti-wifi',fr:'Un client n’arrive pas à se connecter au Wi-Fi',en:'A guest cannot connect to the Wi-Fi',ar:'نزيل لا يستطيع الاتصال بشبكة Wi-Fi'},
      {icon:'ti-network',fr:'Une prise réseau ne fonctionne pas',en:'A network socket does not work',ar:'مقبس الشبكة لا يعمل'},
      {icon:'ti-lock-access',fr:'Le VPN ne se connecte pas',en:'The VPN does not connect',ar:'VPN لا يتصل'}],
    maintenance:[
      {icon:'ti-printer',fr:'L’imprimante n’imprime plus',en:'The printer no longer prints',ar:'الطابعة لا تطبع'},
      {icon:'ti-battery-charging',fr:'Un onduleur émet des bips',en:'A UPS is beeping',ar:'مزود الطاقة يصدر صفيرًا'},
      {icon:'ti-device-tv',fr:'La TV d’une chambre n’a plus de chaînes',en:'A room TV has no channels',ar:'تلفاز الغرفة بلا قنوات'},
      {icon:'ti-phone-off',fr:'Un téléphone fixe n’a plus de tonalité',en:'A desk phone has no dial tone',ar:'هاتف المكتب بلا نغمة'}]
  };
  const currentSuggestions=()=>state.domain!=='general'&&DOMAIN_SUGGESTIONS[state.domain]?DOMAIN_SUGGESTIONS[state.domain].map(item=>({...item,domain:state.domain})):SUGGESTIONS;
  const suggestionsHtml=()=>`<div class="assistant-suggestions" aria-label="${esc(tr('assistant_quick_start','Questions fréquentes'))}"><span>${esc(tr('assistant_quick_start','Questions fréquentes'))}${state.domain!=='general'?` · ${esc(domainLabels[state.domain])}`:''}</span>${currentSuggestions().map((item,index)=>`<button type="button" class="assistant-suggestion" onclick="ITAssistant.askSuggestion(${index})"><i class="ti ${item.icon}"></i>${esc(item[language()]||item.fr)}</button>`).join('')}</div>`;
  // When the user leaves "IT support", the domain is guessed from the question.
  const DOMAIN_HINTS=[
    ['pos',/\b(micros|simphony|caisse|till|pos|tpe|ticket de caisse|receipt)\b/i],
    ['opera',/\b(opera|pms|fidelio|check.?in|check.?out|folio)\b/i],
    ['sage1000',/\b(sage|comptab\w*|accounting|ecritures?)\b/i],
    ['citrix',/\b(citrix|workspace|storefront)\b/i],
    ['microsoft365',/\b(outlook|teams|onedrive|sharepoint|office ?365|365|e-?mails?|mails?|messagerie|mfa|authenticator)\b/i],
    ['network',/\b(wi-?fi|wifi|réseau|reseau|network|internet|vpn|switch|connexion)\b/i],
    ['maintenance',/\b(imprimante|printer|scanner|copieur|écran|ecran|screen|clavier|souris|tv|télé|carte de chambre|key card|vingcard|serrure|lock)\b/i]
  ];
  const detectDomain=text=>{for(const [domain,pattern] of DOMAIN_HINTS)if(pattern.test(String(text||'')))return domain;return 'general';};
  const uxTranslations={
    fr:{assistant_quick_start:'Questions fréquentes',assistant_resolved:'C’est résolu',assistant_still_blocked:'Toujours bloqué',assistant_resolved_thanks:'Parfait, problème résolu. Merci !',assistant_still_blocked_hint:'Précisez ce qui ne marche toujours pas, ou créez un ticket prérempli.',assistant_copy:'Copier',assistant_copied:'Réponse copiée',assistant_copy_failed:'Copie impossible',assistant_typing:'L’assistant analyse votre demande…',assistant_send_hint:'Ctrl + Entrée pour envoyer',assistant_domain_detected:'Domaine détecté',assistant_kb_response:'Réponse tirée de la base de connaissances',assistant_stats:'30 derniers jours',assistant_stats_conversations:'conversations',assistant_stats_resolved:'résolus sans ticket',assistant_stats_blocked:'toujours bloqués',assistant_stats_rate:'taux de résolution',assistant_history_search:'Rechercher une conversation…',assistant_dictate:'Dicter',assistant_dictate_stop:'Arrêter la dictée',assistant_dictate_unavailable:'La dictée n’est pas disponible sur ce navigateur.',assistant_dictate_failed:'Dictée interrompue.',assistant_try_in_order:'Essayez dans l’ordre :',assistant_to_clarify:'À préciser',assistant_full_diagnosis:'Voir le diagnostic complet'},
    en:{assistant_quick_start:'Frequent questions',assistant_resolved:'It’s solved',assistant_still_blocked:'Still stuck',assistant_resolved_thanks:'Great, problem solved. Thank you!',assistant_still_blocked_hint:'Say what still does not work, or create a pre-filled ticket.',assistant_copy:'Copy',assistant_copied:'Answer copied',assistant_copy_failed:'Copy failed',assistant_typing:'The assistant is analysing your request…',assistant_send_hint:'Ctrl + Enter to send',assistant_domain_detected:'Detected area',assistant_kb_response:'Answer from the knowledge base',assistant_stats:'Last 30 days',assistant_stats_conversations:'conversations',assistant_stats_resolved:'solved without a ticket',assistant_stats_blocked:'still stuck',assistant_stats_rate:'resolution rate',assistant_history_search:'Search a conversation…',assistant_dictate:'Dictate',assistant_dictate_stop:'Stop dictation',assistant_dictate_unavailable:'Dictation is not available in this browser.',assistant_dictate_failed:'Dictation stopped.',assistant_try_in_order:'Try in this order:',assistant_to_clarify:'To clarify',assistant_full_diagnosis:'See the full diagnosis'},
    ar:{assistant_quick_start:'أسئلة متكررة',assistant_resolved:'تم الحل',assistant_still_blocked:'ما زالت المشكلة قائمة',assistant_resolved_thanks:'ممتاز، تم حل المشكلة. شكرًا!',assistant_still_blocked_hint:'وضّح ما الذي لا يزال لا يعمل، أو أنشئ تذكرة معبأة مسبقًا.',assistant_copy:'نسخ',assistant_copied:'تم نسخ الإجابة',assistant_copy_failed:'تعذر النسخ',assistant_typing:'يحلل المساعد طلبك…',assistant_send_hint:'Ctrl + Enter للإرسال',assistant_domain_detected:'المجال المكتشف',assistant_kb_response:'إجابة من قاعدة المعرفة',assistant_stats:'آخر 30 يومًا',assistant_stats_conversations:'محادثات',assistant_stats_resolved:'حُلّت دون تذكرة',assistant_stats_blocked:'ما زالت عالقة',assistant_stats_rate:'نسبة الحل',assistant_history_search:'ابحث عن محادثة…',assistant_dictate:'إملاء',assistant_dictate_stop:'إيقاف الإملاء',assistant_dictate_unavailable:'الإملاء غير متاح في هذا المتصفح.',assistant_dictate_failed:'توقف الإملاء.',assistant_try_in_order:'جرّب بالترتيب:',assistant_to_clarify:'للتوضيح',assistant_full_diagnosis:'عرض التشخيص الكامل'}
  };
  const PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp']);
  const PHOTO_MAX_BYTES=5*1024*1024;
  const esc=value=>window.esc?window.esc(value):String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const photoTranslations={
    fr:{assistant_add_photo:'Ajouter des photos',assistant_photo_help:'JPG, PNG ou WebP — 5 Mo maximum par photo.',assistant_remove_photo:'Supprimer la photo',assistant_photo_rejected:'Photo refusée : JPG, PNG ou WebP, 5 Mo maximum.',assistant_photo_session:'Photo non envoyée : session indisponible.',assistant_photo_failed:'Photo non envoyée.',assistant_analyze_photos:'Analyser les photos avec Gemini',assistant_analyze_photos_help:'Les captures sélectionnées seront envoyées à Gemini uniquement après votre confirmation.',assistant_analyze_photos_confirm:'Les photos jointes seront envoyées à Gemini pour analyser uniquement les symptômes techniques visibles. Ne continuez pas si elles contiennent des mots de passe, données clients ou données personnelles. Continuer ?',assistant_photo_analysis_loading:'Analyse des captures…',assistant_photo_analysis_failed:'Analyse des photos indisponible. Réessayez ou créez un ticket.'},
    en:{assistant_add_photo:'Add photos',assistant_photo_help:'JPG, PNG or WebP — 5 MB maximum per photo.',assistant_remove_photo:'Remove photo',assistant_photo_rejected:'Photo rejected: JPG, PNG or WebP, 5 MB maximum.',assistant_photo_session:'Photo was not sent: session unavailable.',assistant_photo_failed:'Photo was not sent.',assistant_analyze_photos:'Analyze photos with Gemini',assistant_analyze_photos_help:'The selected screenshots will be sent to Gemini only after your confirmation.',assistant_analyze_photos_confirm:'The attached photos will be sent to Gemini to analyze only visible technical symptoms. Do not continue if they contain passwords, customer data, or personal data. Continue?',assistant_photo_analysis_loading:'Analyzing screenshots…',assistant_photo_analysis_failed:'Photo analysis is unavailable. Try again or create a ticket.'},
    ar:{assistant_add_photo:'إضافة صور',assistant_photo_help:'JPG أو PNG أو WebP — بحد أقصى 5 ميغابايت لكل صورة.',assistant_remove_photo:'حذف الصورة',assistant_photo_rejected:'تم رفض الصورة: JPG أو PNG أو WebP، بحد أقصى 5 ميغابايت.',assistant_photo_session:'لم يتم إرسال الصورة: الجلسة غير متاحة.',assistant_photo_failed:'لم يتم إرسال الصورة.',assistant_analyze_photos:'تحليل الصور باستخدام Gemini',assistant_analyze_photos_help:'لن تُرسل اللقطات المختارة إلى Gemini إلا بعد تأكيدك.',assistant_analyze_photos_confirm:'سيتم إرسال الصور المرفقة إلى Gemini لتحليل الأعراض التقنية المرئية فقط. لا تتابع إذا كانت تتضمن كلمات مرور أو بيانات عملاء أو بيانات شخصية. هل تريد المتابعة؟',assistant_photo_analysis_loading:'جارٍ تحليل اللقطات…',assistant_photo_analysis_failed:'تحليل الصور غير متاح. أعد المحاولة أو أنشئ تذكرة.'}
  };
  const tr=(key,fallback,values={})=>{
    const translate=window.OnomoI18n?.translate;
    const text=translate?translate(key,window.OnomoI18n?.language,values):(window.OnomoI18n?.t?.(key)||key);
    const lang=window.OnomoI18n?.language||'fr';
    return text===key?(photoTranslations[lang]?.[key]||uxTranslations[lang]?.[key]||uxTranslations.fr[key]||fallback):text;
  };
  const language=()=>window.OnomoI18n?.language||localStorage.getItem('onomo_language')||'fr';
  const isTechnician=()=>Boolean(window.canManageTickets?.(window.currentUser));
  const request=async body=>{
    const session=await window.OnomoAuth?.getSession?.();
    const settings=window.OnomoAuth?.getConfig?.()||window.settings||{};
    if(!session?.access_token||!settings.sbUrl||!settings.sbKey)throw new Error(tr('assistant_auth_unavailable','Session Supabase indisponible. Reconnectez-vous.'));
    const response=await fetch(`${settings.sbUrl}/functions/v1/ai-it-assistant`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:settings.sbKey},body:JSON.stringify({...body,language:language()})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.error)throw new Error(data.error||tr('assistant_unavailable','Le service Assistant IT est temporairement indisponible.'));
    return data;
  };
  const safePhotoName=name=>String(name||'photo').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120);
  const photoSignatureValid=async file=>{
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const starts=(...signature)=>signature.every((value,index)=>bytes[index]===value);
    if(file.type==='image/jpeg')return starts(0xff,0xd8,0xff);
    if(file.type==='image/png')return starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
    return file.type==='image/webp'&&starts(0x52,0x49,0x46,0x46)&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50;
  };
  const photoTray=()=>{
    const pending=state.photos.map((photo,index)=>`<div class="assistant-photo-item"><img src="${esc(photo.preview)}" alt="${esc(photo.file.name)}"><span>${esc(photo.file.name)}</span><button type="button" aria-label="${esc(tr('assistant_remove_photo','Supprimer la photo'))}" onclick="ITAssistant.removePhoto(${index})"><i class="ti ti-x"></i></button></div>`).join('');
    const saved=state.uploadedPhotos.filter(row=>!state.photos.some(photo=>photo.path===row.storage_path)).map(row=>`<a class="assistant-photo-item assistant-photo-saved" href="${esc(row.preview||'#')}" target="_blank" rel="noopener" ${row.preview?'':'aria-disabled="true"'}>${row.preview?`<img src="${esc(row.preview)}" alt="${esc(row.file_name)}">`:'<i class="ti ti-photo"></i>'}<span>${esc(row.file_name)}</span><i class="ti ti-external-link"></i></a>`).join('');
    return `${pending}${saved}`;
  };
  const photoAnalyzerControl=()=>state.conversationId&&state.uploadedPhotos.length?`<div class="assistant-photo-analysis"><button class="btn btn-outline" id="assistantAnalyzePhotos" type="button" onclick="ITAssistant.analyzePhotos()"><i class="ti ti-photo-search"></i>${esc(tr('assistant_analyze_photos','Analyser les photos avec Gemini'))}</button><small>${esc(tr('assistant_analyze_photos_help','Les captures sélectionnées seront envoyées à Gemini uniquement après votre confirmation.'))}</small></div>`:'';
  const refreshPhotoTray=()=>{const tray=document.getElementById('assistantPhotoTray');if(tray)tray.innerHTML=photoTray()+photoAnalyzerControl();};
  async function selectPhotos(files){
    const selected=Array.from(files||[]).slice(0,4);
    if(!selected.length)return;
    const valid=await Promise.all(selected.map(async file=>file&&file.size>0&&file.size<=PHOTO_MAX_BYTES&&PHOTO_TYPES.has(file.type)&&await photoSignatureValid(file)));
    if(valid.some(value=>!value)){window.showToast?.(tr('assistant_photo_rejected','Photo refusée : JPG, PNG ou WebP, 5 Mo maximum.'),'err');return;}
    selected.forEach(file=>state.photos.push({file,preview:URL.createObjectURL(file),path:null}));
    const input=document.getElementById('assistantPhotos');if(input)input.value='';
    refreshPhotoTray();
  }
  function removePhoto(index){const photo=state.photos[index];if(photo?.preview)URL.revokeObjectURL(photo.preview);state.photos.splice(index,1);refreshPhotoTray();}
  async function loadAssistantPhotos(conversationId){
    if(!conversationId||typeof window.sbFetch!=='function'){state.uploadedPhotos=[];return;}
    try{
      const rows=await window.sbFetch(`it_ai_attachments?conversation_id=eq.${encodeURIComponent(conversationId)}&select=id,file_name,storage_path,created_at&order=created_at.asc`);
      const client=window.OnomoAuth?.getClient?.();
      state.uploadedPhotos=await Promise.all((Array.isArray(rows)?rows:[]).map(async row=>{
        const {data,error}=client?await client.storage.from('it-assistant-images').createSignedUrl(row.storage_path,60):{};
        return {...row,preview:error?null:data?.signedUrl||null};
      }));
    }catch(_){state.uploadedPhotos=[];}
  }
  async function uploadPhotos(conversationId){
    const waiting=state.photos.filter(photo=>!photo.path);if(!waiting.length||!conversationId)return;
    const client=window.OnomoAuth?.getClient?.();const session=await window.OnomoAuth?.getSession?.();
    if(!client||!session?.user){window.showToast?.(tr('assistant_photo_session','Photo non envoyée : session indisponible.'),'err');return;}
    for(const photo of waiting){
      const path=`${session.user.id}/${conversationId}/${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}-${safePhotoName(photo.file.name)}`;
      try{
        const {error:uploadError}=await client.storage.from('it-assistant-images').upload(path,photo.file,{contentType:photo.file.type,upsert:false});
        if(uploadError)throw uploadError;
        await window.sbFetch('it_ai_attachments',{method:'POST',body:JSON.stringify({conversation_id:conversationId,uploaded_by:session.user.id,file_name:photo.file.name,storage_path:path,content_type:photo.file.type,file_size:photo.file.size})});
        photo.path=path;state.uploadedPhotos.push({file_name:photo.file.name,storage_path:path});
      }catch(error){console.error('Assistant photo upload failed',error);window.showToast?.(tr('assistant_photo_failed','Photo non envoyée.'),'err');}
    }
  }
  async function analyzePhotos(){
    if(!state.conversationId||!state.uploadedPhotos.length){
      window.showToast?.(tr('assistant_photo_failed','Photo non envoyée.'),'err');
      return;
    }
    // Uploading is private to Supabase. Sending an image to an external model is
    // intentionally a separate, visible action that requires the user's consent.
    if(!window.confirm(tr('assistant_analyze_photos_confirm','Les photos jointes seront envoyées à Gemini pour analyser uniquement les symptômes techniques visibles. Ne continuez pas si elles contiennent des mots de passe, données clients ou données personnelles. Continuer ?')))return;
    const button=document.getElementById('assistantAnalyzePhotos');
    if(button){button.disabled=true;button.innerHTML=`<i class="ti ti-loader-2 spin"></i>${esc(tr('assistant_photo_analysis_loading','Analyse des captures…'))}`;}
    try{
      const result=await request({action:'image_analysis',conversation_id:state.conversationId,domain:state.domain});
      const metadata={...result.answer,sources:result.sources||[],similar_tickets:result.similar_tickets||[],image_analysis:true};
      state.messages.push({author:'assistant',content:result.answer.answer,metadata});
      state.lastAnswer=metadata;
      renderAssistantView();
    }catch(error){
      console.error('Assistant photo analysis failed',error);
      window.showToast?.(error.message||tr('assistant_photo_analysis_failed','Analyse des photos indisponible. Réessayez ou créez un ticket.'),'err');
      if(button){button.disabled=false;button.innerHTML=`<i class="ti ti-photo-search"></i>${esc(tr('assistant_analyze_photos','Analyser les photos avec Gemini'))}`;}
    }
  }
  const list=(title,items,cls='')=>items?.length?`<section class="assistant-block ${cls}"><h4>${esc(title)}</h4><ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`:'';
  // Short answer first, as in service desk virtual agents: one sentence, at
  // most three numbered steps and up to two questions; the full diagnostic
  // stays available, folded.
  function shortAnswerHtml(answer){
    // AI checks read "Check — expected result — next step": keep the check.
    const stepText=value=>String(value||'').split(/\s+[—–-]\s+/)[0].trim();
    const steps=[...(answer.checks||[]),...(answer.solution||[])].map(stepText).filter(Boolean).filter((step,index,all)=>all.indexOf(step)===index).slice(0,3);
    const questions=(answer.questions||[]).filter(Boolean).slice(0,2);
    return `<p class="assistant-lead">${esc(answer.answer)}</p>${steps.length?`<div class="assistant-steps-title">${esc(tr('assistant_try_in_order','Essayez dans l’ordre :'))}</div><ol class="assistant-steps">${steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:''}${questions.length?`<div class="assistant-ask"><i class="ti ti-help-circle"></i><span><strong>${esc(tr('assistant_to_clarify','À préciser'))} :</strong> ${questions.map(esc).join(' · ')}</span></div>`:''}`;
  }
  function answerCard(answer,sources=[]){
    if(!answer)return'';
    const isProcedureGuide=answer.mode==='procedure'||answer.mode==='knowledge';
    const isKnowledge=answer.mode==='knowledge';
    const sourceHtml=sources.length?`<section class="assistant-block assistant-sources"><h4>${esc(isProcedureGuide?tr('assistant_guide_source','Guide de diagnostic utilisé'):tr('assistant_sources','Procédures internes utilisées'))}</h4>${sources.map(source=>`<div><strong>${esc(source.title)}</strong><small>${esc(source.source)} · ${esc(source.date)}</small></div>`).join('')}</section>`:`<div class="assistant-disclaimer">${esc(tr('assistant_no_validated_source','Aucune procédure interne validée n’a été utilisée. Cette réponse doit être vérifiée par un humain.'))}</div>`;
    // Knowledge base articles: those returned by the server, otherwise the
    // published articles matching the question (or the answer) in this page.
    const kb=window.KnowledgeBase;
    const local=kb?.related?.(answer.kb_query||`${answer.suggested_ticket?.title||''} ${answer.answer||''}`,3,DOMAIN_CATEGORIES[answer.domain||state.domain]||[])||[];
    const seen=new Set(),articles=[...local,...(Array.isArray(answer.kb_articles)?answer.kb_articles:[])].filter(a=>a&&!seen.has(String(a.id))&&seen.add(String(a.id))).slice(0,3);
    const kbHtml=articles.length?`<section class="assistant-block assistant-kb"><h4><i class="ti ti-book"></i> ${esc(kb?.relatedTitle?.()||tr('assistant_kb_articles','Fiches de la base de connaissances'))}</h4>${articles.map(article=>`<button type="button" class="assistant-kb-link" data-kb-id="${esc(article.id)}" onclick="window.KnowledgeBase?.open(this.dataset.kbId)"><strong>${esc(article.title)}</strong>${article.category?`<small>${esc(article.category)}</small>`:''}<i class="ti ti-arrow-right"></i></button>`).join('')}</section>`:'';
    const similar=Array.isArray(answer.similar_tickets)&&answer.similar_tickets.length?`<section class="assistant-block"><h4>${esc(tr('assistant_similar_tickets','Incidents similaires trouvés'))}</h4>${answer.similar_tickets.map(ticket=>`<div class="assistant-similar-ticket"><strong>${esc(ticket.numero)} · ${esc(ticket.titre)}</strong><small>${esc(ticket.categorie||'')} · ${esc(ticket.statut||'')}</small></div>`).join('')}</section>`:'';
    return `<article class="assistant-answer"><div class="assistant-answer-title"><i class="ti ${isKnowledge?'ti-book':isProcedureGuide?'ti-notebook':'ti-sparkles'}"></i>${esc(isKnowledge?tr('assistant_kb_response','Réponse tirée de la base de connaissances'):isProcedureGuide?tr('assistant_guided_response','Diagnostic guidé — modèle IT'):tr('assistant_response','Proposition de l’assistant'))}<button type="button" class="assistant-copy" title="${esc(tr('assistant_copy','Copier'))}" onclick="ITAssistant.copyAnswer(this)"><i class="ti ti-copy"></i>${esc(tr('assistant_copy','Copier'))}</button></div>${shortAnswerHtml(answer)}${kbHtml}<details class="assistant-details"><summary>${esc(tr('assistant_full_diagnosis','Voir le diagnostic complet'))}</summary>${list(tr('assistant_causes','Causes possibles'),answer.causes)}${list(tr('assistant_questions','Questions à préciser'),answer.questions,'assistant-questions')}${list(tr('assistant_checks','Vérifications recommandées'),answer.checks)}${list(tr('assistant_solution','Solution proposée'),answer.solution)}${list(tr('assistant_validation','Critères de validation'),answer.validation)}${list(tr('assistant_assumptions','Hypothèses'),answer.assumptions,'assistant-assumptions')}${similar}${sourceHtml}<div class="assistant-disclaimer"><i class="ti ti-user-check"></i>${esc(isProcedureGuide?tr('assistant_template_review','Modèle de diagnostic : à faire valider par l’équipe IT avant toute action en production.'):tr('assistant_human_review','Conseil généré par IA : validez la procédure avant toute action en production.'))}</div></details></article>`;
  }
  async function loadConversations(){
    if(typeof window.sbFetch!=='function')return [];
    try{return await window.sbFetch('it_ai_conversations?select=id,domain,title,updated_at&order=updated_at.desc&limit=20');}catch(_){return [];}
  }
  async function loadConversation(id){
    try{
      const result=await request({action:'history',conversation_id:id});
      if(!result?.conversation)throw new Error('not-found');
      state.conversationId=id;state.domain=result.conversation.domain||'general';state.messages=Array.isArray(result.messages)?result.messages:[];await loadAssistantPhotos(id);
      const last=[...state.messages].reverse().find(item=>item.author==='assistant');state.lastAnswer=last?.metadata||null;
      renderAssistantView();
    }catch(error){window.showToast?.(tr('assistant_conversation_unavailable','Conversation indisponible.'),'err');}
  }
  function conversationMessage(message,index,all){
    const isAssistant=message.author==='assistant';
    // Feedback on the latest answer only.
    const isLast=isAssistant&&Array.isArray(all)&&index===all.length-1&&message.metadata;
    const feedback=isLast&&!state.feedback?`<div class="assistant-feedback"><button type="button" class="btn btn-outline btn-sm" onclick="ITAssistant.markResolved()"><i class="ti ti-circle-check"></i>${esc(tr('assistant_resolved','C’est résolu'))}</button><button type="button" class="btn btn-outline btn-sm" onclick="ITAssistant.stillBlocked()"><i class="ti ti-alert-circle"></i>${esc(tr('assistant_still_blocked','Toujours bloqué'))}</button></div>`:isLast&&state.feedback==='resolved'?`<div class="assistant-feedback done"><i class="ti ti-circle-check"></i>${esc(tr('assistant_resolved_thanks','Parfait, problème résolu. Merci !'))}</div>`:'';
    return `<div class="assistant-message ${isAssistant?'assistant-message-ai':'assistant-message-user'}"><div class="assistant-message-author">${esc(isAssistant?tr('assistant_name','Assistant IT'):tr('assistant_you','Vous'))}</div>${isAssistant&&message.metadata?answerCard(message.metadata,message.metadata.sources||[]):`<p>${esc(message.content)}</p>`}${feedback}</div>`;
  }
  async function renderAssistantView(){
    const target=document.getElementById('mainContent');if(!target)return;
    // Give the route immediate visible feedback.  This also prevents a failed
    // history request from leaving the previous dashboard in place.
    target.innerHTML=`<div class="assistant-page assistant-page-loading"><div class="assistant-loading"><i class="ti ti-loader-2 spin"></i>${esc(tr('assistant_loading','Chargement de l’Assistant IT…'))}</div></div>`;
    // Knowledge base articles are shown next to each answer; load them without
    // ever blocking the assistant on them.
    try{await Promise.race([window.KnowledgeBase?.load?.(),new Promise(resolve=>setTimeout(resolve,2500))]);}catch(_){}
    // History is secondary. A slow or unavailable PostgREST request must never
    // leave the user on the dashboard after selecting Assistant IT.
    try{
      const conversations=await Promise.race([
        loadConversations(),
        new Promise(resolve=>setTimeout(()=>resolve([]),1200))
      ]);
      state.conversations=Array.isArray(conversations)?conversations:[];
      if(isTechnician())state.stats=await Promise.race([loadStats(),new Promise(resolve=>setTimeout(()=>resolve(state.stats||null),1200))]);
    }catch(error){
      console.warn('Assistant IT: historique indisponible',error);
      state.conversations=[];
    }
    const domainOptions=domainKeys.map(key=>`<option value="${key}" ${state.domain===key?'selected':''}>${esc(domainLabels[key])}</option>`).join('');
    const messages=state.messages.length?state.messages.map((message,index,all)=>conversationMessage(message,index,all)).join(''):`<div class="assistant-empty"><i class="ti ti-message-chatbot"></i><h3>${esc(tr('assistant_start_title','Comment puis-je vous aider ?'))}</h3><p>${esc(tr('assistant_start_description','Choisissez un domaine, décrivez le problème et l’assistant vous guidera sans créer de ticket.'))}</p>${suggestionsHtml()}</div>`;
    try{target.innerHTML=`<div class="assistant-page"><header class="assistant-header"><div>${statsHtml()}<span class="assistant-kicker"><i class="ti ti-sparkles"></i>${esc(tr('assistant_name','Assistant IT'))}</span><h1>${esc(tr('assistant_title','Diagnostic IT guidé'))}</h1><p>${esc(tr('assistant_subtitle','Conseils pour Microsoft 365, Sage 1000, Citrix, OPERA PMS, POS, réseau et maintenance.'))}</p></div><button class="btn btn-outline" onclick="ITAssistant.startConversation()"><i class="ti ti-plus"></i>${esc(tr('assistant_new_conversation','Nouvelle conversation'))}</button></header><div class="assistant-layout"><aside class="assistant-history"><div class="assistant-history-title">${esc(tr('assistant_conversations','Mes conversations'))}</div>${state.conversations.length>3?`<input type="search" class="assistant-history-search" placeholder="${esc(tr('assistant_history_search','Rechercher une conversation…'))}" value="${esc(state.historyQuery||'')}" oninput="ITAssistant.filterHistory(this.value)">`:''}${state.conversations.length?state.conversations.map(item=>`<button class="assistant-history-item ${item.id===state.conversationId?'active':''}" data-history="${esc(String(item.title||'').toLowerCase())}" onclick="ITAssistant.openConversation(this.dataset.conversationId)" data-conversation-id="${esc(item.id)}"${historyHidden(item)?' hidden':''}><i class="ti ti-message"></i><span>${esc(item.title||domainLabels[item.domain]||tr('assistant_name','Assistant IT'))}<small>${esc(shortDate(item.updated_at))}</small></span></button>`).join(''):`<p>${esc(tr('assistant_no_conversations','Aucune conversation enregistrée.'))}</p>`}</aside><main class="assistant-chat"><div class="assistant-safety"><i class="ti ti-shield-lock"></i>${esc(tr('assistant_safety','Ne saisissez jamais de mot de passe, clé API, jeton ou donnée client.'))}</div><div id="assistantMessages" class="assistant-messages">${messages}</div>${state.lastAnswer?.suggested_ticket?.title&&state.feedback!=='resolved'?`<div class="assistant-ticket-cta"><div><strong>${esc(tr('assistant_ticket_offer','Le problème persiste ?'))}</strong><span>${esc(tr('assistant_ticket_offer_description','Créez un ticket prérempli avec le résumé des vérifications.'))}</span></div><button class="btn btn-gold" onclick="ITAssistant.createTicketFromConversation()"><i class="ti ti-ticket"></i>${esc(tr('assistant_create_ticket','Créer un ticket à partir de cette conversation'))}</button></div>`:''}<form class="assistant-composer" onsubmit="ITAssistant.sendMessage(event)"><select id="assistantDomain" aria-label="${esc(tr('assistant_domain','Domaine IT'))}" onchange="ITAssistant.changeDomain(this.value)">${domainOptions}</select><textarea id="assistantInput" rows="3" maxlength="6000" placeholder="${esc(tr('assistant_placeholder','Décrivez le symptôme, le poste concerné et ce qui a déjà été essayé…'))}" title="${esc(tr('assistant_send_hint','Ctrl + Entrée pour envoyer'))}" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();ITAssistant.sendMessage(event);}" required></textarea><div class="assistant-photo-controls">${dictationAvailable()?`<button type="button" id="assistantDictate" class="assistant-photo-button assistant-dictate${state.dictating?' active':''}" aria-pressed="${state.dictating?'true':'false'}" onclick="ITAssistant.toggleDictation()"><i class="ti ti-microphone"></i>${esc(state.dictating?tr('assistant_dictate_stop','Arrêter la dictée'):tr('assistant_dictate','Dicter'))}</button>`:''}<label class="assistant-photo-button" for="assistantPhotos"><i class="ti ti-camera"></i>${esc(tr('assistant_add_photo','Ajouter des photos'))}<input id="assistantPhotos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onchange="ITAssistant.selectPhotos(this.files)"></label><span>${esc(tr('assistant_photo_help','JPG, PNG ou WebP — 5 Mo maximum par photo.'))}</span><div id="assistantPhotoTray" class="assistant-photo-tray">${photoTray()}</div></div><button class="btn btn-gold" id="assistantSendBtn" type="submit"><i class="ti ti-send"></i>${esc(tr('assistant_send','Envoyer'))}</button></form></main></div></div>`;}catch(error){console.error('Assistant IT: rendu impossible',error);target.innerHTML=`<div class="assistant-page"><div class="assistant-service-error"><i class="ti ti-alert-circle"></i><strong>${esc(tr('assistant_unavailable_title','Assistant IT indisponible'))}</strong><p>${esc(tr('assistant_render_failed','Impossible d’afficher l’assistant. Veuillez réessayer.'))}</p></div></div>`;}
    refreshPhotoTray();
    const messagesNode=document.getElementById('assistantMessages');if(messagesNode)messagesNode.scrollTop=messagesNode.scrollHeight;
  }
  async function sendMessage(event){
    event?.preventDefault(); const input=document.getElementById('assistantInput');const button=document.getElementById('assistantSendBtn');const message=input?.value.trim();if(!message||button?.disabled)return;
    if(button){button.disabled=true;button.innerHTML=`<i class="ti ti-loader-2 spin"></i>${esc(tr('assistant_thinking','Analyse…'))}`;}
    // Guess the area when the user left the generic one.
    if(state.domain==='general'){const guessed=detectDomain(message);if(guessed!=='general'){state.domain=guessed;const select=document.getElementById('assistantDomain');if(select)select.value=guessed;}}
    // Show the question and a waiting indicator straight away.
    const messagesNode=document.getElementById('assistantMessages');
    if(messagesNode){messagesNode.querySelector('.assistant-empty')?.remove();messagesNode.insertAdjacentHTML('beforeend',`<div class="assistant-message assistant-message-user assistant-pending"><div class="assistant-message-author">${esc(tr('assistant_you','Vous'))}</div><p>${esc(message)}</p></div><div class="assistant-message assistant-message-ai assistant-pending"><div class="assistant-typing"><span></span><span></span><span></span>${esc(tr('assistant_typing','L’assistant analyse votre demande…'))}</div></div>`);messagesNode.scrollTop=messagesNode.scrollHeight;}
    if(input)input.value='';
    state.feedback=null;
    try{
      const result=await request({action:'chat',conversation_id:state.conversationId,domain:state.domain,message});
      const metadata={...result.answer,sources:result.sources||[],similar_tickets:result.similar_tickets||[],kb_articles:result.kb_articles||[],kb_query:message,domain:state.domain};state.conversationId=result.conversation_id;await uploadPhotos(result.conversation_id);state.messages.push({author:'user',content:message},{author:'assistant',content:result.answer.answer,metadata});state.lastAnswer=metadata;
      renderAssistantView();
    }catch(error){window.showToast?.(error.message||tr('assistant_unavailable','Le service Assistant IT est temporairement indisponible.'),'err');document.querySelectorAll('.assistant-pending').forEach(node=>node.remove());if(input&&!input.value)input.value=message;if(button){button.disabled=false;button.innerHTML=`<i class="ti ti-send"></i>${esc(tr('assistant_send','Envoyer'))}`;}}
  }
  function askSuggestion(index){
    const item=currentSuggestions()[index];if(!item)return;
    state.domain=domainsSafe(item.domain);
    const select=document.getElementById('assistantDomain');if(select)select.value=state.domain;
    const input=document.getElementById('assistantInput');if(!input)return;
    input.value=item[language()]||item.fr;
    sendMessage();
  }
  // One answer per conversation, the latest wins. A failure only loses the statistic.
  async function saveFeedback(resolved){
    if(!state.conversationId||typeof window.sbFetch!=='function')return false;
    try{await window.sbFetch('it_ai_feedback?on_conflict=conversation_id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify({conversation_id:state.conversationId,resolved})});return true;}catch(_){return false;}
  }
  async function loadStats(){
    if(typeof window.sbFetch!=='function')return null;
    try{const rows=await window.sbFetch('rpc/it_ai_feedback_summary',{method:'POST',body:JSON.stringify({days:30})});return Array.isArray(rows)&&rows[0]?rows[0]:null;}catch(_){return null;}
  }
  function statsHtml(){
    const s=state.stats;if(!s||!Number(s.conversations))return '';
    const answered=Number(s.answered)||0,resolved=Number(s.resolved)||0,blocked=Number(s.blocked)||0;
    const rate=answered?Math.round(resolved/answered*100):null;
    return `<div class="assistant-stats" title="${esc(tr('assistant_stats','30 derniers jours'))}"><i class="ti ti-chart-bar"></i><span>${esc(tr('assistant_stats','30 derniers jours'))} :</span><b>${Number(s.conversations)}</b> ${esc(tr('assistant_stats_conversations','conversations'))} · <b>${resolved}</b> ${esc(tr('assistant_stats_resolved','résolus sans ticket'))} · <b>${blocked}</b> ${esc(tr('assistant_stats_blocked','toujours bloqués'))}${rate===null?'':` · <b>${rate} %</b> ${esc(tr('assistant_stats_rate','taux de résolution'))}`}</div>`;
  }
  const shortDate=value=>{const d=new Date(value||'');if(Number.isNaN(d.getTime()))return '';try{return d.toLocaleDateString(language()==='ar'?'ar-MA':language()==='en'?'en-GB':'fr-FR',{day:'2-digit',month:'short'});}catch(_){return d.toISOString().slice(0,10);}};
  const historyHidden=item=>{const q=String(state.historyQuery||'').trim().toLowerCase();return Boolean(q)&&!String(item.title||'').toLowerCase().includes(q);};
  function filterHistory(value){
    state.historyQuery=String(value||'');const q=state.historyQuery.trim().toLowerCase();
    document.querySelectorAll('.assistant-history-item').forEach(node=>{node.hidden=Boolean(q)&&!String(node.dataset.history||'').includes(q);});
  }
  // Dictation with the browser's speech recognition, in the page language.
  const Recognition=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
  const dictationAvailable=()=>typeof Recognition()==='function';
  let recognizer=null;
  function toggleDictation(){
    if(state.dictating&&recognizer){recognizer.stop();return;}
    const Ctor=Recognition();if(!Ctor){window.showToast?.(tr('assistant_dictate_unavailable','La dictée n’est pas disponible sur ce navigateur.'),'err');return;}
    const input=document.getElementById('assistantInput');if(!input)return;
    recognizer=new Ctor();recognizer.lang=({fr:'fr-FR',en:'en-GB',ar:'ar-MA'})[language()]||'fr-FR';recognizer.interimResults=false;recognizer.continuous=true;
    const base=input.value.trim();
    recognizer.onresult=event=>{const said=Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').trim();input.value=[base,said].filter(Boolean).join(' ');};
    recognizer.onerror=()=>{window.showToast?.(tr('assistant_dictate_failed','Dictée interrompue.'),'err');};
    recognizer.onend=()=>{state.dictating=false;recognizer=null;const button=document.getElementById('assistantDictate');if(button){button.classList.remove('active');button.setAttribute('aria-pressed','false');button.innerHTML=`<i class="ti ti-microphone"></i>${esc(tr('assistant_dictate','Dicter'))}`;}};
    try{recognizer.start();state.dictating=true;const button=document.getElementById('assistantDictate');if(button){button.classList.add('active');button.setAttribute('aria-pressed','true');button.innerHTML=`<i class="ti ti-player-stop"></i>${esc(tr('assistant_dictate_stop','Arrêter la dictée'))}`;}}catch(_){recognizer=null;state.dictating=false;}
  }
  function markResolved(){state.feedback='resolved';void saveFeedback(true);window.showToast?.(tr('assistant_resolved_thanks','Parfait, problème résolu. Merci !'),'ok');renderAssistantView();}
  function stillBlocked(){
    state.feedback='blocked';void saveFeedback(false);
    if(state.lastAnswer?.suggested_ticket?.title){createTicketFromConversation();return;}
    window.showToast?.(tr('assistant_still_blocked_hint','Précisez ce qui ne marche toujours pas, ou créez un ticket prérempli.'),'ok');
    document.getElementById('assistantInput')?.focus();
  }
  // Plain-text copy of an answer, to paste into a ticket or an e-mail.
  async function copyAnswer(button){
    const card=button?.closest?.('.assistant-answer');if(!card)return false;
    const clone=card.cloneNode(true);clone.querySelectorAll('.assistant-copy,.assistant-kb,.assistant-disclaimer,button').forEach(node=>node.remove());
    const text=Array.from(clone.querySelectorAll('.assistant-answer-title, p, h4, li')).map(node=>node.tagName==='LI'?`- ${node.textContent.trim()}`:node.tagName==='H4'?`\n${node.textContent.trim()}`:node.textContent.trim()).filter(Boolean).join('\n');
    try{await navigator.clipboard.writeText(text);window.showToast?.(tr('assistant_copied','Réponse copiée'),'ok');return true;}catch(_){window.showToast?.(tr('assistant_copy_failed','Copie impossible'),'err');return false;}
  }
  // Choosing a domain shows its frequent questions on an empty conversation.
  function changeDomain(domain){
    state.domain=domainsSafe(domain);
    const list=document.querySelector?.('.assistant-suggestions');
    if(list&&!state.messages.length)list.outerHTML=suggestionsHtml();
  }
  function domainsSafe(domain){return domainKeys.includes(domain)?domain:'general';}
  function startConversation(){state.photos.forEach(photo=>photo.preview&&URL.revokeObjectURL(photo.preview));state.conversationId=null;state.domain='general';state.messages=[];state.lastAnswer=null;state.feedback=null;state.photos=[];state.uploadedPhotos=[];renderAssistantView();}
  function createTicketFromConversation(){
    const suggested=state.lastAnswer?.suggested_ticket;if(!suggested)return;
    const checks=(state.lastAnswer.checks||[]).map(item=>`- ${item}`).join('\n');
    const description=[suggested.description,checks?`${tr('assistant_checks_done','Vérifications déjà effectuées :')}\n${checks}`:'',`${tr('assistant_ai_note','Note IA : cette synthèse doit être vérifiée par un technicien.')}`].filter(Boolean).join('\n\n');
    const fallbackCategory=state.domain==='maintenance'?'Maintenance':'IT / Réseau';
    window.queueTicketAttachments?.(state.photos.map(photo=>photo.file));
    window.openNewTicket?.({titre:suggested.title,description,categorie:Array.isArray(window.CATS)&&window.CATS.includes(suggested.category)?suggested.category:fallbackCategory,priorite:suggested.priority});
  }
  async function openTicketAssistant(){
    const ticket=window.currentTicket;if(!ticket){window.showToast?.(tr('access_denied','Accès non autorisé.'),'err');return;}
    const modal=document.createElement('div');modal.id='ticketAssistantModal';modal.className='overlay open';modal.innerHTML=`<div class="modal assistant-ticket-modal"><div class="modal-hdr"><div class="modal-title"><i class="ti ti-sparkles"></i>${esc(tr('assistant_ticket_button','Proposer une solution avec l’IA'))}</div><button class="modal-close" onclick="ITAssistant.closeTicketAssistant()"><i class="ti ti-x"></i></button></div><div class="modal-body" id="ticketAssistantBody"><div class="assistant-loading"><i class="ti ti-loader-2 spin"></i>${esc(tr('assistant_thinking','Analyse…'))}</div></div></div>`;document.body.appendChild(modal);
    try{
      const result=await request({action:'ticket',ticket_id:ticket.id,domain:ticket.categorie==='Maintenance'?'maintenance':'general'});
      const existing=await loadTicketSolution(ticket.id);const draft=existing?.proposal||result.answer;
      renderTicketAssistant({...result.answer,similar_tickets:result.similar_tickets||[],kb_articles:result.kb_articles||[],kb_query:`${ticket.titre||""} ${ticket.description||""}`},result.sources||[],existing);
      if(!existing)state.ticketProposal={ticketId:ticket.id,proposal:draft};
    }catch(error){const body=document.getElementById('ticketAssistantBody');if(body)body.innerHTML=`<div class="assistant-service-error"><i class="ti ti-alert-circle"></i><strong>${esc(tr('assistant_unavailable_title','Assistant IT indisponible'))}</strong><p>${esc(error.message||tr('assistant_unavailable','Le service Assistant IT est temporairement indisponible.'))}</p></div>`;}
  }
  async function loadTicketSolution(ticketId){try{const rows=await window.sbFetch?.(`ticket_ai_solutions?ticket_id=eq.${encodeURIComponent(ticketId)}&select=*&limit=1`);return rows?.[0]||null;}catch(_){return null;}}
  function renderTicketAssistant(answer,sources,existing){
    const body=document.getElementById('ticketAssistantBody');if(!body)return;
    const solution=(existing?.validated_solution)||(answer.solution||[]).join('\n');
    const editing=isTechnician();
    body.innerHTML=`${answerCard(answer,sources)}${editing?`<div class="form-g"><label class="field-lbl">${esc(tr('assistant_validated_solution','Solution validée par le technicien'))}</label><textarea id="ticketAssistantSolution" class="field-ctrl" rows="6" placeholder="${esc(tr('assistant_solution_placeholder','Corrigez puis enregistrez la solution validée…'))}">${esc(solution)}</textarea></div><div class="assistant-modal-actions"><button class="btn btn-outline" onclick="ITAssistant.saveTicketSolution('draft')">${esc(tr('assistant_save_draft','Enregistrer comme proposition'))}</button><button class="btn btn-gold" onclick="ITAssistant.saveTicketSolution('validated')"><i class="ti ti-check"></i>${esc(tr('assistant_validate_solution','Enregistrer la solution validée'))}</button></div>`:''}`;
    state.ticketProposal={ticketId:window.currentTicket?.id,proposal:answer,existingId:existing?.id||null};
  }
  async function saveTicketSolution(status){
    const current=state.ticketProposal;if(!current?.ticketId)return;
    const validated_solution=document.getElementById('ticketAssistantSolution')?.value.trim()||null;
    const userId=window.currentUser?.auth_user_id||window.currentUser?.id;
    const payload={ticket_id:current.ticketId,generated_by:userId,proposal:current.proposal,status,validated_solution,validated_by:status==='validated'?userId:null,validated_at:status==='validated'?new Date().toISOString():null};
    try{
      if(current.existingId)await window.sbFetch(`ticket_ai_solutions?id=eq.${encodeURIComponent(current.existingId)}`,{method:'PATCH',body:JSON.stringify(payload),prefer:'return=representation'});
      else {const rows=await window.sbFetch('ticket_ai_solutions',{method:'POST',body:JSON.stringify(payload),prefer:'return=representation'});current.existingId=rows?.[0]?.id||null;}
      window.showToast?.(status==='validated'?tr('assistant_solution_saved','Solution validée enregistrée.'):tr('assistant_draft_saved','Proposition enregistrée.'),'ok');closeTicketAssistant();
    }catch(error){window.showToast?.(tr('assistant_save_failed','Impossible d’enregistrer la solution.'),'err');}
  }
  function closeTicketAssistant(){document.getElementById('ticketAssistantModal')?.remove();}
  window.ITAssistant={renderAssistantView,sendMessage,askSuggestion,filterHistory,toggleDictation,markResolved,stillBlocked,copyAnswer,detectDomain,startConversation,openConversation:loadConversation,changeDomain,selectPhotos,removePhoto,analyzePhotos,createTicketFromConversation,openTicketAssistant,saveTicketSolution,closeTicketAssistant};
})();
