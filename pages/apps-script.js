(()=>{
'use strict';
const $=id=>document.getElementById(id);
const BASE='https://imsisbixzkqphooxyfhr.supabase.co';
const KEY='sb_publishable_mS_TDGKZhUuJi-rxc5Nu1w_IXODeo-_';
const STORE='nejlon.prescon.solo.v1';
const OTHERS=['nejlon.prescon.central.session.v1',STORE];
const SHEET='1DdwqLHLDsHzD5dF344gKRtQSQMbhN-DplkqMc7z9sdI';
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Nunca';
let session=null,oneTimeToken=null;
for(const k of OTHERS){try{const v=JSON.parse(sessionStorage.getItem(k)||'null');if(v?.access_token){session=v;break}}catch{}}
async function parsed(response){
 let result={};try{result=await response.json()}catch{}
 if(!response.ok)throw Error(String(result.error_description||result.error?.message||result.error||result.message||'Ação indisponível.').slice(0,300));
 return result;
}
async function refresh(){
 if(!session?.refresh_token)throw Error('Sessão expirada. Faça login novamente.');
 const response=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{
  method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
  body:JSON.stringify({refresh_token:session.refresh_token})
 });
 session=await parsed(response);sessionStorage.setItem(STORE,JSON.stringify(session));
}
async function api(action,body,retry=true){
 if(!session?.access_token)throw Error('Entre como PRESCON para gerenciar conexões.');
 let response;
 try{response=await fetch(BASE+'/functions/v1/prescon-workspace?action='+encodeURIComponent(action),{
  method:body===undefined?'GET':'POST',
  headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 })}catch{throw Error('Sem conexão com o Supabase. Verifique sua internet.')}
 if(response.status===401&&retry){await refresh();return api(action,body,false)}
 return parsed(response);
}
function logged(){return !!session?.access_token}
function viewAuth(){
 $('apps-login-form').hidden=logged();
 $('apps-logout').hidden=!logged();
 $('apps-issue-form').querySelector('button[type=submit]').disabled=!logged();
 $('apps-session-label').textContent=logged()?'PRESCON conectada':'Explorar sem senha';
 $('apps-session-status').textContent=logged()?'Sua conta institucional está conectada. Apenas você pode criar ou revogar esta integração.':
   'Entre como PRESCON para gerar e revogar conexões reais. A explicação abaixo está disponível sem login.';
}
function hideSecret(){
 oneTimeToken=null;
 $('apps-token-value').textContent='';
 $('apps-secret-panel').hidden=true;
}
function renderConnections(items){
 const el=$('apps-connections');
 if(!items?.length){el.innerHTML='<p class="automation-muted">Nenhuma conexão cadastrada. Gere uma chave para começar.</p>';return}
 el.innerHTML=items.map(item=>
  '<article class="apps-connection"><div><strong>'+escapeHtml(item.label)+'</strong>'+
  '<p>Status: <b>'+escapeHtml(item.status==='active'?'Ativa':item.status==='revoked'?'Revogada':'Expirada')+'</b></p>'+
  '<small>Criada: '+escapeHtml(date(item.issued_at))+' · Último acesso: '+escapeHtml(date(item.last_used_at))+' · Expira: '+escapeHtml(date(item.expires_at))+'</small></div>'+
  (item.status==='active'?'<button type="button" class="btn" data-revoke="'+escapeHtml(item.id)+'">Revogar conexão</button>':'')+
  '</article>'
 ).join('');
}
async function load(){
 if(!logged())return renderConnections(null);
 try{const r=await api('apps_script_connections');renderConnections(r.connections)}
 catch(error){$('apps-connections').textContent='Não foi possível consultar conexões: '+error.message}
}
async function copy(value){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return}
 const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
 const ok=document.execCommand('copy');field.remove();if(!ok)throw Error('O navegador não permitiu copiar automaticamente.');
}
$('apps-login-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;
 $('apps-login-error').textContent='Validando perfil…';
 try{
  const fields=new FormData(e.target);
  const login=await parsed(await fetch(BASE+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
   body:JSON.stringify({email:String(fields.get('email')||'').trim(),password:String(fields.get('password')||'')})
  }));
  session=login;
  sessionStorage.setItem(STORE,JSON.stringify(session));
  await api('apps_script_connections');
  e.target.reset();$('apps-login-error').textContent='Conectado com segurança à conta PRESCON.';
  viewAuth();await load();
 }catch(error){$('apps-login-error').textContent=error.message;session=null;sessionStorage.removeItem(STORE);viewAuth()}
 finally{button.disabled=false}
});
$('apps-logout').addEventListener('click',()=>{
 session=null;sessionStorage.removeItem(STORE);hideSecret();viewAuth();
 renderConnections(null);$('apps-login-error').textContent='Sessão encerrada.';
});
$('apps-issue-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!logged())return;
 const button=e.target.querySelector('button[type=submit]');button.disabled=true;
 try{
  const result=await api('apps_script_issue',{
   label:String(new FormData(e.target).get('label')||'').trim(),spreadsheetId:SHEET
  });
  oneTimeToken=result.token;
  $('apps-token-value').textContent=oneTimeToken;
  $('apps-secret-panel').hidden=false;
  $('apps-secret-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
  await load();
 }catch(error){$('apps-login-error').textContent=error.message}
 finally{button.disabled=false}
});
$('apps-copy-token').addEventListener('click',async()=>{
 if(!oneTimeToken)return;
 try{await copy(oneTimeToken);$('apps-copy-token').textContent='Copiado!'}catch(err){window.prompt('Copie a chave (não compartilhe):',oneTimeToken)}
});
$('apps-copy-sheet').addEventListener('click',async()=>{
 try{await copy(SHEET);$('apps-copy-sheet').textContent='ID copiado!'}catch{window.prompt('Copie o ID da planilha:',SHEET)}
});
$('apps-connections').addEventListener('click',async event=>{
 const button=event.target.closest('button[data-revoke]');if(!button)return;
 if(!window.confirm('Revogar esta conexão agora? O Apps Script deixará de receber novos dados até configurar outra chave.'))return;
 button.disabled=true;
 try{await api('apps_script_revoke',{id:button.dataset.revoke});hideSecret();await load()}
 catch(error){$('apps-login-error').textContent=error.message}
 finally{button.disabled=false}
});
viewAuth();if(logged())load();
})();
