window.__PK=window.__PK||{};window.__PK.booted=true;
function download(blob,name){const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
async function share(blob,name){const f=new File([blob],name,{type:blob.type});
 if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:'Paranormal by Kevin'});
 else download(blob,name);}
function stamp(g,w,h){g.fillStyle='rgba(10,4,20,.72)';g.fillRect(0,h-34,w,34);
 g.fillStyle='#efe9ff';g.font='13px system-ui';
 g.fillText('Paranormal by Kevin — '+new Date().toLocaleString('fr-FR')+'  PARA '+Math.round(runtime.para)+
  (runtime.temps?'  Max '+fmtT(runtime.temps.max)+' Min '+fmtT(runtime.temps.min):'')+
  (runtime.gps?'  '+runtime.gps.latitude.toFixed(4)+','+runtime.gps.longitude.toFixed(4):''),10,h-12);}
async function saveCanvas(canvas,extra){
 const blob=await new Promise(r=>canvas.toBlob(r,S.photo.format==='png'?'image/png':'image/jpeg',.95));
 const id=crypto.randomUUID();
 await put('media',{id:id,type:'photo',mime:blob.type,blob:blob,ts:Date.now(),
  meta:Object.assign({para:Math.round(runtime.para),
   temps:runtime.temps?{min:runtime.temps.mn,max:runtime.temps.mx,avg:runtime.temps.avg}:null,
   gps:runtime.gps||null,palette:S.palette},extra||{})});
 download(blob,'paranormal-'+id+'.'+(S.photo.format==='png'?'png':'jpg'));
 return id;}
function startVideo(canvas){
 const stream=canvas.captureStream(S.video.fps);
 const go=()=>{const mimes=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];
  const mime=S.video.mime!=='auto'?S.video.mime:mimes.find(m=>MediaRecorder.isTypeSupported(m));
  const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:S.video.bitrate*1e6});
  const chunks=[];mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  mr.onstop=async()=>{const blob=new Blob(chunks,{type:mime}),id=crypto.randomUUID();
   await put('media',{id:id,type:'video',mime:blob.type,blob:blob,ts:Date.now(),meta:{para:Math.round(runtime.para)}});
   download(blob,'paranormal-'+id+'.'+(mime.includes('mp4')?'mp4':'webm'));};
  mr.start(1000);return mr;};
 return S.video.mic?navigator.mediaDevices.getUserMedia({audio:true}).then(m=>{
  m.getAudioTracks().forEach(t=>stream.addTrack(t));return go();}):Promise.resolve(go());}
const listMedia=()=>all('media');
const delMedia=id=>del('media',id);
async function makeReport(){
 const T=runtime.temps;
 const data={date:new Date().toISOString(),mode:S.mode,palette:S.palette,emissivity:S.emissivity,
  para:Math.round(Anom.score),
  stats:T?{min:+T.mn.toFixed(1),max:+T.mx.toFixed(1),avg:+T.avg.toFixed(1)}:null,
  events:Anom.events.slice(0,20).map(e=>({ts:e.ts,type:e.type,severity:e.severity,detail:e.detail})),
  detections:(runtime.boxes||[]).map(b=>({label:b.label,score:+b.score.toFixed(2)})),
  gps:runtime.gps||null};
 let text;
 if(S.llm.provider!=='none'&&S.llm.key){
  if(cloudAllowed())text=await llm(data);
  else{await enqueue({id:crypto.randomUUID(),data:data,ts:Date.now()});
   text=localReport(data)+'\n[Réseau] Analyse cloud en file au retour 4G/5G/Wi‑Fi.';}
 }else text=localReport(data);
 const id=crypto.randomUUID();await put('reports',{id:id,ts:Date.now(),data:data,text:text});return{id:id,text:text};}
async function flushQueue(){const q=await all('queue');
 for(const it of q){if(!cloudAllowed())break;
  const text=await llm(it.data);await put('reports',{id:it.id,ts:Date.now(),data:it.data,text:text});
  await del('queue',it.id);}}
function localReport(d){const s=d.stats,ev=d.events||[],sev=ev.reduce((a,e)=>a+e.severity,0);
 return 'RAPPORT D\'INVESTIGATION — PARANORMAL BY KEVIN — '+new Date(d.date).toLocaleString('fr-FR')+
'\n──────────────────────────────────\nMode '+d.mode.toUpperCase()+' · PARA '+d.para+'/100'+
'\nThermique : '+(s?'Max '+s.max+'°C · Min '+s.min+'°C · Moy '+s.avg+'°C':'capteur non connecté')+
'\nÉvénements : '+ev.length+' (sévérité cumulée '+sev+')\n'+
ev.slice(0,8).map(e=>'  • '+new Date(e.ts).toLocaleTimeString('fr-FR')+' — '+e.type+' (sev '+e.severity+') : '+e.detail).join('\n')+
'\nDétections IA : '+(d.detections.length?d.detections.map(x=>x.label+' ('+((x.score*100)|0)+'%)').join(', '):'aucune')+
'\n'+(d.gps?'GPS : '+d.gps.latitude.toFixed(5)+', '+d.gps.longitude.toFixed(5):'GPS : non renseigné')+
'\n──────────────────────────────────\nINTERPRÉTATION PRUDENTE : causes naturelles fréquentes (courants d\'air, câblage, faune, RF).'+
'\nGénéré hors ligne par Paranormal by Kevin.';}
async function llm(d){
 const sys="Analyste d'investigation paranormale rigoureux et sceptique. Rapport court en français, hypothèses naturelles prioritaires.";
 if(S.llm.provider==='groq'){
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.llm.key},
   body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:sys},{role:'user',content:JSON.stringify(d)}]})});
  return (await r.json()).choices[0].message.content;}
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+S.llm.key,
  {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:sys+'\n'+JSON.stringify(d)}]}]})});
 return (await r.json()).candidates[0].content.parts[0].text;}
const $=s=>document.querySelector(s);
const cv=$('#cv'),ctx=cv.getContext('2d',{alpha:false}),rgbv=$('#rgbv');
const spec=$('#spec'),specCtx=spec.getContext('2d');
const th=new Thermal(),depth=new DepthEngine(),evp=new EVP();
let recorder=null,recT0=0,recTimer=null,tick=0,prevGray=null,lastRenderOK=0;
const rgbReady=()=>rgbv.videoWidth>0;
function banner(m){const el=$('#err');if(el){el.hidden=false;el.textContent='⚠ '+m;}}
addEventListener('error',e=>banner('Erreur JS : '+(e.message||'?')));
addEventListener('unhandledrejection',e=>banner('Promesse rejetée : '+((e.reason&&e.reason.message)||e.reason||'?')));
const boot=(n,f)=>Promise.resolve().then(f)
 .then(()=>runtime.boot.push('✅ '+n))
 .catch(e=>{const m=(e&&e.message)||String(e);runtime.boot.push('❌ '+n+' : '+m);banner('Démarrage → '+n+' : '+m);});
const MODES={cam:{rgb:1,th:0,depth:0},camth:{rgb:1,th:1,depth:0},camthlidar:{rgb:1,th:1,depth:1},
 lidar:{rgb:0,th:0,depth:1},th:{rgb:0,th:1,depth:0}};
function setMode(m){S.mode=m;const c=MODES[m];
 S.layers.rgb=!!c.rgb;S.layers.th=!!c.th;S.layers.depth=!!c.depth;
 th.setPaused(!S.layers.th);depth.setConnected(S.layers.depth);
 save();document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));}
document.querySelectorAll('#modes button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
async function startRGB(){
 const st=await navigator.mediaDevices.getUserMedia({audio:false,
  video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
 rgbv.srcObject=st;rgbv.hidden=false;await rgbv.play();runtime.rgb=rgbv;buildCamControls();}
async function buildCamControls(){const tr=rgbv.srcObject&&rgbv.srcObject.getVideoTracks?rgbv.srcObject.getVideoTracks()[0]:null;if(!tr)return;
 const cap=tr.getCapabilities?tr.getCapabilities():{};const box=$('#camCtl');box.innerHTML='';
 const mk=(l,k,mn,mx,st)=>{const el=document.createElement('label');
  el.innerHTML=l+' <output></output><input type="range" min="'+mn+'" max="'+mx+'" step="'+st+'">';
  const inp=el.querySelector('input');inp.value=S.cam[k]||mn;el.querySelector('output').textContent=inp.value;
  inp.oninput=()=>{S.cam[k]=+inp.value;el.querySelector('output').textContent=inp.value;save();
   if(tr.applyConstraints)tr.applyConstraints({advanced:[{[k]:+inp.value}]}).catch(()=>{});};
  box.appendChild(el);};
 if(cap.zoom)mk('Zoom','zoom',cap.zoom.min,cap.zoom.max,cap.zoom.step||0.1);
 if(cap.exposureCompensation)mk('Expo','exposure',cap.exposureCompensation.min,cap.exposureCompensation.max,0.1);
 if(cap.colorTemperature)mk('Kelvin','kelvinCam',cap.colorTemperature.min,cap.colorTemperature.max,100);
 if(cap.focusDistance)mk('Focus','focus',cap.focusDistance.min,cap.focusDistance.max,cap.focusDistance.step||0.01);
 if(cap.torch){const el=document.createElement('label');el.className='chk';
  el.innerHTML='<input type="checkbox"> Torche';box.appendChild(el);
  el.querySelector('input').onchange=e=>{if(tr.applyConstraints)tr.applyConstraints({advanced:[{torch:e.target.checked}]}).catch(()=>{});};}}
function fit(){const r=cv.getBoundingClientRect();if(r.width<10||r.height<10)return;
 const d=Math.min(4,devicePixelRatio||1);runtime.px=d;
 const W=Math.round(r.width*d),H=Math.round(r.height*d);
 if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}}
function selfFit(){const r=cv.getBoundingClientRect();if(r.width<10||r.height<10)return;
 const d=Math.min(4,devicePixelRatio||1),W=Math.round(r.width*d),H=Math.round(r.height*d);
 if(Math.abs(cv.width-W)>2||Math.abs(cv.height-H)>2){runtime.px=d;cv.width=W;cv.height=H;}}
addEventListener('resize',fit);
addEventListener('orientationchange',()=>setTimeout(fit,150));
if(window.visualViewport){visualViewport.addEventListener('resize',()=>setTimeout(fit,80));
 visualViewport.addEventListener('scroll',()=>setTimeout(fit,80));}
function loop(){requestAnimationFrame(loop);tick++;if(!cv.width)fit();
 if(tick%30===0)selfFit();
 const q=effQuality();
 if(S.layers.depth&&depth.connected&&rgbReady()&&tick%Math.max(2,Math.round(30/q.dfps))===0)
  depth.estimate(rgbv).then(d=>{runtime.depth=d;let n=0;for(const v of d.data)if(v<0.25)n++;
   runtime.near=n/d.data.length;}).catch(()=>{});
 if(S.ai.detect&&rgbReady()&&tick%30===0)
  detect(rgbv).then(b=>{runtime.boxes=b;presenceCheck(b);}).catch(()=>{});
 if(tick%10===0&&rgbReady()){const g=grayOf(rgbv,64,48);
  if(prevGray){let s=0;for(let i=0;i<g.length;i++)s+=Math.abs(g[i]-prevGray[i]);runtime.motion=s/g.length;}
  prevGray=g;}
 if(tick%20===0&&rgbReady())runtime.hist=histRGB(grab(rgbv,96,72).getContext('2d').getImageData(0,0,96,72));
 if(tick%6===0&&rgbReady()){const g=grayOf(rgbv,160,120);
  runtime.fx.zebra=S.expert.zebra?zebraCanvas(g,160,120):null;
  runtime.fx.peak=S.expert.peaking?peakingCanvas(g,160,120):null;}
 if(evp.on&&!spec.hidden)specCtx.drawImage(evp.spec,0,0,spec.width,spec.height);
 if(tick%15===0)sampleAnomalies();
 runtime.lastRenderErr='';
 try{renderScene(ctx,cv.width,cv.height,{
   rgb:(S.layers.rgb&&rgbReady())?rgbv:null,
   th:S.layers.th?th.frame:null,
   depth:S.layers.depth?runtime.depth:null},{live:true});
  lastRenderOK=tick;
 }catch(e){runtime.lastRenderErr='BOUCLE: '+e.message;banner('Rendu : '+e.message);}
 if(tick-lastRenderOK>180)banner('Rendu bloqué — tapez le badge SRC (diagnostic)');
 if(runtime.boxes.length&&S.layers.rgb&&rgbReady())drawBoxes();
 if(tick%30===0){
  runtime.thKind=th.running?(th.mode==='demo'?'demo':(th.mode==='usb'?'radio':(th.visual?'visuel':'palette'))):'none';
  runtime.thSrc=th.running?(th.mode==='demo'?'DÉMO':(th.mode==='usb'?(th.info||'USB'):((th.visual?'VISUEL UVC':'UVC THERMIQUE')+' '+(th.info||'')))):'—';
  $('#sSrc').textContent='SRC '+runtime.thSrc;
  if(th.visual&&!runtime._visNotified){runtime._visNotified=true;
   toast('Source UVC = caméra VISUELLE du NF-582. Thermique réel : 🔌 → choisissez une AUTRE caméra de la liste, ou 🔬 Explorateur.');}
  if(!th.visual)runtime._visNotified=false;
  $('#sPara').textContent='👁 PARA '+(runtime.para|0);
  $('#sTh').textContent=runtime.temps?'🌡 Δ'+(runtime.temps.mx-runtime.temps.mn).toFixed(1)+'°':'🌡 —';
  $('#sMag').textContent=Sens.mag?'🧲 '+Sens.mag.toFixed(0)+' µT':'🧲 n/d';}}
function drawBoxes(){const u=runtime.px||2,sx=cv.width/rgbv.videoWidth,sy=cv.height/rgbv.videoHeight;
 ctx.save();ctx.lineWidth=2*u;ctx.font='bold '+(13*u)+'px system-ui';
 for(const b of runtime.boxes){const pres=b.label==='person';
  ctx.strokeStyle=pres?'#b26bff':'#7df9ff';
  ctx.strokeRect(b.bbox[0]*sx,b.bbox[1]*sy,b.bbox[2]*sx,b.bbox[3]*sy);
  ctx.fillStyle=ctx.strokeStyle;
  ctx.fillText(pres?'PRÉSENCE ? '+((b.score*100)|0)+'%':b.label+' '+((b.score*100)|0)+'%',b.bbox[0]*sx,b.bbox[1]*sy-6*u);}
 ctx.restore();}
const baselineMean=k=>{const b=Anom.base[k];if(!b||b.length<30)return null;
 return b.reduce((a,c)=>a+c,0)/b.length;};
const sev=(z,t)=>z>t*2?3:z>t*1.4?2:1;
function presenceCheck(boxes){if(!S.anomaly.enabled)return;
 const p=boxes.find(b=>b.label==='person'&&b.score>0.6);
 if(p&&Sens.motionStill&&cooled('presence',60000))
  fire('PRÉSENCE VISUELLE',1,'Silhouette IA '+((p.score*100)|0)+'% appareil immobile — vérifier cause naturelle.');}
function sampleAnomalies(){if(!S.anomaly.enabled){updateScore({});return;}
 const T=runtime.temps;let zTh=0;
 if(T){pushSample('thmax',T.mx);pushSample('thmin',T.mn);
  const zh=dev('thmax',T.mx),zc=-dev('thmin',T.mn);zTh=Math.max(zh,zc);
  if(zh>S.anomaly.thSd&&cooled('pic'))fire('PIC THERMIQUE',sev(zh,S.anomaly.thSd),'Max '+T.mx.toFixed(1)+'°C (z='+zh.toFixed(1)+')');
  if(zc>S.anomaly.thSd&&cooled('cold'))fire('COLD SPOT',sev(zc,S.anomaly.thSd),'Min '+T.mn.toFixed(1)+'°C (z='+zc.toFixed(1)+') — courant d\'air ?');}
 let zMag=0;if(Sens.mag){pushSample('mag',Sens.mag);zMag=Math.abs(dev('mag',Sens.mag));
  if(zMag>S.anomaly.magSd&&cooled('mag'))fire('ANOMALIE MAGNÉTIQUE',sev(zMag,S.anomaly.magSd),Sens.mag.toFixed(0)+' µT (z='+zMag.toFixed(1)+')');}
 let zAud=0;if(evp.on){pushSample('audio',evp.rms*100);zAud=dev('audio',evp.rms*100);
  if(zAud>S.anomaly.audioSd&&cooled('evp'))fire('PIC EVP',sev(zAud,S.anomaly.audioSd),
   'RMS '+(evp.rms*100).toFixed(1)+' clip 6 s joint',{clip:evp.clip()});}
 let mN=0;if(S.layers.rgb&&rgbReady()){pushSample('motion',runtime.motion);
  if(Sens.motionStill&&runtime.motion>S.anomaly.motion&&cooled('motion')){
   mN=runtime.motion/S.anomaly.motion;
   fire('MOUVEMENT INEXPLIQUÉ',sev(mN,1),'Δpixels '+runtime.motion.toFixed(1)+' appareil immobile');}}
 let pN=0;if(S.layers.depth){pushSample('prox',runtime.near);
  const b=baselineMean('prox');
  if(b!=null&&runtime.near>S.anomaly.prox&&b<S.anomaly.prox/2&&cooled('prox')){
   pN=runtime.near/S.anomaly.prox;
   fire('APPROCHE (LiDAR)',2,'Fraction proche '+((runtime.near*100)|0)+'%');}}
 updateScore({th:zTh/S.anomaly.thSd,mag:zMag/S.anomaly.magSd,audio:zAud/S.anomaly.audioSd,motion:mN,prox:pN});}
async function fire(type,severity,detail,extra){
 const ev=await logEvent(type,severity,detail,Object.assign({snapshot:makeSnap()},extra||{}));
 if(S.anomaly.vibrate&&navigator.vibrate)navigator.vibrate([120,60,120]);
 runtime.flash=Date.now()+700;toast('⚠ '+type+' — '+detail);
 if(S.anomaly.autoSnap&&severity>=2){const c=document.createElement('canvas');
  c.width=cv.width;c.height=cv.height;const g=c.getContext('2d');g.drawImage(cv,0,0);
  stamp(g,c.width,c.height);saveCanvas(c,{event:type}).catch(()=>{});}
 return ev;}
function makeSnap(){try{const c=document.createElement('canvas');
  const w=320,h=Math.round(320*cv.height/cv.width);c.width=w;c.height=h;
  c.getContext('2d').drawImage(cv,0,0,w,h);return c.toDataURL('image/jpeg',0.6);}catch(e){return null;}}
let pts=new Map(),d0=0,z0=1;
cv.addEventListener('pointerdown',e=>{pts.set(e.pointerId,[e.clientX,e.clientY]);
 if(pts.size===2){const a=[...pts.values()][0],b=[...pts.values()][1];d0=Math.hypot(a[0]-b[0],a[1]-b[1]);z0=view.z;}});
cv.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;
 pts.set(e.pointerId,[e.clientX,e.clientY]);
 if(pts.size===2){const a=[...pts.values()][0],b=[...pts.values()][1];view.z=Math.min(8,Math.max(1,z0*Math.hypot(a[0]-b[0],a[1]-b[1])/d0));}
 else if(pts.size===1){view.x+=e.movementX;view.y+=e.movementY;}});
const up=e=>{pts.delete(e.pointerId);if(view.z===1){view.x=0;view.y=0;}};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('dblclick',()=>{view.z=1;view.x=0;view.y=0;});
initNet();
onNet(n=>{$('#net').textContent=n.label+(n.online?'':' — offline actif');
 if(n.online&&S.net.sync)flushQueue().catch(()=>{});
 if(n.tier==='high'&&S.net.prefetchHD&&!S.depth.hd)depth.prefetchHD();});
initSensors();initMotion();
addEventListener('deviceorientation',e=>{runtime.tilt={beta:e.beta||0,gamma:e.gamma||0};});
function bind(id,get,set){const el=$('#'+id);if(!el)return;const t=el.type;
 const paint=v=>{if(t==='checkbox')el.checked=v;else el.value=v;
  const lab=el.closest('label');const out=lab?lab.querySelector('output'):null;if(out)out.textContent=v;};
 paint(get());
 el.addEventListener('input',()=>{const v=t==='checkbox'?el.checked:(t==='number'||t==='range')?+el.value:el.value;
  set(v);save();paint(v);});}
bind('fusionMode',()=>S.fusionMode,v=>S.fusionMode=v);
bind('palette',()=>S.palette,v=>S.palette=v);
bind('unit',()=>S.unit,v=>S.unit=v);
bind('emissivity',()=>S.emissivity,v=>S.emissivity=v);
bind('agc',()=>S.agc,v=>S.agc=v);
bind('level',()=>S.level,v=>S.level=v);
bind('span',()=>S.span,v=>S.span=v);
bind('Tmin',()=>S.Tmin,v=>S.Tmin=v);bind('Tmax',()=>S.Tmax,v=>S.Tmax=v);
bind('anomalyOn',()=>S.anomaly.enabled,v=>S.anomaly.enabled=v);
bind('night',()=>S.night,v=>S.night=v);
bind('aiDetect',()=>S.ai.detect,v=>S.ai.detect=v);
bind('vibrate',()=>S.anomaly.vibrate,v=>S.anomaly.vibrate=v);
bind('autoSnap',()=>S.anomaly.autoSnap,v=>S.anomaly.autoSnap=v);
['thSd','magSd','audioSd','motion','prox'].forEach(k=>bind(k,()=>S.anomaly[k],v=>S.anomaly[k]=v));
['stack','denoise','sharpen','clahe','sat','gamma','kelvin','vignette','detailTransfer']
 .forEach(k=>bind(k,()=>S.expert[k],v=>S.expert[k]=v));
bind('wb',()=>S.expert.wb,v=>S.expert.wb=v);
['grid','zebra','peaking','horizon'].forEach(k=>bind(k,()=>S.expert[k],v=>S.expert[k]=v));
['hud','legend','hist','crosshair','hotspot','coldspot','meshOn','isoOn'].forEach(k=>bind(k,()=>S[k],v=>S[k]=v));
bind('dotStep',()=>S.dotStep,v=>S.dotStep=v);
bind('meshAlpha',()=>S.meshAlpha,v=>S.meshAlpha=v);
bind('isoAbove',()=>S.isoAbove,v=>S.isoAbove=v);
bind('isoStep',()=>S.isoStep,v=>S.isoStep=v);
bind('alignFit',()=>S.align.fit||'cover',v=>S.align.fit=v);
['ox','oy','sx','sy'].forEach(k=>bind(k,()=>S.align[k],v=>S.align[k]=v));
bind('mirror',()=>S.align.mirror,v=>S.align.mirror=v);
['autoQuality','cloudReport','prefetchHD'].forEach(k=>bind(k,()=>S.net[k],v=>S.net[k]=v));
bind('llmProvider',()=>S.llm.provider,v=>S.llm.provider=v);
bind('llmKey',()=>S.llm.key,v=>S.llm.key=v);
bind('photoFormat',()=>S.photo.format,v=>S.photo.format=v);
bind('videoFps',()=>S.video.fps,v=>S.video.fps=v);
bind('videoBitrate',()=>S.video.bitrate,v=>S.video.bitrate=v);
bind('mic',()=>S.video.mic,v=>S.video.mic=v);
bind('native',()=>S.usb.native!==false,v=>{S.usb.native=v;if(v){S.Tmin=10;S.Tmax=60;}});
['vid','pid','magic','endian','fmt'].forEach(k=>bind(k,()=>S.usb[k],v=>S.usb[k]=v));
['iface','epIn','hdr','scale','offset'].forEach(k=>bind(k,()=>S.usb[k],v=>S.usb[k]=+v));
bind('uw',()=>S.usb.w,v=>S.usb.w=v);bind('uh',()=>S.usb.h,v=>S.usb.h=v);
$('#palette').innerHTML=PALETTE_NAMES.map(p=>'<option value="'+p+'">'+p+'</option>').join('');
$('#bHD').onclick=()=>{toast('Téléchargement modèle HD…');
 depth.prefetchHD().then(()=>toast('Modèle HD caché offline.')).catch(()=>toast('Échec préfetch HD'));};
/* ---- v10 : LISTE des caméras USB dans le dialog source ---- */
function connectSource(d){
 return th.connectUVC(d&&d.deviceId?d.deviceId:undefined).then(()=>{
  if(S.mode==='cam')setMode('camth');else if(S.mode==='lidar')setMode('camthlidar');
  else{S.layers.th=true;th.setPaused(false);}
  if(S.fusionMode==='msx'){S.fusionMode='panel';save();const fm=$('#fusionMode');if(fm)fm.value='panel';}
  toast('Source connectée : '+(d&&d.label?d.label:'caméra USB')+' → regardez le libellé du panneau');});}
function fillDevList(){
 const box=$('#devList');box.innerHTML='<p style="font-size:12px;opacity:.7">Recherche des caméras…</p>';
 navigator.mediaDevices.enumerateDevices().then(ds=>{
  const vids=ds.filter(d=>d.kind==='videoinput');
  box.innerHTML='';
  if(!vids.length){box.innerHTML='<p style="font-size:12px;opacity:.7">Aucune caméra détectée (autorisez ou branchez le capteur).</p>';return;}
  vids.forEach((d,i)=>{const b=document.createElement('button');
   b.textContent='📷 '+(d.label||('Caméra USB '+(i+1)));
   b.onclick=()=>{$('#srcDlg').close();
    connectSource(d).catch(e=>{toast('Échec UVC : '+e.message);if(!th.running)th.startDemo();});};
   box.appendChild(b);});
 }).catch(()=>{box.innerHTML='<p style="font-size:12px;opacity:.7">Enumeration impossible.</p>';});}
$('#bSource').onclick=()=>{fillDevList();$('#srcDlg').showModal();};
$('#sClose').onclick=()=>$('#srcDlg').close();
$('#sProbe').onclick=async()=>{$('#srcDlg').close();
 try{toast('🔬 Exploration USB (choisissez le périphérique NOYAFA)…');
  const res=await th.probeUSB();
  if(res.found){S.layers.th=true;th.setPaused(false);
   if(S.mode==='cam')setMode('camth');
   toast('✅ Flux THERMIQUE 16 bits '+res.found.w+'×'+res.found.h+' → LIVE radiométrique');}
  else{toast('❌ Aucun flux 16 bits reconnu. Paquet '+res.report.len+' o — badge SRC → 🩺 puis envoyez‑moi le report.');}
 }catch(e){toast('🔬 Explorateur : '+e.message);if(!th.running)th.startDemo();}};
$('#sUsb').onclick=async()=>{$('#srcDlg').close();
 try{await th.connectUSB();S.layers.th=true;th.setPaused(false);toast('WebUSB OK : '+th.info);}
 catch(e){toast(e.message+' (sans capteur : 🧪 Démo)');if(!th.running)th.startDemo();}};
$('#sDemo').onclick=()=>{$('#srcDlg').close();th.startDemo();S.layers.th=true;th.setPaused(false);
 toast('Démo active (simulation)');};
$('#sStop').onclick=async()=>{await th.stop();$('#srcDlg').close();toast('Capteur déconnecté');};
$('#bPhoto').onclick=async()=>{if(runtime.processing)return;flash();
 const q=effQuality();
 if(S.layers.rgb&&rgbReady()&&q.stack>1){
  runtime.processing=true;toast('Stack '+q.stack+' frames + traitement expert…');
  try{const img=await captureStack(rgbv,q.stack);const Pp=processPhoto(img,S.expert);
   const out=document.createElement('canvas');
   out.width=Pp.width*S.photo.scale/2;out.height=Pp.height*S.photo.scale/2;
   const g=out.getContext('2d');
   renderScene(g,out.width,out.height,{rgb:Pp,th:S.layers.th?th.frame:null,
    depth:S.layers.depth?runtime.depth:null},{live:false});
   stamp(g,out.width,out.height);await saveCanvas(out,{stack:q.stack});
   toast('Photo expert enregistrée');}
  finally{runtime.processing=false;}}
 else{const out=document.createElement('canvas');out.width=cv.width;out.height=cv.height;
  const g=out.getContext('2d');g.drawImage(cv,0,0);stamp(g,out.width,out.height);
  await saveCanvas(out);toast('Photo enregistrée');}};
$('#bVideo').onclick=async()=>{if(recorder){recorder.stop();recorder=null;
  clearInterval(recTimer);$('#rec').hidden=true;return;}
 recorder=await startVideo(cv).catch(e=>{toast('Vidéo impossible : '+e.message);return null;});
 if(!recorder)return;
 recT0=Date.now();$('#rec').hidden=false;
 recTimer=setInterval(()=>{const s=(Date.now()-recT0)/1000|0;
  $('#rect').textContent=String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0');},500);
 toast('Enregistrement vidéo…');};
$('#bEvp').onclick=async()=>{if(evp.on){evp.stop();spec.hidden=true;
  $('#bEvp').classList.remove('on');$('#sEvp').textContent='🎙 off';toast('EVP stoppé');return;}
 try{await evp.start();spec.hidden=false;$('#bEvp').classList.add('on');
  $('#sEvp').textContent='🎙 EVP';toast('EVP actif : spectrogramme + pics');}
 catch(e){toast('Micro refusé : '+e.message);}};
$('#bJournal').onclick=async()=>{$('#journal').classList.add('open');
 const evs=await all('events').catch(()=>[]);
 const l=$('#jlist');l.innerHTML='';
 for(const ev of evs.sort((a,b)=>b.ts-a.ts).slice(0,80)){
  const d=document.createElement('div');d.className='jev';
  d.innerHTML=(ev.snapshot?'<img src="'+ev.snapshot+'">':'')+
   '<div class="t"><b>'+ev.type+'</b> <span class="sev">'+'★'.repeat(ev.severity)+'</span><br>'+
   new Date(ev.ts).toLocaleString('fr-FR')+' — '+ev.detail+
   (ev.clip?'<br><audio controls src="'+URL.createObjectURL(ev.clip)+'" style="height:28px"></audio>':'')+'</div>';
  l.appendChild(d);}};
$('#bJClose').onclick=()=>$('#journal').classList.remove('open');
$('#bGallery').onclick=async()=>{$('#gallery').classList.add('open');
 const items=await listMedia().catch(()=>[]);$('#ggrid').innerHTML='';
 if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(e=>{
  $('#quota').textContent='('+((e.usage/1e6)|0)+' Mo / '+((e.quota/1e6)|0)+' Mo)';}).catch(()=>{});
 for(const it of items.sort((a,b)=>b.ts-a.ts)){const url=URL.createObjectURL(it.blob);
  const w=document.createElement('div');
  w.innerHTML=it.type==='photo'?'<img src="'+url+'">':'<video src="'+url+'" muted loop playsinline></video>';
  w.onclick=e=>{if(e.detail===2){delMedia(it.id).then(()=>$('#bGallery').onclick());}
   else if(confirm('OK = partager / Annuler = télécharger'))share(it.blob,'paranormal-'+it.id);
   else download(it.blob,'paranormal-'+it.id);};
  $('#ggrid').appendChild(w);}};
$('#bGClose').onclick=()=>$('#gallery').classList.remove('open');
$('#bAI').onclick=async()=>{toast("Analyse d'investigation…");
 const r=await makeReport().catch(e=>({text:'Erreur rapport : '+e.message}));alert(r.text);};
$('#bSet').onclick=()=>$('#panel').classList.add('open');
$('#bClose').onclick=()=>$('#panel').classList.remove('open');
$('#sSrc').onclick=()=>{const cam=rgbReady()?'✅ caméra '+rgbv.videoWidth+'×'+rgbv.videoHeight:'❌ caméra inactive';
 const src='Source : '+(th.running?(th.mode==='demo'?'démo':(th.visual?'VISUEL (caméra du capteur)':th.info)):'aucune');
 const sw=('serviceWorker' in navigator&&navigator.serviceWorker.controller)?'✅ SW actif':'⚠ SW absent (rechargez)';
 const pr=runtime.probe?('🔬 Probe: paquet '+runtime.probe.len+' o, iface '+runtime.probe.iface+', ep '+runtime.probe.ep+
   (runtime.probe.le?', 16b '+runtime.probe.le.w+'×'+runtime.probe.le.h+' min '+runtime.probe.le.mn+' max '+runtime.probe.le.mx:'')+
   ', hex: '+runtime.probe.hex.slice(0,64)):'';
 $('#dlist').innerHTML=['<b>Boot :</b>']
  .concat(runtime.boot.length?runtime.boot:['(vide)'])
  .concat([cam,src,sw,'Rendu : '+(runtime.lastRenderErr||'✅ ok'),'Réseau : '+runtime.net,
   'Canvas : '+cv.width+'×'+cv.height+' (px='+(runtime.px||'?')+')',pr,
   'Erreur globale : '+($('#err').textContent||'aucune')])
  .map(x=>'<div>'+x+'</div>').join('');
 $('#diag').classList.add('open');};
$('#bDClose').onclick=()=>$('#diag').classList.remove('open');
if(navigator.geolocation)navigator.geolocation.watchPosition(p=>runtime.gps=p.coords,()=>{},{enableHighAccuracy:true});
let ip;addEventListener('beforeinstallprompt',e=>{e.preventDefault();ip=e;$('#btnInstall').hidden=false;});
$('#btnInstall').onclick=()=>{if(ip)ip.prompt();};
function flash(){const f=document.createElement('div');
 f.style.cssText='position:fixed;inset:0;background:#fff;z-index:99;opacity:.9;transition:.3s';
 document.body.appendChild(f);setTimeout(()=>f.style.opacity=0,30);setTimeout(()=>f.remove(),350);}
let tt;function toast(m){let el=$('#toast');
 if(!el){el=document.createElement('div');el.id='toast';
  el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#241238;color:#fff;padding:8px 16px;border-radius:20px;z-index:50;max-width:86vw';
  document.body.appendChild(el);}
 el.textContent=m;el.style.display='block';clearTimeout(tt);tt=setTimeout(()=>el.style.display='none',4500);}
const qp=new URLSearchParams(location.search);
if(qp.get('mode')&&MODES[qp.get('mode')])setMode(qp.get('mode'));else setMode(S.mode||'camthlidar');
if(qp.get('journal'))setTimeout(()=>$('#bJournal').onclick(),800);
if(qp.get('set'))setTimeout(()=>$('#panel').classList.add('open'),600);
if(qp.get('diag'))setTimeout(()=>$('#sSrc').onclick(),800);
fit();loop();
(async()=>{
 await boot('Service Worker',()=>('serviceWorker' in navigator)?navigator.serviceWorker.register('./sw.js').then(r=>{if(r.update)r.update().catch(()=>{});return r;}):null);
 await boot('Stockage',()=>navigator.storage&&navigator.storage.persist?navigator.storage.persist():null);
 await boot('Base locale',()=>all('events'));
 await boot('Caméra arrière',()=>startRGB().catch(e=>{if(!th.running)th.startDemo();if(S.mode==='cam')setMode('camth');throw e;}));
 await boot('Source thermique',()=>{if(!th.running)th.startDemo();});
})();
