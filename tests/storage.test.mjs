import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalStore} from '../src/storage.mjs';
test('unavailable browser storage fails explicitly instead of pretending to save',async()=>{
  const storage=new LocalStore(()=>{},data=>data,null);
  await assert.rejects(storage.open(),/Хранилище браузера недоступно/);
});
