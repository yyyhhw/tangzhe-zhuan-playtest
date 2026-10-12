/** Pure guard for the existing pinned host-wallet's durable stage boundaries. */
export function createCardTransitionGuard({model,economy:E,canonical}){
  const same=(a,b)=>canonical(a)===canonical(b),bad=code=>{throw Error(code);};
  return function validateCardTransition(before,after){
    const a=model.restore(before.collection),b=model.restore(after.collection);
    if(!same(a.genesis,b.genesis)||a.schemaVersion!==b.schemaVersion||a.configCanonical!==b.configCanonical||a.configVersion!==b.configVersion)bad('CARD_GENESIS_OR_CONFIG_CHANGED');
    if(b.events.length<a.events.length||a.events.some((e,i)=>!same(e,b.events[i])))bad('CARD_JOURNAL_PREFIX_CHANGED');
    const tail=b.events.slice(a.events.length),kind=tail.map(e=>e.type).join('|');
    if(!['','BEGIN','DECIDE','DECIDE|SELECT','RECORD_DEBIT|COMMIT','COMMIT','SET_PREFERENCE'].includes(kind))bad('CARD_UNSUPPORTED_COMMIT_BOUNDARY');
    if(tail.length&&tail.some(e=>e.txId!==tail[0].txId||e.eventId!==`${e.txId}:${e.type}`))bad('CARD_EVENT_ID_BINDING');
    let replay=a;for(const e of tail)replay=model.reduce(replay,e);
    if(!same(replay,b))bad('CARD_TRANSITION_REPLAY_MISMATCH');
    if(kind==='DECIDE'&&tail[0].decision==='continue'&&!['craft','gild'].includes(a.transactions[tail[0].txId]?.request.kind))bad('CARD_PARTIAL_SELECTION_UNSUPPORTED');
    const ah=before.collectionHost,bh=after.collectionHost;
    if(ah.schemaVersion!==bh.schemaVersion||!same(ah.migration,bh.migration))bad('CARD_HOST_MIGRATION_CHANGED');
    for(const[k,v]of Object.entries(ah.requests))if(!Object.hasOwn(bh.requests,k)||!same(v,bh.requests[k]))bad('CARD_REQUEST_HISTORY_CHANGED');
    const addedRequests=Object.keys(bh.requests).filter(k=>!Object.hasOwn(ah.requests,k));
    if(kind==='BEGIN'){
      if(addedRequests.length!==1)bad('CARD_REQUEST_BINDING');
      const r=bh.requests[addedRequests[0]],e=tail[0];
      if(r.txId!==e.txId||r.requestCanonical!==canonical(e.request))bad('CARD_REQUEST_BINDING');
    }else if(addedRequests.length)bad('CARD_UNEXPECTED_REQUEST');
    for(const[k,v]of Object.entries(ah.acknowledged))if(!Object.hasOwn(bh.acknowledged,k)||bh.acknowledged[k]!==v)bad('CARD_ACK_HISTORY_CHANGED');
    const addedAcks=Object.keys(bh.acknowledged).filter(k=>!Object.hasOwn(ah.acknowledged,k));
    if(kind===''){
      if(addedAcks.length>1||(addedAcks.length===1&&(bh.acknowledged[addedAcks[0]]!==true||b.transactions[addedAcks[0]]?.stage!=='committed')))bad('CARD_ACK_BINDING');
      // Repeated SET_PREFERENCE event IDs are an exact idempotent no-op in the pinned host.
      if(addedAcks.length===0&&!same(ah,bh))bad('CARD_NOOP_HOST_CHANGED');
    }else if(addedAcks.length)bad('CARD_UNEXPECTED_ACK');
    // A host stage may change only its journal/host bookkeeping and the exact
    // already-configured draw debit. Income was flushed separately beforehand.
    const excluded=new Set(['collection','collectionHost','coins','coinFrac']);
    for(const k of new Set([...Object.keys(before),...Object.keys(after)])){
      if(excluded.has(k))continue;
      if(Object.hasOwn(before,k)!==Object.hasOwn(after,k)||!same(before[k],after[k]))bad('CARD_UNRELATED_GAMEPLAY_CHANGE');
    }
    const wallet={coins:before.coins,coinFrac:before.coinFrac};
    if(kind==='RECORD_DEBIT|COMMIT'){
      const id=tail[0].txId,tx=a.transactions[id],receipt=tail[0].walletReceipt;
      if(tx?.debitFailures?.length)bad('CARD_FOREIGN_DEBIT_HISTORY_REQUIRES_REVIEW');
      if(!tx||tx.stage!=='selected'||tx.request.kind!=='draw'||receipt.walletRevision!==before.rev+1||receipt.debitId!==`debit:${id}`)bad('CARD_DEBIT_REVISION_BINDING');
      const paid=E.spendCoins(wallet,model.config.drawPriceGold);if(!paid.ok)bad('CARD_DEBIT_FAILED');
    }else if(kind==='COMMIT'){
      const tx=a.transactions[tail[0].txId];
      if(!tx||tx.stage!=='selected'||!['craft','gild'].includes(tx.request.kind))bad('CARD_UNPAID_DRAW_COMMIT');
    }
    if(after.coins!==wallet.coins||after.coinFrac!==wallet.coinFrac)bad('CARD_WALLET_DELTA_MISMATCH');
    return {ok:true,kind};
  };
}
