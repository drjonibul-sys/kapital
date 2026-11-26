export const currencies={KZT:{symbol:'₸',name:'Казахстанский тенге'},USD:{symbol:'$',name:'Доллар США'},RUB:{symbol:'₽',name:'Российский рубль'}};
export const assetTypes={stock:{name:'Акции',single:'Акция',color:'var(--chart-equity)'},bond:{name:'Облигации',single:'Облигация',color:'var(--chart-bond)'},fund:{name:'Фонды',single:'Фонд',color:'var(--chart-fund)'}};
export const assetClasses={equity:{name:'Долевые активы',color:'var(--chart-equity)'},fixedIncome:{name:'Долговые активы',color:'var(--chart-bond)'},cash:{name:'Денежный рынок',color:'var(--chart-cash)'},commodity:{name:'Сырьё и драгметаллы',color:'var(--chart-commodity)'},realEstate:{name:'Недвижимость',color:'var(--chart-realEstate)'},mixed:{name:'Смешанные активы',color:'var(--chart-mixed)'},other:{name:'Прочие активы',color:'var(--chart-other)'}};
export const MAX_MINOR=9_000_000_000_000,UNIT_SCALE=1_000_000,MAX_UNITS=9_000_000_000_000;
export function allowedClasses(type){return type==='stock'?['equity']:type==='bond'?['fixedIncome']:Object.keys(assetClasses);}
function parseScaled(text,digits,maximum){const raw=String(text).replace(/\s/g,'').replace(',','.');if(!new RegExp('^[0-9]+(?:\\.[0-9]{1,'+digits+'})?$').test(raw))throw new Error('Введите положительное число: не более '+digits+' знаков после запятой.');const[whole,fraction='']=raw.split('.');const result=BigInt(whole)*10n**BigInt(digits)+BigInt(fraction.padEnd(digits,'0'));if(result>BigInt(maximum))throw new Error('Значение слишком велико.');return Number(result);}
export const parseMinor=text=>parseScaled(text,2,MAX_MINOR);
export const parseUnits=text=>parseScaled(text,6,MAX_UNITS);
export const formatMoney=(n,c)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c,currencyDisplay:'narrowSymbol',minimumFractionDigits:0,maximumFractionDigits:2}).format(n/100);
export const formatUnits=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(n/UNIT_SCALE);
export function positionValue(units,price){if(!Number.isSafeInteger(units)||units<0||!Number.isSafeInteger(price)||price<0)throw new Error('Неверное количество или цена.');const amount=(BigInt(units)*BigInt(price)+500000n)/1000000n;if(amount>BigInt(MAX_MINOR))throw new Error('Стоимость актива слишком велика.');return Number(amount);}
export const emptyData=()=>({schemaVersion:4,portfolios:[],operations:[],assets:[],purchases:[]});
export const assetValue=a=>a.valuationMinor??positionValue(a.quantityUnits,a.priceMinor);
export const valuationAdjustment=p=>p.valuationAdjustmentMinor||0;
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
const validID=s=>typeof s==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(s);
const validMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX_MINOR;
const validText=(s,max)=>typeof s==='string'&&s.length<=max;
export function totalsFor(data,id){const p=data.portfolios.find(p=>p.id===id);if(!p)throw new Error('Портфель не найден.');let deposits=0,withdrawals=0;for(const o of data.operations.filter(o=>o.portfolioId===id)){if(o.type==='deposit')deposits+=o.amountMinor;else withdrawals+=o.amountMinor;}return{deposits,withdrawals,profit:p.valueMinor-p.initialMinor-deposits+withdrawals};}
export function totalsByCurrency(data){return Object.keys(currencies).map(currency=>({currency,valueMinor:data.portfolios.filter(p=>p.currency===currency).reduce((s,p)=>s+p.valueMinor,0)})).filter(t=>data.portfolios.some(p=>p.currency===t.currency));}
export function assetCost(data,id){return data.purchases.filter(t=>t.assetId===id).reduce((s,t)=>s+positionValue(t.quantityUnits,t.priceMinor)+t.feeMinor,data.assets.find(a=>a.id===id)?.openingValueMinor||0);}
export function recalculate(data,id){const p=data.portfolios.find(p=>p.id===id);if(!p)throw new Error('Портфель не найден.');const value=p.cashMinor+valuationAdjustment(p)+data.assets.filter(a=>a.portfolioId===id).reduce((s,a)=>s+assetValue(a),0);if(!validMoney(value))throw new Error('Общая стоимость портфеля слишком велика.');p.valueMinor=value;return data;}
export function validateData(data){
  const check=(value,message='Неверный формат данных или превышен лимит записей.')=>{if(!value)throw new Error(message);};
  check(data&&data.schemaVersion===4&&Array.isArray(data.portfolios)&&Array.isArray(data.operations)&&Array.isArray(data.assets)&&Array.isArray(data.purchases));
  check(data.portfolios.length<=100&&data.operations.length<=50000&&data.assets.length<=5000&&data.purchases.length<=50000);
  const ids=new Set();for(const p of data.portfolios){check(p&&validID(p.id)&&!ids.has(p.id)&&validText(p.name,60)&&p.name.trim()&&Object.hasOwn(currencies,p.currency)&&validMoney(p.initialMinor)&&validMoney(p.valueMinor)&&validMoney(p.cashMinor)&&['cash','unallocated'].includes(p.balanceKind));if(p.snapshotDate!==undefined){check(validDate(p.snapshotDate),'Неверная дата снимка.');}
  if(p.cashBreakdown!==undefined){check(p.snapshotDate&&Array.isArray(p.cashBreakdown)&&p.cashBreakdown.length<=3);const seen=new Set();for(const c of p.cashBreakdown){check(c&&Object.hasOwn(currencies,c.currency)&&!seen.has(c.currency)&&validMoney(c.amountMinor)&&validMoney(c.valueMinor));seen.add(c.currency);}}
  if(p.valuationAdjustmentMinor!==undefined)check(p.snapshotDate&&Number.isSafeInteger(p.valuationAdjustmentMinor)&&Math.abs(p.valuationAdjustmentMinor)<=MAX_MINOR,'Неверная корректировка оценки.');
  if(p.cashBreakdown!==undefined)check(p.cashBreakdown.reduce((s,c)=>s+c.valueMinor,0)===p.cashMinor,'Валютные остатки не совпадают с денежным итогом.');
  ids.add(p.id);}
  const opIDs=new Set();for(const o of data.operations){check(o&&validID(o.id)&&!opIDs.has(o.id)&&ids.has(o.portfolioId)&&['deposit','withdrawal'].includes(o.type)&&validMoney(o.amountMinor)&&o.amountMinor>0&&validDate(o.date)&&validText(o.note,500));opIDs.add(o.id);}
  const assets=new Map();for(const a of data.assets){check(a&&validID(a.id)&&!assets.has(a.id)&&ids.has(a.portfolioId)&&validText(a.name,100)&&a.name.trim()&&validText(a.ticker,32)&&Object.hasOwn(assetTypes,a.type)&&allowedClasses(a.type).includes(a.assetClass)&&Number.isSafeInteger(a.quantityUnits)&&a.quantityUnits>0&&a.quantityUnits<=MAX_UNITS&&validMoney(a.priceMinor));if(a.openingQuantityUnits!==undefined){const p=data.portfolios.find(p=>p.id===a.portfolioId);check(p.snapshotDate&&Number.isSafeInteger(a.openingQuantityUnits)&&a.openingQuantityUnits>0&&a.openingQuantityUnits<=a.quantityUnits&&validMoney(a.openingValueMinor),'Неверные начальные остатки.');}
  else check(a.openingValueMinor===undefined,'Оценка начального остатка без количества.');
  if(a.valuationMinor!==undefined)check(a.openingQuantityUnits!==undefined&&validMoney(a.valuationMinor),'Неверная оценка снимка.');
  assets.set(a.id,a);}
  const tradeIDs=new Set(),quantities=new Map(),costs=new Map();for(const t of data.purchases){const a=assets.get(t?.assetId);check(t&&validID(t.id)&&!tradeIDs.has(t.id)&&a&&a.portfolioId===t.portfolioId&&Number.isSafeInteger(t.quantityUnits)&&t.quantityUnits>0&&t.quantityUnits<=MAX_UNITS&&validMoney(t.priceMinor)&&t.priceMinor>0&&validMoney(t.feeMinor)&&validDate(t.date)&&validText(t.note,500));tradeIDs.add(t.id);quantities.set(a.id,(quantities.get(a.id)||0)+t.quantityUnits);costs.set(a.id,(costs.get(a.id)||0)+positionValue(t.quantityUnits,t.priceMinor)+t.feeMinor);}
  for(const a of assets.values()){check((quantities.get(a.id)||0)+(a.openingQuantityUnits||0)===a.quantityUnits,'Количество актива не соответствует истории покупок.');check(Number.isSafeInteger(costs.get(a.id)||0));assetValue(a);positionValue(a.quantityUnits,a.priceMinor);}
  for(const p of data.portfolios){const total=p.cashMinor+valuationAdjustment(p)+data.assets.filter(a=>a.portfolioId===p.id).reduce((s,a)=>s+assetValue(a),0);check(total===p.valueMinor,'Стоимость портфеля не совпадает с составом.');const t=totalsFor(data,p.id);check([t.deposits,t.withdrawals,t.profit].every(Number.isSafeInteger));}
  return data;
}
export function normalizeData(input){
  const data=structuredClone(input);
  if(data?.schemaVersion===1){
    if(!Array.isArray(data.portfolios)||!Array.isArray(data.operations)||data.portfolios.some(p=>!validMoney(p.valueMinor)))throw new Error('Повреждена копия прежней версии.');
    data.schemaVersion=3;data.assets=[];data.purchases=[];
    data.portfolios=data.portfolios.map(p=>({...p,cashMinor:p.valueMinor,balanceKind:p.valueMinor>0?'unallocated':'cash'}));
    if(Array.isArray(data.reminders))data.archivedPlans=data.reminders;delete data.reminders;
  }
  if(data?.schemaVersion===3)data.schemaVersion=4;
  return validateData(data);
}
export function applyOperation(source,operation){const data=structuredClone(source),p=data.portfolios.find(p=>p.id===operation.portfolioId);if(!p)throw new Error('Портфель не найден.');if(!['deposit','withdrawal'].includes(operation.type)||!validMoney(operation.amountMinor)||operation.amountMinor===0)throw new Error('Введите сумму операции больше нуля.');if(data.operations.some(o=>o.id===operation.id))throw new Error('Операция уже записана.');delete p.cashBreakdown;p.cashMinor+=operation.type==='deposit'?operation.amountMinor:-operation.amountMinor;if(p.cashMinor<0)throw new Error('Недостаточно свободного остатка для вывода.');data.operations.push(operation);recalculate(data,p.id);return validateData(data);}
export function addPurchase(source,input){
  const data=structuredClone(source),p=data.portfolios.find(p=>p.id===input.portfolioId);if(!p)throw new Error('Портфель не найден.');
  if(data.purchases.some(t=>t.id===input.id))throw new Error('Покупка уже записана.');
  if(!Number.isSafeInteger(input.quantityUnits)||input.quantityUnits<=0||input.quantityUnits>MAX_UNITS||!validMoney(input.priceMinor)||input.priceMinor===0||!validMoney(input.feeMinor))throw new Error('Введите количество и цену больше нуля, комиссию — не меньше нуля.');
  const cost=positionValue(input.quantityUnits,input.priceMinor)+input.feeMinor;if(!Number.isSafeInteger(cost)||cost>p.cashMinor)throw new Error('Недостаточно свободного остатка. Сначала запишите пополнение портфеля.');
  let asset=data.assets.find(a=>a.id===input.assetId);
  if(!asset){if(!input.asset||input.asset.id!==input.assetId)throw new Error('Укажите приобретаемый актив.');const identity=(input.asset.ticker||input.asset.name).trim().toUpperCase();if(data.assets.some(a=>a.portfolioId===p.id&&a.type===input.asset.type&&(a.ticker||a.name).trim().toUpperCase()===identity))throw new Error('Такой актив уже есть. Выберите его в списке существующих активов.');asset={...input.asset,portfolioId:p.id,quantityUnits:0,priceMinor:input.priceMinor};data.assets.push(asset);}
  if(asset.portfolioId!==p.id)throw new Error('Актив относится к другому портфелю.');
  if(asset.valuationMinor!==undefined)throw new Error('Перед докупкой обновите текущую цену актива из снимка.');
  asset.quantityUnits+=input.quantityUnits;p.cashMinor-=cost;delete p.cashBreakdown;
  const{id,portfolioId,assetId,quantityUnits,priceMinor,feeMinor,date,note}=input;data.purchases.push({id,portfolioId,assetId,quantityUnits,priceMinor,feeMinor,date,note});
  recalculate(data,p.id);return validateData(data);
}
export function updateAsset(source,id,changes){const data=structuredClone(source),a=data.assets.find(a=>a.id===id);if(!a)throw new Error('Актив не найден.');for(const field of ['name','ticker','type','assetClass','priceMinor'])if(Object.hasOwn(changes,field))a[field]=changes[field];if(Object.hasOwn(changes,'priceMinor')&&changes.revalue===true)delete a.valuationMinor;recalculate(data,a.portfolioId);return validateData(data);}
export function revaluePortfolio(source,id,value){const data=structuredClone(source),p=data.portfolios.find(p=>p.id===id);if(!p)throw new Error('Портфель не найден.');if(data.assets.some(a=>a.portfolioId===id))throw new Error('Для портфеля с активами обновляйте текущие цены инструментов.');p.cashMinor=value;recalculate(data,id);return validateData(data);}
export function composition(data,id,group='type'){
  const p=data.portfolios.find(p=>p.id===id);if(!p)throw new Error('Портфель не найден.');const buckets=new Map();
  for(const a of data.assets.filter(a=>a.portfolioId===id)){const key=group==='class'?a.assetClass:a.type,meta=group==='class'?assetClasses[key]:assetTypes[key];const old=buckets.get(key)||{key,name:meta.name,color:meta.color,valueMinor:0};old.valueMinor+=assetValue(a);buckets.set(key,old);}
  if(p.cashMinor){const key=p.balanceKind==='unallocated'?'unallocated':'cash';const meta={key,name:key==='cash'?'Свободные средства':'Нераспределённый остаток',color:key==='cash'?'var(--chart-cash)':'var(--chart-unallocated)',valueMinor:p.cashMinor};if(group==='class'&&key==='cash'&&buckets.has('cash')){buckets.get('cash').valueMinor+=p.cashMinor;buckets.get('cash').name='Денежный рынок и остаток';}else buckets.set(key,meta);}
  const result=[...buckets.values()].filter(b=>b.valueMinor>0).sort((a,b)=>b.valueMinor-a.valueMinor);if(!p.valueMinor)return[];
  const denominator=BigInt(result.reduce((s,b)=>s+b.valueMinor,0));let assigned=0;const fractions=[];for(const[i,b]of result.entries()){const product=BigInt(b.valueMinor)*1000n;b.percentTenths=Number(product/denominator);assigned+=b.percentTenths;fractions.push({i,remainder:product%denominator});}
  fractions.sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);for(let i=0;i<1000-assigned;i++)result[fractions[i].i].percentTenths++;return result;
}
