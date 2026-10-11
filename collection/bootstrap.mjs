import { KEYS, LOCK_NAME, createSaveCoordinator } from './host-save.mjs?v=formal-cards-candidate-7';
import { createCollectionHost, secureRandomInt } from './host-wallet.mjs?v=formal-cards-candidate-7';
import { WALLET_BRIDGE_APPROVED, EXPECTED_TRIAL_SHA256, APPROVAL_EVIDENCE, CARDS_ENTRY_ENABLED } from './release-gate.mjs?v=formal-cards-candidate-7';
import { TRIAL_CONFIG } from './domain/trial-config.mjs?v=formal-cards-candidate-7';
import { createApprovedTrialModel } from './domain/model.mjs?v=formal-cards-candidate-7';
import { canonical } from './domain/json.mjs?v=formal-cards-candidate-7';

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
function notice(code) {
  const cover=panel('正式存档已保护','没有继续写入或回退旧档。请勿清除浏览器数据或重新开档。请保留原存档和备份，联系维护者导出复核；旧格式需单独确认升级，未完成的旧交易需按原回执核对。','重新检查',()=>location.reload());
  const details=document.createElement('details'),summary=document.createElement('summary'),info=document.createElement('p');summary.textContent='查看维护详情';info.textContent=String(code);details.append(summary,info);cover.firstChild.append(details);
}
function scopedStorage() {
  // QA may only access a synthetic prefix. Real formal and legacy source keys are not touched.
  const prefix=qa?'qa-formal-collection-v1:':'';
  const allowed=new Set(Object.values(KEYS));
  return Object.freeze({getItem(key){if(!allowed.has(key))throw Error('STORAGE_SCOPE');return localStorage.getItem(prefix+key);},setItem(key,value){if(!allowed.has(key)||[KEYS.source,KEYS.sourceBackup,KEYS.v15].includes(key))throw Error('STORAGE_SCOPE');localStorage.setItem(prefix+key,value);}});
}
async function launch() {
  if(new URLSearchParams(location.search).get('test')==='homes'){
    const memory=new Map();
    const coordinator=createSaveCoordinator({storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},economy:E,model:createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:APPROVAL_EVIDENCE,walletBridgeApproved:false}),ownsLock:()=>true});
    window.FormalCollectionRuntime={keys:KEYS,storage:{getItem:()=>null,setItem:()=>{}},coordinator,ownsLock:()=>true,entryEnabled:false};
    await import(new URL(location.pathname.includes('/pet/game/')?'../pet/game/app.js?v=formal-cards-candidate-7':'../app.js?v=formal-cards-candidate-7',import.meta.url));return;
  }
  if(!navigator.locks?.request){notice('SAFE_WEB_LOCK_UNAVAILABLE');return;}
  if(!crypto?.subtle||!crypto?.getRandomValues){notice('SECURE_CONTEXT_REQUIRED');return;}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(TRIAL_CONFIG))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==EXPECTED_TRIAL_SHA256){notice('TRIAL_CONFIG_HASH_MISMATCH');return;}
  const model=createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:APPROVAL_EVIDENCE,walletBridgeApproved:false});
  panel('正在打开正式存档', '若另一个新正式页面仍在运行，请先关闭它。同一时间只允许一个经营页面写入存档。');
  const lockName=qa?'qa:'+LOCK_NAME:LOCK_NAME;
  // Hold the exclusive lock across the entire synchronous parent app lifetime.
  await navigator.locks.request(lockName,{mode:'exclusive'},async()=>{
    ownsLock=true;
    const lifetime=new Promise(resolve=>{releaseLock=()=>{ownsLock=false;resolve();};});
    window.addEventListener('pagehide',()=>queueMicrotask(()=>releaseLock()),{once:true});
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
    coordinator=createSaveCoordinator({storage:scopedStorage(),economy:E,model,ownsLock:()=>ownsLock,onFault:code=>{if(window.__tzz)window.__tzz.collectionReadOnly(code);}});
    E.installFormalCollectionProtocol(coordinator);
    const inspected=coordinator.inspect();
    if(!inspected.ok){notice(inspected.code);releaseLock();return;}
    if(inspected.sourceEvidence?.[KEYS.v15] !== null && inspected.sourceEvidence?.[KEYS.v15] !== undefined){
      try {const a=JSON.parse(inspected.sourceEvidence[KEYS.v15]),payload=JSON.parse(a.payload);
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.payload)))).map(x=>x.toString(16).padStart(2,'0')).join('');
        if(payload.format!==1||payload.release!=='15'||!Object.hasOwn(payload,'main')||!Object.hasOwn(payload,'backup')||![payload.main,payload.backup].every(v=>v===null||typeof v==='string')||digest!==a.sha256)throw Error();
      }catch {notice('V15_SNAPSHOT_INVALID');releaseLock();return;}
    }
    let load;
    if(inspected.needsConfigConsent){
      load=await new Promise(resolve=>{
        const cover=panel('升级卡牌收藏规则','保留当前经营余额、已有普通/金卡、星尘及全部历史回执；启用已确认的新抽卡与普通卡合成规则。取消不会写入。','同意升级',()=>resolve(coordinator.upgradeConfig(inspected.approvedRaw)));
        const cancel=document.createElement('button');cancel.textContent='暂不升级';cancel.onclick=()=>resolve({ok:false,code:'CONSENT_CANCELLED'});cover.firstChild.append(cancel);
      });
    }else if(inspected.needsConsent){
      const s=inspected.sourceState;
      const balance=s?`${s.coins.toLocaleString('zh-CN')} 金币（零头 ${s.coinFrac} 保留）`:'正常新游戏初始余额 0 金币';
      load=await new Promise(resolve=>{
        const cover=panel(qa?'独立测试存档 · 确认进入':'建立新版正式存档', `${s?'将复制旧正式经营进度：':'未找到旧正式存档，将建立正常新游戏：'}${balance}。只有点击继续才会写入新版正式存档；旧正式原档、备份与 v15 快照会保留，新版经营进度写入独立主档。旧页面之后的进度与新版分开，不能自动合并；以后切回旧版也不会自动带回新版进度。卡牌收藏从空白开始，不赠送卡或金币；采用已确认的抽卡与普通卡合成规则。`,'同意并继续',()=>{resolve(coordinator.initialize({approvedSourceRaw:inspected.sourceRaw,approvedSourceEvidence:inspected.sourceEvidence,approvedEmpty:!s,now:Date.now()}));});
        const cancel=document.createElement('button');cancel.textContent='暂不进入';cancel.style.cssText='font:inherit;padding:10px 18px;margin-left:12px';cancel.onclick=()=>resolve({ok:false,code:'CONSENT_CANCELLED'});cover.firstChild.append(cancel);
      });
    } else load=coordinator.adopt();
    if(!load.ok){if(load.code==='CONSENT_CANCELLED')panel('尚未建立新版存档','没有迁移或写入进度。');else notice(load.code);releaseLock();return;}
    window.FormalCollectionRuntime={entryEnabled:CARDS_ENTRY_ENABLED,keys:KEYS,storage:scopedStorage(),coordinator,model,qa,ownsLock:()=>ownsLock,handle:null};
    document.getElementById('collectionStartup')?.remove();
    if(qa){const badge=document.createElement('div');badge.textContent='QA 独立测试存档 · 不读写实际经营存档';badge.style.cssText='position:fixed;top:0;left:0;right:0;z-index:70;background:#ffdf6c;color:#141414;text-align:center;font:12px/1.5 system-ui';document.body.append(badge);}
    await import(new URL(location.pathname.includes('/pet/game/')?'../pet/game/app.js?v=formal-cards-candidate-7':'../app.js?v=formal-cards-candidate-7',import.meta.url));
    const host=createCollectionHost({coordinator,model,economy:E,getState:()=>window.__tzz.state,replaceState:s=>window.__tzz.collectionReplaceState(s),flush:()=>window.__tzz.persist(),enabled:WALLET_BRIDGE_APPROVED,randomInt:n=>secureRandomInt(crypto,n),makeId:()=>`tx:${crypto.randomUUID()}`});
    window.FormalCollectionRuntime.handle=message=>host.handle(message);
    window.FormalCollectionRuntime.snapshot=()=>host.snapshot();
    await lifetime;
  });
}
launch().catch(()=>notice('BOOT_FAILED_READ_ONLY'));
