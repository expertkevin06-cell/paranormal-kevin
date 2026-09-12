import { S, runtime } from './state.js';
export const Net = { online:navigator.onLine, tier:'medium', downlink:0, rtt:0, saveData:false, label:'—' };
const listeners=[];
export const onNet = fn => listeners.push(fn);
function compute(){
  const c = navigator.connection||{};
  Net.online=navigator.onLine; Net.saveData=!!c.saveData;
  Net.downlink=c.downlink||0;  Net.rtt=c.rtt||0;
  const et=c.effectiveType||'';
  if(!Net.online)                        { Net.tier='offline'; Net.label='HORS LIGNE'; }
  else if(Net.saveData||['slow-2g','2g','3g'].includes(et)||Net.downlink<1.5)
                                         { Net.tier='low';    Net.label=(et||'web').toUpperCase()+' faible'; }
  else if(Net.downlink>=10&&Net.rtt<=120){ Net.tier='high';   Net.label='5G/Wi‑Fi '+Net.downlink+' Mb/s'; }
  else                                   { Net.tier='medium'; Net.label='4G+ '+(Net.downlink||'~')+' Mb/s'; }
  runtime.online=Net.online; runtime.net=Net.label; runtime.tier=Net.tier;
  listeners.forEach(f=>f(Net));
}
export function initNet(){ compute();
  addEventListener('online',compute); addEventListener('offline',compute);
  navigator.connection?.addEventListener?.('change',compute); }
export function effQuality(){
  if(!S.net.autoQuality) return { stack:S.expert.stack, dfps:S.depth.fps };
  switch(Net.tier){ case 'high': return {stack:8,dfps:10};
                    case 'medium': return {stack:6,dfps:8};
                    default: return {stack:4,dfps:6}; } }
export const cloudAllowed = ()=> Net.online && Net.tier!=='low' && S.net.cloudReport;
