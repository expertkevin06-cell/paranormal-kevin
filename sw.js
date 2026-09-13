const V='pkv5-0';
const PRECACHE=['./','./index.html','./offline.html','./styles.css','./manifest.webmanifest',
 './js/core.js','./js/thermal.js','./js/vision.js','./js/expert.js','./js/render.js','./js/capture.js','./js/app.js'];
const CDN=['cdn.jsdelivr.net','unpkg.com','huggingface.co'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{ const url=new URL(e.request.url);
  if(e.request.mode==='navigate'){ e.respondWith(fetch(e.request).then(r=>{ const cp=r.clone();
      caches.open(V).then(c=>c.put('./index.html',cp)); return r; })
    .catch(()=>caches.match('./index.html').then(r=>r||caches.match('./offline.html')))); return; }
  if(CDN.some(h=>url.hostname.endsWith(h))){ e.respondWith(caches.match(e.request).then(h=>h||fetch(e.request).then(r=>{
      const cp=r.clone(); caches.open(V).then(c=>c.put(e.request,cp)); return r; }))); return; }
  e.respondWith(caches.match(e.request).then(h=>h||fetch(e.request).then(r=>{
    if(r.ok&&e.request.method==='GET'){ const cp=r.clone(); caches.open(V).then(c=>c.put(e.request,cp)); }
    return r; }).catch(()=>caches.match('./offline.html')))); });
