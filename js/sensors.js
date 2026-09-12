export const Sens = { mag:null, motionStill:true, hasMag:false };
export function initSensors(){
  try{ if('Magnetometer' in window){
    const m=new Magnetometer({frequency:10});
    m.addEventListener('reading',()=>{ Sens.mag=Math.hypot(m.x,m.y,m.z); Sens.hasMag=true; });
    m.addEventListener('error',()=>{ Sens.hasMag=false; });
    m.start(); return; } }catch{}
  Sens.hasMag=false; }
export function initMotion(){
  const samples=[];
  addEventListener('devicemotion',e=>{ const a=e.accelerationIncludingGravity; if(!a) return;
    const m=Math.hypot(a.x||0,a.y||0,a.z||0);
    samples.push(m); if(samples.length>30) samples.shift();
    const mean=samples.reduce((x,y)=>x+y,0)/samples.length;
    const v=samples.reduce((x,y)=>x+(y-mean)**2,0)/samples.length;
    Sens.motionStill = v<0.6; }); }
