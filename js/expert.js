const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function grab(video,w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').drawImage(video,0,0,w,h); return c; }
export function grayOf(canvas,w,h){ const c=document.createElement('canvas'); c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(canvas,0,0,w,h);
  const d=g.getImageData(0,0,w,h).data, o=new Uint8Array(w*h);
  for(let i=0,p=0;i<o.length;i++,p+=4) o[i]=(d[p]*.299+d[p+1]*.587+d[p+2]*.114)|0; return o; }
function alignShift(a,b){ const w=96,h=72; let best={x:0,y:0},bs=Infinity;
  const sad=(dx,dy)=>{ let s=0; for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){
      const i=y*w+x, j=(y+dy)*w+(x+dx); if(j<0||j>=w*h) continue; s+=Math.abs(a[i]-b[j]); } return s; };
  for(let dy=-6;dy<=6;dy+=2)for(let dx=-6;dx<=6;dx+=2){ const s=sad(dx,dy); if(s<bs){bs=s;best={x:dx,y:dy};} }
  for(let dy=best.y-1;dy<=best.y+1;dy++)for(let dx=best.x-1;dx<=best.x+1;dx++){
    const s=sad(dx,dy); if(s<bs){bs=s;best={x:dx,y:dy};} }
  return best; }
export async function captureStack(video,n){
  const w=Math.min(video.videoWidth,1920), h=Math.min(video.videoHeight,1080);
  const frames=[],grays=[];
  for(let i=0;i<n;i++){ const c=grab(video,w,h); frames.push(c); grays.push(grayOf(c,96,72)); await sleep(45); }
  const shifts=frames.map((_,i)=> i? alignShift(grays[0],grays[i]) : {x:0,y:0});
  const k=w/96, buf=frames.map((c,i)=>{ const t=document.createElement('canvas'); t.width=w;t.height=h;
    const g=t.getContext('2d'); g.drawImage(c,-Math.round(shifts[i].x*k),-Math.round(shifts[i].y*k));
    return g.getImageData(0,0,w,h).data; });
  const img=new ImageData(w,h), vals=new Array(n);
  for(let p=0;p<w*h;p++) for(let ch=0;ch<3;ch++){
    for(let i=0;i<n;i++) vals[i]=buf[i][p*4+ch];
    vals.sort((a,b)=>a-b); const skip=n>=4?1:0; let s=0,c2=0;
    for(let i=skip;i<n-skip;i++){ s+=vals[i]; c2++; }
    img.data[p*4+ch]=s/c2; }
  for(let p=0;p<w*h;p++) img.data[p*4+3]=255;
  return img; }
function boxBlur(src,w,h,r){ const tmp=new Float32Array(src.length), out=new Float32Array(src.length);
  for(let y=0;y<h;y++){ let acc=0; const row=y*w;
    for(let x=-r;x<=r;x++) acc+=src[row+Math.min(w-1,Math.max(0,x))];
    for(let x=0;x<w;x++){ out[row+x]=acc/(2*r+1);
      acc+=src[row+Math.min(w-1,x+r+1)]-src[row+Math.max(0,x-r)]; } }
  for(let x=0;x<w;x++){ let acc=0;
    for(let y=-r;y<=r;y++) acc+=out[Math.min(h-1,Math.max(0,y))*w+x];
    for(let y=0;y<h;y++){ tmp[y*w+x]=acc/(2*r+1);
      acc+=out[Math.min(h-1,y+r+1)*w+x]-out[Math.max(0,y-r)*w+x]; } }
  return tmp; }
function toneLUT(o){ const lut=new Float32Array(256);
  for(let i=0;i<256;i++){ let v=i/255;
    v=Math.pow(v,1/Math.max(0.2,o.gamma)); v=(v-0.5)*o.contrast+0.5;
    v=v>0.94? 0.94+(v-0.94)*0.55 : v<0.06? 0.06+(v-0.06)*0.7 : v;
    lut[i]=Math.max(0,Math.min(1,v))*255; }
  return lut; }
function wbGains(img,o){ if(o.wb!=='auto'){ const t=o.kelvin;
    return { r: t<5500? 1+(5500-t)/9000 : 1, b: t>5500? 1+(t-5500)/9000 : 1 }; }
  let r=0,g=0,b=0,n=0; const d=img.data;
  for(let p=0;p<d.length;p+=16){ r+=d[p]; g+=d[p+1]; b+=d[p+2]; n++; }
  const mr=r/n,mg=g/n,mb=b/n; return { r:mg/Math.max(1,mr), b:mg/Math.max(1,mb) }; }
export function processPhoto(img,o){
  const w=img.width,h=img.height, lut=toneLUT(o), g=wbGains(img,o), d=img.data;
  const out=new ImageData(w,h), od=out.data;
  const cx=w/2, cy=h/2, maxR=Math.hypot(cx,cy);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const p=(y*w+x)*4;
    let r=lut[Math.min(255,d[p]*g.r)]|0, gg=lut[d[p+1]]|0, b=lut[Math.min(255,d[p+2]*g.b)]|0;
    const lum=0.299*r+0.587*gg+0.114*b, mx=Math.max(r,gg,b), mn=Math.min(r,gg,b);
    const s=o.sat + o.vibrance*(1-(mx-mn)/Math.max(1,mx));
    r=lum+(r-lum)*s; gg=lum+(gg-lum)*s; b=lum+(b-lum)*s;
    if(o.vignette>0){ const f=1-o.vignette*Math.pow(Math.hypot(x-cx,y-cy)/maxR,2.2); r*=f; gg*=f; b*=f; }
    od[p]=r; od[p+1]=gg; od[p+2]=b; od[p+3]=255; }
  if(o.denoise>0){ const bl=[0,1,2].map(ch=>boxBlur(Float32Array.from({length:w*h},(_,i)=>od[i*4+ch]),w,h,1));
    for(let i=0;i<w*h;i++){ const p=i*4;
      od[p]=od[p]*(1-o.denoise)+bl[0][i]*o.denoise;
      od[p+1]=od[p+1]*(1-o.denoise)+bl[1][i]*o.denoise;
      od[p+2]=od[p+2]*(1-o.denoise)+bl[2][i]*o.denoise; } }
  if(o.clahe>0){ const lum=new Float32Array(w*h);
    for(let i=0;i<w*h;i++) lum[i]=0.299*od[i*4]+0.587*od[i*4+1]+0.114*od[i*4+2];
    const lb=boxBlur(lum,w,h,Math.max(8,(Math.max(w,h)/32)|0));
    for(let i=0,p=0;i<w*h;i++,p+=4){ const dl=(lum[i]-lb[i])*o.clahe;
      od[p]+=dl; od[p+1]+=dl; od[p+2]+=dl; } }
  if(o.sharpen>0){ const chs=[0,1,2].map(ch=>boxBlur(Float32Array.from({length:w*h},(_,i)=>od[i*4+ch]),w,h,2));
    for(let i=0;i<w*h;i++){ const p=i*4;
      od[p]+=(od[p]-chs[0][i])*o.sharpen; od[p+1]+=(od[p+1]-chs[1][i])*o.sharpen; od[p+2]+=(od[p+2]-chs[2][i])*o.sharpen; } }
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').putImageData(out,0,0); return c; }
export function histRGB(img){ const H={r:new Uint32Array(256),g:new Uint32Array(256),b:new Uint32Array(256),clip:0};
  const d=img.data; for(let p=0;p<d.length;p+=4){ H.r[d[p]]++; H.g[d[p+1]]++; H.b[d[p+2]]++;
    if(d[p]>250&&d[p+1]>250&&d[p+2]>250) H.clip++; }
  H.total=d.length/4; return H; }
export function zebraCanvas(gray,w,h){ const c=document.createElement('canvas'); c.width=w;c.height=h;
  const g=c.getContext('2d'), im=g.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=y*w+x;
    if(gray[i]>245 && ((x+y)>>2)%2===0){ im.data[i*4]=255; im.data[i*4+1]=255; im.data[i*4+2]=255; im.data[i*4+3]=110; } }
  g.putImageData(im,0,0); return c; }
export function peakingCanvas(gray,w,h){ const c=document.createElement('canvas'); c.width=w;c.height=h;
  const g=c.getContext('2d'), im=g.createImageData(w,h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){ const i=y*w+x;
    const m=Math.hypot(gray[i+1]-gray[i-1],gray[i+w]-gray[i-w]);
    if(m>60){ im.data[i*4]=255; im.data[i*4+1]=0; im.data[i*4+2]=255; im.data[i*4+3]=160; } }
  g.putImageData(im,0,0); return c; }
