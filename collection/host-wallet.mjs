/** Narrow parent-owned wallet commands. Iframe never supplies price, RNG, outcome, or apply. */
import { canonical } from './domain/json.mjs?v=formal-cards-candidate-7';
const clone = x => JSON.parse(JSON.stringify(x));
const idOK = x => typeof x==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(x) && !['__proto__','prototype','constructor'].includes(x);
const fail = code => ({ok:false,code});
const same = (a,b) => canonical(a)===canonical(b);
export function createCollectionHost({coordinator,model,economy:E,getState,replaceState,flush,enabled=false,randomInt,makeId}) {
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
    if(tx.stage!=='selected')return fail('INVALID_PREPARED_STATE');
    const price=tx.request.kind==='draw'?model.config.drawPriceGold:0;
    if(state.coins<price)return fail('INSUFFICIENT_FUNDS');
    const result=E.transact(state,{price,apply:draft=>{
      let next=draft.collection;
      if(tx.request.kind==='draw')next=step(next,'RECORD_DEBIT',txId,{walletReceipt:{schemaVersion:1,debitId:`debit:${txId}`,intent:model.walletIntent(next,txId),walletRevision:state.rev+1}});
      next=step(next,'COMMIT',txId); draft.collection=next; return {ok:true};
    },save:draft=>coordinator.commit(draft,{allowCollectionChange:true})});
    if(!result.ok)return fail(coordinator.failed||'WRITE_FAILED');
    replaceState(clone(state)); preparedCache.delete(txId);return committed(state.collection,txId);
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
        const txId=freshId(); state.collection=step(c,'BEGIN',txId,{request});
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
  return Object.freeze({handle,snapshot});
}

/** Rejection sampling prevents modulo bias; parent calls it only after Continue. */
export function secureRandomInt(cryptoSource, bound) {
  if(!Number.isSafeInteger(bound)||bound<1||bound>0x100000000||!cryptoSource?.getRandomValues)throw Error('SECURE_RNG_UNAVAILABLE');
  const cutoff=Math.floor(0x100000000/bound)*bound, buffer=new Uint32Array(1);
  for(let tries=0;tries<128;tries++){cryptoSource.getRandomValues(buffer);if(buffer[0]<cutoff)return buffer[0]%bound;}
  throw Error('SECURE_RNG_FAILED');
}
