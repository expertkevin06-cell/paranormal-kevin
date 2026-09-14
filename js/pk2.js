const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Thermal{
 constructor(){this.mode='none';this.frame=null;this.video=null;this.device=null;
  this.running=false;this.paused=false;this.info='';this.fps=0;this._n=0;this._t0=performance.now();
  this.visual=false;}
 setPaused(p){this.paused=p;}
 async stop(){this.running=false;clearInterval(this._timer);this._timer=null;
  this.video?.srcObject?.getTracks().forEach(t=>t.stop());this.video=null;
  if(this.device){try{await this.device.close();}catch{}}this.device=null;
  this.mode='none';this.frame=null;this.info='';this.visual=false;runtime.uvcVisual=false;}
 async connectUVC(deviceId){await this.stop();
  const v=document.createElement('video');v.playsInline=true;v.muted=true;v.setAttribute('playsinline','');
  const st=await navigator.mediaDevices.getUserMedia({audio:false,video:{
   deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:S.usb.w},height:{ideal:S.usb.h},frameRate:{ideal:30}}});
  v.srcObject=st;await v.play();this.video=v;this.mode='uvc';this.running=true;
  this.info='UVC '+(v.videoWidth||'?')+'×'+(v.videoHeight||'?');this._grabLoop();}
 _grabLoop(){const c=document.createElement('canvas'),g=c.getContext('2d',{willReadFrequently:true});
  const cc=document.createElement('canvas'),cg=cc.getContext('2d');
  this._timer=setInterval(()=>{if(!this.running||this.paused||!this.video?.videoWidth)return;
   const w=this.video.videoWidth,h=this.video.videoHeight;
   if(c.width!==w){c.width=w;c.height=h;cc.width=w;cc.height=h;}
   g.drawImage(this.video,0,0,w,h);
   cg.drawImage(c,0,0);
   const d=g.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);
   for(let i=0,p=0;i<gray.length;i++,p+=4)gray[i]=(d[p]*.299+d[p+1]*.587+d[p+2]*.114)|0;
   if(this._first===undefined&&this.mode==='uvc'){this._first=false;
    let sat=0,n=0;for(let i=0,p=0;i<gray.length;i+=37,p+=148){sat+=Math.abs(d[p]-d[p+1])+Math.abs(d[p+1]-d[p+2]);n++;}
    this.visual=n>0&&(sat/n)>40;runtime.uvcVisual=this.visual;}
   this._push({w,h,gray,temps:null,ts:Date.now(),ccanvas:cc});},33);}
 async connectUSB(){if(!('usb' in navigator))throw new Error('WebUSB indisponible (Chrome Android, HTTPS).');
  await this.stop();
  const vid=parseInt(S.usb.vid,16),pid=parseInt(S.usb.pid,16);
  const filters=(vid&&!isNaN(vid))?[{vendorId:vid,...(pid&&!isNaN(pid)?{productId:pid}:{})}]:[];
  const dev=await navigator.usb.requestDevice({filters});await dev.open();
  if(dev.configuration===null)await dev.selectConfiguration(1);
  await dev.claimInterface(S.usb.iface|0);
  this.device=dev;this.mode='usb';this.running=true;this._buf=new Uint8Array(0);
  this.info='USB '+dev.productName;this._pump();}
 async probeUSB(){if(!('usb' in navigator))throw new Error('WebUSB indisponible (Chrome Android, HTTPS).');
  await this.stop();
  const dev=await navigator.usb.requestDevice({filters:[]});
  await dev.open();
  if(dev.configuration===null)await dev.selectConfiguration(1);
  let ifaceNo=null,epIn=null;
  for(const itf of dev.configuration.interfaces)for(const alt of itf.alternates)for(const ep of alt.endpoints)
   if(ep.direction==='in'&&ep.type==='bulk'){ifaceNo=itf.interfaceNumber;epIn=ep.endpointNumber;}
  if(ifaceNo===null)for(const itf of dev.configuration.interfaces)for(const alt of itf.alternates)for(const ep of alt.endpoints)
   if(ep.direction==='in'&&ep.type==='interrupt'){ifaceNo=itf.interfaceNumber;epIn=ep.endpointNumber;}
  if(ifaceNo===null){try{await dev.close();}catch{}
   throw new Error("Aucun endpoint IN brut : thermique non exposé hors UVC");}
  await dev.claimInterface(ifaceNo);
  const sizes={};const samples=[];let hex='';
  for(let i=0;i<40;i++){
   const r=await dev.transferIn(epIn,65536);
   if(!r.data||!r.data.byteLength)continue;
   const b=new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength);
   sizes[b.length]=(sizes[b.length]||0)+1;
   if(samples.length<6)samples.push(b);
   if(!hex)hex=[...b.slice(0,48)].map(x=>x.toString(16).padStart(2,'0')).join(' ');}
  const top=Object.entries(sizes).sort((a,b)=>b[1]-a[1])[0];
  const len=top?+top[0]:0;
  const report={len:len,sizes:sizes,hex:hex,iface:ifaceNo,ep:epIn};
  let found=null;
  const b0=samples[0];
  if(b0)for(const wh of[[192,256],[256,192],[160,120],[120,160],[256,256],[128,128],[80,60],[60,80],[32,24],[24,32]]){
   const w=wh[0],h=wh[1];
   if(w*h*2!==len)continue;
   const dv=new DataView(b0.buffer,b0.byteOffset,len);
   let mn=1e9,mx=-1e9;
   for(let i=0;i<w*h;i++){const v=dv.getInt16(i*2,true);if(v<mn)mn=v;if(v>mx)mx=v;}
   report.le={w:w,h:h,mn:mn,mx:mx};
   if(mn>-2000&&mx<30000){found={w:w,h:h,mn:mn,mx:mx};break;}}
  runtime.probe=report;
  if(found){
   S.usb.fmt='u16temp';S.usb.w=found.w;S.usb.h=found.h;S.usb.endian='le';
   S.usb.scale=0.01;S.usb.offset=0;S.usb.hdr=0;S.usb.magic='';
   S.usb.iface=ifaceNo;S.usb.epIn=epIn;save();
   this.device=dev;this.mode='usb';this.running=true;this._buf=new Uint8Array(0);
   this.info='USB RADIOMÉTRIQUE '+found.w+'×'+found.h;
   this._pump();
  }else{try{await dev.close();}catch{}}
  return{report:report,found:found};}
 async _pump(){while(this.running){try{
   const r=await this.device.transferIn(S.usb.epIn|0,S.usb.pkt||16384);
   if(r.data?.byteLength&&!this.paused)
    this._parse(new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength));
  }catch(e){if(this.running){this.info='USB: '+e.message;await sleep(250);}}}}
 _cat(a,b){const o=new Uint8Array(a.length+b.length);o.set(a);o.set(b,a.length);return o;}
 _parse(chunk){this._buf=this._cat(this._buf,chunk);
  const U=S.usb,w=U.w||256,h=U.h||192,need=U.fmt==='u8'?w*h:w*h*2;let idx=U.hdr|0;
  if(U.magic){const m=[...U.magic.replace(/\s/g,'').matchAll(/../g)].map(x=>parseInt(x[0],16));
   outer:for(let i=0;i<=this._buf.length-m.length;i++){for(let j=0;j<m.length;j++)if(this._buf[i+j]!==m[j])continue outer;idx=i+m.length;break;}}
  if(this._buf.length<idx+need)return;
  const raw=this._buf.subarray(idx,idx+need);this._buf=this._buf.subarray(idx+need);
  if(U.fmt==='u16temp'){const n=w*h,temps=new Float32Array(n),dv=new DataView(raw.buffer,raw.byteOffset,need);
   for(let i=0;i<n;i++){const v=U.endian==='le'?dv.getInt16(i*2,true):dv.getInt16(i*2,false);
    temps[i]=v*(U.scale??0.01)+(U.offset??0);}
   this._push({w:w,h:h,temps:temps,gray:null,ts:Date.now()});}
  else if(U.fmt==='u8')this._push({w:w,h:h,gray:raw.slice(),temps:null,ts:Date.now()});
  else{const n=w*h,gray=new Uint8Array(n);for(let i=0;i<n;i++)gray[i]=raw[i*2];
   this._push({w:w,h:h,gray:gray,temps:null,ts:Date.now()});}}
 startDemo(){this.stop().then(()=>{const w=S.usb.w||256,h=S.usb.h||192;
  this.mode='demo';this.running=true;this.info='Démo simulée';let t=0;
  this._timer=setInterval(()=>{if(this.paused)return;t+=0.033;
   const temps=new Float32Array(w*h);
   const spots=[[0.3+0.15*Math.sin(t*0.7),0.4+0.1*Math.cos(t*0.5),90,0.10],[0.7,0.65,55,0.14],
    [0.5+0.2*Math.cos(t*0.3),0.25,38,0.08],[0.15+0.05*Math.sin(t*2.7),0.8,12,0.05]];
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let v=18+6*Math.sin(x*0.05+t*0.2)*Math.cos(y*0.04-t*0.15)+(Math.random()-0.5)*1.2;
    for(const sp of spots){const dx=(x/w-sp[0])/sp[3],dy=(y/h-sp[1])/sp[3];v+=sp[2]*Math.exp(-(dx*dx+dy*dy));}
    temps[y*w+x]=v;}
   this._push({w:w,h:h,temps:temps,gray:null,ts:Date.now()});},33);});}
 _push(f){this.frame=f;this._n++;const now=performance.now();
  if(now-this._t0>1000){this.fps=Math.round(this._n*1000/(now-this._t0));this._n=0;this._t0=now;}}
}
const script=u=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.onload=res;s.onerror=rej;document.head.appendChild(s);});
let detector=null;
async function detect(v){if(!detector){
  await script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
  await script('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
  detector=await cocoSsd.load({base:'mobilenet_v2'});}
 const rs=await detector.detect(v,8,0.45);
 return rs.map(r=>({label:r.class,score:r.score,bbox:r.bbox}));}
class DepthEngine{
 constructor(){this.connected=false;this.mode='none';this.pipe=null;this.loading=false;this.last=null;this.fails=0;}
 setConnected(on){this.connected=on;if(on)this.ensureAI();}
 async ensureAI(){if(this.pipe||this.loading)return this.pipe;this.loading=true;
  try{const{pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.2');
   env.allowLocalModels=false;env.useBrowserCache=true;
   this.pipe=await pipeline('depth-estimation','onnx-community/depth-anything-small',{device:'wasm'});
   this.mode='ai';}catch{this.mode='pseudo';}
  this.loading=false;return this.pipe;}
 async prefetchHD(){try{const{pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.2');
   env.allowLocalModels=false;env.useBrowserCache=true;
   this.pipe=await pipeline('depth-estimation','onnx-community/depth-anything-medium',{device:'wasm'});
   S.depth.hd=true;this.mode='ai';}catch{}}
 async estimate(video){if(!this.connected)return this.last;
  if(this.mode!=='ai')await this.ensureAI();
  if(this.pipe&&this.fails<3){try{
   const c=document.createElement('canvas');c.width=224;c.height=224;
   c.getContext('2d').drawImage(video,0,0,224,224);
   const out=await this.pipe(c.toDataURL('image/jpeg',0.7));const t=out.depth;
   const d=t.data instanceof Float32Array?t.data:Float32Array.from(t.data);
   let mn=Infinity,mx=-Infinity;for(const v of d){if(v<mn)mn=v;if(v>mx)mx=v;}
   const n=new Float32Array(d.length);for(let i=0;i<d.length;i++)n[i]=(d[i]-mn)/Math.max(1e-6,mx-mn);
   this.last={w:t.dims[1]??224,h:t.dims[0]??224,data:n};return this.last;}catch{this.fails++;}}
  const w=128,h=96,c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(video,0,0,w,h);
  const dd=g.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);
  for(let i=0,p=0;i<gray.length;i++,p+=4)gray[i]=(dd[p]*.299+dd[p+1]*.587+dd[p+2]*.114)|0;
  this.last=pseudoDepth(gray,w,h);return this.last;}
}
function pseudoDepth(gray,w,h){const n=new Float32Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;
  n[i]=Math.min(1,Math.hypot(gray[i+1]-gray[i-1],gray[i+w]-gray[i-w])/90+gray[i]/510);}
 return{w:w,h:h,data:n};}
function grab(v,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;
 c.getContext('2d').drawImage(v,0,0,w,h);return c;}
function grayOf(cvv,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(cvv,0,0,w,h);
 const d=g.getImageData(0,0,w,h).data,o=new Uint8Array(w*h);
 for(let i=0,p=0;i<o.length;i++,p+=4)o[i]=(d[p]*.299+d[p+1]*.587+d[p+2]*.114)|0;return o;}
function alignShift(a,b){const w=96,h=72;let best={x:0,y:0},bs=Infinity;
 const sad=(dx,dy)=>{let s=0;for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){
  const i=y*w+x,j=(y+dy)*w+(x+dx);if(j<0||j>=w*h)continue;s+=Math.abs(a[i]-b[j]);}return s;};
 for(let dy=-6;dy<=6;dy+=2)for(let dx=-6;dx<=6;dx+=2){const s=sad(dx,dy);if(s<bs){bs=s;best={x:dx,y:dy};}}
 for(let dy=best.y-1;dy<=best.y+1;dy++)for(let dx=best.x-1;dx<=best.x+1;dx++){
  const s=sad(dx,dy);if(s<bs){bs=s;best={x:dx,y:dy};}}
 return best;}
async function captureStack(video,n){
 const w=Math.min(video.videoWidth,1920),h=Math.min(video.videoHeight,1080);
 const frames=[],grays=[];
 for(let i=0;i<n;i++){const c=grab(video,w,h);frames.push(c);grays.push(grayOf(c,96,72));await sleep(45);}
 const shifts=frames.map((_,i)=>i?alignShift(grays[0],grays[i]):{x:0,y:0});
 const k=w/96,buf=frames.map((c,i)=>{const t=document.createElement('canvas');t.width=w;t.height=h;
  const g=t.getContext('2d');g.drawImage(c,-Math.round(shifts[i].x*k),-Math.round(shifts[i].y*k));
  return g.getImageData(0,0,w,h).data;});
 const img=new ImageData(w,h),vals=new Array(n);
 for(let p=0;p<w*h;p++)for(let ch=0;ch<3;ch++){
  for(let i=0;i<n;i++)vals[i]=buf[i][p*4+ch];
  vals.sort((a,b)=>a-b);const sk=n>=4?1:0;let s=0,c2=0;
  for(let i=sk;i<n-sk;i++){s+=vals[i];c2++;}img.data[p*4+ch]=s/c2;}
 for(let p=0;p<w*h;p++)img.data[p*4+3]=255;
 return img;}
function boxBlur(src,w,h,r){const tmp=new Float32Array(src.length),out=new Float32Array(src.length);
 for(let y=0;y<h;y++){let acc=0;const row=y*w;
  for(let x=-r;x<=r;x++)acc+=src[row+Math.min(w-1,Math.max(0,x))];
  for(let x=0;x<w;x++){out[row+x]=acc/(2*r+1);acc+=src[row+Math.min(w-1,x+r+1)]-src[row+Math.max(0,x-r)];}}
 for(let x=0;x<w;x++){let acc=0;
  for(let y=-r;y<=r;y++)acc+=out[Math.min(h-1,Math.max(0,y))*w+x];
  for(let y=0;y<h;y++){tmp[y*w+x]=acc/(2*r+1);acc+=out[Math.min(h-1,y+r+1)*w+x]-out[Math.max(0,y-r)*w+x];}}
 return tmp;}
function toneLUT(o){const lut=new Float32Array(256);
 for(let i=0;i<256;i++){let v=i/255;v=Math.pow(v,1/Math.max(0.2,o.gamma));v=(v-0.5)*o.contrast+0.5;
  v=v>0.94?0.94+(v-0.94)*0.55:v<0.06?0.06+(v-0.06)*0.7:v;lut[i]=Math.max(0,Math.min(1,v))*255;}
 return lut;}
function wbGains(img,o){if(o.wb!=='auto'){const t=o.kelvin;
  return{r:t<5500?1+(5500-t)/9000:1,b:t>5500?1+(t-5500)/9000:1};}
 let r=0,g=0,b=0,n=0;const d=img.data;
 for(let p=0;p<d.length;p+=16){r+=d[p];g+=d[p+1];b+=d[p+2];n++;}
 const mr=r/n,mg=g/n,mb=b/n;return{r:mg/Math.max(1,mr),b:mg/Math.max(1,mb)};}
function processPhoto(img,o){
 const w=img.width,h=img.height,lut=toneLUT(o),g=wbGains(img,o),d=img.data;
 const out=new ImageData(w,h),od=out.data,cx=w/2,cy=h/2,maxR=Math.hypot(cx,cy);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;
  let r=lut[Math.min(255,d[p]*g.r)]|0,gg=lut[d[p+1]]|0,b=lut[Math.min(255,d[p+2]*g.b)]|0;
  const lum=0.299*r+0.587*gg+0.114*b,mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);
  const s=o.sat+o.vibrance*(1-(mx-mn)/Math.max(1,mx));
  r=lum+(r-lum)*s;gg=lum+(gg-lum)*s;b=lum+(b-lum)*s;
  if(o.vignette>0){const f=1-o.vignette*Math.pow(Math.hypot(x-cx,y-cy)/maxR,2.2);r*=f;gg*=f;b*=f;}
  od[p]=r;od[p+1]=gg;od[p+2]=b;od[p+3]=255;}
 if(o.denoise>0){const bl=[0,1,2].map(ch=>boxBlur(Float32Array.from({length:w*h},(_,i)=>od[i*4+ch]),w,h,1));
  for(let i=0;i<w*h;i++){const p=i*4;
   od[p]=od[p]*(1-o.denoise)+bl[0][i]*o.denoise;
   od[p+1]=od[p+1]*(1-o.denoise)+bl[1][i]*o.denoise;
   od[p+2]=od[p+2]*(1-o.denoise)+bl[2][i]*o.denoise;}}
 if(o.clahe>0){const lum=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)lum[i]=0.299*od[i*4]+0.587*od[i*4+1]+0.114*od[i*4+2];
  const lb=boxBlur(lum,w,h,Math.max(8,(Math.max(w,h)/32)|0));
  for(let i=0,p=0;i<w*h;i++,p+=4){const dl=(lum[i]-lb[i])*o.clahe;od[p]+=dl;od[p+1]+=dl;od[p+2]+=dl;}}
 if(o.sharpen>0){const chs=[0,1,2].map(ch=>boxBlur(Float32Array.from({length:w*h},(_,i)=>od[i*4+ch]),w,h,2));
  for(let i=0;i<w*h;i++){const p=i*4;
   od[p]+=(od[p]-chs[0][i])*o.sharpen;od[p+1]+=(od[p+1]-chs[1][i])*o.sharpen;od[p+2]+=(od[p+2]-chs[2][i])*o.sharpen;}}
 const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(out,0,0);
 return c;}
function histRGB(img){const H={r:new Uint32Array(256),g:new Uint32Array(256),b:new Uint32Array(256),clip:0};
 const d=img.data;for(let p=0;p<d.length;p+=4){H.r[d[p]]++;H.g[d[p+1]]++;H.b[d[p+2]]++;
  if(d[p]>250&&d[p+1]>250&&d[p+2]>250)H.clip++;}
 H.total=d.length/4;return H;}
function zebraCanvas(gray,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d'),im=g.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;
  if(gray[i]>245&&((x+y)>>2)%2===0){im.data[i*4]=255;im.data[i*4+1]=255;im.data[i*4+2]=255;im.data[i*4+3]=110;}}
 g.putImageData(im,0,0);return c;}
function peakingCanvas(gray,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d'),im=g.createImageData(w,h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;
  if(Math.hypot(gray[i+1]-gray[i-1],gray[i+w]-gray[i-w])>60){im.data[i*4]=255;im.data[i*4+1]=0;im.data[i*4+2]=255;im.data[i*4+3]=160;}}
 g.putImageData(im,0,0);return c;}
const tc=document.createElement('canvas'),tg=tc.getContext('2d');
const fmtT=v=>(S.unit==='F'?v*9/5+32:v).toFixed(1)+'°'+S.unit;
const U=()=>runtime.px||2;
const cover=(W,H,sw,sh)=>{const r=Math.max(W/sw,H/sh),w=sw*r,h=sh*r;return{x:(W-w)/2,y:(H-h)/2,w:w,h:h};};
function thermalRect(f,base,A){const fit=S.align.fit||'cover';
 if(fit==='contain'){const s=Math.min(base.w/f.w,base.h/f.h),w=f.w*s,h=f.h*s;
  return{x:base.x+(base.w-w)/2+A.ox,y:base.y+(base.h-h)/2+A.oy,w:w*A.sx,h:h*A.sy};}
 if(fit==='stretch')return{x:base.x+A.ox,y:base.y+A.oy,w:base.w*A.sx,h:base.h*A.sy};
 const s=Math.max(base.w/f.w,base.h/f.h),w=f.w*s,h=f.h*s;
 return{x:base.x+(base.w-w)/2+A.ox,y:base.y+(base.h-h)/2+A.oy,w:w*A.sx,h:h*A.sy};}
function thermalImageData(f,rgbSrc,msx){
 const w=f.w,h=f.h;if(tc.width!==w){tc.width=w;tc.height=h;}
 if(f.ccanvas&&S.usb.native!==false&&!f.temps){tg.drawImage(f.ccanvas,0,0);
  const gd=tg.getImageData(0,0,w,h).data,temps=new Float32Array(w*h);
  for(let i=0,p=0;i<temps.length;i++,p+=4)
   temps[i]=S.Tmin+((gd[p]*.299+gd[p+1]*.587+gd[p+2]*.114)/255)*(S.Tmax-S.Tmin);
  let mn,mx;
  if(S.agc==='auto'){mn=Infinity;mx=-Infinity;for(const v of temps){if(v<mn)mn=v;if(v>mx)mx=v;}}
  else{mn=S.level-S.span/2;mx=S.level+S.span/2;}
  runtime.temps={data:temps,w:w,h:h,mn:mn,mx:mx,avg:temps.reduce((a,b)=>a+b,0)/temps.length,radiometric:false};
  return{mn:mn,mx:mx};}
 const img=tg.createImageData(w,h),lut=LUTS[S.palette];
 let temps=f.temps,mn=S.Tmin,mx=S.Tmax;
 if(!temps){temps=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)temps[i]=S.Tmin+(f.gray[i]/255)*(S.Tmax-S.Tmin);}
 if(S.agc==='auto'){mn=Infinity;mx=-Infinity;for(const v of temps){if(v<mn)mn=v;if(v>mx)mx=v;}}
 else{mn=S.level-S.span/2;mx=S.level+S.span/2;}
 runtime.temps={data:temps,w:w,h:h,mn:mn,mx:mx,avg:temps.reduce((a,b)=>a+b,0)/temps.length,radiometric:!!f.temps};
 let hp=null;
 if(msx>0&&rgbSrc){const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(rgbSrc,0,0,w,h);
  const d=g.getImageData(0,0,w,h).data,gr=new Float32Array(w*h);
  for(let i=0,p=0;i<gr.length;i++,p+=4)gr[i]=d[p]*.299+d[p+1]*.587+d[p+2]*.114;
  hp=new Float32Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;
   hp[i]=(gr[i]-(gr[i-1]+gr[i+1]+gr[i-w]+gr[i+w]+gr[i])*0.2)/255;}}
 const d=img.data,span=Math.max(1e-6,mx-mn);
 for(let i=0;i<w*h;i++){let t=(temps[i]-mn)/span;t=t<0?0:t>1?1:t;const k=(t*255)|0;
  const fc=hp?1+hp[i]*msx*3:1;
  d[i*4]=lut[k*3]*fc;d[i*4+1]=lut[k*3+1]*fc;d[i*4+2]=lut[k*3+2]*fc;d[i*4+3]=255;}
 tg.putImageData(img,0,0);return{mn:mn,mx:mx};}
function drawPanel(ctx,W,H,f){const u=U();
 const ar=f.h/f.w;let pw=W*0.62,ph=pw*ar;
 if(ph>H*0.5){ph=H*0.5;pw=ph/ar;}
 const px=W-pw-10*u,py=H-ph-10*u;
 ctx.save();
 ctx.drawImage(tc,px,py,pw,ph);
 const src=runtime.thSrc||'—';
 const visu=src.indexOf('VISUEL')===0,demo=src.indexOf('DÉMO')===0;
 ctx.strokeStyle=demo?'#ffb020':visu?'#38b6ff':'#22c55e';
 ctx.lineWidth=2*u;ctx.strokeRect(px,py,pw,ph);
 ctx.font='bold '+(11*u)+'px system-ui';ctx.fillStyle=ctx.strokeStyle;
 ctx.fillText(demo?'SIMULATION (sans capteur)':visu?'NF-582 VISUEL — thermique via 🔬':('NF-582 LIVE '+src.replace('UVC ','')),px,py-6*u);
 const T=runtime.temps;
 if(T){ctx.fillStyle='#fff';ctx.font=(10*u)+'px system-ui';
  const est=T.radiometric?'':' est.';
  ctx.fillText('Max '+fmtT(T.mx)+est+' · Min '+fmtT(T.mn)+est,px,py+ph+12*u);
  const ct=T.data[((T.h/2|0)*T.w)+(T.w/2|0)];
  ctx.strokeStyle='#00ffe0';ctx.lineWidth=u;ctx.beginPath();
  ctx.moveTo(px+pw/2-6*u,py+ph/2);ctx.lineTo(px+pw/2+6*u,py+ph/2);
  ctx.moveTo(px+pw/2,py+ph/2-6*u);ctx.lineTo(px+pw/2,py+ph/2+6*u);ctx.stroke();
  ctx.fillStyle='#00ffe0';ctx.fillText(fmtT(ct)+est,px+pw/2+8*u,py+ph/2+4*u);
  let hi=0,lo=0;for(let i=0;i<T.data.length;i++){if(T.data[i]>T.data[hi])hi=i;if(T.data[i]<T.data[lo])lo=i;}
  const hx=px+((hi%T.w)/T.w)*pw,hy=py+((hi/T.w|0)/T.h)*ph;
  const lx=px+((lo%T.w)/T.w)*pw,ly=py+((lo/T.w|0)/T.h)*ph;
  ctx.strokeStyle='#ff3b30';ctx.lineWidth=1.5*u;ctx.strokeRect(hx-5*u,hy-5*u,10*u,10*u);
  ctx.strokeStyle='#7df9ff';ctx.strokeRect(lx-5*u,ly-5*u,10*u,10*u);}
 ctx.restore();}
function lidarMesh(ctx,r,depth){const st=Math.max(4,S.dotStep|0),u=U();
 ctx.save();ctx.lineWidth=Math.max(1,u*0.5);ctx.globalAlpha=S.meshAlpha;
 for(let y=0;y<depth.h-st;y+=st)for(let x=0;x<depth.w-st;x+=st){
  const nz=1-depth.data[y*depth.w+x],px=r.x+(x/depth.w)*r.w,py=r.y+(y/depth.h)*r.h;
  ctx.strokeStyle='rgba(178,107,255,'+(0.25+nz*0.5)+')';
  ctx.beginPath();ctx.arc(px,py,(S.pointSize+nz*2)*u*0.6,0,7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(r.x+((x+st)/depth.w)*r.w,py);ctx.stroke();
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,r.y+((y+st)/depth.h)*r.h);ctx.stroke();}
 ctx.restore();}
function isoContours(ctx,f,r){const T=runtime.temps;if(!T)return;
 ctx.save();ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=Math.max(1,U()*0.5);
 for(let t=Math.ceil(T.mn/S.isoStep)*S.isoStep;t<T.mx;t+=S.isoStep){ctx.beginPath();
  for(let y=0;y<f.h-1;y++)for(let x=0;x<f.w-1;x++){
   const a=T.data[y*f.w+x],b=T.data[y*f.w+x+1],c=T.data[(y+1)*f.w+x];
   if((a<t)!==(b<t)){const px=r.x+((x+.5)/f.w)*r.w,py=r.y+(y/f.h)*r.h;ctx.moveTo(px,py);ctx.lineTo(px+1.5,py);}
   if((a<t)!==(c<t)){const px=r.x+(x/f.w)*r.w,py=r.y+((y+.5)/f.h)*r.h;ctx.moveTo(px,py);ctx.lineTo(px,py+1.5);}}
  ctx.stroke();}
 ctx.restore();}
function isoAlarm(ctx,f,r){const T=runtime.temps;if(!T)return;
 ctx.save();ctx.fillStyle='rgba(255,40,40,.35)';
 for(let y=0;y<f.h;y+=2)for(let x=0;x<f.w;x+=2)if(T.data[y*f.w+x]>S.isoAbove)
  ctx.fillRect(r.x+(x/f.w)*r.w,r.y+(y/f.h)*r.h,r.w/f.w*2,r.h/f.h*2);
 ctx.restore();}
function spots(ctx,f,r){const T=runtime.temps;if(!T)return;const u=U();
 let hi=0,lo=0;for(let i=0;i<T.data.length;i++){if(T.data[i]>T.data[hi])hi=i;if(T.data[i]<T.data[lo])lo=i;}
 const px=i=>r.x+((i%f.w)/f.w)*r.w,py=i=>r.y+((i/f.w|0)/f.h)*r.h;
 ctx.save();ctx.scale(1/view.z,1/view.z);ctx.font='bold '+(13*u)+'px system-ui';
 const mark=(i,col)=>{const x=px(i)*view.z,y=py(i)*view.z;
  ctx.strokeStyle=col;ctx.lineWidth=2*u;ctx.strokeRect(x-9*u,y-9*u,18*u,18*u);
  ctx.fillStyle=col;ctx.fillText(fmtT(T.data[i]),x+12*u,y-10*u);};
 if(S.hotspot)mark(hi,'#ff3b30');if(S.coldspot)mark(lo,'#7df9ff');
 if(S.crosshair){const cx=(r.x+r.w/2)*view.z,cy=(r.y+r.h/2)*view.z;
  ctx.strokeStyle='#b26bff';ctx.lineWidth=1.5*u;ctx.beginPath();
  ctx.moveTo(cx-16*u,cy);ctx.lineTo(cx+16*u,cy);ctx.moveTo(cx,cy-16*u);ctx.lineTo(cx,cy+16*u);ctx.stroke();
  ctx.fillStyle='#b26bff';ctx.fillText(fmtT(T.data[((T.h/2|0)*T.w)+(T.w/2|0)]),cx+18*u,cy+4*u);}
 ctx.restore();}
function drawHist(ctx,x,y,w,h){const H=runtime.hist;if(!H)return;const u=U();
 ctx.save();ctx.fillStyle='rgba(10,4,20,.6)';ctx.fillRect(x,y,w,h);ctx.lineWidth=Math.max(1,u*0.5);
 const max=Math.max(...H.r,...H.g,...H.b)||1;
 const line=(a,c)=>{ctx.strokeStyle=c;ctx.beginPath();
  for(let i=0;i<256;i++){const px=x+(i/255)*w,py=y+h-(a[i]/max)*(h-4)-2;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
  ctx.stroke();};
 line(H.r,'#f55');line(H.g,'#5f5');line(H.b,'#55f');ctx.restore();}
function grid(ctx,W,H){ctx.save();ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=Math.max(1,U()*0.5);
 for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(W*i/3,0);ctx.lineTo(W*i/3,H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,H*i/3);ctx.lineTo(W,H*i/3);ctx.stroke();}ctx.restore();}
function horizon(ctx,W,H){const u=U(),t=runtime.tilt,roll=(t.gamma||0)*Math.PI/180;
 ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-roll);
 ctx.strokeStyle='rgba(178,107,255,.55)';ctx.lineWidth=u;
 ctx.beginPath();ctx.moveTo(-W,0);ctx.lineTo(W,0);ctx.stroke();
 ctx.beginPath();ctx.arc(0,Math.max(-40,Math.min(40,(t.beta||0)-45))*1.5*u,6*u,0,7);ctx.stroke();ctx.restore();}
function paraGauge(ctx,W,H){const u=U(),x=W-58*u,y=64*u,r=34*u,sc=runtime.para||0;
 ctx.save();ctx.lineWidth=7*u;ctx.strokeStyle='rgba(255,255,255,.12)';
 ctx.beginPath();ctx.arc(x,y,r,Math.PI*0.75,Math.PI*2.25);ctx.stroke();
 const col=sc>70?'#ff3b30':sc>40?'#ffb020':'#7df9ff';
 ctx.strokeStyle=col;ctx.beginPath();ctx.arc(x,y,r,Math.PI*0.75,Math.PI*0.75+(sc/100)*Math.PI*1.5);ctx.stroke();
 ctx.fillStyle=col;ctx.font='bold '+(16*u)+'px system-ui';ctx.textAlign='center';
 ctx.fillText(sc|0,x,y+5*u);ctx.font=(9*u)+'px system-ui';ctx.fillText('PARA',x,y+18*u);ctx.restore();}
function flashOverlay(ctx,W,H){if(Date.now()<runtime.flash){
  const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.7);
  g.addColorStop(0,'rgba(255,0,0,0)');g.addColorStop(1,'rgba(255,0,0,.45)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}}
function demoWatermark(ctx,W,H){const u=U();
 if((runtime.thSrc||'').indexOf('DÉMO')===0&&S.fusionMode!=='panel'){ctx.save();
  ctx.font='bold '+(13*u)+'px system-ui';ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.75)';
  ctx.fillText('SIMULATION — aucun capteur connecté (🔌 → UVC/🔬)',W/2,H-14*u);ctx.restore();}}
function noSource(ctx,W,H){const u=U();ctx.save();ctx.textAlign='center';
 ctx.fillStyle='rgba(255,255,255,.8)';ctx.font='bold '+(15*u)+'px system-ui';
 ctx.fillText('Aucune source active',W/2,H/2-10*u);
 ctx.font=(12*u)+'px system-ui';
 ctx.fillText('🔌 → UVC / 🔬 Explorateur / 🧪 Démo',W/2,H/2+12*u);ctx.restore();}
function depthView(ctx,W,H,depth){const r=cover(W,H,depth.w,depth.h),lut=LUTS.ghost;
 const img=ctx.createImageData(depth.w,depth.h),c=document.createElement('canvas');
 c.width=depth.w;c.height=depth.h;
 for(let i=0;i<depth.data.length;i++){const k=((1-depth.data[i])*255)|0;
  img.data[i*4]=lut[k*3];img.data[i*4+1]=lut[k*3+1];img.data[i*4+2]=lut[k*3+2];img.data[i*4+3]=255;}
 c.getContext('2d').putImageData(img,0,0);ctx.drawImage(c,r.x,r.y,r.w,r.h);}
function hud(ctx,W,H,span){const u=U();ctx.save();
 ctx.font=(12*u)+'px system-ui';ctx.fillStyle='rgba(10,4,20,.68)';ctx.fillRect(8*u,8*u,268*u,86*u);
 ctx.fillStyle='#efe9ff';const T=runtime.temps;
 ctx.fillText('MODE '+S.mode.toUpperCase()+' · SRC '+(runtime.thSrc||'—')+' · '+runtime.net,16*u,26*u);
 if(T)ctx.fillText('Max '+fmtT(T.mx)+'  Min '+fmtT(T.mn)+'  Moy '+fmtT(T.avg),16*u,44*u);
 ctx.fillText('Émiss '+S.emissivity+'  Palette '+S.palette+'  ×'+view.z.toFixed(1),16*u,62*u);
 ctx.fillText(new Date().toLocaleString('fr-FR'),16*u,80*u);ctx.restore();
 if(S.hist)drawHist(ctx,70*u,H-96*u,150*u,72*u);
 if(S.legend&&span&&S.fusionMode!=='panel'){const lut=LUTS[S.palette],x=W-34*u,y0=120*u,hh=H-260*u;
  for(let i=0;i<hh;i++){const k=255-((i/hh)*255|0);
   ctx.fillStyle='rgb('+lut[k*3]+','+lut[k*3+1]+','+lut[k*3+2]+')';ctx.fillRect(x,y0+i,18*u,1);}
  ctx.fillStyle='#fff';ctx.font=(11*u)+'px system-ui';
  for(let i=0;i<=4;i++)ctx.fillText(fmtT(span.mx-(span.mx-span.mn)*i/4),x-52*u,y0+hh*i/4+4*u);}}
function renderScene(ctx,W,H,L,o){
 o=o||{};
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(W/2,H/2);ctx.scale(view.z,view.z);ctx.translate(-W/2+view.x,-H/2+view.y);
 const hasRGB=!!L.rgb&&(L.rgb.videoWidth||L.rgb.width||0)>0&&(L.rgb.readyState===undefined||L.rgb.readyState>=2);
 const hasTH=!!L.th,hasD=!!L.depth,A=S.align;let span=null,tr=null;
 const rgbBase=hasRGB?cover(W,H,L.rgb.videoWidth||L.rgb.width,L.rgb.videoHeight||L.rgb.height):null;
 if(hasRGB){try{ctx.save();
   if(S.night)ctx.filter='brightness(2.1) contrast(1.15) saturate(1.1)';
   ctx.drawImage(L.rgb,rgbBase.x,rgbBase.y,rgbBase.w,rgbBase.h);ctx.restore();}
  catch(e){runtime.lastRenderErr='RGB: '+e.message;}}
 if(hasTH){
  const msx=(S.fusionMode==='msx'&&hasRGB)?S.expert.detailTransfer:0;
  span=thermalImageData(L.th,hasRGB?L.rgb:null,msx);
  const panelMode=hasRGB&&S.fusionMode==='panel';
  if(!panelMode){
   tr=thermalRect(L.th,rgbBase||{x:0,y:0,w:W,h:H},A);
   const drawT=(al,clip)=>{ctx.save();if(clip)clip();ctx.globalAlpha=al;
    if(A.mirror){ctx.translate(tr.x+tr.w,tr.y);ctx.scale(-1,1);ctx.drawImage(tc,0,0,tr.w,tr.h);}
    else ctx.drawImage(tc,tr.x,tr.y,tr.w,tr.h);ctx.restore();};
   if(!hasRGB)drawT(1);
   else switch(S.fusionMode){
    case 'pip':drawT(1,()=>{const s=Math.min(W,H)*0.3;ctx.rect(W-s-24*U(),H-s-120*U(),s,s);});break;
    case 'blend':drawT(0.55);break;
    case 'splith':drawT(1,()=>ctx.rect(0,0,W,H/2));break;
    case 'splitv':drawT(1,()=>ctx.rect(0,0,W/2,H));break;
    case 'msx':drawT(0.85);break;
    case 'contour':drawT(1);isoContours(ctx,L.th,tr);break;
    case 'outline':drawT(0.8);break;}
   if(S.isoOn)isoAlarm(ctx,L.th,tr);
   spots(ctx,L.th,tr);}
 }
 else if(!hasRGB&&hasD){try{depthView(ctx,W,H,L.depth);}catch(e){runtime.lastRenderErr='DEPTH: '+e.message;}}
 if(hasD&&S.meshOn){try{lidarMesh(ctx,rgbBase||tr||cover(W,H,L.depth.w,L.depth.h),L.depth);}catch(e){}}
 if(o.live){if(runtime.fx.zebra&&hasRGB){ctx.globalCompositeOperation='screen';
   ctx.drawImage(runtime.fx.zebra,0,0,W,H);ctx.globalCompositeOperation='source-over';}
  if(runtime.fx.peak&&hasRGB){ctx.globalCompositeOperation='lighten';
   ctx.drawImage(runtime.fx.peak,0,0,W,H);ctx.globalCompositeOperation='source-over';}}
 ctx.restore();
 if(hasTH&&hasRGB&&S.fusionMode==='panel')drawPanel(ctx,W,H,L.th);
 if(!hasRGB&&!hasTH&&!hasD)noSource(ctx,W,H);
 try{if(o.live&&S.expert.grid)grid(ctx,W,H);
  if(o.live&&S.expert.horizon)horizon(ctx,W,H);
  if(S.hud)hud(ctx,W,H,span);
  if(o.live){paraGauge(ctx,W,H);flashOverlay(ctx,W,H);demoWatermark(ctx,W,H);}}
 catch(e){runtime.lastRenderErr='HUD: '+e.message;}}
window.__PK2=true;
