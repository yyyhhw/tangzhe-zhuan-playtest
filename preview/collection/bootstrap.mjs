import { KEYS, LOCK_NAME, createSaveCoordinator } from './host-save.mjs';
import { createCollectionHost, secureRandomInt } from './host-wallet.mjs';
import { WALLET_BRIDGE_APPROVED, EXPECTED_TRIAL_SHA256, APPROVAL_EVIDENCE } from './release-gate.mjs';
import { TRIAL_CONFIG } from './domain/trial-config.mjs';
import { createApprovedTrialModel } from './domain/model.mjs';
import { canonical } from './domain/json.mjs';

const E=window.Economy;
const qa=new URLSearchParams(location.search).get('collectionQA')==='1' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
let ownsLock=false, releaseLock, coordinator;
function panel(title,body,button,run) {
  const cover=document.createElement('div');cover.id='collectionStartup';cover.setAttribute('role','dialog');cover.setAttribute('aria-modal','true');
  cover.style.cssText='position:fixed;inset:0;z-index:9999;background:#f7f1e3;display:grid;place-content:center;padding:24px;color:#141414;font:16px/1.7 system-ui';
  const box=document.createElement('div');box.style.maxWidth='580px';
  const h=document.createElement('h1');h.textContent=title;
  const p=document.createElement('p');p.textContent=body;box.append(h,p);
  if(button){const b=document.createElement('button');b.textContent=button;b.style.cssText='font:inherit;padding:10px 18px';b.onclick=()=>{b.disabled=true;run(cover,b);};box.append(b);}
  cover.append(box);document.getElementById('collectionStartup')?.remove();document.body.append(cover);return cover;
}
function notice(code) { panel('预览存档已保护',`没有继续写入或回退旧档。状态：${code}。请关闭旧页面，再重新打开本页；如果仍有提示，请保留原存档并反馈。`,'重新检查',()=>location.reload()); }
function scopedStorage() {
  // QA may only access a synthetic prefix. Real formal and legacy source keys are not touched.
  const prefix=qa?'qa-collection-trial-v1:':'';
  const allowed=new Set(Object.values(KEYS));
  return Object.freeze({getItem(key){if(!allowed.has(key))throw Error('STORAGE_SCOPE');return localStorage.getItem(prefix+key);},setItem(key,value){if(!allowed.has(key)||[KEYS.source,KEYS.sourceBackup].includes(key))throw Error('STORAGE_SCOPE');localStorage.setItem(prefix+key,value);}});
}
async function launch() {
  if(!qa&&!WALLET_BRIDGE_APPROVED){panel('金币收集接入候选', '此候选还在验证，金币入口尚未开放。这页没有读取、迁移或写入你的存档。');return;}
  if(!navigator.locks?.request){notice('SAFE_WEB_LOCK_UNAVAILABLE');return;}
  if(!crypto?.subtle||!crypto?.getRandomValues){notice('SECURE_CONTEXT_REQUIRED');return;}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(TRIAL_CONFIG))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==EXPECTED_TRIAL_SHA256){notice('TRIAL_CONFIG_HASH_MISMATCH');return;}
  const model=createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:APPROVAL_EVIDENCE,walletBridgeApproved:false});
  panel('正在打开预览存档', '若另一个新预览页面仍在运行，请先关闭它。同一时间只允许一个经营页面写入存档。');
  const lockName=qa?'qa:'+LOCK_NAME:LOCK_NAME;
  // Hold the exclusive lock across the entire synchronous parent app lifetime.
  await navigator.locks.request(lockName,{mode:'exclusive'},async()=>{
    ownsLock=true;
    const lifetime=new Promise(resolve=>{releaseLock=()=>{ownsLock=false;resolve();};});
    window.addEventListener('pagehide',()=>queueMicrotask(()=>releaseLock()),{once:true});
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
    coordinator=createSaveCoordinator({storage:scopedStorage(),economy:E,model,ownsLock:()=>ownsLock,onFault:code=>{if(window.__tzz)window.__tzz.collectionReadOnly(code);}});
    E.installPreviewCollectionProtocol(coordinator);
    const inspected=coordinator.inspect();
    if(!inspected.ok){notice(inspected.code);releaseLock();return;}
    let load;
    if(inspected.needsConsent){
      const s=inspected.sourceState;
      const balance=s?`${s.coins.toLocaleString('zh-CN')} 金币（零头 ${s.coinFrac} 保留）`:'正常新游戏初始余额 0 金币';
      load=await new Promise(resolve=>{
        const cover=panel(qa?'独立测试存档 · 确认进入':'建立新版预览存档', `${s?'将复制旧预览经营进度：':'未找到旧预览存档，将建立正常新游戏：'}${balance}。只有点击继续才会写入新版预览存档；原预览档和备份、正式经营余额都不会改动。旧页面之后的进度与新版分开，不能自动合并；以后切回旧版也不会自动带回新版进度。卡牌收藏从空白开始，不赠送卡或金币。`,'同意并继续',()=>{resolve(coordinator.initialize({approvedSourceRaw:inspected.sourceRaw,approvedEmpty:!s,now:Date.now()}));});
        const cancel=document.createElement('button');cancel.textContent='暂不进入';cancel.style.cssText='font:inherit;padding:10px 18px;margin-left:12px';cancel.onclick=()=>resolve({ok:false,code:'CONSENT_CANCELLED'});cover.firstChild.append(cancel);
      });
    } else load=coordinator.adopt();
    if(!load.ok){if(load.code==='CONSENT_CANCELLED')panel('尚未建立新版存档','没有迁移或写入进度。');else notice(load.code);releaseLock();return;}
    window.PreviewCollectionRuntime={keys:KEYS,storage:scopedStorage(),coordinator,model,qa,ownsLock:()=>ownsLock,handle:null};
    document.getElementById('collectionStartup')?.remove();
    if(qa){const badge=document.createElement('div');badge.textContent='QA 独立测试存档 · 不读写真正预览或正式存档';badge.style.cssText='position:fixed;top:0;left:0;right:0;z-index:70;background:#ffdf6c;color:#141414;text-align:center;font:12px/1.5 system-ui';document.body.append(badge);}
    await import('../app.js?collectionHost=1c');
    const host=createCollectionHost({coordinator,model,economy:E,getState:()=>window.__tzz.state,replaceState:s=>window.__tzz.collectionReplaceState(s),flush:()=>window.__tzz.persist(),enabled:qa||WALLET_BRIDGE_APPROVED,randomInt:n=>secureRandomInt(crypto,n),makeId:()=>`tx:${crypto.randomUUID()}`});
    window.PreviewCollectionRuntime.handle=message=>host.handle(message);
    window.PreviewCollectionRuntime.snapshot=()=>host.snapshot();
    await lifetime;
  });
}
launch().catch(()=>notice('BOOT_FAILED_READ_ONLY'));
