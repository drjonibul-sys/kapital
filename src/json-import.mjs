import {normalizeData,totalsByCurrency} from './portfolio.mjs';
export const MAX_JSON_BYTES=12*1024*1024;
export function parseBackupJSON(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_JSON_BYTES)throw new Error('JSON должен быть не больше 12 МБ.');
  let source=text.replace(/^\uFEFF/,'').trim();
  if(!source)throw new Error('Выберите JSON-файл или вставьте текст резервной копии.');
  const fenced=source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fenced)source=fenced[1];
  let parsed;try{parsed=JSON.parse(source);}catch{throw new Error('Некорректный JSON. Проверьте кавычки, запятые и скобки. Текущие записи не изменены.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Ожидается объект резервной копии «Капитал», а не список или отдельное значение.');
  const payload=parsed.schemaVersion!==undefined?parsed:parsed.data;
  if(!payload||typeof payload!=='object'||![1,3,4].includes(payload.schemaVersion))throw new Error('Формат не распознан. Поддерживается JSON из «Капитал» версий 1–4, в том числе объект с полем data.');
  let data;try{data=normalizeData(payload);}catch(error){throw new Error('Копия содержит ошибки: '+error.message+' Текущие записи не изменены.');}
  return{data,legacy:payload.schemaVersion===1,summary:backupSummary(data)};
}
export function backupSummary(data){return{portfolios:data.portfolios.length,assets:data.assets.length,operations:data.operations.length,purchases:data.purchases.length,balances:totalsByCurrency(data),items:data.portfolios.map(p=>({name:p.name,currency:p.currency,valueMinor:p.valueMinor,snapshotDate:p.snapshotDate,assets:data.assets.filter(a=>a.portfolioId===p.id).length}))};}
