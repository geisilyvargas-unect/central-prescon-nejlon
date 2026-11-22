const SB=Deno.env.get('SUPABASE_URL')||'https://imsisbixzkqphooxyfhr.supabase.co';
const SECRET=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const PUBLIC=Deno.env.get('SUPABASE_ANON_KEY')||'sb_publishable_mS_TDGKZhUuJi-rxc5Nu1w_IXODeo-_';
const GOOGLE_ID=Deno.env.get('GOOGLE_CLIENT_ID')||'';
const GOOGLE_SECRET=Deno.env.get('GOOGLE_CLIENT_SECRET')||'';
const GOOGLE_CRYPT=Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY')||'';
const ORIGINS=new Set(['https://geisilyvargas-unect.github.io','http://localhost:5500','http://127.0.0.1:5500']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const FN=SB+'/functions/v1/prescon-workspace';
const FINISH='https://geisilyvargas-unect.github.io/central-prescon-nejlon/pages/operacao.html';
class ErrorHttp extends Error{constructor(status,message){super(message);this.status=status}}
function bad(status,msg){throw new ErrorHttp(status,msg)}
function clean(v,n=2500){return String(v??'').trim().slice(0,n)}
function response(req,value,status=200){
 const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'});
 const origin=req.headers.get('origin')||'';if(ORIGINS.has(origin))h.set('Access-Control-Allow-Origin',origin);
 return new Response(JSON.stringify(value),{status,headers:h});
}
async function asJson(r){let v={};try{v=await r.json()}catch{}if(!r.ok)bad(r.status>=500?502:r.status,clean(v.message||v.error_description||v.error?.message||v.error||'Erro no servidor',250));return v}
async function db(table,{method='GET',query='',data,prefer}={}){
 if(!SECRET)bad(503,'O servidor Supabase ainda não está configurado.');
 const r=await fetch(SB+'/rest/v1/'+table+(query?'?'+query:''),{method,headers:{apikey:SECRET,Authorization:'Bearer '+SECRET,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return asJson(r);
}
async function identity(req){
 const h=req.headers.get('authorization')||'';
 if(!h.startsWith('Bearer '))bad(401,'Entre na sua conta PRESCON.');
 const user=await asJson(await fetch(SB+'/auth/v1/user',{headers:{apikey:PUBLIC,Authorization:h}}));
 const p=(await db('profiles',{query:'select=id,email,full_name,role,active&id=eq.'+user.id+'&limit=1'}))[0];
 if(!p||!p.active||p.role!=='prescon')bad(403,'Somente a PRESCON pode acessar os registros privados.');
 return p;
}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))}
function b64(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function un64(s){const x=s.replaceAll('-','+').replaceAll('_','/');return Uint8Array.from(atob(x+'='.repeat((4-x.length%4)%4)),c=>c.charCodeAt(0))}
async function hash(s){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))))}
async function key(){const bytes=un64(GOOGLE_CRYPT);if(bytes.length!==32)bad(503,'Chave Google de criptografia inválida.');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt'])}
async function encrypt(value){const iv=crypto.getRandomValues(new Uint8Array(12));const e=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(value));return b64(iv)+'.'+b64(new Uint8Array(e))}
async function decrypt(value){const [iv,data]=String(value||'').split('.');if(!iv||!data)bad(409,'Conexão Google antiga; reconecte.');const out=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv)},await key(),un64(data));return new TextDecoder().decode(out)}
function oauthReady(){return !!(GOOGLE_ID&&GOOGLE_SECRET&&GOOGLE_CRYPT)}
async function authUrl(user){
 if(!oauthReady())bad(503,'Configure as credenciais OAuth do Google no Supabase antes de conectar.');
 const state=b64(crypto.getRandomValues(new Uint8Array(32))),verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
 await db('portal_workspace_oauth_states',{method:'POST',data:{state_hash:await hash(state),owner_user_id:user.id,pkce_verifier:verifier,expires_at:new Date(Date.now()+600000).toISOString()}});
 const args=new URLSearchParams({client_id:GOOGLE_ID,response_type:'code',redirect_uri:FN+'/callback',scope:'openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets',access_type:'offline',prompt:'consent',state,code_challenge:await hash(verifier),code_challenge_method:'S256'});
 return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+args};
}
async function callback(url){
 if(url.searchParams.get('error'))return Response.redirect(FINISH+'?google=cancelado',302);
 const code=url.searchParams.get('code'),state=url.searchParams.get('state');if(!code||!state)bad(400,'Autorização inválida.');
 const codehash=await hash(state);
 const row=(await db('portal_workspace_oauth_states',{query:'select=owner_user_id,pkce_verifier,expires_at,used_at&state_hash=eq.'+encodeURIComponent(codehash)+'&limit=1'}))[0];
 if(!row||row.used_at||Date.parse(row.expires_at)<Date.now())bad(400,'Autorização expirada.');
 const locked=await db('portal_workspace_oauth_states',{method:'PATCH',query:'state_hash=eq.'+encodeURIComponent(codehash)+'&used_at=is.null',prefer:'return=representation',data:{used_at:new Date().toISOString()}});
 if(!locked.length)bad(409,'Autorização já utilizada.');
 const token=await asJson(await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:GOOGLE_ID,client_secret:GOOGLE_SECRET,redirect_uri:FN+'/callback',code_verifier:row.pkce_verifier,grant_type:'authorization_code'})}));
 if(!token.refresh_token)bad(409,'Google não enviou refresh_token; tente conectar novamente.');
 let email='';try{const u=await asJson(await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token}}));email=u.email||''}catch{}
 await db('portal_google_connections',{method:'POST',query:'on_conflict=owner_user_id',prefer:'resolution=merge-duplicates,return=minimal',data:{owner_user_id:row.owner_user_id,email,encrypted_refresh_token:await encrypt(token.refresh_token),connected_at:new Date().toISOString()}});
 return Response.redirect(FINISH+'?google=conectado',302);
}
async function googleToken(user){
 const row=(await db('portal_google_connections',{query:'select=encrypted_refresh_token&owner_user_id=eq.'+user.id+'&limit=1'}))[0];
 if(!row)bad(409,'Conecte a conta Google primeiro.');
 const refresh=await decrypt(row.encrypted_refresh_token);
 const token=await asJson(await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:GOOGLE_ID,client_secret:GOOGLE_SECRET,refresh_token:refresh,grant_type:'refresh_token'})}));
 return token.access_token;
}
async function google(uri,token,{method='GET',data}={}){
 const r=await fetch(uri,{method,headers:{Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});return asJson(r);
}
async function dashboard(user){
 const [meetings,tasks,demands,ejs,forms,justs,votes,externals,artifacts,accounts,prefs]=await Promise.all([
  db('prescon_meetings',{query:'select=*&owner_user_id=eq.'+user.id+'&order=created_at.desc&limit=120'}),
  db('prescon_actions',{query:'select=*&owner_user_id=eq.'+user.id+'&order=created_at.desc&limit=400'}),
  db('demands',{query:'select=id,ej_id,title,due_at,severity,status,created_at&order=created_at.desc&limit=1500'}),
  db('ejs',{query:'select=id,name&order=name.asc&limit=100'}),
  db('portal_forms',{query:'select=id,title,status,kind,due_at,google_responder_url&order=created_at.desc&limit=100'}),
  db('portal_demand_justifications',{query:'select=id,demand_id,ej_id,explanation,state,created_at&state=eq.pending_review&limit=400'}),
  db('portal_vote_change_authorizations',{query:'select=id,ej_id,form_id,reason,created_at&status=eq.requested&limit=300'}),
  db('portal_form_submissions',{query:'select=id,form_id,ej_id,submitted_at,state&state=eq.pending_review&limit=400'}),
  db('portal_workspace_artifacts',{query:'select=title,kind,audience,file_url,last_synced_at,created_at&owner_user_id=eq.'+user.id+'&order=updated_at.desc&limit=100'}),
  db('portal_google_connections',{query:'select=email&owner_user_id=eq.'+user.id+'&limit=1'}),
  db('prescon_preferences',{query:'select=private_root_folder_url,council_root_folder_url,private_root_folder_id,council_root_folder_id&owner_user_id=eq.'+user.id+'&limit=1'})
 ]);
 const ejName=id=>ejs.find(x=>x.id===id)?.name||'EJ';
 const formName=id=>forms.find(x=>x.id===id)?.title||'Deliberação';
 const decisions=[
  ...justs.map(x=>({type:'demand',id:x.id,created_at:x.created_at,ej_name:ejName(x.ej_id),title:demands.find(d=>d.id===x.demand_id)?.title||'Demanda',explanation:x.explanation})),
  ...votes.map(x=>({type:'vote',id:x.id,created_at:x.created_at,ej_name:ejName(x.ej_id),form_title:formName(x.form_id),reason:x.reason})),
  ...externals.map(x=>({type:'external',id:x.id,created_at:x.submitted_at,ej_id:x.ej_id,ej_name:ejName(x.ej_id),form_title:formName(x.form_id),preview:'Conferir resposta recebida externamente'}))
 ];
 const next=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const deadlines=[...demands.filter(x=>x.due_at&&x.due_at<=next&&['pendente','em_andamento'].includes(x.status)).map(x=>({title:x.title,due:x.due_at,subtitle:ejName(x.ej_id)})),...tasks.filter(x=>x.due_on&&x.due_on<=next&&x.status!=='done').map(x=>({title:x.title,due:x.due_on,subtitle:'Encaminhamento'}))].sort((a,b)=>a.due.localeCompare(b.due));
 return {profile:{email:user.email,full_name:user.full_name},
  meetings:meetings.map(x=>({id:x.id,title:x.title,held_on:x.scheduled_at?.slice(0,10),agenda:x.agenda?.split('\n').filter(Boolean)||[],decisions:x.summary?.split('\n').filter(Boolean)||[]})),
  tasks,demands:demands.map(x=>({...x,ej_name:ejName(x.ej_id)})),ejs,forms,decisions,deadlines,artifacts,
  stats:{pending_decisions:decisions.length,total_demands:demands.length,open_demands:demands.filter(x=>['pendente','em_andamento'].includes(x.status)).length,completed_demands:demands.filter(x=>x.status==='concluida').length,justified_demands:demands.filter(x=>x.status==='justificada').length,open_forms:forms.filter(x=>x.status==='open').length,due7:deadlines.length},
  google:{connected:accounts.length>0,configured:oauthReady(),email:accounts[0]?.email||null,private_root_url:prefs[0]?.private_root_folder_url||null,council_root_url:prefs[0]?.council_root_folder_url||'https://drive.google.com/drive/folders/1lMt1bSog2AiDGEiYPf9uO2gQaXEOuNeg'}
 };
}
async function createMeeting(user,p){
 const title=clean(p.title,180),date=p.held_on;if(title.length<3||!validDate(date))bad(400,'Título ou data inválidos.');
 const agendas=Array.isArray(p.agenda)?p.agenda.map(x=>clean(x,300)).filter(Boolean).slice(0,50):[];
 const decisions=Array.isArray(p.decisions)?p.decisions.map(x=>clean(x,300)).filter(Boolean).slice(0,50):[];
 const v=await db('prescon_meetings',{method:'POST',prefer:'return=representation',data:{owner_user_id:user.id,title,scheduled_at:date+'T15:00:00Z',agenda:agendas.join('\n'),summary:decisions.join('\n'),private_notes:clean(p.notes,8000),state:'held'}});
 return {ok:true,id:v[0]?.id};
}
async function taskCreate(user,p){
 const title=clean(p.title,250);if(title.length<3||p.due_on&&!validDate(p.due_on))bad(400,'Encaminhamento inválido.');
 const v=await db('prescon_actions',{method:'POST',prefer:'return=representation',data:{owner_user_id:user.id,title,due_on:p.due_on||null}});
 return {ok:true,id:v[0]?.id};
}
async function taskStatus(user,p){
 if(!UUID.test(String(p.id))||!['pending','done'].includes(p.status))bad(400,'Atualização inválida.');
 const v=await db('prescon_actions',{method:'PATCH',query:'id=eq.'+p.id+'&owner_user_id=eq.'+user.id,prefer:'return=representation',data:{status:p.status,updated_at:new Date().toISOString()}});
 if(!v.length)bad(404,'Encaminhamento não encontrado.');return {ok:true};
}
async function demandCreate(user,p){
 if(!UUID.test(String(p.ejId))||!validDate(p.dueAt)||clean(p.title).length<4||clean(p.description).length<8)bad(400,'Confira EJ, título, descrição e prazo.');
 const severity=['amarela','laranja','vermelha'].includes(p.severity)?p.severity:'amarela';
 const rows=await db('demands',{method:'POST',prefer:'return=representation',data:{ej_id:p.ejId,title:clean(p.title,180),description:clean(p.description,4000),due_at:p.dueAt,status:'pendente',severity,responsible:'Conselho da EJ',created_by:user.id}});
 await db('portal_demand_events',{method:'POST',prefer:'return=minimal',data:{demand_id:rows[0].id,actor_id:user.id,actor_role:'prescon',action:'created',note:'Demanda cadastrada na Central PRESCON.',details:{severity}}});
 return {ok:true,id:rows[0].id};
}
async function decide(user,p){
 if(!UUID.test(String(p.id)))bad(400,'Solicitação inválida.');
 const note=clean(p.note,2500);
 if(p.type==='demand'||p.type==='vote'){
  if(note.length<8)bad(400,'Explique sua decisão (mínimo 8 caracteres).');
  if(!['approved','denied'].includes(p.choice))bad(400,'Decisão inválida.');
  if(p.type==='demand')await db('rpc/portal_decide_demand_justification',{method:'POST',data:{p_justification_id:p.id,p_actor_id:user.id,p_decision:p.choice==='approved'?'accepted':'rejected',p_note:note}});
  else await db('rpc/portal_review_vote_edit_request',{method:'POST',data:{p_authorization_id:p.id,p_prescon_id:user.id,p_decision:p.choice,p_note:note}});
  return {message:'Decisão da PRESCON registrada.'};
 }
 if(p.type==='external'){
  if(!['accepted','duplicate','rejected'].includes(p.choice))bad(400,'Decisão inválida.');
  if(p.choice==='accepted'&&!UUID.test(String(p.ejId)))bad(400,'Associe a resposta a uma EJ.');
  const rows=await db('portal_form_submissions',{method:'PATCH',query:'id=eq.'+p.id+'&state=eq.pending_review',prefer:'return=representation',data:{state:p.choice,ej_id:p.choice==='accepted'?p.ejId:null,reviewed_by:user.id,reviewed_at:new Date().toISOString(),review_note:note||'Conferido pela PRESCON'}});
  if(!rows.length)bad(409,'Resposta já analisada.');
  return {message:'Resposta externa classificada.'};
 }
 bad(400,'Tipo de decisão inválido.');
}
async function organize(user){
 const token=await googleToken(user);
 const current=(await db('prescon_preferences',{query:'select=private_root_folder_id,council_root_folder_id&owner_user_id=eq.'+user.id+'&limit=1'}))[0]||{};
 let privateId=current.private_root_folder_id;
 if(!privateId){
  const r=await google('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',token,{method:'POST',data:{name:'Central PRESCON NEJLON - PRIVADO',mimeType:'application/vnd.google-apps.folder'}});
  privateId=r.id;
 }
 const councilId=current.council_root_folder_id||'1lMt1bSog2AiDGEiYPf9uO2gQaXEOuNeg';
 const councilUrl='https://drive.google.com/drive/folders/'+councilId;
 const privateUrl='https://drive.google.com/drive/folders/'+privateId;
 await db('prescon_preferences',{method:'POST',query:'on_conflict=owner_user_id',prefer:'resolution=merge-duplicates,return=minimal',data:{owner_user_id:user.id,private_root_folder_id:privateId,private_root_folder_url:privateUrl,council_root_folder_id:councilId,council_root_folder_url:councilUrl,updated_at:new Date().toISOString()}});
 return {message:'Pasta privada preparada. Drive do Conselho vinculado como referência sem alterar arquivos.',url:privateUrl};
}
async function exportFile(user,p){
 const kind=p.kind;if(!['sheet','report','handover','meeting'].includes(kind))bad(400,'Documento inválido.');
 const token=await googleToken(user);
 const pref=(await db('prescon_preferences',{query:'select=private_root_folder_id&owner_user_id=eq.'+user.id+'&limit=1'}))[0]||{};
 if(!pref.private_root_folder_id)bad(409,'Clique primeiro em Preparar pastas para criar a área privada da PRESCON.');
 const content=await dashboard(user);
 const now=new Date().toLocaleDateString('pt-BR');
 if(kind==='sheet'){
  const rows=[['EJ','Demanda','Classificação','Prazo','Situação'],...content.demands.map(d=>[d.ej_name,d.title,d.severity,d.due_at||'',d.status])];
  const created=await google('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',token,{method:'POST',data:{name:'Acompanhamento PRESCON - '+new Date().toISOString().slice(0,10),mimeType:'application/vnd.google-apps.spreadsheet',parents:[pref.private_root_folder_id]}});
  const meta=await google('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(created.id)+'?fields=sheets.properties.title',token);
  const sheetName=meta.sheets?.[0]?.properties?.title||'Sheet1';
  const range=encodeURIComponent("'"+sheetName.replaceAll("'","''")+"'!A1:E"+rows.length);
  await google('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(created.id)+'/values/'+range+'?valueInputOption=RAW',token,{method:'PUT',data:{values:rows}});
  const fileUrl='https://docs.google.com/spreadsheets/d/'+created.id+'/edit';
  await db('portal_workspace_artifacts',{method:'POST',data:{owner_user_id:user.id,artifact_key:'sheet-'+crypto.randomUUID(),source_type:'demands',audience:'private',kind:'sheet',google_file_id:created.id,google_folder_id:pref.private_root_folder_id,title:created.name||'Acompanhamento',file_url:fileUrl,last_synced_at:new Date().toISOString()}});
  return {message:'Planilha criada na sua pasta privada. Ela não foi publicada ao Conselho.',url:fileUrl};
 }
 let title='',body='';
 if(kind==='meeting'){
  const meeting=(await db('prescon_meetings',{query:'select=*&id=eq.'+p.meetingId+'&owner_user_id=eq.'+user.id+'&limit=1'}))[0];
  if(!meeting)bad(404,'Reunião não encontrada.');
  title='Registro - '+meeting.title;body='REUNIÃO: '+meeting.title+'\nData: '+(meeting.scheduled_at?.slice(0,10)||'')+'\n\nPAUTA\n'+meeting.agenda+'\n\nDECISÕES REGISTRADAS\n'+meeting.summary+'\n\nNOTAS PRIVADAS\n'+meeting.private_notes;
 }else{
  title=kind==='handover'?'Cogestão PRESCON - '+now:'Relatório PRESCON - '+now;
  body=title+'\n\nReuniões: '+content.meetings.length+'\nDemandas em aberto: '+content.stats.open_demands+'\nDeliberações abertas: '+content.stats.open_forms+'\nDecisões a analisar: '+content.stats.pending_decisions+'\n\nENCAMINHAMENTOS\n'+content.tasks.map(t=>'- '+t.title+' ('+t.status+')').join('\n')+'\n\nDELIBERAÇÕES\n'+content.forms.map(f=>'- '+f.title+' ('+f.status+')').join('\n')+'\n\nDocumento privado: revisar antes de compartilhar.';
 }
 const created=await google('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',token,{method:'POST',data:{name:title,mimeType:'application/vnd.google-apps.document',parents:[pref.private_root_folder_id]}});
 await google('https://docs.googleapis.com/v1/documents/'+encodeURIComponent(created.id)+':batchUpdate',token,{method:'POST',data:{requests:[{insertText:{endOfSegmentLocation:{},text:body}}]}});
 const url='https://docs.google.com/document/d/'+created.id+'/edit';
 await db('portal_workspace_artifacts',{method:'POST',data:{owner_user_id:user.id,artifact_key:'doc-'+crypto.randomUUID(),source_type:kind==='meeting'?'meeting':'report',audience:'private',kind:'doc',google_file_id:created.id,google_folder_id:pref.private_root_folder_id,title,file_url:url,last_synced_at:new Date().toISOString()}});
 return {message:'Documento criado em sua pasta privada; revise antes de compartilhar.',url};
}
// Existing Council Drive file editor: precise edits only, no automatic overwrite.
const FILE_ID=/^[a-zA-Z0-9_-]{12,200}$/;
const FOLDER='1lMt1bSog2AiDGEiYPf9uO2gQaXEOuNeg';
function fileId(x){const id=String(x||'');if(!FILE_ID.test(id))bad(400,'Arquivo do Google Drive inválido.');return id}
async function fileInfo(id,token){
 return google('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId(id))+'?fields=id,name,mimeType,webViewLink,modifiedTime,parents,capabilities(canEdit)&supportsAllDrives=true',token);
}
async function driveList(user,params){
 const token=await googleToken(user),id=params.get('folder')||FOLDER;fileId(id);
 const query="'"+id+"' in parents and trashed = false";
 const search=new URLSearchParams({q:query,fields:'nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,parents,capabilities(canEdit))',
  pageSize:'100',orderBy:'name',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
 const page=clean(params.get('page')||'',600);if(page)search.set('pageToken',page);
 const r=await google('https://www.googleapis.com/drive/v3/files?'+search,token);
 return {folder:id,files:r.files||[],nextPageToken:r.nextPageToken||null};
}
function sheetTab(tab,sheets){
 const match=(sheets||[]).find(s=>s.properties?.title===tab);
 if(!match)bad(404,'Esta aba da planilha não existe.');
 return match;
}
function sheetA1(tab,startRow,endRow,endCol='L'){
 return "'"+tab.replaceAll("'","''")+"'!A"+startRow+':'+endCol+endRow;
}
async function sheetMeta(id,token){
 return google('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title,hidden,gridProperties(rowCount,columnCount)))',token);
}
async function sheetRead(user,params){
 const token=await googleToken(user),id=fileId(params.get('id')),info=await fileInfo(id,token);
 if(info.mimeType!=='application/vnd.google-apps.spreadsheet')bad(400,'Este arquivo não é uma planilha Google.');
 const meta=await sheetMeta(id,token);
 const tabs=(meta.sheets||[]).map(s=>({id:s.properties?.sheetId,title:s.properties?.title,hidden:!!s.properties?.hidden,rows:s.properties?.gridProperties?.rowCount||0,cols:s.properties?.gridProperties?.columnCount||0}));
 if(!tabs.length)bad(422,'A planilha está sem abas.');
 const tab=clean(params.get('tab')||tabs.find(t=>!t.hidden)?.title||tabs[0].title,200);
 const selected=sheetTab(tab,meta.sheets);
 const start=Math.min(9999,Math.max(1,parseInt(params.get('row')||'1',10)||1));
 const rowCount=Math.min(50,Math.max(1,(selected.properties?.gridProperties?.rowCount||50)-start+1));
 const colCount=Math.min(12,selected.properties?.gridProperties?.columnCount||12);
 if(rowCount<1||colCount<1)bad(400,'Aba sem intervalo de visualização.');
 const endCol=String.fromCharCode(64+colCount);
 const range=sheetA1(tab,start,start+rowCount-1,endCol);
 const values=await google('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMULA',token);
 return {type:'sheet',id,title:meta.properties?.title||info.name,canEdit:info.capabilities?.canEdit===true,
  tabs,selected:tab,startRow:start,columnCount:colCount,rowCount,values:values.values||[],range,
  url:info.webViewLink||'https://docs.google.com/spreadsheets/d/'+id+'/edit'};
}
async function sheetSave(user,p){
 const token=await googleToken(user),id=fileId(p.id),info=await fileInfo(id,token);
 if(info.mimeType!=='application/vnd.google-apps.spreadsheet'||info.capabilities?.canEdit!==true)bad(403,'Sua conta Google não tem edição desta planilha.');
 const meta=await sheetMeta(id,token),tab=clean(p.tab,200);
 const sheet=sheetTab(tab,meta.sheets),cell=String(p.cell||'').toUpperCase();
 if(!/^[A-Z]{1,3}[1-9][0-9]{0,5}$/.test(cell))bad(400,'Referência de célula inválida.');
 const m=cell.match(/^([A-Z]+)([0-9]+)$/);
 let col=0;for(const letter of m[1])col=col*26+letter.charCodeAt(0)-64;
 if(col>(sheet.properties?.gridProperties?.columnCount||0)||Number(m[2])>(sheet.properties?.gridProperties?.rowCount||0))bad(400,'A célula está fora dos limites da aba.');
 const before=clean(p.before,10000),next=String(p.value??'');
 if(next.length>10000)bad(400,'Valor longo demais.');
 const ref="'"+tab.replaceAll("'","''")+"'!"+cell,base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(ref);
 const current=await google(base+'?valueRenderOption=FORMULA',token);
 const actual=String(current.values?.[0]?.[0]??'');
 if(actual!==before)bad(409,'Esta célula mudou no Google Drive desde a abertura. Atualize a planilha antes de salvar.');
 if(actual===next)return {ok:true,unchanged:true,message:'Sem alterações na célula.'};
 // Values.update modifies the requested cell only and preserves validation and formatting elsewhere.
 await google(base+'?valueInputOption=USER_ENTERED',token,{method:'PUT',data:{range:ref,majorDimension:'ROWS',values:[[next]]}});
 return {ok:true,message:'Célula '+cell+' atualizada na planilha original do Google Drive.'};
}
async function docsData(id,token){
 return google('https://docs.googleapis.com/v1/documents/'+encodeURIComponent(id)+'?includeTabsContent=true',token);
}
function allDocRuns(doc){
 const results=[],tabs=[];
 const visitContent=(content,tabId,title)=>{
  for(const element of content||[]){
   if(element.paragraph){
    for(const e of element.paragraph.elements||[]){
     const value=e.textRun?.content||'';
     const trimmed=value.endsWith('\n')?value.slice(0,-1):value;
     if(!trimmed||trimmed.includes('\n')||typeof e.startIndex!=='number')continue;
     results.push({start:e.startIndex,end:e.startIndex+trimmed.length,text:trimmed,
       tabId:tabId||null,tabTitle:title||'Documento'});
    }
   }
   if(element.table)for(const row of element.table.tableRows||[])for(const c of row.tableCells||[])visitContent(c.content,tabId,title);
   if(element.tableOfContents)visitContent(element.tableOfContents.content,tabId,title);
  }
 };
 const visitTab=tab=>{
  const id=tab.tabProperties?.tabId,title=tab.tabProperties?.title||'Documento';
  tabs.push({id,title});
  visitContent(tab.documentTab?.body?.content,id,title);
  for(const child of tab.childTabs||[])visitTab(child);
 };
 if(doc.tabs?.length)for(const tab of doc.tabs)visitTab(tab);
 else{tabs.push({id:null,title:'Documento'});visitContent(doc.body?.content,null,'Documento')}
 return {runs:results.slice(0,500),tabs,totalRuns:results.length};
}
async function docRead(user,params){
 const token=await googleToken(user),id=fileId(params.get('id')),info=await fileInfo(id,token);
 if(info.mimeType!=='application/vnd.google-apps.document')bad(400,'Este arquivo não é um documento Google.');
 const doc=await docsData(id,token),content=allDocRuns(doc);
 return {type:'doc',id,title:doc.title||info.name,revisionId:doc.revisionId||null,canEdit:info.capabilities?.canEdit===true,
  ...content,url:info.webViewLink||'https://docs.google.com/document/d/'+id+'/edit'};
}
async function docSave(user,p){
 const token=await googleToken(user),id=fileId(p.id),info=await fileInfo(id,token);
 if(info.mimeType!=='application/vnd.google-apps.document'||info.capabilities?.canEdit!==true)bad(403,'Sua conta não pode editar esse documento.');
 const start=Number(p.start),end=Number(p.end),old=String(p.before??''),value=String(p.value??''),tabId=p.tabId||null;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<=start||end-start!==old.length||old.length>5000||value.length>5000)bad(400,'Trecho do documento inválido.');
 if(value.includes('\n')||value.includes('\r'))bad(400,'Edite apenas o trecho selecionado, sem criar novas linhas. Para trechos longos, use o Google Docs.');
 const doc=await docsData(id,token);
 if(!doc.revisionId||doc.revisionId!==p.revisionId)bad(409,'Documento alterado no Google Drive. Recarregue antes de salvar.');
 const {runs}=allDocRuns(doc);
 const match=runs.find(x=>x.start===start&&x.end===end&&x.text===old&&(x.tabId||null)===tabId);
 if(!match)bad(409,'O texto mudou ou já não está no trecho original. Atualize antes de salvar.');
 if(old===value)return {ok:true,unchanged:true,message:'O trecho não mudou.'};
 const range={startIndex:start,endIndex:end,...(tabId?{tabId}:{})};
 const location={index:start,...(tabId?{tabId}:{})};
 const requests=[{deleteContentRange:{range}}];
 if(value)requests.push({insertText:{location,text:value}});
 await google('https://docs.googleapis.com/v1/documents/'+encodeURIComponent(id)+':batchUpdate',token,{
  method:'POST',data:{requests,writeControl:{requiredRevisionId:doc.revisionId}}
 });
 return {ok:true,message:'Trecho salvo no Google Docs original. O restante do documento foi preservado.'};
}

Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(origin&&!ORIGINS.has(origin))return response(req,{error:'Origem não autorizada.'},403);
 const url=new URL(req.url);
 if(req.method==='OPTIONS'){
  const headers=new Headers({'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,apikey','Vary':'Origin'});if(origin)headers.set('Access-Control-Allow-Origin',origin);
  return new Response(null,{status:204,headers});
 }
 try{
  if(url.pathname.endsWith('/callback'))return await callback(url);
  const action=url.searchParams.get('action')||'dashboard';
  if(action==='health')return response(req,{ok:true,backend:'Supabase Edge Functions',oauthConfigured:oauthReady()});
  const user=await identity(req);
  if(req.method==='GET'){
   if(action==='dashboard')return response(req,await dashboard(user));
   if(action==='connect')return response(req,await authUrl(user));
   if(action==='drive_list')return response(req,await driveList(user,url.searchParams));
   if(action==='sheet_read')return response(req,await sheetRead(user,url.searchParams));
   if(action==='doc_read')return response(req,await docRead(user,url.searchParams));
   bad(404,'Consulta não reconhecida.');
  }
  if(req.method!=='POST')bad(405,'Método não permitido.');
  if(Number(req.headers.get('content-length')||0)>200000)bad(413,'Requisição muito grande.');
  const p=await req.json();
  const ops={meeting_create:()=>createMeeting(user,p),task_create:()=>taskCreate(user,p),task_status:()=>taskStatus(user,p),
   demand_create:()=>demandCreate(user,p),decide:()=>decide(user,p),organize:()=>organize(user),export:()=>exportFile(user,p),sheet_save:()=>sheetSave(user,p),doc_save:()=>docSave(user,p)};
  if(!ops[action])bad(404,'Ação não encontrada.');
  return response(req,await ops[action]());
 }catch(e){return response(req,{error:e instanceof ErrorHttp?e.message:'O servidor não conseguiu concluir a operação.'},e instanceof ErrorHttp?e.status:500)}
});
