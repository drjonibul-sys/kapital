import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {LocalStore} from '../src/storage.mjs';
const dist=name=>fs.readFile(new URL('../dist/'+name,import.meta.url),'utf8');
async function worker(respond){
  const handlers={},stored=new Map(),state={skipped:0};
  const cache={put:async(key,value)=>stored.set(key,value),match:async key=>stored.get(key)};
  const self={location:{href:'https://app.test/sw.js',origin:'https://app.test'},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:()=>state.skipped++,clients:{claim:async()=>{}}};
  vm.runInNewContext(await dist('sw.js'),{self,URL,Response,Promise,caches:{open:async()=>cache,keys:async()=>[]},fetch:async url=>respond(String(url))});
  const install=()=>{let done;handlers.install({waitUntil:p=>done=p});return done;};
  return {handlers,stored,state,install};
}
test('version and build are stamped into the page and the worker',async()=>{
  const [html,sw,pkg]=await Promise.all([dist('index.html'),dist('sw.js'),fs.readFile(new URL('../package.json',import.meta.url),'utf8')]);
  const build=html.match(/name="kapital-build" content="([0-9a-f]{12})"/)[1],{version}=JSON.parse(pkg);
  assert.ok(html.includes(`uiVersion='${version}',uiBuild='${build}'`));
  assert.ok(sw.includes(`APP_VERSION='${version}',BUILD='${build}'`));
  assert.doesNotMatch(html+sw,/__APP_VERSION__|__VERSION__/);
});
test('new worker installs a complete copy and waits for the update button',async()=>{
  const html=await dist('index.html'),w=await worker(()=>new Response(html));
  await w.install();
  assert.ok(w.stored.has('https://app.test/'));
  assert.equal(w.state.skipped,0);
  w.handlers.message({data:{type:'SKIP_WAITING'},ports:[]});
  assert.equal(w.state.skipped,1);
});
test('failed or mismatched page download rejects installation, keeping the old version',async()=>{
  for(const response of [()=>new Response('error',{status:500}),()=>new Response('<div id="kapital-app"></div>')]){
    const w=await worker(response);
    await assert.rejects(w.install());
    assert.equal(w.stored.size,0);
  }
});
function fakeDatabase(records){
  return {transaction(){const transaction={};let pending=0;
    const run=action=>{const request={};pending++;queueMicrotask(()=>{request.result=action();request.onsuccess?.();if(--pending===0)queueMicrotask(()=>transaction.oncomplete?.());});return request;};
    transaction.objectStore=()=>({get:key=>run(()=>structuredClone(records.get(key))),put:(value,key)=>run(()=>{records.set(key,structuredClone(value));})});
    return transaction;}};
}
test('data is copied once before a new version and the main record is not changed',async()=>{
  const main={data:{portfolios:[1]},revision:3},records=new Map([['main',main]]),store=new LocalStore(()=>{},d=>d,null);
  store.db=fakeDatabase(records);
  assert.equal(await store.keepBeforeUpdate('4.1.0'),true);
  assert.deepEqual(records.get('before-update'),main);
  assert.deepEqual(records.get('main'),main);
  records.set('main',{data:{portfolios:[1,2]},revision:4});
  assert.equal(await store.keepBeforeUpdate('4.1.0'),false);
  assert.deepEqual(records.get('before-update'),main);
});
test('first launch without records creates no copy',async()=>{
  const records=new Map(),store=new LocalStore(()=>{},d=>d,null);
  store.db=fakeDatabase(records);
  assert.equal(await store.keepBeforeUpdate('4.1.0'),false);
  assert.equal(records.has('before-update'),false);
});
