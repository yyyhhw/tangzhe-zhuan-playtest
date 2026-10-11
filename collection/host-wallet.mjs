/** Narrow parent-owned wallet commands. Iframe never supplies price, RNG, outcome, or apply. */
import { canonical } from './domain/json.mjs?v=formal-cards-candidate-7';
const clone = x => JSON.parse(JSON.stringify(x));
const idOK = x => typeof x==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(x) && !['__proto__','prototype','constructor'].includes(x);
const fail = code => ({ok:false,code});
const same = (a,b) => canonical(a)===canonical(b);
export const CAPACITY_MARGIN_BYTES = 8192;   // unit: JSON.stringify(...).length (UTF-16 code units), same unit as host-save maxBytes
const MAX_NUMBER_CHARS = 16;                   // Number.MAX_SAFE_INTEGER has 16 digits; all counters are safe integers
const STRUCTURE_SLACK = 64;                    // commas/brackets when objects/arrays go from empty to non-empty
/** Pending committed-but-unacknowledged receipts: each future ack writes `"<txId>":true` plus a comma. Pure, no restore. */
export function pendingAckChars(state) {
  const tx=state?.collection?.transactions||{}, ack=state?.collectionHost?.acknowledged||{};
  let n=0;for(const [id,t] of Object.entries(tx))if(t&&t.stage==='committed'&&ack[id]!==true)n+=JSON.stringify(id).length+6;
  return n;
}
/**
 * Capacity guard (upper bound, no full-history replay).
 * The added text of a whole transaction depends only on: holdings, dust, preferences, the request, ids, tickets/outcome and
 * revision-like counters. We dry-run it on a small TRUSTED proxy collection (model.createState with the same holdings/dust/
 * preferences, empty history), enumerating every card × golden/non-golden outcome, then add a strict correction for every
 * numeric token in the added text (each may grow to 16 digits in the real save) and for top-level counters.
 * Cost: one JSON.stringify of the current save + ~80 tiny trusted steps; it never restores the real event log.
 * Variants that throw are outcomes the real transaction cannot commit either (it fails before any debit), so they need no space;
 * if ALL variants throw the estimate is unavailable and the request is refused.
 */
export function reserveFor({state,model,request,txId,requestId,maxBytes,marginBytes=CAPACITY_MARGIN_BYTES,existing=false,baseChars}) {
  const base=Number.isSafeInteger(baseChars)?baseChars:JSON.stringify(state).length;
  const col=state.collection;
  const proxy=model.createState({holdings:clone(col.holdings),dust:col.dust,preferences:clone(col.preferences)});
  const proxyChars=JSON.stringify(proxy).length;
  const step=(c,type,extra={})=>model.reduce(c,{type,txId,eventId:`${txId}:${type}`,expectedRevision:c.revision,...extra});
  const decide={decision:'continue',allowDustOverflow:true,suppressFutureOverflowWarnings:false};
  const variants=[];
  if(request.kind==='draw'){
    let start=0;const scale=model.config.probabilityScale;
    // Cards of one rarity with the same id length and the same current holdings produce outcomes of identical text length
    // (only the id characters differ), so one representative per class is an exact enumeration, not a sample.
    for(const r of model.config.rarities){const cards=model.config.pool.filter(p=>p.rarity===r.id);const seen=new Set();
      cards.forEach((p,card)=>{const key=p.cardId.length+'|'+JSON.stringify(col.holdings[p.cardId]??null);if(seen.has(key))return;seen.add(key);for(const golden of [0,scale-1])variants.push({rarity:start,card,golden});});start+=r.weight;}
  } else variants.push(null);
  let worst=-1;
  let prefix=null;try{prefix=step(step(proxy,'BEGIN',{request}),'DECIDE',decide);}catch{}
  for(const tickets of variants){try{
    if(!prefix)break;
    let c=prefix;
    if(tickets){c=step(c,'SELECT',{tickets});c=step(c,'RECORD_DEBIT',{walletReceipt:{schemaVersion:1,debitId:`debit:${txId}`,intent:model.walletIntent(c,txId),walletRevision:Number.MAX_SAFE_INTEGER}});}
    c=step(c,'COMMIT');
    const added=JSON.stringify(c.transactions[txId])+JSON.stringify(c.events);
    const numericTokens=(added.match(/-?\d+(\.\d+)?(e[+-]?\d+)?/gi)||[]).length;
    const delta=JSON.stringify(c).length-proxyChars+numericTokens*MAX_NUMBER_CHARS;
    if(delta>worst)worst=delta;
  }catch{}}
  if(worst<0)return {ok:false,code:'CAPACITY_ESTIMATE_UNAVAILABLE',usedBytes:base,maxBytes,estimated:false};
  const host=(existing?0:JSON.stringify(requestId).length+JSON.stringify({txId,requestCanonical:canonical(request)}).length+2)+JSON.stringify(txId).length+6;
  const counters=4*MAX_NUMBER_CHARS;           // parent rev, collection.revision, collectionRevision, dust may each gain digits
  const ackReserve=pendingAckChars(state);      // other receipts still waiting for ack keep their space
  // existing (confirm-time): the real save already holds this tx and its BEGIN event; the bound above covers the final tx
  // and all of its events, so the real text already present can be subtracted without risking an underestimate.
  let present=0;
  if(existing&&col.transactions[txId]){present=JSON.stringify(col.transactions[txId]).length;const ev=col.events.find(e=>e.txId===txId&&e.type==='BEGIN');if(ev)present+=JSON.stringify(ev).length;}
  const needed=base+worst-present+host+counters+STRUCTURE_SLACK+ackReserve+marginBytes;
  return {ok:needed<=maxBytes,usedBytes:base,reserveBytes:needed-base,neededBytes:needed,maxBytes,estimated:true,ackReserveChars:ackReserve,variants:variants.length};
}
export function createCollectionHost({coordinator,model,economy:E,getState,replaceState,flush,enabled=false,randomInt,makeId,capacityMarginBytes=CAPACITY_MARGIN_BYTES}) {
  const preparedCache=new Map();
  const freshId=() => { const id=makeId(); if(!idOK(id)) throw Error('INVALID_HOST_ID'); return id; };
  const step=(state,type,txId,extra={})=>model.reduce(state,{type,txId,eventId:`${txId}:${type}`,expectedRevision:state.revision,...extra});
  const adopt=result=>{if(result.ok) replaceState(clone(result.state));return result;};
  function read() { const result=coordinator.current(); if(!result.ok)return result; return {ok:true,state:getState()}; }
  function snapshot() {
    const loaded=read(); if(!loaded.ok)return loaded;
    const state=loaded.state, c=model.restore(state.collection), h=state.collectionHost;
    const active=c.activeTxId ? c.transactions[c.activeTxId] : null;
    const receipts=Object.values(c.transactions).filter(t=>t.stage==='committed'&&!h.acknowledged[t.txId]).map(t=>({receipt:t.receipt,result:model.publicResult(c,t.txId)}));
    return {ok:true,snapshot:{connected:true,enabled:enabled===true,readOnly:enabled!==true,balance:{coins:state.coins,coinFrac:state.coinFrac,currency:'game-gold'},dust:c.dust,dustCap:model.config.dustBalanceCap,holdings:c.holdings,preferences:c.preferences,probabilities:model.probabilities(),catalog:model.config.pool.map(p=>({...model.cardPolicy(p.cardId),cardId:p.cardId,craftDustCost:model.config.rarities.find(r=>r.id===p.rarity).craftDustCost})),pending:active?{txId:active.txId,stage:active.stage,request:active.request,quote:active.quote}:null,pendingReceipts:receipts,latestReceipt:receipts.at(-1)||null,collectionRevision:c.collectionRevision,configVersion:model.config.configVersion,poolVersion:model.config.poolVersion}};
  }
  function save(draft) { return adopt(coordinator.commit(draft,{allowCollectionChange:true})); }
  function committed(c,txId,replay=false) { const t=c.transactions[txId]; return {ok:true,replay,receipt:clone(t.receipt),result:model.publicResult(c,txId),...snapshot()}; }
  function transactPrepared(txId) {
    const loaded=read(); if(!loaded.ok)return loaded;
    const state=clone(loaded.state), c=model.restore(state.collection), tx=c.transactions[txId];
    if(!tx)return fail('UNKNOWN_TX');
    // Critical: permanent replay lookup BEFORE E.transact can debit anything.
    if(tx.stage==='committed')return committed(c,txId,true);
    if(tx.stage==='cancelled')return {ok:true,cancelled:true,...snapshot()};
    if(tx.stage==='awaiting-decision')return {ok:true,txId,quote:tx.quote,needsDecision:true,...snapshot()};
    if(tx.stage==='debited')return protectDebited(tx);
    if(tx.stage!=='selected')return fail('INVALID_PREPARED_STATE');
    const price=tx.request.kind==='draw'?model.config.drawPriceGold:0;
    if(state.coins<price)return fail('INSUFFICIENT_FUNDS');
    let saveCode=null;
    const result=E.transact(state,{price,apply:draft=>{
      let next=draft.collection;
      if(tx.request.kind==='draw')next=step(next,'RECORD_DEBIT',txId,{walletReceipt:{schemaVersion:1,debitId:`debit:${txId}`,intent:model.walletIntent(next,txId),walletRevision:state.rev+1}});
      next=step(next,'COMMIT',txId); draft.collection=next; return {ok:true};
    },save:draft=>{const r=coordinator.commit(draft,{allowCollectionChange:true});if(!r.ok)saveCode=r.code;return r;}});
    // E.transact restores state in place on any failure: no debit is kept, tx stays PREPARED for resume.
    if(!result.ok)return fail(coordinator.failed||saveCode||'WRITE_FAILED');
    replaceState(clone(state)); preparedCache.delete(txId);return committed(state.collection,txId);
  }
  /**
   * 'debited' persisted on its own cannot prove the gold was actually taken: the formal host writes RECORD_DEBIT and COMMIT in
   * the SAME save, so a separately persisted debited tx comes from a fault, an older/foreign writer or a forged ledger. A
   * replay-consistent ledger plus walletRevision<=rev is NOT wallet evidence (R2 review: unpaid synthetic ledger passed).
   * Policy: always protected. No write, no card, no price-0 commit, original text kept for forensics.
   */
  function protectDebited(tx) {
    return {ok:false,code:'DEBIT_PROVENANCE_UNPROVEN_PROTECTED',protected:true,txId:tx.txId,stage:'debited',
      detail:'debited 状态无法证明钱包已扣款：保持原档，不发卡、不扣费、不重抽，需人工核对。'};
  }
  function selectTickets() {
    const rarity=randomInt(model.config.probabilityScale);
    let sum=0,selected;
    for(const r of model.config.rarities){sum+=r.weight;if(rarity<sum){selected=r.id;break;}}
    if(!selected)throw Error('RNG_OUT_OF_RANGE');
    return {rarity,card:randomInt(model.config.pool.filter(p=>p.rarity===selected).length),golden:randomInt(model.config.probabilityScale)};
  }
  function mutationReady() {
    if(enabled!==true)return fail('WALLET_BRIDGE_DISABLED');
    // Flush income/pet/autosave state through the same synchronous owned writer protocol.
    const current=coordinator.current(); if(!current.ok)return current;
    if(flush()!==true)return fail(coordinator.failed||'PARENT_SAVE_FAILED');
    return read();
  }
  function handle(message) {
    try {
      if(!message||typeof message!=='object'||Array.isArray(message)||message.card!=='collection'||message.protocol!==1||!idOK(message.requestId))return fail('INVALID_PROTOCOL');
      const fields={snapshot:[],quote:['request'],confirm:['txId','decision','allowDustOverflow','suppressFutureOverflowWarnings'],resume:['txId'],'restore-reminders':[],acknowledge:['txId'],'validate-deck':['classId','cards']}[message.command];
      if(!fields||Object.keys(message).some(k=>!['card','protocol','requestId','command',...fields].includes(k)))return fail('INVALID_COMMAND');
      if (['snapshot','resume'].includes(message.command) && coordinator.failed==='COMMIT_UNCERTAIN') {
        const reconciled=coordinator.reconcile(); if(!reconciled.ok)return reconciled;
        replaceState(clone(reconciled.state));
      }
      if(message.command==='snapshot')return snapshot();
      if(message.command==='validate-deck') {
        const current=read();if(!current.ok)return current;
        return {ok:true,...model.inspectDeck(current.state.collection,message.cards,message.classId,30),collectionRevision:current.state.collection.collectionRevision};
      }
      if(message.command==='acknowledge')return acknowledge(message.txId);
      // debited protection happens BEFORE any flush, so no entry point rewrites the main save for a debited tx
      if(message.command==='resume'&&idOK(message.txId)){const d=coordinator.current();if(d.ok&&d.state.collection?.transactions?.[message.txId]?.stage==='debited')return protectDebited(d.state.collection.transactions[message.txId]);}
      const ready=mutationReady();if(!ready.ok)return ready;
      const state=clone(ready.state), c=model.restore(state.collection), h=state.collectionHost;
      if(message.command==='quote') {
        const input=message.request;
        if(!input||typeof input!=='object'||Array.isArray(input))return fail('INVALID_REQUEST');
        const request=input.kind==='draw'&&Object.keys(input).length===1?{kind:'draw'}:input.kind==='craft'&&Object.keys(input).sort().join('|')==='cardId|kind'&&idOK(input.cardId)?{kind:'craft',cardId:input.cardId}:null;
        if(!request)return fail('INVALID_REQUEST');
        const requestCanonical=canonical(request), prior=h.requests[message.requestId];
        if(prior){if(prior.requestCanonical!==requestCanonical)return fail('REQUEST_ID_CONFLICT');const tx=c.transactions[prior.txId];return {ok:true,txId:tx.txId,quote:tx.quote,replay:true,...snapshot()};}
        if(c.activeTxId)return fail('ACTIVE_TRANSACTION_PENDING');
        const quote=model.quote(c,request);
        if(state.coins<quote.goldCost)return fail('INSUFFICIENT_FUNDS');
        const txId=freshId();
        const cap=reserveFor({state,model,request,txId,requestId:message.requestId,maxBytes:coordinator.maxBytes,marginBytes:capacityMarginBytes});
        if(!cap.ok)return {ok:false,code:cap.code||'CAPACITY_LIMIT_REACHED',capacity:cap}; state.collection=step(c,'BEGIN',txId,{request});
        h.requests[message.requestId]={txId,requestCanonical};
        const saved=save(state);return saved.ok?{ok:true,txId,quote,...snapshot()}:saved;
      }
      if(message.command==='restore-reminders') {
        const txId=`settings:${message.requestId}`;
        state.collection=step(c,'SET_PREFERENCE',txId,{suppressOverflowWarning:false});
        const saved=save(state);return saved.ok?snapshot():saved;
      }
      if(!idOK(message.txId))return fail('INVALID_TX_ID');
      const tx=c.transactions[message.txId];if(!tx)return fail('UNKNOWN_TX');
      if(message.command==='acknowledge') {
        if(tx.stage!=='committed')return fail('NO_COMMITTED_RECEIPT');
        if(h.acknowledged[message.txId])return {ok:true,replay:true,...snapshot()};
        h.acknowledged[message.txId]=true;const saved=save(state);return saved.ok?snapshot():saved;
      }
      if(message.command==='resume')return transactPrepared(message.txId);
      const decision={decision:message.decision,allowDustOverflow:message.decision==='cancel'?false:message.allowDustOverflow,suppressFutureOverflowWarnings:message.decision==='cancel'?false:message.suppressFutureOverflowWarnings};
      if(!['continue','cancel'].includes(decision.decision)||typeof decision.allowDustOverflow!=='boolean'||typeof decision.suppressFutureOverflowWarnings!=='boolean')return fail('INVALID_DECISION');
      if(tx.decision&&!same(tx.decision,decision))return fail('TX_DECISION_CONFLICT');
      if(tx.stage==='committed')return committed(c,tx.txId,true);
      if(tx.stage==='cancelled')return {ok:true,cancelled:true,...snapshot()};
      if(tx.stage==='selected')return transactPrepared(tx.txId);
      if(tx.stage!=='awaiting-decision')return fail('INVALID_PREPARED_STATE');
      if(decision.decision==='continue'&&state.coins<tx.quote.goldCost)return fail('INSUFFICIENT_FUNDS');
      if(decision.decision==='continue'){
        // Business saves may have grown since quote: re-check the full remaining transaction before any entropy/debit.
        // Also for a CACHED prepared result (earlier PREPARED write failed): same tickets are kept, never re-rolled,
        // but nothing is persisted unless the latest full save still has room (R2 #1).
        const cap=reserveFor({state,model,request:tx.request,txId:tx.txId,requestId:'',maxBytes:coordinator.maxBytes,marginBytes:capacityMarginBytes,existing:true});
        // canCancel reflects reality: while this session holds cached tickets, cancel is refused (no re-roll in-session)
        if(!cap.ok)return {ok:false,code:cap.code||'CAPACITY_LIMIT_REACHED',capacity:cap,canCancel:!preparedCache.has(tx.txId)};
      }
      const cached=preparedCache.get(tx.txId);
      if(cached){if(!same(cached.decision,decision))return fail('TX_DECISION_CONFLICT');state.collection=cached.collection;}
      else {
        let next=step(c,'DECIDE',tx.txId,decision);
        if(decision.decision==='continue'&&tx.request.kind==='draw')next=step(next,'SELECT',tx.txId,{tickets:selectTickets()});
        state.collection=next;preparedCache.set(tx.txId,{decision:clone(decision),collection:next});
      }
      // PREPARED: selected result + consent durable, no coins/cards/dust changed.
      const prepared=save(state);if(!prepared.ok)return prepared;
      if(decision.decision==='cancel'){preparedCache.delete(tx.txId);return {ok:true,cancelled:true,...snapshot()};}
      return transactPrepared(tx.txId);
    } catch(error){return fail(typeof error?.message==='string'?error.message:'HOST_ERROR');}
  }
  /**
   * Ack never touches coins, so it must not depend on the business flush succeeding (R2 follow-up: a business save refused with
   * CAPACITY_ACK_RESERVED would otherwise block the very ack that frees the reserve). Ack is applied to the DURABLE save, then
   * merged into the live (possibly dirty) memory state: unsaved business progress is kept in memory, never discarded.
   */
  function acknowledge(txId) {
    if(enabled!==true)return fail('WALLET_BRIDGE_DISABLED');
    if(!idOK(txId))return fail('INVALID_TX_ID');
    const durable=coordinator.current();if(!durable.ok)return durable;
    const d=clone(durable.state), c=model.restore(d.collection), tx=c.transactions[txId];
    if(!tx)return fail('UNKNOWN_TX');
    if(tx.stage!=='committed')return fail('NO_COMMITTED_RECEIPT');
    if(d.collectionHost.acknowledged[txId])return {ok:true,replay:true,...snapshot()};
    // Try the normal path first (flush business progress, then ack on top of it).
    const flushed=flush()===true;
    if(flushed){const live=clone(getState());live.collectionHost.acknowledged[txId]=true;const saved=save(live);return saved.ok?snapshot():saved;}
    if(coordinator.failed)return fail(coordinator.failed);
    d.collectionHost.acknowledged[txId]=true;
    const saved=coordinator.commit(d,{allowCollectionChange:true});if(!saved.ok)return saved;
    const live=clone(getState());live.rev=saved.state.rev;live.collectionHost=clone(saved.state.collectionHost);
    replaceState(live);
    return {...snapshot(),ackedOnDurable:true,businessUnsaved:true};
  }
  /** Hanging-transaction recovery (parent-side, not an iframe command). Never decides for the player, never re-rolls. */
  function recoverPending() {
    try {
      if(coordinator.failed==='COMMIT_UNCERTAIN'){const r=coordinator.reconcile();if(!r.ok)return r;replaceState(clone(r.state));}
      const loaded=read();if(!loaded.ok)return loaded;
      const c=model.restore(loaded.state.collection);
      if(!c.activeTxId)return {ok:true,recovered:false,reason:'NO_PENDING'};
      const tx=c.transactions[c.activeTxId];
      if(tx.stage==='awaiting-decision')return {ok:true,recovered:false,txId:tx.txId,needsDecision:true};
      if(!['selected','debited'].includes(tx.stage))return {ok:false,code:'RECOVERY_STAGE_UNSUPPORTED_PROTECTED',stage:tx.stage,txId:tx.txId,protected:true};
      if(enabled!==true)return fail('WALLET_BRIDGE_DISABLED');
      const out=transactPrepared(tx.txId);
      if(out.ok)return {...out,recovered:true,txId:tx.txId,fromStage:tx.stage};
      // Physically no room / unknown commit: keep the locked result, never delete history or re-roll.
      return {...out,protected:true,txId:tx.txId,stage:tx.stage};
    } catch(error){return fail(typeof error?.message==='string'?error.message:'HOST_ERROR');}
  }
  function capacity(request={kind:'draw'}) {
    const loaded=read();if(!loaded.ok)return loaded;
    return {ok:true,...reserveFor({state:loaded.state,model,request,txId:'capacity:probe',requestId:'capacity:probe',maxBytes:coordinator.maxBytes,marginBytes:capacityMarginBytes})};
  }
  return Object.freeze({handle,snapshot,recoverPending,capacity});
}

/** Rejection sampling prevents modulo bias; parent calls it only after Continue. */
export function secureRandomInt(cryptoSource, bound) {
  if(!Number.isSafeInteger(bound)||bound<1||bound>0x100000000||!cryptoSource?.getRandomValues)throw Error('SECURE_RNG_UNAVAILABLE');
  const cutoff=Math.floor(0x100000000/bound)*bound, buffer=new Uint32Array(1);
  for(let tries=0;tries<128;tries++){cryptoSource.getRandomValues(buffer);if(buffer[0]<cutoff)return buffer[0]%bound;}
  throw Error('SECURE_RNG_FAILED');
}
