import { S, runtime, put, all, del, enqueue, cloudAllowed, Anom } from './core.js';
import { fmtT } from './render.js';
export function download(blob,name){ const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
export async function share(blob,name){ const f=new File([blob],name,{type:blob.type});
  if(navigator.canShare?.({files:[f]})) await navigator.share({files:[f],title:'Paranormal by Kevin'});
  else download(blob,name); }
export function stamp(g,w,h){ g.fillStyle='rgba(10,4,20,.72)'; g.fillRect(0,h-34,w,34);
  g.fillStyle='#efe9ff'; g.font='13px system-ui';
  g.fillText('Paranormal by Kevin — '+new Date().toLocaleString('fr-FR')+`  PARA ${Math.round(runtime.para)}`+
    (runtime.temps?`  Max ${fmtT(runtime.temps.max)} Min ${fmtT(runtime.temps.min)}`:'')+
    (runtime.gps?`  ${runtime.gps.latitude.toFixed(4)},${runtime.gps.longitude.toFixed(4)}`:''),10,h-12); }
export async function saveCanvas(canvas,extra={}){
  const blob=await new Promise(r=>canvas.toBlob(r,S.photo.format==='png'?'image/png':'image/jpeg',.95));
  const id=crypto.randomUUID();
  await put('media',{id,type:'photo',mime:blob.type,blob,ts:Date.now(),
    meta:{para:Math.round(runtime.para),
      temps:runtime.temps?{min:runtime.temps.mn,max:runtime.temps.mx,avg:runtime.temps.avg}:null,
      gps:runtime.gps||null,palette:S.palette,...extra}});
  download(blob,`paranormal-${id}.`+(S.photo.format==='png'?'png':'jpg'));
  return id; }
export function startVideo(canvas){
  const stream=canvas.captureStream(S.video.fps);
  const go=()=>{ const mimes=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];
    const mime=S.video.mime!=='auto'?S.video.mime:mimes.find(m=>MediaRecorder.isTypeSupported(m));
    const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:S.video.bitrate*1e6});
    const chunks=[]; mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
    mr.onstop=async()=>{ const blob=new Blob(chunks,{type:mime}),id=crypto.randomUUID();
      await put('media',{id,type:'video',mime:blob.type,blob,ts:Date.now(),meta:{para:Math.round(runtime.para)}});
      download(blob,`paranormal-${id}.`+(mime.includes('mp4')?'mp4':'webm')); };
    mr.start(1000); return mr; };
  return S.video.mic? navigator.mediaDevices.getUserMedia({audio:true}).then(m=>{
    m.getAudioTracks().forEach(t=>stream.addTrack(t)); return go(); }) : Promise.resolve(go()); }
export const listMedia=()=>all('media');
export const delMedia=id=>del('media',id);
export async function makeReport(){
  const T=runtime.temps;
  const data={date:new Date().toISOString(),mode:S.mode,palette:S.palette,emissivity:S.emissivity,
    para:Math.round(Anom.score),
    stats:T?{min:+T.mn.toFixed(1),max:+T.mx.toFixed(1),avg:+T.avg.toFixed(1)}:null,
    events:Anom.events.slice(0,20).map(e=>({ts:e.ts,type:e.type,severity:e.severity,detail:e.detail})),
    detections:(runtime.boxes||[]).map(b=>({label:b.label,score:+b.score.toFixed(2)})),
    gps:runtime.gps||null};
  let text;
  if(S.llm.provider!=='none'&&S.llm.key){
    if(cloudAllowed()) text=await llm(data);
    else{ await enqueue({id:crypto.randomUUID(),data,ts:Date.now()});
      text=localReport(data)+'\n[Réseau] Analyse cloud en file au retour 4G/5G/Wi‑Fi.'; }
  } else text=localReport(data);
  const id=crypto.randomUUID(); await put('reports',{id,ts:Date.now(),data,text}); return {id,text}; }
export async function flushQueue(){ const q=await all('queue');
  for(const it of q){ if(!cloudAllowed()) break;
    const text=await llm(it.data); await put('reports',{id:it.id,ts:Date.now(),data:it.data,text});
    await del('queue',it.id); } }
function localReport(d){ const s=d.stats,ev=d.events||[],sev=ev.reduce((a,e)=>a+e.severity,0);
  return `RAPPORT D'INVESTIGATION — PARANORMAL BY KEVIN — ${new Date(d.date).toLocaleString('fr-FR')}
──────────────────────────────────
Mode ${d.mode.toUpperCase()} · PARA ${d.para}/100
Thermique : ${s?`Max ${s.max}°C · Min ${s.min}°C · Moy ${s.avg}°C`:'capteur non connecté'}
Événements : ${ev.length} (sévérité cumulée ${sev})
${ev.slice(0,8).map(e=>`  • ${new Date(e.ts).toLocaleTimeString('fr-FR')} — ${e.type} (sev ${e.severity}) : ${e.detail}`).join('\n')}
Détections IA : ${d.detections.length?d.detections.map(x=>`${x.label} (${(x.score*100)|0}%)`).join(', '):'aucune'}
${d.gps?`GPS : ${d.gps.latitude.toFixed(5)}, ${d.gps.longitude.toFixed(5)}`:'GPS : non renseigné'}
──────────────────────────────────
INTERPRÉTATION PRUDENTE : causes naturelles fréquentes (courants d'air, câblage, faune, RF).
Généré hors ligne par Paranormal by Kevin.`; }
async function llm(d){
  const sys="Analyste d'investigation paranormale rigoureux et sceptique. Rapport court en français, hypothèses naturelles prioritaires.";
  if(S.llm.provider==='groq'){
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${S.llm.key}`},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:sys},{role:'user',content:JSON.stringify(d)}]})});
    return (await r.json()).choices[0].message.content; }
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${S.llm.key}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:sys+'\n'+JSON.stringify(d)}]}]})});
  return (await r.json()).candidates[0].content.parts[0].text; }
