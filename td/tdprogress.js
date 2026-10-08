// Versioned 50-wave progress. Legacy td and its 10-wave records are never upgraded in place.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tdcore.js'), require('./tdwaves.js'));
  else root.TDProgress = factory(root.TDCore, root.TDWaves);
})(this, function (T, W) {
  'use strict';
  const SCHEMA_VERSION = 1, NORMAL_WAVES = 50, MAX_RESULTS = 4096;
  const RULESET_ID = W && W.RULES_VERSION;
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const integer = (x, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(x) && x >= 0 && x <= max;
  const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(x);
  const exactKeys = (o, names) => obj(o) && Object.keys(o).every(k => names.includes(k));
  const copy = x => JSON.parse(JSON.stringify(x));
  const configured = () => validId(RULESET_ID) && W.NORMAL_WAVES === NORMAL_WAVES;
  const fresh = () => ({schemaVersion:SCHEMA_VERSION, ruleset:RULESET_ID, best:0, cleared:0, endless:{best:0,kills:0,top:[]}, results:[]});
  function validResult(r, kind) {
    if (!obj(r) || r.ruleset !== RULESET_ID || !validId(r.runId) || r.n !== 1 || !T.CEO_IDS.includes(r.cmd) || !integer(r.kills)) return false;
    if (kind === 'normal') return typeof r.win === 'boolean' && integer(r.waves,NORMAL_WAVES) && (!r.win || r.waves === NORMAL_WAVES);
    return kind === 'endless' && integer(r.waves) && (r.parentRunId === undefined || validId(r.parentRunId));
  }
  function receipt(r, kind) {
    const v = {runId:r.runId,kind,n:r.n,cmd:r.cmd,waves:r.waves,kills:r.kills};
    if (kind === 'normal') v.win = r.win;
    else v.parentRunId = r.parentRunId;
    return v;
  }
  const signature = r => JSON.stringify([r.kind,r.n,r.cmd,r.waves,r.kills,r.win,r.parentRunId]);
  function validReceipt(r) {
    const fields = ['runId','kind','n','cmd','waves','kills',r && r.kind === 'normal' ? 'win' : 'parentRunId'];
    return exactKeys(r,fields) && validResult(Object.assign({ruleset:RULESET_ID},r),r.kind) && (r.kind !== 'endless' || validId(r.parentRunId));
  }
  function check(z) {
    if (z === undefined) return [];
    const bad = [];
    if (!configured()) return ['td50.module'];
    if (!obj(z)) return ['td50'];
    if (z.schemaVersion !== SCHEMA_VERSION || z.ruleset !== RULESET_ID) bad.push('td50.version');
    if (!exactKeys(z,['schemaVersion','ruleset','best','cleared','endless','results']) || !integer(z.best,NORMAL_WAVES) || !integer(z.cleared,1) || (z.cleared === 1 && z.best !== NORMAL_WAVES)) bad.push('td50.progress');
    const e = z.endless;
    if (!exactKeys(e,['best','kills','top']) || !integer(e.best) || !integer(e.kills) || !T.validTop(e.top) || e.top.some(r => !exactKeys(r,['runId','waves','kills','score']) || r.waves > e.best || r.kills > e.kills)) bad.push('td50.endless');
    if (!Array.isArray(z.results) || z.results.length > MAX_RESULTS) bad.push('td50.results');
    else {
      const ids = new Set(), byId = new Map();
      for (const r of z.results) {
        if (!validReceipt(r) || ids.has(r.runId)) { bad.push('td50.results'); break; }
        ids.add(r.runId); byId.set(r.runId,r);
        if (r.kind === 'normal' && (r.waves > z.best || (r.win && z.cleared !== 1))) { bad.push('td50.results'); break; }
        if (r.kind === 'endless' && (!obj(e) || r.waves > e.best || r.kills > e.kills)) { bad.push('td50.results'); break; }
      }
      if (!bad.includes('td50.results')) {
        const normals = z.results.filter(r => r.kind === 'normal'), endless = z.results.filter(r => r.kind === 'endless');
        if (z.best !== normals.reduce((best,r) => Math.max(best,r.waves),0) || z.cleared !== (normals.some(r => r.win) ? 1 : 0)) bad.push('td50.progress');
        if (!bad.includes('td50.endless') && (e.best !== endless.reduce((best,r) => Math.max(best,r.waves),0) || e.kills !== endless.reduce((best,r) => Math.max(best,r.kills),0) || (z.cleared === 0 && (e.best !== 0 || e.kills !== 0 || e.top.length > 0)))) bad.push('td50.endless');
        for (const r of z.results) {
          if (r.kind !== 'endless') continue;
          const parent = byId.get(r.parentRunId);
          if (!parent || parent.kind !== 'normal' || !parent.win || parent.waves !== NORMAL_WAVES || parent.cmd !== r.cmd || parent.n !== r.n) { bad.push('td50.results'); break; }
        }
        if (!bad.includes('td50.endless')) {
          const expected = endless.map(r => ({runId:r.runId,waves:r.waves,kills:r.kills,score:T.score(r.waves,r.kills)})).sort((a,b) => b.score-a.score).slice(0,10);
          if (e.top.length !== expected.length || e.top.some((r,i) => r.runId!==expected[i].runId || r.waves!==expected[i].waves || r.kills!==expected[i].kills || r.score!==expected[i].score)) bad.push('td50.endless');
        }
        if (!bad.includes('td50.endless')) for (const entry of e.top) {
          const saved = byId.get(entry.runId);
          if (!saved || saved.kind !== 'endless' || saved.waves !== entry.waves || saved.kills !== entry.kills) { bad.push('td50.endless'); break; }
        }
      }
    }
    return [...new Set(bad)];
  }
  const legacy = raw => T.norm(raw); // TDCore intentionally keeps the immutable 10-wave contract.
  function view(old, z) {
    const oldView = legacy(old), current = z === undefined ? fresh() : z;
    return Object.assign({},oldView,{best:current.best,cleared:current.cleared,endless:copy(current.endless),legacy:oldView,td50:copy(current)});
  }
  function apply(z,res,kind) {
    if (check(z).length || !validResult(res,kind)) return false;
    const rec = receipt(res,kind), prior = z.results.find(r => r.runId === rec.runId);
    if (prior) return signature(prior) === signature(rec);
    if (z.results.length >= MAX_RESULTS) return false;
    if (kind === 'normal') {
      z.best = Math.max(z.best,res.waves);
      if (res.win) z.cleared = 1;
    } else {
      if (!validId(res.parentRunId)) return false;
      const parent = z.results.find(r => r.runId === res.parentRunId);
      if (!parent || parent.kind !== 'normal' || !parent.win || parent.waves !== NORMAL_WAVES || parent.n !== res.n || parent.cmd !== res.cmd) return false;
      if (!T.applyEndless(z,res)) return false;
    }
    z.results.push(rec);
    return true;
  }
  return {SCHEMA_VERSION,NORMAL_WAVES,MAX_RESULTS,RULESET_ID,configured,validId,validResult,fresh,check,legacy,view,signature,receipt,
    applyResult:(z,r) => apply(z,r,'normal'), applyEndless:(z,r) => apply(z,r,'endless')};
});
