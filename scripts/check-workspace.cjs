'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const name of ['operacao','drive-editor','deliberacoes']){
 const html=read('pages/'+name+'.html'),js=read('pages/'+name+'.js');
 if(!html.includes('./'+name+'.js'))throw Error('Missing script reference: '+name);
 new vm.Script(js,{filename:name+'.js'});
 if(!js.includes('nejlon.prescon.central.session.v1'))throw Error('Session mismatch: '+name);
 if(!js.includes('prescon-workspace'))throw Error('Backend missing: '+name);
 if(!js.includes('Bearer '))throw Error('Authentication missing: '+name);
 if(/sb_secret_|SUPABASE_SERVICE_ROLE_KEY/.test(js))throw Error('Private secret leaked: '+name);
}
const drive=read('pages/drive-editor.js'),work=read('pages/operacao.js');
for(const page of ['operacao','drive-editor']){if(!fs.existsSync(path.join(root,'pages',page+'.css')))throw Error('Missing stylesheet: '+page)}
for(const page of ['operacao','drive-editor']){const html=read('pages/'+page+'.html'),js=read('pages/'+page+'.js');for(const id of [...js.matchAll(/\\$\\('([^']+)'\\)/g)].map(m=>m[1]))if(!html.includes('id="'+id+'"'))throw Error('Missing interactive target '+page+': '+id)}
for(const action of ['drive_list','sheet_read','sheet_save','doc_read','doc_save','connect'])
 if(!drive.includes("'"+action+"'"))throw Error('Missing Drive action: '+action);
for(const action of ['dashboard','meeting_create','task_create','demand_create','decide','organize','export','connect'])
 if(!work.includes("'"+action+"'"))throw Error('Missing workspace action: '+action);
if(!drive.includes('confirm('))throw Error('Original edits must be confirmed');
console.log('OK: personal workspace, Drive editor, login session and guarded edits.');
