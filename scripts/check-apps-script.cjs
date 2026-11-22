'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const needed=[
 'index.html','pages/apps-script.html','pages/apps-script.js','pages/apps-script.css',
 'apps-script/Codigo.gs','apps-script/appsscript.json',
 'supabase/functions/prescon-workspace/index.ts'
];
for(const name of needed)if(!fs.existsSync(path.join(root,name)))throw Error('Missing required file: '+name);
const script=read('apps-script/Codigo.gs'),page=read('pages/apps-script.js');
const backend=read('supabase/functions/prescon-workspace/index.ts');
for(const [name,src] of [['Apps Script',script],['Frontend',page],['Edge backend',backend]])
 new vm.Script(src,{filename:name});
const manifest=JSON.parse(read('apps-script/appsscript.json'));
const scopes=new Set(manifest.oauthScopes||[]);
if(!scopes.has('https://www.googleapis.com/auth/spreadsheets')||!scopes.has('https://www.googleapis.com/auth/script.external_request'))
 throw Error('Apps Script requires only explicit Sheets and URL Fetch permissions.');
if([...scopes].some(s=>/gmail|mail|drive/.test(s)))throw Error('Unexpected Drive/Gmail scope in Apps Script.');
if(/function\s+do(?:Get|Post)\s*\(/.test(script))throw Error('An open web app handler must not be added to the private script.');
if(!script.includes("PRESCON_MANAGED_TAB_GID")||!script.includes("PRESCON_AUTOMACOES"))
 throw Error('Managed-tab protection missing.');
if(!script.includes("X-Prescon-Sync-Token")||!backend.includes("x-prescon-sync-token"))
 throw Error('Private connector header missing or mismatched.');
if(!backend.includes("apps_script_snapshot")||!backend.includes("apps_script_revoke"))
 throw Error('Read-only feed/revocation missing.');
if(!backend.includes("['pendente','em_andamento'].includes(d.status)")&&!backend.includes("d.status==='pendente'"))
 throw Error('Summary calculation may be missing.');
if(!backend.includes("status:'active'")&&!backend.includes("status:r.revoked_at?"))throw Error('Connections should be status-aware.');
for(const [name,src] of [['Frontend',page],['Apps Script',script]]){
 if(/sb_secret_[A-Za-z0-9_-]+|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+['"]/.test(src))
  throw Error('Secret service key in public '+name);
 if(/123456/.test(src))throw Error('Test password must never be embedded in '+name);
}
console.log('OK — 7 assets, syntax, private connector, scope and managed-sheet checks passed.');
