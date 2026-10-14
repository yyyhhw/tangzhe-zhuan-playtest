/** QA-only real-page composition. No production route, seeding, or automatic consent. */
import {installRealPageStorageGuard,validateRealPageQAGate} from './guard/storage-boundary.mjs?v=xingtu114-20261014-r1';
import {createRealPageQAStorage} from './host-storage.mjs?v=xingtu114-20261014-r1';
import {createRealPageQAFacade} from './real-page-facade.mjs?v=xingtu114-20261014-r1';
import {createMigrationPlanner} from './vendor/planner/migration.mjs?v=xingtu114-20261014-r1';
import * as codec from './vendor/codec/snapshot-codec.mjs?v=xingtu114-20261014-r1';
import {createPetDomain} from './vendor/runtime/pet-domain.mjs?v=xingtu114-20261014-r1';
import {createProtocol2Validator} from './vendor/runtime/validator.mjs?v=xingtu114-20261014-r1';
import {createCardAwareSession} from './vendor/cards/card-coordinator.mjs?v=xingtu114-20261014-r1';
import {createHostModel} from './vendor/host/host-model.mjs?v=xingtu114-20261014-r1';
import {prepareEightWearableCatalog} from './eight-catalog.mjs?v=xingtu114-20261014-r1';
export const PRODUCTION_PROTOCOL2_ENABLED=false;
const clone=x=>JSON.parse(JSON.stringify(x));
async function loadClassic(url){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url.href;s.onload=resolve;s.onerror=()=>reject(Error('QA_LEGACY_ECONOMY_LOAD_FAILED'));document.head.append(s);});}
function makePanel(title,text){const panel=document.createElement('section');panel.id='collectionStartup';panel.role='dialog';panel.setAttribute('aria-modal','true');panel.style.cssText='position:fixed;inset:0;z-index:9999;background:#f7f1e3;color:#141414;display:grid;place-content:center;padding:24px;font:16px/1.7 system-ui';const box=document.createElement('div');box.style.maxWidth='650px';const h=document.createElement('h1');h.textContent=title;const body=document.createElement('p');body.textContent=text;box.append(h,body);panel.append(box);document.getElementById('collectionStartup')?.remove();document.body.append(panel);return box;}
function button(box,id,label,run){const b=document.createElement('button');b.id=id;b.textContent=label;b.style.cssText='font:inherit;padding:10px;margin:6px';b.onclick=run;box.append(b);return b;}

export async function launchRealPageQA(options){
  const {scope,E,keys,lockName,createLegacyCoordinator,createCollectionHost,secureRandomInt,createApprovedTrialModel,config,canonical,expectedConfigHash,approvalEvidence,sourceBase}=options;
  const gate=validateRealPageQAGate(location,{scope,realm:'host'});if(!gate.ok)throw Error(gate.reason);
  const stageUrl=new URL(location.href),stageParts=stageUrl.search.slice(1).split('&');
  const stageRequested=stageUrl.searchParams.has('wearables8');
  if(stageRequested&&(stageUrl.searchParams.getAll('wearables8').length!==1||stageUrl.searchParams.get('wearables8')!=='1'||stageParts.filter(part=>part==='wearables8=1').length!==1))throw Error('QA_WEARABLES_STAGE_INVALID');
  if(!globalThis.isSecureContext||!navigator.locks?.request||!crypto?.subtle||!crypto?.getRandomValues)throw Error('QA_SECURE_WEB_LOCK_REQUIRED');
  const guard=installRealPageStorageGuard(globalThis,{scope,realm:'host'});
  const storage=createRealPageQAStorage({scope,nativeStorage:globalThis.localStorage});
  const expectedLock=`qa:tangzhe:${scope}:collection-v1:writer`;if('qa:'+lockName!==expectedLock)throw Error('QA_WRITER_LOCK_MISMATCH');
  const abort=new AbortController();let current=true,owns=false,release,facade,foreignListener,appStarted=false,appStarting=false;
  const lease=Object.freeze({owns:()=>owns&&current});
  const revoke=reason=>{if(!current)return;current=false;try{facade?.invalidate(reason);}finally{owns=false;abort.abort();release?.();}};
  // Let the existing synchronous onHide save finish before lifetime ownership ends.
  addEventListener('pagehide',()=>queueMicrotask(()=>revoke('PAGE_CLOSED_RELOAD_REQUIRED')),{once:true});
  addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(!facade||!facade.view().canPlay)){facade?.hidden();revoke('CONFIRMATION_REVOKED_ON_HIDE');}});
  if(document.hidden){revoke('WAIT_CANCELLED_ON_HIDE');throw Error('QA_PAGE_NOT_VISIBLE');}
  makePanel('等待 QA 合成档写入锁','同一作用域只能一个页面经营。当前未读取或写入存档。');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(config))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==expectedConfigHash)throw Error('QA_TRIAL_CONFIG_HASH_MISMATCH');
  await navigator.locks.request(expectedLock,{mode:'exclusive',signal:abort.signal},async()=>{
    if(!current)throw Error('QA_STALE_LOCK_CALLBACK');owns=true;
    const lifetime=new Promise(resolve=>{release=resolve;});
    try{
      const model=createApprovedTrialModel(config,{schemaVersion:1,approvedConfigCanonical:canonical(config),evidenceRefs:approvalEvidence,walletBridgeApproved:false});
      let legacyE;
      try{await loadClassic(new URL('economy.js?qaLegacyValidator=1&v=xingtu114-20261014-r1',sourceBase));legacyE=globalThis.Economy;}finally{globalThis.Economy=E;}
      if(!lease.owns()||!legacyE||legacyE===E)throw Error('QA_LEGACY_ECONOMY_INSTANCE_REQUIRED');
      const legacy=createLegacyCoordinator({storage,economy:legacyE,model,ownsLock:lease.owns});
      const install=scope==='formal'?'installFormalCollectionProtocol':'installPreviewCollectionProtocol';legacyE[install](legacy);
      const planner=createMigrationPlanner({validateLegacy:(raw,opts)=>legacy.parse(raw,{source:opts.source})});
      const wearableCatalog=stageRequested?prepareEightWearableCatalog(E):null;
      wearableCatalog?.setActive(true); // Validator captures the admitted44 domain; legacy evidence retains its distinct36 Economy.
      const petDomain=globalThis.PetGame?createPetDomain({economy:E,petGame:globalThis.PetGame,canonical}):null;
      const validator=createProtocol2Validator({petDomain,scope,economy:E,model,planner,codec,canonical,validateLegacyCollection:legacy.validateCollection});
      const session=createCardAwareSession({scope,storage,lease,validator,canonical,model,economy:E,createCollectionHost});
      async function startApp(){
        if(appStarted||appStarting||!facade.view().canPlay)return;appStarting=true;
        try{
          const current=facade.coordinator.current();if(!current.ok)throw Error(current.code);
          const qaWearables8=!!wearableCatalog&&current.state._collectionProtocol===2;
          wearableCatalog?.setActive(qaWearables8);
          if(qaWearables8){const display=await import('./wearables8-display.mjs?v=xingtu114-20261014-r1');if(!lease.owns())throw Error('QA_DISPLAY_LOADED_AFTER_REVOKE');globalThis.QAWearables8Display=display.default;}
          const runtime={keys,storage,model,qaWearables8,qa:true,qaScope:scope,qaProtocol2:true,entryEnabled:true,ownsLock:lease.owns,coordinator:facade.coordinator,
            logicalStorageKey:storage.logicalKey,handle:message=>facade.card(message),snapshot:()=>facade.snapshot(),reconcile:()=>facade.reconcile()};
          globalThis[scope==='formal'?'FormalCollectionRuntime':'PreviewCollectionRuntime']=runtime;
          const pet=scope==='formal'&&location.pathname.startsWith('/pet/game/');
          await import(new URL(pet?'pet/game/app.js?qaProtocol2=1&v=xingtu114-20261014-r1':'app.js?qaProtocol2=1&v=xingtu114-20261014-r1',sourceBase));
          if(!lease.owns())throw Error('QA_APP_LOADED_AFTER_REVOKE');
          const attached=facade.attachApp(globalThis.__tzz,{enabled:true,randomInt:n=>secureRandomInt(crypto,n),makeId:()=>`tx:${crypto.randomUUID()}`});
          if(!attached.ok)throw Error(attached.code);appStarted=true;
          if(facade.view().canPlay)document.getElementById('collectionStartup')?.remove();render(facade.view());
        }catch(error){revoke(error.message||'QA_GAMEPLAY_IMPORT_FAILED');throw error;}
        finally{appStarting=false;}
      }
      function exportEvidence(){const raw=storage.dump();const blob=new Blob([JSON.stringify({synthetic:true,scope,raw},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`qa-${scope}-recovery.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);}
      function render(view){
        if(view.phase==='playing'){
          if(!appStarted)return;
          document.getElementById('collectionStartup')?.remove();
          let badge=document.getElementById('qaProtocol2Status');if(!badge){badge=document.createElement('aside');badge.id='qaProtocol2Status';badge.style.cssText='position:fixed;top:0;left:0;z-index:95;background:#ffe899;color:#111;font:12px system-ui;padding:4px';document.body.append(badge);}
          badge.textContent=`QA 合成档 · ${scope} · 协议${globalThis.__tzz.state._collectionProtocol}`;return;
        }
        const prompt=view.phase==='prompt',prepared=view.phase==='prepared';
        const box=makePanel(prompt?'升级合成测试存档':prepared?'升级准备已保留，当前只读':'合成存档已保护',prompt?'本页只使用 QA 合成档。升级先保留完整原文与备份，核对后才写协议2；不发放新物品。请关闭或刷新其它旧页面：新版不能阻止任意旧脚本写同键。取消后继续原协议1经营。':prepared?'原文已固定，不能继续经营或改档。请先只读核对，再明确重试；不会自动回滚或重放。':`没有自动退款、回滚或重复执行。状态：${view.code||view.phase}。请保留证据；只有明确核对成功并替换内存后才能继续。`);
        if(prompt||prepared){button(box,'qaUpgradeConfirm',prompt?'同意升级':'明确重试升级',async()=>{const result=facade.confirmMigration();if(result.ok)await startApp().catch(()=>{});});if(prompt)button(box,'qaUpgradeCancel','取消升级，继续原协议1',async()=>{const result=facade.cancelMigration();if(result.ok)await startApp().catch(()=>{});});}
        if(prepared||view.phase==='protected')button(box,'qaReconcile','只读核对结果',()=>{const result=facade.reconcile();if(result.ok&&facade.view().canPlay&&!appStarted)startApp().catch(()=>{});});
        button(box,'qaExport','导出合成恢复证据',exportEvidence);
        button(box,'qaReload','刷新重读',()=>location.reload());
        const confirm=document.getElementById('qaUpgradeConfirm');if(confirm)confirm.disabled=!view.canConfirm;
      }
      facade=createRealPageQAFacade({enabled:true,scope,format:2,storage,lease,legacy,planner,codec,validator,session,createHostModel,onChange:render});
      E[install](facade.coordinator);
      foreignListener=event=>{const key=storage.logicalKey(event.key);if(lease.owns()&&[keys.main,keys.backup,keys.original,keys.tab,session.coordinator.keys.snapshot].filter(Boolean).includes(key))revoke('FOREIGN_QA_STORAGE_EVENT_READ_ONLY');};
      addEventListener('storage',foreignListener);
      globalThis.qaProtocol2=Object.freeze({view:()=>clone(facade.view()),audit:()=>({logical:storage.audit(),physical:guard.audit}),dump:storage.dump,keys:{...keys,...session.coordinator.keys},setFault:storage.setFault,clearFault:storage.clearFault});
      const result=facade.start();if(result.ok&&facade.view().canPlay)await startApp();
      await lifetime;
    }finally{try{facade?.invalidate('QA_LOCK_LIFETIME_ENDED');}finally{if(foreignListener)removeEventListener('storage',foreignListener);owns=false;current=false;abort.abort();release?.();}}
  });
}
