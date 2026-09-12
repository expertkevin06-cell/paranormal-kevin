import { S } from './core.js';
const script=u=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=u; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
let detector=null;
export async function detect(v){ if(!detector){
    await script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await script('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    detector=await cocoSsd.load({base:'mobilenet_v2'}); }
  const rs=await detector.detect(v,8,0.45);
  return rs.map(r=>({label:r.class,score:r.score,bbox:r.bbox})); }
export class DepthEngine{
  constructor(){this.connected=false;this.mode='none';this.pipe=null;this.loading=false;this.last=null;this.fails=0;}
  setConnected(on){this.connected=on; if(on) this.ensureAI();}
  async ensureAI(){ if(this.pipe||this.loading) return this.pipe; this.loading=true;
    try{ const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.2');
      env.allowLocalModels=false; env.useBrowserCache=true;
      this.pipe=await pipeline('depth-estimation','onnx-community/depth-anything-small',{device:'wasm'});
      this.mode='ai'; }catch{ this.mode='pseudo'; }
    this.loading=false; return this.pipe; }
  async prefetchHD(){ try{ const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.2');
      env.allowLocalModels=false; env.useBrowserCache=true;
      this.pipe=await pipeline('depth-estimation','onnx-community/depth-anything-medium',{device:'wasm'});
      S.depth.hd=true; this.mode='ai'; }catch{} }
  async estimate(video){ if(!this.connected) return this.last;
    if(this.mode!=='ai') await this.ensureAI();
    if(this.pipe&&this.fails<3){ try{
        const c=document.createElement('canvas'); c.width=224; c.height=224;
        c.getContext('2d').drawImage(video,0,0,224,224);
        const out=await this.pipe(c.toDataURL('image/jpeg',0.7)); const t=out.depth;
        const d=t.data instanceof Float32Array? t.data : Float32Array.from(t.data);
        let mn=Infinity,mx=-Infinity; for(const v of d){if(v<mn)mn=v; if(v>mx)mx=v;}
        const n=new Float32Array(d.length); for(let i=0;i<d.length;i++) n[i]=(d[i]-mn)/Math.max(1e-6,mx-mn);
        this.last={w:t.dims[1]??224,h:t.dims[0]??224,data:n}; return this.last; }catch{ this.fails++; } }
    const w=128,h=96,c=document.createElement('canvas'); c.width=w;c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(video,0,0,w,h);
    const dd=g.getImageData(0,0,w,h).data, gray=new Uint8Array(w*h);
    for(let i=0,p=0;i<gray.length;i++,p+=4) gray[i]=(dd[p]*.299+dd[p+1]*.587+dd[p+2]*.114)|0;
    this.last=pseudoDepth(gray,w,h); return this.last; }
}
export function pseudoDepth(gray,w,h){ const n=new Float32Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){ const i=y*w+x;
    n[i]=Math.min(1,Math.hypot(gray[i+1]-gray[i-1],gray[i+w]-gray[i-w])/90+gray[i]/510); }
  return {w,h,data:n}; }
