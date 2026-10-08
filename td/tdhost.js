// Parent-only controller. Wallet mutations remain inside the host's atomic transaction.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tdcore.js'), require('./tdprogress.js'));
  else root.TDHost = factory(root.TDCore, root.TDProgress);
})(this, function (T, P) {
  'use strict';
  function create(o) {
    const runs = new Map(), buys = new Map(); let current = null, handshaken = false;
    const progress = () => o.state().td50 === undefined ? P.fresh() : o.state().td50;
    const snapshot = () => P.legacy(o.state().td);
    const blocked = () => !P.configured() || !handshaken || !!o.blocked() || !o.state().shops[3].open || P.check(o.state().td50).length > 0;
    const reply = (extra = {}) => o.send(Object.assign({td:'state',protocol:2,ruleset:P.RULESET_ID,coins:blocked() ? 0 : o.balance(),z:snapshot(),td50:JSON.parse(JSON.stringify(progress())),blocked:blocked(),muted:!!o.state().muted},extra));
    function msg(d) {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return;
      if (d.td === 'hello') { handshaken = d.ruleset === P.RULESET_ID && P.configured(); return reply({ack:'hello',ok:handshaken,why:handshaken ? '' : '塔防规则版本不一致，请刷新经营页和塔防页'}); }
      if (d.td === 'close') return o.close();
      if (!['buy','start','result','endlessStart','endlessResult'].includes(d.td)) return;
      const ack = {ack:d.td,ok:false};
      if (d.td === 'buy') { ack.requestId = typeof d.requestId === 'string' ? d.requestId : null; ack.id = d.id; }
      else ack.runId = typeof d.runId === 'string' ? d.runId : null;
      const fail = why => reply(Object.assign(ack,{why}));
      if (!handshaken || d.ruleset !== P.RULESET_ID) return fail('塔防规则版本不一致，请刷新经营页和塔防页');
      if (d.td === 'start' || d.td === 'endlessStart') {
        if (!P.validId(d.runId) || !T.CEO_IDS.includes(d.cmd) || d.n !== 1) return fail('开局编号、统帅或关卡无效');
        const endless = d.td === 'endlessStart', old = runs.get(d.runId);
        if (old) {
          if (old !== current || old.mode !== (endless ? 'endless' : 'normal') || old.n !== d.n || old.cmd !== d.cmd || old.parentRunId !== d.parentRunId || old.settled) return fail('这局编号已用过');
          return reply(Object.assign(ack,{ok:!blocked(),cmd:old.cmd,n:old.n,dup:true,why:blocked() ? '只读模式，不能开局' : ''}));
        }
        if (blocked()) return fail('只读模式或科技公司未开张，不能开局');
        if (progress().results.some(r => r.runId === d.runId)) return fail('这局编号已结算');
        if (runs.size >= P.MAX_RESULTS || progress().results.length >= P.MAX_RESULTS) return fail('本页或本规则的结算记录已满，请保留存档');
        if (endless) {
          const parent = runs.get(d.parentRunId);
          if (!P.validId(d.parentRunId) || !parent || parent !== current || parent.mode !== 'normal' || !parent.settled || !parent.won || parent.n !== d.n || parent.cmd !== d.cmd) return fail('先保存普通50波胜利，再进入无尽');
        }
        current = {runId:d.runId,n:d.n,cmd:d.cmd,mode:endless ? 'endless' : 'normal',parentRunId:endless ? d.parentRunId : undefined,settled:false};
        runs.set(d.runId,current); return reply(Object.assign(ack,{ok:true,cmd:current.cmd,n:current.n}));
      }
      if (d.td === 'buy') {
        if (!P.validId(d.requestId) || !T.TOWER_IDS.includes(d.id)) return fail('升级请求无效');
        let rec = buys.get(d.requestId);
        if (rec && rec.id !== d.id) return fail('升级编号不匹配');
        if (rec && rec.done) return reply(Object.assign(ack,{ok:true,dup:true}));
        if (blocked()) return fail('只读模式或科技公司未开张，不能升级');
        if (!rec) { if (buys.size >= 4096) return fail('本页升级次数已满，请刷新后再试'); rec = {id:d.id,done:false}; buys.set(d.requestId,rec); }
        const lv = snapshot().lv[d.id]; if (lv >= T.MAX_UP) return fail('已满级');
        const r = o.transact(st => { const z = P.legacy(st.td); if (z.lv[d.id] !== lv) return {ok:false,why:'等级已变化'}; z.lv[d.id]++; st.td = z; return {ok:true}; },T.price(d.id,lv));
        if (!r.ok) return fail(r.stage === 'pay' ? '金币不够或金额无效' : '保存失败，没有扣金币或升级');
        rec.done = true; o.changed(); return reply(Object.assign(ack,{ok:true}));
      }
      const run = runs.get(d.runId), kind = d.td === 'endlessResult' ? 'endless' : 'normal';
      if (!P.validId(d.runId) || !run || d.cmd !== run.cmd || d.n !== run.n || run.mode !== kind) return fail('本局登记不匹配');
      const res = Object.assign({},d,kind === 'endless' ? {parentRunId:run.parentRunId} : {});
      if (d.parentRunId !== undefined && d.parentRunId !== run.parentRunId) return fail('无尽前局编号不匹配');
      if (!P.validResult(res,kind)) return fail('本局结果无效');
      const signature = P.signature(P.receipt(res,kind));
      if (run.result && run.result !== signature) return fail('结算内容已锁定');
      if (run.settled) return reply(Object.assign(ack,{ok:true,dup:true}));
      if (run !== current) return fail('本局已过期');
      if (blocked()) return fail('只读模式，进度未保存');
      run.result = signature;
      const r = o.transact(st => {
        const z = st.td50 === undefined ? P.fresh() : JSON.parse(JSON.stringify(st.td50));
        if (!(kind === 'endless' ? P.applyEndless(z,res) : P.applyResult(z,res))) return {ok:false,why:'结果无效'};
        st.td50 = z;
        const legacy = P.legacy(st.td); legacy.cmd = run.cmd; st.td = legacy;
        return {ok:true};
      },0);
      if (!r.ok) return fail('保存失败，请重试保存');
      run.won = kind === 'normal' && d.win; run.settled = true; o.changed(); return reply(Object.assign(ack,{ok:true}));
    }
    return {msg,reply,reset:() => { current = null; handshaken = false; },get run() { return current; }};
  }
  return {create};
});
