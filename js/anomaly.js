import { runtime } from './state.js';
import { put } from './db.js';
export const Anom = { score:0, events:[], base:{}, last:{} };
export function pushSample(k,v){ const b=Anom.base[k] ??= []; b.push(v); if(b.length>240) b.shift(); }
export function baseline(k){ const b=Anom.base[k]; if(!b||b.length<30) return null;
  const m=b.reduce((a,c)=>a+c,0)/b.length;
  const sd=Math.sqrt(b.reduce((a,c)=>a+(c-m)**2,0)/b.length)||1e-6; return {m,sd}; }
export function dev(k,v){ const b=baseline(k); if(!b) return 0; return (v-b.m)/b.sd; }
export function updateScore(parts){
  const w={th:.30,mag:.20,audio:.25,motion:.15,prox:.10};
  let s=0,tot=0; for(const k in parts) if(parts[k]!=null){ s+=Math.min(1,parts[k])*w[k]; tot+=w[k]; }
  Anom.score = Anom.score*0.85 + (tot? (s/tot)*100 : 0)*0.15;
  runtime.para = Anom.score; return Anom.score; }
export async function logEvent(type,severity,detail,extra={}){
  const ev={ id:crypto.randomUUID(), ts:Date.now(), type, severity, detail, ...extra };
  Anom.events.unshift(ev); if(Anom.events.length>300) Anom.events.pop();
  await put('events',ev).catch(()=>{});
  return ev; }
export const cooled = (type,ms=20000)=> (Date.now()-(Anom.last[type]||0))>ms && (Anom.last[type]=Date.now());
