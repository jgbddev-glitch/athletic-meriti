'use strict';
const VERSION='2.3.0';
const IDLE_MS=5*60*1000;
const FACE_T=0.5;
const FACE_LIB='https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.js';
const FACE_MODELS='https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
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
const slug=t=>String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const normPhone=v=>{let d=String(v||'').replace(/\D/g,'');if(d.length===10||d.length===11)d='55'+d;return d;};
async function hashPin(pin,id){const b=new TextEncoder().encode('am:'+id+':'+pin);const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const colorOf=id=>['#ff7a1a','#4c8dff','#35d06a','#b05cff','#ff5c93','#14b8c4','#f5b400'][[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0)%7];
function avatar(s,z){const st=z?`width:${z}px;height:${z}px;font-size:${Math.round(z/2.4)}px`:'';
  return s.photo?`<div class="av" style="${st}"><img src="${s.photo}" alt=""></div>`:`<div class="av" style="background:${colorOf(s.id)};${st}">${esc((s.name||'?')[0].toUpperCase())}</div>`;}
const logSports=l=>l.sports||(l.sport?[l.sport]:[]);

/* ---------- estado ---------- */
const st={stage:'boot',students:[],profs:[],pending:[],logs:{},prof:null,view:'home',aq:'',aTab:'hoje',hDate:dkey(),today:dkey(),fSport:'todos',delId:null,newPhoto:'',busy:false,profsLoaded:false};
let auth,fs,subs={},idleT,flT,tt,pad=null,cleanup=null,camStream=null,editPhoto='',portalSynced=false,faceP=null,cool={};
const kcam={running:false,stream:null,timer:null,streak:{sid:null,n:0},miss:0,wake:null};

/* ---------- utilidades de UI ---------- */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3000);}
function flash(icon,title,sub,photo){const f=$('#flash');f.innerHTML=`<div class="fbox"><div class="fic">${photo?`<img src="${photo}" alt="">`:icon}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>`;f.classList.add('show');clearTimeout(flT);flT=setTimeout(()=>f.classList.remove('show'),2300);}
function openModal(html,onClose){if(cleanup){const c=cleanup;cleanup=null;c();}$('#box').innerHTML=html;$('#modal').classList.add('show');cleanup=onClose||null;}
function closeModal(){const c=cleanup;cleanup=null;pad=null;$('#modal').classList.remove('show');if(c)c();setTimeout(startKiosk,400);}
function stopCam(){if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;}}
function err(e){console.error(e);toast(e&&e.code==='permission-denied'?'Sem permissão no banco: confira as regras do Firestore':'Erro de sincronização. Tente novamente.');}
function bumpIdle(){clearTimeout(idleT);if(st.prof)idleT=setTimeout(lockProf,IDLE_MS);}
function lockProf(){if(!st.prof)return;st.prof=null;st.view='home';render();toast('Área do professor bloqueada por inatividade');}
const getCam=()=>navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:640}},audio:false});

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
function stopAll(){Object.values(subs).forEach(u=>u&&u());subs={};portalSynced=false;}
function watchDay(key,day){
  if(subs[key])subs[key]();
  subs[key]=fs.collection('logs').where('day','==',day).onSnapshot(sn=>{const m={};sn.forEach(d=>m[d.id]=d.data());st.logs[day]=m;refresh();},err);
}
function start(){
  stopAll();st.stage='app';st.today=dkey();
  subs.students=fs.collection('students').onSnapshot(sn=>{st.students=sn.docs.map(d=>d.data()).sort(byName);if(!sn.metadata.fromCache)ensurePortal();refresh();},err);
  subs.profs=fs.collection('professors').onSnapshot(sn=>{st.profs=sn.docs.map(d=>d.data()).sort(byName);st.profsLoaded=true;refresh();},err);
  subs.pending=fs.collection('pending').onSnapshot(sn=>{st.pending=sn.docs.map(d=>d.data()).sort((a,b)=>a.ts-b.ts);refresh();},err);
  watchDay('today',st.today);watchDay('hist',st.hDate);
  render();
}
setInterval(()=>{if(st.stage==='app'&&dkey()!==st.today){st.today=dkey();watchDay('today',st.today);render();}},30000);

/* ---------- consultas ---------- */
const logId=(day,sid)=>day+'_'+sid;
const logOf=(sid,day=st.today)=>(st.logs[day]||{})[logId(day,sid)];
function status(sid,day){const l=logOf(sid,day);return !l?'none':l.out?'out':'in';}

/* ---------- reconhecimento facial ---------- */
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s);});}
function loadFace(){
  if(faceP)return faceP;
  faceP=(async()=>{try{
    if(!window.faceapi)await loadScript(FACE_LIB);
    const f=window.faceapi;
    await f.nets.tinyFaceDetector.loadFromUri(FACE_MODELS);
    await f.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODELS);
    await f.nets.faceRecognitionNet.loadFromUri(FACE_MODELS);
    return true;
  }catch(e){console.error(e);faceP=null;return false;}})();
  return faceP;
}
const detect=v=>faceapi.detectSingleFace(v,new faceapi.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:0.5})).withFaceLandmarks(true).withFaceDescriptor();
let fdbFor=null,fdb=[];
function getFdb(){
  if(fdbFor!==st.students){fdb=[];st.students.forEach(s=>(s.faces||[]).forEach(f=>{const d=Float32Array.from(String(f).split(',').map(Number));if(d.length===128)fdb.push({sid:s.id,d});}));fdbFor=st.students;}
  return fdb;
}
function matchFace(desc){
  const best={};
  for(const e of getFdb()){let sum=0;for(let i=0;i<128;i++){const x=desc[i]-e.d[i];sum+=x*x;}const d=Math.sqrt(sum);if(!(e.sid in best)||d<best[e.sid])best[e.sid]=d;}
  const r=Object.entries(best).sort((a,b)=>a[1]-b[1]);
  if(!r.length||r[0][1]>FACE_T)return null;
  if(r[1]&&r[1][1]-r[0][1]<0.04)return null;
  return {sid:r[0][0],dist:r[0][1]};
}
function camWrap(){let w=document.getElementById('camwrap');if(!w){w=document.createElement('div');w.id='camwrap';w.className='camwrap';w.innerHTML='<video id="kv" playsinline muted autoplay></video><div class="scan"></div><div id="kstatus" class="kstatus"></div>';}return w;}
const kvideo=()=>document.getElementById('kv');
function setK(t){const e=document.getElementById('kstatus');if(e)e.textContent=t;}
function stopKiosk(){
  kcam.running=false;clearTimeout(kcam.timer);
  if(kcam.stream){kcam.stream.getTracks().forEach(t=>t.stop());kcam.stream=null;}
  const v=kvideo();if(v)v.srcObject=null;
  if(kcam.wake){try{kcam.wake.release();}catch(e){}kcam.wake=null;}
}
async function startKiosk(){
  if(kcam.running||st.stage!=='app'||st.busy||(st.view==='admin'&&st.prof))return;
  if($('#modal').classList.contains('show'))return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setK('Câmera indisponível neste aparelho. Use o QR Code ou a matrícula.');return;}
  kcam.running=true;setK('Iniciando câmera…');
  let stream;
  try{stream=await getCam();}catch(e){kcam.running=false;setK('Libere a permissão da câmera para usar o reconhecimento facial.');return;}
  if(!kcam.running){stream.getTracks().forEach(t=>t.stop());return;}
  kcam.stream=stream;const v=kvideo();if(v){v.srcObject=stream;await v.play().catch(()=>{});}
  try{if(navigator.wakeLock)kcam.wake=await navigator.wakeLock.request('screen');}catch(e){}
  setK('Carregando reconhecimento facial…');
  const tryLoad=async()=>{
    if(!kcam.running)return;
    const ok=await loadFace();
    if(!kcam.running)return;
    if(ok){setK('Olhe para a câmera 🙂');kloop();}
    else{setK('Reconhecimento facial indisponível (precisa de internet na primeira vez). Use o QR Code ou a matrícula.');kcam.timer=setTimeout(tryLoad,15000);}
  };
  tryLoad();
}
async function kloop(){
  if(!kcam.running)return;
  const busy=st.busy||$('#modal').classList.contains('show')||document.hidden;
  if(!busy){
    try{const v=kvideo();if(v&&v.videoWidth){const r=await detect(v);if(kcam.running)onDetect(r);}}catch(e){}
  }
  if(kcam.running)kcam.timer=setTimeout(kloop,350);
}
function onDetect(r){
  if(st.busy||$('#modal').classList.contains('show'))return;
  if(!r){kcam.streak={sid:null,n:0};kcam.miss=0;setK('Olhe para a câmera 🙂');return;}
  if(!getFdb().length){setK('Nenhum rosto cadastrado ainda. Use o QR Code ou a matrícula.');return;}
  const m=matchFace(r.descriptor);
  if(!m){kcam.streak={sid:null,n:0};kcam.miss++;if(kcam.miss>=3)setK('Rosto não reconhecido. Use o QR Code ou a matrícula.');return;}
  kcam.miss=0;
  const s=st.students.find(x=>x.id===m.sid);if(!s)return;
  if(Date.now()<(cool[s.id]||0)){setK('Aguarde um instante…');return;}
  kcam.streak=kcam.streak.sid===s.id?{sid:s.id,n:kcam.streak.n+1}:{sid:s.id,n:1};
  setK('Reconhecendo '+s.name.split(' ')[0]+'…');
  if(kcam.streak.n>=3){kcam.streak={sid:null,n:0};confirmFace(s);}
}
function snapFrom(v){const c=document.createElement('canvas');c.width=c.height=240;const x=c.getContext('2d');const m=Math.min(v.videoWidth,v.videoHeight);x.drawImage(v,(v.videoWidth-m)/2,(v.videoHeight-m)/2,m,m,0,0,240,240);return c.toDataURL('image/jpeg',0.6);}
function confirmFace(s){
  const stt=status(s.id),l=logOf(s.id);
  if(stt==='out'){cool[s.id]=Date.now()+15000;flash('✋','Você já saiu hoje',s.name.split(' ')[0]);return;}
  if(stt==='in'&&l&&Date.now()-l.in<60000){cool[s.id]=Date.now()+15000;setK('Você acabou de entrar 😉');return;}
  st.busy=true;let n=3,ok=false,t;
  openModal(`${avatar(s,96)}<h2>${esc(s.name)}</h2><p>${stt==='in'?'Saída':'Entrada'} em <b id="cd2">3</b>…</p><button class="btn sec full" id="nao">Não sou eu</button>`,()=>{clearInterval(t);st.busy=false;if(!ok)cool[s.id]=Date.now()+15000;});
  $('#nao').onclick=()=>closeModal();
  t=setInterval(()=>{n--;if(n>0){const e=$('#cd2');if(e)e.textContent=n;return;}
    clearInterval(t);const v=kvideo();const photo=v&&v.videoWidth?snapFrom(v):'';ok=true;cool[s.id]=Date.now()+15000;closeModal();toggle(s,photo);},1000);
}

/* ---------- câmera: foto e QR ---------- */
function capturePhoto(){return new Promise(async res=>{
  // resolve: foto (texto) | '' (câmera indisponível) | null (aluno cancelou)
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){res('');return;}
  let stream;try{stream=await getCam();}catch(e){res('');return;}
  camStream=stream;let done=false;
  const finish=d=>{if(done)return;done=true;res(d);closeModal();};
  openModal(`<h2>Sorria! 📸</h2><p>A foto será tirada em <b id="cd">3</b></p><div class="vid mirror"><video id="vd" playsinline muted autoplay></video></div><button class="btn sec full" id="cnc">Cancelar</button>`,()=>{stopCam();if(!done){done=true;res(null);}});
  const v=$('#vd');v.srcObject=stream;await v.play().catch(()=>{});
  $('#cnc').onclick=()=>finish(null);
  let n=3;const t=setInterval(()=>{if(done){clearInterval(t);return;}n--;if(n>0){const c=$('#cd');if(c)c.textContent=n;return;}if(!v.videoWidth){n=1;return;}clearInterval(t);finish(snapFrom(v));},1000);
});}
async function scanQR(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Câmera indisponível neste aparelho');return;}
  stopKiosk();let alive=true;
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
      if(txt.startsWith('AM|')){const s=st.students.find(x=>x.id===txt.slice(3));if(s){alive=false;closeModal();proceed(s);return;}}
    }catch(e){}
    if(alive)requestAnimationFrame(loop);
  };
  loop();
}
function openMat(){
  openPad({title:'Sua matrícula',sub:'Digite os 4 números',check:c=>st.students.some(s=>s.code===c),done:c=>proceed(st.students.find(s=>s.code===c))});
}

/* ---------- check-in / check-out ---------- */
async function proceed(s){
  if(!s)return;
  const stt=status(s.id);
  if(stt==='out'){toast('Você já fez check-out hoje 😉');return;}
  st.busy=true;stopKiosk();
  const photo=await capturePhoto();
  st.busy=false;
  if(photo===null){setTimeout(startKiosk,500);return;}
  if(photo===''&&stt==='none'){toast('Para entrar é preciso liberar a câmera e tirar a foto.');setTimeout(startKiosk,500);return;}
  toggle(s,photo);setTimeout(startKiosk,800);
}
function toggle(s,photo){
  const now=Date.now(),day=dkey(),id=logId(day,s.id),cur=(st.logs[day]||{})[id],ref=fs.collection('logs').doc(id),first=s.name.split(' ')[0],sports=s.sports||[];
  const em=sports.map(x=>sp_(x).emoji).join('')||'🏅';
  if(!cur){
    ref.set({id,day,sid:s.id,sports,in:now,photoIn:photo||''}).catch(err);portalEvent(s,id,{day,sports,in:now,photoIn:photo||'',ts:now},false);
    flash('✅','Check-in feito!',`Bom treino, ${first} ${em}`,photo);queue(s,'in');
  }else if(!cur.out){
    ref.update({out:now,photoOut:photo||''}).catch(err);portalEvent(s,id,{out:now,photoOut:photo||''},true);
    flash('👋','Check-out feito!',`Até a próxima, ${first}`,photo);queue(s,'out');
  }
}
function queue(s,ev){if(!s.phone)return;const id=uid('w');fs.collection('pending').doc(id).set({id,sid:s.id,ev,ts:Date.now()}).catch(err);}
function waUrl(p,s){const t=hm(p.ts),sp=(s.sports||[]).map(x=>sp_(x).name).join(' e ')||'basquete/futsal';
  const msg=p.ev==='in'?`🏅 Athletic Meriti: ${s.name} chegou ao treino de ${sp} às ${t}.`:`🏅 Athletic Meriti: ${s.name} saiu do treino de ${sp} às ${t}. Até a próxima!`;
  return 'https://wa.me/'+s.phone+'?text='+encodeURIComponent(msg);}

/* ---------- portal dos pais (acesso pelo código de 4 dígitos) ---------- */
const portalUrl=()=>new URL('pais.html',location.href).href.split('?')[0].split('#')[0];
function syncPortal(s){if(!s.code)return;fs.collection('portal').doc(s.code).set({first:String(s.name).split(' ')[0],sports:s.sports||[],updated:Date.now()},{merge:true}).catch(err);}
function portalEvent(s,id,data,merge){if(!s.code)return;const r=fs.collection('portal').doc(s.code).collection('events').doc(id);(merge?r.set(data,{merge:true}):r.set(data)).catch(err);}
function ensurePortal(){if(portalSynced||!st.students.length)return;portalSynced=true;st.students.forEach(syncPortal);}
function sendPais(id){
  const s=st.students.find(x=>x.id===id);if(!s)return;
  const msg=`Olá! Acompanhe a entrada e a saída de ${s.name.split(' ')[0]} nos treinos do Athletic Meriti: ${portalUrl()}?m=${s.code}\nMatrícula: ${s.code}`;
  window.open('https://wa.me/'+(s.phone||'')+'?text='+encodeURIComponent(msg),'_blank');
}
function newCode(id){
  const s=st.students.find(x=>x.id===id);if(!s)return;
  if(!confirm('Gerar uma nova matrícula? A atual deixa de funcionar, no check-in e para os pais.'))return;
  let c;do{c=String(Math.floor(1000+Math.random()*9000));}while(st.students.some(x=>x.code===c));
  const old=s.code;
  fs.collection('students').doc(id).update({code:c}).catch(err);
  syncPortal(Object.assign({},s,{code:c}));
  if(old){const pr=fs.collection('portal').doc(old),nr=fs.collection('portal').doc(c).collection('events');
    pr.collection('events').get().then(sn=>{const b=fs.batch();sn.forEach(d=>{b.set(nr.doc(d.id),d.data());b.delete(d.ref);});b.delete(pr);return b.commit();}).catch(err);}
  closeModal();toast('Nova matrícula: '+c);
}

/* ---------- telas ---------- */
function setupHtml(){return `<div class="setup card"><h2>⚙️ Falta configurar</h2>${window.firebase?'<p>Abra o arquivo <code>firebase-config.js</code> e cole os dados do seu projeto Firebase. O passo a passo está no <b>LEIA-ME.md</b>.</p>':'<p>Não consegui carregar os componentes. Conecte à internet e abra novamente (só na primeira vez).</p>'}</div>`;}
function loginHtml(){return `<div class="auth"><img class="logo big" src="icon-192.png" alt=""><h1>Athletic Meriti</h1><p>Entre com a conta deste aparelho</p><div class="fld"><input id="le" type="email" placeholder="E-mail" autocomplete="username"></div><div class="fld"><input id="lp" type="password" placeholder="Senha" autocomplete="current-password"></div><div class="bad" id="lerr"></div><button class="btn full" data-a="login">Entrar</button><p class="hint">Isso é feito uma vez por aparelho. Depois ele fica conectado.</p></div>`;}
function topbar(){return `<header class="top"><div class="brand" data-a="home"><img src="icon-192.png" class="logo" alt=""><div><b>Athletic Meriti</b><small>Check-in &amp; check-out</small></div></div><div class="tr">${st.prof?`<span class="who">👤 ${esc(st.prof.name)}</span><button class="pbtn" data-a="panel">Painel</button><button class="pbtn ghost" data-a="lock">Sair</button>`:`<button class="pbtn" data-a="prof">🔒 Professor</button>`}</div></header>`;}
function footer(){return `<div class="foot">v${VERSION} · ${navigator.onLine?'🟢 online':'🟠 offline: sincroniza quando a internet voltar'}</div>`;}
const counts=()=>({inn:st.students.filter(s=>status(s.id)==='in').length,out:st.students.filter(s=>status(s.id)==='out').length,all:st.students.length});
function homeHtml(){const c=counts();
  return `<div class="kiosk"><h1 class="kh">Olhe para a <span>câmera</span></h1><div id="camslot" class="camslot"></div>
  <div class="kbtns"><button class="btn qr" data-a="qr">📷 QR Code</button><button class="btn" data-a="mat">🔢 Matrícula</button></div>
  <div class="stats"><div class="stat g"><b id="sin">${c.inn}</b><span>Na quadra</span></div><div class="stat b"><b id="sout">${c.out}</b><span>Já saíram</span></div><div class="stat o"><b id="sall">${c.all}</b><span>Alunos</span></div></div></div>`;}
function updateStats(){const a=$('#sin');if(!a)return false;const c=counts();a.textContent=c.inn;$('#sout').textContent=c.out;$('#sall').textContent=c.all;return true;}
function sportChips(sel){return `<div class="chips">${SPORTS.map(x=>`<button class="chip ${sel.includes(x.id)?'on':''}" data-a="chip" data-v="${x.id}" style="--c:${x.color}">${x.emoji} ${x.name}</button>`).join('')}</div>`;}
function studentRow(s,adm){
  return `<div class="li"><div class="lf">${avatar(s,44)}<div><b>${esc(s.name)}</b><div class="m">${(s.sports||[]).map(x=>`<span class="tag">${sp_(x).emoji} ${sp_(x).name}</span>`).join('')}${esc(s.turma||'')} · Matrícula <b>${esc(s.code)}</b>${(s.faces||[]).length?' · 😀':' · sem rosto'}</div></div></div><div class="row" style="margin:0"><button class="btn sm sec" data-a="face" data-v="${s.id}">😀</button><button class="btn sm sec" data-a="sendpais" data-v="${s.id}">📲</button><button class="btn sm sec" data-a="card" data-v="${s.id}">🪪</button><button class="btn sm sec" data-a="edit" data-v="${s.id}">Editar</button>${adm?`<button class="btn sm ${st.delId===s.id?'red':'sec'}" data-a="del" data-v="${s.id}">${st.delId===s.id?'Confirmar?':'🗑'}</button>`:''}</div></div>`;
}
function adminHtml(){
  const adm=st.prof.role==='admin';
  const tabs=[['av','Avisos'+(st.pending.length?` (${st.pending.length})`:'')],['hoje','Hoje'],['hist','Histórico'],['alunos','Alunos'],['cad','+ Aluno']];
  if(adm)tabs.push(['profs','Professores']);tabs.push(['cfg','Ajustes']);
  let h=`<div class="hello">Olá, <b>${esc(st.prof.name)}</b><span class="role">${adm?'Administrador':'Professor'}</span></div><div class="sub">${tabs.map(t=>`<button data-a="tab" data-v="${t[0]}" class="${st.aTab===t[0]?'on':''}">${t[1]}</button>`).join('')}</div>`;
  const T=st.aTab;
  if(T==='av'){
    h+=`<div class="card"><h3>Avisos de WhatsApp pendentes (${st.pending.length})</h3>`;
    h+=st.pending.length?st.pending.map(p=>{const s=st.students.find(x=>x.id===p.sid);if(!s||!s.phone)return '';
      return `<div class="li"><div class="lf">${avatar(s,42)}<div><b>${esc(s.name)}</b><div class="m">${p.ev==='in'?'Chegou':'Saiu'} · ${hm(p.ts)}</div></div></div><div class="row" style="margin:0"><a class="btn sm wa" href="${waUrl(p,s)}" target="_blank" rel="noopener" data-sent="${p.id}">Enviar</a><button class="btn sm sec" data-a="skip" data-v="${p.id}">Dispensar</button></div></div>`}).join(''):'<div class="empty">Nenhum aviso pendente 🎉</div>';
    h+='</div>';if(st.pending.length>1)h+='<button class="btn sec full" data-a="clearav">Limpar todos os avisos</button>';
  }
  if(T==='hoje'||T==='hist'){
    const day=T==='hoje'?st.today:st.hDate,f=st.fSport;
    const logs=Object.values(st.logs[day]||{}).filter(l=>f==='todos'||logSports(l).includes(f)).sort((a,b)=>a.in-b.in);
    const enr=st.students.filter(s=>f==='todos'||has(s,f)).length;
    h+=`<div class="chips" style="margin-bottom:12px"><button class="chip ${f==='todos'?'on':''}" data-a="fsport" data-v="todos">Todos</button>${SPORTS.map(x=>`<button class="chip ${f===x.id?'on':''}" data-a="fsport" data-v="${x.id}" style="--c:${x.color}">${x.emoji} ${x.name}</button>`).join('')}</div>`;
    if(T==='hist')h+=`<div class="card"><input type="date" id="hd" value="${st.hDate}"></div>`;
    h+=`<div class="card"><h3>${logs.length} presenças · ${Math.max(0,enr-logs.length)} ausências</h3>`;
    h+=logs.length?logs.map(l=>{const s=st.students.find(x=>x.id===l.sid)||{id:l.sid,name:'(aluno removido)'};const sl=logSports(l).map(sp_);
      return `<div class="li"><div class="lf">${avatar(s,44)}<div><b>${esc(s.name)}</b><div class="m"><i class="dot" style="background:${(sl[0]||{}).color||'#999'}"></i>${sl.map(x=>x.emoji+' '+x.name).join(' · ')} · Entrada ${hm(l.in)}${l.out?` · Saída ${hm(l.out)} · ${dur(l.in,l.out)}`:''}</div></div></div><div class="ph2">${l.photoIn?`<img src="${l.photoIn}" alt="" data-a="zoom" data-v="${l.id}|photoIn">`:''}${l.photoOut?`<img src="${l.photoOut}" alt="" data-a="zoom" data-v="${l.id}|photoOut">`:''}<span class="pill ${l.out?'out':'in'}">${l.out?'Saiu':'Na quadra'}</span></div></div>`}).join(''):'<div class="empty">Nenhum registro neste dia.</div>';
    h+='</div>';
  }
  if(T==='alunos'){
    const list=st.students.filter(s=>s.name.toLowerCase().includes(st.aq.toLowerCase()));
    h+=`<div class="card"><input id="aq" placeholder="🔍 Buscar aluno…" value="${esc(st.aq)}" autocomplete="off"></div>
    <div class="row" style="flex-wrap:wrap"><button class="btn sec sm" data-a="shareall">📤 Compartilhar todos os QR Codes</button><button class="btn sec sm" data-a="printall">🖨 Imprimir carteirinhas</button></div>`;
    SPORTS.forEach(sp=>{const l=list.filter(s=>has(s,sp.id));
      h+=`<div class="card"><h3 style="color:${sp.color}">${sp.emoji} ${sp.name} (${l.length})</h3>${l.length?l.map(s=>studentRow(s,adm)).join(''):'<div class="empty">Nenhum aluno neste esporte.</div>'}</div>`;});
  }
  if(T==='cad'){
    h+=`<div class="card"><h3>Novo aluno</h3>
    <div class="fld"><label>Nome completo</label><input id="nn" placeholder="Nome do aluno"></div>
    <div class="fld"><label>Turma / categoria</label><input id="nt" placeholder="Ex.: Sub-13"></div>
    <div class="fld"><label>WhatsApp do responsável (com DDD)</label><input id="nw" inputmode="tel" placeholder="21 99999-9999"></div>
    <div class="fld"><label>Esporte(s) em que está inscrito</label><div id="cadsp">${sportChips([])}</div></div>
    <div class="row"><div id="prev" class="av" style="margin:0;background:var(--card2);color:var(--mut)">${st.newPhoto?`<img src="${st.newPhoto}" alt="">`:'📷'}</div><label class="btn sec" style="cursor:pointer">Foto do aluno<input type="file" id="ph" accept="image/*" style="display:none"></label></div>
    <button class="btn full" data-a="addstudent">Cadastrar aluno</button><p class="hint">Depois de cadastrar, o app pede para registrar o rosto do aluno na câmera. A matrícula de 4 dígitos serve para o check-in e para os pais acompanharem.</p></div>`;
  }
  if(T==='profs'&&adm){
    h+=`<div class="card"><h3>Professores</h3>`;
    h+=st.profs.map(p=>`<div class="li"><div class="lf"><div class="av" style="background:${colorOf(p.id)};width:42px;height:42px;font-size:18px;margin:0">${esc(p.name[0].toUpperCase())}</div><div><b>${esc(p.name)}</b><div class="m">${p.role==='admin'?'Administrador':'Professor'}</div></div></div><div class="row" style="margin:0"><button class="btn sm sec" data-a="editprof" data-v="${p.id}">Editar</button>${p.id!==st.prof.id?`<button class="btn sm ${st.delId===p.id?'red':'sec'}" data-a="delprof" data-v="${p.id}">${st.delId===p.id?'Confirmar?':'🗑'}</button>`:''}</div></div>`).join('')||'<div class="empty">Nenhum professor.</div>';
    h+=`</div><div class="card"><h3>Novo professor</h3><div class="fld"><label>Nome</label><input id="pn" placeholder="Nome do professor"></div><div class="fld"><label>PIN (4 números)</label><input id="pp" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div><div class="fld"><label>Tipo de acesso</label><select id="pr"><option value="teacher">Professor (cadastra alunos e vê presenças)</option><option value="admin">Administrador (também gerencia professores)</option></select></div><button class="btn full" data-a="addprof">Cadastrar professor</button></div>`;
  }
  if(T==='cfg'){
    h+=`<div class="card"><h3>Meu acesso</h3><button class="btn sec full" data-a="editprof" data-v="${st.prof.id}">Trocar meu nome ou PIN</button></div>
    <div class="card"><h3>Página dos pais</h3><p class="hint" style="margin:0 0 10px">Os pais abrem este endereço e digitam a matrícula de 4 dígitos do filho (aba Alunos). O botão 📲 do aluno já envia o link com a matrícula.</p><div class="fld"><input id="pl" readonly value="${esc(portalUrl())}"></div><button class="btn sec full" data-a="copylink">Copiar link</button></div>
    <div class="card"><h3>Este aparelho</h3><p class="hint" style="margin:0 0 10px">Versão ${VERSION}. O professor é bloqueado sozinho após 5 minutos sem uso.</p><button class="btn red full" data-a="logout">Desconectar este aparelho</button></div>`;
  }
  return h;
}
function render(){
  const a=$('#app');
  const cw=document.getElementById('camwrap');if(cw&&cw.parentNode)cw.parentNode.removeChild(cw);
  if(st.stage==='setup'){stopKiosk();a.innerHTML=setupHtml();return;}
  if(st.stage==='login'){stopKiosk();a.innerHTML=loginHtml();return;}
  if(st.stage!=='app'){stopKiosk();a.innerHTML='<div class="splash"><img class="logo big" src="icon-192.png" alt=""><p>Carregando…</p></div>';return;}
  const f=document.activeElement,fid=f&&f.id,pos=f&&f.selectionStart;
  const adminView=st.view==='admin'&&st.prof;
  a.innerHTML=topbar()+`<main class="page">${adminView?adminHtml():homeHtml()}</main>`+footer();
  if(fid==='aq'){const i=$('#aq');if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}
  if(adminView)stopKiosk();
  else{const slot=$('#camslot');if(slot){slot.appendChild(camWrap());const v=kvideo();if(v&&v.srcObject)v.play().catch(()=>{});}startKiosk();}
}
function refresh(){
  if(st.stage!=='app')return;
  if(!(st.view==='admin'&&st.prof)){if(!updateStats())render();return;}
  if(st.aTab==='cad'||st.aTab==='profs')return;
  render();
}
window.addEventListener('online',()=>render());window.addEventListener('offline',()=>render());
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopKiosk();else startKiosk();});

/* ---------- teclado numérico ---------- */
function padHtml(){const v=pad.val;
  return `${pad.avatar||''}<h2>${esc(pad.title)}</h2><p>${esc(pad.sub)}</p><div class="dots">${[0,1,2,3].map(i=>`<i class="${i<v.length?'f':''}"></i>`).join('')}</div><div class="err">${pad.err||''}</div>
  <div class="keys">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join('')}<button data-k="x" style="font-size:15px">Cancelar</button><button data-k="0">0</button><button data-k="b">⌫</button></div>`;}
function openPad(cfg){pad=Object.assign({val:'',err:'',busy:false},cfg);openModal(padHtml());}
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
      if(ok){const d=cur.done,v=cur.val;closeModal();d(v);return;}
      cur.val='';cur.err='Código incorreto';cur.busy=false;showPad();
      $('#box').classList.add('shake');setTimeout(()=>$('#box').classList.remove('shake'),300);
    });
    return;
  }
  showPad();
}

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

/* ---------- alunos ---------- */
function readPhoto(f,cb){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=200;const x=c.getContext('2d');const m=Math.min(im.width,im.height);x.drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,200,200);cb(c.toDataURL('image/jpeg',0.75));};im.src=r.result;};r.readAsDataURL(f);}
function saveNewStudent(){
  const name=$('#nn').value.trim();if(!name)return toast('Digite o nome do aluno');
  const sports=[...document.querySelectorAll('#cadsp .chip.on')].map(x=>x.dataset.v);if(!sports.length)return toast('Escolha ao menos um esporte');
  const ph=normPhone($('#nw').value);if($('#nw').value.trim()&&ph.length<12)return toast('WhatsApp inválido: use DDD + número');
  let code;do{code=String(Math.floor(1000+Math.random()*9000));}while(st.students.some(s=>s.code===code));
  const s={id:uid('s'),name,turma:$('#nt').value.trim(),phone:ph,photo:st.newPhoto||'',code,faces:[],sports,createdBy:st.prof.name,createdAt:Date.now()};
  fs.collection('students').doc(s.id).set(s).catch(err);syncPortal(s);
  st.newPhoto='';render();toast(`✅ ${name} cadastrado! Matrícula: ${code}`);
  openFaceEnroll(s,u=>openCard(u));
}
function openEdit(id){
  const s=st.students.find(x=>x.id===id);if(!s)return;editPhoto=s.photo||'';
  openModal(`<h2>Editar aluno</h2><div class="row" style="margin-top:12px"><div id="eprev">${avatar(s,56)}</div><label class="btn sec" style="cursor:pointer">Trocar foto<input type="file" id="eph" accept="image/*" style="display:none"></label></div>
  <div class="fld"><label>Nome</label><input id="en" value="${esc(s.name)}"></div><div class="fld"><label>Turma</label><input id="et" value="${esc(s.turma||'')}"></div>
  <div class="fld"><label>WhatsApp com DDD</label><input id="ew" inputmode="tel" value="${esc((s.phone||'').replace(/^55/,''))}"></div>
  <div class="fld"><label>Esportes</label><div id="edsp">${sportChips(s.sports||[])}</div></div>
  <p class="hint" style="margin-bottom:10px">Matrícula (check-in e acesso dos pais): <b>${esc(s.code)}</b></p><button class="btn sm sec" data-a="newcode" data-v="${s.id}" style="margin-bottom:12px">Gerar nova matrícula</button>
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
/* cadastro do rosto: 4 amostras pela câmera */
async function openFaceEnroll(s,after){
  const end=u=>{st.busy=false;if(after)after(u||s);};
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Câmera indisponível neste aparelho');end();return;}
  st.busy=true;stopKiosk();
  toast('Preparando o reconhecimento facial…');
  if(!(await loadFace())){toast('Não consegui carregar o reconhecimento facial (precisa de internet na primeira vez).');end();return;}
  let stream;try{stream=await getCam();}catch(e){toast('Libere a permissão da câmera');end();return;}
  camStream=stream;let alive=true,finished=false,samples=[],photo='';
  const dots=()=>`<div class="dots">${[0,1,2,3].map(i=>`<i class="${i<samples.length?'f':''}"></i>`).join('')}</div>`;
  openModal(`<h2>Cadastrar rosto</h2><p>${esc(s.name.split(' ')[0])}, olhe para a câmera e vire levemente a cabeça</p><div class="vid mirror"><video id="fv" playsinline muted autoplay></video></div><div id="fd">${dots()}</div><button class="btn sec full" id="fc">${after?'Fazer depois':'Cancelar'}</button>`,()=>{alive=false;stopCam();if(!finished)end();});
  $('#fc').onclick=()=>closeModal();
  const v=$('#fv');v.srcObject=stream;await v.play().catch(()=>{});
  const loop=async()=>{
    if(!alive)return;
    try{
      if(v.videoWidth){
        const r=await detect(v);
        if(alive&&r&&r.detection.score>0.7){
          if(!samples.length)photo=snapFrom(v);
          samples.push(Array.from(r.descriptor,x=>+x.toFixed(4)).join(','));
          const d=$('#fd');if(d)d.innerHTML=dots();
          if(samples.length>=4){
            finished=true;const upd={faces:samples};if(!s.photo&&photo)upd.photo=photo;
            fs.collection('students').doc(s.id).update(upd).catch(err);
            const u=Object.assign({},s,upd);closeModal();toast('😀 Rosto cadastrado!');end(u);return;
          }
          await new Promise(ok=>setTimeout(ok,900));
        }
      }
    }catch(e){}
    if(alive)setTimeout(loop,300);
  };
  loop();
}

/* ---------- carteirinha e QR Code ---------- */
function qrModules(text){const q=qrcode(0,'M');q.addData(text);q.make();return {n:q.getModuleCount(),dark:(r,c)=>q.isDark(r,c)};}
function qrSvg(text){const m=qrModules(text),n=m.n;let p='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m.dark(r,c))p+=`M${c},${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n+4} ${n+4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n+4}" height="${n+4}" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;}
function cardHtml(s,id){
  let qr='';try{qr=qrSvg('AM|'+s.id);}catch(e){qr=`<div style="color:#000;padding:20px">QR indisponível. Matrícula: ${esc(s.code)}</div>`;}
  return `<div ${id?`id="${id}" `:''}class="idcard"><div class="ct"><img src="icon-192.png" alt="">ATHLETIC MERITI</div>${avatar(s,84)}<h3>${esc(s.name)}</h3><div>${(s.sports||[]).map(x=>`<span class="tag" style="color:${sp_(x).color}">${sp_(x).emoji} ${sp_(x).name}</span>`).join('')}</div><div class="qrb">${qr}</div><div style="font-size:13px;color:#c9b8aa">Matrícula ${esc(s.code)}</div></div>`;
}
function openCard(s){
  st.cardStudent=s;
  openModal(cardHtml(s,'card')+`<div class="cbtns"><button class="btn full" data-a="shareone">📤 Compartilhar</button><button class="btn sec full" data-a="print">🖨</button></div><button class="btn sec full" data-a="close" style="margin-top:8px">Fechar</button>`);
}
const loadImg=src=>new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=src;});
async function cardBlob(s){
  const W=600,H=840,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const rr=(a,b,w,h,r)=>{x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();};
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#14110e');g.addColorStop(1,'#2a2318');
  rr(0,0,W,H,36);x.fillStyle=g;x.fill();rr(8,8,W-16,H-16,30);x.lineWidth=8;x.strokeStyle='#ff7a1a';x.stroke();
  const logo=await loadImg('icon-192.png');
  if(logo){x.save();rr(150,34,56,56,12);x.clip();x.drawImage(logo,150,34,56,56);x.restore();}
  x.fillStyle='#fff';x.font='800 30px system-ui,sans-serif';x.textAlign='left';x.textBaseline='middle';x.fillText('ATHLETIC MERITI',222,62);
  const cx=W/2,cy=190,R=62,ph=s.photo?await loadImg(s.photo):null;
  x.save();x.beginPath();x.arc(cx,cy,R,0,Math.PI*2);x.closePath();x.clip();
  if(ph)x.drawImage(ph,cx-R,cy-R,R*2,R*2);else{x.fillStyle=colorOf(s.id);x.fillRect(cx-R,cy-R,R*2,R*2);x.fillStyle='#fff';x.font='800 64px system-ui,sans-serif';x.textAlign='center';x.fillText((s.name||'?')[0].toUpperCase(),cx,cy+4);}
  x.restore();
  x.textAlign='center';x.fillStyle='#fff';let fz=36;x.font=`800 ${fz}px system-ui,sans-serif`;
  while(x.measureText(s.name).width>W-70&&fz>20){fz-=2;x.font=`800 ${fz}px system-ui,sans-serif`;}
  x.fillText(s.name,cx,290);
  x.font='700 24px system-ui,sans-serif';x.fillStyle='#ff9a3d';x.fillText((s.sports||[]).map(k=>sp_(k).emoji+' '+sp_(k).name).join('   '),cx,332);
  const m=qrModules('AM|'+s.id),box=380,bx=(W-box)/2,by=370;rr(bx,by,box,box,22);x.fillStyle='#fff';x.fill();
  const cell=Math.floor((box-24)/m.n),qs=cell*m.n,qx=bx+(box-qs)/2,qy=by+(box-qs)/2;x.fillStyle='#000';
  for(let r=0;r<m.n;r++)for(let c=0;c<m.n;c++)if(m.dark(r,c))x.fillRect(qx+c*cell,qy+r*cell,cell,cell);
  x.fillStyle='#c9b8aa';x.font='700 28px system-ui,sans-serif';x.fillText('Matrícula '+s.code,cx,by+box+50);
  return new Promise(ok=>cv.toBlob(ok,'image/png'));
}
function downloadFiles(files){files.forEach((f,i)=>setTimeout(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();a.remove();},i*350));}
async function shareOne(){
  const s=st.cardStudent;if(!s)return;
  if(!window.qrcode)return toast('QR Code indisponível. Conecte à internet e tente de novo.');
  try{
    const b=await cardBlob(s),f=new File([b],'carteirinha-'+slug(s.name)+'.png',{type:'image/png'});
    const data={files:[f],title:'Carteirinha Athletic Meriti',text:`Carteirinha de ${s.name}. Matrícula (check-in e acompanhamento dos pais): ${s.code}. Página dos pais: ${portalUrl()}?m=${s.code}`};
    if(navigator.canShare&&navigator.canShare(data))await navigator.share(data);
    else{downloadFiles([f]);toast('Compartilhamento indisponível: baixei a imagem');}
  }catch(e){if(!e||e.name!=='AbortError')toast('Não consegui compartilhar');}
}
async function shareAll(){
  if(!window.qrcode)return toast('QR Code indisponível. Conecte à internet e tente de novo.');
  if(!st.students.length)return toast('Nenhum aluno cadastrado');
  toast('Gerando imagens…');
  st.shareFiles=[];
  for(const s of st.students){const b=await cardBlob(s);st.shareFiles.push(new File([b],'carteirinha-'+slug(s.name)+'.png',{type:'image/png'}));}
  openModal(`<h2>QR Codes prontos</h2><p>${st.shareFiles.length} carteirinhas geradas.</p><button class="btn full" data-a="doshare">📤 Compartilhar</button><button class="btn sec full" data-a="dlall" style="margin-top:8px">Baixar imagens</button><button class="btn sec full" data-a="close" style="margin-top:8px">Fechar</button>`);
}
async function doShare(){
  const data={files:st.shareFiles,title:'Carteirinhas Athletic Meriti'};
  try{if(navigator.canShare&&navigator.canShare(data))await navigator.share(data);else{downloadFiles(st.shareFiles);toast('Baixando as imagens…');}}
  catch(e){if(!e||e.name!=='AbortError'){downloadFiles(st.shareFiles);toast('Não deu para compartilhar tudo junto: baixando as imagens');}}
}
function printAll(){
  if(!window.qrcode)return toast('QR Code indisponível. Conecte à internet e tente de novo.');
  if(!st.students.length)return toast('Nenhum aluno cadastrado');
  const d=document.createElement('div');d.id='sheet';d.innerHTML=st.students.map(s=>cardHtml(s)).join('');document.body.appendChild(d);
  const clean=()=>{d.remove();window.removeEventListener('afterprint',clean);};window.addEventListener('afterprint',clean);
  window.print();
}

/* ---------- eventos ---------- */
function act(a,v,t){
  switch(a){
    case 'home':st.view='home';render();break;
    case 'qr':scanQR();break;
    case 'mat':openMat();break;
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
    case 'face':{const s=st.students.find(x=>x.id===v);if(s)openFaceEnroll(s,null);break;}
    case 'card':{const s=st.students.find(x=>x.id===v);if(s)openCard(s);break;}
    case 'print':window.print();break;
    case 'shareone':shareOne();break;
    case 'shareall':shareAll();break;
    case 'doshare':doShare();break;
    case 'dlall':downloadFiles(st.shareFiles||[]);break;
    case 'printall':printAll();break;
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
    case 'logout':stopKiosk();if(auth)auth.signOut();break;
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
document.addEventListener('input',e=>{if(e.target.id==='aq'){st.aq=e.target.value;render();}});
document.addEventListener('change',e=>{
  const i=e.target;
  if(i.id==='hd'){st.hDate=i.value||dkey();watchDay('hist',st.hDate);render();}
  if(i.id==='ph'&&i.files[0])readPhoto(i.files[0],d=>{st.newPhoto=d;$('#prev').innerHTML=`<img src="${d}" alt="">`;});
  if(i.id==='eph'&&i.files[0])readPhoto(i.files[0],d=>{editPhoto=d;$('#eprev').innerHTML=`<div class="av" style="width:56px;height:56px;margin:0"><img src="${d}" alt=""></div>`;});
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target.id==='lp'||e.target.id==='le'))doLogin();});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
boot();
