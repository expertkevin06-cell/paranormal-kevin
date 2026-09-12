import { S, runtime } from './state.js';
import { put, enqueue, all, del } from './db.js';
import { cloudAllowed } from './net.js';
import { Anom } from './anomaly.js';
export async function makeReport(){
  const T=runtime.temps;
  const data={ date:new Date().toISOString(), mode:S.mode, palette:S.palette, emissivity:S.emissivity,
    para:Math.round(Anom.score),
    stats: T?{min:+T.mn.toFixed(1),max:+T.mx.toFixed(1),avg:+T.avg.toFixed(1)}:null,
    events: Anom.events.slice(0,20).map(e=>({ts:e.ts,type:e.type,severity:e.severity,detail:e.detail})),
    detections:(runtime.boxes||[]).map(b=>({label:b.label,score:+b.score.toFixed(2)})),
    gps:runtime.gps||null };
  let text;
  if(S.llm.provider!=='none' && S.llm.key){
    if(cloudAllowed()) text=await llm(data);
    else { await enqueue({id:crypto.randomUUID(),data,ts:Date.now()});
      text=localReport(data)+'\n[Réseau] Analyse cloud en file — générée au retour 4G/5G/Wi‑Fi.'; }
  } else text=localReport(data);
  const id=crypto.randomUUID(); await put('reports',{id,ts:Date.now(),data,text}); return {id,text}; }
export async function flushQueue(){ const q=await all('queue');
  for(const it of q){ if(!cloudAllowed()) break;
    const text=await llm(it.data); await put('reports',{id:it.id,ts:Date.now(),data:it.data,text});
    await del('queue',it.id); } }
function localReport(d){
  const s=d.stats, ev=d.events||[];
  const sev=ev.reduce((a,e)=>a+e.severity,0);
  return `RAPPORT D'INVESTIGATION — PARANORMAL BY KEVIN — ${new Date(d.date).toLocaleString('fr-FR')}
──────────────────────────────────────
Mode : ${d.mode.toUpperCase()} · Score PARA final : ${d.para}/100
Thermique : ${s? `Max ${s.max}°C · Min ${s.min}°C · Moy ${s.avg}°C` : 'capteur non connecté'}
Événements enregistrés : ${ev.length} (cumul sévérité ${sev})
${ev.slice(0,8).map(e=>`  • ${new Date(e.ts).toLocaleTimeString('fr-FR')} — ${e.type} (sev ${e.severity}) : ${e.detail}`).join('\n')}
Détections visuelles IA : ${d.detections.length? d.detections.map(x=>`${x.label} (${(x.score*100)|0}%)`).join(', ') : 'aucune'}
${d.gps?`GPS : ${d.gps.latitude.toFixed(5)}, ${d.gps.longitude.toFixed(5)}`:'GPS : non renseigné'}
──────────────────────────────────────
INTERPRÉTATION PRUDENTE : toute anomalie thermique/magnétique/acoustique possède des causes
naturelles fréquentes (courants d'air, câblage électrique, appareils voisins, faune, interférences RF).
Croiser chaque événement avec une cause rationnelle avant toute conclusion.
Généré hors ligne par Paranormal by Kevin.`; }
async function llm(d){
  const sys="Tu es analyste d'investigation paranormale rigoureux et sceptique. Rapport court en français, hypothèses naturelles prioritaires.";
  if(S.llm.provider==='groq'){
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${S.llm.key}`},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:sys},{role:'user',content:JSON.stringify(d)}]})});
    return (await r.json()).choices[0].message.content; }
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${S.llm.key}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:sys+'\n'+JSON.stringify(d)}]}]})});
  return (await r.json()).candidates[0].content.parts[0].text; }
