import { S, view, runtime, LUTS } from './core.js';
const tc=document.createElement('canvas'), tg=tc.getContext('2d');
export const fmtT=v=>(S.unit==='F'?v*9/5+32:v).toFixed(1)+'°'+S.unit;
const U=()=>runtime.px||2;
const cover=(W,H,sw,sh)=>{ const r=Math.max(W/sw,H/sh),w=sw*r,h=sh*r; return {x:(W-w)/2,y:(H-h)/2,w,h}; };
function thermalRect(f,base,A){ const fit=S.align.fit||'cover';
  if(fit==='contain'){ const s=Math.min(base.w/f.w,base.h/f.h),w=f.w*s,h=f.h*s;
    return {x:base.x+(base.w-w)/2+A.ox,y:base.y+(base.h-h)/2+A.oy,w:w*A.sx,h:h*A.sy}; }
  if(fit==='stretch') return {x:base.x+A.ox,y:base.y+A.oy,w:base.w*A.sx,h:base.h*A.sy};
  const s=Math.max(base.w/f.w,base.h/f.h),w=f.w*s,h=f.h*s;
  return {x:base.x+(base.w-w)/2+A.ox,y:base.y+(base.h-h)/2+A.oy,w:w*A.sx,h:h*A.sy}; }
export function thermalImageData(f,rgbSrc,msx){
  const {w,h}=f; if(tc.width!==w){tc.width=w;tc.height=h;}
  if(f.color&&f.ccanvas){ tg.drawImage(f.ccanvas,0,0);
    const gd=tg.getImageData(0,0,w,h).data,temps=new Float32Array(w*h);
    for(let i=0,p=0;i<temps.length;i++,p+=4)
      temps[i]=S.Tmin+((gd[p]*.299+gd[p+1]*.587+gd[p+2]*.114)/255)*(S.Tmax-S.Tmin);
    let mn,mx;
    if(S.agc==='auto'){mn=Infinity;mx=-Infinity;for(const v of temps){if(v<mn)mn=v;if(v>mx)mx=v;}}
    else{mn=S.level-S.span/2;mx=S.level+S.span/2;}
    runtime.temps={data:temps,w,h,mn,mx,avg:temps.reduce((a,b)=>a+b,0)/temps.length};
    return {mn,mx}; }
  const img=tg.createImageData(w,h),lut=LUTS[S.palette];
  let temps=f.temps,mn=S.Tmin,mx=S.Tmax;
  if(!temps){ temps=new Float32Array(w*h);
    for(let i=0;i<w*h;i++) temps[i]=S.Tmin+(f.gray[i]/255)*(S.Tmax-S.Tmin); }
  if(S.agc==='auto'){mn=Infinity;mx=-Infinity;for(const v of temps){if(v<mn)mn=v;if(v>mx)mx=v;}}
  else{mn=S.level-S.span/2;mx=S.level+S.span/2;}
  runtime.temps={data:temps,w,h,mn,mx,avg:temps.reduce((a,b)=>a+b,0)/temps.length};
  let hp=null;
  if(msx>0&&rgbSrc){ const c=document.createElement('canvas'); c.width=w;c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(rgbSrc,0,0,w,h);
    const d=g.getImageData(0,0,w,h).data,gr=new Float32Array(w*h);
    for(let i=0,p=0;i<gr.length;i++,p+=4) gr[i]=d[p]*.299+d[p+1]*.587+d[p+2]*.114;
    hp=new Float32Array(w*h);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){ const i=y*w+x;
      hp[i]=(gr[i]-(gr[i-1]+gr[i+1]+gr[i-w]+gr[i+w]+gr[i])*0.2)/255; } }
  const d=img.data,span=Math.max(1e-6,mx-mn);
  for(let i=0;i<w*h;i++){ let t=(temps[i]-mn)/span; t=t<0?0:t>1?1:t; const k=(t*255)|0;
    const fc=hp?1+hp[i]*msx*3:1;
    d[i*4]=lut[k*3]*fc; d[i*4+1]=lut[k*3+1]*fc; d[i*4+2]=lut[k*3+2]*fc; d[i*4+3]=255; }
  tg.putImageData(img,0,0); return {mn,mx}; }
function lidarMesh(ctx,r,depth){ const st=Math.max(4,S.dotStep|0),u=U();
  ctx.save(); ctx.lineWidth=Math.max(1,u*0.5); ctx.globalAlpha=S.meshAlpha;
  for(let y=0;y<depth.h-st;y+=st)for(let x=0;x<depth.w-st;x+=st){
    const nz=1-depth.data[y*depth.w+x],px=r.x+(x/depth.w)*r.w,py=r.y+(y/depth.h)*r.h;
    ctx.strokeStyle=`rgba(178,107,255,${0.25+nz*0.5})`;
    ctx.beginPath();ctx.arc(px,py,(S.pointSize+nz*2)*u*0.6,0,7);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(r.x+((x+st)/depth.w)*r.w,py);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,r.y+((y+st)/depth.h)*r.h);ctx.stroke(); }
  ctx.restore(); }
function isoContours(ctx,f,r){ const T=runtime.temps; if(!T) return;
  ctx.save(); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=Math.max(1,U()*0.5);
  for(let t=Math.ceil(T.mn/S.isoStep)*S.isoStep;t<T.mx;t+=S.isoStep){ ctx.beginPath();
    for(let y=0;y<f.h-1;y++)for(let x=0;x<f.w-1;x++){
      const a=T.data[y*f.w+x],b=T.data[y*f.w+x+1],c=T.data[(y+1)*f.w+x];
      if((a<t)!==(b<t)){const px=r.x+((x+.5)/f.w)*r.w,py=r.y+(y/f.h)*r.h;ctx.moveTo(px,py);ctx.lineTo(px+1.5,py);}
      if((a<t)!==(c<t)){const px=r.x+(x/f.w)*r.w,py=r.y+((y+.5)/f.h)*r.h;ctx.moveTo(px,py);ctx.lineTo(px,py+1.5);} }
    ctx.stroke(); }
  ctx.restore(); }
function isoAlarm(ctx,f,r){ const T=runtime.temps; if(!T) return;
  ctx.save(); ctx.fillStyle='rgba(255,40,40,.35)';
  for(let y=0;y<f.h;y+=2)for(let x=0;x<f.w;x+=2) if(T.data[y*f.w+x]>S.isoAbove)
    ctx.fillRect(r.x+(x/f.w)*r.w,r.y+(y/f.h)*r.h,r.w/f.w*2,r.h/f.h*2);
  ctx.restore(); }
function spots(ctx,f,r){ const T=runtime.temps; if(!T) return; const u=U();
  let hi=0,lo=0; for(let i=0;i<T.data.length;i++){if(T.data[i]>T.data[hi])hi=i;if(T.data[i]<T.data[lo])lo=i;}
  const px=i=>r.x+((i%f.w)/f.w)*r.w, py=i=>r.y+((i/f.w|0)/f.h)*r.h;
  ctx.save(); ctx.scale(1/view.z,1/view.z); ctx.font='bold '+(13*u)+'px system-ui';
  const mark=(i,col)=>{ const x=px(i)*view.z,y=py(i)*view.z;
    ctx.strokeStyle=col;ctx.lineWidth=2*u;ctx.strokeRect(x-9*u,y-9*u,18*u,18*u);
    ctx.fillStyle=col;ctx.fillText(fmtT(T.data[i]),x+12*u,y-10*u); };
  if(S.hotspot)mark(hi,'#ff3b30'); if(S.coldspot)mark(lo,'#7df9ff');
  if(S.crosshair){ const cx=(r.x+r.w/2)*view.z,cy=(r.y+r.h/2)*view.z;
    ctx.strokeStyle='#b26bff';ctx.lineWidth=1.5*u;ctx.beginPath();
    ctx.moveTo(cx-16*u,cy);ctx.lineTo(cx+16*u,cy);ctx.moveTo(cx,cy-16*u);ctx.lineTo(cx,cy+16*u);ctx.stroke();
    ctx.fillStyle='#b26bff';ctx.fillText(fmtT(T.data[((T.h/2|0)*T.w)+(T.w/2|0)]),cx+18*u,cy+4*u); }
  ctx.restore(); }
function drawHist(ctx,x,y,w,h){ const H=runtime.hist; if(!H) return; const u=U();
  ctx.save(); ctx.fillStyle='rgba(10,4,20,.6)'; ctx.fillRect(x,y,w,h); ctx.lineWidth=Math.max(1,u*0.5);
  const max=Math.max(...H.r,...H.g,...H.b)||1;
  const line=(a,c)=>{ ctx.strokeStyle=c; ctx.beginPath();
    for(let i=0;i<256;i++){ const px=x+(i/255)*w,py=y+h-(a[i]/max)*(h-4)-2; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
    ctx.stroke(); };
  line(H.r,'#f55');line(H.g,'#5f5');line(H.b,'#55f'); ctx.restore(); }
function grid(ctx,W,H){ ctx.save(); ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=Math.max(1,U()*0.5);
  for(let i=1;i<3;i++){ ctx.beginPath();ctx.moveTo(W*i/3,0);ctx.lineTo(W*i/3,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,H*i/3);ctx.lineTo(W,H*i/3);ctx.stroke(); } ctx.restore(); }
function horizon(ctx,W,H){ const u=U(),t=runtime.tilt,roll=(t.gamma||0)*Math.PI/180;
  ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(-roll);
  ctx.strokeStyle='
