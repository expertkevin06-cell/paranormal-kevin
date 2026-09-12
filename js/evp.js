export class EVP {
  constructor(){ this.on=false; this.ctx=null; this.rms=0; this.spec=null; this.mr=null; this.ring=[]; }
  async start(){
    const st=await navigator.mediaDevices.getUserMedia({audio:true});
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    const src=this.ctx.createMediaStreamSource(st);
    this.an=this.ctx.createAnalyser(); this.an.fftSize=512; src.connect(this.an);
    this.freq=new Uint8Array(this.an.frequencyBinCount);
    this.time=new Uint8Array(this.an.fftSize);
    this.spec=document.createElement('canvas'); this.spec.width=256; this.spec.height=64;
    this.sg=this.spec.getContext('2d');
    this.mr=new MediaRecorder(st); this.ring=[];
    this.mr.ondataavailable=e=>{ if(e.data.size){ this.ring.push(e.data); if(this.ring.length>6) this.ring.shift(); } };
    this.mr.start(1000); this.on=true; this._loop(); }
  stop(){ this.on=false; try{this.mr?.stop();}catch{} try{this.ctx?.close();}catch{} this.spec=null; }
  _loop(){ if(!this.on) return; requestAnimationFrame(()=>this._loop());
    this.an.getByteFrequencyData(this.freq); this.an.getByteTimeDomainData(this.time);
    let s=0; for(const v of this.time){ const d=(v-128)/128; s+=d*d; }
    this.rms=Math.sqrt(s/this.time.length);
    const g=this.sg; g.drawImage(this.spec,-1,0);
    for(let y=0;y<64;y++){ const v=this.freq[y*2]||0;
      g.fillStyle=`hsl(${280-v*0.6},90%,${(v/255)*60}%)`; g.fillRect(255,y,1,1); } }
  clip(){ return this.ring.length? new Blob(this.ring,{type:this.mr?.mimeType||'audio/webm'}) : null; }
}
