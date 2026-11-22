(()=>{
'use strict';
const $=id=>document.getElementById(id),BASE='https://imsisbixzkqphooxyfhr.supabase.co';
const KEY='sb_publishable_mS_TDGKZhUuJi-rxc5Nu1w_IXODeo-_';
const STORE='nejlon.prescon.central.session.v1';
let session=null,sources=[];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
async function parse(r){let x={};try{x=await r.json()}catch{}if(!r.ok)throw Error(String(x.error_description||x.error?.message||x.error||x.message||'Falha na solicitação.').slice(0,260));return x}
async function api(action,data,retry=true){
 if(!session?.access_token)throw Error('Entre como PRESCON.');
 const r=await fetch(BASE+'/functions/v1/prescon-workspace?action='+encodeURIComponent(action),{
  method:data===undefined?'GET':'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  ...(data===undefined?{}:{body:JSON.stringify(data)})});
 if(r.status===401&&retry&&session.refresh_token){
  session=await parse(await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',
   headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})}));
  sessionStorage.setItem(STORE,JSON.stringify(session));return api(action,data,false);
 }
 return parse(r);
}
function show(){
 const logged=!!session?.access_token;
 $('delib-login').hidden=logged;$('delib-logout').hidden=!logged;
 $('delib-session').textContent=logged?'Sessão institucional conectada.':'Entre para consultar e salvar deliberações reais.';
 $('delib-create').querySelector('button[type=submit]').disabled=!logged;
 $('delib-finalize').querySelector('button[type=submit]').disabled=!logged;
}
async function load(){
 if(!session?.access_token)return;
 try{
  const result=await api('deliberation_sources');sources=result.sources||[];
  const list=$('delib-list'),select=$('delib-finalize-id');
  list.innerHTML=sources.length?sources.map(x=>'<article class="apps-connection"><div><strong>'+esc(x.title)+'</strong><p>Tipo: '+esc(x.source_kind==='pf'?'Planejamento Financeiro':'Calendário')+' · Formulário: '+esc(x.form_status)+' · Relatório: '+esc(x.status)+'</p>'+
   '<small>Arquivo: '+esc(x.filename)+'</small><p><a href="'+esc(x.source_url)+'" target="_blank" rel="noopener noreferrer">Abrir planilha original no Drive ↗</a>'+
   (x.report_url?' · <a href="'+esc(x.report_url)+'" target="_blank" rel="noopener noreferrer">Abrir relatório Google Docs ↗</a>':'')+'</p></div></article>').join(''):'<p>Nenhuma deliberação com planilha importada ainda.</p>';
  select.innerHTML='<option value="">Selecione uma deliberação encerrada</option>'+sources.filter(x=>x.form_status==='closed'&&x.status!=='finalized').map(x=>'<option value="'+esc(x.form_id)+'">'+esc(x.title)+'</option>').join('');
 }catch(e){$('delib-list').textContent='Não foi possível carregar: '+e.message}
}
$('delib-login').addEventListener('submit',async e=>{
 e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
 try{
  const fd=new FormData(e.target);
  const login=await parse(await fetch(BASE+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
   body:JSON.stringify({email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')})}));
  session=login;await api('deliberation_sources');
  sessionStorage.setItem(STORE,JSON.stringify(session));e.target.reset();show();await load();
 }catch(err){session=null;sessionStorage.removeItem(STORE);$('delib-session').textContent=err.message;show()}
 finally{b.disabled=false}
});
$('delib-logout').addEventListener('click',()=>{session=null;sessionStorage.removeItem(STORE);sources=[];$('delib-list').textContent='Sessão encerrada.';show()});
$('delib-refresh').addEventListener('click',load);
async function base64(file){
 const bytes=new Uint8Array(await file.arrayBuffer());let out='';
 for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(out);
}
$('delib-create').addEventListener('submit',async e=>{
 e.preventDefault();const b=e.target.querySelector('button[type=submit]'),status=$('delib-create-status');
 const data=new FormData(e.target),file=data.get('file');
 if(!file||file.size>4*1024*1024||file.size<50){status.textContent='A planilha deve ter entre 50 bytes e 4 MB.';return}
 if(!/\.(xlsx|xls|ods)$/i.test(file.name)){status.textContent='Selecione uma planilha .xlsx, .xls ou .ods.';return}
 b.disabled=true;status.textContent='Enviando planilha original para o Drive privado e criando rascunho…';
 try{
  const result=await api('deliberation_create',{title:String(data.get('title')||''),kind:data.get('kind'),
   filename:file.name,base64:await base64(file)});
  status.textContent=result.message;
  e.target.reset();await load();
 }catch(err){status.textContent=err.message}
 finally{b.disabled=false}
});
$('delib-finalize').addEventListener('submit',async e=>{
 e.preventDefault();const b=e.target.querySelector('button[type=submit]'),status=$('delib-finalize-status');
 const data=new FormData(e.target);
 if(!window.confirm('Confirma que a votação foi encerrada, as respostas foram conferidas e a decisão final está correta? O Google Docs será criado agora.'))return;
 b.disabled=true;status.textContent='Consolidando respostas aceitas e criando relatório no Google Docs…';
 try{
  const result=await api('deliberation_finalize',{formId:data.get('formId'),decision:data.get('decision'),
   notes:data.get('notes'),confirm:data.has('confirm')});
  status.textContent=result.message||'Relatório gerado.';
  if(result.url){const a=document.createElement('a');a.href=result.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' Abrir relatório no Google Docs ↗';status.appendChild(a)}
  e.target.reset();await load();
 }catch(err){status.textContent=err.message}
 finally{b.disabled=false}
});
show();if(session?.access_token)load();
})();
