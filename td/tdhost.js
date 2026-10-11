// Parent-only campaign controller. Wallet mutations remain in the host's atomic transaction.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tdcore.js'), require('./tdcampaign-progress.js'), require('./tdprogress.js'), require('./tdupgrade-receipts.js'));
  else root.TDHost = factory(root.TDCore, root.TDStageProgress, root.TDProgress, root.TDUpgradeReceipts);
})(this, function (T, P, Archive, Receipts) {
  'use strict';
  const PROTOCOL = 3;
  function create(o) {
    const runs = new Map(), buys = new Map(); let current = null, handshaken = false;
    const progress = () => o.state().tdCampaign === undefined ? P.fresh() : o.state().tdCampaign;
    const snapshot = () => P.legacy(o.state().td);
    const blocked = () => !Receipts || Receipts.check(o.state().tdUpgradeReceipts,o.state().td).length>0 || !P.configured() || !handshaken || !!o.blocked() || !o.state().shops[3].open || P.check(o.state().tdCampaign).length > 0 || (o.state().td50 !== undefined && (!Archive || Archive.check(o.state().td50).length > 0));
    const reply = (extra = {}) => o.send(Object.assign({td:'state',protocol:PROTOCOL,ruleset:P.RULESET_ID,coins:blocked() ? 0 : o.balance(),z:snapshot(),tdCampaign:JSON.parse(JSON.stringify(progress())),...(o.state().td50 === undefined ? {} : {td50:JSON.parse(JSON.stringify(o.state().td50))}),blocked:blocked(),muted:!!o.state().muted},extra));
    const identity = (run,d,kind) => run.mode === kind && run.n === d.n && run.cmd === d.cmd && run.mapId === d.mapId && run.seed === (kind === 'normal' && d.seed === undefined ? 0 : d.seed);
    function msg(d) {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return;
      if (d.td === 'hello') { handshaken = d.protocol === PROTOCOL && d.ruleset === P.RULESET_ID && P.configured(); return reply({ack:'hello',ok:handshaken,why:handshaken ? '' : '塔防规则版本不一致，请刷新经营页和塔防页'}); }
      if (d.td === 'close') return o.close();
      if (!['buy','start','result','endlessStart','endlessResult'].includes(d.td)) return;
      const ack = {ack:d.td,ok:false};
      if (d.td === 'buy') { ack.requestId = typeof d.requestId === 'string' ? d.requestId : null; ack.id = d.id; }
      else ack.runId = typeof d.runId === 'string' ? d.runId : null;
      const fail = why => reply(Object.assign(ack,{why}));
      if (!handshaken || d.ruleset !== P.RULESET_ID) return fail('塔防规则版本不一致，请刷新经营页和塔防页');
      if (d.td === 'start' || d.td === 'endlessStart') {
        const kind = d.td === 'endlessStart' ? 'endless' : 'normal';
        if (!P.validStart(d,kind)) return fail('开局编号、统帅、地图、种子或关卡无效');
        const old = runs.get(d.runId);
        if (old) {
          if (old !== current || !identity(old,d,kind) || old.settled) return fail('这局编号已用过');
          return reply(Object.assign(ack,{ok:!blocked(),cmd:old.cmd,n:old.n,mapId:old.mapId,seed:old.seed,dup:true,why:blocked() ? '只读模式，不能开局' : ''}));
        }
        if (blocked()) return fail('只读模式或科技公司未开张，不能开局');
        if (progress().results.some(r => r.runId === d.runId)) return fail('这局编号已结算');
        if (runs.size >= P.MAX_RESULTS || progress().results.length >= P.MAX_RESULTS) return fail('本页或本规则的结算记录已满，请保留存档');
        if (kind === 'endless' ? !P.endUnlocked(progress()) : !P.unlocked(progress(),d.n)) return fail(kind === 'endless' ? '先通关第50关并保存，再进入无尽' : '请先通关上一关');
        current = {runId:d.runId,n:d.n,cmd:d.cmd,mapId:d.mapId,seed:kind === 'normal' ? 0 : d.seed,mode:kind,settled:false};
        runs.set(d.runId,current); return reply(Object.assign(ack,{ok:true,cmd:current.cmd,n:current.n,mapId:current.mapId,seed:current.seed}));
      }
      if (d.td === 'buy') {
        if (!P.validId(d.requestId) || !T.TOWER_IDS.includes(d.id) || Object.keys(d).some(k=>!['td','ruleset','requestId','id'].includes(k))) return fail('升级请求无效');
        // Resolve an uncertain previous commit through the same owned writer,
        // before examining a stale in-memory level or receipt.
        if(o.reconcile){const resolved=o.reconcile();if(!resolved.ok)return reply(Object.assign(ack,{uncertain:true,why:'保存状态尚未确认，请保留本局并重试确认'}));}
        if(blocked())return fail('只读模式或科技公司未开张，不能升级');
        const ledger=o.state().tdUpgradeReceipts||Receipts.fresh();
        const saved=ledger.receipts.find(r=>r.requestId===d.requestId);
        if(saved){if(saved.id!==d.id)return fail('升级编号不匹配');return reply(Object.assign(ack,{ok:true,dup:true,purchase:{...saved}}));}
        let rec=buys.get(d.requestId);
        if(rec&&rec.id!==d.id)return fail('升级编号不匹配');
        if(ledger.receipts.length>=Receipts.MAX)return fail('升级回执已满，请保留存档并联系维护者');
        if(!rec){if(buys.size>=Receipts.MAX)return fail('本页升级请求已满，请刷新后再试');rec={id:d.id};buys.set(d.requestId,rec);}
        const lv=snapshot().lv[d.id];if(lv>=T.MAX_UP)return fail('已满级');
        const purchase={requestId:d.requestId,id:d.id,fromLevel:lv,toLevel:lv+1,cost:T.price(d.id,lv)};
        const r=o.transact(st=>{
          const z=P.legacy(st.td),history=st.tdUpgradeReceipts||Receipts.fresh();
          if(Receipts.check(history,st.td).length||z.lv[d.id]!==lv||history.receipts.some(r=>r.requestId===d.requestId))return {ok:false,why:'升级状态已变化'};
          z.lv[d.id]++;st.td=z;
          st.tdUpgradeReceipts={...history,receipts:[...history.receipts,purchase]};
          return {ok:true};
        },purchase.cost,'td-buy:'+d.requestId+':'+d.id+':'+lv);
        if(!r.ok){
          if(r.uncertain||r.stage==='save')return reply(Object.assign(ack,{uncertain:true,why:'保存状态尚未确认，请重试确认；不要重复购买'}));
          return fail(r.stage==='pay'?'金币不够或金额无效':'升级未完成，请重试');
        }
        o.changed();return reply(Object.assign(ack,{ok:true,purchase:{...purchase}}));
      }
      const run = runs.get(d.runId), kind = d.td === 'endlessResult' ? 'endless' : 'normal';
      if (!P.validId(d.runId) || !run || !identity(run,d,kind)) return fail('本局登记不匹配');
      if (!P.validResult(d,kind)) return fail('本局结果无效');
      const signature = P.signature(P.receipt(d,kind));
      if (run.result && run.result !== signature) return fail('结算内容已锁定');
      if (run.settled) return reply(Object.assign(ack,{ok:true,dup:true}));
      if (run !== current) return fail('本局已过期');
      if (blocked()) return fail('只读模式，进度未保存');
      run.result = signature;
      const r = o.transact(st => {
        const z = st.tdCampaign === undefined ? P.fresh() : JSON.parse(JSON.stringify(st.tdCampaign));
        if (!(kind === 'endless' ? P.applyEndless(z,d) : P.applyResult(z,d))) return {ok:false,why:'结果无效'};
        st.tdCampaign = z;
        const legacy = P.legacy(st.td); legacy.cmd = run.cmd; st.td = legacy;
        return {ok:true};
      },0,'td-'+kind+':'+d.runId+':'+signature);
      if (!r.ok) return reply(Object.assign(ack,{uncertain:!!r.uncertain || r.stage === 'save',why:'保存状态尚未确认，请重试保存'}));
      run.won = kind === 'normal' && d.win; run.settled = true; o.changed(); return reply(Object.assign(ack,{ok:true}));
    }
    return {msg,reply,reset:() => { current = null; handshaken = false; },get run() { return current; }};
  }
  return {PROTOCOL,create};
});
