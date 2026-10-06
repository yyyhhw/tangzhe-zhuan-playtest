/* 宠物原型 p1 — 占位小狗（程序画的暖棕白小狗）。只在真美术图集没到位时用。
   画法严格按 manifest 合同：在 256×256 源帧坐标里画，落地原点 (128,208)，头的位置跟着 manifest 的嘴巴锚点走；
   影子不在这里画（单独一张）。所以以后换成真图集，逻辑和锚点一样用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PetPuppy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = { white: '#fff8ee', cream: '#f3e3cc', brown: '#b9773f', dark: '#7b4a22', ink: '#3a2a1e', nose: '#2a1b12', pink: '#f08aa0', blush: 'rgba(240,120,140,.35)' };
  const TAU = Math.PI * 2;
  function ell(ctx, x, y, rx, ry, rot, fill, stroke) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== false) { ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.stroke(); }
  }
  function leg(ctx, x0, y0, x1, y1, w, col) {
    ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = w + 7; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = col || C.white; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  function tail(ctx, x, y, ang, len) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6, y - 10, ex, ey); ctx.stroke();
    ctx.strokeStyle = C.brown; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6, y - 10, ex, ey); ctx.stroke();
  }
  // 姿势：从片段名 + 帧号推出来（占位用），头跟嘴巴锚点
  function pose(clip, i, n) {
    const ph = i / n * TAU;
    const p = { bodyY: 168, lie: 0, gait: 0, stride: 0, tailA: -2.2 + Math.sin(ph) * 0.25, eyes: 'open', ear: 0, tongue: false, bow: 0, bob: 0 };
    if (/^walk/.test(clip)) { p.gait = ph; p.stride = 10; p.bob = Math.abs(Math.sin(ph)) * -2; p.tailA = -2.3 + Math.sin(ph * 2) * 0.35; }
    if (/^run/.test(clip)) { p.gait = ph; p.stride = 18; p.bob = Math.sin(ph) * 4; p.tailA = -2.7 + Math.sin(ph * 2) * 0.2; p.ear = -0.5; p.tongue = true; }
    if (/^idle/.test(clip)) { p.bob = Math.sin(ph) * 1; }
    switch (clip) {
      case 'attention': p.ear = [0, -0.4, -0.7, -0.5][i]; p.tailA = -2.0 + [0, 0.3, -0.3, 0.3][i]; p.lookCam = i >= 1; break;
      case 'sniff': p.ear = 0.25; p.tailA = -2.1 + Math.sin(ph * 2) * 0.5; break;
      case 'hop': p.gait = 0; p.stride = 0; p.ear = -0.8 * Math.sin(i / 7 * Math.PI); p.tailA = -2.6; p.tongue = true; p.tuck = Math.sin(i / 7 * Math.PI); break;
      case 'play': p.bow = [1, 1, 1, 0.6, 0.3, 0.6, 1, 1][i]; p.tailA = -2.5 + Math.sin(ph * 2) * 0.6; p.tongue = true; p.ear = -0.3; break;
      case 'sleep': p.lie = 1; p.eyes = 'closed'; p.breath = Math.sin(ph); p.tailA = 2.6; break;
      case 'eat': p.ear = 0.3; p.tailA = -2.2 + Math.sin(ph * 2) * 0.4; break;
      case 'petted': p.eyes = 'happy'; p.ear = 0.45; p.tailA = -2.3 + Math.sin(ph * 3) * 0.7; p.blush = true; p.lookCam = true; break;
      case 'liedown': p.lie = [0.15, 0.45, 0.75, 1][i]; p.eyes = i === 3 ? 'sleepy' : 'open'; break;
      case 'getup': p.lie = [0.85, 0.55, 0.25, 0][i]; p.stretch = i === 1 || i === 2; p.eyes = i === 0 ? 'sleepy' : 'open'; break;
    }
    return p;
  }
  function eyesE(ctx, x, y, kind) {
    ctx.fillStyle = C.nose; ctx.strokeStyle = C.nose; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    if (kind === 'closed' || kind === 'sleepy') { ctx.beginPath(); ctx.arc(x, y - 1, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else if (kind === 'happy') { ctx.beginPath(); ctx.arc(x, y + 3, 5, Math.PI + 0.3, TAU - 0.3); ctx.stroke(); }
    else { ell(ctx, x, y, 4.5, 5.5, 0, C.nose, false); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 1.5, y - 2, 1.6, 0, TAU); ctx.fill(); }
  }
  // 东向侧身
  function drawE(ctx, clip, i, n, mouth) {
    const p = pose(clip, i, n), L = p.lie;
    const by = p.bodyY + L * 22 + p.bob + (p.bow ? p.bow * 6 : 0);
    const bodyRot = p.bow ? -p.bow * 0.22 : 0;
    // 后面两条腿（暗一点）
    const legTop = by + 12, foot = 208;
    const sw = (k) => Math.sin(p.gait + k) * p.stride;
    if (L < 0.6) {
      const lh = (1 - L / 0.6);
      leg(ctx, 100, legTop, 100 - sw(Math.PI) * 0.8, legTop + (foot - legTop) * lh, 11, C.cream);
      leg(ctx, 156, legTop - (p.bow ? 8 : 0), 158 - sw(0) * 0.8, legTop + (foot - legTop - (p.bow ? 2 : 0)) * lh, 11, C.cream);
    }
    tail(ctx, 84, by - 10 - (p.bow ? 14 : 0), p.tailA, 30 - L * 8);
    ctx.save(); ctx.translate(128, by); ctx.rotate(bodyRot);
    const br = p.breath ? 1 + p.breath * 0.035 : 1;
    ell(ctx, 0, 0, 48 + L * 4, (27 - L * 3) * br, 0, C.white);
    ell(ctx, -6, -12 * br, 30, 13, -0.08, C.brown, false);   // 背上棕色鞍斑
    ctx.restore();
    if (L < 0.6) {
      const lh = (1 - L / 0.6), tk = p.tuck || 0;
      leg(ctx, 110, legTop, 110 + sw(0) - tk * 6, legTop + (foot - legTop) * lh - tk * 10, 12);
      leg(ctx, 166, legTop - (p.bow ? 10 : 0), 168 + sw(Math.PI) + (p.bow ? 10 : 0) + tk * 6, legTop + (foot - legTop) * lh + (p.bow ? 6 : 0) - tk * 10, 12);
    } else {   // 趴着：前爪往前伸
      leg(ctx, 150, by + 14, 186, 204, 11);
      leg(ctx, 100, by + 16, 126, 206, 11, C.cream);
    }
    // 头：跟嘴巴锚点
    const hx = mouth[0] - 24, hy = mouth[1] - 14;
    ell(ctx, (hx + 128 + 30) / 2 - 2, (hy + by) / 2 + 2, 15, 18, 0.6, C.white);   // 脖子
    ell(ctx, hx, hy, 27, 25, 0, C.white);
    ell(ctx, hx + 2, hy - 13, 17, 10, 0.25, C.brown, false);   // 头顶棕斑
    ell(ctx, mouth[0] - 5, mouth[1] - 4, 15, 11, 0.12, C.white);   // 嘴筒
    ell(ctx, mouth[0] + 7, mouth[1] - 10, 6, 5, 0, C.nose, false);
    if (p.tongue) ell(ctx, mouth[0] - 2, mouth[1] + 8, 5, 7, 0.2, C.pink);
    eyesE(ctx, hx + (p.lookCam ? 6 : 10), hy - 5, p.eyes);
    if (p.blush) ell(ctx, hx + 6, hy + 8, 6, 4, 0, C.blush, false);
    // 耳朵（垂耳，竖一点 = 在注意）
    ctx.save(); ctx.translate(hx - 12, hy - 14); ctx.rotate(0.55 + p.ear);
    ell(ctx, 0, 14, 10, 19, 0, C.dark); ctx.restore();
  }
  // 北向（背对你）
  function drawN(ctx, clip, i, n, mouth) {
    const p = pose(clip, i, n), by = 172 + p.bob;
    const sw = (k) => Math.sin(p.gait + k) * p.stride * 0.6;
    leg(ctx, 112, by + 14, 112, 206 - Math.max(0, sw(0)), 12, C.cream);
    leg(ctx, 144, by + 14, 144, 206 - Math.max(0, sw(Math.PI)), 12, C.cream);
    const hx = mouth[0], hy = mouth[1] + 4;
    ell(ctx, hx, hy, 26, 24, 0, C.white);
    ell(ctx, hx, hy - 6, 22, 16, 0, C.brown, false);
    ell(ctx, hx - 22, hy + 6, 9, 17, 0.35 + p.ear * 0.5, C.dark);
    ell(ctx, hx + 22, hy + 6, 9, 17, -0.35 - p.ear * 0.5, C.dark);
    ell(ctx, 128, by, 34, 32, 0, C.white);
    ell(ctx, 128, by - 8, 24, 18, 0, C.brown, false);
    tail(ctx, 132, by - 20, -2.0 + Math.sin(p.tailA * 3) * 0.45, 17);
  }
  // 南向（面朝你）
  function drawS(ctx, clip, i, n, mouth) {
    const p = pose(clip, i, n), by = 176 + p.bob;
    const sw = (k) => Math.sin(p.gait + k) * p.stride * 0.5;
    tail(ctx, 150, by - 14, -1.2 + Math.sin(p.tailA * 3) * 0.4, 22);
    ell(ctx, 128, by, 32, 28, 0, C.white);
    leg(ctx, 114, by + 6, 114, 206 - Math.max(0, sw(0)), 13);
    leg(ctx, 142, by + 6, 142, 206 - Math.max(0, sw(Math.PI)), 13);
    const hx = mouth[0], hy = mouth[1] - 24;
    ell(ctx, hx - 25, hy + 4, 10, 19, 0.3 - p.ear * 0.5, C.dark);
    ell(ctx, hx + 25, hy + 4, 10, 19, -0.3 + p.ear * 0.5, C.dark);
    ell(ctx, hx, hy, 28, 26, 0, C.white);
    ell(ctx, hx + 11, hy - 8, 12, 11, 0.3, C.brown, false);   // 一只眼睛周围的棕斑
    ell(ctx, hx, mouth[1] - 8, 14, 10, 0, C.white);
    ell(ctx, hx, mouth[1] - 13, 6.5, 5, 0, C.nose, false);
    if (p.tongue) ell(ctx, hx, mouth[1] - 1, 5, 6, 0, C.pink);
    for (const s of [-1, 1]) {
      const ex = hx + s * 10, ey = hy - 4;
      if (p.eyes === 'open') { ell(ctx, ex, ey, 4.5, 5.5, 0, C.nose, false); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1.4, ey - 2, 1.5, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = C.nose; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(ex, ey - 1, 4.5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    }
  }
  // 画一帧：ctx 已经变换到源帧坐标（256×256，左上角为 0,0）
  function drawFrame(ctx, m, clipName, frameIdx) {
    const c = m.clips[clipName], f = c.frames[frameIdx], n = c.frames.length;
    ctx.save();
    if (c.dir === 'N') drawN(ctx, clipName, frameIdx, n, f.mouth || [128, 112]);   // p5：真图北向 mouth 为 null（被挡），占位兜底画法用默认头位
    else if (c.dir === 'S') drawS(ctx, clipName, frameIdx, n, f.mouth);
    else drawE(ctx, clipName, frameIdx, n, f.mouth);
    ctx.restore();
  }
  function drawShadow(ctx, m) {
    const r = m.shadow.radius, o = m.source.origin;
    ctx.fillStyle = 'rgba(40,25,10,.28)'; ctx.beginPath(); ctx.ellipse(o[0], o[1], r[0], r[1], 0, 0, TAU); ctx.fill();
  }
  // 把占位帧烘成一张 2048×1024 图集（自测「换真图集」那条路用）
  function bakeAtlas(doc, m) {
    const cv = doc.createElement('canvas'); cv.width = m.atlas.size[0]; cv.height = m.atlas.size[1];
    const ctx = cv.getContext('2d'), s = m.runtime.cellSize, k = s / m.source.frameSize[0];
    const put = (cell, fn) => { ctx.save(); ctx.translate((cell % m.atlas.cols) * s, Math.floor(cell / m.atlas.cols) * s); ctx.scale(k, k); fn(); ctx.restore(); };
    for (const [name, c] of Object.entries(m.clips)) c.frames.forEach((f, i) => put(f.cell, () => drawFrame(ctx, m, name, i)));
    put(m.shadow.cell, () => drawShadow(ctx, m));
    return cv;
  }
  return { drawFrame, drawShadow, bakeAtlas, pose, COLORS: C };
});
