/** Node/VM with actual candidate modules, Economy, save hooks and boot prefix. Synthetic DOM/locks/Storage; not browser evidence. Enabled path uses unchanged candidate release=true; only disabled negative controls transform it. */
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setup} from './fixture.mjs';
export const ROOT = new URL('../../', import.meta.url);
export const ORIGIN='https://play.example.invalid';
export const copy=x=>JSON.parse(JSON.stringify(x));
export const source=(relative, root=ROOT)=>readFileSync(new URL(relative,root),'utf8');
export const RELEASE=source('collectibles/release.mjs').match(/COLLECTIBLES_RELEASE\s*=\s*['"]([^'"]+)/)[1];
export async function until(predicate,label) {
  const deadline=Date.now()+3000;
  do {if(predicate())return;await new Promise(r=>setImmediate(r));}while(Date.now()<deadline);
  assert.fail(`Model did not reach ${label}`);
}
function eventTarget() {
  const listeners=new Map();
  return {removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(x=>x.fn!==fn));},count:type=>(listeners.get(type)||[]).length,addEventListener(type,fn,opts){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push({fn,once:!!opts?.once});},
    dispatch(type,event={}){for(const item of [...(listeners.get(type)||[])]){item.fn(event);if(item.once)listeners.set(type,listeners.get(type).filter(x=>x!==item));}}};
}
export async function assembly({scope='formal',path,query='',projectRoot='/',enabled=true,fullBoot=true,dataMode='initialized',configure=null,protocol=1,missing=false,raw=null,prepared=false,
  rejectClassic=false,rejectModule=null,classicReuse=false,delayClassic=false,pendingLock=false,secure=true,
  mode='entry',hashMismatch=false,observeDirty=false,loadPetDomain=false,storageFault=null,walletBridgeApproved=true,cardEntryEnabled=false,entryOptions={},clockNow=1700000001000,entrySourceOverride=null}={}) {
  const t=await setup('4c45f0b',scope);t.init();
  if(dataMode==='source'){for(const k of ['main','backup','tab','original'])if(t.keys[k])t.data.delete(t.keys[k]);}
  if(dataMode==='empty')t.data.clear();
  if(protocol===2||prepared){const p=t.prepare();t.data.set(`tangzhe-${scope}-collectibles-v2-original`,p.snapshotRaw);if(protocol===2)t.data.set(t.keys.main,p.candidateRaw);}
  if(missing)t.data.delete(t.keys.main);
  if(raw!==null)t.data.set(t.keys.main,raw);
  if(configure)configure(t);
  const prefix='';
  const data=new Map([...t.data].map(([key,value])=>[prefix+key,value]));
  const calls=[],classicLoads=[],economies=[],moduleLoads=[],dynamicImports=[],installed=[],errors=[],loadedSources=new Map();
  const created=[];
  const lock={requests:[],active:false,released:0,pending:false};
  const context=vm.createContext({URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,Blob,console,performance,queueMicrotask,setTimeout,clearTimeout,Date:class extends Date{static now(){return clockNow;}}});
  const winEvents=eventTarget(),docEvents=eventTarget();
  let reloads=0,classicContinuation=null,grantLock=null,bootError=null,settled=false;
  class Node {
    constructor(tag){this.tagName=tag;this.children=[];this.style={};this.id='';this.textContent='';this.parentNode=null;this.disabled=false;}
    append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}
    setAttribute(key,value){this[key]=value;}
    get firstChild(){return this.children[0];}
    querySelector(tag){return walk(this).find(n=>n.tagName===tag)||null;}
    querySelectorAll(tag){return walk(this).filter(n=>n.tagName===tag);}
    click(){return this.onclick?.({isTrusted:false});}
  }
  function walk(node){return [node,...node.children.flatMap(walk)];}
  const document={...docEvents,hidden:false,visibilityState:'visible',body:new Node('body'),head:new Node('head'),
    createElement:tag=>{const n=new Node(tag);created.push(n);return n;},getElementById:id=>walk(document.body).find(node=>node.id===id)||null};
  assert.ok(projectRoot.startsWith('/')&&projectRoot.endsWith('/'));
  const pathname=path||(projectRoot+(scope==='preview'?'preview/':''));
  const location=new URL(pathname+query,ORIGIN);location.reload=()=>{reloads++;};
  const backing=new WeakMap();
  class Storage {
    constructor(initial=new Map()){backing.set(this,initial);}
    getItem(key){calls.push({operation:'getItem',key});if(storageFault?.operation==='getItem'&&storageFault.key===key){if(storageFault.afterWrite){if(storageFault.armed){if(storageFault.mismatch)return '{\"foreign\":true}';throw Error('MODEL_READBACK_UNCERTAIN');}}else throw Error('MODEL_STORAGE_READ_FAILED');}return backing.get(this).get(key)??null;}
    setItem(key,value){
      calls.push({operation:'setItem',key,value});const match=storageFault?.key===key;
      if(match)storageFault.attempt=(storageFault.attempt||0)+1;
      const triggered=match&&(!storageFault.nth||storageFault.attempt===storageFault.nth);
      if(triggered&&storageFault.operation==='setItem'&&!storageFault.writeThenThrow)throw Error('MODEL_STORAGE_WRITE_FAILED');
      backing.get(this).set(key,value);
      if(triggered&&storageFault.operation==='getItem'&&storageFault.afterWrite)storageFault.armed=true;
      if(triggered&&storageFault.operation==='setItem'&&storageFault.writeThenThrow)throw Error('MODEL_WRITE_CONFIRMED_THEN_THROW');
    }
    removeItem(key){calls.push({operation:'removeItem',key});backing.get(this).delete(key);}
    key(index){calls.push({operation:'key'});return [...backing.get(this).keys()][index]??null;}
    clear(){calls.push({operation:'clear'});backing.get(this).clear();}
    get length(){return backing.get(this).size;}
  }
  class LockManager {
    request(name,opts,fn){
      if(typeof opts==='function'){fn=opts;opts={};}
      lock.requests.push({name,options:opts});
      return new Promise((resolve,reject)=>{
        lock.rejectOuter=reject;
        const onAbort=()=>{if(!lock.active){lock.pending=false;reject(Error('MODEL_ABORTED'));}};const run=async({ignoreAbort=false}={})=>{if(opts.signal?.aborted&&!ignoreAbort){reject(Error('MODEL_ABORTED'));return;}lock.pending=false;opts.signal?.removeEventListener('abort',onAbort);lock.active=true;
          try{resolve(await fn({name,mode:'exclusive'}));}catch(e){reject(e);}finally{lock.active=false;lock.released++;}};
        if(pendingLock){lock.pending=true;grantLock=run;opts.signal?.addEventListener('abort',onAbort,{once:true});}
        else queueMicrotask(run);
      });
    }
    query(){return Promise.resolve({held:lock.active?lock.requests.slice(-1):[],pending:lock.pending?lock.requests.slice(-1):[]});}
  }
  Object.assign(context,{document,location,isSecureContext:secure,Storage,localStorage:new Storage(data),sessionStorage:new Storage(),navigator:{locks:new LockManager(),serviceWorker:{register(){throw Error('UNEXPECTED_SW');}}},crypto:secure?webcrypto:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)},addEventListener:winEvents.addEventListener,removeEventListener:winEvents.removeEventListener});
  vm.runInContext('globalThis.window=globalThis;globalThis.self=globalThis;',context);
  function instrumentEconomy(E){
    economies.push(E);const name=scope==='formal'?'installFormalCollectionProtocol':'installPreviewCollectionProtocol';
    const install=E[name];E[name]=function(c){installed.push({economy:E,coordinator:c});return install(c);};
  }
  const support=scope==='formal'?'':'preview/';
  for(const name of ['tdcore.js','tdwaves.js','tdcampaign.js','tdprogress.js','tdcampaign-progress.js','tdupgrade-receipts.js']) {
    const file=new URL(support+'td/'+name,ROOT);if(existsSync(file))new vm.Script(readFileSync(file,'utf8'),{filename:fileURLToPath(file)}).runInContext(context);
  }
  if(loadPetDomain){
    const paths=['pet/art.js','pet/puppy.js','pet/room.js','pet/engine.js','pet/companions.js',...(scope==='formal'?['home-interaction.js']:[]),'pet/game/petgame.js'];
    for(const path of paths){const actual=path==='home-interaction.js'?path:support+path;new vm.Script(source(actual),{filename:actual}).runInContext(context);}
  }
  const economySource=readFileSync(new URL(support+'economy.js',ROOT),'utf8');
  new vm.Script(readFileSync(new URL(support+'zombie/zbcore.js',ROOT),'utf8')).runInContext(context);
  new vm.Script(economySource).runInContext(context);instrumentEconomy(context.Economy);const initialE=context.Economy;
  const appendHead=document.head.append.bind(document.head);
  document.head.append=script=>{
    if(script.tagName!=='script'){appendHead(script);return;}
    const url=new URL(script.src);classicLoads.push(url.href);
    assert.equal(url.pathname,`${projectRoot}${support}economy.js`);assert.equal(url.searchParams.get('collectiblesLegacy'),'1');
    const run=()=>{try{if(rejectClassic)throw Error('MODEL_CLASSIC_404');if(!classicReuse){new vm.Script(economySource,{filename:url.href}).runInContext(context);instrumentEconomy(context.Economy);}script.onload();}catch(e){script.onerror(e);}};
    if(delayClassic)classicContinuation=run;else queueMicrotask(run);
  };
  const modules=new Map();
  function getSource(url){
    const u=new URL(url);assert.equal(u.origin,ORIGIN);assert.ok(u.pathname.startsWith(projectRoot));const relative=u.pathname.slice(projectRoot.length);
    let file=new URL(relative,ROOT),kind='candidate';
    if(!existsSync(file))throw Error('MODEL_MISSING_SOURCE:'+url);
    let text=readFileSync(file,'utf8');if(relative==='collectibles/entry.mjs'&&entrySourceOverride!==null)text=entrySourceOverride;const originalSha256=createHash('sha256').update(text).digest('hex');let transform=null;
    if(relative==='collectibles/release.mjs'){assert.ok(text.includes('COLLECTIBLES_PRODUCTION_ENABLED = true'));if(!enabled){text=text.replace('COLLECTIBLES_PRODUCTION_ENABLED = true','COLLECTIBLES_PRODUCTION_ENABLED = false');transform='NEGATIVE_CONTROL_ONLY_DISABLE';}}
    if(relative==='qa-protocol2/real-page-facade.mjs'){assert.ok(text.includes('export function createRealPageQAFacade('));text=text.replace('export function createRealPageQAFacade(','function createActualFacade(')+'\nexport function createRealPageQAFacade(options){return globalThis.__reviewFacade=createActualFacade(options);}' ;transform='TEST_ONLY_FACADE_OBSERVER';}
    if(relative.endsWith('collection/bootstrap.mjs')){text=text.replace(".catch(()=>notice('COLLECTIBLES_BOOT_FAILED_READ_ONLY'))", ".catch(error=>{globalThis.__modelErrors.push(error?.message||'BOOT_ERROR');notice('COLLECTIBLES_BOOT_FAILED_READ_ONLY');})");transform='OBSERVER_ONLY_BOOT_ERROR';}
    loadedSources.set(url,{file:fileURLToPath(file),kind,sha256:originalSha256,executedSha256:createHash('sha256').update(text).digest('hex'),transform});return text;
  }
  function actualAppHooks(url){
    const text=getSource(url),persist=text.match(/function persist\(\) \{[\s\S]*?\n\}/)?.[0],txn=text.match(/function txn\([^\n]+[\s\S]*?\n\}/)?.[0];
    let hooks=text.split('\n').find(line=>line.startsWith('Object.defineProperties(window.__tzz, {')&&line.includes('collectionReplaceState:'));
    if(!hooks){const match=text.match(/window\.__tzz = \{ ([\s\S]*?collectionReplaceState:[\s\S]*?), upgradeGate,/);assert.ok(match,'pet hook boundary');hooks='Object.assign(window.__tzz, {'+match[1]+'});';}
    assert.ok(persist&&txn&&hooks,'actual app hook extraction');
    const extract=name=>text.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))?.[0];
    const atomic=extract('atomic'),doGacha=extract('doGacha'),saveFailNote=extract('saveFailNote');assert.ok(atomic&&doGacha&&saveFailNote);
    const lineFn=name=>text.split('\n').find(l=>l.startsWith(`function ${name}(`))||'',clockFns=lineFn('fmtClockLocal')+'\n'+lineFn('gachaResumeText');   // 文案-94：doGacha 被挡提示用盲盒-92 的 gachaResumeText

    return `const E=window.Economy,COLLECTION=window.${scope==='formal'?'Formal':'Preview'}CollectionRuntime,TEST_MODE=false;
      let frozen=false,saveBlocked=false,state=COLLECTION.coordinator.current().state,lastGood=COLLECTION.coordinator.raw,dirty=false;
      const now=()=>Date.now(),toast=(message)=>globalThis.__modelToasts.push(message),showCollectionProtection=code=>globalThis.__modelErrors.push(code),restoreGood=()=>{};
      ${persist}\n${txn}\n${saveFailNote}\n${atomic}\nlet drawing=false;const rand=()=>globalThis.__gachaRandom?globalThis.__gachaRandom():0,sfx=()=>{},failBuy=(b,why)=>(globalThis.__failBuy=globalThis.__failBuy||[]).push(why),renderTab=()=>{},showReveal=()=>{globalThis.__revealCalls=(globalThis.__revealCalls||0)+1;};\n${clockFns}\n${doGacha}
      ${fullBoot?bootPreparation(text):'const petBeforePersist=()=>{};'}
      window.__tzz={${observeDirty?'get reviewDirty(){return dirty;},set reviewDirty(value){dirty=value;},':''}persist,txn,atomic,doGacha,get state(){return state;},set state(s){state=s;},get saveBlocked(){return saveBlocked;},get lastGood(){return lastGood;}};
      ${hooks}
      export const reviewOnlyExtractedHooks=true;`;
  }
  function bootPreparation(text){
    const extract=name=>text.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[^\\n]*\\}`))?.[0]||text.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))?.[0];
    const prefix=text.match(/function boot\(\) \{([\s\S]*?\n  persist\(\);)/)?.[1];assert.ok(prefix,'actual boot prefix');
    const fns=['loadState','claimLock','petBeforePersist'].map(n=>{const f=extract(n);assert.ok(f,n);return f;}).join('\n');
    return `const STORAGE=COLLECTION.storage,LOCK_KEY=COLLECTION.keys.tab,TAB='synthetic-production-boot',TEST_LV=2;let loadInfo={source:'new',bad:[]},loadWallMig={moved:0,stored:0};const petActors=new Map(),$=()=>({classList:{toggle(){},add(){}}}),resize=()=>{},rid=()=> 'synthetic-offline';${fns}\n globalThis.__fullBootBefore=JSON.parse(JSON.stringify(state));function boot(){${prefix}\n}boot();globalThis.__fullBootAfter=JSON.parse(JSON.stringify(state));`;
  }
  context.__modelErrors=errors;context.__modelToasts=[];
  function moduleFor(url){
    if(!modules.has(url)){
      moduleLoads.push(url);const u=new URL(url);
      const app=u.pathname.endsWith('/app.js')&&[RELEASE,'xingtuv2-cabin1-20261014-r1'].includes(u.searchParams.get('v'));
      const code=app?actualAppHooks(url):getSource(url);if(app){const loaded=loadedSources.get(url);loaded.executedSha256=createHash('sha256').update(code).digest('hex');loaded.transform='EXTRACTED_ACTUAL_SAVE_HOOKS_AND_BOOT_PREFIX';}
      modules.set(url,new vm.SourceTextModule(code,{context,identifier:url,initializeImportMeta(meta){meta.url=url;},
        async importModuleDynamically(specifier,ref){const next=new URL(specifier,ref.identifier).href;dynamicImports.push(next);if(rejectModule&&next.includes(rejectModule))throw Error('MODEL_MODULE_404');return evaluate(next);}}));
    }
    return modules.get(url);
  }
  async function evaluate(url){const m=moduleFor(url);if(m.status==='unlinked')await m.link((spec,ref)=>moduleFor(new URL(spec,ref.identifier).href));if(m.status==='linked')await m.evaluate();if(m.status==='errored')throw m.error;return m;}
  let completion;
  if(mode==='none'){completion=Promise.resolve();settled=true;}else if(mode==='bootstrap'){
    completion=evaluate(`${ORIGIN}${projectRoot}${support}collection/bootstrap.mjs?v=${RELEASE}`).catch(e=>{bootError=e;}).finally(()=>{settled=true;});
  }else{
    const entry=await evaluate(`${ORIGIN}${projectRoot}collectibles/entry.mjs`);
    const host=(await evaluate(`${ORIGIN}${projectRoot}${support}collection/host-save.mjs`)).namespace;
    const wallet=(await evaluate(`${ORIGIN}${projectRoot}${support}collection/host-wallet.mjs`)).namespace;
    const model=(await evaluate(`${ORIGIN}${projectRoot}${support}collection/domain/model.mjs`)).namespace;
    const config=(await evaluate(`${ORIGIN}${projectRoot}${support}collection/domain/trial-config.mjs`)).namespace.TRIAL_CONFIG;
    const canonical=(await evaluate(`${ORIGIN}${projectRoot}${support}collection/domain/json.mjs`)).namespace.canonical;
    const expectedConfigHash=hashMismatch?'mismatch':createHash('sha256').update(canonical(config)).digest('hex');
    completion=entry.namespace.launchProductionCollectibles({scope,E:initialE,keys:host.KEYS,lockName:host.LOCK_NAME,createLegacyCoordinator:host.createSaveCoordinator,createCollectionHost:wallet.createCollectionHost,secureRandomInt:wallet.secureRandomInt,createApprovedTrialModel:model.createApprovedTrialModel,config,canonical,expectedConfigHash,approvalEvidence:vm.runInContext('["synthetic-entry-review"]',context),sourceBase:new URL(support,ORIGIN+projectRoot),walletBridgeApproved,cardEntryEnabled,...entryOptions}).catch(e=>{bootError=e;}).finally(()=>{settled=true;});
  }
  const h={created,context,data,calls,lock,classicLoads,economies,moduleLoads,dynamicImports,installed,initialE,loadedSources,errors,t,prefix,document,
    get bootError(){return bootError;},get settled(){return settled;},get reloads(){return reloads;},get app(){return context.__tzz;},get runtime(){return context[scope==='formal'?'FormalCollectionRuntime':'PreviewCollectionRuntime'];},
    node:id=>document.getElementById(id),view:()=>context.__reviewFacade?copy(context.__reviewFacade.view()):null,writes:()=>calls.filter(x=>x.operation!=='getItem'),dump:()=>JSON.stringify([...data]),
    async click(id){assert.ok(h.node(id),id+' exists');await h.node(id).onclick({isTrusted:false});},
    hide(){document.hidden=true;document.visibilityState='hidden';docEvents.dispatch('visibilitychange');},
    storageEvent(event){winEvents.dispatch('storage',event);},listenerCount:type=>winEvents.count(type),pagehide(){winEvents.dispatch('pagehide');},pageshow(persisted){winEvents.dispatch('pageshow',{persisted});},
    continueClassic(){classicContinuation?.();},grantLock(){grantLock?.();},lateLockCallback(){grantLock?.({ignoreAbort:true});},stealLock(){lock.active=false;lock.stolen=true;lock.rejectOuter?.(Object.assign(new Error('Lock stolen'),{name:'AbortError'}));},evaluate,modules,
    async close(){winEvents.dispatch('pagehide');classicContinuation?.();await completion;await new Promise(r=>setImmediate(r));},
  };
  return h;
}
