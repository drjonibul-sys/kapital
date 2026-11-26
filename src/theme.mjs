export function createThemeController(environment){
  const key='kapital.theme',valid=value=>['light','dark','system'].includes(value);
  const root=environment.document.documentElement,meta=environment.document.querySelector('meta[name="theme-color"]');
  const media=environment.matchMedia?.('(prefers-color-scheme: dark)');
  const listeners=new Set();let preference='system',resolved='light',persistent=true;
  function readPreference(){try{const value=environment.localStorage.getItem(key);persistent=true;return valid(value)?value:'system';}catch{persistent=false;return 'system';}}
  function state(){return{preference,resolved,persistent};}
  function apply(){resolved=preference==='system'?(media?.matches?'dark':'light'):preference;root.dataset.theme=resolved;root.style.colorScheme=resolved;meta?.setAttribute('content',resolved==='dark'?'#0b1120':'#f3f6ff');for(const listener of listeners)listener(state());}
  preference=readPreference();apply();
  const onSystemChange=()=>{if(preference==='system')apply();};
  if(media?.addEventListener)media.addEventListener('change',onSystemChange);else media?.addListener?.(onSystemChange);
  environment.addEventListener?.('storage',event=>{if((event.key===key||event.key===null)&&(!event.storageArea||event.storageArea===environment.localStorage)){preference=readPreference();apply();}});
  return{
    getState:state,
    setPreference(value){if(!valid(value))throw new Error('Неизвестное оформление.');preference=value;try{environment.localStorage.setItem(key,value);persistent=true;}catch{persistent=false;}apply();return state();},
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}
  };
}
