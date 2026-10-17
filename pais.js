'use strict';
const SPORTS={basquete:{name:'Basquete',emoji:'🏀',color:'#ff7a1a'},futsal:{name:'Futsal',emoji:'⚽',color:'#35d06a'}};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes())};
const dur=(a,b)=>{const m=Math.max(0,Math.round((b-a)/60000));return m<60?m+' min':Math.floor(m/60)+'h'+p2(m%60)};
const dkey=(d=new Date())=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const norm=v=>String(v||'').replace(/\D/g,'').slice(0,4);
const fmt=m=>m;
const KEY='am_pais_v3';
let codes=[],kids={},unsubs={},fs,tt,msg='';
try{codes=JSON.parse(localStorage.getItem(KEY)||'[]').filter(c=>/^\d{4}$/.test(c));}catch(e){}
const saveCodes=()=>{try{localStorage.setItem(KEY,JSON.stringify(codes));}catch(e){}};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2600);}

function header(){return `<header class="top"><div class="brand"><img src="icon-192.png" class="logo" alt=""><div><b>Athletic Meriti</b><small>Área dos pais</small></div></div></header>`;}
function addForm(){return `<div class="card"><h3>Acompanhe seu filho</h3><p class="hint" style="margin:0 0 12px">Digite o código de 4 dígitos do seu filho (o mesmo usado no check-in) para ver a entrada, a saída e a foto.</p><div class="row"><input id="mat" inputmode="numeric" placeholder="Código de 4 dígitos" autocomplete="off" maxlength="4"><button class="btn" data-a="add">Ver</button></div><div class="bad" id="msg">${esc(msg)}</div></div>`;}
function kidHtml(code){
  const k=kids[code]||{},p=k.profile,ev=k.events||[];
  if(k.loading)return `<div class="card"><div class="empty">Carregando…</div></div>`;
  if(!p)return `<div class="card"><h3>Código ${esc(code)}</h3><div class="empty">Código não encontrado ou desativado. Confirme com o clube.</div><button class="btn sec full" data-a="rm" data-v="${code}">Remover</button></div>`;
  const today=dkey(),last=ev[0],onCourt=last&&last.day===today&&last.in&&!last.out;
  const photo=(src,label,t)=>`<figure>${src?`<img src="${src}" alt="" data-a="zoom" data-v="${src}">`:`<div class="nophoto">📷</div>`}${label} ${t}</figure>`;
  const list=ev.length?ev.map(e=>{const sp=SPORTS[e.sport]||{name:e.sport,emoji:'🏅',color:'#999'};const d=new Date(e.day+'T12:00:00');
    return `<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><b>${d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})}</b><div class="m"><i class="dot" style="background:${sp.color}"></i>${sp.emoji} ${sp.name}${e.in&&e.out?' · '+dur(e.in,e.out):''}</div></div><span class="pill ${e.out?'out':'in'}">${e.out?'Saiu':'Na quadra'}</span></div>
    <div class="ev">${e.in?photo(e.photoIn,'Entrada',hm(e.in)):''}${e.out?photo(e.photoOut,'Saída',hm(e.out)):''}</div></div>`}).join(''):'<div class="empty">Ainda não há registros. Assim que seu filho fizer o primeiro check-in, ele aparece aqui.</div>';
  return `<div class="card kid"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h2>${esc(p.first)}</h2><span class="live ${onCourt?'on':'off'}">${onCourt?'● Na quadra agora':'Fora da quadra'}</span></div><div class="m" style="margin:4px 0 10px">${(p.sports||[]).map(x=>`<span class="tag">${(SPORTS[x]||{}).emoji||''} ${(SPORTS[x]||{name:x}).name}</span>`).join('')}Código ${esc(code)}</div>${list}<button class="btn sec sm" data-a="rm" data-v="${code}" style="margin-top:10px">Remover deste aparelho</button></div>`;
}
function render(){
  const f=document.activeElement,keep=f&&f.id==='mat',val=keep?f.value:'';
  $('#app').innerHTML=header()+`<main class="page">${codes.map(kidHtml).join('')}${addForm()}<p class="hint" style="text-align:center">As fotos são tiradas na entrada e na saída para a segurança dos alunos. Não compartilhe o código com outras pessoas.</p></main>`;
  if(keep){const i=$('#mat');i.value=val;i.focus();}
}
function watch(code){
  if(unsubs[code])return;
  kids[code]={loading:true,events:[]};
  const ref=fs.collection('portal').doc(code);
  const u1=ref.onSnapshot(d=>{kids[code].loading=false;kids[code].profile=d.exists?d.data():null;render();},()=>{kids[code].loading=false;kids[code].profile=null;render();});
  const u2=ref.collection('events').orderBy('ts','desc').limit(30).onSnapshot(sn=>{kids[code].events=sn.docs.map(x=>x.data());render();},()=>{});
  unsubs[code]=()=>{u1();u2();};
}
function addCode(raw){
  const c=norm(raw);
  if(c.length!==4){msg='O código tem 4 números.';render();return;}
  if(codes.includes(c)){msg='Este código já está na lista.';render();return;}
  msg='Procurando…';render();
  fs.collection('portal').doc(c).get().then(d=>{
    if(!d.exists){msg='Código não encontrado. Confira com o clube.';render();return;}
    msg='';codes.push(c);saveCodes();watch(c);render();
  }).catch(()=>{msg='Não consegui consultar. Verifique sua internet.';render();});
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-a]');
  if(e.target.id==='modal'){$('#modal').classList.remove('show');return;}
  if(!t)return;
  const a=t.dataset.a,v=t.dataset.v;
  if(a==='add')addCode($('#mat').value);
  if(a==='rm'){codes=codes.filter(c=>c!==v);saveCodes();if(unsubs[v]){unsubs[v]();delete unsubs[v];}delete kids[v];render();}
  if(a==='zoom'){$('#box').innerHTML=`<img src="${v}" alt="" style="width:100%;border-radius:18px;margin-bottom:12px"><button class="btn sec full" data-a="closem">Fechar</button>`;$('#modal').classList.add('show');}
  if(a==='closem')$('#modal').classList.remove('show');
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='mat')addCode(e.target.value);});
function boot(){
  const cfg=window.FIREBASE_CONFIG;
  if(!window.firebase||!cfg||!cfg.apiKey||/COLE/i.test(cfg.apiKey)){$('#app').innerHTML=header()+'<main class="page"><div class="card"><div class="empty">Página indisponível no momento. Tente novamente mais tarde.</div></div></main>';return;}
  firebase.initializeApp(cfg);fs=firebase.firestore();
  const m=norm(new URLSearchParams(location.search).get('m'));
  render();
  codes.forEach(watch);
  if(m&&m.length===4&&!codes.includes(m))addCode(m);
  else if(m&&codes.includes(m))render();
}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
boot();
