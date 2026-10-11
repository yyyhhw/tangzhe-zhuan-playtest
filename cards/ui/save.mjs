/** Preview-only card save slot. One resumable game, a verified backup and a quarantine copy.
 * Never touches business saves or the formal card key. Writes only inside the Web Lock.
 */
export const SAVE_KEY = 'tangzhe-formal-card-save';
export const TMP_KEY = SAVE_KEY + '-tmp';
export const BAK_KEY = SAVE_KEY + '-bak';
export const QUARANTINE_KEY = SAVE_KEY + '-quarantine';
export const CARD_KEYS = Object.freeze([SAVE_KEY, TMP_KEY, BAK_KEY, QUARANTINE_KEY]);
/** Web Lock name, not a localStorage key. */
export const LOCK_NAME = SAVE_KEY + ':write';
export const ENVELOPE_NS = 'tangzhe-card-save';
export const DATA_VERSION = 2;
const VERSION_FIELDS = ['rulesVersion', 'cardPoolVersion', 'deckRulesVersion', 'cardDefinitionSchemaVersion'];

export function createCardSave({storage, locks, core, now = () => Date.now()}) {
  const {serialize, deserialize} = core;
  let knownMain;            // raw main text this page last read or wrote (CAS)
  let knownMainValid = false;
  let slotRev = 0;
  let readOnly = false;
  let failMain, failBak;     // main / bak text observed when the main became uncertain
  let pendingRestore = false, mainObserved = false;
  let lastSaved = null;     // {revision, turn} of the last verified successful save

  const get = (k) => storage.getItem(k);
  const lockAvailable = () => !!(locks && typeof locks.request === 'function');

  function parse(text) {
    if (text === null || text === undefined) return {state: 'missing'};
    let env;
    try { env = JSON.parse(text); } catch { return {state: 'corrupt', why: 'JSON 解析失败'}; }
    if (!env || typeof env !== 'object' || env.ns !== ENVELOPE_NS) return {state: 'corrupt', why: '命名空间不符'};
    if (!Number.isInteger(env.dataVersion)) return {state: 'corrupt', why: '缺少数据版本'};
    if (env.dataVersion > DATA_VERSION) return {state: 'future', why: `存档数据版本 ${env.dataVersion} 比当前页面新`};
    if (![1, DATA_VERSION].includes(env.dataVersion)) return {state: 'corrupt', why: '数据版本不认识'};
    if (!Number.isInteger(env.slotRev) || env.slotRev < 1 || typeof env.game !== 'string') return {state: 'corrupt', why: '存档结构不完整'};
    let game;
    try { game = deserialize(env.game); } catch (e) { return {state: 'corrupt', why: `对局校验失败：${e.message}`}; }
    if (env.dataVersion === 1 && !core.isLegacyVersion?.(game)) return {state: 'corrupt', why: '旧数据信封不可包含新规则对局'};
    for (const f of VERSION_FIELDS) if (env[f] !== game[f]) return {state: 'corrupt', why: '版本号与对局不一致'};
    if (!env.meta || env.meta.revision !== game.revision) return {state: 'corrupt', why: '进度信息与对局不一致'};
    return {state: 'ok', env, game};
  }

  function envelope(game, rev) {
    const env = {ns: ENVELOPE_NS, dataVersion: DATA_VERSION, slotRev: rev, savedAt: now()};
    for (const f of VERSION_FIELDS) env[f] = game[f];
    env.game = serialize(game);
    env.meta = {revision: game.revision, turn: game.turn, heroes: game.players.map((p) => p.classId)};
    return JSON.stringify(env);
  }

  function withLock(fn) {
    return locks.request(LOCK_NAME, {mode: 'exclusive'}, async () => fn());
  }

  function backupVerified() {
    try { return parse(get(BAK_KEY)).state === 'ok'; } catch { return false; }
  }

  async function quarantine(raw) {
    if (!lockAvailable()) return 'no-lock';
    try {
      return await withLock(() => {
        if ([get(SAVE_KEY), get(BAK_KEY)].some(text => parse(text).state === 'future')) { readOnly = true; return 'future'; }
        if (get(QUARANTINE_KEY) !== null) return 'occupied';
        storage.setItem(QUARANTINE_KEY, raw);
        return get(QUARANTINE_KEY) === raw ? 'saved' : 'failed';
      });
    } catch { return 'failed'; }
  }

  /** Reads without the lock. Only the quarantine copy is written (inside the lock). */
  async function load() {
    pendingRestore = false;
    lastSaved = null; knownMain = undefined; knownMainValid = false; slotRev = 0;
    let raw;
    try { raw = get(SAVE_KEY); } catch (e) { readOnly = true; return {status: 'unrecoverable', why: '无法读取存档', quarantine: null, writable: false}; }
    readOnly = false;
    knownMain = raw; knownMainValid = false; slotRev = 0;
    const main = parse(raw);
    // A newer envelope in either slot must be protected before any quarantine or write.
    let bakRaw = null;
    try { bakRaw = get(BAK_KEY); } catch { /* treated as missing on read-only load */ }
    const bak = parse(bakRaw);
    for (const entry of [main, bak]) if (entry.state === 'future') { readOnly = true; return {status: 'future', why: entry.why}; }
    if (main.state === 'ok') {
      knownMainValid = true; slotRev = main.env.slotRev;
      lastSaved = {revision: main.game.revision, turn: main.game.turn};
      return {status: 'ok', game: main.game, revision: main.game.revision, turn: main.game.turn, writable: lockAvailable()};
    }
    if (main.state === 'future') { readOnly = true; return {status: 'future', why: main.why}; }
    let q = null;
    if (main.state === 'corrupt') q = await quarantine(raw);
    if (readOnly) return {status: 'future', why: '较新版本存档已出现，本页只读'};
    if (main.state === 'missing' && bak.state === 'missing') return {status: 'empty', writable: lockAvailable()};
    if (bak.state === 'ok') {
      slotRev = Math.max(slotRev, bak.env.slotRev);
      lastSaved = {revision: bak.game.revision, turn: bak.game.turn};
      return {status: 'recovered', game: bak.game, revision: bak.game.revision, turn: bak.game.turn, why: main.why || '主存档缺失', quarantine: q, writable: lockAvailable()};
    }
    if (bak.state === 'future') { readOnly = true; return {status: 'future', why: bak.why}; }
    return {status: 'unrecoverable', why: main.why || '主存档缺失', quarantine: q, writable: lockAvailable()};
  }

  let mainTouched = false;
  async function save(game) {
    if (readOnly) return {ok: false, kind: 'readonly', step: 'readonly'};
    if (!lockAvailable()) return {ok: false, kind: 'before-commit', step: 'no-lock'};
    mainTouched = false;
    try {
      return await withLock(() => commit(game));
    } catch (e) {
      if (mainTouched) return uncertain();
      return {ok: false, kind: 'before-commit', step: 'lock', why: String(e?.message ?? e)};
    }
  }

  function uncertain() {
    knownMain = undefined; knownMainValid = false;
    pendingRestore = true;
    try { failMain = get(SAVE_KEY); mainObserved = true; } catch { failMain = undefined; mainObserved = false; }
    try { failBak = get(BAK_KEY); } catch { failBak = undefined; }
    for (const entry of [parse(failMain), parse(failBak)]) if (entry.state === 'future') {
      readOnly = true; pendingRestore = false; return {ok: false, kind: 'readonly', step: 'future', why: entry.why};
    }
    try { storage.removeItem(TMP_KEY); } catch { /* ignored */ }
    return {ok: false, kind: 'rollback-failed', step: 'main-rollback', backupVerified: failBak != null && parse(failBak).state === 'ok'};
  }

  /** Explicit backup path after a rollback failure. Choosing the backup and writing it back to the
   * main happen in one locked transaction; if the main or the backup changed since the failure was
   * observed (another tab saved), it is a conflict and nothing is written. */
  async function restoreBackup() {
    if (!pendingRestore) return {ok: false, kind: 'conflict', step: 'no-failure'};
    if (!lockAvailable()) return {ok: false, kind: 'before-commit', step: 'no-lock'};
    mainTouched = false;
    try {
      return await withLock(() => {
        let bakRaw, cur;
        try { bakRaw = get(BAK_KEY); } catch { return {ok: false, kind: 'before-commit', step: 'bak-read'}; }
        try { cur = get(SAVE_KEY); } catch { return {ok: false, kind: 'unreadable', step: 'main-read'}; }
        for (const p of [parse(cur), parse(bakRaw)]) if (p.state === 'future') {
          readOnly = true; pendingRestore = false;   // newer data version: never overwrite, page becomes read-only
          return {ok: false, kind: 'readonly', step: 'future', why: p.why};
        }
        if (!mainObserved) {
          // The main could not be observed at failure time, so the bak alone proves nothing
          // (another tab may have saved on top of an identical bak). Re-snapshot, write nothing.
          failMain = cur; failBak = bakRaw; mainObserved = true;
          if (parse(cur).state === 'ok') { pendingRestore = false; return {ok: false, kind: 'conflict', step: 'main-readable', lastSaved}; }
          return {ok: false, kind: 'reconfirm', step: 'resnapshot', backupVerified: parse(bakRaw).state === 'ok'};
        }
        if (bakRaw !== failBak || cur !== failMain) return {ok: false, kind: 'conflict', step: 'restore-cas', lastSaved};
        const bak = parse(bakRaw);
        if (bak.state !== 'ok') return {ok: false, kind: 'rollback-failed', step: 'bak-invalid', backupVerified: false};
        knownMain = cur; knownMainValid = false;   // never copy the uncertain main into bak
        slotRev = Math.max(slotRev, bak.env.slotRev);
        const r = commit(bak.game);
        if (!r.ok) return r;
        failMain = failBak = undefined; pendingRestore = false;
        return {ok: true, game: bak.game, revision: bak.game.revision, turn: bak.game.turn};
      });
    } catch (e) {
      return mainTouched ? uncertain() : {ok: false, kind: 'before-commit', step: 'lock', why: String(e?.message ?? e)};
    }
  }

  function commit(game) {
    const fail = (step, why) => {
      try { storage.removeItem(TMP_KEY); } catch { /* stale tmp is ignored by load */ }
      return {ok: false, kind: 'before-commit', step, why, lastSaved};
    };
    // 1. CAS against what this page last saw.
    const current = get(SAVE_KEY);
    if (current !== knownMain) return {ok: false, kind: 'conflict', step: 'cas', lastSaved};
    // Recheck inside the lock: another build may have written a newer backup
    // while leaving the observed main unchanged. No tmp/quarantine write precedes this.
    for (const entry of [parse(current), parse(get(BAK_KEY))]) if (entry.state === 'future') {
      readOnly = true; return {ok: false, kind: 'readonly', step: 'future', why: entry.why};
    }
    const oldMain = current;
    const text = envelope(game, slotRev + 1);
    // 2-3. Temporary write, read back, full replay check.
    try { storage.setItem(TMP_KEY, text); } catch (e) { return fail('tmp-write', e.message); }
    let check;
    try { check = get(TMP_KEY) === text ? parse(text) : {state: 'mismatch'}; } catch (e) { check = {state: 'error'}; }
    if (check.state !== 'ok') return fail('tmp-verify', check.why || check.state);
    // 4. Keep the previous successful save.
    if (knownMainValid) {
      try { storage.setItem(BAK_KEY, oldMain); } catch (e) { return fail('bak-write', e.message); }
      if (get(BAK_KEY) !== oldMain) return fail('bak-verify');
    }
    // 5. Replace main. From here on the main may already hold the new text: it only counts as
    // "before commit" if the old text is proven back in place, otherwise the main is uncertain.
    const settle = (step) => {
      let restored = false;
      try {
        for (const entry of [parse(get(SAVE_KEY)), parse(get(BAK_KEY))]) if (entry.state === 'future') {
          readOnly = true; return {ok: false, kind: 'readonly', step: 'future', why: entry.why};
        }
        if (oldMain === undefined) restored = false;
        else if (get(SAVE_KEY) === oldMain) restored = true;
        else {
          if (oldMain === null) storage.removeItem(SAVE_KEY); else storage.setItem(SAVE_KEY, oldMain);
          restored = get(SAVE_KEY) === oldMain;
        }
      } catch { restored = false; }
      return restored ? fail(step) : uncertain();
    };
    mainTouched = true;
    try { storage.setItem(SAVE_KEY, text); } catch (e) { return settle('main-write'); }
    let back;
    try { back = get(SAVE_KEY); } catch { return uncertain(); }
    if (back !== text) return settle('main-verify');
    knownMain = text; knownMainValid = true; slotRev += 1;
    lastSaved = {revision: game.revision, turn: game.turn};
    // 6. Clean tmp. Failure here is still a successful save.
    let tmpLeft = false;
    try { storage.removeItem(TMP_KEY); tmpLeft = get(TMP_KEY) !== null; } catch { tmpLeft = true; }
    return {ok: true, revision: game.revision, slotRev, tmpLeft};
  }

  return {
    load, save, restoreBackup,
    get readOnly() { return readOnly; },
    get lastSaved() { return lastSaved ? {...lastSaved} : null; },
    get writable() { return lockAvailable() && !readOnly; },
  };
}
