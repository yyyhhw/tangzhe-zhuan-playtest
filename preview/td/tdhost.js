// Parent-only controller. No storage or wallet of its own: every mutation uses
// the host's E.transact + main-save persist callback, including failed retries.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tdcore.js'));
  else root.TDHost = factory(root.TDCore);
})(this, function (T) {
  'use strict';
  const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(x);
  function create(o) {
    const runs = new Map(), buys = new Map(); let current = null;
    const snapshot = () => T.norm(o.state().td);
    const blocked = () => !!o.blocked() || !o.state().shops[3].open;
    const reply = (extra = {}) => o.send(Object.assign({td:'state', coins:blocked() ? 0 : o.balance(), z:snapshot(), blocked:blocked(), muted:!!o.state().muted}, extra));
    function msg(d) {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return;
      if (d.td === 'hello') return reply();
      if (d.td === 'close') return o.close();
      if (!['buy','start','result'].includes(d.td)) return;
      const ack = {ack:d.td, ok:false};
      if (d.td === 'buy') { ack.requestId = typeof d.requestId === 'string' ? d.requestId : null; ack.id = d.id; }
      else ack.runId = typeof d.runId === 'string' ? d.runId : null;
      const fail = why => reply(Object.assign(ack, {why}));
      if (d.td === 'start') {
        if (!validId(d.runId)) return fail('开局编号无效');
        const old = runs.get(d.runId);
        if (old) {
          if (old !== current || old.n !== d.n || old.cmd !== d.cmd || old.settled) return fail('这局编号已用过');
          return reply(Object.assign(ack, {ok:!blocked(), cmd:old.cmd, n:old.n, dup:true, why:blocked() ? '只读模式，不能开局' : ''}));
        }
        if (blocked()) return fail('只读模式或科技公司未开张，不能开局');
        if (!T.CEO_IDS.includes(d.cmd) || !Number.isInteger(d.n) || d.n < 1 || d.n > Math.min(T.MAX_LV, snapshot().cleared + 1)) return fail('统帅或关卡无效');
        if (runs.size >= 4096) return fail('本页开局次数已满，请刷新后再试');
        current = {runId:d.runId, n:d.n, cmd:d.cmd, settled:false}; runs.set(d.runId, current);
        return reply(Object.assign(ack, {ok:true, cmd:current.cmd, n:current.n}));
      }
      if (d.td === 'buy') {
        if (!validId(d.requestId) || !T.IDS.includes(d.id)) return fail('升级请求无效');
        let rec = buys.get(d.requestId);
        if (rec && rec.id !== d.id) return fail('升级编号不匹配');
        if (rec && rec.done) return reply(Object.assign(ack, {ok:true, dup:true}));
        if (blocked()) return fail('只读模式或科技公司未开张，不能升级');
        if (!rec) {
          if (buys.size >= 4096) return fail('本页升级次数已满，请刷新后再试');
          rec = {id:d.id, done:false}; buys.set(d.requestId, rec);
        }
        const lv = snapshot().lv[d.id];
        if (lv >= T.MAX_UP) return fail('已满级');
        const price = T.price(d.id, lv); // Never accept child prices or balances.
        const r = o.transact(st => { const z = T.norm(st.td); if (z.lv[d.id] !== lv) return {ok:false, why:'等级已变化'}; z.lv[d.id]++; st.td = z; return {ok:true}; }, price);
        if (!r.ok) return fail(r.stage === 'pay' ? '金币不够或金额无效' : '保存失败，没有扣金币或升级');
        rec.done = true; o.changed(); return reply(Object.assign(ack, {ok:true}));
      }
      if (!validId(d.runId)) return fail('结算编号无效');
      const run = runs.get(d.runId);
      if (!run || run !== current || d.cmd !== run.cmd || d.n !== run.n) return fail('本局登记不匹配');
      if (typeof d.win !== 'boolean' || !Number.isInteger(d.waves) || d.waves < 0 || d.waves > T.WAVES || (d.win && d.waves !== T.WAVES) || !Number.isSafeInteger(d.kills) || d.kills < 0) return fail('本局结果无效');
      const signature = JSON.stringify([d.n,d.cmd,d.win,d.waves,d.kills]);
      if (run.result && run.result !== signature) return fail('结算内容已锁定');
      if (run.settled) return reply(Object.assign(ack, {ok:true, dup:true}));
      if (blocked()) return fail('只读模式，进度未保存');
      run.result = signature;
      const r = o.transact(st => { const z = T.norm(st.td); if (!T.applyResult(z,d)) return {ok:false,why:'结果无效'}; z.cmd = run.cmd; st.td = z; return {ok:true}; }, 0);
      if (!r.ok) return fail('保存失败，请重试保存');
      run.settled = true; o.changed(); return reply(Object.assign(ack, {ok:true}));
    }
    return {msg, reply, reset:() => { current = null; }, get run() { return current; }};
  }
  return {create};
});
