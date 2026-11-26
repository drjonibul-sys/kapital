import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('standalone HTML contains self-contained code and no synchronization or API requests',async()=>{
  const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,2);
  for(const script of scripts){new vm.Script(script[1]);assert.doesNotMatch(script[1],/^import /m);assert.doesNotMatch(script[1],/fetch\(|XMLHttpRequest|\/api\/|access-token|синхронизир/i);}
  assert.ok(html.indexOf('window.kapitalTheme=createThemeController(window)')<html.indexOf('<style>'));
  assert.match(html,/Как на устройстве/);
  assert.match(html,/IndexedDB|indexedDB/);
  assert.match(html,/Казахстанский тенге/);
  assert.doesNotMatch(scripts.map(script=>script[1]).join('\n'),/Notification\.|PushManager|BEGIN:VALARM|text\/calendar|calendarFile|data-form="reminder"|обычной вкладке Safari/);
  assert.match(html,/Firefox/);
  assert.match(html,/conic-gradient/);
  assert.match(html,/Приобретение актива/);
});
