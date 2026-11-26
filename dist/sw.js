const APP_VERSION='4.1.0',BUILD='b566523da11a';
const CACHE='kapital-focus-'+BUILD;
const base=new URL('./',self.location.href).href;
const pages=['./','./index.html','./Kapital.html'].map(path=>new URL(path,base).pathname);
async function isThisBuild(response){return response.ok&&(await response.clone().text()).includes(`name="kapital-build" content="${BUILD}"`);}
// Страница обязательна: без полной копии новая версия не устанавливается и старая остаётся в работе.
async function cachePage(){const response=await fetch(base,{cache:'reload'});if(!await isThisBuild(response))throw new Error('Страница обновления загружена не полностью.');const copy=new Response(await response.blob(),{status:200,headers:response.headers});await(await caches.open(CACHE)).put(base,copy);}
async function cacheAsset(path){try{const url=new URL(path,base).href,response=await fetch(url,{cache:'reload'});if(response.ok)await(await caches.open(CACHE)).put(url,response);}catch{}}
// Без skipWaiting при установке: новая версия ждёт команды кнопки «Обновить».
self.addEventListener('install',event=>{event.waitUntil(cachePage().then(()=>Promise.all(['./icon.png','./manifest.webmanifest'].map(cacheAsset))));});
// Удаляются только старые копии файлов приложения. Записи пользователя лежат в IndexedDB и здесь не затрагиваются.
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kapital-focus-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='VERSION')event.ports[0]?.postMessage({version:APP_VERSION,build:BUILD});
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.endsWith('.zip'))return;
  if(event.request.mode==='navigate'){
    if(!pages.includes(url.pathname))return;
    event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(base);if(cached)return cached;const response=await fetch(event.request,{cache:'no-cache'});if(await isThisBuild(response))await cache.put(base,response.clone());return response;})());
    return;
  }
  if(['icon.png','manifest.webmanifest'].some(file=>url.href===new URL(file,base).href))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request)));
});
