import {normalizeData,parseMinor,parseUnits,positionValue,assetTypes,assetClasses,allowedClasses,MAX_MINOR,MAX_UNITS} from './portfolio.mjs';

export const ledgerCurrencies={KZT:{name:'Казахстанский тенге',symbol:'₸'},USD:{name:'Доллар США',symbol:'$'},RUB:{name:'Российский рубль',symbol:'₽'},GBP:{name:'Фунт стерлингов',symbol:'£'}};
export const entryNames={deposit:'Пополнение',withdrawal:'Вывод',buy:'Покупка',sell:'Продажа',dividend:'Дивиденды',coupon:'Купон',redemption:'Погашение',fx:'Конвертация',fee:'Комиссия / сбор'};
export const couponPeriods={1:'Ежемесячно',3:'Ежеквартально',6:'Раз в полугодие',12:'Ежегодно'};
export const ledgerToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const ledgerId=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,13);
export const emptyLedger=()=>({schemaVersion:5,portfolios:[],assets:[],entries:[],issuers:[]});
const lMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX_MINOR;
const lSigned=n=>Number.isSafeInteger(n)&&Math.abs(n)<=MAX_MINOR;
const lText=(s,n)=>typeof s==='string'&&s.length<=n;
const lID=s=>typeof s==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(s);
const lCurrency=s=>Object.hasOwn(ledgerCurrencies,s);
export const ledgerDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function signedMinor(text){const value=String(text).trim();return value.startsWith('-')?-parseMinor(value.slice(1)):parseMinor(value.replace(/^\+/,''));}
export function roundedRatio(numerator,denominator){if(!denominator)throw new Error('Деление на ноль.');const n=BigInt(numerator),d=BigInt(denominator),sign=n<0n?-1n:1n;const value=sign*((n*sign+d/2n)/d);if(value>BigInt(MAX_MINOR)||value<-BigInt(MAX_MINOR))throw new Error('Превышен допустимый размер суммы.');return Number(value);}
export function canonicalValue(value){if(Array.isArray(value))return '['+value.map(canonicalValue).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonicalValue(value[k])).join(',')+'}';return JSON.stringify(value);}
function requireLedger(ok,message='Данные содержат ошибку.'){if(!ok)throw new Error(message);}
function checkMoneyMap(map){requireLedger(map&&typeof map==='object'&&!Array.isArray(map));for(const [c,n] of Object.entries(map))requireLedger(lCurrency(c)&&lSigned(n),'Неверные валютные остатки.');}
export function validateLedger(data){
  requireLedger(data?.schemaVersion===5&&['portfolios','assets','entries','issuers'].every(k=>Array.isArray(data[k])),'Неизвестный формат учёта.');
  requireLedger(data.portfolios.length<=100&&data.assets.length<=5000&&data.entries.length<=100000&&data.issuers.length<=5000,'Превышен лимит записей.');
  const portfolios=new Set(),assets=new Map(),entries=new Set(),issuers=new Set();
  for(const p of data.portfolios){requireLedger(p&&lID(p.id)&&!portfolios.has(p.id)&&lText(p.name,60)&&p.name.trim()&&lCurrency(p.currency),'Неверные данные портфеля.');checkMoneyMap(p.openingCash);checkMoneyMap(p.baselineCapital);checkMoneyMap(p.valuationAdjustments||{});if(p.snapshotDate!==undefined)requireLedger(ledgerDate(p.snapshotDate),'Неверная дата снимка.');portfolios.add(p.id);}
  function checkBond(b){requireLedger(b&&lCurrency(b.currency)&&lMoney(b.couponMinor)&&lMoney(b.nominalMinor)&&Object.hasOwn(couponPeriods,b.periodMonths)&&Number.isFinite(b.couponRate)&&b.couponRate>=0&&b.couponRate<=10000,'Неверные параметры облигации.');for(const k of ['anchorDate','maturityDate'])requireLedger(!b[k]||ledgerDate(b[k]),'Неверная дата купона или погашения.');}
  for(const a of data.assets){requireLedger(a&&lID(a.id)&&!assets.has(a.id)&&portfolios.has(a.portfolioId)&&lText(a.name,100)&&a.name.trim()&&lText(a.ticker,40)&&lText(a.comment||'',500)&&Object.hasOwn(assetTypes,a.type)&&allowedClasses(a.type).includes(a.assetClass)&&lCurrency(a.currency)&&Array.isArray(a.opening)&&a.quotes&&typeof a.quotes==='object','Неверные данные инструмента.');const seen=new Set();for(const o of a.opening){requireLedger(o&&lCurrency(o.currency)&&!seen.has(o.currency)&&Number.isSafeInteger(o.quantityUnits)&&o.quantityUnits>0&&o.quantityUnits<=MAX_UNITS&&lMoney(o.valueMinor)&&(!o.date||ledgerDate(o.date)),'Неверный начальный остаток инструмента.');seen.add(o.currency);}for(const [c,q] of Object.entries(a.quotes)){requireLedger(lCurrency(c)&&q&&lMoney(q.priceMinor)&&(q.valueOverrideMinor===undefined||lMoney(q.valueOverrideMinor)),'Неверная текущая оценка.');if(q.valueOverrideMinor!==undefined)requireLedger(Number.isSafeInteger(q.overrideQuantityUnits)&&q.overrideQuantityUnits>0&&q.overrideQuantityUnits<=MAX_UNITS,'Неверное количество для точной оценки снимка.');}if(a.type==='bond')checkBond(a.bond);if(a.archive)requireLedger(['active','history'].includes(a.archive.mode)&&lText(a.archive.reason,100)&&lText(a.archive.signature,1000000)&&ledgerDate(a.archive.date),'Неверный статус истории.');assets.set(a.id,a);}
  for(const i of data.issuers){requireLedger(i&&lID(i.id)&&!issuers.has(i.id)&&lText(i.ticker,40)&&i.ticker.trim()&&lText(i.name,100),'Неверный эмитент.');checkBond(i.bond);issuers.add(i.id);}
  for(const e of data.entries){requireLedger(e&&lID(e.id)&&!entries.has(e.id)&&portfolios.has(e.portfolioId)&&Object.hasOwn(entryNames,e.kind)&&ledgerDate(e.date)&&lText(e.note||'',500),'Неверная запись журнала.');entries.add(e.id);if(e.externalId!==undefined)requireLedger(lText(e.externalId,200));
    if(e.kind==='fx'){requireLedger(lCurrency(e.fromCurrency)&&lCurrency(e.toCurrency)&&e.fromCurrency!==e.toCurrency&&lMoney(e.fromMinor)&&e.fromMinor>0&&lMoney(e.toMinor)&&e.toMinor>0,'Проверьте обе стороны обмена.');continue;}
    requireLedger(lCurrency(e.currency),'Неизвестная валюта операции.');
    if(['buy','sell','redemption','dividend','coupon'].includes(e.kind)){requireLedger(assets.get(e.assetId)?.portfolioId===e.portfolioId,'Инструмент операции не найден.');}
    if(['buy','sell','redemption'].includes(e.kind)){requireLedger(Number.isSafeInteger(e.quantityUnits)&&e.quantityUnits>0&&e.quantityUnits<=MAX_UNITS&&lMoney(e.priceMinor),'Проверьте количество и цену.');if(e.grossMinor!==undefined)requireLedger(lMoney(e.grossMinor));requireLedger(lMoney(e.feeMinor||0)&&(!e.feeCurrency||lCurrency(e.feeCurrency)));positionValue(e.quantityUnits,e.priceMinor);if(e.profitOverrideMinor!==undefined)requireLedger(e.kind==='sell'&&lSigned(e.profitOverrideMinor),'Неверный ручной результат.');}
    else{requireLedger(lMoney(e.amountMinor)&&e.amountMinor>0,'Введите сумму больше нуля.');if(['dividend','coupon'].includes(e.kind)){requireLedger(lMoney(e.taxMinor||0)&&(e.taxMinor||0)<=e.amountMinor,'Налог не может превышать выплату.');if(e.taxRate!==undefined)requireLedger(Number.isFinite(e.taxRate)&&e.taxRate>=0&&e.taxRate<=100,'Ставка налога должна быть от 0 до 100%.');}}
  }
  return data;
}

export function normalizeLedger(input){
  if(input?.schemaVersion===5)return validateLedger(structuredClone(input));
  const old=normalizeData(input),data=emptyLedger();
  for(const p of old.portfolios){const openingCash=p.cashMinor-old.operations.filter(e=>e.portfolioId===p.id).reduce((s,e)=>s+(e.type==='deposit'?e.amountMinor:-e.amountMinor),0)+old.purchases.filter(e=>e.portfolioId===p.id).reduce((s,e)=>s+positionValue(e.quantityUnits,e.priceMinor)+e.feeMinor,0);
    const next={id:p.id,name:p.name,currency:p.currency,openingCash:{[p.currency]:openingCash},baselineCapital:{[p.currency]:p.initialMinor},valuationAdjustments:{[p.currency]:p.valuationAdjustmentMinor||0}};
    if(p.snapshotDate)next.snapshotDate=p.snapshotDate;
    if(p.cashBreakdown){next.legacyCashBreakdown=structuredClone(p.cashBreakdown);next.legacyReportValue={currency:p.currency,valueMinor:p.valueMinor};next.openingCash[p.currency]-=p.cashMinor;for(const c of p.cashBreakdown){next.openingCash[c.currency]=(next.openingCash[c.currency]||0)+c.amountMinor;if(c.currency!==p.currency){next.baselineCapital[p.currency]-=c.valueMinor;next.baselineCapital[c.currency]=(next.baselineCapital[c.currency]||0)+c.amountMinor;}}}
    if(p.balanceKind==='unallocated'&&p.cashMinor>0)next.unallocatedOpening=true;
    data.portfolios.push(next);
  }
  for(const a of old.assets){const p=old.portfolios.find(p=>p.id===a.portfolioId),next={id:a.id,portfolioId:a.portfolioId,name:a.name,ticker:a.ticker,type:a.type,assetClass:a.assetClass,currency:p.currency,comment:'',opening:[],quotes:{[p.currency]:{priceMinor:a.priceMinor}}};
    if(a.openingQuantityUnits)next.opening.push({currency:p.currency,quantityUnits:a.openingQuantityUnits,valueMinor:a.openingValueMinor,date:p.snapshotDate||ledgerToday(),basis:'snapshot'});
    if(a.valuationMinor!==undefined){next.quotes[p.currency].valueOverrideMinor=a.valuationMinor;next.quotes[p.currency].overrideQuantityUnits=a.quantityUnits;}
    if(a.brokerData)next.brokerData=structuredClone(a.brokerData);
    if(a.type==='bond')next.bond={currency:p.currency,couponMinor:0,nominalMinor:0,couponRate:0,periodMonths:12,anchorDate:'',maturityDate:''};
    data.assets.push(next);
  }
  data.entries=old.operations.map(e=>({id:e.id,portfolioId:e.portfolioId,kind:e.type,currency:old.portfolios.find(p=>p.id===e.portfolioId).currency,amountMinor:e.amountMinor,date:e.date,note:e.note}));
  data.entries.push(...old.purchases.map(e=>({id:e.id,portfolioId:e.portfolioId,assetId:e.assetId,kind:'buy',currency:old.portfolios.find(p=>p.id===e.portfolioId).currency,quantityUnits:e.quantityUnits,priceMinor:e.priceMinor,feeMinor:e.feeMinor,date:e.date,note:e.note})));
  if(old.report)data.report=structuredClone(old.report);if(old.archivedPlans)data.legacyArchivedPlans=structuredClone(old.archivedPlans);
  data.migratedFrom=old.schemaVersion;
  return validateLedger(data);
}

export function defaultTradeCurrency(data,asset){const last=data.entries.map((e,index)=>({...e,index})).filter(e=>e.assetId===asset.id&&['buy','sell','redemption'].includes(e.kind)).sort((a,b)=>b.date.localeCompare(a.date)||b.index-a.index)[0];return last?.currency||asset.opening[0]?.currency||(asset.type==='bond'?(asset.bond?.currency||asset.currency):/\.US$/i.test(asset.ticker)?'USD':/\.KZ$/i.test(asset.ticker)?'KZT':asset.currency||'KZT');}
export function assetSignature(data,id){const asset=data.assets.find(a=>a.id===id);return canonicalValue({opening:asset?.opening||[],trades:data.entries.filter(e=>e.assetId===id&&['buy','sell','redemption'].includes(e.kind))});}
export const entryGross=e=>e.grossMinor??positionValue(e.quantityUnits,e.priceMinor);
function emptyCurrencyView(currency,p){return{currency,cash:p.openingCash[currency]||0,capital:p.baselineCapital[currency]||0,peakCapital:Math.max(0,p.baselineCapital[currency]||0),income:0,fees:0,deposits:0,withdrawals:0,dividends:0,coupons:0,realized:0,marketValue:0,adjustment:p.valuationAdjustments?.[currency]||0,history:[]};}
export function ledgerView(data,portfolioId,asOf=ledgerToday()){
  const p=data.portfolios.find(p=>p.id===portfolioId);if(!p)throw new Error('Портфель не найден.');
  const money=new Map(),positions=new Map(),entryResults=new Map(),warnings=[];
  const ensure=c=>{if(!money.has(c))money.set(c,emptyCurrencyView(c,p));return money.get(c);};
  const portfolioAssets=data.assets.filter(a=>a.portfolioId===p.id);
  for(const c of Object.keys({...p.openingCash,...p.baselineCapital,...p.valuationAdjustments}))ensure(c);
  const getPool=(a,c)=>{const pos=positions.get(a.id);if(!pos.pools.has(c))pos.pools.set(c,{currency:c,quantityUnits:0,costMinor:0,buyFeesMinor:0,totalBoughtMinor:0,totalBoughtUnits:0,soldUnits:0,redeemedUnits:0,proceeds:0,realized:0,income:0,fees:0,firstDate:'',lastDate:'',basis:'trades'});return pos.pools.get(c);};
  const openingEvents=[];for(const a of portfolioAssets){positions.set(a.id,{asset:a,pools:new Map(),history:false,reason:'',warnings:[]});for(const o of a.opening){ensure(o.currency);openingEvents.push({...o,kind:'opening',assetId:a.id,date:o.date||p.snapshotDate||'0001-01-01',_index:-1});}}
  const actual=data.entries.map((e,index)=>({...e,_index:index})).filter(e=>e.portfolioId===portfolioId&&e.date<=asOf);
  const sorted=[...actual,...openingEvents.filter(e=>e.date<=asOf)].sort((a,b)=>a.date.localeCompare(b.date)||(a.order||0)-(b.order||0)||a._index-b._index);
  const startDate=p.snapshotDate||sorted[0]?.date||asOf;
  for(const m of money.values())m.history.push({date:startDate,capital:m.capital,income:0,value:m.capital});
  function point(c,date){const m=ensure(c);const value={date,capital:m.capital,income:m.income,value:m.capital+m.income};if(m.history.at(-1)?.date===date)m.history[m.history.length-1]=value;else m.history.push(value);}
  for(const e of sorted){
    if(e.kind==='opening'){const pool=getPool(positions.get(e.assetId).asset,e.currency);pool.quantityUnits+=e.quantityUnits;pool.costMinor+=e.valueMinor;pool.totalBoughtMinor+=e.valueMinor;pool.totalBoughtUnits+=e.quantityUnits;pool.firstDate=e.date;pool.basis='snapshot';continue;}
    const affected=new Set(),m=e.kind==='fx'?null:ensure(e.currency);if(m)affected.add(e.currency);
    const result={entry:e,cashChanges:{},autoProfitMinor:null,profitMinor:null};
    const cash=(c,amount)=>{const v=ensure(c),before=v.cash;v.cash+=amount;if(before>=0&&v.cash<0)warnings.push({code:'negativeCashAtDate',entryId:e.id,currency:c,date:e.date,message:`На ${e.date} остаток ${c} стал отрицательным. Проверьте начальные остатки и пополнения.`});affected.add(c);result.cashChanges[c]=(result.cashChanges[c]||0)+amount;};
    if(e.kind==='deposit'){cash(e.currency,e.amountMinor);m.capital+=e.amountMinor;m.deposits+=e.amountMinor;}
    if(e.kind==='withdrawal'){cash(e.currency,-e.amountMinor);m.capital-=e.amountMinor;m.withdrawals+=e.amountMinor;}
    if(e.kind==='fee'){cash(e.currency,-e.amountMinor);m.income-=e.amountMinor;m.fees+=e.amountMinor;}
    if(e.kind==='fx'){cash(e.fromCurrency,-e.fromMinor);cash(e.toCurrency,e.toMinor);ensure(e.fromCurrency).capital-=e.fromMinor;ensure(e.toCurrency).capital+=e.toMinor;}
    if(['dividend','coupon'].includes(e.kind)){const net=e.amountMinor-(e.taxMinor||0);cash(e.currency,net);m.income+=net;m[e.kind==='coupon'?'coupons':'dividends']+=net;const pool=getPool(positions.get(e.assetId).asset,e.currency);pool.income+=net;}
    if(['buy','sell','redemption'].includes(e.kind)){
      const pos=positions.get(e.assetId),pool=getPool(pos.asset,e.currency),gross=entryGross(e),fee=e.feeMinor||0,feeCurrency=e.feeCurrency||e.currency,nativeFee=feeCurrency===e.currency?fee:0;
      if(fee){cash(feeCurrency,-fee);ensure(feeCurrency).fees+=fee;ensure(feeCurrency).income-=fee;pool.fees+=nativeFee;}
      if(e.kind==='buy'){cash(e.currency,-gross);pool.quantityUnits+=e.quantityUnits;pool.costMinor+=gross+nativeFee;pool.buyFeesMinor+=nativeFee;pool.totalBoughtMinor+=gross+nativeFee;pool.totalBoughtUnits+=e.quantityUnits;if(!pool.firstDate)pool.firstDate=e.date;}
      else{
        const available=Math.max(0,pool.quantityUnits),used=Math.min(available,e.quantityUnits);
        const allocated=available?roundedRatio(BigInt(pool.costMinor)*BigInt(used),BigInt(available)):0;
        const allocatedFee=available?roundedRatio(BigInt(pool.buyFeesMinor)*BigInt(used),BigInt(available)):0;
        const oversold=e.quantityUnits>available;
        if(oversold){const warning={code:'oversold',entryId:e.id,assetId:e.assetId,currency:e.currency,shortageUnits:e.quantityUnits-available,message:`${pos.asset.ticker||pos.asset.name}: продано/погашено больше остатка на ${e.date}.`};warnings.push(warning);pos.warnings.push(warning);}
        cash(e.currency,gross);pool.costMinor-=allocated;pool.buyFeesMinor-=allocatedFee;pool.quantityUnits-=e.quantityUnits;pool.proceeds+=gross-nativeFee;pool[e.kind==='sell'?'soldUnits':'redeemedUnits']+=e.quantityUnits;
        const auto=oversold?null:gross-nativeFee-allocated,profit=e.profitOverrideMinor??auto;
        result.autoProfitMinor=auto;result.profitMinor=profit;result.allocatedCostMinor=allocated;
        if(profit!==null){pool.realized+=profit;m.realized+=profit;
          // Purchase fees were expensed at purchase; sale fee was expensed just above.
          // Add them back to this flow because both are already inside trade P/L.
          m.income+=profit+allocatedFee+nativeFee;
        }else m.income+=nativeFee;
      }
      pool.lastDate=e.date;
    }
    for(const c of affected){const v=ensure(c);v.peakCapital=Math.max(v.peakCapital,v.capital);point(c,e.date);if(!lSigned(v.cash)||!lSigned(v.income)||!lSigned(v.capital))throw new Error('Суммарное значение превышает допустимый размер.');}
    entryResults.set(e.id,result);
  }
  for(const pos of positions.values()){
    const a=pos.asset,pools=[...pos.pools.values()];
    const hasHolding=pools.some(pool=>pool.quantityUnits!==0),hasTrades=pools.some(pool=>pool.totalBoughtUnits>0);
    const archive=a.archive&&a.archive.signature===assetSignature(data,a.id)?a.archive:null;
    const automatic=!hasHolding&&hasTrades&&!pos.warnings.length;
    pos.history=archive?archive.mode==='history':automatic;
    const sold=pools.some(pool=>pool.soldUnits>0),redeemed=pools.some(pool=>pool.redeemedUnits>0);
    pos.reason=archive?.reason||(redeemed?(sold?'Продано и погашено':'Погашено'):'Продано полностью');
    for(const pool of pools){const quote=a.quotes[pool.currency];pool.averagePriceMinor=pool.quantityUnits>0?roundedRatio(BigInt(pool.costMinor)*1000000n,BigInt(pool.quantityUnits)):0;pool.marketValue=pool.quantityUnits>0?(quote?.valueOverrideMinor!==undefined?roundedRatio(BigInt(quote.valueOverrideMinor)*BigInt(pool.quantityUnits),BigInt(quote.overrideQuantityUnits||pool.quantityUnits)):(quote?positionValue(pool.quantityUnits,quote.priceMinor):pool.costMinor-pool.buyFeesMinor)):0;ensure(pool.currency).marketValue+=pool.marketValue;}
  }
  for(const m of money.values()){m.value=m.cash+m.marketValue+m.adjustment;m.profit=m.value-m.capital;m.returnPercent=m.peakCapital>0?m.income/m.peakCapital*100:null;if(m.cash<0)warnings.push({code:'negativeCash',currency:m.currency,message:`Денежный остаток ${m.currency} отрицательный. Проверьте операции.`});}
  return{portfolio:p,currencies:money,positions,entryResults,warnings,entries:sorted.filter(e=>e.kind!=='opening')};
}

export function mutateEntry(source,entry,{allowInconsistent=false}={}){
  const data=structuredClone(source),index=data.entries.findIndex(e=>e.id===entry.id);
  const p=data.portfolios.find(p=>p.id===entry.portfolioId);if(p?.snapshotDate&&entry.date<p.snapshotDate)throw new Error('Дата операции предшествует начальным остаткам. Для более ранней истории создайте отдельный портфель.');
  if(index<0)data.entries.push(entry);else data.entries[index]=entry;
  validateLedger(data);const result=ledgerView(data,entry.portfolioId,'9999-12-31');
  const previous=new Map(ledgerView(source,entry.portfolioId,'9999-12-31').warnings.filter(w=>w.code==='oversold').map(w=>[w.entryId,w.shortageUnits]));
  const newOversold=result.warnings.filter(w=>w.code==='oversold'&&w.shortageUnits>(previous.get(w.entryId)||0));
  if(newOversold.length&&!allowInconsistent)throw Object.assign(new Error(newOversold[0].message+' Изменение не сохранено.'),{code:'HOLDING',warnings:newOversold});
  return data;
}
export function removeEntry(source,id,{allowInconsistent=false}={}){const data=structuredClone(source),entry=data.entries.find(e=>e.id===id);if(!entry)throw new Error('Операция не найдена.');data.entries=data.entries.filter(e=>e.id!==id);const view=ledgerView(data,entry.portfolioId,'9999-12-31'),before=new Map(ledgerView(source,entry.portfolioId,'9999-12-31').warnings.filter(w=>w.code==='oversold').map(w=>[w.entryId,w.shortageUnits]));if(!allowInconsistent&&view.warnings.some(w=>w.code==='oversold'&&w.shortageUnits>(before.get(w.entryId)||0)))throw Object.assign(new Error('Удаление нарушит остатки последующих продаж.'),{code:'HOLDING',warnings:view.warnings});return validateLedger(data);}
export function setAssetHistory(source,id,mode,reason){const data=structuredClone(source),a=data.assets.find(a=>a.id===id);if(!a)throw new Error('Инструмент не найден.');a.archive={mode,reason,signature:assetSignature(data,id),date:ledgerToday()};return validateLedger(data);}
export function purgeAsset(source,id){const data=structuredClone(source);data.assets=data.assets.filter(a=>a.id!==id);data.entries=data.entries.filter(e=>e.assetId!==id);return validateLedger(data);}
export function removePortfolio(source,id){const data=structuredClone(source);data.portfolios=data.portfolios.filter(p=>p.id!==id);data.assets=data.assets.filter(a=>a.portfolioId!==id);data.entries=data.entries.filter(e=>e.portfolioId!==id);return validateLedger(data);}
export function setQuote(source,id,currency,priceMinor){const data=structuredClone(source),a=data.assets.find(a=>a.id===id);if(!a)throw new Error('Инструмент не найден.');a.quotes[currency]={priceMinor};return validateLedger(data);}
export function monthDate(anchor,offset){if(!ledgerDate(anchor))return '';const [year,month,day]=anchor.split('-').map(Number),target=new Date(Date.UTC(year,month-1+offset,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();return `${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;}
export function couponDates(bond,start,end){if(!bond?.anchorDate||!ledgerDate(start)||!ledgerDate(end)||start>end)return[];const diff=(Number(start.slice(0,4))-Number(bond.anchorDate.slice(0,4)))*12+Number(start.slice(5,7))-Number(bond.anchorDate.slice(5,7));let k=Math.floor(diff/bond.periodMonths)-1;const result=[];for(let guard=0;guard<2400;guard++,k++){const date=monthDate(bond.anchorDate,k*bond.periodMonths);if(date>end||bond.maturityDate&&date>bond.maturityDate)break;if(date>=start)result.push(date);}return result;}
export function quantityAt(data,asset,currency,date){let qty=asset.opening.filter(o=>o.currency===currency&&(!o.date||o.date<=date)).reduce((s,o)=>s+o.quantityUnits,0);for(const e of data.entries){if(e.assetId!==asset.id||e.currency!==currency||e.date>date)continue;if(e.kind==='buy')qty+=e.quantityUnits;else if(['sell','redemption'].includes(e.kind))qty-=e.quantityUnits;}return Math.max(0,qty);}
export function forecastCoupons(data,portfolioId,start,end){const result=[];for(const a of data.assets.filter(a=>a.portfolioId===portfolioId&&a.type==='bond')){const b=a.bond;if(!b.couponMinor)continue;for(const date of couponDates(b,start,end)){const qty=quantityAt(data,a,b.currency,date);if(!qty)continue;const expected=positionValue(qty,b.couponMinor);const confirmed=data.entries.filter(e=>e.assetId===a.id&&e.kind==='coupon'&&e.currency===b.currency&&(e.scheduledDate||e.date)===date).reduce((s,e)=>s+e.amountMinor,0);if(expected>confirmed)result.push({assetId:a.id,ticker:a.ticker,date,currency:b.currency,quantityUnits:qty,amountMinor:expected-confirmed});}}return result.sort((a,b)=>a.date.localeCompare(b.date));}
export function nextCouponDate(bond,after){return couponDates(bond,after,monthDate(after,24)).find(date=>date>=after)||'';}
export function bondCouponYield(pool,bond){if(!pool||pool.quantityUnits<=0||!pool.costMinor||!bond?.couponMinor||pool.currency!==bond.currency)return null;return positionValue(pool.quantityUnits,bond.couponMinor)*(12/bond.periodMonths)/pool.costMinor*100;}
export function bondYearlyForecast(data,asset,asOf=ledgerToday()){
  if(asset.type!=='bond')return[];const bond=asset.bond,currency=bond.currency,entries=data.entries.filter(e=>e.assetId===asset.id&&e.currency===currency),dates=[...asset.opening.map(o=>o.date),...entries.filter(e=>e.kind==='buy').map(e=>e.date)].filter(Boolean).sort();if(!dates.length)return[];
  const firstYear=Number(dates[0].slice(0,4)),lastYear=Math.min(firstYear+99,Number((bond.maturityDate||asOf).slice(0,4))),full=ledgerView(data,asset.portfolioId,'9999-12-31');
  const changes=[...asset.opening.filter(o=>o.currency===currency).map(o=>({date:o.date||dates[0],amount:o.valueMinor,order:-1})),...entries.filter(e=>['buy','sell','redemption'].includes(e.kind)).map((e,index)=>({date:e.date,order:index,amount:e.kind==='buy'?entryGross(e)+((e.feeCurrency||e.currency)===currency?(e.feeMinor||0):0):-(full.entryResults.get(e.id)?.allocatedCostMinor||0)}))].sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order);
  const day=s=>Math.floor(Date.parse(s+'T12:00:00Z')/86400000),result=[];
  for(let year=firstYear;year<=lastYear;year++){const start=`${year}-01-01`,end=bond.maturityDate&&bond.maturityDate<`${year}-12-31`?bond.maturityDate:`${year}-12-31`,startDay=day(start),endDay=day(end)+1,daysInYear=day(`${year+1}-01-01`)-startDay;let cost=0,cursor=startDay,exposure=0;for(const change of changes){const eventDay=day(change.date);if(eventDay<startDay){cost+=change.amount;continue;}if(eventDay>=endDay)break;exposure+=Math.max(0,cost)*(eventDay-cursor);cost+=change.amount;cursor=eventDay;}exposure+=Math.max(0,cost)*(endDay-cursor);
    const expected=couponDates(bond,start,end).reduce((sum,date)=>sum+positionValue(quantityAt(data,asset,currency,date),bond.couponMinor),0),confirmed=entries.filter(e=>e.kind==='coupon'&&e.date>=start&&e.date<=end&&e.date<=asOf).reduce((sum,e)=>sum+e.amountMinor-(e.taxMinor||0),0),pending=forecastCoupons(data,asset.portfolioId,start,end).filter(c=>c.assetId===asset.id).reduce((sum,c)=>sum+c.amountMinor,0);
    result.push({year,currency,expectedMinor:expected,confirmedMinor:confirmed,pendingMinor:pending,annualPercent:exposure>0&&expected>0?expected*daysInYear/exposure*100:null});
  }
  return result;
}
export function compositionLedger(view,currency,group='type'){
  const buckets=new Map(),amount=view.currencies.get(currency);if(!amount)return[];
  for(const pos of view.positions.values()){const pool=pos.pools.get(currency);if(!pool||pool.marketValue<=0)continue;const key=group==='class'?pos.asset.assetClass:pos.asset.type,meta=group==='class'?assetClasses[key]:assetTypes[key];const bucket=buckets.get(key)||{key,name:meta.name,color:meta.color,value:0};bucket.value+=pool.marketValue;buckets.set(key,bucket);}
  if(amount.cash>0){const prior=buckets.get('cash')||{key:'cash',name:'Свободные средства',color:'var(--chart-cash)',value:0};prior.value+=amount.cash;buckets.set('cash',prior);}
  const parts=[...buckets.values()].sort((a,b)=>b.value-a.value),total=parts.reduce((s,b)=>s+b.value,0);if(!total)return[];
  let assigned=0;const remainders=[];parts.forEach((b,i)=>{const n=BigInt(b.value)*1000n;b.percentTenths=Number(n/BigInt(total));assigned+=b.percentTenths;remainders.push({i,value:n%BigInt(total)});});remainders.sort((a,b)=>a.value===b.value?a.i-b.i:a.value>b.value?-1:1);for(let i=0;i<1000-assigned;i++)parts[remainders[i].i].percentTenths++;return parts;
}
