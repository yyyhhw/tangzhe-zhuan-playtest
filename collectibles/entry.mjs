import {prepareDecor6Catalog} from './decor6-catalog.mjs?v=xtearth-20261015-r3';
import {prepareSecondEightCatalog} from './wearables18-catalog.mjs?v=xtearth-20261015-r3';
import {prepareBox200Catalog} from './box200-catalog.mjs?v=xtearth-20261015-r3';
/** Production composition candidate; activation remains gated by release.mjs.
 * Synthetic review only until the independent browser/activation gate passes. */
import {createCollectibleStorage} from './storage.mjs?v=xtearth-20261015-r3';
import {ensureLegacyReady} from './legacy-entry.mjs?v=xtearth-20261015-r3';
import {COLLECTIBLES_PRODUCTION_ENABLED,COLLECTIBLES_RELEASE} from './release.mjs?v=xtearth-20261015-r3';
import {createRealPageQAFacade} from '../qa-protocol2/real-page-facade.mjs?v=xtearth-20261015-r3';
import {createMigrationPlanner} from '../qa-protocol2/vendor/planner/migration.mjs?v=xtearth-20261015-r3';
import * as codec from '../qa-protocol2/vendor/codec/snapshot-codec.mjs?v=xtearth-20261015-r3';
import {createPetDomain} from '../qa-protocol2/vendor/runtime/pet-domain.mjs?v=xtearth-20261015-r3';
import {createProtocol2Validator} from '../qa-protocol2/vendor/runtime/validator.mjs?v=xtearth-20261015-r3';
import {createCardAwareSession} from '../qa-protocol2/vendor/cards/card-coordinator.mjs?v=xtearth-20261015-r3';
import {createHostModel} from '../qa-protocol2/vendor/host/host-model.mjs?v=xtearth-20261015-r3';
import {prepareEightWearableCatalog} from '../qa-protocol2/eight-catalog.mjs?v=xtearth-20261015-r3';

const clone=x=>JSON.parse(JSON.stringify(x));
async function loadClassic(url){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url.href;s.onload=resolve;s.onerror=()=>reject(Error('QA_LEGACY_ECONOMY_LOAD_FAILED'));document.head.append(s);});}
function makePanel(title,text){const panel=document.createElement('section');panel.id='collectionStartup';panel.role='dialog';panel.setAttribute('aria-modal','true');panel.style.cssText='position:fixed;inset:0;z-index:9999;background:#f7f1e3;color:#141414;display:grid;place-content:center;padding:24px;font:16px/1.7 system-ui';const box=document.createElement('div');box.style.maxWidth='650px';const h=document.createElement('h1');h.textContent=title;const body=document.createElement('p');body.textContent=text;box.append(h,body);panel.append(box);document.getElementById('collectionStartup')?.remove();document.body.append(panel);return box;}
function button(box,id,label,run){const b=document.createElement('button');b.id=id;b.textContent=label;b.style.cssText='font:inherit;padding:10px;margin:6px';b.onclick=run;box.append(b);return b;}

export async function launchProductionCollectibles(options){
  if(!COLLECTIBLES_PRODUCTION_ENABLED)throw Error('COLLECTIBLES_RELEASE_DISABLED');
  const {scope,E,keys,lockName,createLegacyCoordinator,createCollectionHost,secureRandomInt,createApprovedTrialModel,config,canonical,expectedConfigHash,approvalEvidence,sourceBase,walletBridgeApproved=false,cardEntryEnabled=false}=options;
  if(scope==='preview'&&walletBridgeApproved!==true)throw Error('PREVIEW_WALLET_RELEASE_DISABLED');
  const url=new URL(location.href),base=new URL(sourceBase),loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(base.origin!==url.origin||url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&loopback))throw Error('COLLECTIBLE_ORIGIN_INVALID');
  if(url.searchParams.has('collectionQA')||url.searchParams.has('wearables8'))throw Error('COLLECTIBLE_QA_MARKER_REFUSED');
  const paths=scope==='formal'?[base.pathname,new URL('index.html',base).pathname,new URL('pet/game/',base).pathname,new URL('pet/game/index.html',base).pathname]:scope==='preview'?[base.pathname,new URL('index.html',base).pathname]:[];
  if(!paths.includes(url.pathname))throw Error('COLLECTIBLE_PATH_SCOPE_MISMATCH');
  const stageRequested=true;
  if(!globalThis.isSecureContext||!navigator.locks?.request||!crypto?.subtle||!crypto?.getRandomValues)throw Error('SECURE_WEB_LOCK_REQUIRED');
  const storage=createCollectibleStorage({scope,keys,nativeStorage:globalThis.localStorage});
  const expectedLock=`tangzhe:${scope}:collection-v1:writer`;if(lockName!==expectedLock)throw Error('WRITER_LOCK_MISMATCH');
  const abort=new AbortController();let current=true,owns=false,release,facade,foreignListener,appStarted=false,appStarting=false,pageHideSave=null;
  const lease=Object.freeze({owns:()=>owns&&current});
  const revoke=reason=>{if(!current)return;current=false;try{facade?.invalidate(reason);}finally{owns=false;abort.abort();release?.();}};
  let cleaned=false;const cleanup=reason=>{if(cleaned)return;cleaned=true;owns=false;try{revoke(reason);}finally{try{globalThis.XingTu?.invalidate();}finally{if(foreignListener)removeEventListener('storage',foreignListener);}}};
  // Native event dispatch may drain microtasks BETWEEN listeners. Flush and revoke
  // in one synchronous callback so onHide retains every existing save/lock guard.
  addEventListener('pagehide',()=>{
    try{if(appStarted&&lease.owns()&&facade?.view().canPlay)pageHideSave?.();}
    finally{revoke('PAGE_CLOSED_RELOAD_REQUIRED');}
  },{once:true});
  addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(!facade||!facade.view().canPlay)){facade?.hidden();revoke('CONFIRMATION_REVOKED_ON_HIDE');}});
  if(document.hidden){revoke('WAIT_CANCELLED_ON_HIDE');throw Error('QA_PAGE_NOT_VISIBLE');}
  makePanel('正在打开存档','同一作用域只能一个页面经营。若另一页仍在运行，请先关闭或刷新它。当前未读取或写入存档。');
  // 锁修复 20261014：iOS Safari 冻结的后台标签仍持有 Web Lock 且不触发 pagehide，新页永远排队。
  // 现在：等待超时后用 BroadcastChannel 询问持有者；只有可见且在经营的页面回应才拦（并给「在本页继续」）；
  // 无回应即视为陈旧锁，steal 接管。被 steal 的旧页：原生 steal 令其锁请求 reject → cleanup 撤销写权；另经 BroadcastChannel「taken」与既有 storage 事件双重撤销，不双写。
  const myEpoch=crypto.randomUUID();
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(`tangzhe:${scope}:writer-presence`):null;
  const WAIT_MS=Number(options.lockWaitMs??2500),PING_MS=Number(options.lockPingMs??1200);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(config))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==expectedConfigHash)throw Error('QA_TRIAL_CONFIG_HASH_MISMATCH');
  if(channel)channel.onmessage=event=>{const m=event.data||{};
    if(m.type==='ping'&&lease.owns()&&!document.hidden)channel.postMessage({type:'alive',to:m.from});
    else if(m.type==='taken'&&m.from!==myEpoch)onTaken();};
    const waitAbort=new AbortController();abort.signal.addEventListener('abort',()=>waitAbort.abort(),{once:true});
  function onTaken(){if(!acquired||takenOver)return;takenOver=true;revoke('WRITER_TAKEN_OVER');const show=()=>{const box=makePanel('已在另一页继续','本页已停止写入，存档由新页面经营，进度没有丢。要回到这里请刷新。');button(box,'collectibleReload','刷新回到本页',()=>location.reload());};show();setTimeout(show,400);}
  let takenOver=false,acquired=false,stealing=false,resolveSteal;const stolen=new Promise(r=>{resolveSteal=r;});
  const ask=()=>new Promise(resolve=>{if(!channel)return resolve(false);let alive=false;const h=e=>{if(e.data?.type==='alive'&&e.data.to===myEpoch)alive=true;};channel.addEventListener('message',h);channel.postMessage({type:'ping',from:myEpoch});setTimeout(()=>{channel.removeEventListener('message',h);resolve(alive);},PING_MS);});
  const steal=()=>{if(stealing||acquired||!current)return;stealing=true;waitAbort.abort();resolveSteal();};
  setTimeout(async()=>{if(acquired||!current)return;const alive=await ask();if(acquired||!current||stealing)return;
    if(!alive)return steal();
    const box=makePanel('另一个页面正在经营','检测到另一页仍在运行。可以先关闭它；或在本页继续（另一页会立即停止写入，存档不会双写）。');
    button(box,'collectibleTakeOver','在本页继续',steal);},WAIT_MS);
  const body=async()=>{
    if(!current)throw Error('QA_STALE_LOCK_CALLBACK');acquired=true;owns=true;channel?.postMessage({type:'taken',from:myEpoch});
    if(document.getElementById('collectibleTakeOver'))makePanel('正在打开存档','当前未读取或写入存档。');
    const lifetime=new Promise(resolve=>{release=resolve;});
    try{
      const model=createApprovedTrialModel(config,{schemaVersion:1,approvedConfigCanonical:canonical(config),evidenceRefs:approvalEvidence,walletBridgeApproved:false});
      let legacyE;
      try{await loadClassic(new URL('economy.js?collectiblesLegacy=1&v='+COLLECTIBLES_RELEASE,sourceBase));legacyE=globalThis.Economy;}finally{globalThis.Economy=E;}
      if(!lease.owns()||!legacyE||legacyE===E)throw Error('QA_LEGACY_ECONOMY_INSTANCE_REQUIRED');
      const legacy=createLegacyCoordinator({storage,economy:legacyE,model,ownsLock:lease.owns});
      const install=scope==='formal'?'installFormalCollectionProtocol':'installPreviewCollectionProtocol';legacyE[install](legacy);
      const snapshotKey=`tangzhe-${scope}-collectibles-v2-original`;
      const mainRaw=storage.getItem(keys.main),snapshotRaw=storage.getItem(snapshotKey);
      let protocol=null;
      if(mainRaw!==null){let parsed;try{parsed=JSON.parse(mainRaw);}catch{throw Error('INVALID_SAVE_READ_ONLY');}protocol=parsed?._collectionProtocol;if(![1,2].includes(protocol))throw Error('PROTOCOL_UNSUPPORTED');}
      if(mainRaw===null&&snapshotRaw!==null)throw Error('ORPHAN_SNAPSHOT_READ_ONLY');
      // 杨总 16:05：正式存档（root + pet/game）不再弹建档/规则升级确认，自动同意；仍走 legacy-entry 原有的原档归档 + 备份 + 读回校验，任何失败照旧进保护。预览不变。
      const autoUpgrade=scope==='formal';
      async function consent(request){
        if(!lease.owns())return false;
        if(autoUpgrade)return !abort.signal.aborted;
        return new Promise(resolve=>{
          const long=request.body.length>180;
          const box=makePanel(request.title,long?request.body.split('。')[0]+'。':request.body);
          if(long){const warning=document.createElement('p');warning.textContent='只有点击同意并继续才会建立新版存档；取消本次建档不会写入。原档与备份保留，旧、新页面之后的进度分开，不能自动合并。';const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent='查看原档与新版的完整说明';body.textContent=request.body;details.append(summary,body);box.append(warning,details);}
          let finished=false;
          const done=value=>{if(finished)return;finished=true;for(const b of box.querySelectorAll('button'))b.disabled=true;abort.signal.removeEventListener('abort',cancelled);resolve(value&&lease.owns());};
          const cancelled=()=>done(false);abort.signal.addEventListener('abort',cancelled,{once:true});
          button(box,'collectibleLegacyConfirm',request.accept||'同意并继续',()=>done(true));
          button(box,'collectibleLegacyCancel',request.cancel||'暂不进入',()=>done(false));
          if(abort.signal.aborted)done(false);
        });
      }
      if(protocol!==2&&snapshotRaw===null){
        const ready=await ensureLegacyReady({scope,legacy,keys,crypto,consent,alive:lease.owns,now:()=>Date.now(),snapshotRaw});
        if(!ready.ok){makePanel(ready.code==='CONSENT_CANCELLED'?'尚未进入新版存档':'存档已保护',ready.code==='CONSENT_CANCELLED'?'没有执行这次建档或规则升级。原档与已有备份保留。':`没有回退或覆盖存档。请保留证据并刷新核对。状态：${ready.code}`);revoke(ready.code);return;}
      }
      const planner=createMigrationPlanner({validateLegacy:(raw,opts)=>legacy.parse(raw,{source:opts.source})});
      const wearableCatalog=stageRequested?prepareEightWearableCatalog(E):null;
      wearableCatalog?.setActive(true); // Validator captures the admitted58 domain; legacy evidence retains its distinct36 Economy.
      const secondEight=prepareSecondEightCatalog(E);secondEight.setActive(true);
      const decorCatalog=prepareDecor6Catalog(E);decorCatalog.setActive(true);
      const box200=prepareBox200Catalog(E);box200.setActive(true); // 盲盒200：已放行批次（先 盲盒-83）
      const petDomain=globalThis.PetGame?createPetDomain({economy:E,petGame:globalThis.PetGame,canonical}):null;
      const validator=createProtocol2Validator({petDomain,scope,economy:E,model,planner,codec,canonical,validateLegacyCollection:legacy.validateCollection});
      const session=createCardAwareSession({scope,storage,lease,validator,canonical,model,economy:E,createCollectionHost});
      async function startApp(){
        if(appStarted||appStarting||!facade.view().canPlay)return;appStarting=true;
        try{
          const current=facade.coordinator.current();if(!current.ok)throw Error(current.code);
          const qaWearables8=!!wearableCatalog&&current.state._collectionProtocol===2;
          box200.setActive(qaWearables8);
          decorCatalog.setActive(qaWearables8);
          secondEight.setActive(qaWearables8);
          wearableCatalog?.setActive(qaWearables8);
          if(qaWearables8){const display=await import('../candidates/blindbox18/display.mjs?v=xtearth-20261015-r3');if(!lease.owns())throw Error('QA_DISPLAY_LOADED_AFTER_REVOKE');const decor=await import('./decor6-display.mjs?v=xtearth-20261015-r3');if(!lease.owns())throw Error('DECOR_DISPLAY_LOADED_AFTER_REVOKE');const b200=await import('./box200-display.mjs?v=xtearth-20261015-r3');if(!lease.owns())throw Error('BOX200_DISPLAY_LOADED_AFTER_REVOKE');globalThis.QAWearables8Display=b200.wrapWearables(display.default);globalThis.Decor6Display=b200.wrapDecor(decor.default);}
          const runtime={keys,storage,model,qaWearables8,decor6:qaWearables8,claimHidden:id=>facade.claimHidden(id),qa:false,qaScope:scope,qaProtocol2:true,entryEnabled:cardEntryEnabled===true,ownsLock:lease.owns,coordinator:facade.coordinator,
            registerPageHide:handler=>{if(typeof handler!=='function'||pageHideSave)throw Error('PAGE_HIDE_HANDLER_INVALID');pageHideSave=handler;},
            logicalStorageKey:storage.logicalKey,handle:message=>facade.card(message),snapshot:()=>facade.snapshot(),reconcile:()=>{const result=facade.reconcile();if(result.ok)globalThis.XingTu?.resume();return result;}};
          globalThis[scope==='formal'?'FormalCollectionRuntime':'PreviewCollectionRuntime']=runtime;
          const pet=scope==='formal'&&location.pathname.startsWith(new URL('pet/game/',sourceBase).pathname);
          await import(new URL((pet?'pet/game/app.js':'app.js')+'?v='+COLLECTIBLES_RELEASE,sourceBase));
          if(!lease.owns())throw Error('QA_APP_LOADED_AFTER_REVOKE');
          const attached=facade.attachApp(globalThis.__tzz,{enabled:walletBridgeApproved===true,randomInt:n=>secureRandomInt(crypto,n),makeId:()=>`tx:${crypto.randomUUID()}`});
          if(!attached.ok)throw Error(attached.code);
          const {installMoonOverlay}=await import('../space/overlay.mjs?v=xtearth-20261015-r3');
          if(!lease.owns())throw Error('SPACE_LOADED_AFTER_REVOKE');
          installMoonOverlay({app:globalThis.__tzz,runtime});
          if(qaWearables8){const {installHiddenGoals}=await import('./box200-hidden.mjs?v=xtearth-20261015-r3');if(!lease.owns())throw Error('BOX200_HIDDEN_LOADED_AFTER_REVOKE');installHiddenGoals(globalThis.__tzz);} // 盲盒-109：隐藏款达成目标直接获得
          appStarted=true;
          if(facade.view().canPlay)document.getElementById('collectionStartup')?.remove();render(facade.view());
        }catch(error){revoke(error.message||'QA_GAMEPLAY_IMPORT_FAILED');throw error;}
        finally{appStarting=false;}
      }
      function exportEvidence(){const raw=storage.dump();const blob=new Blob([JSON.stringify({scope,release:COLLECTIBLES_RELEASE,raw},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`collectibles-${scope}-recovery.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);}
      function render(view){
        if(view.phase==='playing'){
          if(!appStarted)return;
          document.getElementById('collectionStartup')?.remove();
          return;
        }
        if(autoUpgrade&&view.phase==='prompt')return; // 杨总 16:05：正式存档 P1→P2 自动升级，不显示「开启新收藏？」，没有取消入口
        if(autoUpgrade&&view.phase==='prepared'&&!view.code)return; // 杨总 16:30：正常自动升级途中不闪「升级准备已保留」；只有真失败（带 code）才显示
        const prompt=view.phase==='prompt',prepared=view.phase==='prepared';
        const box=makePanel(prompt?'开启新收藏？':prepared?'升级准备已保留，当前只读':'存档已保护',prompt?'升级后多出 24 件衣帽和 6 件店铺装饰。不想升级也行，照常玩原来的 36 件。':prepared?'原文已固定，现在不能继续经营或改档。请先核对，再明确重试。':'当前结果需要核对，已暂停写入；不会自动退款、回滚或重复执行。');
        const warning=document.createElement('p');warning.textContent=prompt?'升级前请关掉其他开着这个游戏的页面，免得旧页面把进度写回去。':'请保留原档和备份，不要清除浏览器数据或另开新档。';box.append(warning);
        const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent='查看存档保护说明';body.textContent=prompt?'升级后共66件：60普通、4超级、2隐藏条件领取。空收藏且非保底时，普通单件概率由90%/32变为90%/60；每次20万金币、超级10%、15抽保底与不重复规则保留。将先保存完整原文与备份，逐项核对后才提交协议2主档；升级不赠物品、不扣金币。确认弹窗等待与取消不会写入升级，取消后正常经营可以保存旧协议。正式与预览存档彼此独立。写入或读回不确定时保持只读，需明确核对并替换内存，不会自动回滚、重抽或伪造历史达成时间。':`状态：${view.code||view.phase}。准备阶段原文不能改动；提交结果不明时只读核对，不重放经营。核对成功后才替换内存并继续。恢复文件含本机游戏进度，请妥善保存，仅在需要时提供给维护者。`;details.append(summary,body);box.append(details);
        if(prompt||prepared){button(box,'collectibleUpgradeConfirm',prompt?'保留备份并升级':'明确重试升级',async()=>{const result=facade.confirmMigration();if(result.ok)await startApp().catch(()=>{});});if(prompt)button(box,'collectibleUpgradeCancel','先不升级',async()=>{const result=facade.cancelMigration();if(result.ok)await startApp().catch(()=>{});});}
        if(prepared||view.phase==='protected')button(box,'collectibleReconcile','只读核对结果',()=>{const result=facade.reconcile();if(result.ok&&facade.view().canPlay&&!appStarted)startApp().catch(()=>{});if(result.ok&&appStarted)globalThis.XingTu?.resume();});
        button(box,'collectibleExport','保存本机恢复文件',exportEvidence);
        button(box,'collectibleReload','刷新重读',()=>location.reload());
        const confirm=document.getElementById('collectibleUpgradeConfirm');if(confirm)confirm.disabled=!view.canConfirm;
      }
      facade=createRealPageQAFacade({enabled:true,scope,format:2,storage,lease,legacy,planner,codec,validator,session,createHostModel,onChange:render});
      E[install](facade.coordinator);
      foreignListener=event=>{const key=storage.logicalKey(event.key);if(lease.owns()&&[keys.main,keys.backup,keys.original,keys.tab,session.coordinator.keys.snapshot].filter(Boolean).includes(key))revoke('FOREIGN_QA_STORAGE_EVENT_READ_ONLY');};
      addEventListener('storage',foreignListener);
      // No production fault-injection or raw-save console export surface.
      const result=facade.start();
      // P1（含以前取消过的）自动升级到 P2。杨总 16:30：上次快照/备份写失败留下的 prepared，本次加载存储恢复后自动续升（host-model 先核验快照链，再写备份并读回，最后才写 P2），不再要求「明确重试升级」。每次加载只自动尝试一次。
      if(autoUpgrade&&result.ok&&['prompt','prepared'].includes(facade.view().phase)&&facade.view().canConfirm)facade.confirmMigration();
      if(result.ok&&facade.view().canPlay)await startApp();
      await lifetime;
    }finally{cleanup('QA_LOCK_LIFETIME_ENDED');}
  };
  try{
    const normal=navigator.locks.request(expectedLock,{mode:'exclusive',signal:waitAbort.signal},body).then(()=>'done',e=>{if(stealing&&!acquired)return 'stolen';throw e;});
    const r=await Promise.race([normal,stolen.then(()=>'stolen')]);
    if(r==='stolen'&&!acquired&&current)await navigator.locks.request(expectedLock,{mode:'exclusive',steal:true},body);
    else await normal;
  }catch(error){if(acquired&&!takenOver&&error?.name==='AbortError')onTaken();if(takenOver)return;throw error;}finally{cleanup('QA_LOCK_LIFETIME_ENDED');try{channel?.close();}catch{}}
}
