import { S, runtime } from './state.js';
import { put, all, del } from './db.js';
import { fmtT } from './render.js';
export async function saveCanvas(canvas, extra={}){
  const blob=await new Promise(r=>canvas.toBlob(r, S.photo.format==='png'?'image/png':'image/jpeg', .95));
  const id=crypto.randomUUID();
  await put('media',{ id, type:'photo', mime:blob.type, blob, ts:Date.now(),
    meta:{ para:Math.round(runtime.para),
           temps: runtime.temps?{min:runtime.temps.mn,max:runtime.temps.mx,avg:runtime.temps.avg}:null,
           gps:runtime.gps||null, palette:S.palette, boxes:runtime.boxes, ...extra } });
  download(blob, `paranormal-${id}.`+(S.photo.format==='png'?'png':'jpg'));
  return id; }
export function stamp(g,w,h){ g.fillStyle='rgba(10,4,20,.72)'; g.fillRect(0,h-34,w,34);
  g.fillStyle='#efe9ff'; g.font='13px system-ui';
  g.fillText('Paranormal by Kevin — '+new Date().toLocaleString('fr-FR')+
    `  PARA ${Math.round(runtime.para)}`+
    (runtime.temps?`  Max ${fmtT(runtime.temps.max)} Min ${fmtT(runtime.temps.min)}`:'')+
    (runtime.gps?`  ${runtime.gps.latitude.toFixed(4)},${runtime.gps.longitude.toFixed(4)}`:''),10,h-12); }
export function startVideo(canvas){
  const stream=canvas.captureStream(S.video.fps);
  const go=()=>{ const mimes=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];
    const mime=S.video.mime!=='auto'?S.video.mime:mimes.find(m=>MediaRecorder.isTypeSupported(m));
    const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:S.video.bitrate*1e6});
    const chunks=[]; mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
    mr.onstop=async()=>{ const blob=new Blob(chunks,{type:mime}), id=crypto.randomUUID();
      await put('media',{id,type:'video',mime:blob.type,blob,ts:Date.now(),meta:{para:Math.round(runtime.para)}});
      download(blob,`paranormal-${id}.`+(mime.includes('mp4')?'mp4':'webm')); };
    mr.start(1000); return mr; };
  return S.video.mic ? navigator.mediaDevices.getUserMedia({audio:true}).then(m=>{
    m.getAudioTracks().forEach(t=>stream.addTrack(t)); return go(); }) : Promise.resolve(go()); }
export function download(blob,name){ const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
export async function share(blob,name){ const f=new File([blob],name,{type:blob.type});
  if(navigator.canShare?.({files:[f]})) await navigator.share({files:[f],title:'Paranormal by Kevin'});
  else download(blob,name); }
export { all as listMedia, del as delMedia };
