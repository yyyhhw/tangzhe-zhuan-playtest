// Fifty distinct campaign stages. Old td / td50 records are archives, never unlock evidence.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tdcore.js'), require('./tdcampaign.js'));
  else root.TDStageProgress = factory(root.TDCore, root.TDCampaign);
})(this, function (T, C) {
  'use strict';
  const SCHEMA_VERSION = 1, STAGE_COUNT = 50, MAX_RESULTS = 4096;
  const RULESET_ID = C && C.RULESET_ID;
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const integer = (x, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(x) && x >= 0 && x <= max;
  const validId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(x);
  const exactKeys = (o, names) => obj(o) && Object.keys(o).length === names.length && names.every(k => Object.prototype.hasOwnProperty.call(o,k));
  const copy = x => JSON.parse(JSON.stringify(x));
  const configured = () => !!(T && C && validId(RULESET_ID) && C.STAGE_COUNT === STAGE_COUNT && typeof C.getStage === 'function' && typeof C.getMap === 'function' && typeof C.mapForSeed === 'function' && typeof C.validSeed === 'function');
  const fresh = () => ({schemaVersion:SCHEMA_VERSION,ruleset:RULESET_ID,highestCleared:0,unlocked:1,stages:{},endless:{best:0,kills:0,top:[]},results:[]});
  const stageNumber = n => Number.isInteger(n) && n >= 1 && n <= STAGE_COUNT;
  const unlocked = (z,n) => !!z && stageNumber(n) && n <= z.unlocked;
  const endUnlocked = z => !!z && z.highestCleared === STAGE_COUNT && !!(z.stages && z.stages[STAGE_COUNT] && z.stages[STAGE_COUNT].cleared);
  function validStart(r,kind) {
    if (!configured() || !obj(r) || r.ruleset !== RULESET_ID || !validId(r.runId) || !T.CEO_IDS.includes(r.cmd)) return false;
    if (kind === 'normal') {
      if (!stageNumber(r.n) || (r.seed !== undefined && r.seed !== 0)) return false;
      const s = C.getStage(r.n);
      return !!s && r.mapId === s.mapId;
    }
    return kind === 'endless' && r.n === STAGE_COUNT && C.validSeed(r.seed) && r.mapId === C.mapForSeed(r.seed) && r.mapId !== 'boss';
  }
  function validResult(r,kind) {
    if (!validStart(r,kind) || !integer(r.kills)) return false;
    if (kind === 'normal') {
      const s = C.getStage(r.n);
      return typeof r.win === 'boolean' && integer(r.waves,s.waves) && (r.bossKilled === undefined || typeof r.bossKilled === 'boolean') && (!r.win || (r.waves === s.waves && (r.n !== STAGE_COUNT || r.bossKilled === true)));
    }
    return integer(r.waves);
  }
  function receipt(r,kind) {
    const v = {runId:r.runId,kind,n:r.n,mapId:r.mapId,seed:kind === 'normal' ? 0 : r.seed,cmd:r.cmd,waves:r.waves,kills:r.kills};
    if (kind === 'normal') { v.win = r.win; v.bossKilled = r.bossKilled === true; }
    return v;
  }
  const signature = r => JSON.stringify([r.kind,r.n,r.mapId,r.seed,r.cmd,r.waves,r.kills,r.win,r.bossKilled]);
  function validReceipt(r) {
    const fields = ['runId','kind','n','mapId','seed','cmd','waves','kills'];
    if (r && r.kind === 'normal') fields.push('win','bossKilled');
    return exactKeys(r,fields) && validResult(Object.assign({ruleset:RULESET_ID},r),r.kind);
  }
  // Rebuild strictly in receipt order so a forged high-stage result cannot fill a gap.
  function advance(z,r) {
    if (r.kind === 'normal') {
      if (!unlocked(z,r.n)) return false;
      const old = z.stages[r.n] || {best:0,cleared:false};
      z.stages[r.n] = {best:Math.max(old.best,r.waves),cleared:old.cleared || r.win};
      if (r.win) z.highestCleared = Math.max(z.highestCleared,r.n);
      z.unlocked = Math.min(STAGE_COUNT,z.highestCleared + 1);
      return true;
    }
    return endUnlocked(z) && T.applyEndless(z,r);
  }
  function check(z) {
    if (z === undefined) return [];
    if (!configured()) return ['tdCampaign.module'];
    if (!obj(z)) return ['tdCampaign'];
    const bad = [];
    if (z.schemaVersion !== SCHEMA_VERSION || z.ruleset !== RULESET_ID) bad.push('tdCampaign.version');
    if (!exactKeys(z,['schemaVersion','ruleset','highestCleared','unlocked','stages','endless','results']) || !integer(z.highestCleared,STAGE_COUNT) || !stageNumber(z.unlocked) || !obj(z.stages)) bad.push('tdCampaign.progress');
    if (obj(z.stages)) for (const [n,s] of Object.entries(z.stages)) {
      if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(n) || !exactKeys(s,['best','cleared']) || !integer(s.best,C.getStage(Number(n)).waves) || typeof s.cleared !== 'boolean') { bad.push('tdCampaign.progress'); break; }
    }
    const e = z.endless;
    if (!exactKeys(e,['best','kills','top']) || !integer(e.best) || !integer(e.kills) || !T.validTop(e.top) || e.top.some(r => !exactKeys(r,['runId','waves','kills','score']))) bad.push('tdCampaign.endless');
    if (!Array.isArray(z.results) || z.results.length > MAX_RESULTS) bad.push('tdCampaign.results');
    else {
      const expected = fresh(), ids = new Set();
      for (const r of z.results) {
        if (!validReceipt(r) || ids.has(r.runId) || !advance(expected,r)) { bad.push('tdCampaign.results'); break; }
        ids.add(r.runId);
      }
      if (!bad.includes('tdCampaign.results')) {
        if (z.highestCleared !== expected.highestCleared || z.unlocked !== expected.unlocked || !obj(z.stages) || Object.keys(z.stages).length !== Object.keys(expected.stages).length || Object.keys(expected.stages).some(n => !z.stages[n] || z.stages[n].best !== expected.stages[n].best || z.stages[n].cleared !== expected.stages[n].cleared)) bad.push('tdCampaign.progress');
        if (!bad.includes('tdCampaign.endless') && (e.best !== expected.endless.best || e.kills !== expected.endless.kills || e.top.length !== expected.endless.top.length || e.top.some((r,i) => ['runId','waves','kills','score'].some(k => r[k] !== expected.endless.top[i][k])))) bad.push('tdCampaign.endless');
      }
    }
    return [...new Set(bad)];
  }
  function apply(z,res,kind) {
    if (!z || check(z).length || !validResult(res,kind)) return false;
    const rec = receipt(res,kind), prior = z.results.find(r => r.runId === rec.runId);
    if (prior) return signature(prior) === signature(rec);
    if (z.results.length >= MAX_RESULTS || !advance(z,rec)) return false;
    z.results.push(rec);
    return true;
  }
  const legacy = raw => T.norm(raw);
  const view = (raw,z) => Object.assign({},legacy(raw),{tdCampaign:copy(z === undefined ? fresh() : z)});
  return {SCHEMA_VERSION,STAGE_COUNT,MAX_RESULTS,RULESET_ID,configured,validId,validStart,validResult,fresh,check,legacy,view,signature,receipt,unlocked,endUnlocked,
    applyResult:(z,r) => apply(z,r,'normal'),applyEndless:(z,r) => apply(z,r,'endless')};
});
