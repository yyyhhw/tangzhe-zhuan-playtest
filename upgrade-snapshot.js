/* Formal v15 pre-write archive. Both original strings are immutable; never restore
 * this archive over later earnings automatically. Timed-out work cannot write. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FormalUpgrade = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'tangzhe-upgrade-v15-original', LOCK = 'tangzhe-upgrade-v15-snapshot';
  const MAIN = 'tangzhe-save', BACKUP = 'tangzhe-save-bak', TIMEOUT_MS = 5000;
  const fail = stage => ({ok:false, stage, canWrite:() => false});
  function message(stage) {
    const reasons = {
      'storage-quota':'浏览器存储空间不足，升级备份未能保存。请勿清除本站数据；释放其他空间后再刷新。',
      'storage-read':'浏览器无法读取存档或升级备份。请检查浏览器存储权限后刷新。',
      'storage-write':'浏览器拒绝保存升级备份。请检查浏览器存储权限后刷新。',
      'snapshot-write':'升级备份写入后的校验未通过。请保留本站数据，联系维护者检查。',
      'snapshot-invalid':'现有升级备份损坏或校验不一致。请保留本站数据，联系维护者检查。',
      'snapshot-changed':'升级备份发生变化。为保护进度，已暂停保存，请保留数据并联系维护者。',
      'snapshot-missing':'升级备份已丢失。为保护进度，已暂停保存，请保留数据并联系维护者。',
      'source-changed':'其他页面正在更新存档。请关闭其他游戏页面后刷新。',
      'lock-timeout':'等待存档保护超时。请关闭其他游戏页面后刷新；本次等待已取消。',
      'lock-failed':'无法取得存档保护锁。请关闭其他游戏页面后刷新。',
      'locking-unavailable':'此浏览器无法提供存档保护锁。请使用支持该功能的浏览器打开安全页面。',
      'integrity-unavailable':'此页面无法校验升级备份。请使用支持校验的浏览器打开安全页面。',
      'integrity-failed':'升级备份校验未能完成。请保留数据并刷新重试。'
    };
    return '只读保护：不会保存或扣款，原存档保留。' + (reasons[stage] || '升级备份未能完成。请保留数据并联系维护者。');
  }
  async function prepare(opt) {
    const o = opt || {};
    if (!o.locks || typeof o.locks.request !== 'function') return fail('locking-unavailable');
    if (!o.crypto || !o.crypto.subtle) return fail('integrity-unavailable');
    const controller = new AbortController();
    const timeout = Number.isFinite(o.timeoutMs) && o.timeoutMs > 0 ? o.timeoutMs : TIMEOUT_MS;
    const deadline = performance.now() + timeout;
    let stopped = false, timer;
    const expired = () => stopped || performance.now() >= deadline;
    const error = stage => Object.assign(new Error(stage), {stage});
    const check = () => { if (expired()) throw error('lock-timeout'); };
    const read = key => { check(); try { return o.storage.getItem(key); } catch (_) { throw error('storage-read'); } };
    const digest = async text => {
      check(); let bytes;
      try { bytes = await o.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); }
      catch (_) { check(); throw error('integrity-failed'); }
      check(); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
    };
    const timeoutResult = new Promise(resolve => { timer = setTimeout(() => {
      stopped = true; controller.abort(); resolve(fail('lock-timeout'));
    }, timeout); });
    const work = Promise.resolve().then(() => {
      check(); return o.locks.request(LOCK, {mode:'exclusive', signal:controller.signal}, async () => {
        check(); let raw = read(KEY), created = false;
        if (raw === null) {
          const main = read(MAIN), backup = read(BACKUP);
          const payload = JSON.stringify({format:1, release:'15', main, backup});
          const checksum = await digest(payload);
          if (read(MAIN) !== main || read(BACKUP) !== backup || read(KEY) !== null) return fail('source-changed');
          raw = JSON.stringify({payload, sha256:checksum});
          check(); // Also protects against a late lock callback after abort/timeout.
          try { o.storage.setItem(KEY, raw); }
          catch (e) { throw error(e?.name === 'QuotaExceededError' ? 'storage-quota' : 'storage-write'); }
          if (read(KEY) !== raw) return fail('snapshot-write');
          created = true;
        }
        let envelope, payload;
        try { envelope = JSON.parse(raw); payload = JSON.parse(envelope.payload); } catch (_) { return fail('snapshot-invalid'); }
        if (payload.format !== 1 || payload.release !== '15' ||
            !Object.prototype.hasOwnProperty.call(payload,'main') || !Object.prototype.hasOwnProperty.call(payload,'backup') ||
            ![payload.main,payload.backup].every(v => v === null || typeof v === 'string') ||
            await digest(envelope.payload) !== envelope.sha256) return fail('snapshot-invalid');
        if (read(KEY) !== raw) return fail('snapshot-changed');
        if (created && (read(MAIN) !== payload.main || read(BACKUP) !== payload.backup)) return fail('source-changed');
        const gate = {ok:true, created, key:KEY, stage:null, canWrite() {
          if (!gate.ok) return false;
          try { const current = o.storage.getItem(KEY); if (current === raw) return true;
            gate.stage = current === null ? 'snapshot-missing' : 'snapshot-changed';
          } catch (_) { gate.stage = 'storage-read'; }
          gate.ok = false; return false;
        }};
        return gate;
      });
    }).catch(e => fail(expired() ? 'lock-timeout' : e.stage || 'lock-failed'));
    try { return await Promise.race([work, timeoutResult]); }
    finally { stopped = true; clearTimeout(timer); controller.abort(); }
  }
  return {KEY, LOCK, MAIN, BACKUP, TIMEOUT_MS, message, prepare};
});
