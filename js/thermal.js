import { S } from './core.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export class Thermal{
  constructor(){this.mode='none';this.frame=null;this.video=null;this.device=null;
    this.running=false;this.paused=false;this.info='';this.fps=0;this._n=0;this._t0=performance.now();}
  setPaused(p){this.paused=p;}
  async stop(){this.running=false;clearInterval(this._timer);this._timer=null;
    this.video?.srcObject?.getTracks().forEach(t=>t.stop());this.video=null;
    if(this.device){try{await this.device.close();}catch{}} this.device=null;
    this.mode='none';this.frame=null;this.info='';}
  async connectUVC(deviceId){ await this.stop();
    const v=document.createElement('video'); v.playsInline=true; v.muted=true; v.setAttribute('playsinline','');
    const st=await navigator.mediaDevices.getUserMedia({audio:false,video:{
      deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:S.usb.w},height:{ideal:S.usb.h},frameRate:{ideal:30}}});
    v.srcObject=st; await v.play(); this.video=v; this.mode='uvc'; this.running=true;
    this.info='UVC '+(v.videoWidth||'?')+'×'+(v.videoHeight||'?'); this._grabLoop(); }
  _grabLoop(){ const c=document.createElement('canvas'), g=c.getContext('2d',{willReadFrequently:true});
    const cc=document.createElement('canvas'), cg=cc.getContext('2d');
    this._timer=setInterval(()=>{ if(!this.running||this.paused||!this.video?.videoWidth) return;
      const w=this.video.videoWidth, h=this.video.videoHeight;
      if(c.width!==w){c.width=w;c.height=h;cc.width=w;cc.height=h;}
      g.drawImage(this.video,0,0,w,h);
      const d=g.getImageData(0,0,w,h).data, gray=new Uint8Array(w*h);
      for(let i=0,p=0;i<gray.length;i++,p+=4) gray[i]=(d[p]*.299+d[p+1]*.587+d[p+2]*.114)|0;
      let col=null; if(S.usb.colorUVC){ cg.drawImage(c,0,0); col=cc; }
      this._push({w,h,gray,temps:null,ts:Date.now(),color:!!S.usb.colorUVC,ccanvas:col}); },33); }
  async connectUSB(){ if(!('usb' in navigator)) throw new Error('WebUSB indisponible (Chrome Android, HTTPS).');
    await this.stop();
    const vid=parseInt(S.usb.vid,16), pid=parseInt(S.usb.pid,16);
    const filters=(vid&&!isNaN(vid))?[{vendorId:vid,...(pid&&!isNaN(pid)?{productId:pid}:{})}]:[];
    const dev=await navigator.usb.requestDevice({filters}); await dev.open();
    if(dev.configuration===null) await dev.selectConfiguration(1);
    await dev.claimInterface(S.usb.iface|0);
    this.device=dev; this.mode='usb'; this.running=true; this._buf=new Uint8Array(0);
    this.info='USB '+dev.productName; this._pump(); }
  async _pump(){ while(this.running){ try{
      const r=await this.device.transferIn(S.usb.epIn|0,S.usb.pkt||16384);
      if(r.data?.byteLength&&!this.paused)
        this._parse(new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength));
    }catch(e){ if(this.running){this.info='USB: '+e.message; await sleep(250);} } } }
  _cat(a,b){ const o=new Uint8Array(a.length+b.length); o.set(a); o.set(b,a.length); return o; }
  _parse(chunk){ this._buf=this._cat(this._buf,chunk);
    const U=S.usb,w=U.w||256,h=U.h||192,need=U.fmt==='u8'?w*h:w*h*2; let idx=U.hdr|0;
    if(U.magic){ const m=[...U.magic.replace(/\s/g,'').matchAll(/../g)].map(x=>parseInt(x[0],16));
      outer: for(let i=0;i<=this._buf.length-m.length;i++){ for(let j=0;j<m.length;j++) if(this._buf[i+j]!==m[j]) continue outer; idx=i+m.length; break; } }
    if(this._buf.length<idx+need) return;
    const raw=this._buf.subarray(idx,idx+need); this._buf=this._buf.subarray(idx+need);
    if(U.fmt==='u16temp'){ const n=w*h,temps=new Float32Array(n),dv=new DataView(raw.buffer,raw.byteOffset,need);
      for(let i=0;i<n;i++){ const v=U.endian==='le'?dv.getInt16(i*2,true):dv.getInt16(i*2,false);
        temps[i]=v*(U.scale??0.01)+(U.offset??0); }
      this._push({w,h,temps,gray:null,ts:Date.now()}); }
    else if(U.fmt==='u8') this._push({w,h,gray:raw.slice(),temps:null,ts:Date.now()});
    else{ const n=w*h,gray=new Uint8Array(n); for(let i=0;i<n;i++) gray[i]=raw[i*2];
      this._push({w,h,gray,temps:null,ts:Date.now()}); } }
  startDemo(){ this.stop().then(()=>{ const w=S.usb.w||256,h=S.usb.h||192;
    this.mode='demo'; this.running=true; this.info='Démo simulée'; let t=0;
    this._timer=setInterval(()=>{ if(this.paused) return; t+=0.033;
      const temps=new Float32Array(w*h);
      const spots=[[0.3+0.15*Math.sin(t*0.7),0.4+0.1*Math.cos(t*0.5),90,0.10],[0.7,0.65,55,0.14],
                   [0.5+0.2*Math.cos(t*0.3),0.25,38,0.08],[0.15+0.05*Math.sin(t*2.7),0.8,12,0.05]];
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        let v=18+6*Math.sin(x*0.05+t*0.2)*Math.cos(y*0.04-t*0.15)+(Math.random()-0.5)*1.2;
        for(const [sx,sy,amp,r] of spots){ const dx=(x/w-sx)/r,dy=(y/h-sy)/r; v+=amp*Math.exp(-(dx*dx+dy*dy)); }
        temps[y*w+x]=v; }
      this._push({w,h,temps,gray:null,ts:Date.now()}); },33); }); }
  _push(f){ this.frame=f; this._n++; const now=performance.now();
    if(now-this._t0>1000){ this.fps=Math.round(this._n*1000/(now-this._t0)); this._n=0; this._t0=now; } }
}
