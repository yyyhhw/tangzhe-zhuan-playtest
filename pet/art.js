/* 宠物原型 p1 — 美术接口：manifest 校验 + 动画播放器。纯函数，浏览器 / Node 通用。
   约定（熊大定）：源帧 256×256 透明、固定落地原点 (128,208)、影子单独一张、每帧不裁边；
   东 / 北 / 南真画，西 = 东镜像；原地动作只画东向（先自然转到侧面再播）；运行时缩到 128 格，图集 2048×1024。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PetArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SCHEMA = 'tangzhe-pet-art/1';
  // 需要的片段和帧数（idle 东6/北4/南4，walk/run 三向各 8/6，原地动作东向）
  const REQUIRED = {
    idle_E: 6, idle_N: 4, idle_S: 4,
    walk_E: 8, walk_N: 8, walk_S: 8,
    run_E: 6, run_N: 6, run_S: 6,
    attention: 4, sniff: 6, hop: 8, play: 8, sleep: 6, eat: 6, petted: 6, liedown: 4, getup: 4,
  };
  const IN_PLACE = ['attention', 'sniff', 'hop', 'play', 'sleep', 'eat', 'petted', 'liedown', 'getup'];
  const EVENTS = ['ball_pick', 'ball_drop'];
  const eq2 = (a, b) => Array.isArray(a) && a.length === 2 && a[0] === b[0] && a[1] === b[1];

  function validateManifest(m) {
    const errors = [];
    const err = (s) => errors.push(s);
    if (!m || typeof m !== 'object') return { ok: false, errors: ['manifest 不是对象'], frameCount: 0 };
    if (m.schema !== SCHEMA) err('schema 应为 ' + SCHEMA);
    const src = m.source || {};
    if (!eq2(src.frameSize, [256, 256])) err('source.frameSize 应为 [256,256]');
    if (!eq2(src.origin, [128, 208])) err('source.origin 应为 [128,208]（固定落地点）');
    if (src.perFrameCrop !== false) err('source.perFrameCrop 必须为 false（每帧不裁边）');
    if (src.shadow !== 'separate') err('source.shadow 必须为 separate（影子单独一张）');
    const rt = m.runtime || {};
    if (rt.cellSize !== 128) err('runtime.cellSize 应为 128');
    if (!eq2(rt.origin, [64, 104])) err('runtime.origin 应为 [64,104]（源原点 ÷2）');
    if (!(rt.displayTiles > 0)) err('runtime.displayTiles 要 > 0');
    const at = m.atlas || {};
    if (!eq2(at.size, [2048, 1024])) err('atlas.size 应为 [2048,1024]');
    if (at.cols * rt.cellSize !== (at.size || [])[0] || at.rows * rt.cellSize !== (at.size || [])[1]) err('atlas cols/rows × cellSize 和 size 对不上');
    if (!m.placeholder && !at.image) err('非占位 manifest 必须给 atlas.image');
    const d = m.directions || {};
    if (!(Array.isArray(d.drawn) && ['E', 'N', 'S'].every(x => d.drawn.includes(x)))) err('directions.drawn 要包含 E/N/S');
    if (!(d.mirror && d.mirror.W === 'E')) err('directions.mirror.W 应为 E（西 = 东镜像）');
    const cap = (at.cols || 0) * (at.rows || 0), used = new Set();
    const useCell = (c, where) => {
      if (!Number.isInteger(c) || c < 0 || c >= cap) err(where + ' cell 越界：' + c);
      else if (used.has(c)) err(where + ' cell 重复：' + c);
      else used.add(c);
    };
    let frameCount = 0;
    const clips = m.clips || {};
    for (const [name, n] of Object.entries(REQUIRED)) {
      const c = clips[name];
      if (!c) { err('缺片段 ' + name); continue; }
      if (!Array.isArray(c.frames) || c.frames.length !== n) { err(name + ' 应为 ' + n + ' 帧，实际 ' + (c.frames ? c.frames.length : 0)); continue; }
      const inPlace = IN_PLACE.includes(name);
      if (!!c.inPlace !== inPlace) err(name + ' inPlace 应为 ' + inPlace);
      if (inPlace && c.dir !== 'E') err(name + ' 原地动作只画东向（dir:E）');
      c.frames.forEach((f, i) => {
        frameCount++;
        useCell(f.cell, name + '#' + i);
        if (!(f.ms > 0 && f.ms <= 2000)) err(name + '#' + i + ' 时长不对：' + f.ms);
        // p5：北向（背对镜头）嘴被头挡住，真图 sidecar 给的是 null —— 只允许 N 向帧 mouth:null + mouthHidden:true（叼球时不画球）；其余必须是数字
        if (f.mouth === null && f.mouthHidden === true && c.dir === 'N') return;
        if (!(Array.isArray(f.mouth) && f.mouth.length === 2 && f.mouth.every(v => Number.isFinite(v) && v >= 0 && v <= 256))) err(name + '#' + i + ' 缺嘴巴锚点');
      });
    }
    for (const name of Object.keys(clips)) if (!(name in REQUIRED)) err('多余片段 ' + name + '（不在约定里）');
    // 身体外形（p3）：每个真画朝向的横向像素范围 [最左, 最右]（源帧坐标，含描边 / 尾巴 / 鼻子），引擎按它算碰撞盒
    const bd = m.body || {};
    for (const dn of ['E', 'N', 'S']) {
      const r = bd[dn];
      if (!(Array.isArray(r) && r.length === 2 && r.every(v => Number.isFinite(v) && v >= 0 && v <= 256) && r[0] < (src.origin || [128])[0] && r[1] > (src.origin || [128])[0])) err('body.' + dn + ' 应为 [最左像素, 最右像素]，且包住落地原点');
    }
    if (!m.shadow || !(m.shadow.radius && m.shadow.radius.length === 2)) err('缺 shadow.radius');
    else useCell(m.shadow.cell, 'shadow');
    const acts = m.actions || {};
    for (const [an, ev] of [['pick_ball', 'ball_pick'], ['drop_ball', 'ball_drop']]) {
      const a = acts[an];
      if (!a) { err('缺动作 ' + an); continue; }
      const c = clips[a.clip];
      if (!c) { err(an + ' 指向不存在的片段 ' + a.clip); continue; }
      if (!Array.isArray(a.frames) || !a.frames.length || a.frames.some(i => !Number.isInteger(i) || i < 0 || i >= c.frames.length)) err(an + ' frames 越界');
      if (!Array.isArray(a.events) || !a.events.some(e => e.name === ev)) err(an + ' 缺事件 ' + ev);
      (a.events || []).forEach(e => { if (!EVENTS.includes(e.name)) err(an + ' 未知事件 ' + e.name); if (!(a.frames || []).includes(e.frame)) err(an + ' 事件帧不在 frames 里'); });
    }
    return { ok: errors.length === 0, errors, frameCount, cellsUsed: used.size, capacity: cap };
  }

  // 片段名 + 朝向 → 实际片段与是否镜像。行走类有三向；原地类只有东向
  function resolveClip(m, base, dir) {
    if (m.clips[base]) return { name: base, mirror: dir === 'W' };
    const real = dir === 'W' ? 'E' : dir;
    return { name: base + '_' + real, mirror: dir === 'W' };
  }
  function cellRect(m, cell) {
    const s = m.runtime.cellSize, cols = m.atlas.cols;
    return { sx: (cell % cols) * s, sy: Math.floor(cell / cols) * s, s };
  }
  function clipDuration(m, name, frames) {
    const c = m.clips[name]; const idx = frames || c.frames.map((_, i) => i);
    return idx.reduce((a, i) => a + c.frames[i].ms, 0) / 1000;
  }

  // 动画播放器：按 manifest 时长走帧；进入某帧时触发事件（抓球 / 放球都靠事件，不靠计时器）
  function Animator(m) { this.m = m; this.play('idle_S', { loop: true }); }
  Animator.prototype.play = function (name, opt) {
    opt = opt || {};
    const c = this.m.clips[name];
    if (!c) throw new Error('未知片段 ' + name);
    this.name = name; this.clip = c;
    this.seq = opt.frames || c.frames.map((_, i) => i);
    this.events = opt.events || [];
    this.loop = opt.loop != null ? opt.loop : c.loop;
    this.k = 0; this.t = 0; this.done = false; this.loops = 0; this.starts = (this.starts || 0) + 1;
    this.fired = [];
    this._fire();
    return this;
  };
  Animator.prototype.frame = function () { return this.seq[this.k]; };
  Animator.prototype.frameData = function () { return this.clip.frames[this.seq[this.k]]; };
  Animator.prototype._fire = function () {
    for (const e of this.events) if (e.frame === this.seq[this.k]) this.fired.push(e.name);
  };
  // 返回这一步触发的事件名列表
  Animator.prototype.tick = function (dt) {
    this.fired = [];
    if (this.done) return this.fired;
    this.t += dt * 1000;
    let guard = 0;
    while (!this.done && this.t >= this.clip.frames[this.seq[this.k]].ms && guard++ < 64) {
      this.t -= this.clip.frames[this.seq[this.k]].ms;
      if (this.k + 1 < this.seq.length) { this.k++; this._fire(); }
      else if (this.loop) { this.k = 0; this.loops++; this._fire(); }
      else { this.done = true; this.t = 0; }
    }
    return this.fired;
  };
  return { SCHEMA, REQUIRED, IN_PLACE, EVENTS, validateManifest, resolveClip, cellRect, clipDuration, Animator };
});
