// Extracted production functions and in-memory state only; no browser or user storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=fs.readFileSync(process.env.CARD_PAUSE_SOURCE || path.join(root,'cards/ui/app.mjs'),'utf8');
const core=await import(pathToFileURL(path.join(root,'cards/cardcore.mjs')));
const {createMatchStorageScope}=await import(pathToFileURL(path.join(root,'cards/ui/match-storage-scope.mjs')));
const extract=(start,end)=>src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));
const deckFunction=extract('async function startCollectionDeck(', '\ncollection = mountCollection(');
const audioFunction=extract('function recoverForegroundAudio()', '\nfunction hidePage()');
const resumeFunction=extract('function resume()', '\nfunction combatEntityName(');
const foregroundFunction=extract('function returnToForeground()', '\ndocument.addEventListener(\'visibilitychange\'');
const renderHead=extract('function render() {','\n  bgm.update(')+'\n}';
function harness(save=async()=>({ok:true})){
 const callbacks=[];let dialogs=1,ai=0;
 const c={game:core.createGame({heroes:['warrior','mage']}),cardcore:core,createGame:core.createGame,
  saveBusy:false,saveFailure:null,closing:false,closeSent:false,store:{writable:true,save},matchScope:{selected:'qa-formal-collection-v1'},
  pauseReasons:new Map([['settings','牌册已打开']]),paused:true,pauseReason:'',resumeAfterSettings:false,
  foregroundPending:false,foregroundTimer:null,foregroundGeneration:0,muted:false,
  portrait:{matches:false},document:{hidden:false,visibilityState:'visible',querySelector:()=>dialogs?{}:null},
  pause(reason,owner='system'){c.pauseReasons.set(owner,reason);c.syncPauseReasons();},
  syncPauseReasons(){c.paused=c.pauseReasons.size>0;},clearCombatFX(){},cancelAITimer(){},invalidatePendingImport(){},
  actionInputGuard:{reset(){}},flushClose(){},showSaveFail(){},failText:()=> 'save failed',
  tmpLeftCount:0,resultRecoveryNote:'',selected:null,uiLog:[],recentPlayedCards:[],notice:'',saveNote:'',lastSave:null,
  bgm:{status:{state:'locked'},unlock(){}},combatAudio:{status:{state:'locked'},unlock(){},resumeExisting(){}},
  setTimeout(fn){callbacks.push(fn);return callbacks.length;},scheduleAI(){ai++;}
 };
 vm.createContext(c);vm.runInContext(deckFunction+'\n'+audioFunction+'\n'+resumeFunction+'\n'+foregroundFunction+'\n'+renderHead,c);
 return {c,callbacks,get ai(){return ai;},closeDialogs(){dialogs=0;c.resumeAfterSettings=true;c.render();},openDialogs(){dialogs=1;}};
}
const recipe={validated:true,classId:'warrior',cards:core.defaultDeck('warrior')};
// First new game and a fresh iframe instance after close/reopen both start after verified save/dialog close.
for(const label of ['first open','close and reopen']){
 const h=harness();await h.c.startCollectionDeck(recipe);assert(h.c.paused,label+' dialog still blocks');
 h.closeDialogs();assert.equal(h.c.paused,false,label);assert.equal(h.c.saveBusy,false);assert.equal(h.c.lastSave.ok,true);
}
// Save pending never replaces the old in-memory match or releases input; resume is blocked.
let settle;const pending=new Promise(r=>settle=r),h=harness(()=>pending),old=h.c.game;
const starting=h.c.startCollectionDeck(recipe);assert.equal(h.c.game,old);assert(h.c.saveBusy);h.closeDialogs();h.c.resume();assert(h.c.paused);
settle({ok:true});await starting;assert.notEqual(h.c.game,old);assert.equal(h.c.paused,false);
// Failed save preserves the old match and all safety holds. No storage keys or protocol are changed.
const failed=harness(async()=>({ok:false,kind:'before-commit'})),oldFailed=failed.c.game;
await assert.rejects(failed.c.startCollectionDeck(recipe));failed.closeDialogs();failed.c.resume();
assert.equal(failed.c.game,oldFailed);assert(failed.c.paused);assert(failed.c.saveFailure);assert(failed.c.pauseReasons.has('save'));
// A newer system/visibility/orientation reason while saving is not removed by completion.
for(const owner of ['system','visibility','readonly']){
 let done;const h=harness(()=>new Promise(r=>done=r));const p=h.c.startCollectionDeck(recipe);
 h.c.pauseReasons.set(owner,'new safety hold');done({ok:true});await p;h.closeDialogs();assert(h.c.paused);assert.equal(h.c.pauseReasons.get(owner),'new safety hold');
}
// Existing-match explicit Continue and foreground return must not re-pause merely because audio is locked.
for(const entry of ['continue saved match','foreground recovery']){
 const h=harness();h.closeDialogs();h.c.pauseReasons.set(entry==='foreground recovery'?'visibility':'restore','held');h.c.syncPauseReasons();
 if(entry==='foreground recovery')h.c.returnToForeground();else h.c.resume();
 assert.equal(h.c.paused,false);h.c.recoverForegroundAudio();for(const fn of h.callbacks)fn();assert.equal(h.c.paused,false,entry);assert(!h.c.pauseReasons.has('audio'));
}
// Orientation never blocks human actions; readOnly, loading and unauthorized scope still do.
const human=extract('function humanTurn()', '\n// Availability');
{const h=harness();h.closeDialogs();h.c.spellFX={active:()=>false};vm.runInContext(human,h.c);h.c.portrait.matches=true;assert(h.c.humanTurn());h.c.portrait.matches=false;assert(h.c.humanTurn());h.c.store.writable=false;assert.equal(h.c.humanTurn(),false);h.c.store.writable=true;h.c.matchScope.selected=null;assert.equal(h.c.humanTurn(),false);h.c.matchScope.selected='qa-formal-collection-v1';h.c.pauseReasons.set('loading','loading');h.c.syncPauseReasons();assert.equal(h.c.humanTurn(),false);}
assert(!src.includes('portrait.matches'));assert(!src.includes("$('pause')"));assert(!read('cards/ui/index.html').includes('id="pause"'));assert(!read('cards/ui/index.html').includes('rotate-prompt'));assert(!read('cards/ui/battlefield.css').includes('.table{visibility:hidden}'));
// Handshake negative controls use the unchanged real scope module with an isolated memory store.
let reads=0,writes=0;const scope=createMatchStorageScope({storage:{getItem(){reads++;return null;},setItem(){writes++;}},locks:null,embedded:true,hostname:'127.0.0.1',qaRequested:true});
let ready=false;scope.ready.then(()=>ready=true);
assert.throws(()=>scope.storage.getItem('tangzhe-formal-card-save'),/PENDING/);
assert.equal(scope.authorize({matchStorageProtocol:1,matchStorageScope:'formal'}),false);await Promise.resolve();assert.equal(ready,false);assert.equal(reads+writes,0);
assert.equal(scope.authorize({matchStorageProtocol:1,matchStorageScope:'qa-formal-collection-v1'}),true);await scope.ready;assert.equal(ready,true);assert.equal(reads+writes,0);
const parent=read('app.js');assert(parent.includes("f.contentWindow.postMessage({ card:'port', matchStorageProtocol:1"));
assert(src.includes("e.origin !== location.origin || e.source !== window.parent"));assert(src.includes('await matchScope.ready;'));
// Execute the actual embedded message listener. Wrong origin/source cannot authorize a port.
{let handler,authorized=0;const trustedParent={},port={close(){},postMessage(){}};
 const context={embed:true,document:{body:{classList:{add(){}}}},$:()=>({addEventListener(){}}),requestExit(){},window:{parent:trustedParent,addEventListener(type,fn){handler=fn;}},location:{origin:'https://qa.invalid'},matchScope:{authorize(){authorized++;return true;}},parentPort:null,collection:null,onParent(){},flushClose(){},render(){}};
 vm.createContext(context);vm.runInContext(extract('if (embed) {','\n// Every drop'),context);
 for(const event of [{origin:'https://other.invalid',source:trustedParent},{origin:'https://qa.invalid',source:{}}])handler({...event,data:{card:'port'},ports:[port]});
 assert.equal(authorized,0);handler({origin:'https://qa.invalid',source:trustedParent,data:{card:'port'},ports:[port]});assert.equal(authorized,1);assert.equal(context.parentPort,port);
}
// Retry and recovery scheduling use the real adapter chain in cards-save-retry.test.mjs.
const token='cards64-owned-retry-over-9ad9000-20261012-r1';
assert.equal(JSON.parse(read('version.json')).v,'formal-'+token);assert(read('index.html').includes('collection/bootstrap.mjs?v='+token));
assert(read('collection/bootstrap.mjs').includes('../app.js?v='+token));assert(parent.includes("CARDS_V='"+token+"'"));assert(read('cards/ui/index.html').includes('./app.mjs?v='+token));
console.log('PASS Node/VM: first/reopen, verified/pending/failed save, concurrent safety holds, saved-match Continue, foreground locked audio, handshake negative controls and root-to-card module cache chain; browser acceptance unrun.');
