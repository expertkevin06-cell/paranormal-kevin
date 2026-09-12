import { S, view, runtime } from './state.js';
import { LUTS } from './palettes.js';
const tc=document.createElement('canvas'), tg=tc.getContext('2d');
export const fmtT = v => (S.unit==='F'? v*9/5+32 : v).toFixed(1)+'°'+S.unit;
const cover=(W,H,sw,sh)=>{ const r=Math.max(W/sw,H/sh), w=sw*r, h=sh*r; return {x:(W-w)/2,y:(H-h)/2,w,h}; };

function thermalRect(f, base, A){
  const fit=S.align.fit||'cover';
  if(fit==='contain'){ const s=Math.min(base.w/f.w, base.h/f.h), w=f.w*s, h=f.h*s;
    return {x:base.x+(base.w-w)/2+A.ox, y:base.y+(base.h-h)/2+A.oy, w:w*A.sx, h:h*A.sy}; }
  if(fit==='stretch') return {x:base.x+A.ox, y:base.y+A.oy, w:base.w*A.sx, h:base.h*A.sy};
  const s=Math.max(base.w/f.w, base.h/f.h), w=f.w*s, h=f.h*s;
  return {x:base.x+(base.w-w)/2+A.ox, y:base.y+(base.h-h)/2+A.oy, w:w*A.sx, h:h*A.sy}; }

export function thermalImageData(f, rgbSrc, msxAmount){
  const {w,h}=f; if(tc.width!==w){tc.width=w;tc.height=h;}
  /* v3.4 : flux UVC déjà coloré → palette constructeur conservée, °C estimés */
  if(f.color && f.ccanvas){ tg.drawImage(f.ccanvas,0,0);
    const gd=tg.getImageData(0,0,w,h).data, temps=new Float32Array(w*h);
    for(let i=0,p=0;i<temps.length;i++,p+=4)
      temps[i]=S.Tmin+((gd[p]*.299+gd[p+1]*.587+gd[p+2]*.114)/255)*(S.Tmax-S.Tmin);
    let mn,mx;
    if(S.agc==='auto'){ mn=Infinity; mx=-Infinity;
      for(let i=0;i<temps.length;i++){ const v=temps[i]; if(v<mn)mn=v; if(v>mx)mx=v; } }
    else { mn=S.level-S.span/2; mx=S.level+S.span/2; }
    runtime.temps={data:temps,w,h,mn,mx,avg:temps.reduce((a,b)=>a+b,0)/temps.length};
    return {mn,mx}; }
  /* voie classique (gris ou 16 bits radiométrique) */
  const img=tg.createImageData(w,h), lut=LUTS[S.palette];
  let temps=f.temps, mn=S.Tmin, mx=S.Tmax;
  if(!temps){ temps=new Float32Array(w*h);
    for(let i=0;i<w*h;i++) temps[i]=S.Tmin+(f.gray[i]/255)*(S.Tmax-S.Tmin); }
  if(S.agc==='auto'){ mn=Infinity; mx=-Infinity;
    for(let i=0;i<temps.length;i++){ const v=temps[i]; if(v<mn)mn=v; if(v>mx)mx=v; } }
  else { mn=S.level-S.span/2; mx=S.level+S.span/2; }
  runtime.temps={data:temps,w,h,mn,mx,avg:temps.reduce((a,b)=>a+b,0)/temps.length};
  let hp=null;
  if(msxAmount>0 && rgbSrc){ const c=document.createElement('canvas'); c.width=w;c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(rgbSrc,0,0,w,h);
    const d=g.getImageData(0,0,w,h).data, gr=new Float32Array(w*h);
    for(let i=0,p=0;i<gr.length;i++,p+=4) gr[i]=d[p]*.299+d[p+1]*.587+d[p+2]*.114;
    hp=new Float32Array(w*h);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){ const i=y*w+x;
      const blur=(gr[i-1]+gr[i+1]+gr[i-w]+gr[i+w]+gr[i])*0.2; hp[i]=(gr[i]-blur)/255; } }
  const d=img.data, span=Math.max(1e-6,mx-mn);
  for(let i=0;i<w*h;i++){ let t=(temps[i]-mn)/span; t=t<0?0:t>1?1:t; const k=(t*255)|0;
    const fct= hp? 1+hp[i]*msxAmount*3 : 1;
    d[i*4]=lut[k*3]*fct; d[i*4+1]=lut[k*3+1]*fct; d[i*4+2]=lut[k*3+2]*fct; d[i*4+3]=255; }
  tg.putImageData(img,0,0); return {mn,mx}; }

function lidarMesh(ctx,r,depth){ const st=Math.max(4,S.dotStep|0);
  ctx.save(); ctx.lineWidth=1; ctx.globalAlpha=S.meshAlpha;
  for(let y=0;y<depth.h-st;y+=st)for(let x=0;x<depth.w-st;x+=st){
    const nz=1-depth.data[y*depth.w+x], px=r.x+(x/depth.w)*r.w, py=r.y+(y/depth.h)*r.h;
    ctx.strokeStyle=`rgba(178,107,255,${0.25+nz*0.5})`;
    ctx.beginPath(); ctx.arc(px,py,S.pointSize+nz*2,0,7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(r.x+((x+st)/depth.w)*r.w,py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px,r.y+((y+st)/depth.h)*r.h); ctx.stroke(); }
  ctx.restore(); }
function isoContours(ctx,f,r){ const T=runtime.temps; if(!T) return;
  ctx.save(); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1;
  for(let t=Math.ceil(T.mn/S.isoStep)*S.isoStep; t<T.mx; t+=S.isoStep){ ctx.beginPath();
    for(let y=0;y<f.h-1;y++)for(let x=0;x<f.w-1;x++){
      const a=T.data[y*f.w+x], b=T.data[y*f.w+x+1], c=T.data[(y+1)*f.w+x];
      if((a<t)!==(b<t)){ const px=r.x+((x+.5)/f.w)*r.w, py=r.y+(y/f.h)*r.h; ctx.moveTo(px,py); ctx.lineTo(px+1.5,py); }
      if((a<t)!==(c<t)){ const px=r.x+(x/f.w)*r.w, py=r.y+((y+.5)/f.h)*r.h; ctx.moveTo(px,py); ctx.lineTo(px,py+1.5); } }
    ctx.stroke(); }
  ctx.restore(); }
function isoAlarm(ctx,f,r){ const T=runtime.temps; if(!T) return;
  ctx.save(); ctx.fillStyle='rgba(255,40,40,.35)';
  for(let y=0;y<f.h;y+=2)for(let x=0;x<f.w;x+=2) if(T.data[y*f.w+x]>S.isoAbove)
    ctx.fillRect(r.x+(x/f.w)*r.w, r.y+(y/f.h)*r.h, r.w/f.w*2, r.h/f.h*2);
  ctx.restore(); }
function spots(ctx,f,r){ const T=runtime.temps; if(!T) return;
  let hi=0,lo=0; for(let i=0;i<T.data.length;i++){ if(T.data[i]>T.data[hi])hi=i; if(T.data[i]<T.data[lo])lo=i; }
  const px=i=>r.x+((i%f.w)/f.w)*r.w, py=i=>r.y+((i/f.w|0)/f.h)*r.h;
  ctx.save(); ctx.scale(1/view.z,1/view.z); ctx.font='bold 13px system-ui';
  const mark=(i,col)=>{ const x=px(i)*view.z,y=py(i)*view.z;
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.strokeRect(x-9,y-9,18,18);
    ctx.fillStyle=col; ctx.fillText(fmtT(T.data[i]),x+12,y-10); };
  if(S.hotspot) mark(hi,'#ff3b30'); if(S.coldspot) mark(lo,'#7df9ff');
  if(S.crosshair){ const cx=(r.x+r.w/2)*view.z, cy=(r.y+r.h/2)*view.z;
    ctx.strokeStyle='#b26bff'; ctx.beginPath();
    ctx.moveTo(cx-16,cy); ctx.lineTo(cx+16,cy); ctx.moveTo(cx,cy-16); ctx.lineTo(cx,cy+16); ctx.stroke();
    ctx.fillStyle='#b26bff'; ctx.fillText(fmtT(T.data[((T.h/2|0)*T.w)+(T.w/2|0)]),cx+18,cy+4); }
  ctx.restore(); }
function drawHist(ctx,x,y,w,h){ const H=runtime.hist; if(!H) return;
  ctx.save(); ctx.fillStyle='rgba(10,4,20,.6)'; ctx.fillRect(x,y,w,h);
  const max=Math.max(...H.r,...H.g,...H.b)||1;
  const line=(arr,col)=>{ ctx.strokeStyle=col; ctx.beginPath();
    for(let i=0;i<256;i++){ const px=x+(i/255)*w, py=y+h-(arr[i]/max)*(h-4)-2;
      i?ctx.lineTo(px,py):ctx.moveTo(px,py); } ctx.stroke(); };
  line(H.r,'#f55'); line(H.g,'#5f5'); line(H.b,'#55f'); ctx.restore(); }
function grid(ctx,W,H){ ctx.save(); ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=1;
  for(let i=1;i<3;i++){ ctx.beginPath(); ctx.moveTo(W*i/3,0); ctx.lineTo(W*i/3,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,H*i/3); ctx.lineTo(W,H*i/3); ctx.stroke(); } ctx.restore(); }
function horizon(ctx,W,H){ const t=runtime.tilt, roll=(t.gamma||0)*Math.PI/180;
  ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(-roll); ctx.strokeStyle='rgba(178,107,255,.55)';
  ctx.beginPath(); ctx.moveTo(-W,0); ctx.lineTo(W,0); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,Math.max(-40,Math.min(40,(t.beta||0)-45))*1.5,6,0,7); ctx.stroke(); ctx.restore(); }
function paraGauge(ctx,W,H){ const x=W-58, y=64, r=34, sc=runtime.para||0;
  ctx.save(); ctx.lineWidth=7; ctx.strokeStyle='rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.arc(x,y,r,Math.PI*0.75,Math.PI*2.25); ctx.stroke();
  const col= sc>70?'#ff3b30': sc>40?'#ffb020':'#7df9ff';
  ctx.strokeStyle=col; ctx.beginPath();
  ctx.arc(x,y,r,Math.PI*0.75,Math.PI*0.75+(sc/100)*Math.PI*1.5); ctx.stroke();
  ctx.fillStyle=col; ctx.font='bold 16px system-ui'; ctx.textAlign='center';
  ctx.fillText(sc|0, x, y+5); ctx.font='9px system-ui'; ctx.fillText('PARA', x, y+18);
  ctx.restore(); }
function flashOverlay(ctx,W,H){ if(Date.now()<runtime.flash){
    const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.7);
    g.addColorStop(0,'rgba(255,0,0,0)'); g.addColorStop(1,'rgba(255,0,0,.45)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); } }
function demoWatermark(ctx,W,H){ if(runtime.thSrc && runtime.thSrc.indexOf('DÉMO')===0){
    ctx.save(); ctx.font='bold 13px system-ui'; ctx.textAlign='center';
    ctx.fillStyle='rgba(255,255,255,.75)';
    ctx.fillText('SIMULATION — aucun capteur connecté (🔌 → UVC)', W/2, H-14); ctx.restore(); } }

export function renderScene(ctx,W,H,L,o={}){
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(W/2,H/2); ctx.scale(view.z,view.z); ctx.translate(-W/2+view.x,-H/2+view.y);
  const hasRGB=!!L.rgb && (L.rgb.videoWidth||L.rgb.width||0)>0 && (L.rgb.readyState===undefined||L.rgb.readyState>=2);
  const hasTH=!!L.th, hasD=!!L.depth;
  const A=S.align; let span=null, tr=null;
  const rgbBase = hasRGB ? cover(W,H,L.rgb.videoWidth||L.rgb.width, L.rgb.videoHeight||L.rgb.height) : null;
  if(hasRGB){ ctx.save();
    if(S.night) ctx.filter='brightness(2.1) contrast(1.15) saturate(1.1)';
    ctx.drawImage(L.rgb,rgbBase.x,rgbBase.y,rgbBase.w,rgbBase.h); ctx.restore(); }
  if(hasTH){
    const msx=(S.fusionMode==='msx'&&hasRGB&&!L.th.color)? S.expert.detailTransfer : 0;
    span=thermalImageData(L.th, hasRGB?L.rgb:null, msx);
    const base = rgbBase || {x:0,y:0,w:W,h:H};
    tr = thermalRect(L.th, base, A);
    const drawT=(alpha,clip)=>{ ctx.save(); if(clip)clip(); ctx.globalAlpha=alpha;
      if(A.mirror){ ctx.translate(tr.x+tr.w,tr.y); ctx.scale(-1,1); ctx.drawImage(tc,0,0,tr.w,tr.h); }
      else ctx.drawImage(tc,tr.x,tr.y,tr.w,tr.h); ctx.restore(); };
    if(!hasRGB) drawT(1);
    else switch(S.fusionMode){
      case 'pip':    drawT(1,()=>{ const s=Math.min(W,H)*0.3; ctx.rect(W-s-24,H-s-120,s,s); }); break;
      case 'blend':  drawT(0.55); break;
      case 'splith': drawT(1,()=>ctx.rect(0,0,W,H/2)); break;
      case 'splitv': drawT(1,()=>ctx.rect(0,0,W/2,H)); break;
      case 'msx':    drawT(0.85); break;
      case 'contour':drawT(1); isoContours(ctx,L.th,tr); break;
      case 'outline':drawT(0.8); break; }
    if(S.isoOn) isoAlarm(ctx,L.th,tr);
    spots(ctx,L.th,tr);
  } else if(!hasRGB && hasD) depthView(ctx,W,H,L.depth);
  if(hasD && S.meshOn) lidarMesh(ctx, rgbBase||tr||cover(W,H,L.depth.w,L.depth.h), L.depth);
  if(o.live){ if(runtime.fx.zebra&&hasRGB){ ctx.globalCompositeOperation='screen';
      ctx.drawImage(runtime.fx.zebra,0,0,W,H); ctx.globalCompositeOperation='source-over'; }
    if(runtime.fx.peak&&hasRGB){ ctx.globalCompositeOperation='lighten';
      ctx.drawImage(runtime.fx.peak,0,0,W,H); ctx.globalCompositeOperation='source-over'; } }
  ctx.restore();
  if(o.live&&S.expert.grid) grid(ctx,W,H);
  if(o.live&&S.expert.horizon) horizon(ctx,W,H);
  hud(ctx,W,H,span,L);
  if(o.live){ paraGauge(ctx,W,H); flashOverlay(ctx,W,H); demoWatermark(ctx,W,H); }
}
function depthView(ctx,W,H,depth){ const r=cover(W,H,depth.w,depth.h), lut=LUTS.ghost;
  const img=ctx.createImageData(depth.w,depth.h), c=document.createElement('canvas');
  c.width=depth.w; c.height=depth.h;
  for(let i=0;i<depth.data.length;i++){ const k=((1-depth.data[i])*255)|0;
    img.data[i*4]=lut[k*3]; img.data[i*4+1]=lut[k*3+1]; img.data[i*4+2]=lut[k*3+2]; img.data[i*4+3]=255; }
  c.getContext('2d').putImageData(img,0,0); ctx.drawImage(c,r.x,r.y,r.w,r.h); }
function hud(ctx,W,H,span,L){ if(!S.hud) return;
  ctx.save(); ctx.font='12px system-ui'; ctx.fillStyle='rgba(10,4,20,.68)'; ctx.fillRect(8,8,268,86);
  ctx.fillStyle='#efe9ff'; const T=runtime.temps;
  ctx.fillText(`MODE ${S.mode.toUpperCase()} · SRC ${runtime.thSrc||'—'} · ${runtime.net}`,16,26);
  if(T) ctx.fillText(`Max ${fmtT(T.mx)}  Min ${fmtT(T.mn)}  Moy ${fmtT(T.avg)}`,16,44);
  ctx.fillText(`Émiss ${S.emissivity}  Palette ${S.palette}  ×${view.z.toFixed(1)}`,16,62);
  ctx.fillText(new Date().toLocaleString('fr-FR'),16,80); ctx.restore();
  if(S.hist) drawHist(ctx,70,H-96,150,72);
  if(S.legend&&span){ const lut=LUTS[S.palette], x=W-34, y0=120, hh=H-260;
    for(let i=0;i<hh;i++){ const k=255-((i/hh)*255|0);
      ctx.fillStyle=`rgb(${lut[k*3]},${lut[k*3+1]},${lut[k*3+2]})`; ctx.fillRect(x,y0+i,18,1); }
    ctx.fillStyle='#fff'; ctx.font='11px system-ui';
    for(let i=0;i<=4;i++) ctx.fillText(fmtT(span.mx-(span.mx-span.mn)*i/4), x-52, y0+hh*i/4+4); } }
