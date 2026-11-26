import {parseMinor,parseUnits,positionValue,assetTypes,assetClasses,allowedClasses} from './portfolio.mjs';
import {emptyLedger,normalizeLedger,validateLedger,ledgerId,ledgerToday,ledgerDate,ledgerView,defaultTradeCurrency,canonicalValue,ledgerCurrencies,assetSignature} from './ledger.mjs';

export const LEDGER_MAX_BYTES=12*1024*1024;
const importKey=s=>String(s).toLowerCase().replace(/ё/g,'е').replace(/[\s_\-./()%]/g,'');
function readField(row,...names){for(const name of names){if(Object.hasOwn(row,name))return row[name];const wanted=importKey(name),actual=Object.keys(row).find(k=>importKey(k)===wanted);if(actual!==undefined)return row[actual];}return undefined;}
function present(value){return value!==undefined&&value!==null&&String(value).trim()!=='';}
export function importCurrency(value,fallback='KZT'){if(!present(value))return fallback;const c=String(value).trim().toUpperCase();const aliases={RUR:'RUB','ТЕНГЕ':'KZT','ТЕНГЕ₸':'KZT','₸':'KZT','ДОЛЛАР':'USD','$':'USD','РУБЛЬ':'RUB','ДОЛЛАР США':'USD','ДОЛЛАРЫ':'USD','РОССИЙСКИЙ РУБЛЬ':'RUB','РУБЛИ':'RUB','КАЗАХСТАНСКИЙ ТЕНГЕ':'KZT','ТГ':'KZT','₽':'RUB','£':'GBP'};const result=aliases[c]||c;if(!Object.hasOwn(ledgerCurrencies,result))throw new Error('Неизвестная валюта: '+c);return result;}
export function importDate(value){if(!present(value))throw new Error('Не указана дата операции.');let s=String(value).trim();if(/^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(s))s=s.slice(0,10);else{const ru=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);if(ru)s=`${ru[3]}-${ru[2].padStart(2,'0')}-${ru[1].padStart(2,'0')}`;else{const english=s.match(/^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];if(english){const month=months.indexOf(english[1].slice(0,3).toLowerCase())+1;s=`${english[3]}-${String(month).padStart(2,'0')}-${english[2].padStart(2,'0')}`;}}}if(!ledgerDate(s))throw new Error('Неверная дата: '+value);return s;}
export function decimalMinor(value){const s=String(value).replace(/[\s\u00a0]/g,'').replace(',','.').replace(/^([-+]?)\./,(_,sign)=>sign+'0.');if(!/^[-+]?\d+(\.\d{1,8})?$/.test(s))throw new Error('Неверная денежная сумма: '+value);const negative=s.startsWith('-'),[whole,fraction='']=s.replace(/^[-+]/,'').split('.');const cents=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2))+(Number(fraction[2]||0)>=5?1n:0n);if(cents>9000000000000n)throw new Error('Сумма слишком велика.');return Number(negative?-cents:cents);}
function moneyField(row,minorNames,decimalNames,fallback=0){const exact=readField(row,...minorNames);if(present(exact)){const n=Number(exact);if(!Number.isSafeInteger(n))throw new Error('Неверная сумма в сотых долях валюты.');return n;}const value=readField(row,...decimalNames);return present(value)?decimalMinor(value):fallback;}
function grossFromDecimal(quantityUnits,value){const raw=String(value).replace(/\s/g,'').replace(',','.').replace(/^\./,'0.');if(!/^\d+(\.\d{1,8})?$/.test(raw))throw new Error('Неверная цена.');const [whole,fraction='']=raw.split('.'),scale=100000000n,price=BigInt(whole)*scale+BigInt(fraction.padEnd(8,'0'));const n=BigInt(quantityUnits)*price;return Number((n+500000000000n)/1000000000000n);}
const kinds={deposit:'deposit',внесение:'deposit',пополнение:'deposit',внесения:'deposit',cashdeposit:'deposit',withdrawal:'withdrawal',withdraw:'withdrawal',вывод:'withdrawal',выводы:'withdrawal',buy:'buy',покупка:'buy',покупки:'buy',stockbuy:'buy',bondbuy:'buy',покупкиакций:'buy',покупкиоблигаций:'buy',fundbuy:'buy',sell:'sell',продажа:'sell',продажи:'sell',stocksell:'sell',bondsell:'sell',продажиакций:'sell',продажиоблигаций:'sell',fundsell:'sell',dividend:'dividend',dividends:'dividend',дивиденды:'dividend',дивиденд:'dividend',coupon:'coupon',купон:'coupon',купоны:'coupon',fee:'fee',commission:'fee',комиссия:'fee',сбор:'fee',redemption:'redemption',redeem:'redemption',погашение:'redemption',fx:'fx',conversion:'fx',конвертация:'fx',обмен:'fx'};
Object.assign(kinds,{внесениесредств:'deposit',пополнениесчета:'deposit',выводсредств:'withdrawal',выводыденежныхсредств:'withdrawal',покупкаакций:'buy',покупкаакции:'buy',покупкаоблигаций:'buy',покупкаоблигации:'buy',продажаакций:'sell',продажаакции:'sell',продажаоблигаций:'sell',продажаоблигации:'sell',выплатакупона:'coupon',выплатадивидендов:'dividend',погашениеоблигаций:'redemption',конвертациявалют:'fx'});
function importType(value,fallback='stock'){const key=importKey(value||fallback);if(['bond','bonds','облигации','облигация'].includes(key))return 'bond';if(['fund','funds','etf','фонд','фонды'].includes(key))return 'fund';return 'stock';}
function frequency(value){const key=importKey(value||'');if(['1','monthly','ежемесячно','месяц'].includes(key))return 1;if(['3','quarterly','ежеквартально','квартал'].includes(key))return 3;if(['6','semiannual','semiannually','полугодие','развполугодие'].includes(key))return 6;return 12;}
export function bondFromImport(row,currency='KZT'){return{currency:importCurrency(readField(row,'currency','валюта'),currency),anchorDate:present(readField(row,'couponDate','coupon_date','anchorDate','дата купона'))?importDate(readField(row,'couponDate','coupon_date','anchorDate','дата купона')):'',maturityDate:present(readField(row,'maturityDate','maturity_date','дата погашения'))?importDate(readField(row,'maturityDate','maturity_date','дата погашения')):'',couponMinor:Math.abs(moneyField(row,['couponMinor'],['couponAmount','coupon_amount','купон','размер купона'])),nominalMinor:Math.abs(moneyField(row,['nominalMinor'],['nominal','face_value','номинал'])),couponRate:Number(String(readField(row,'couponRate','coupon_rate','ставка')||0).replace(',','.')),periodMonths:frequency(readField(row,'periodMonths','couponFrequency','coupon_frequency','периодичность'))};}
function assetKey(a){return a.type+'|'+(a.ticker||a.name).trim().toUpperCase();}
function blankAsset(portfolioId,ticker,type,currency,name=ticker){return{id:ledgerId(),portfolioId,ticker:ticker.toUpperCase(),name:name||ticker,type,assetClass:type==='bond'?'fixedIncome':type==='stock'?'equity':'other',currency,comment:'',opening:[],quotes:{},...(type==='bond'?{bond:bondFromImport({},currency)}:{})};}

export function parseLedgerCSV(text){
  const input=text.replace(/^\uFEFF/,'');let quoted=false,commas=0,semicolons=0;for(let i=0;i<input.length&&input[i]!=='\n';i++){if(input[i]==='"')quoted=!quoted;if(!quoted){if(input[i]===',')commas++;if(input[i]===';')semicolons++;}}
  const separator=semicolons>commas?';':',',rows=[];let row=[],cell='',inside=false;
  for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(inside&&input[i+1]==='"'){cell+='"';i++;}else if(inside||!cell.trim())inside=!inside;else throw new Error('Кавычка внутри неэкранированного поля CSV.');}else if(c===separator&&!inside){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!inside){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(inside)throw new Error('Незакрытая кавычка CSV.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw new Error('В CSV нужны заголовок и хотя бы одна строка.');const headers=rows.shift().map(h=>h.trim());if(headers.some(h=>!h)||new Set(headers.map(importKey)).size!==headers.length)throw new Error('Заголовки CSV пустые или повторяются.');
  return rows.map((values,index)=>{if(values.length!==headers.length)throw new Error(`Строка ${index+2}: число столбцов не совпадает с заголовком.`);return Object.fromEntries(headers.map((h,i)=>[h,values[i].trim()]));});
}

export function operationsToLedger(rows,{name='Импортированный портфель',defaultKind='deposit',instruments=[]}={}){
  if(!Array.isArray(rows)||rows.length>100000)throw new Error('Ожидается список операций, не больше 100 000 строк.');
  const data=emptyLedger(),pid=ledgerId(),warnings=[];data.portfolios.push({id:pid,name:String(name).slice(0,60)||'Импорт',currency:'KZT',openingCash:{},baselineCapital:{},valuationAdjustments:{}});
  const catalog=Array.isArray(instruments)?instruments:Object.entries(instruments||{}).map(([ticker,i])=>({ticker,...i}));
  const metadata=new Map(catalog.map(i=>({...i,...(i.bond||{})})).map(i=>[String(readField(i,'ticker','symbol','тикер')||'').toUpperCase(),i]));
  for(let index=0;index<rows.length;index++){
    try{
      const row=rows[index];if(!row||typeof row!=='object')throw new Error('Ожидается объект операции.');
      const rawKind=readField(row,'type','kind','operation','тип','операция','тип операции','вид операции')||defaultKind,key=importKey(rawKind),kind=kinds[key];if(!kind)throw new Error('Неизвестный тип операции: '+rawKind);
      const e={id:ledgerId(),portfolioId:pid,kind,date:importDate(readField(row,'date','дата','дата операции','timestamp','payment_date','trade_date')),note:String(readField(row,'note','comment','комментарий','примечание')||'').slice(0,500)};
      const external=readField(row,'external_id','externalId','externalID');if(present(external))e.externalId=String(external).slice(0,200);
      const feeMinor=Math.abs(moneyField(row,['feeMinor','commissionMinor'],['commission','fee','комиссия'])),feeCurrency=readField(row,'feeCurrency','fee_currency','commission_currency','валюта комиссии');
      if(kind==='fx'){
        e.fromCurrency=importCurrency(readField(row,'fromCurrency','from_currency','валюта отдачи','валюта из'));e.toCurrency=importCurrency(readField(row,'toCurrency','to_currency','валюта получения','валюта в'),'USD');
        e.fromMinor=Math.abs(moneyField(row,['fromMinor'],['fromAmount','from_amount','сумма отдачи','сумма из']));e.toMinor=Math.abs(moneyField(row,['toMinor'],['toAmount','to_amount','сумма получения','сумма в']));const rate=Number(String(readField(row,'rate','курс')||0).replace(',','.'));if(!e.toMinor&&e.fromMinor&&rate>0)e.toMinor=decimalMinor(String(e.fromMinor/100*rate));if(!e.fromMinor&&e.toMinor&&rate>0)e.fromMinor=decimalMinor(String(e.toMinor/100/rate));
        data.entries.push(e);if(feeMinor)data.entries.push({id:ledgerId(),portfolioId:pid,kind:'fee',date:e.date,currency:importCurrency(feeCurrency,e.fromCurrency),amountMinor:feeMinor,note:'Комиссия обмена',...(e.externalId?{externalId:e.externalId+':fee'}:{})});continue;
      }
      let asset=null;const ticker=String(readField(row,'ticker','symbol','тикер','тикер эмитента')||readField(row.instrument||{},'ticker','symbol')||'').trim().toUpperCase();
      if(['buy','sell','redemption','dividend','coupon'].includes(kind)){
        if(!ticker)throw new Error('Не указан тикер.');const instrument=metadata.get(ticker)||{};
        const type=key.includes('bond')||key.includes('облигац')||kind==='coupon'||kind==='redemption'?'bond':importType(readField(row,'assetType','asset_type','тип актива')||readField(instrument,'type','asset_type'));
        asset=data.assets.find(a=>a.type===type&&a.ticker===ticker);
        const suffix=/\.US$/i.test(ticker)?'USD':/\.KZ$/i.test(ticker)?'KZT':'KZT';
        const fallback=asset?defaultTradeCurrency(data,asset):importCurrency(readField(instrument,'currency'),suffix);
        e.currency=importCurrency(readField(row,'currency','валюта'),fallback);if(!present(readField(row,'currency','валюта')))e.currencyInferred=true;
        if(!asset){asset=blankAsset(pid,ticker,type,e.currency,String(readField(instrument,'name','название')||ticker));if(type==='bond'){asset.bond=bondFromImport({...instrument,...row},e.currency);if(!present(readField(instrument,'couponFrequency','coupon_frequency','periodMonths'))&&!present(readField(row,'couponFrequency','coupon_frequency','periodMonths'))&&asset.bond.couponMinor)warnings.push(ticker+': периодичность купона не указана; принято ежегодно, проверьте справочник.');}const isin=readField(instrument,'isin','ISIN');if(present(isin))asset.brokerData={isin:String(isin).slice(0,32)};asset.comment=String(readField(instrument,'comment','комментарий')||'').slice(0,500);const cls=readField(instrument,'assetClass','asset_class');if(allowedClasses(type).includes(cls))asset.assetClass=cls;data.assets.push(asset);}
        e.assetId=asset.id;
      }else e.currency=importCurrency(readField(row,'currency','валюта'));
      if(['buy','sell','redemption'].includes(kind)){
        const qty=readField(row,'quantityUnits');e.quantityUnits=present(qty)?Number(qty):parseUnits(readField(row,'quantity','qty','количество'));
        const rawPrice=readField(row,'price','unit_price','цена');e.priceMinor=Math.abs(moneyField(row,['priceMinor'],['price','unit_price','цена']));
        const explicitGross=readField(row,'grossMinor','gross_amount','amount_gross','grossAmount','total','сумма сделки');if(present(explicitGross))e.grossMinor=readField(row,'grossMinor')!==undefined?Number(explicitGross):Math.abs(decimalMinor(explicitGross));
        else if(present(readField(row,'net_amount','netAmount','amount_net'))){const net=Math.abs(decimalMinor(readField(row,'net_amount','netAmount','amount_net'))),nativeFee=!feeCurrency||importCurrency(feeCurrency,e.currency)===e.currency?feeMinor:0;e.grossMinor=kind==='buy'?net-nativeFee:net+nativeFee;}else if(present(rawPrice))e.grossMinor=grossFromDecimal(e.quantityUnits,rawPrice);
        else{const amount=readField(row,'amount','сумма');if(present(amount)){e.grossMinor=Math.abs(decimalMinor(amount));e.priceMinor=e.quantityUnits?Math.round(e.grossMinor*1000000/e.quantityUnits):0;}}
        if(kind==='redemption'&&!present(rawPrice)&&e.grossMinor===undefined){if(!asset.bond.nominalMinor)throw new Error('Для погашения нужны фактическая сумма или номинал.');e.priceMinor=asset.bond.nominalMinor;}
        e.feeMinor=feeMinor;if(present(feeCurrency))e.feeCurrency=importCurrency(feeCurrency,e.currency);
        const override=readField(row,'profitOverrideMinor','manualProfit','manual_profit');if(present(override))e.profitOverrideMinor=readField(row,'profitOverrideMinor')!==undefined?Number(override):decimalMinor(override);
        const reported=readField(row,'reportedProfit','realized_pnl','realizedProfit');if(present(reported))e.reportedProfitMinor=decimalMinor(reported);
        if(!asset.quotes[e.currency])asset.quotes[e.currency]={priceMinor:e.priceMinor};
      }else{
        const rawAmount=moneyField(row,['amountMinor'],['amount','gross','gross_amount','amount_gross','сумма','начислено']);if(rawAmount<0&&['deposit','dividend','coupon'].includes(kind))throw new Error('Отрицательное поступление похоже на отмену операции. Удалите взаимно отменённые проводки или задайте корректный тип, чтобы не создать ложное зачисление.');e.amountMinor=Math.abs(rawAmount);
        if(['dividend','coupon'].includes(kind)){
          e.taxMinor=Math.abs(moneyField(row,['taxMinor'],['taxAmount','tax_amount','tax','налог','сумма налога']));
          const rate=readField(row,'taxRate','tax_rate','ставка налога');if(!e.taxMinor&&present(rate))e.taxMinor=Math.round(e.amountMinor*Number(String(rate).replace(',','.'))/100);if(present(rate))e.taxRate=Number(String(rate).replace(',','.'));
          if(present(readField(row,'scheduledDate','coupon_date')))e.scheduledDate=importDate(readField(row,'scheduledDate','coupon_date'));
        }
      }
      data.entries.push(e);if(feeMinor&&['dividend','coupon'].includes(kind))data.entries.push({id:ledgerId(),portfolioId:pid,kind:'fee',date:e.date,currency:importCurrency(feeCurrency,e.currency),amountMinor:feeMinor,note:'Сбор при выплате дохода',...(e.externalId?{externalId:e.externalId+':fee'}:{})});
    }catch(error){throw new Error(`Строка ${index+1}: ${error.message}`);}
  }
  for(const asset of data.assets.filter(a=>a.type==='bond')){const receipts=data.entries.filter(e=>e.assetId===asset.id&&e.kind==='coupon');const record=metadata.get(asset.ticker)||{};if(receipts.length===1&&!present(readField(record,'couponFrequency','coupon_frequency','periodMonths')))warnings.push(asset.ticker+': по одной выплате нельзя надёжно определить периодичность. Проверьте годовой период по умолчанию, сумму за бумагу и базовую дату.');}validateLedger(data);return{data,warnings,kind:'operations',completeBackup:false};
}

function legacyPortfolioRows(portfolio){const rows=[];for(const [key,type] of [['stocks','stock'],['bonds','bond'],['funds','fund']])for(const a of portfolio[key]||[]){const ticker=a.ticker||a.symbol||a.name;for(const [list,kind] of [['buys','buy'],['purchases','buy'],['sells','sell'],['sales','sell'],['dividends','dividend'],['coupons','coupon'],['redemptions','redemption']])for(const e of a[list]||[])rows.push({...e,ticker,assetType:type,type:kind});}
  for(const [list,type] of [['cashDeposits','deposit'],['cashWithdrawals','withdrawal'],['conversions','fx'],['fees','fee']])for(const e of portfolio[list]||[])rows.push({...e,type});return rows;}
export function parseLedgerFile(text,{format='json',defaultKind='deposit'}={}){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>LEDGER_MAX_BYTES)throw new Error('Максимальный размер файла — 12 МБ.');
  const raw=text.replace(/^\uFEFF/,'').trim();if(!raw)throw new Error('Выберите файл или вставьте данные.');
  if(format==='csv')return operationsToLedger(parseLedgerCSV(raw),{defaultKind});
  let value;try{value=JSON.parse(raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw new Error('Некорректный JSON. Записи не изменены.');}
  if(value?.data?.schemaVersion)value=value.data;
  if(typeof value?.schemaVersion==='number'){return{data:normalizeLedger(value),warnings:[],kind:'backup',completeBackup:true};}
  if(Array.isArray(value))return operationsToLedger(value,{defaultKind:null});
  if(!value||typeof value!=='object')throw new Error('Ожидается JSON-объект или список операций.');
  const operations=value.operations||value['операции'];if(Array.isArray(operations)){const parsed=operationsToLedger(operations,{defaultKind:null,name:value.portfolio?.name||value.name||'Импортированный портфель',instruments:value.instruments||[]});if(value.cash)parsed.data.importReportedCash=structuredClone(value.cash);return parsed;}
  if(Array.isArray(value.portfolios)||value.stocks||value.bonds||value.cashDeposits){
    const list=value.portfolios||[value],data=emptyLedger(),warnings=[];
    for(const p of list){const rows=legacyPortfolioRows(p);if(!rows.length)throw new Error('В старом портфеле не найдены поддерживаемые списки операций. Используйте экспорт операций с полями type/date/ticker.');const parsed=operationsToLedger(rows,{name:p.name||'Импортированный портфель',instruments:[...(value.issuers||[]),...(p.bonds||[])]});data.portfolios.push(...parsed.data.portfolios);data.assets.push(...parsed.data.assets);data.entries.push(...parsed.data.entries);warnings.push(...parsed.warnings);}return{data:validateLedger(data),warnings,kind:'legacy',completeBackup:Array.isArray(value.portfolios)};
  }
  throw new Error('Формат не распознан. Поддерживаются резервные копии «Капитал», invest-ops/1.0, списки операций и JSON одного портфеля.');
}

function entryFingerprint(e,asset){const copy={...e};for(const key of ['id','portfolioId','assetId','externalId','sourceRow','currencyInferred'])delete copy[key];copy.asset=asset?assetKey(asset):'';return canonicalValue(copy);}
export function prepareLedgerImport(current,parsed,{target='new',name='Импортированный портфель',replaceAll=false}={}){
  if(replaceAll){if(!parsed.completeBackup)throw new Error('Полное восстановление доступно только для полной резервной копии.');const data=validateLedger(structuredClone(parsed.data));return{data,added:data.entries.length,skipped:0,warnings:parsed.warnings||[],restoring:true};}
  const data=structuredClone(current),source=parsed.data;let destination=data.portfolios.find(p=>p.id===target);
  if(target==='new'){destination={id:ledgerId(),name:String(name).trim().slice(0,60)||'Импортированный портфель',currency:'KZT',openingCash:{},baselineCapital:{},valuationAdjustments:{}};data.portfolios.push(destination);}
  if(!destination)throw new Error('Выберите портфель для импорта.');
  const assetMap=new Map(),archiveCopies=[],warnings=[...(parsed.warnings||[])];let added=0,skipped=0;
  const openingCounts=new Map();for(const key of destination.importedOpenings||[])openingCounts.set(key,(openingCounts.get(key)||0)+1);
  const incomingOpeningCounts=new Map();
  for(const p of source.portfolios){
    const sourceAssets=source.assets.filter(a=>a.portfolioId===p.id),openingKey=canonicalValue({cash:p.openingCash,baseline:p.baselineCapital,adjustments:p.valuationAdjustments,snapshotDate:p.snapshotDate,assets:sourceAssets.filter(a=>a.opening.length).map(a=>({asset:assetKey(a),opening:a.opening})).sort((a,b)=>a.asset.localeCompare(b.asset))});
    const occurrence=(incomingOpeningCounts.get(openingKey)||0)+1;incomingOpeningCounts.set(openingKey,occurrence);
    const hasOpening=Object.values(p.openingCash).some(Boolean)||Object.values(p.baselineCapital).some(Boolean)||sourceAssets.some(a=>a.opening.length)||Object.values(p.valuationAdjustments||{}).some(Boolean);
    const destinationOpeningKey=canonicalValue({cash:destination.openingCash,baseline:destination.baselineCapital,adjustments:destination.valuationAdjustments,snapshotDate:destination.snapshotDate,assets:data.assets.filter(a=>a.portfolioId===destination.id&&a.opening.length).map(a=>({asset:assetKey(a),opening:a.opening})).sort((a,b)=>a.asset.localeCompare(b.asset))});
    const sameNativeOpening=p.id===destination.id&&openingKey===destinationOpeningKey;
    const openingAlreadyImported=occurrence<=(openingCounts.get(openingKey)||0);
    if(p.id===destination.id&&hasOpening&&!sameNativeOpening&&!openingAlreadyImported)throw new Error('Начальные остатки в собственной копии отличаются от текущих. Выберите новый портфель или полное восстановление.');
    if(sameNativeOpening&&hasOpening&&!openingAlreadyImported){destination.importedOpenings||=[];destination.importedOpenings.push(openingKey);}
    const addOpening=hasOpening&&!sameNativeOpening&&occurrence>(openingCounts.get(openingKey)||0);
    if(addOpening){destination.importedOpenings||=[];destination.importedOpenings.push(openingKey);for(const key of ['openingCash','baselineCapital','valuationAdjustments'])for(const [c,n] of Object.entries(p[key]||{}))destination[key][c]=(destination[key][c]||0)+n;if(p.snapshotDate)destination.snapshotDate=destination.snapshotDate&&destination.snapshotDate<p.snapshotDate?destination.snapshotDate:p.snapshotDate;if(p.legacyCashBreakdown)destination.legacyCashBreakdown=structuredClone(p.legacyCashBreakdown);if(p.legacyReportValue)destination.legacyReportValue=structuredClone(p.legacyReportValue);}
    for(const a of sourceAssets){let existing=data.assets.find(b=>b.portfolioId===destination.id&&assetKey(b)===assetKey(a));if(!existing){existing={...structuredClone(a),id:ledgerId(),portfolioId:destination.id,opening:[]};if(a.archive)archiveCopies.push({id:existing.id,archive:structuredClone(a.archive)});delete existing.archive;data.assets.push(existing);}if(addOpening)for(const o of a.opening){const old=existing.opening.find(x=>x.currency===o.currency);if(old){old.quantityUnits+=o.quantityUnits;old.valueMinor+=o.valueMinor;delete existing.quotes[o.currency]?.valueOverrideMinor;}else existing.opening.push(structuredClone(o));}assetMap.set(a.id,existing.id);}
  }
  const existingCounts=new Map(),externalIds=new Set();for(const e of data.entries.filter(e=>e.portfolioId===destination.id)){const key=entryFingerprint(e,data.assets.find(a=>a.id===e.assetId));existingCounts.set(key,(existingCounts.get(key)||0)+1);if(e.externalId)externalIds.add(e.externalId);}
  const incomingCounts=new Map(),newExternal=new Set();
  const incomingEntries=source.entries.map((e,index)=>({e,index})).sort((a,b)=>a.e.date.localeCompare(b.e.date)||(a.e.order||0)-(b.e.order||0)||a.index-b.index);
  for(const {e:original} of incomingEntries){const e=structuredClone(original),a=source.assets.find(a=>a.id===e.assetId),mapped=data.assets.find(a=>a.id===assetMap.get(e.assetId));if(e.currencyInferred&&mapped){e.currency=defaultTradeCurrency({...data,entries:data.entries.filter(x=>x.date<=e.date)},mapped);if(!mapped.quotes[e.currency]&&e.priceMinor!==undefined)mapped.quotes[e.currency]={priceMinor:e.priceMinor};}delete e.currencyInferred;const key=entryFingerprint(e,a),occurrence=(incomingCounts.get(key)||0)+1;incomingCounts.set(key,occurrence);
    if(e.externalId?(externalIds.has(e.externalId)||newExternal.has(e.externalId)):occurrence<=(existingCounts.get(key)||0)){skipped++;continue;}
    if(destination.snapshotDate&&e.date<destination.snapshotDate&&data.assets.some(a=>a.portfolioId===destination.id&&a.opening.length))throw new Error('История операций начинается раньше снимка выбранного портфеля. Импортируйте её в новый портфель, чтобы не учесть начальные остатки дважды.');
    const entry={...structuredClone(e),id:ledgerId(),portfolioId:destination.id};if(e.assetId)entry.assetId=assetMap.get(e.assetId);data.entries.push(entry);added++;if(e.externalId)newExternal.add(e.externalId);
  }
  for(const i of source.issuers){if(!data.issuers.some(x=>x.ticker.toUpperCase()===i.ticker.toUpperCase()))data.issuers.push({...structuredClone(i),id:ledgerId()});}
  if(!source.issuers.length)for(const a of source.assets.filter(a=>a.type==='bond'))if(!data.issuers.some(i=>i.ticker.toUpperCase()===a.ticker.toUpperCase()))data.issuers.push({id:ledgerId(),ticker:a.ticker,name:a.name,bond:structuredClone(a.bond)});
  for(const item of archiveCopies){const asset=data.assets.find(a=>a.id===item.id);asset.archive={...item.archive,signature:assetSignature(data,item.id)};}
  if(source.report){data.importReports||=[];const key=canonicalValue(source.report);if(!data.importReports.some(r=>canonicalValue(r)===key))data.importReports.push(structuredClone(source.report));}
  validateLedger(data);const view=ledgerView(data,destination.id,'9999-12-31');warnings.push(...view.warnings.map(w=>w.message));
  for(const a of data.assets.filter(a=>a.portfolioId===destination.id&&a.type==='bond'&&a.bond.maturityDate&&a.bond.maturityDate<ledgerToday()))if([...view.positions.get(a.id).pools.values()].some(p=>p.quantityUnits>0))warnings.push(a.ticker+': дата погашения прошла; остаток сохранён до подтверждения фактического поступления.');
  if(!added&&skipped)warnings.push('Все операции уже присутствуют. Повторный импорт не удваивает журнал.');
  return{data,added,skipped,warnings:[...new Set(warnings)],portfolioId:destination.id,restoring:false};
}
