/* ---------- ÉTAT ---------- */
export const DEFAULTS={
  mode:'camthlidar', layers:{rgb:true,th:true,depth:true}, fusionMode:'msx',
  palette:'ironbow', unit:'C', emissivity:0.95, agc:'auto', level:25, span:20, Tmin:-20, Tmax:550,
  hud:true, legend:true, hist:true, crosshair:true, hotspot:true, coldspot:true,
  isoOn:false, isoStep:5, isoAbove:60, meshOn:true, dotStep:14, meshAlpha:0.6, pointSize:1.6,
  night:false, ai:{detect:true}, depth:{connected:true,fps:8,hd:false},
  anomaly:{enabled:true,thSd:3.5,magSd:3.5,audioSd:3,motion:12,prox:0.35,autoSnap:false,vibrate:true},
  expert:{stack:4,denoise:0.35,sharpen:0.6,clahe:0.4,sat:1.05,vibrance:0.25,contrast:1.06,gamma:1.0,
          wb:'auto',kelvin:5500,vignette:0.15,detailTransfer:0.55,grid:true,zebra:false,peaking:false,horizon:true},
  cam:{torch:false,zoom:1,exposure:0,kelvinCam:0,focus:0},
  photo:{format:'png',scale:2}, video:{fps:30,bitrate:8,mime:'auto',mic:false},
  net:{autoQuality:true,cloudReport:false,prefetchHD:true,sync:true},
  llm:{provider:'none',key:''},
  align:{sx:1,sy:1,ox:0,oy:0,mirror:false,fit:'cover'},
  usb:{vid:'',pid:'',iface:0,epIn:130,fmt:'u16temp',w:256,h:192,hdr:0,magic:'',endian:'le',scale:0.01,offset:0,pkt:16384,colorUVC:false}
};
export const S=(()=>{ try{ return Object.assign(structuredClone(DEFAULTS),JSON.parse(localStorage.getItem('pk5.s')||'{}')); }
  catch{ return structuredClone(DEFAULTS); } })();
export const save=()=>localStorage.setItem('pk5.s',JSON.stringify(S));
export const view={z:1,x:0,y:0};
export const runtime={online:navigator.onLine,net:'—',tier:'medium',rgb:null,depth:null,boxes:[],temps:null,
  hist:null,tilt:{beta:0,gamma:0},gps:null,fx:{zebra:null,peak:null},processing:false,flash:0,motion:0,
  near:0,mag:0,para:0,px:2,thSrc:'—',boot:[],lastRenderErr:''};

/* ---------- BASE LOCALE ---------- */
let p;
export const db=()=>p??=new Promise((res,rej)=>{ const r=indexedDB.open('paranormal5',1);
  r.onupgradeneeded=()=>{ const d=r.result;
    ['media','events','reports','queue'].forEach(s=>{ if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:'id'}); }); };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const tx=(s,m)=>db().then(d=>d.transaction(s,m).objectStore(s));
const rq=q=>new Promise((res,rej)=>{ q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); });
export const put=(s,v)=>tx(s,'readwrite').then(o=>rq(o.put(v)));
export const all=s=>tx(s,'readonly').then(o=>rq(o.getAll()));
export const del=(s,id)=>tx(s,'readwrite').then(o=>rq(o.delete(id)));

/* ---------- PALETTES ---------- */
const P={
 ironbow:[[0,[0,0,0]],[.14,[27,0,79]],[.32,[116,0,156]],[.5,[213,0,116]],[.68,[255,66,14]],[.84,[255,177,44]],[1,[255,255,190]]],
 rainbow:[[0,[0,0,40]],[.2,[0,120,255]],[.4,[0,255,180]],[.6,[255,255,0]],[.8,[255,120,0]],[1,[255,255,255]]],
 whitehot:[[0,[0,0,0]],[1,[255,255,255]]], blackhot:[[0,[255,255,255]],[1,[0,0,0]]],
 redhot:[[0,[0,0,0]],[.5,[120,0,0]],[.8,[255,60,0]],[1,[255,255,255]]],
 greenhot:[[0,[0,0,0]],[.5,[0,110,0]],[.8,[80,255,0]],[1,[255,255,255]]],
 arctic:[[0,[255,255,255]],[.4,[120,200,255]],[.7,[0,80,200]],[1,[0,0,60]]],
 ghost:[[0,[4,2,12]],[.35,[40,10,80]],[.6,[120,40,200]],[.8,[190,120,255]],[1,[245,240,255]]],
 magma:[[0,[0,0,4]],[.3,[80,10,100]],[.6,[200,60,60]],[.85,[255,160,60]],[1,[252,253,191]]],
 inferno:[[0,[0,0,4]],[.35,[120,28,109]],[.7,[237,100,40]],[1,[252,255,164]]],
 sepia:[[0,[30,22,14]],[.5,[140,105,66]],[1,[250,232,196]]]};
export const PALETTE_NAMES=Object.keys(P);
function buildLUT(n){ const st=P[n]||P.ironbow, lut=new Uint8ClampedArray(768);
  for(let i=0;i<256;i++){ const t=i/255; let a=st[0],b=st[st.length-1];
    for(let k=0;k<st.length-1;k++) if(t>=st[k][0]&&t<=st[k+1][0]){a=st[k];b=st[k+1];break;}
    const f=(t-a[0])/Math.max(1e-6,b[0]-a[0]);
    for(let c=0;c<3;c++) lut[i*3+c]=a[1][c]+(b[1][c]-a[1][c])*f; }
  return lut; }
export const LUTS=Object.fromEntries(PALETTE_NAMES.map(n=>[n,buildLUT(n)]));

/* ---------- RÉSEAU ADAPTATIF ---------- */
export const Net={online:navigator.onLine,tier:'medium',downlink:0,rtt:0,saveData:false,label:'—'};
const nl=[]; export const onNet=f=>nl.push(f);
function compute(){ const c=navigator.connection||{};
  Net.online=navigator.onLine; Net.saveData=!!c.saveData; Net.downlink=c.downlink||0; Net.rtt=c.rtt||0;
  const et=c.effectiveType||'';
  if(!Net.online){Net.tier='offline';Net.label='HORS LIGNE';}
  else if(Net.saveData||['slow-2g','2g','3g'].includes(et)||Net.downlink<1.5){Net.tier='low';Net.label=(et||'web').toUpperCase()+' faible';}
  else if(Net.downlink>=10&&Net.rtt<=120){Net.tier='high';Net.label='5G/Wi‑Fi '+Net.downlink+' Mb/s';}
  else{Net.tier='medium';Net.label='4G+ '+(Net.downlink||'~')+' Mb/s';}
  runtime.online=Net.online; runtime.net=Net.label; runtime.tier=Net.tier; nl.forEach(f=>f(Net)); }
export function initNet(){ compute();
  addEventListener('online',compute); addEventListener('offline',compute);
  navigator.connection?.addEventListener?.('change',compute); }
export function effQuality(){ if(!S.net.autoQuality) return {stack:S.expert.stack,dfps:S.depth.fps};
  switch(Net.tier){case 'high':return{stack:8,dfps:10};case 'medium':return{stack:6,dfps:8};default:return{stack:4,dfps:6};} }
export const cloudAllowed=()=>Net.online&&Net.tier!=='low'&&S.net.cloudReport;

/* ---------- CAPTEURS ---------- */
export const Sens={mag:null,motionStill:true,hasMag:false};
export function initSensors(){ try{ if('Magnetometer' in window){
    const m=new Magnetometer({frequency:10});
    m.addEventListener('reading',()=>{ Sens.mag=Math.hypot(m.x,m.y,m.z); Sens.hasMag=true; });
    m.addEventListener('error',()=>{Sens.hasMag=false;}); m.start(); return; } }catch{}
  Sens.hasMag=false; }
export function initMotion(){ const s=[];
  addEventListener('devicemotion',e=>{ const a=e.accelerationIncludingGravity; if(!a) return;
    const m=Math.hypot(a.x||0,a.y||0,a.z||0); s.push(m); if(s.length>30)s.shift();
    const mean=s.reduce((x,y)=>x+y,0)/s.length;
    Sens.motionStill=s.reduce((x,y)=>x+(y-mean)**2,0)/s.length<0.6; }); }

/* ---------- EVP ---------- */
export class EVP{
  constructor(){this.on=false;this.ctx=null;this.rms=0;this.spec=null;this.mr=null;this.ring=[];}
  async start(){ const st=await navigator.mediaDevices.getUserMedia({audio:true});
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    const src=this.ctx.createMediaStreamSource(st);
    this.an=this.ctx.createAnalyser(); this.an.fftSize=512; src.connect(this.an);
    this.freq=new Uint8Array(this.an.frequencyBinCount); this.time=new Uint8Array(this.an.fftSize);
    this.spec=document.createElement('canvas'); this.spec.width=256; this.spec.height=64;
    this.sg=this.spec.getContext('2d');
    this.mr=new MediaRecorder(st); this.ring=[];
    this.mr.ondataavailable=e=>{ if(e.data.size){this.ring.push(e.data); if(this.ring.length>6)this.ring.shift();} };
    this.mr.start(1000); this.on=true; this._loop(); }
  stop(){ this.on=false; try{this.mr?.stop();}catch{} try{this.ctx?.close();}catch{} this.spec=null; }
  _loop(){ if(!this.on) return; requestAnimationFrame(()=>this._loop());
    this.an.getByteFrequencyData(this.freq); this.an.getByteTimeDomainData(this.time);
    let s=0; for(const v of this.time){ const d=(v-128)/128; s+=d*d; } this.rms=Math.sqrt(s/this.time.length);
    const g=this.sg; g.drawImage(this.spec,-1,0);
    for(let y=0;y<64;y++){ const v=this.freq[y*2]||0;
      g.fillStyle=`hsl(${280-v*0.6},90%,${(v/255)*60}%)`; g.fillRect(255,y,1,1); } }
  clip(){ return this.ring.length? new Blob(this.ring,{type:this.mr?.mimeType||'audio/webm'}) : null; }
}

/* ---------- ANOMALIES ---------- */
export const Anom={score:0,events:[],base:{},last:{}};
export function pushSample(k,v){ const b=Anom.base[k]??=[]; b.push(v); if(b.length>240)b.shift(); }
export function baseline(k){ const b=Anom.base[k]; if(!b||b.length<30) return null;
  const m=b.reduce((a,c)=>a+c,0)/b.length;
  return {m,sd:Math.sqrt(b.reduce((a,c)=>a+(c-m)**2,0)/b.length)||1e-6}; }
export function dev(k,v){ const b=baseline(k); if(!b) return 0; return (v-b.m)/b.sd; }
export function updateScore(parts){ const w={th:.30,mag:.20,audio:.25,motion:.15,prox:.10};
  let s=0,tot=0; for(const k in parts) if(parts[k]!=null){ s+=Math.min(1,parts[k])*w[k]; tot+=w[k]; }
  Anom.score=Anom.score*0.85+(tot?(s/tot)*100:0)*0.15; runtime.para=Anom.score; return Anom.score; }
export async function logEvent(type,severity,detail,extra={}){
  const ev={id:crypto.randomUUID(),ts:Date.now(),type,severity,detail,...extra};
  Anom.events.unshift(ev); if(Anom.events.length>300)Anom.events.pop();
  await put('events',ev).catch(()=>{}); return ev; }
export const cooled=(type,ms=20000)=>(Date.now()-(Anom.last[type]||0))>ms&&(Anom.last[type]=Date.now());
