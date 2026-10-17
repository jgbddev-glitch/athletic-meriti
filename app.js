'use strict';
const VERSION='2.2.0';
const IDLE_MS=5*60*1000;
const SPORTS=[{id:'basquete',name:'Basquete',color:'#ff7a1a',emoji:'🏀'},{id:'futsal',name:'Futsal',color:'#35d06a',emoji:'⚽'}];
const sp_=id=>SPORTS.find(s=>s.id===id)||{name:id,color:'#999',emoji:'🏅'};
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const dkey=(d=new Date())=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes())};
const dur=(a,b)=>{const m=Math.max(0,Math.round((b-a)/60000));return m<60?m+' min':Math.floor(m/60)+'h'+p2(m%60)};
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const byName=(a,b)=>String(a.name).localeCompare(String(b.name));
const has=(s,sp)=>(s.sports||[]).includes(sp);
const normPhone=v=>{let d=String(v||'').replace(/\D/g,'');if(d.length===10||d.length===11)d='55'+d;return d;};
async function hashPin(pin,id){const b=new TextEncoder().encode('am:'+id+':'+pin);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const colorOf=id=>['#ff7a1a','#4c8dff','#35d06a','#b05cff','#ff5c93','#14b8c4','#f5b400'][[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0)%7];
function avatar(s,z){const st=z?`width:${z}px;height:${z}px;font-size:${Math.round(z/2.4)}px`:'';
  return s.photo?`<div class="av" style="${st}"><img src="${s.photo}" alt=""></div>`:`<div class="av" style="background:${colorOf(s.id)};${st}">${esc((s.name||'?')[0].toUpperCase())}</div>`;}

/* ---------- estado ---------- */
const st={stage:'boot',students:[],profs:[],pending:[],logs:{},prof:null,view:'home',sport:null,q:'',aq:'',aTab:'hoje',hDate:dkey(),today:dkey(),fSport:'todos',delId:null,newPhoto:''};
let auth,fs,subs={},idleT,flT,tt,pad=null,cleanup=null,camStream=null,editPhoto='';

/* ---------- utilidades de UI ---------- */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2800);}
function flash(icon,title,sub,photo){const f=$('#flash');f.innerHTML=`<div class="fbox"><div class="fic">${photo?`<img src="${photo}" alt="">`:icon}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>`;f.classList.add('show');clearTimeout(flT);flT=setTimeout(()=>f.classList.remove('show'),2300);}
function openModal(html,onClose){if(cleanup){const c=cleanup;cleanup=null;c();}$('#box').innerHTML=html;$('#modal').classList.add('show');cleanup=onClose||null;}
function closeModal(){const c=cleanup;cleanup=null;pad=null;$('#modal').classList.remove('show');if(c)c();}
function stopCam(){if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;}}
function err(e){console.error(e);toast(e&&e.code==='permission-denied'?'Sem permissão no banco: confira as regras do Firestore':'Erro de sincronização. Tente novamente.');}
function bumpIdle(){clearTimeout(idleT);if(st.prof)idleT=setTimeout(lockProf,IDLE_MS);}
function lockProf(){if(!st.prof)return;st.prof=null;st.view='home';render();toast('Área do professor bloqueada por inatividade');}

/* ---------- ilustrações das bolas ---------- */
function pent(cx,cy,r,rot){const p=[];for(let k=0;k<5;k++){const a=(rot+k*72)*Math.PI/180;p.push((cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1));}return p.join(' ');}
function ballSvg(id){
  if(id==='basquete')return `<svg viewBox="0 0 200 200"><defs><radialGradient id="gb" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffb870"/><stop offset=".55" stop-color="#f07418"/><stop offset="1" stop-color="#b3470a"/></radialGradient></defs><circle cx="100" cy="100" r="94" fill="url(#gb)"/><g fill="none" stroke="#2a1608" stroke-width="5" stroke-linecap="round"><path d="M100 6V194M6 100H194"/><path d="M28 28C72 62 72 138 28 172"/><path d="M172 28C128 62 128 138 172 172"/></g><circle cx="100" cy="100" r="94" fill="none" stroke="#2a1608" stroke-width="4"/><ellipse cx="66" cy="50" rx="26" ry="13" fill="#fff" opacity=".2" transform="rotate(-30 66 50)"/></svg>`;
  let patches='',lines='';
  for(let k=0;k<5;k++){const a=(-90+k*72),r=a*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    lines+=`<line x1="${(100+30*c).toFixed(1)}" y1="${(100+30*s).toFixed(1)}" x2="${(100+66*c).toFixed(1)}" y2="${(100+66*s).toFixed(1)}"/>`;
    patches+=`<polygon points="${pent(100+90*c,100+90*s,30,a+180)}"/>`;}
  return `<svg viewBox="0 0 200 200"><defs><radialGradient id="gf" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#dfe4ea"/><stop offset="1" stop-color="#9aa5b4"/></radialGradient><clipPath id="cf"><circle cx="100" cy="100" r="94"/></clipPath></defs><circle cx="100" cy="100" r="94" fill="url(#gf)"/><g clip-path="url(#cf)"><g fill="#1c2431">${patches}<polygon points="${pent(100,100,30,-90)}"/></g><g stroke="#1c2431" stroke-width="4" stroke-linecap="round">${lines}</g></g><circle cx="100" cy="100" r="94" fill="none" stroke="#1c2431" stroke-width="4"/><ellipse cx="66" cy="50" rx="24" ry="12" fill="#fff" opacity=".5" transform="rotate(-30 66 50)"/></svg>`;
}

/* ---------- Firebase ---------- */
function boot(){
  const cfg=window.FIREBASE_CONFIG;
  if(!window.firebase||!cfg||!cfg.apiKey||/COLE/i.test(cfg.apiKey)){st.stage='setup';render();return;}
  firebase.initializeApp(cfg);
  auth=firebase.auth();fs=firebase.firestore();
  fs.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  render();
  auth.onAuthStateChanged(u=>{if(u){start();}else{stopAll();st.prof=null;st.stage='login';render();}});
}
function stopAll(){Object.values(subs).forEach(u=>u&&u());subs={};}
function watchDay(key,day){
  if(subs[key])subs[key]();
  subs[key]=fs.collection('logs').where('day','==',day).onSnapshot(sn=>{const m={};sn.forEach(d=>m[d.id]=d.data());st.logs[day]=m;refresh();},err);
}
function start(){
  stopAll();st.stage='app';st.today=dkey();
  subs.students=fs.collection('students').onSnapshot(sn=>{st.students=sn.docs.map(d=>d.data()).sort(byName);refresh();},err);
  subs.profs=fs.collection('professors').onSnapshot(sn=>{st.profs=sn.docs.map(d=>d.data()).sort(byName);st.profsLoaded=true;refresh();},err);
  subs.pending=fs.collection('pending').onSnapshot(sn=>{st.pending=sn.docs.map(d=>d.data()).sort((a,b)=>a.ts-b.ts);refresh();},err);
  watchDay('today',st.today);watchDay('hist',st.hDate);
  render();
}
setInterval(()=>{if(st.stage==='app'&&dkey()!==st.today){st.today=dkey();watchDay('today',st.today);render();}},30000);

/* ---------- consultas ---------- */
const logId=(day,sp,sid)=>day+'_'+sp+'_'+sid;
const logOf=(sid,sp,day=st.today)=>(st.logs[day]||{})[logId(day,sp,sid)];
function status(sid,sp,day){const l=logOf(sid,sp,day);return !l?'none':l.out?'out':'in';}

/* ---------- telas ---------- */
function setupHtml(){return `<div class="setup card"><h2>⚙️ Falta configurar</h2>${window.firebase?'<p>Abra o arquivo <code>firebase-config.js</code> e cole os dados do seu projeto Firebase. O passo a passo está no <b>LEIA-ME.md</b>.</p>':'<p>Não consegui carregar os componentes. Conecte à internet e abra novamente (só na primeira vez).</p>'}</div>`;}
function loginHtml(){return `<div class="auth"><img class="logo big" src="icon-192.png" alt=""><h1>Athletic Meriti</h1><p>Entre com a conta deste aparelho</p><div class="fld"><input id="le" type="email" placeholder="E-mail" autocomplete="username"></div><div class="fld"><input id="lp" type="password" placeholder="Senha" autocomplete="current-password"></div><div class="bad" id="lerr"></div><button class="btn full" data-a="login">Entrar</button><p class="hint">Isso é feito uma vez por aparelho. Depois ele fica conectado.</p></div>`;}
function topbar(){return `<header class="top"><div class="brand" data-a="home"><img src="icon-192.png" class="logo" alt=""><div><b>Athletic Meriti</b><small>Check-in &amp; check-out</small></div></div><div class="tr">${st.prof?`<span class="who">👤 ${esc(st.prof.name)}</span><button class="pbtn" data-a="panel">Painel</button><button class="pbtn ghost" data-a="lock">Sair</button>`:`<button class="pbtn" data-a="prof">🔒 Professor</button>`}</div></header>`;}
function footer(){return `<div class="foot">v${VERSION} · ${navigator.onLine?'🟢 online':'🟠 offline: sincroniza quando a internet voltar'}</div>`;}
function homeHtml(){
  const n=id=>st.students.filter(s=>has(s,id)&&status(s.id,id)==='in').length;
  return `<section class="hero"><h1>Bem-vindo, <span>atleta!</span></h1><p>Toque na bola do seu esporte para entrar ou sair</p></section>
  <div class="balls">${SPORTS.map(sp=>`<button class="ballbtn" data-a="sport" data-v="${sp.id}" style="--c:${sp.color}"><div class="ball">${ballSvg(sp.id)}</div><b>${sp.name}</b><span>${n(sp.id)} na quadra</span></button>`).join('')}</div>`;
}
function cardHtml(s,id){const stt=status(s.id,id);const lb={none:'Ausente',in:'Na quadra',out:'Já saiu'}[stt];
  return `<button class="st ${stt}" data-a="tap" data-v="${s.id}">${avatar(s)}<div class="n">${esc(s.name)}</div><div class="t">${esc(s.turma||'')}</div><span class="badge">${lb}</span></button>`;}
function sportHtml(){
  const sp=sp_(st.sport),all=st.students.filter(s=>has(s,sp.id));
  const list=all.filter(s=>s.name.toLowerCase().includes(st.q.toLowerCase()));
  const inn=all.filter(s=>status(s.id,sp.id)==='in').length,out=all.filter(s=>status(s.id,sp.id)==='out').length;
  return `<div class="sporthead" style="--c:${sp.color}"><button class="back" data-a="home">← Esportes</button><div class="ball sm">${ballSvg(sp.id)}</div><h2>${sp.name}</h2></div>
  <div class="stats"><div class="stat g"><b>${inn}</b><span>Na quadra</span></div><div class="stat b"><b>${out}</b><span>Já saíram</span></div><div class="stat o"><b>${all.length}</b><span>Inscritos</span></div></div>
  <div class="tools"><input id="q" placeholder="🔍 Buscar seu nome…" value="${esc(st.q)}" autocomplete="off"><button class="btn qr" data-a="qr">📷 QR</button></div>
  ${all.length?`<div class="grid">${list.map(s=>cardHtml(s,sp.id)).join('')}</div>`:`<div class="empty">Nenhum aluno de ${sp.name} cadastrado ainda.</div>`}`;
}
function sportChips(sel){return `<div class="chips" id="sportchips">${SPORTS.map(x=>`<button class="chip ${sel.includes(x.id)?'on':''}" data-a="chip" data-v="${x.id}" style="--c:${x.color}">${x.emoji} ${x.name}</button>`).join('')}</div>`;}
function adminHtml(){
  const adm=st.prof.role==='admin';
  const tabs=[['av','Avisos'+(st.pending.length?` (${st.pending.length})`:'')],['hoje','Hoje'],['hist','Histórico'],['alunos','Alunos'],['cad','+ Aluno']];
  if(adm)tabs.push(['profs','Professores']);tabs.push(['cfg','Ajustes']);
  let h=`<div class="hello">Olá, <b>${esc(st.prof.name)}</b><span class="role">${adm?'Administrador':'Professor'}</span></div><div class="sub">${tabs.map(t=>`<button data-a="tab" data-v="${t[0]}" class="${st.aTab===t[0]?'on':''}">${t[1]}</button>`).join('')}</div>`;
  const T=st.aTab;
  if(T==='av'){
    h+=`<div class="card"><h3>Avisos de WhatsApp pendentes (${st.pending.length})</h3>`;
    h+=st.pending.length?st.pending.map(p=>{const s=st.students.find(x=>x.id===p.sid);if(!s)return '';
      return `<div class="li"><div class="lf">${avatar(s,42)}<div><b>${esc(s.name)}</b><div class="m">${p.ev==='in'?'Chegou':'Saiu'} · ${sp_(p.sport).name} · ${hm(p.ts)}</div></div></div><div class="row" style="margin:0"><a class="btn sm wa" href="${waUrl(p,s)}" target="_blank" rel="noopener" data-sent="${p.id}">Enviar</a><button class="btn sm sec" data-a="skip" data-v="${p.id}">Dispensar</button></div></div>`}).join(''):'<div class="empty">Nenhum aviso pendente 🎉</div>';
    h+='</div>';if(st.pending.length>1)h+='<button class="btn sec full" data-a="clearav">Limpar todos os avisos</button>';
  }
  if(T==='hoje'||T==='hist'){
    const day=T==='hoje'?st.today:st.hDate,f=st.fSport;
    const logs=Object.values(st.logs[day]||{}).filter(l=>f==='todos'||l.sport===f).sort((a,b)=>a.in-b.in);
    const sports=f==='todos'?SPORTS.map(x=>x.id):[f];
    const enr=st.students.reduce((n,s)=>n+sports.filter(x=>has(s,x)).length,0);
    h+=`<div class="chips" style="margin-bottom:12px"><button class="chip ${f==='todos'?'on':''}" data-a="fsport" data-v="todos">Todos</button>${SPORTS.map(x=>`<button class="chip ${f===x.id?'on':''}" data-a="fsport" data-v="${x.id}" style="--c:${x.color}">${x.emoji} ${x.name}</button>`).join('')}</div>`;
    if(T==='hist')h+=`<div class="card"><input type="date" id="hd" value="${st.hDate}"></div>`;
    h+=`<div class="card"><h3>${logs.length} presenças · ${Math.max(0,enr-logs.length)} ausências</h3>`;
    h+=logs.length?logs.map(l=>{const s=st.students.find(x=>x.id===l.sid)||{id:l.sid,name:'(aluno removido)'};const sp=sp_(l.sport);
      return `<div class="li"><div class="lf">${avatar(s,44)}<div><b>${esc(s.name)}</b><div class="m"><i class="dot" style="background:${sp.color}"></i>${sp.name} · Entrada ${hm(l.in)}${l.out?` · Saída ${hm(l.out)} · ${dur(l.in,l.out)}`:''}</div></div></div><div class="ph2">${l.photoIn?`<img src="${l.photoIn}" alt="" data-a="zoom" data-v="${l.id}|photoIn">`:''}${l.photoOut?`<img src="${l.photoOut}" alt="" data-a="zoom" data-v="${l.id}|photoOut">`:''}<span class="pill ${l.out?'out':'in'}">${l.out?'Saiu':'Na quadra'}</span></div></div>`}).join(''):'<div class="empty">Nenhum registro neste dia.</div>';
    h+='</div>';
  }
  if(T==='alunos'){
    const list=st.students.filter(s=>s.name.toLowerCase().includes(st.aq.toLowerCase()));
    h+=`<div class="card"><input id="aq" placeholder="🔍 Buscar aluno…" value="${esc(st.aq)}" autocomplete="off"></div><div class="card"><h3>${list.length} alunos</h3>`;
    h+=list.length?list.map(s=>`<div class="li"><div class="lf">${avatar(s,44)}<div><b>${esc(s.name)}</b><div class="m">${(s.sports||[]).map(x=>`<span class="tag">${sp_(x).emoji} ${sp_(x).name}</span>`).join('')}${esc(s.turma||'')} · Código <b>${esc(s.code)}</b></div></div></div><div class="row" style="margin:0"><button class="btn sm sec" data-a="sendpais" data-v="${s.id}">📲</button><button class="btn sm sec" data-a="card" data-v="${s.id}">🪪</button><button class="btn sm sec" data-a="edit" data-v="${s.id}">Editar</button>${adm?`<button class="btn sm ${st.delId===s.id?'red':'sec'}" data-a="del" data-v="${s.id}">${st.delId===s.id?'Confirmar?':'🗑'}</button>`:''}</div></div>`).join(''):'<div class="empty">Nenhum aluno encontrado.</div>';
    h+='</div>';
  }
  if(T==='cad'){
    h+=`<div class="card"><h3>Novo aluno</h3>
    <div class="fld"><label>Nome completo</label><input id="nn" placeholder="Nome do aluno"></div>
    <div class="fld"><label>Turma / categoria</label><input id="nt" placeholder="Ex.: Sub-13"></div>
    <div class="fld"><label>WhatsApp do responsável (com DDD)</label><input id="nw" inputmode="tel" placeholder="21 99999-9999"></div>
    <div class="fld"><label>Esporte(s) em que está inscrito</label><div id="cadsp">${sportChips([])}</div></div>
    <div class="row"><div id="prev" class="av" style="margin:0;background:var(--card2);color:var(--mut)">${st.newPhoto?`<img src="${st.newPhoto}" alt="">`:'📷'}</div><label class="btn sec" style="cursor:pointer">Foto do aluno<input type="file" id="ph" accept="image/*" style="display:none"></label></div>
    <button class="btn full" data-a="addstudent">Cadastrar aluno</button><p class="hint">O código de 4 dígitos serve para o check-in e para os pais acompanharem. O QR Code da carteirinha é gerado automaticamente.</p></div>`;
  }
  if(T==='profs'&&adm){
    h+=`<div class="card"><h3>Professores</h3>`;
    h+=st.profs.map(p=>`<div class="li"><div class="lf"><div class="av" style="background:${colorOf(p.id)};width:42px;height:42px;font-size:18px;margin:0">${esc(p.name[0].toUpperCase())}</div><div><b>${esc(p.name)}</b><div class="m">${p.role==='admin'?'Administrador':'Professor'}</div></div></div><div class="row" style="margin:0"><button class="btn sm sec" data-a="editprof" data-v="${p.id}">Editar</button>${p.id!==st.prof.id?`<button class="btn sm ${st.delId===p.id?'red':'sec'}" data-a="delprof" data-v="${p.id}">${st.delId===p.id?'Confirmar?':'🗑'}</button>`:''}</div></div>`).join('')||'<div class="empty">Nenhum professor.</div>';
    h+=`</div><div class="card"><h3>Novo professor</h3><div class="fld"><label>Nome</label><input id="pn" placeholder="Nome do professor"></div><div class="fld"><label>PIN (4 números)</label><input id="pp" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div><div class="fld"><label>Tipo de acesso</label><select id="pr"><option value="teacher">Professor (cadastra alunos e vê presenças)</option><option value="admin">Administrador (também gerencia professores)</option></select></div><button class="btn full" data-a="addprof">Cadastrar professor</button></div>`;
  }
  if(T==='cfg'){
    h+=`<div class="card"><h3>Meu acesso</h3><button class="btn sec full" data-a="editprof" data-v="${st.prof.id}">Trocar meu nome ou PIN</button></div>
    <div class="card"><h3>Página dos pais</h3><p class="hint" style="margin:0 0 10px">Os pais abrem este endereço e digitam o código de 4 dígitos do filho (o mesmo do check-in, na aba Alunos). O botão 📲 do aluno já envia o link com o código.</p><div class="fld"><input id="pl" readonly value="${esc(portalUrl())}"></div><button class="btn sec full" data-a="copylink">Copiar link</button></div>
    <div class="card"><h3>Este aparelho</h3><p class="hint" style="margin:0 0 10px">Versão ${VERSION}. O professor é bloqueado sozinho após 5 minutos sem uso.</p><button class="btn red full" data-a="logout">Desconectar este aparelho</button></div>`;
  }
  return h;
}
function render(){
  const a=$('#app');
  if(st.stage==='setup'){a.innerHTML=setupHtml();return;}
  if(st.stage==='login'){a.innerHTML=loginHtml();return;}
  if(st.stage!=='app'){a.innerHTML='<div class="splash"><img class="logo big" src="icon-192.png" alt=""><p>Carregando…</p></div>';return;}
  const f=document.activeElement,fid=f&&f.id,pos=f&&f.selectionStart;
  const body=st.view==='admin'&&st.prof?adminHtml():st.view==='sport'?sportHtml():homeHtml();
  a.innerHTML=topbar()+`<main class="page">${body}</main>`+footer();
  if(fid==='q'||fid==='aq'){const i=$('#'+fid);if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}
}
function refresh(){if(st.stage!=='app')return;if(st.view==='admin'&&st.prof&&(st.aTab==='cad'||st.aTab==='profs'))return;render();}
window.addEventListener('online',()=>render());window.addEventListener('offline',()=>render());

/* ---------- teclado numérico ---------- */
function padHtml(){const v=pad.val;
  return `${pad.avatar||''}<h2>${esc(pad.title)}</h2><p>${esc(pad.sub)}</p><div class="dots">${[0,1,2,3].map(i=>`<i class="${i<v.length?'f':''}"></i>`).join('')}</div><div class="err">${pad.err||''}</div>
  <div class="keys">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join('')}<button data-k="x" style="font-size:15px">Cancelar</button><button data-k="0">0</button><button data-k="b">⌫</button></div>`;}
function openPad(cfg){pad=Object.assign({val:'',err:'',busy:false},cfg);openModal(padHtml());pad=Object.assign(pad);}
function showPad(){$('#box').innerHTML=padHtml();}
function padKey(k){
  if(!pad||pad.busy)return;
  if(k==='x'){closeModal();return;}
  if(k==='b')pad.val=pad.val.slice(0,-1);else if(pad.val.length<4)pad.val+=k;
  pad.err='';
  if(pad.val.length===4){
    const cur=pad;cur.busy=true;showPad();
    Promise.resolve(cur.check(cur.val)).then(ok=>{
      if(pad!==cur)return;
      if(ok){const d=cur.done;closeModal();d();return;}
      cur.val='';cur.err='Código incorreto';cur.busy=false;showPad();
      $('#box').classList.add('shake');setTimeout(()=>$('#box').classList.remove('shake'),300);
    });
    return;
  }
  showPad();
}

/* ---------- câmera: foto e QR ---------- */
function snapFrom(v){const c=document.createElement('canvas');c.width=c.height=240;const x=c.getContext('2d');const m=Math.min(v.videoWidth,v.videoHeight);x.drawImage(v,(v.videoWidth-m)/2,(v.videoHeight-m)/2,m,m,0,0,240,240);return c.toDataURL('image/jpeg',0.6);}
function capturePhoto(){return new Promise(async res=>{
  // resolve: foto (texto) | '' (câmera indisponível) | null (aluno cancelou)
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){res('');return;}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});}catch(e){res('');return;}
  camStream=stream;let done=false;
  const finish=d=>{if(done)return;done=true;res(d);closeModal();};
  openModal(`<h2>Sorria! 📸</h2><p>A foto será tirada em <b id="cd">3</b></p><div class="vid mirror"><video id="vd" playsinline muted autoplay></video></div><button class="btn sec full" id="cnc">Cancelar</button>`,()=>{stopCam();if(!done){done=true;res(null);}});
  const v=$('#vd');v.srcObject=stream;await v.play().catch(()=>{});
  $('#cnc').onclick=()=>finish(null);
  let n=3;const t=setInterval(()=>{if(done){clearInterval(t);return;}n--;if(n>0){const c=$('#cd');if(c)c.textContent=n;return;}if(!v.videoWidth){n=1;return;}clearInterval(t);finish(snapFrom(v));},1000);
});}
async function scanQR(sport){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Câmera indisponível neste aparelho');return;}
  let alive=true;
  openModal(`<h2>Aponte o QR Code</h2><p>Mostre a carteirinha para a câmera</p><div class="vid"><video id="vd" playsinline muted autoplay></video></div><button class="btn sec full" data-a="close">Cancelar</button>`,()=>{alive=false;stopCam();});
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});}catch(e){closeModal();toast('Não consegui abrir a câmera');return;}
  if(!alive){stream.getTracks().forEach(t=>t.stop());return;}
  camStream=stream;const v=$('#vd');v.srcObject=stream;await v.play().catch(()=>{});
  const det=window.BarcodeDetector?new BarcodeDetector({formats:['qr_code']}):null;
  const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
  const loop=async()=>{
    if(!alive)return;
    try{
      let txt='';
      if(v.videoWidth){
        if(det){const r=await det.detect(v);if(r[0])txt=r[0].rawValue;}
        else if(window.jsQR){cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);const im=cx.getImageData(0,0,cv.width,cv.height);const r=jsQR(im.data,im.width,im.height);if(r)txt=r.data;}
      }
      if(txt.startsWith('AM|')){const s=st.students.find(x=>x.id===txt.slice(3));if(s){alive=false;closeModal();onQR(s,sport);return;}}
    }catch(e){}
    if(alive)requestAnimationFrame(loop);
  };
  loop();
}
function onQR(s,sport){if(!has(s,sport)){toast(`${s.name.split(' ')[0]} não está inscrito em ${sp_(sport).name}`);return;}proceed(s,sport);}

/* ---------- check-in / check-out ---------- */
function tapStudent(id,sport){
  const s=st.students.find(x=>x.id===id);if(!s)return;
  const stt=status(id,sport);
  if(stt==='out'){toast('Você já fez check-out hoje 😉');return;}
  openPad({title:s.name,sub:stt==='in'?'Digite seu código para sair':'Digite seu código para entrar',avatar:avatar(s,72),check:c=>c===s.code,done:()=>proceed(s,sport)});
}
async function proceed(s,sport){
  const stt=status(s.id,sport);
  if(stt==='out'){toast('Você já fez check-out hoje 😉');return;}
  const photo=await capturePhoto();
  if(photo===null)return;
  if(photo===''&&stt==='none'){toast('Para entrar é preciso liberar a câmera e tirar a foto.');return;}
  toggle(s,sport,photo);
}
function toggle(s,sport,photo){
  const now=Date.now();
  const day=dkey(),id=logId(day,sport,s.id),cur=(st.logs[day]||{})[id],ref=fs.collection('logs').doc(id),first=s.name.split(' ')[0],sp=sp_(sport);
  if(!cur){
    ref.set({id,day,sport,sid:s.id,in:now,photoIn:photo||''}).catch(err);portalEvent(s,id,{day,sport,in:now,photoIn:photo||'',ts:now},false);
    flash('✅','Check-in feito!',`Bom treino, ${first} ${sp.emoji}`,photo);queue(s,sport,'in');
  }else if(!cur.out){
    ref.update({out:now,photoOut:photo||''}).catch(err);portalEvent(s,id,{out:now,photoOut:photo||''},true);
    flash('👋','Check-out feito!',`Até a próxima, ${first}`,photo);queue(s,sport,'out');
  }
}
function queue(s,sport,ev){if(!s.phone)return;const id=uid('w');fs.collection('pending').doc(id).set({id,sid:s.id,sport,ev,ts:Date.now()}).catch(err);}
function waUrl(p,s){const t=hm(p.ts),sp=sp_(p.sport);
  const msg=p.ev==='in'?`${sp.emoji} Athletic Meriti: ${s.name} chegou ao treino de ${sp.name} às ${t}.`:`${sp.emoji} Athletic Meriti: ${s.name} saiu do treino de ${sp.name} às ${t}. Até a próxima!`;
  return 'https://wa.me/'+s.phone+'?text='+encodeURIComponent(msg);}

/* ---------- professor ---------- */
function openProfPicker(){
  if(!st.profsLoaded){toast('Carregando… tente de novo em instantes');return;}
  if(!st.profs.length){openFirstAdmin();return;}
  openModal(`<h2>Área do professor</h2><p>Quem é você?</p><div class="pl">${st.profs.map(p=>`<button data-a="pickprof" data-v="${p.id}"><div class="av" style="background:${colorOf(p.id)}">${esc(p.name[0].toUpperCase())}</div>${esc(p.name)}</button>`).join('')}</div><button class="btn sec full" data-a="close">Cancelar</button>`);
}
function pickProf(id){const p=st.profs.find(x=>x.id===id);if(!p)return;
  openPad({title:p.name,sub:'Digite seu PIN',check:async c=>(await hashPin(c,p.id))===p.pinHash,done:()=>unlock(p)});}
function unlock(p){st.prof={id:p.id,name:p.name,role:p.role};st.view='admin';st.aTab=st.pending.length?'av':'hoje';st.delId=null;bumpIdle();render();ensurePortal();}
function openFirstAdmin(){openModal(`<h2>Primeiro acesso</h2><p>Crie o administrador do sistema</p><div class="fld"><input id="fn" placeholder="Seu nome"></div><div class="fld"><input id="fp" type="password" inputmode="numeric" maxlength="4" placeholder="PIN de 4 números"></div><button class="btn full" data-a="mkadmin">Criar administrador</button><button class="btn sec full" data-a="close" style="margin-top:8px">Cancelar</button>`);}
async function mkAdmin(){
  const name=$('#fn').value.trim(),pin=$('#fp').value.trim();
  if(!name)return toast('Digite seu nome');if(!/^\d{4}$/.test(pin))return toast('O PIN precisa ter 4 números');
  const id=uid('p'),pinHash=await hashPin(pin,id);
  await fs.collection('professors').doc(id).set({id,name,role:'admin',pinHash}).catch(err);
  closeModal();unlock({id,name,role:'admin'});
}
async function addProf(){
  const name=$('#pn').value.trim(),pin=$('#pp').value.trim(),role=$('#pr').value;
  if(!name)return toast('Digite o nome do professor');if(!/^\d{4}$/.test(pin))return toast('O PIN precisa ter 4 números');
  const id=uid('p'),pinHash=await hashPin(pin,id);
  fs.collection('professors').doc(id).set({id,name,role,pinHash}).catch(err);toast('Professor cadastrado');render();
}
function openProfEdit(id){
  const p=st.profs.find(x=>x.id===id);if(!p)return;
  openModal(`<h2>Editar professor</h2><div class="fld"><label>Nome</label><input id="en" value="${esc(p.name)}"></div><div class="fld"><label>Novo PIN (deixe vazio para manter)</label><input id="ep" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>${st.prof.role==='admin'&&p.id!==st.prof.id?`<div class="fld"><label>Acesso</label><select id="er"><option value="teacher" ${p.role==='teacher'?'selected':''}>Professor</option><option value="admin" ${p.role==='admin'?'selected':''}>Administrador</option></select></div>`:''}<button class="btn full" data-a="saveprof" data-v="${p.id}">Salvar</button><button class="btn sec full" data-a="close" style="margin-top:8px">Cancelar</button>`);
}
async function saveProf(id){
  const p=st.profs.find(x=>x.id===id);if(!p)return;
  const name=$('#en').value.trim(),pin=$('#ep').value.trim(),er=$('#er');
  if(!name)return toast('O nome não pode ficar vazio');if(pin&&!/^\d{4}$/.test(pin))return toast('O PIN precisa ter 4 números');
  const role=er?er.value:p.role,upd={name,role};
  if(pin)upd.pinHash=await hashPin(pin,id);
  fs.collection('professors').doc(id).update(upd).catch(err);
  if(id===st.prof.id)st.prof.name=name;
  closeModal();toast('Professor atualizado');render();
}

/* ---------- portal dos pais (o acesso é o código de 4 dígitos do aluno) ---------- */
const portalUrl=()=>new URL('pais.html',location.href).href.split('?')[0].split('#')[0];
function syncPortal(s){if(!s.code)return;fs.collection('portal').doc(s.code).set({first:String(s.name).split(' ')[0],sports:s.sports||[],updated:Date.now()},{merge:true}).catch(err);}
function portalEvent(s,id,data,merge){if(!s.code)return;const r=fs.collection('portal').doc(s.code).collection('events').doc(id);(merge?r.set(data,{merge:true}):r.set(data)).catch(err);}
let portalSynced=false;
function ensurePortal(){if(portalSynced)return;portalSynced=true;st.students.forEach(syncPortal);}
function sendPais(id){
  const s=st.students.find(x=>x.id===id);if(!s)return;
  const msg=`Olá! Acompanhe a entrada e a saída de ${s.name.split(' ')[0]} nos treinos do Athletic Meriti: ${portalUrl()}?m=${s.code}\nCódigo: ${s.code}`;
  window.open('https://wa.me/'+(s.phone||'')+'?text='+encodeURIComponent(msg),'_blank');
}
function newCode(id){
  const s=st.students.find(x=>x.id===id);if(!s)return;
  if(!confirm('Gerar um novo código? O código atual deixa de funcionar, no check-in e para os pais.'))return;
  let c;do{c=String(Math.floor(1000+Math.random()*9000));}while(st.students.some(x=>x.code===c));
  const old=s.code;
  fs.collection('students').doc(id).update({code:c}).catch(err);
  syncPortal(Object.assign({},s,{code:c}));
  if(old){const pr=fs.collection('portal').doc(old),nr=fs.collection('portal').doc(c).collection('events');
    pr.collection('events').get().then(sn=>{const b=fs.batch();sn.forEach(d=>{b.set(nr.doc(d.id),d.data());b.delete(d.ref);});b.delete(pr);return b.commit();}).catch(err);}
  closeModal();toast('Novo código: '+c);
}

/* ---------- alunos ---------- */
function readPhoto(f,cb){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=200;const x=c.getContext('2d');const m=Math.min(im.width,im.height);x.drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,200,200);cb(c.toDataURL('image/jpeg',0.75));};im.src=r.result;};r.readAsDataURL(f);}
function saveNewStudent(){
  const name=$('#nn').value.trim();if(!name)return toast('Digite o nome do aluno');
  const sports=[...document.querySelectorAll('#cadsp .chip.on')].map(x=>x.dataset.v);if(!sports.length)return toast('Escolha ao menos um esporte');
  const ph=normPhone($('#nw').value);if($('#nw').value.trim()&&ph.length<12)return toast('WhatsApp inválido: use DDD + número');
  let code;do{code=String(Math.floor(1000+Math.random()*9000));}while(st.students.some(s=>s.code===code));
  const s={id:uid('s'),name,turma:$('#nt').value.trim(),phone:ph,photo:st.newPhoto||'',code,sports,createdBy:st.prof.name,createdAt:Date.now()};
  fs.collection('students').doc(s.id).set(s).catch(err);syncPortal(s);
  st.newPhoto='';render();toast(`✅ ${name} cadastrado! Código: ${code}`);openCard(s);
}
function openEdit(id){
  const s=st.students.find(x=>x.id===id);if(!s)return;editPhoto=s.photo||'';
  openModal(`<h2>Editar aluno</h2><div class="row" style="margin-top:12px"><div id="eprev">${avatar(s,56)}</div><label class="btn sec" style="cursor:pointer">Trocar foto<input type="file" id="eph" accept="image/*" style="display:none"></label></div>
  <div class="fld"><label>Nome</label><input id="en" value="${esc(s.name)}"></div><div class="fld"><label>Turma</label><input id="et" value="${esc(s.turma||'')}"></div>
  <div class="fld"><label>WhatsApp com DDD</label><input id="ew" inputmode="tel" value="${esc((s.phone||'').replace(/^55/,''))}"></div>
  <div class="fld"><label>Esportes</label><div id="edsp">${sportChips(s.sports||[])}</div></div>
  <p class="hint" style="margin-bottom:10px">Código do aluno (check-in e acesso dos pais): <b>${esc(s.code)}</b></p><button class="btn sm sec" data-a="newcode" data-v="${s.id}" style="margin-bottom:12px">Gerar novo código</button>
  <button class="btn full" data-a="saveedit" data-v="${s.id}">Salvar</button><button class="btn sec full" data-a="close" style="margin-top:8px">Cancelar</button>`);
}
function saveEdit(id){
  const s=st.students.find(x=>x.id===id);if(!s)return;
  const name=$('#en').value.trim();if(!name)return toast('O nome não pode ficar vazio');
  const sports=[...document.querySelectorAll('#edsp .chip.on')].map(x=>x.dataset.v);if(!sports.length)return toast('Escolha ao menos um esporte');
  const ph=normPhone($('#ew').value);if($('#ew').value.trim()&&ph.length<12)return toast('WhatsApp inválido: use DDD + número');
  fs.collection('students').doc(id).update({name,turma:$('#et').value.trim(),phone:ph,sports,photo:editPhoto}).catch(err);syncPortal(Object.assign({},s,{name,sports}));
  closeModal();toast('Aluno atualizado');
}
function openCard(s){
  let qr='';
  try{const q=qrcode(0,'M');q.addData('AM|'+s.id);q.make();const n=q.getModuleCount();let p='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))p+=`M${c},${r}h1v1h-1z`;
    qr=`<svg viewBox="-2 -2 ${n+4} ${n+4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n+4}" height="${n+4}" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;}
  catch(e){qr=`<div style="color:#000;padding:20px">QR indisponível. Código: ${esc(s.code)}</div>`;}
  openModal(`<div id="card" class="idcard"><div class="ct"><img src="icon-192.png" alt="">ATHLETIC MERITI</div>${avatar(s,84)}<h3>${esc(s.name)}</h3><div>${(s.sports||[]).map(x=>`<span class="tag" style="color:${sp_(x).color}">${sp_(x).emoji} ${sp_(x).name}</span>`).join('')}</div><div class="qrb">${qr}</div><div style="font-size:12px;color:#c9b8aa">Código ${esc(s.code)}</div></div>
  <div class="cbtns"><button class="btn full" data-a="print">🖨 Imprimir</button><button class="btn sec full" data-a="close">Fechar</button></div>`);
}

/* ---------- eventos ---------- */
function act(a,v,t){
  switch(a){
    case 'home':st.view='home';render();break;
    case 'sport':st.sport=v;st.q='';st.view='sport';render();break;
    case 'qr':scanQR(st.sport);break;
    case 'tap':tapStudent(v,st.sport);break;
    case 'prof':openProfPicker();break;
    case 'pickprof':pickProf(v);break;
    case 'mkadmin':mkAdmin();break;
    case 'panel':st.view='admin';render();break;
    case 'lock':st.prof=null;st.view='home';clearTimeout(idleT);render();break;
    case 'tab':st.aTab=v;st.delId=null;render();break;
    case 'fsport':st.fSport=v;render();break;
    case 'close':closeModal();break;
    case 'chip':t.classList.toggle('on');break;
    case 'addstudent':saveNewStudent();break;
    case 'edit':openEdit(v);break;
    case 'saveedit':saveEdit(v);break;
    case 'card':{const s=st.students.find(x=>x.id===v);if(s)openCard(s);break;}
    case 'print':window.print();break;
    case 'del':if(st.delId===v){fs.collection('students').doc(v).delete().catch(err);st.delId=null;toast('Aluno excluído');}else st.delId=v;render();break;
    case 'addprof':addProf();break;
    case 'editprof':openProfEdit(v);break;
    case 'saveprof':saveProf(v);break;
    case 'delprof':{if(st.delId===v){const p=st.profs.find(x=>x.id===v);if(p&&p.role==='admin'&&st.profs.filter(x=>x.role==='admin').length<2){toast('Mantenha ao menos um administrador');st.delId=null;}else{fs.collection('professors').doc(v).delete().catch(err);st.delId=null;toast('Professor removido');}}else st.delId=v;render();break;}
    case 'skip':fs.collection('pending').doc(v).delete().catch(err);break;
    case 'clearav':st.pending.forEach(p=>fs.collection('pending').doc(p.id).delete().catch(err));break;
    case 'zoom':{const [id,f]=v.split('|'),l=(st.logs[id.slice(0,10)]||{})[id];if(l&&l[f])openModal(`<img src="${l[f]}" alt="" style="width:100%;border-radius:18px;margin-bottom:12px"><button class="btn sec full" data-a="close">Fechar</button>`);break;}
    case 'sendpais':sendPais(v);break;
    case 'newcode':newCode(v);break;
    case 'copylink':if(navigator.clipboard)navigator.clipboard.writeText(portalUrl()).then(()=>toast('Link copiado'),()=>toast('Não consegui copiar'));break;
    case 'login':doLogin();break;
    case 'logout':if(auth)auth.signOut();break;
  }
}
function doLogin(){
  const e=$('#le').value.trim(),p=$('#lp').value;if(!e||!p){$('#lerr').textContent='Preencha e-mail e senha';return;}
  $('#lerr').textContent='Entrando…';
  auth.signInWithEmailAndPassword(e,p).catch(x=>{$('#lerr').textContent=/network/.test(x.code)?'Sem internet para entrar':'E-mail ou senha incorretos';});
}
document.addEventListener('click',e=>{
  bumpIdle();
  if(e.target.id==='modal'){closeModal();return;}
  if(e.target.closest('#flash')){$('#flash').classList.remove('show');return;}
  const sent=e.target.closest('[data-sent]');
  if(sent){const id=sent.dataset.sent;setTimeout(()=>fs.collection('pending').doc(id).delete().catch(err),800);return;}
  const t=e.target.closest('[data-a],[data-k]');if(!t)return;
  if(t.dataset.k!==undefined){padKey(t.dataset.k);return;}
  act(t.dataset.a,t.dataset.v,t);
});
document.addEventListener('input',e=>{
  if(e.target.id==='q'){st.q=e.target.value;render();}
  if(e.target.id==='aq'){st.aq=e.target.value;render();}
});
document.addEventListener('change',e=>{
  const i=e.target;
  if(i.id==='hd'){st.hDate=i.value||dkey();watchDay('hist',st.hDate);render();}
  if(i.id==='ph'&&i.files[0])readPhoto(i.files[0],d=>{st.newPhoto=d;$('#prev').innerHTML=`<img src="${d}" alt="">`;});
  if(i.id==='eph'&&i.files[0])readPhoto(i.files[0],d=>{editPhoto=d;$('#eprev').innerHTML=`<div class="av" style="width:56px;height:56px;margin:0"><img src="${d}" alt=""></div>`;});
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target.id==='lp'||e.target.id==='le'))doLogin();});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
boot();
