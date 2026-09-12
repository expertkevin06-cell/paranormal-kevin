let p;
export const db = ()=> p ??= new Promise((res,rej)=>{
  const r=indexedDB.open('paranormal-kevin',3);
  r.onupgradeneeded=()=>{ const d=r.result;
    if(!d.objectStoreNames.contains('media'))   d.createObjectStore('media',{keyPath:'id'});
    if(!d.objectStoreNames.contains('reports')) d.createObjectStore('reports',{keyPath:'id'});
    if(!d.objectStoreNames.contains('events'))  d.createObjectStore('events',{keyPath:'id'});
    if(!d.objectStoreNames.contains('queue'))   d.createObjectStore('queue',{keyPath:'id'}); };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const tx=(s,m)=>db().then(d=>d.transaction(s,m).objectStore(s));
const req=q=>new Promise((res,rej)=>{ q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); });
export const put=(s,v)=>tx(s,'readwrite').then(o=>req(o.put(v)));
export const all= s   =>tx(s,'readonly').then(o=>req(o.getAll()));
export const del=(s,id)=>tx(s,'readwrite').then(o=>req(o.delete(id)));
export const enqueue=v=>put('queue',v);
