/* 宠物原型 p1 — 页面：画房间 / 小狗、三个操作、搬家具、独立存档（tangzhe-pet-proto），测试钩子。
   不碰正式游戏存档（tangzhe-save / tangzhe-preview-save），不接经济，收益加成 0。 */
(function () {
  'use strict';
  const KEY = 'tangzhe-pet-proto';
  const Q = new URLSearchParams(location.search);
  const PE = window.PetEngine, PA = window.PetArt, PP = window.PetPuppy, PR = window.PetRoom, EC = window.Economy;
  const $ = (id) => document.getElementById(id);
  const cv = $('room'), ctx = cv.getContext('2d'), stage = $('stage');
  let M = null, W = null, byId = {}, manual = false, atlas = null, artMode = 'placeholder';
  let tile = 32, wallH = 64, cssW = 320, cssH = 320, dpr = 1, rearrange = false, drag = null, hiddenAt = 0;
  const imgs = {};
  function img(fid) {
    if (imgs[fid]) return imgs[fid];
    const im = new Image(); im.decoding = 'async'; im.src = '../art/furn_' + fid.replace(/^furn_/, '') + '.webp?v=12';
    im.onerror = () => { im.bad = true; };
    return (imgs[fid] = im);
  }
  const ok = (im) => im && im.complete && im.naturalWidth > 0 && !im.bad;

  /* ---------- 存档 ---------- */
  function save() { if (!W) return; try { localStorage.setItem(KEY, JSON.stringify(PE.serialize(W, Date.now()))); } catch (e) { /* 隐私模式：不存也能玩 */ } }
  function loadSave() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function makeWorld(fromSave) {
    W = PE.createWorld({ catalog: EC.FURNITURE, room: PR.ROOM, interact: PR.INTERACT, manifest: M, seed: +(Q.get('seed') || (Date.now() % 100000)) });
    for (const p of [...W.items, ...W.wall]) img(p.fid);
    let res = null;
    if (fromSave && !Q.has('fresh')) { const s = loadSave(); if (s) res = PE.restore(W, s, Date.now()); }
    return res;
  }

  /* ---------- 布局 ---------- */
  function resize() {
    if (!W) return;
    cssW = stage.clientWidth; tile = cssW / W.cols; wallH = W.wallRows * tile; cssH = wallH + W.rows * tile;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.height = cssH + 'px'; cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    render();
  }
  const sx = (x) => x * tile, sy = (y) => wallH + y * tile;

  /* ---------- 画 ---------- */
  function drawWall() {
    const g = ctx.createLinearGradient(0, 0, 0, wallH); g.addColorStop(0, '#f7ead6'); g.addColorStop(1, '#f1dcc0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cssW, wallH);
    ctx.fillStyle = 'rgba(200,160,120,.18)'; for (let x = 0; x < cssW; x += tile / 2) ctx.fillRect(x, 0, 1, wallH);
    for (const p of W.wall) {
      const f = W.byId[p.fid], im = imgs[p.fid], x = sx(p.x), y = p.y * tile, w = f.w * tile, h = f.h * tile;
      if (ok(im)) { const ar = im.naturalHeight / im.naturalWidth; let dw = w, dh = w * ar; if (dh > h) { dh = h; dw = h / ar; } ctx.drawImage(im, x + (w - dw) / 2, y + 2, dw, dh); }
    }
    ctx.fillStyle = '#8d5524'; ctx.fillRect(0, wallH - 4, cssW, 5);
  }
  function drawFloor() {
    ctx.fillStyle = '#dcb98f'; ctx.fillRect(0, wallH, cssW, W.rows * tile);
    ctx.strokeStyle = 'rgba(120,80,40,.16)'; ctx.lineWidth = 1;
    for (let j = 0; j <= W.rows; j++) { ctx.beginPath(); ctx.moveTo(0, sy(j)); ctx.lineTo(cssW, sy(j)); ctx.stroke(); }
    for (let i = 0; i <= W.cols; i++) { ctx.beginPath(); ctx.moveTo(sx(i), wallH); ctx.lineTo(sx(i), cssH); ctx.stroke(); }
  }
  function drawItem(p, alpha) {
    const r = PE.itemRect(W, p), f = W.byId[p.fid], im = imgs[p.fid] || img(p.fid);
    const x = sx(r.x), y = sy(r.y), w = r.w * tile, h = r.h * tile;
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
    if (PE.isRug(W, p)) {
      if (ok(im)) ctx.drawImage(im, x, y, w, h); else { ctx.fillStyle = f.color; ctx.globalAlpha *= 0.6; ctx.fillRect(x, y, w, h); }
    } else if (ok(im)) {   // 正面图：底边贴占地前沿，宽 = 占地宽，太高的封顶「占地 + 2 格后墙」等比缩
      const ar = im.naturalHeight / im.naturalWidth; let dw = w, dh = w * ar; const cap = (r.h + W.wallRows) * tile;
      if (dh > cap) { dh = cap; dw = dh / ar; }
      ctx.drawImage(im, x + (w - dw) / 2, y + h - dh, dw, dh);
    } else {
      ctx.fillStyle = f.color; ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 2; ctx.fillRect(x + 2, y + 2, w - 4, h - 4); ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      ctx.font = `${Math.round(tile * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(f.emoji || '▪', x + w / 2, y + h / 2);
    }
    ctx.restore();
  }
  function drawBed() {
    const b = W.bed, x = sx(b.x), y = sy(b.y), w = b.w * tile, h = b.h * tile;
    ctx.save(); ctx.fillStyle = '#8f5a33'; ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2d8b4'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 1, w / 2 - tile * 0.16, h / 2 - tile * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawBowl() {
    const b = W.bowl, x = sx(b.x), y = sy(b.y), w = b.w * tile, h = b.h * tile;
    ctx.save(); ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 2;
    ctx.fillStyle = '#3f7fc4'; ctx.beginPath(); ctx.moveTo(x, y + h * 0.35); ctx.lineTo(x + w * 0.12, y + h); ctx.lineTo(x + w * 0.88, y + h); ctx.lineTo(x + w, y + h * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c98a4b'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.35, w / 2, h * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function ballPath(x, y, r) {
    ctx.fillStyle = '#d6e83a'; ctx.strokeStyle = '#2b2118'; ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r * 0.16); ctx.beginPath(); ctx.arc(x - r * 0.9, y, r * 0.8, -0.9, 0.9); ctx.stroke();
  }
  function drawBall() {
    const b = W.ball; if (b.state === 'carried') return;
    const r = PE.CFG.BALL_R * tile, gx = sx(b.x), gy = sy(b.y);
    ctx.fillStyle = 'rgba(40,25,10,.25)'; ctx.beginPath(); ctx.ellipse(gx, gy, r * (1 - Math.min(0.5, b.z * 0.25)), r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ballPath(gx, gy - r - b.z * tile, r);
  }
  function drawDog() {
    const d = W.dog, gx = sx(d.x), gy = sy(d.y), k = M.runtime.displayTiles * tile / 256;
    const name = d.anim.name, fi = d.anim.frame(), fr = M.clips[name].frames[fi], mirror = d.dir === 'W';
    // 影子：单独一张，永远贴地（跳起来只是变小一点）
    const sk = k * (1 - Math.min(0.4, d.z * 0.6));
    ctx.save(); ctx.translate(gx, gy); ctx.scale(sk, sk); ctx.translate(-128, -208);
    if (atlas) { const c = PA.cellRect(M, M.shadow.cell); ctx.drawImage(atlas, c.sx, c.sy, c.s, c.s, 0, 0, 256, 256); } else PP.drawShadow(ctx, M);
    ctx.restore();
    ctx.save(); ctx.translate(gx, gy - d.z * tile); ctx.scale(mirror ? -k : k, k); ctx.translate(-128, -208);
    const carried = W.ball.state === 'carried', br = PE.CFG.BALL_R * 256 / M.runtime.displayTiles;
    if (carried && d.dir === 'N') ballPath(fr.mouth[0], fr.mouth[1], br);
    if (atlas) { const c = PA.cellRect(M, fr.cell); ctx.drawImage(atlas, c.sx, c.sy, c.s, c.s, 0, 0, 256, 256); }
    else PP.drawFrame(ctx, M, name, fi);
    if (carried && d.dir !== 'N') ballPath(fr.mouth[0], fr.mouth[1] + 4, br);
    ctx.restore();
  }
  function drawFx() {
    const d = W.dog, gx = sx(d.x), gy = sy(d.y) - (M.runtime.displayTiles * 0.62 + d.z) * tile;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of W.fx) {
      const age = W.t - f.t; if (age > 1.4 || age < 0) continue;
      ctx.globalAlpha = 1 - age / 1.4; ctx.font = `${Math.round(tile * 0.5)}px sans-serif`;
      if (f.type === 'heart') ctx.fillText('💗', gx + Math.sin(age * 6) * 4, gy - age * tile * 0.7);
      if (f.type === 'q') { ctx.fillStyle = '#2b2118'; ctx.font = `900 ${Math.round(tile * 0.55)}px sans-serif`; ctx.fillText('?', gx, gy - age * 8); }
    }
    ctx.globalAlpha = 1;
    if (d.anim.name === 'attention') { ctx.fillStyle = '#d64545'; ctx.font = `900 ${Math.round(tile * 0.55)}px sans-serif`; ctx.fillText('!', gx + tile * 0.1, gy); }
    if (d.anim.name === 'sleep') { ctx.fillStyle = '#5b6fb5'; const ph = (W.t % 2.4) / 2.4; ctx.globalAlpha = 1 - ph; ctx.font = `900 ${Math.round(tile * (0.3 + ph * 0.25))}px sans-serif`; ctx.fillText('z', gx + tile * (0.3 + ph * 0.3), gy + tile * 0.3 - ph * tile * 0.6); }
    ctx.restore();
  }
  function drawRearrange() {
    ctx.save(); ctx.strokeStyle = 'rgba(224,122,63,.6)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    for (const p of W.items) { if (drag && drag.uid === p.uid) continue; const r = PE.itemRect(W, p); ctx.strokeRect(sx(r.x) + 1, sy(r.y) + 1, r.w * tile - 2, r.h * tile - 2); }
    ctx.restore();
    if (!drag) return;
    const p = W.items.find(q => q.uid === drag.uid), r = PE.itemRect(W, p), c = PE.canPlace(W, p.uid, drag.gx, drag.gy);
    ctx.save(); ctx.fillStyle = c.ok ? 'rgba(47,158,91,.35)' : 'rgba(214,69,69,.35)'; ctx.fillRect(sx(drag.gx), sy(drag.gy), r.w * tile, r.h * tile); ctx.restore();
    drawItem({ ...p, x: drag.gx, y: drag.gy }, 0.75);
  }
  function drawDebug() {
    const s = W.dog.step; if (!s || !s.path) return;
    ctx.save(); ctx.strokeStyle = '#d64545'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(W.dog.x), sy(W.dog.y));
    for (const p of s.path) ctx.lineTo(sx(p.x), sy(p.y)); ctx.stroke(); ctx.restore();
  }
  let lastLabel = '', lastAff = -1;
  function render() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
    drawWall(); drawFloor();
    for (const p of W.items) if (PE.isRug(W, p) && !(drag && drag.uid === p.uid)) drawItem(p);
    drawBed();
    const byUid = {}; for (const p of W.items) byUid[p.uid] = p;
    const list = PE.drawOrder(W).filter(o => !(drag && o.uid === drag.uid)).map(o => ({ f: o.kind === 'item' ? () => drawItem(byUid[o.uid]) : o.kind === 'bowl' ? drawBowl : o.kind === 'dog' ? drawDog : drawBall }));   // 落地点决定前后遮挡
    for (const it of list) it.f();
    if (rearrange) drawRearrange();
    drawFx();
    if (Q.has('debug')) drawDebug();
    const lb = W.dog.label + (Q.has('debug') ? ` · 精力${W.dog.energy.toFixed(0)}` : '');
    if (lb !== lastLabel) { $('label').textContent = lb; lastLabel = lb; }
    if (W.dog.affinity !== lastAff) { $('aff').textContent = '亲密 ' + W.dog.affinity; lastAff = W.dog.affinity; }
    const carried = W.ball.state === 'carried' || W.ball.state === 'air';
    $('bBall').disabled = rearrange || carried; $('bCall').disabled = rearrange; $('bPet').disabled = rearrange;
  }

  /* ---------- 输入 ---------- */
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 1800); }
  function toTile(e) { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / tile, y: (e.clientY - b.top - wallH) / tile }; }
  function hitDog(p) { const d = W.dog; return Math.abs(p.x - d.x) < 0.6 && p.y > d.y - 1.05 - d.z && p.y < d.y + 0.25; }
  function hitItem(p) {
    const cand = W.items.filter(q => { const r = PE.itemRect(W, q); return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; });
    cand.sort((a, b) => (PE.isRug(W, a) - PE.isRug(W, b)) || (PE.itemRect(W, b).y + PE.itemRect(W, b).h) - (PE.itemRect(W, a).y + PE.itemRect(W, a).h));
    return cand[0] || null;
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!W) return; const p = toTile(e);
    if (rearrange) {
      const it = hitItem(p); if (!it) return;
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      drag = { uid: it.uid, offX: p.x - it.x, offY: p.y - it.y, gx: it.x, gy: it.y }; render(); e.preventDefault(); return;
    }
    if (hitDog(p)) { const r = PE.pet(W, 'tap'); if (r.absorbed) { /* 连点不重播 */ } render(); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = toTile(e);
    drag.gx = Math.round(p.x - drag.offX); drag.gy = Math.round(p.y - drag.offY); render();
  });
  const endDrag = () => {
    if (!drag) return; const d = drag; drag = null;
    const p = W.items.find(q => q.uid === d.uid);
    if (d.gx !== p.x || d.gy !== p.y) { const r = PE.moveItem(W, d.uid, d.gx, d.gy); toast(r.ok ? W.byId[p.fid].name + ' 放好了' : '放不下：' + r.why); if (r.ok) save(); }
    render();
  };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  $('bCall').onclick = () => { const r = PE.call(W); if (!r.ok) toast('先把家具放好'); render(); };
  $('bPet').onclick = () => { const r = PE.pet(W, 'button'); if (!r.ok) toast('先把家具放好'); render(); };
  $('bBall').onclick = () => { const r = PE.throwBall(W); if (!r.ok) toast(r.why === 'carried' ? '球在它嘴里呢' : r.why === 'flying' ? '球还在飞' : '先把家具放好'); else if (r.ignored === 'asleep') toast('它睡着了，球先放那儿'); render(); };
  $('bMove').onclick = () => {
    rearrange = !rearrange; PE.setRearrange(W, rearrange); drag = null;
    $('bMove').classList.toggle('on', rearrange); $('bMove').textContent = rearrange ? '✅ 放好了' : '🪑 搬家具';
    $('hint').textContent = rearrange ? '拖一件家具换位置，小狗会等你放好' : '点小狗也能摸它';
    if (!rearrange) save(); render();
  };

  /* ---------- 循环 ---------- */
  let last = 0, saveAcc = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!W) return;
    const dt = Math.min(0.1, last ? (ts - last) / 1000 : 0); last = ts;
    if (manual) return;
    let left = dt; while (left > 1e-6) { const h = Math.min(1 / 60, left); PE.update(W, h); left -= h; }
    saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; save(); }
    render();
  }
  document.addEventListener('visibilitychange', () => {
    if (!W) return;
    if (document.hidden) { save(); hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 3000) { welcomeBack(makeWorld(true)); resize(); }
    hiddenAt = 0;
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', resize);
  function welcomeBack(res) {
    if (res && res.ok && res.elapsed > 20) { const m = Math.round(res.elapsed / 60); toast(m >= 1 ? `你不在的 ${m} 分钟，它在窝里睡了一觉` : '你回来啦，它刚睡醒'); }
  }

  /* ---------- 测试钩子 ---------- */
  window.__pet = {
    get w() { return W; }, get M() { return M; }, PE, KEY,
    manual(on) { manual = !!on; },
    advance(sec) { PE.step(W, sec); render(); return PE.snapshot(W); },
    snapshot() { return PE.snapshot(W); },
    save, reload() { welcomeBack(makeWorld(true)); resize(); },
    bakeAtlas() { atlas = PP.bakeAtlas(document, M); artMode = 'atlas'; render(); return { w: atlas.width, h: atlas.height }; },
    get artMode() { return artMode; }, get rearrange() { return rearrange; },
    screenOf(x, y) { const b = cv.getBoundingClientRect(); return { x: b.left + sx(x), y: b.top + sy(y) }; },
    get tile() { return tile; },
    imagesReady() { const all = [...W.items, ...W.wall].map(p => imgs[p.fid]); return { total: all.length, ok: all.filter(ok).length }; },
  };
  window.advanceTime = (ms) => { PE.step(W, ms / 1000); render(); };
  window.render_game_to_text = () => { const s = PE.snapshot(W); delete s.items; return JSON.stringify(s); };

  /* ---------- 启动 ---------- */
  // manifest 加载：手机网络抖一下就重试（最多 4 次），页面正在关闭时不报错
  let leaving = false; window.addEventListener('pagehide', () => { leaving = true; });
  function boot(m) {
    const v = PA.validateManifest(m); if (!v.ok) throw new Error(v.errors.join('；'));
    M = m;
    const res = makeWorld(true); resize(); welcomeBack(res);
    if (!m.placeholder && m.atlas.image) { const im = new Image(); im.onload = () => { atlas = im; artMode = 'atlas'; }; im.onerror = () => console.warn('图集没加载到，先用占位小狗'); im.src = 'art/' + m.atlas.image + '?v=p1'; }
    if (Q.get('art') === 'atlas') window.__pet.bakeAtlas();
    document.body.dataset.ready = '1';
    requestAnimationFrame(frame);
  }
  function loadManifest(tryN) {
    fetch('art/manifest.json?v=p1').then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); }).then(boot).catch(e => {
      if (leaving) return;
      if (tryN < 3) { $('label').textContent = '加载中…'; setTimeout(() => loadManifest(tryN + 1), 500 * (tryN + 1)); return; }
      $('label').textContent = '加载失败：' + e.message + '（下拉刷新试试）'; console.error(e);
    });
  }
  loadManifest(0);
})();
