import test from 'node:test';
import assert from 'node:assert/strict';
import {createThemeController} from '../src/theme.mjs';
function browser({saved=null,dark=false,blocked=false}={}){
  const values=new Map(saved===null?[]:[['kapital.theme',saved]]),events={},media={matches:dark,addEventListener(name,callback){this.change=callback;}};
  const document={documentElement:{dataset:{},style:{}},meta:'',querySelector(){return{setAttribute:(name,value)=>document.meta=value};}};
  const env={document,matchMedia:()=>media,localStorage:{getItem:key=>{if(blocked)throw Error('Unavailable');return values.get(key)||null;},setItem:(key,value)=>{if(blocked)throw Error('Unavailable');values.set(key,value);}},addEventListener:(name,callback)=>events[name]=callback};
  return{env,media,values,events,root:document.documentElement};
}
test('system theme applies before rendering and follows live device changes',()=>{const b=browser({dark:true}),theme=createThemeController(b.env);assert.equal(b.root.dataset.theme,'dark');assert.equal(b.env.document.meta,'#0b1120');assert.equal(theme.getState().preference,'system');b.media.matches=false;b.media.change();assert.equal(b.root.dataset.theme,'light');assert.equal(b.root.style.colorScheme,'light');assert.equal(b.env.document.meta,'#f3f6ff');});
test('manual theme survives reload and overrides system changes until system is selected',()=>{const b=browser({dark:true}),theme=createThemeController(b.env);theme.setPreference('light');b.media.change();assert.equal(b.root.dataset.theme,'light');assert.equal(createThemeController(b.env).getState().preference,'light');theme.setPreference('system');assert.equal(b.root.dataset.theme,'dark');assert.equal(b.values.get('kapital.theme'),'system');});
test('theme choice works when saving is blocked and invalid stored preferences fall back safely',()=>{const b=browser({blocked:true}),theme=createThemeController(b.env);assert.equal(theme.setPreference('dark').persistent,false);assert.equal(b.root.dataset.theme,'dark');assert.equal(createThemeController(browser({saved:'unknown',dark:true}).env).getState().resolved,'dark');});
test('preference changes in another tab update subscribers without writing financial data',()=>{const b=browser(),theme=createThemeController(b.env),updates=[];theme.subscribe(state=>updates.push(state.resolved));b.values.set('kapital.theme','dark');b.events.storage({key:'kapital.theme',storageArea:b.env.localStorage});assert.deepEqual(updates,['dark']);assert.equal(b.root.dataset.theme,'dark');b.events.storage({key:'unrelated'});assert.equal(updates.length,1);});
