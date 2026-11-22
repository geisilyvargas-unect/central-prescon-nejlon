(()=>{'use strict';
const $=id=>document.getElementById(id),SB='https://imsisbixzkqphooxyfhr.supabase.co',KEY='sb_publishable_mS_TDGKZhUuJi-rxc5Nu1w_IXODeo-_',STORE='nejlon.prescon.central.session.v1';
let session=null,data=null;try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(s){$('personal-auth-message').textContent=s}
async function parse(r){let x={};try{x=await r.json()}catch{}if(!r.ok)throw Error(typeof x.error==='string'?x.error:x.message||'Falha na operação.');return x}
async function api(action,p,retry=true){if(!session?.access_token)throw Error('Entre como PRESCON.');let r=await fetch(SB+'/functions/v1/prescon-workspace?action='+action,{method:p===undefined?'GET':'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},...(p===undefined?{}:{body:JSON.stringify(p)})});if(r.status===401&&retry&&session.refresh_token){session=await parse(await fetch(SB+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})}));sessionStorage.setItem(STORE,JSON.stringify(session));return api(action,p,false)}return parse(r)}
function list(id,items,render){$(id).innerHTML=items.length?items.map(render).join(''):'<p class="automation-muted">Nenhum registro.</p>'}
function view(name){document.querySelectorAll('.personal-view').forEach(x=>x.hidden=x.dataset.panel!==name);document.querySelectorAll('.personal-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.view===name))}
function render(){if(!data)return;const d=data;
$('personal-stats').innerHTML=Object.entries(d.stats||{}).map(([k,v])=>'<div class="automation-panel"><strong>'+esc(v)+'</strong><p>'+esc(({pending_decisions:'Decisões pendentes',total_demands:'Demandas',open_demands:'Demandas abertas',completed_demands:'Concluídas',open_forms:'Formulários abertos',due7:'Prazos próximos'})[k]||k)+'</p></div>').join('');
list('personal-home-decisions',(d.decisions||[]).slice(0,5),x=>'<p>'+esc(x.ej_name)+' · '+esc(x.title||x.form_title||x.type)+'</p>');
list('personal-deadlines',(d.deadlines||[]).slice(0,8),x=>'<p>'+esc(x.due)+' · '+esc(x.title)+' ('+esc(x.subtitle)+')</p>');
list('personal-decisions',d.decisions||[],x=>'<article class="automation-panel"><strong>'+esc(x.ej_name)+' · '+esc(x.title||x.form_title||x.type)+'</strong><p>'+esc(x.explanation||x.reason||x.preview||'')+'</p><form data-decision="'+esc(x.id)+'" data-type="'+esc(x.type)+'"><label>Decisão<select name="choice">'+(x.type==='external'?'<option value="accepted">Aceitar resposta</option><option value="duplicate">Duplicada</option><option value="rejected">Rejeitar resposta</option>':'<option value="approved">Aprovar</option><option value="denied">Rejeitar</option>')+'</select></label>'+(x.type==='external'?'<label>EJ<select name="ejId"><option value="">Selecione</option>'+d.ejs.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select></label>':'')+'<label>Justificativa<textarea name="note" required minlength="8"></textarea></label><button class="btn red">Registrar decisão</button></form></article>');
list('personal-meetings',d.meetings||[],x=>'<article><strong>'+esc(x.title)+'</strong><p>'+esc(x.held_on)+' · '+esc((x.decisions||[]).join('; '))+'</p></article>');
list('personal-actions',d.tasks||[],x=>'<article><strong>'+esc(x.title)+'</strong> · '+esc(x.due_on||'Sem prazo')+' · '+esc(x.status)+' <button type="button" class="btn" data-task="'+esc(x.id)+'" data-status="'+(x.status==='done'?'pending':'done')+'">'+(x.status==='done'?'Reabrir':'Concluir')+'</button></article>');
$('personal-ej').innerHTML='<option value="">Selecione</option>'+(d.ejs||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
$('personal-demands').innerHTML='<table><thead><tr><th>EJ</th><th>Demanda</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>'+(d.demands||[]).map(x=>'<tr><td>'+esc(x.ej_name)+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.due_at)+'</td><td>'+esc(x.status)+'</td></tr>').join('')+'</tbody></table>';
$('personal-google-status').textContent=d.google?.connected?'Conectado: '+d.google.email:'Conta Google não conectada. Autorize para criar ou editar arquivos.';
$('personal-private-root').innerHTML=d.google?.private_root_url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(d.google.private_root_url)+'">Abrir pasta privada</a>':'<p>Prepare a pasta após conectar o Google.</p>';
list('personal-artifacts',d.artifacts||[],x=>'<p><a target="_blank" rel="noopener noreferrer" href="'+esc(x.file_url||'#')+'">'+esc(x.title)+'</a></p>');
$('personal-report').textContent='Central PRESCON NEJLON\nDemandas: '+(d.stats?.total_demands||0)+'\nDemandas abertas: '+(d.stats?.open_demands||0)+'\nDecisões pendentes: '+(d.stats?.pending_decisions||0)+'\nFormulários abertos: '+(d.stats?.open_forms||0);
}
async function load(){data=await api('dashboard');render();status('Dados atualizados.');$('personal-login-form').hidden=true;$('personal-logout').hidden=false;$('personal-login-toggle').hidden=true}
async function run(fn){try{await fn()}catch(e){status(e.message);$('personal-toast').textContent=e.message}}
$('personal-login-toggle').onclick=()=>{$('personal-login-form').hidden=!$('personal-login-form').hidden};
$('personal-login-form').onsubmit=e=>{e.preventDefault();run(async()=>{const email=$('personal-email').value,password=$('personal-password').value;session=await parse(await fetch(SB+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})}));sessionStorage.setItem(STORE,JSON.stringify(session));$('personal-password').value='';await load()})};
$('personal-logout').onclick=()=>{session=null;data=null;sessionStorage.removeItem(STORE);location.reload()};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));document.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>view(b.dataset.target));
$('personal-refresh-decisions').onclick=()=>run(load);
async function formSubmit(id,action,mapper){$(id).onsubmit=e=>{e.preventDefault();run(async()=>{const p=Object.fromEntries(new FormData(e.target));await api(action,mapper?mapper(p):p);e.target.reset();await load()})}}
formSubmit('personal-meeting-form','meeting_create',p=>({...p,agenda:p.agenda.split('\n').filter(Boolean),decisions:p.decisions.split('\n').filter(Boolean)}));
formSubmit('personal-action-form','task_create');
formSubmit('personal-demand-form','demand_create');
$('personal-actions').onclick=e=>{const b=e.target.closest('[data-task]');if(b)run(async()=>{await api('task_status',{id:b.dataset.task,status:b.dataset.status});await load()})};
$('personal-decisions').onsubmit=e=>{const f=e.target.closest('form[data-decision]');if(!f)return;e.preventDefault();run(async()=>{const p=Object.fromEntries(new FormData(f));await api('decide',{id:f.dataset.decision,type:f.dataset.type,...p});await load()})};
$('personal-connect-google').onclick=()=>run(async()=>{const r=await api('connect');if(!r.url?.startsWith('https://accounts.google.com/'))throw Error('URL de autorização inválida.');location.assign(r.url)});
$('personal-organize').onclick=()=>run(async()=>{if(!confirm('Criar ou confirmar a pasta privada da PRESCON no Google Drive?'))return;await api('organize',{});await load()});
document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>run(async()=>{if(!confirm('Criar um novo arquivo na pasta privada?'))return;const r=await api('export',{kind:b.dataset.export});await load();status(r.message||'Arquivo criado.')}));
$('personal-copy-report').onclick=()=>run(async()=>{await navigator.clipboard.writeText($('personal-report').textContent);status('Resumo copiado.')});
document.querySelectorAll('[data-message]').forEach(b=>b.onclick=()=>{$('personal-message').value=({deliberacao:'Conselho, temos uma nova deliberação. Confiram o formulário e o prazo informado na Central.',prazo:'Conselho, reforço a importância de conferir as demandas e seus respectivos prazos.',reuniao:'Conselho, segue convocação para nossa próxima reunião. Data, local e pauta serão informados pela PRESCON.'})[b.dataset.message]});
$('personal-copy-message').onclick=()=>run(async()=>{await navigator.clipboard.writeText($('personal-message').value);status('Mensagem copiada.')});
$('personal-whatsapp').onclick=()=>{const msg=$('personal-message').value;if(msg)window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener')};
if(session?.access_token)run(load);
})();