// ONOMO Support IT — secure, advisory IT assistant.
// Required secret: OPENAI_API_KEY or ANTHROPIC_API_KEY. SUPABASE_SERVICE_ROLE_KEY
// is provided automatically by Supabase Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2";

const firstProjectKey=(name:string)=>{
  try{
    const values=JSON.parse(Deno.env.get(name)||'{}');
    return Object.values(values).find(value=>typeof value==='string'&&value) as string|undefined;
  }catch(_){return undefined;}
};
const URL=Deno.env.get("SUPABASE_URL")!;
// Supabase now exposes plural JSON key maps to Edge Functions.  Retain the
// legacy names as fallbacks so existing projects continue to work.
const ANON=Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? firstProjectKey("SUPABASE_PUBLISHABLE_KEYS");
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? firstProjectKey("SUPABASE_SECRET_KEYS");
const ANTHROPIC_KEY=Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_KEY=Deno.env.get("OPENAI_API_KEY");
const GEMINI_KEY=Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL=Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
const domains=new Set(['microsoft365','sage1000','citrix','opera','pos','network','maintenance','general']);
const allowedOrigin=(origin:string)=>origin==='https://onomo-ticketing.vercel.app'||/^https:\/\/onomo-ticketing(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
const headers=(req:Request)=>({"Access-Control-Allow-Origin":allowedOrigin(req.headers.get('origin')??'')?req.headers.get('origin')??'':"https://onomo-ticketing.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS",Vary:"Origin","Content-Type":"application/json"});
const send=(req:Request,body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(req)});
const clean=(value:unknown,max=6000)=>String(value??'').replace(/\b(?:password|mot de passe|token|api[_ -]?key|secret)\s*[:=]\s*\S+/gi,'[REDACTED]').replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,})\b/g,'[REDACTED]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[REDACTED_EMAIL]').replace(/\b(?:\d[ -]*?){13,19}\b/g,'[REDACTED_PAYMENT]').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const toText=(items:unknown)=>Array.isArray(items)?items.map(item=>clean(item,900)).filter(Boolean).slice(0,8):[];
const priority=(value:unknown)=>{const key=String(value??'').toLowerCase();if(/crit|urgent|p1/.test(key))return 'Urgente';if(/haut|high|p2/.test(key))return 'Haute';if(/bas|low|p4/.test(key))return 'Basse';return 'Normale';};
const fallbackAnswer=(domain:string,message:string,language:string)=>{
  const isEn=language==='en', isAr=language==='ar';
  const label=domain==='general'?'IT':domain;
  const operaUser=domain==='opera'&&/(?:ajout|ajouter|cré|cre|add|create|user|utilisateur)/i.test(message);
  if(operaUser){
    if(isAr)return {answer:'إضافة مستخدم إلى OPERA تتطلب أن ينفذها مسؤول مخوّل وفق الإجراء الداخلي المعتمد. لا ترسل كلمة مرور أو بيانات عميل في هذه المحادثة.',causes:['طلب صلاحية جديد أو حساب مستخدم غير متاح'],questions:['ما اسم الفندق أو المنشأة المعنية؟','ما القسم والدور المطلوبان؟','هل توجد موافقة المدير أو مالك التطبيق؟'],checks:['تأكد من وجود موافقة موثقة وحدد أقل صلاحيات لازمة للدور.','تحقق من أن الحساب ليس موجوداً مسبقاً أو معطلاً قبل إنشاء حساب جديد.','اطلب من المسؤول المخوّل إنشاء الحساب من واجهة OPERA المعتمدة، من دون مشاركة كلمة المرور.'],solution:['اربط الدور بالمنشأة والقسم المحددين فقط. أرسل دعوة أو بيانات الوصول عبر القناة المعتمدة في مؤسستك، ثم اطلب من المستخدم تغيير كلمة المرور عند أول اتصال إذا كانت سياستكم تفرض ذلك.'],validation:['يتصل المستخدم بنجاح ويصل فقط إلى الوظائف والمنشأة المصرح بها.','دوّن اسم المنفذ ووقت الإنشاء والدور في سجل التذكرة.'],assumptions:['هذه خطة آمنة عامة وليست إجراء OPERA داخلياً معتمداً؛ يجب أن ينفذها مسؤول OPERA مخوّل.'],suggested_ticket:{title:'OPERA : création d’un utilisateur',description:`Demande : ${message}\n\nÀ confirmer : hôtel, département, rôle, périmètre et approbation du responsable.`,category:'IT / Réseau',priority:'Normale'}};
    if(isEn)return {answer:'Adding an OPERA user must be performed by an authorized administrator under the approved internal process. Do not share a password or customer data in this conversation.',causes:['A new access request or an unavailable user account'],questions:['Which hotel or property is concerned?','What department and role are required?','Is manager or application-owner approval available?'],checks:['Confirm documented approval and define the least-privilege role needed.','Check that the account does not already exist or is not disabled before creating a new one.','Have an authorized administrator create the account using the approved OPERA interface, without sharing a password.'],solution:['Restrict the role to the requested property and department. Send the invitation or access details only through your organization’s approved channel, then require a password change at first sign-in if your policy requires it.'],validation:['The user signs in successfully and can access only the authorized property and functions.','Record the operator, creation time, and role in the ticket history.'],assumptions:['This is safe general guidance, not an approved internal OPERA procedure; an authorized OPERA administrator must perform it.'],suggested_ticket:{title:'OPERA: create a user',description:`Request: ${message}\n\nTo confirm: hotel, department, role, scope, and manager approval.`,category:'IT / Réseau',priority:'Normale'}};
    return {answer:'La création d’un utilisateur OPERA doit être réalisée par un administrateur habilité, selon la procédure interne approuvée. Ne communiquez jamais de mot de passe ni de donnée client dans cette conversation.',causes:['Nouvelle demande d’accès ou compte utilisateur indisponible'],questions:['Quel hôtel ou établissement est concerné ?','Quel département et quel rôle sont nécessaires ?','L’accord du responsable ou du propriétaire de l’application est-il disponible ?'],checks:['Vérifiez l’accord documenté et définissez le rôle avec le minimum de droits nécessaire.','Vérifiez que le compte n’existe pas déjà ou n’est pas désactivé avant toute création.','Demandez à un administrateur habilité de créer le compte depuis l’interface OPERA approuvée, sans partager de mot de passe.'],solution:['Limitez le rôle à l’hôtel et au département demandés. Envoyez l’invitation ou les accès uniquement via le canal approuvé par votre organisation, puis imposez un changement de mot de passe à la première connexion si votre politique le prévoit.'],validation:['L’utilisateur se connecte et accède uniquement aux fonctions et à l’établissement autorisés.','Consignez l’opérateur, la date de création et le rôle dans l’historique du ticket.'],assumptions:['Il s’agit de conseils généraux sûrs, pas d’une procédure OPERA interne validée ; un administrateur OPERA habilité doit effectuer l’action.'],suggested_ticket:{title:'OPERA : création d’un utilisateur',description:`Demande : ${message}\n\nÀ confirmer : hôtel, département, rôle, périmètre et approbation du responsable.`,category:'IT / Réseau',priority:'Normale'}};
  }
  if(isAr)return {answer:`وضع المساعدة المؤقت: يتعذر الوصول إلى خدمة الذكاء الاصطناعي حالياً. سنبدأ بتشخيص آمن لمشكلة ${label}.`,causes:['انقطاع الخدمة أو المشكلة غير محددة بما يكفي'],questions:['ما الرسالة الظاهرة بالضبط؟','منذ متى بدأت المشكلة؟','هل يتأثر مستخدم واحد أم عدة مستخدمين؟'],checks:['تحقق من اتصال الشبكة ومن وقت الجهاز — يجب أن يكونا صحيحين — دوّن النتيجة.','تحقق من وجود رسالة خطأ أو رقم مرجعي — يجب عدم مشاركة كلمات المرور أو البيانات الحساسة — أرفقه في الوصف.'],solution:['لا تغيّر إعدادات الإنتاج أو الحسابات تلقائياً. اجمع النتائج وأنشئ تذكرة إذا استمرت المشكلة.'],validation:['تأكد من عودة الخدمة للمستخدم المتأثر بعد إجراء التحقق المصرح به.'],assumptions:['هذه إرشادات مؤقتة وليست إجراءً داخلياً معتمداً. تتطلب أي خطوة مؤثرة مراجعة بشرية.'],suggested_ticket:{title:`${label}: ${message.slice(0,100)}`,description:`Demande initiale : ${message}\n\nVérifications proposées : connexion réseau, heure du poste, message d’erreur exact.`,category:'IT / Réseau',priority:'Normale'}};
  if(isEn)return {answer:`Temporary guidance mode: the AI provider is currently unavailable. We can still start a safe diagnosis for ${label}.`,causes:['Service interruption or insufficient incident details'],questions:['What exact error message is displayed?','When did the problem begin?','Does it affect one user or several users?'],checks:['Check network connectivity and device time — both should be correct — record the result.','Check for an error message or reference number — never include passwords or sensitive customer data — add it to the description.'],solution:['Do not change production settings or accounts automatically. Record the findings and create a ticket if the issue continues.'],validation:['Confirm the affected user can use the service again after an authorized check.'],assumptions:['This is temporary guidance, not an approved internal procedure. Human review is required for any impactful step.'],suggested_ticket:{title:`${label}: ${message.slice(0,100)}`,description:`Initial request: ${message}\n\nSuggested checks: network connectivity, workstation time, exact error message.`,category:'IT / Réseau',priority:'Normale'}};
  return {answer:`Mode d’accompagnement temporaire : le fournisseur IA est indisponible. Nous pouvons tout de même démarrer un diagnostic sûr pour ${label}.`,causes:['Indisponibilité du service ou informations insuffisantes'],questions:['Quel message d’erreur s’affiche exactement ?','Depuis quand le problème a-t-il commencé ?','Le problème concerne-t-il un utilisateur ou plusieurs ?'],checks:['Vérifiez la connexion réseau et l’heure du poste — elles doivent être correctes — notez le résultat.','Relevez le message d’erreur ou sa référence — ne transmettez jamais de mot de passe ni donnée client — ajoutez-le à la description.'],solution:['Ne modifiez pas automatiquement un compte ou un paramètre de production. Consignez les résultats et créez un ticket si le problème persiste.'],validation:["Vérifiez que le service refonctionne pour l’utilisateur concerné après une vérification autorisée."],assumptions:["Ces conseils temporaires ne constituent pas une procédure interne validée. Toute action à impact nécessite une validation humaine."],suggested_ticket:{title:`${label} : ${message.slice(0,100)}`,description:`Demande initiale : ${message}\n\nVérifications proposées : connexion réseau, heure du poste, message d’erreur exact.`,category:'IT / Réseau',priority:'Normale'}};
};

function parseAnswer(raw:string){
  try { const parsed=JSON.parse(raw.replace(/```json|```/g,'').trim()); return {
    answer:clean(parsed.answer,4000), causes:toText(parsed.causes), questions:toText(parsed.questions), checks:toText(parsed.checks), solution:toText(parsed.solution), validation:toText(parsed.validation), assumptions:toText(parsed.assumptions),
    suggested_ticket:{title:clean(parsed.suggested_ticket?.title,180),description:clean(parsed.suggested_ticket?.description,5000),category:clean(parsed.suggested_ticket?.category,80),priority:priority(parsed.suggested_ticket?.priority)}
  }; } catch { return {answer:clean(raw,4000),questions:[],checks:[],solution:[],validation:[],assumptions:['Réponse non structurée : validation humaine requise.'],suggested_ticket:{title:'',description:'',category:'IT / Réseau'}}; }
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:headers(req)});
  if(req.method!=='POST')return send(req,{error:'Méthode non autorisée.'},405);
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim();
  if(!token||!URL||!ANON)return send(req,{error:'Session utilisateur requise.'},401);
  const userClient=createClient(URL,ANON,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user}}=await userClient.auth.getUser(token);
  if(!user)return send(req,{error:'Session expirée ou invalide.'},401);
  if((!GEMINI_KEY&&!OPENAI_KEY&&!ANTHROPIC_KEY)||!SERVICE)return send(req,{error:'Le service Assistant IT n’est pas configuré côté serveur.'},503);
  let input:any;try{input=await req.json();}catch{return send(req,{error:'Données invalides.'},400);}
  const action=input.action==='ticket'?'ticket':'chat';
  const domain=domains.has(input.domain)?input.domain:'general';
  const language=['fr','en','ar'].includes(input.language)?input.language:'fr';
  const service=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  let ticket:any=null;
  if(action==='ticket'){
    const ticketId=String(input.ticket_id??'');
    const {data,error}=await userClient.from('tickets').select('id,numero,titre,description,categorie,priorite,statut,hotel,assigne_a,created_at').eq('id',ticketId).maybeSingle();
    if(error||!data)return send(req,{error:'Ticket introuvable ou accès non autorisé.'},403);
    ticket=data;
  }
  let conversation:any=null;
  const message=clean(input.message,6000);
  if(action==='chat'){
    if(!message)return send(req,{error:'Décrivez votre problème avant de lancer l’assistant.'},400);
    const conversationId=String(input.conversation_id??'');
    if(conversationId){
      const {data,error}=await service.from('it_ai_conversations').select('*').eq('id',conversationId).eq('user_id',user.id).maybeSingle();
      if(error||!data)return send(req,{error:'Conversation introuvable ou accès non autorisé.'},403); conversation=data;
    }else{
      const {data,error}=await service.from('it_ai_conversations').insert({user_id:user.id,domain,title:message.slice(0,120)}).select().single();
      if(error)return send(req,{error:'Impossible de créer la conversation.'},500); conversation=data;
    }
  }
  const hotel=ticket?.hotel??null;
  const {data:allProcedures}=await service.from('it_procedures').select('id,title,domain,content,source_label,source_url,effective_date,hotel').eq('is_validated',true).in('domain',[domain,'general']).order('effective_date',{ascending:false}).limit(12);
  const procedures=(allProcedures??[]).filter(p=>p.hotel===null||p.hotel===hotel).slice(0,4);
  const procedureContext=procedures.map(p=>`[${p.id}] ${p.title} | ${p.source_label} | ${p.effective_date}\n${p.content}`).join('\n\n');
  let history:any[]=[];
  if(conversation){const {data}=await service.from('it_ai_messages').select('author,content').eq('conversation_id',conversation.id).order('created_at',{ascending:false}).limit(10);history=(data??[]).reverse();}
  const words=clean(ticket?.titre??message,120).split(/\s+/).filter(word=>word.length>=4).slice(0,3);
  let similarTickets:any[]=[];
  if(words.length){
    const term=words[0].replace(/[%_]/g,'');
    if(term){
      const query=userClient.from('tickets').select('id,numero,titre,description,categorie,statut,created_at').ilike('titre',`%${term}%`).order('created_at',{ascending:false}).limit(3);
      if(ticket)query.neq('id',ticket.id);
      const {data}=await query;similarTickets=(data??[]).map(item=>({...item,description:clean(item.description,700)}));
    }
  }
  const context=action==='ticket'?`Ticket ${ticket.numero}: ${ticket.titre}\nDescription: ${clean(ticket.description,5000)}\nCatégorie: ${ticket.categorie}; priorité: ${ticket.priorite}; statut: ${ticket.statut}; hôtel: ${ticket.hotel}`:`Domaine: ${domain}\nConversation précédente:\n${history.map(item=>`${item.author}: ${item.content}`).join('\n')}\nNouvelle demande: ${message}`;
  const prompt=`Tu es l’assistant IT interne d’un groupe hôtelier. Réponds en ${language==='ar'?'arabe':language==='en'?'anglais':'français'}.
Tu conseilles seulement : ne demande jamais ni n’affiche mots de passe, clés, jetons, données clients ou données de carte bancaire. N’affirme jamais qu’une procédure non citée est validée. Si les informations sont insuffisantes, pose au maximum trois questions ciblées à la fois. Pour Sage 1000, Citrix, OPERA PMS, POS, Microsoft 365 et réseau, ne fabrique jamais de commandes, paramètres ou procédures propres au client. Privilégie l’interface graphique. Si une commande est utile, précise son objectif, le résultat attendu et l’action suivante. Pour Sage, OPERA, POS et opérations de production, rappelle le risque, la sauvegarde et la validation humaine avant une action à impact. Ne propose jamais une action destructive ni un changement automatique.
Procédures internes validées (elles seules peuvent être décrites comme validées) :\n${procedureContext||'Aucune procédure validée applicable.'}\n\nIncidents similaires visibles pour cet utilisateur :\n${similarTickets.map(item=>`${item.numero} | ${item.titre} | ${item.categorie} | ${item.statut}\n${item.description}`).join('\n')||'Aucun incident similaire exploitable.'}\n\nContexte :\n${context}\n\nRéponds uniquement avec JSON : {"answer":"résumé du problème","causes":["causes probables"],"questions":["..."],"checks":["Vérification — résultat attendu — action suivante"],"solution":["..."],"validation":["..."],"assumptions":["..."],"suggested_ticket":{"title":"...","description":"résumé, diagnostic et vérifications déjà réalisées","category":"catégorie existante la plus proche","priority":"P1/P2/P3/P4 ou Urgente/Haute/Normale/Basse"}}.`;
  try{
    const providerName=GEMINI_KEY?'gemini':OPENAI_KEY?'openai':'anthropic';
    const response=GEMINI_KEY
      ?await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:1200}})})
      :OPENAI_KEY
      ?await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${OPENAI_KEY}`},body:JSON.stringify({model:'gpt-4o-mini',max_tokens:1200,response_format:{type:'json_object'},messages:[{role:'system',content:'Tu réponds uniquement avec un objet JSON valide.'},{role:'user',content:prompt}]})})
      :await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY!,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,messages:[{role:'user',content:prompt}]})});
    const providerUnavailable=!response.ok;
    if(providerUnavailable)console.error('AI provider',response.status);
    const provider=providerUnavailable?null:await response.json();
    const providerText=providerName==='gemini'
      ?provider?.candidates?.[0]?.content?.parts?.map((part:any)=>part?.text ?? '').join('')
      :providerName==='openai' ? provider?.choices?.[0]?.message?.content : (provider?.content?.[0]?.text ?? '');
    const answer=providerUnavailable?fallbackAnswer(domain,message,language):parseAnswer(String(providerText));
    const sources=(procedures??[]).map(p=>({id:p.id,title:p.title,source:p.source_label,date:p.effective_date,url:p.source_url}));
    if(conversation){
      await service.from('it_ai_messages').insert([{conversation_id:conversation.id,author:'user',content:message},{conversation_id:conversation.id,author:'assistant',content:answer.answer,metadata:{...answer,sources}}]);
      await service.from('it_ai_conversations').update({updated_at:new Date().toISOString()}).eq('id',conversation.id);
      return send(req,{conversation_id:conversation.id,answer,sources,similar_tickets:similarTickets});
    }
    return send(req,{ticket_id:ticket.id,answer,sources,similar_tickets:similarTickets});
  }catch(error){console.error('ai-it-assistant',error);const answer=fallbackAnswer(domain,message,language);const sources=[];if(conversation){await service.from('it_ai_messages').insert([{conversation_id:conversation.id,author:'user',content:message},{conversation_id:conversation.id,author:'assistant',content:answer.answer,metadata:{...answer,sources,fallback:true}}]);return send(req,{conversation_id:conversation.id,answer,sources,similar_tickets:similarTickets});}return send(req,{ticket_id:ticket?.id,answer,sources,similar_tickets:similarTickets});}
});
