import { Hono } from 'hono'
import type { Env } from '../types.js'

const ui = new Hono<{ Bindings: Env }>()

/**
 * Admin UI — single-page app served at /admin. No framework; raw DOM
 * against the /admin/* JSON API. The page loads with no admin token; the
 * user pastes the CLAW_ADMIN_SECRET into a login screen, which is held
 * in sessionStorage for the lifetime of the tab and attached as Bearer
 * on every subsequent API call. The token is never persisted to
 * localStorage or cookies.
 */
const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Claw Admin</title><style>
:root{--bg:#0b0c10;--fg:#f5f5f7;--dim:#8d8d92;--panel:#16171c;--border:#26272e;--accent:#00e5c3;--danger:#ff6b6b;--warn:#ffc857}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);
font:14px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
header{padding:20px 32px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
h1{margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em}
main{padding:24px 32px;max-width:1200px}
button{font:inherit;color:var(--fg);background:transparent;border:1px solid var(--border);border-radius:8px;
padding:8px 14px;cursor:pointer;transition:.15s}
button:hover{border-color:var(--accent)}button.primary{background:var(--accent);color:var(--bg);border-color:var(--accent);font-weight:500}
button.danger{color:var(--danger);border-color:rgba(255,107,107,.3)}button.danger:hover{background:rgba(255,107,107,.1)}
input{font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:9px 12px;width:100%}
input:focus{outline:0;border-color:var(--accent)}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--border);font-size:13px}
th{color:var(--dim);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.muted{color:var(--dim)}.mono{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px}
.pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;background:var(--panel);border:1px solid var(--border)}
.pill.on{color:var(--accent);border-color:rgba(0,229,195,.3)}.pill.off{color:var(--dim)}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:10}
.modal{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:24px;min-width:400px;max-width:560px}
.modal h2{margin:0 0 16px;font-size:15px;font-weight:600}.row{display:flex;gap:8px;margin-top:12px}
.row input{flex:1}.hint{color:var(--dim);font-size:12px;margin-top:4px}
.banner{background:rgba(255,200,87,.1);border:1px solid rgba(255,200,87,.3);color:var(--warn);
padding:10px 14px;border-radius:8px;margin-top:12px;font-size:12px}
.keybox{background:#0e0f14;border:1px solid var(--border);border-radius:8px;padding:12px;
font-family:ui-monospace,"SF Mono",monospace;font-size:12px;word-break:break-all;margin-top:8px}
.login{max-width:360px;margin:15vh auto;padding:24px;background:var(--panel);border:1px solid var(--border);border-radius:12px}
.login h1{margin-bottom:16px}.hide{display:none}
</style></head><body>
<div id="login" class="login"><h1>Claw Admin</h1><p class="muted">Enter CLAW_ADMIN_SECRET to continue.</p>
<input id="token" type="password" placeholder="Admin bearer token" autocomplete="off" autofocus/>
<div class="row"><button id="signin" class="primary" style="flex:1">Sign in</button></div>
<div id="login-err" class="hint" style="color:var(--danger);margin-top:8px"></div></div>
<div id="app" class="hide"><header><h1>Claw — Project Admin</h1>
<div><button id="refresh">Refresh</button> <button id="create" class="primary">New project</button>
<button id="signout" style="margin-left:8px">Sign out</button></div></header>
<main><table><thead><tr><th>Project</th><th>Name</th><th>Provider / Model</th>
<th>Limits (min / day / tokens)</th><th>Status</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table>
<div id="empty" class="muted hide" style="padding:32px;text-align:center">No projects yet.</div></main></div>
<div id="modal-root"></div>
<script type="module" src="/admin/ui.js"></script></body></html>`

const JS = `const API='/admin';const tokKey='claw-admin-tok';
const $=(s)=>document.querySelector(s);const esc=(s)=>String(s).replace(/[<>&"']/g,(c)=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
function tok(){return sessionStorage.getItem(tokKey)}
async function api(path,opts={}){const t=tok();if(!t)throw new Error('no token');
const r=await fetch(API+path,{...opts,headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json',...(opts.headers||{})}});
if(r.status===401){sessionStorage.removeItem(tokKey);location.reload();throw new Error('unauthorized')}
const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||('HTTP '+r.status));return j}
function show(v){$('#login').classList.toggle('hide',v);$('#app').classList.toggle('hide',!v)}
async function verify(t){const r=await fetch(API+'/projects',{headers:{'Authorization':'Bearer '+t}});return r.status!==401&&r.status!==503}
$('#signin').onclick=async()=>{const t=$('#token').value.trim();if(!t)return;
if(!(await verify(t))){$('#login-err').textContent='Invalid or not configured';return}
sessionStorage.setItem(tokKey,t);show(true);load()}
$('#signout').onclick=()=>{sessionStorage.removeItem(tokKey);location.reload()}
$('#refresh').onclick=()=>load();$('#create').onclick=()=>createModal()
async function load(){try{const {projects}=await api('/projects');renderRows(projects)}catch(e){alert(e.message)}}
function renderRows(ps){const body=$('#rows');body.innerHTML='';$('#empty').classList.toggle('hide',ps.length>0);
for(const p of ps){const tr=document.createElement('tr');const lim=[p.rateLimitPerMinute||'—',p.rateLimitPerDay||'default',p.tokensPerDay||'default'].join(' / ');
tr.innerHTML=\`<td class="mono">\${esc(p.projectId)}</td><td>\${esc(p.name)}</td><td class="muted">\${esc(p.defaultProvider)} · \${esc(p.defaultModel)}</td>
<td class="mono">\${esc(lim)}</td><td><span class="pill \${p.enabled?'on':'off'}">\${p.enabled?'enabled':'disabled'}</span></td>
<td><button data-act="rotate" data-id="\${esc(p.projectId)}">Rotate key</button>
<button data-act="toggle" data-id="\${esc(p.projectId)}" data-on="\${p.enabled}">\${p.enabled?'Disable':'Enable'}</button>
<button class="danger" data-act="del" data-id="\${esc(p.projectId)}">Delete</button></td>\`;body.appendChild(tr)}
body.querySelectorAll('button[data-act]').forEach(b=>b.onclick=()=>rowAction(b.dataset.act,b.dataset.id,b.dataset.on==='true'))}
async function rowAction(a,id,on){try{if(a==='del'){if(!confirm('Delete '+id+'? This revokes its API key.'))return;
await api('/projects/'+id,{method:'DELETE'});return load()}
if(a==='toggle'){await api('/projects/'+id,{method:'PATCH',body:JSON.stringify({enabled:!on})});return load()}
if(a==='rotate'){if(!confirm('Rotate key for '+id+'? The old key stops working immediately.'))return;
const {apiKey}=await api('/projects/'+id+'/rotate-key',{method:'POST'});keyModal('Rotated key — shown once',apiKey);load()}}catch(e){alert(e.message)}}
function modal(html){const root=$('#modal-root');root.innerHTML='<div class="modal-bg"><div class="modal">'+html+'</div></div>';
root.querySelector('.modal-bg').onclick=(e)=>{if(e.target.classList.contains('modal-bg'))root.innerHTML=''};return root}
function keyModal(title,key){const root=modal(\`<h2>\${esc(title)}</h2><p class="muted">Store this now — the gateway only stores the SHA-256 hash and cannot show it again.</p>
<div class="keybox" id="k">\${esc(key)}</div><div class="banner">Rotate again if any other operator might have seen this screen.</div>
<div class="row"><button onclick="navigator.clipboard.writeText(document.getElementById('k').textContent).then(()=>this.textContent='Copied!')">Copy</button>
<button class="primary" style="flex:1" onclick="document.getElementById('modal-root').innerHTML=''">Done</button></div>\`)}
function createModal(){modal(\`<h2>New project</h2>
<div class="row"><input id="pid" placeholder="project-id (kebab-case, required)"/></div>
<div class="row"><input id="pname" placeholder="Display name (required)"/></div>
<div class="row"><input id="pprov" placeholder="provider (anthropic / openai / workers-ai)"/></div>
<div class="row"><input id="pmodel" placeholder="model (optional)"/></div>
<div class="row"><input id="prpm" type="number" placeholder="rateLimitPerMinute (default 60)"/></div>
<div class="row"><input id="prpd" type="number" placeholder="rateLimitPerDay (optional)"/></div>
<div class="row"><input id="ptpd" type="number" placeholder="tokensPerDay (optional)"/></div>
<div class="row"><button style="flex:1" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
<button class="primary" style="flex:1" id="psubmit">Create</button></div>\`);
$('#psubmit').onclick=async()=>{try{const body={projectId:$('#pid').value.trim(),name:$('#pname').value.trim()};
if($('#pprov').value.trim())body.defaultProvider=$('#pprov').value.trim();
if($('#pmodel').value.trim())body.defaultModel=$('#pmodel').value.trim();
const n=(el)=>{const v=parseInt(el.value,10);return Number.isFinite(v)?v:undefined};
const rpm=n($('#prpm'));if(rpm)body.rateLimitPerMinute=rpm;
const rpd=n($('#prpd'));if(rpd)body.rateLimitPerDay=rpd;
const tpd=n($('#ptpd'));if(tpd)body.tokensPerDay=tpd;
const {apiKey}=await api('/projects',{method:'POST',body:JSON.stringify(body)});keyModal('Project created — API key shown once',apiKey);load()}catch(e){alert(e.message)}}}
if(tok())verify(tok()).then(ok=>{if(ok){show(true);load()}else{sessionStorage.removeItem(tokKey)}});else show(false);`

ui.get('/admin', (c) => c.html(HTML))
ui.get('/admin/ui.js', (c) => {
  c.header('Content-Type', 'application/javascript; charset=utf-8')
  c.header('Cache-Control', 'no-store')
  return c.body(JS)
})

export { ui as adminUiRoutes }
