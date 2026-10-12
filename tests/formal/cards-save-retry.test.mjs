// Real save adapter + extracted production persist/retry/AI functions; isolated memory only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../../cards/cardcore.mjs';
import {createCardSave,SAVE_KEY} from '../../cards/ui/save.mjs';
const src=fs.readFileSync(process.env.CARD_RETRY_SOURCE || new URL('../../cards/ui/app.mjs',import.meta.url),'utf8');
const part=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const functions=[part('function cancelAITimer()', '\nfunction pause('),part('function commitAction(', '\nfunction appendLog('),part('async function persist()', '\nfunction showSaveFail(')];
// scheduleAI is contiguous with commitAction; its actual boundary precedes renderPlayer.
functions[1]=part('function commitAction(', '\nfunction renderPlayer(');
if(!functions[1].includes('function scheduleAI()'))throw Error('AI extraction boundary');
async function harness(active=1){
 const memory=new Map();let fail=false,corrupt=false,gate=null;
 const storage={getItem:k=>memory.get(k)??null,setItem(k,v){if(corrupt&&k===SAVE_KEY){memory.set(k,'isolated corrupt main');throw Error('isolated main/rollback failure');}if(fail)throw Error('isolated quota');memory.set(k,String(v));},removeItem:k=>memory.delete(k)};
 const locks={async request(name,opts,fn){if(gate)await gate;return fn();}};
 const store=createCardSave({storage,locks,core});await store.load();
 let game=core.createGame({heroes:['warrior','mage'],rulesSeed:123,aiSeed:456});
 if(active===1){const action=core.legalActions(game).find(a=>a.type==='end');const r=core.apply(game,{...action,commandId:'to-ai',expectedRevision:game.revision});assert(r.ok);game=r.game;}
 if(active==='ended'){for(let n=0;game.phase!=='ended'&&n<200;n++){const action=core.legalActions(game).find(a=>a.type==='end');const r=core.apply(game,{...action,commandId:'finish-'+n,expectedRevision:game.revision});assert(r.ok);game=r.game;}assert.equal(game.phase,'ended');}
 assert((await store.save(game)).ok);
 const timers=new Map();let serial=0,retry,restore;const elements=new Map();
 const c={...core,game,store,matchScope:{selected:'qa-formal-collection-v1',ready:Promise.resolve()},saveBusy:false,saveFailure:null,lastSave:null,tmpLeftCount:0,saveNote:'',notice:'',
  pauseReasons:new Map(),paused:false,pauseReason:'',closing:false,closeSent:false,aiTimer:null,aiGeneration:0,commandSerial:0,selected:null,handExpanded:false,uiLog:[],
  document:{hidden:false,visibilityState:'visible'},spellFX:{active:()=>false,remaining:()=>0},AI_CARD_READ_MS:100,AI_ACTION_INTERVAL_MS:100,
  render(){c.paused=c.pauseReasons.size>0;c.pauseReason=[...c.pauseReasons.values()].at(-1)||'';},pause(reason,owner='system'){c.pauseReasons.set(owner,reason);c.cancelAITimer();c.render();},
  failText:()=> 'save failed',showSaveFail(){},flushClose(){if(c.closing&&!c.saveBusy&&!c.saveFailure)c.closeSent=true;},
  captureCombat(){},clearCombatFX(){},recordEvent(){},showCombat(){},actionInputGuard:{remember(){},reset(){}},
  actions:()=>core.legalActions(c.game),performance:{now:()=>0},restoreArmed:true,parentPort:{postMessage(){}},
  invalidatePendingImport(){},showResume(){},startFresh(){throw Error('unexpected fresh game');},
  setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
  $(id){if(!elements.has(id))elements.set(id,{close(){},addEventListener(type,fn){if(id==='save-retry')retry=fn;if(id==='save-restore')restore=fn;}});return elements.get(id);}
 };
 vm.createContext(c);vm.runInContext(functions.join('\n'),c);
 vm.runInContext(part("$('save-retry').addEventListener", src.includes('function releaseRecoveredOperationHold(')?'\nfunction releaseRecoveredOperationHold(':"\n$('save-restore').addEventListener"),c);
 return {c,memory,timers,fail(v){fail=v;},corrupt(v){corrupt=v;},defer(p){gate=p;},retry:()=>retry(),tick(){const [id,fn]=timers.entries().next().value||[];assert(fn,'one scheduled AI timer');timers.delete(id);fn();},restore:()=>restore(),retryHandler:()=>retry};
}
const drain=async()=>{for(let n=0;n<15;n++)await Promise.resolve();};
async function failed(active=1){const h=await harness(active);h.fail(true);assert.equal(await h.c.persist(),false);assert(h.c.pauseReasons.has('save'));h.fail(false);return h;}
// Real persist saved while save hold still exists; retry must schedule only after owned hold removal.
{const h=await failed();const revision=h.c.game.revision;await Promise.all([h.retry(),h.retry()]);assert(!h.c.paused);assert.equal(h.timers.size,1);const timer=h.c.aiTimer;await h.retry();assert.equal(h.c.aiTimer,timer,'sequential duplicate retry does not restart timer');h.c.scheduleAI();assert.equal(h.timers.size,1);h.tick();await drain();assert(h.c.game.revision>revision,'AI applies a real core command');assert(h.c.lastSave.ok);}
for(const active of [0,'ended']){const h=await failed(active);const revision=h.c.game.revision;await h.retry();assert(h.c.lastSave.ok,JSON.stringify(h.c.lastSave));assert.equal(h.timers.size,0);assert.equal(h.c.game.revision,revision,'player/ended retry has zero actions');}
// Display reason is deliberately unrelated: capture the save-owned reason, not global pauseReason.
{const h=await failed();h.c.pauseReasons.set('error','independent error');h.c.render();await h.retry();assert(!h.c.pauseReasons.has('save'));assert.equal(h.c.pauseReasons.get('error'),'independent error');assert.equal(h.timers.size,0);}
for(const guard of ['hidden','readonly','scope','closing','closed','busy']){const h=await failed();if(guard==='busy')h.c.saveBusy=true;if(guard==='hidden'){h.c.document.hidden=true;h.c.document.visibilityState='hidden';}if(guard==='readonly')h.c.store={...h.c.store,writable:false};if(guard==='scope')h.c.matchScope.selected=null;if(guard==='closing')h.c.closing=true;if(guard==='closed')h.c.closeSent=true;await h.retry();assert.equal(h.timers.size,0,guard);}
// A completed old retry cannot clear newer holds or schedule against a replacement game.
{const h=await failed();let done;h.defer(new Promise(r=>done=r));const p=h.retry();const newer=core.createGame({heroes:['mage','warrior']});h.c.game=newer;h.c.pauseReasons.set('save','new operation');h.c.saveBusy=true;done();await p;assert.equal(h.c.game,newer);assert.equal(h.c.pauseReasons.get('save'),'new operation');assert.equal(h.c.saveBusy,true);assert.equal(h.timers.size,0);}
for(const mode of ['new game','exit']){const h=await failed();await h.retry();const callback=[...h.timers.values()][0],revision=h.c.game.revision;if(mode==='new game')h.c.game=core.createGame({heroes:['mage','warrior']});else h.c.closing=true;callback();assert.equal(h.c.game.revision,mode==='new game'?0:revision);}
// Real reload/backup recovery releases only the captured collection/exit operation hold.
for(const mode of ['reload','backup','cancel exit']){
 const h=await failed();const owned=mode==='cancel exit'?'正在返回书店':'正在保存收藏牌组新对局';h.c.pauseReasons.set('system',owned);
 vm.runInContext(part('function releaseRecoveredOperationHold(', "\n$('save-download').addEventListener")+'\n'+part('async function boot(', '\n// Embedded in'),h.c);
 if(mode==='backup'){
  const action=core.legalActions(h.c.game).find(a=>a.type==='end'),r=core.apply(h.c.game,{...action,commandId:'before-rollback',expectedRevision:h.c.game.revision});assert(r.ok);h.c.game=r.game;h.corrupt(true);assert.equal(await h.c.persist(),false);assert.equal(h.c.saveFailure.kind,'rollback-failed');h.corrupt(false);await h.c.restoreFromBackup(owned);
 }else if(mode==='cancel exit'){
  h.c.closing=true;h.c.saveFailure={kind:'conflict'};h.restore();await drain();assert.equal(h.c.closing,false);
 }else await h.c.boot(owned);
 assert(!h.c.pauseReasons.has('system'),mode+' '+JSON.stringify(h.c.saveFailure));assert(!h.c.saveFailure);assert(h.c.pauseReasons.has('restore'),mode+' preserves explicit old-match selection');
}
{const h=await failed();vm.runInContext(part('function releaseRecoveredOperationHold(', "\n$('save-restore').addEventListener"),h.c);h.c.pauseReasons.set('system','newer operation');h.c.releaseRecoveredOperationHold('正在保存收藏牌组新对局');assert.equal(h.c.pauseReasons.get('system'),'newer operation');}
console.log('PASS real save adapter + persist/retry/scheduleAI/commitAction: actual AI revision advances; player/end zero actions; dedup, own-save reason, independent holds, safety gates and stale game/timer guards. Node/VM only.');
