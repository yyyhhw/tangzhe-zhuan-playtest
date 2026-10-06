# 宠物原型 p3 — 手机端端到端测试（WebKit = iPhone Safari 内核）
# 用法：在仓库根目录起静态服务（python3 -m http.server 49761），再 /workspace/.pwvenv/bin/python preview/pet/test_pet_e2e.py [URL]
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49761/preview/pet/index.html'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shots'); os.makedirs(SHOTS, exist_ok=True)
KEY = 'tangzhe-pet-proto'
results = []
def check(c, msg): results.append((bool(c), msg)); print(('  ✓ ' if c else '  ✗ ') + msg)
# 在页面里按帧推进并逐帧检查：不压家具、不瞬移
# p3：页面里逐帧量占位小狗每帧的像素外形（不看 manifest.body，独立核对），算屏幕上的鼻尖 / 尾巴范围
P3_SETUP = """() => { if (window.__p3) return true; const P = __pet, M = P.M, PE = P.PE, C = PE.CFG;
  const bb = {}; for (const [name, c] of Object.entries(M.clips)) bb[name] = c.frames.map((f, i) => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
    PetPuppy.drawFrame(x, M, name, i); const d = x.getImageData(0, 0, 256, 256).data; let a = 999, b = -1;
    for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) if (d[(y * 256 + xx) * 4 + 3] > 8) { if (xx < a) a = xx; if (xx > b) b = xx; } return [a, b + 1]; });
  const K = 1.8 / 256, PX = { E: [46, 217], N: [92, 164], S: [88, 169] };
  const visDir = (w) => PetArt.IN_PLACE.includes(w.dog.anim.name) ? (w.dog.dir === 'W' ? 'W' : 'E') : w.dog.dir;
  window.__p3 = { bb, visDir,
    // 地面身体盒（逐帧量出的外形 → 格）压到实体家具
    boxHit(w) { const dir = visDir(w), e = PX[dir === 'W' ? 'E' : dir]; let l = (128 - e[0]) * K, r = (e[1] - 128) * K; if (dir === 'W') [l, r] = [r, l];
      const d = w.dog; for (const p of w.items) { if (!PE.isSolid(w, p)) continue; const q = PE.itemRect(w, p); if (d.x - l < q.x + q.w - 1e-6 && d.x + r > q.x + 1e-6 && d.y - C.R < q.y + q.h - 1e-6 && d.y + C.R > q.y + 1e-6) return p.uid; } return null; },
    // 屏幕像素级：小狗这一帧画出来的左右范围 和 同一纵深带里家具图的左右范围 有没有交叠
    visHit(w) { const d = w.dog, t = P.tile, k = M.runtime.displayTiles * t / 256, fi = d.anim.frame(), ab = bb[d.anim.name][fi], gx = d.x * t;
      const lo = d.dir === 'W' ? gx - (ab[1] - 128) * k : gx + (ab[0] - 128) * k, hi = d.dir === 'W' ? gx - (ab[0] - 128) * k : gx + (ab[1] - 128) * k;
      for (const p of w.items) { if (!PE.isSolid(w, p)) continue; const q = PE.itemRect(w, p); if (!(d.y - C.R < q.y + q.h - 1e-6 && d.y + C.R > q.y + 1e-6)) continue;
        const ir = P.itemDrawRect ? P.itemDrawRect(p.uid) : { x: q.x * t, w: q.w * t }; if (hi > ir.x + 0.5 && lo < ir.x + ir.w - 0.5) return p.uid; } return null; } };
  return true; }"""
STEP_JS = """([sec, watch]) => { const P = __pet, w = P.w, PE = P.PE, C = PE.CFG; const out = { overlap: 0, teleport: 0, body: 0, vis: 0, dirs: {}, seq: [], carriedFrames: 0, maxGap: 0, petStarts0: w.stats.petStarts };
  for (let i = 0; i < Math.round(sec * 60); i++) { const ox = w.dog.x, oy = w.dog.y; PE.update(w, 1 / 60);
    if (Math.hypot(w.dog.x - ox, w.dog.y - oy) > C.RUN / 60 + 1e-9) out.teleport++;
    if (PE.minClearance(w) < C.R - 1e-6) out.overlap++;
    if (window.__p3) { if (__p3.boxHit(w)) out.body++; if (__p3.visHit(w)) out.vis++; const vd = __p3.visDir(w); out.dirs[vd] = (out.dirs[vd] || 0) + 1; }
    const c = w.dog.anim.name; if (out.seq[out.seq.length - 1] !== c) out.seq.push(c);
    if (w.ball.state === 'carried') { out.carriedFrames++; out.maxGap = Math.max(out.maxGap, Math.hypot(w.ball.x - w.dog.x, w.ball.y - w.dog.y)); }
    if (watch && w.dog.activity !== watch) break; }
  P.advance(0); out.snap = P.snapshot(); return out; }"""
with sync_playwright() as p:
    b = p.webkit.launch()
    for devname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
        tag = devname.replace(' ', '_').replace('(', '').replace(')', '')
        print(f'== {devname} ==')
        ctx = b.new_context(**p.devices[devname]); pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: m.type in ('error', 'warning') and errs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
        pg.on('response', lambda r: r.status >= 400 and errs.append(f'{r.status} {r.url}'))
        pg.on('requestfailed', lambda r: errs.append(f'failed {r.url}'))
        pg.goto(URL); pg.wait_for_function("document.body.dataset.ready==='1' && __pet.imagesReady().ok === __pet.imagesReady().total", timeout=20000)   # 等首屏全加载完再跳，免得把在途请求算成坏请求
        pg.evaluate("localStorage.clear(); localStorage.setItem('tangzhe-save', '{\"sentinel\":1}')")
        pg.goto(URL + '?seed=5'); pg.wait_for_function("document.body.dataset.ready==='1'", timeout=15000)
        pg.wait_for_function("__pet.imagesReady().ok === __pet.imagesReady().total", timeout=15000)
        pg.wait_for_timeout(600)
        pg.evaluate(P3_SETUP)
        vp = pg.viewport_size
        lay = pg.evaluate("""() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { cv: r('#room'), move: r('#bMove'), call: r('#bCall'), ball: r('#bBall'), sw: document.documentElement.scrollWidth, iw: innerWidth, label: r('#label') }; }""")
        check(lay['cv']['left'] >= 0 and lay['cv']['right'] <= vp['width'] + 0.5, f'房间画布在屏幕宽度内（{lay["cv"]["width"]:.0f}×{lay["cv"]["height"]:.0f}）')
        check(lay['move']['bottom'] <= vp['height'] and lay['ball']['bottom'] <= vp['height'], f'三个按钮 + 搬家具不用滚屏就看得到（底 {lay["move"]["bottom"]:.0f} ≤ {vp["height"]}）')
        check(lay['sw'] <= lay['iw'], '没有横向滚动')
        check(lay['call']['height'] >= 40, f'按钮够大好点（{lay["call"]["height"]:.0f}px 高）')
        ir = pg.evaluate("__pet.imagesReady()"); check(ir['ok'] == ir['total'] and ir['total'] >= 14, f'房间家具真图都加载了（{ir["ok"]}/{ir["total"]}）')
        pg.screenshot(path=f'{SHOTS}/{tag}_1_room.png')
        full = devname != 'iPhone SE'
        if full:
            pg.evaluate("__pet.manual(true)")
            r = pg.evaluate(STEP_JS, [120, None])
            kinds = sorted(set(pg.evaluate("__pet.w.log.map(l => l.kind)")))
            check(len(kinds) >= 4, f'放着 2 分钟（加速）做了 {len(kinds)} 种事：{"/".join(kinds)}')
            check(r['overlap'] == 0 and r['teleport'] == 0, '2 分钟里不压家具、不瞬移')
            check(r['body'] == 0 and r['vis'] == 0, f'p3：2 分钟里鼻尖 / 尾巴不进家具（地面盒 {r["body"]} 帧，屏幕像素交叠 {r["vis"]} 帧，朝向 {r["dirs"]}）')
            # 呼唤：点按钮
            pg.evaluate("(() => { const w = __pet.w; w.dog.x = 8.2; w.dog.y = 2.0; w.dog.plan = []; w.dog.step = null; w.dog.activity = 'idle'; })()")
            aff0 = pg.evaluate("__pet.w.dog.affinity")
            pg.tap('#bCall')
            r = pg.evaluate(STEP_JS, [15, 'called'])
            seq = r['seq']; mv = [i for i, c in enumerate(seq) if c.startswith('walk') or c.startswith('run')]
            check('attention' in seq and mv and seq.index('attention') < mv[0], '点「呼唤」：先扭头（attention）再走过来 ' + '>'.join(seq[:5]))
            cs = pg.evaluate("__pet.PE.callSpot(__pet.w)"); d = r['snap']['dog']
            check(abs(d['x'] - cs['x']) < 0.05 and abs(d['y'] - cs['y']) < 0.05 and d['dir'] == 'S', '走到你面前、面朝你')
            check(r['overlap'] == 0 and r['teleport'] == 0 and r['body'] == 0 and r['vis'] == 0, '绕家具过来，没穿过去（鼻尖 / 尾巴也没进家具）')
            check(d['affinity'] == aff0 + 1, f'亲密 {aff0} → {d["affinity"]}')
            # 抛球：点按钮
            pg.tap('#bBall')
            r = pg.evaluate(STEP_JS, [1.2, None]); pg.screenshot(path=f'{SHOTS}/{tag}_2_ball_air.png')
            seq = r['seq']
            r2 = pg.evaluate("""() => { const P = __pet, w = P.w; for (let i = 0; i < 40 * 60; i++) { P.PE.update(w, 1 / 60); if (w.ball.state === 'carried') break; } P.advance(0.6); return P.snapshot(); }""")
            pg.screenshot(path=f'{SHOTS}/{tag}_3_carry.png')
            check(r2['ball']['state'] == 'carried', '球被叼在嘴里（截图 3）')
            r3 = pg.evaluate(STEP_JS, [30, 'fetch'])
            seqall = seq + r3['seq']
            cs = pg.evaluate("__pet.PE.callSpot(__pet.w)"); bl = r3['snap']['ball']
            check(r3['carriedFrames'] > 30 and r3['maxGap'] < 0.35, f'叼着球走回来（{r3["carriedFrames"]} 帧，球一直在嘴边）')
            check(bl['state'] in ('floor', 'roll') and ((bl['x'] - cs['x']) ** 2 + (bl['y'] - cs['y']) ** 2) ** 0.5 < 1.2, '球放在你面前')
            check(r3['snap']['stats']['fetches'] >= 1, '叼回计数 +1')
            check(r3['overlap'] == 0 and r3['teleport'] == 0 and r3['body'] == 0 and r3['vis'] == 0, '追球 / 叼回不压家具不瞬移（鼻尖 / 尾巴也没进家具）')
            # 点小狗连摸 12 下
            pg.evaluate(STEP_JS, [2, None])
            pg.evaluate("(() => { const w = __pet.w; w.dog.plan = [{ k: 'wait', dur: 20 }]; w.dog.step = null; w.dog.activity = 'idle'; w.dog.petCdUntil = 0; })()"); pg.evaluate("__pet.advance(0.05)")
            st0 = pg.evaluate("__pet.w.stats.petStarts")
            pt = pg.evaluate("__pet.screenOf(__pet.w.dog.x, __pet.w.dog.y - 0.4)")
            for i in range(12):
                pg.touchscreen.tap(pt['x'], pt['y']); pg.evaluate("__pet.advance(0.08)")
            pg.screenshot(path=f'{SHOTS}/{tag}_4_petted.png')
            pg.evaluate("__pet.advance(2)")
            st = pg.evaluate("__pet.w.stats")
            check(st['petStarts'] - st0 == 1 and st['petAbsorbed'] >= 11, f'连点小狗 12 下：抚摸动画只播 1 次（吞掉 {st["petAbsorbed"]} 下）')
            # 搬家具：拖被炉
            pg.tap('#bMove'); pg.evaluate("__pet.advance(0.1)")
            dis = pg.evaluate("[...document.querySelectorAll('.ctl .btn')].map(b => b.disabled)")
            check(all(dis), '搬家具时三个操作按钮都暂停')
            pos0 = pg.evaluate("({ x: __pet.w.dog.x, y: __pet.w.dog.y })")
            item = pg.evaluate("__pet.w.items.find(p => p.fid === 'furn_otaku_kotatsu')")
            a = pg.evaluate(f"__pet.screenOf({item['x']} + 1, {item['y']} + 0.5)")
            tgt = pg.evaluate(f"__pet.screenOf({item['x']} + 1, {item['y']} + 0.5 - 2)")
            pg.mouse.move(a['x'], a['y']); pg.mouse.down()
            for k in range(1, 9): pg.mouse.move(a['x'] + (tgt['x'] - a['x']) * k / 8, a['y'] + (tgt['y'] - a['y']) * k / 8)
            pg.evaluate("__pet.advance(0.05)"); pg.screenshot(path=f'{SHOTS}/{tag}_5_rearrange.png')
            pg.mouse.up(); pg.evaluate("__pet.advance(2)")
            item2 = pg.evaluate("__pet.w.items.find(p => p.fid === 'furn_otaku_kotatsu')")
            pos1 = pg.evaluate("({ x: __pet.w.dog.x, y: __pet.w.dog.y })")
            check(item2['y'] == item['y'] - 2 and item2['x'] == item['x'], f'拖动被炉 ({item["x"]},{item["y"]}) → ({item2["x"]},{item2["y"]})')
            check(abs(pos0['x'] - pos1['x']) < 1e-9 and abs(pos0['y'] - pos1['y']) < 1e-9, '搬家具时小狗停着等')
            pg.tap('#bMove'); pg.evaluate("__pet.advance(0.1)")
            sv = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))")
            check(any(i['fid'] == 'furn_otaku_kotatsu' and i['y'] == item2['y'] for i in sv['items']), '放好后存进宠物存档')
            r = pg.evaluate(STEP_JS, [30, None]); check(r['overlap'] == 0 and r['teleport'] == 0, '换完摆设继续活动，不穿新位置的被炉')
            # 累了：回窝趴下睡
            pg.evaluate("(() => { const w = __pet.w; w.dog.energy = 34; w.dog.plan = []; w.dog.step = null; w.dog.activity = 'idle'; })()")
            r = pg.evaluate("""() => { const P = __pet, w = P.w, seq = []; for (let i = 0; i < 60 * 60; i++) { P.PE.update(w, 1 / 60); const c = w.dog.anim.name; if (seq[seq.length - 1] !== c) seq.push(c); if (c === 'sleep' && w.t - w.dog.step.t0 > 2) break; } P.advance(0); return { seq, snap: P.snapshot() }; }""")
            pg.screenshot(path=f'{SHOTS}/{tag}_6_sleep.png')
            seq = r['seq']
            check('liedown' in seq and seq[seq.index('liedown') + 1] == 'sleep', '累了：回窝 → 趴下 → 睡 ' + '>'.join(seq[-4:]))
            # 离线 10 分钟
            pg.evaluate("__pet.save()")
            aff = pg.evaluate("__pet.w.dog.affinity")
            pg.close()   # 关页面（pagehide 时会再存一次，正常行为）；新页面开局前把存档时间往前拨 10 分钟
            ctx.add_init_script(f"""(() => {{ if (sessionStorage.getItem('tz_off')) return; sessionStorage.setItem('tz_off', '1');
              const s = JSON.parse(localStorage.getItem('{KEY}')); s.savedAt -= 10 * 60 * 1000; s.dog.energy = 20; localStorage.setItem('{KEY}', JSON.stringify(s)); }})()""")
            pg = ctx.new_page()
            pg.on('console', lambda m: m.type in ('error', 'warning') and errs.append(f'{m.type}: {m.text}'))
            pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
            pg.on('response', lambda r: r.status >= 400 and errs.append(f'{r.status} {r.url}'))
            pg.goto(URL + '?seed=5'); pg.wait_for_function("document.body.dataset.ready==='1'"); pg.evaluate("__pet.manual(true)")
            pg.wait_for_function("__pet.imagesReady().ok === __pet.imagesReady().total", timeout=15000); pg.evaluate("__pet.advance(0)")
            pg.screenshot(path=f'{SHOTS}/{tag}_7_back.png')
            sn = pg.evaluate("__pet.snapshot()"); toast = pg.inner_text('#toast')
            check(sn['dog']['affinity'] == aff and sn['dog']['energy'] == 100, f'离开 10 分钟回来：亲密不掉（{aff}）、精力按休息回到 {sn["dog"]["energy"]}')
            check(sn['dog']['clip'] == 'sleep' and '分钟' in toast, f'回来看到它在窝里睡（提示：{toast}）')
            r = pg.evaluate(STEP_JS, [8, None]); check('getup' in r['seq'], '然后伸懒腰起来')
            keys = pg.evaluate("Object.keys(localStorage).sort()")
            check(keys == ['tangzhe-pet-proto', 'tangzhe-save'] and pg.evaluate("localStorage.getItem('tangzhe-save')") == '{"sentinel":1}', f'只写自己的键 {KEY}，正式存档 tangzhe-save 原样没动')
            check(sn['incomeBonus'] == 0, '收益加成 0')
            # 回归（熊大 p1 复核）：叼球中点小狗抚摸 → 自动放球 → 不用呼唤就能再抛
            pg.evaluate("(() => { const w = __pet.w; w.dog.plan = []; w.dog.step = null; w.dog.activity = 'idle'; w.dog.tired = false; w.dog.energy = 90; w.dog.petCdUntil = 0; })()")
            pg.tap('#bBall')
            rc = pg.evaluate("""() => { const P = __pet, w = P.w; for (let i = 0; i < 40 * 60; i++) { P.PE.update(w, 1 / 60); if (w.ball.state === 'carried') break; } P.advance(0.3); return w.ball.state; }""")
            check(rc == 'carried', '回归：先叼起球')
            pt = pg.evaluate("__pet.screenOf(__pet.w.dog.x, __pet.w.dog.y - 0.4)"); pg.touchscreen.tap(pt['x'], pt['y'])
            r = pg.evaluate(STEP_JS, [20, None])
            st = pg.evaluate("({ ball: __pet.w.ball.state, carrying: __pet.w.dog.carrying, dis: document.getElementById('bBall').disabled })")
            check(st['ball'] != 'carried' and not st['carrying'] and not st['dis'] and r['overlap'] == 0 and r['teleport'] == 0, f'回归：叼球中抚摸 → 自动放球，抛球按钮可点（{st}）')
            pg.tap('#bBall'); r = pg.evaluate(STEP_JS, [1.0, None])
            check(pg.evaluate("__pet.w.ball.state") in ('air', 'roll', 'floor', 'carried') and pg.evaluate("__pet.w.dog.activity") == 'fetch', '回归：不用呼唤直接再抛，小狗去追')
            # 回归：0 精力存档即时读档 → 仍是 0（不变成 70）
            pg.evaluate("sessionStorage.setItem('tz_e0', '1')")
            ctx.add_init_script(f"""(() => {{ if (sessionStorage.getItem('tz_e0') !== '1') return; sessionStorage.setItem('tz_e0', '2');
              const s = JSON.parse(localStorage.getItem('{KEY}')); s.savedAt = Date.now(); s.dog.energy = 0; s.dog.asleep = false; s.dog.tired = false; localStorage.setItem('{KEY}', JSON.stringify(s)); }})()""")
            pg.reload(); pg.wait_for_function("document.body.dataset.ready==='1'"); pg.evaluate("__pet.manual(true)")
            pg.wait_for_function("__pet.imagesReady().ok === __pet.imagesReady().total", timeout=15000)
            e0 = pg.evaluate("({ e: __pet.w.dog.energy, tired: __pet.w.dog.tired, flag: sessionStorage.getItem('tz_e0') })")
            check(e0['flag'] == '2' and e0['e'] < 0.5 and e0['tired'], f'回归：0 精力即时读档保留 0（{e0["e"]:.3f}，累={e0["tired"]}）')
            # ===== p3 回归（熊大 p2 复核三项）=====
            pg.goto(URL + '?fresh=1&seed=7'); pg.wait_for_function("document.body.dataset.ready==='1'"); pg.evaluate("__pet.manual(true)")
            pg.wait_for_function("__pet.imagesReady().ok === __pet.imagesReady().total", timeout=15000); pg.evaluate(P3_SETUP)
            # (c) 身体外形校准：每个片段每一帧画出来的左右范围都在 manifest.body 里（各朝向）
            cal = pg.evaluate("""() => { const M = __pet.M, out = { ok: true, bad: [] }; if (!M.body) return { ok: false, bad: ['manifest 没有 body'] };
              for (const [name, c] of Object.entries(M.clips)) __p3.bb[name].forEach((ab, i) => { const b = M.body[c.dir]; if (ab[0] < b[0] || ab[1] > b[1]) { out.ok = false; out.bad.push(name + '#' + i + ' ' + ab); } }); return out; }""")
            check(cal['ok'], 'p3 (c)：108 帧每帧画出来的鼻尖 / 尾巴 / 耳朵都在 manifest.body 范围里' + ('' if cal['ok'] else '：' + '；'.join(cal['bad'][:3])))
            # (a) 小狗正在闻猫窝 → 点「搬家具」把猫窝拖走 → 不在旧位置闻，跟到新位置闻
            pg.evaluate("""() => { const w = __pet.w, PE = __pet.PE; w.dog.energy = 90; w.dog.tired = false; w.dog.x = 2.0; w.dog.y = 2.6; w.dog.plan = []; w.dog.step = null;
              if (PE.visit) PE.visit(w, 'f8'); else { const s = PE.interactSpot(w, 'furn_catbed'); w.dog.plan = [{ k: 'goto', to: s.spot, speed: 'walk' }, { k: 'face', dir: 'E' }, { k: 'anim', clip: 'sniff' }, { k: 'anim', clip: 'sniff' }, { k: 'wait', dur: 3 }]; w.dog.activity = 'visit'; }
              for (let i = 0; i < 30 * 60; i++) { PE.update(w, 1 / 60); if (w.dog.anim.name === 'sniff' && w.dog.activity === 'visit') break; } __pet.advance(0); }""")
            old = pg.evaluate("(() => { const w = __pet.w; return { x: w.dog.x, y: w.dog.y, clip: w.dog.anim.name }; })()")
            check(old['clip'] == 'sniff', f'p3 (a)：小狗在猫窝边闻（{old["x"]:.2f},{old["y"]:.2f}）')
            pg.tap('#bMove'); pg.evaluate("__pet.advance(0.05)")
            def drag(fx, fy, tx, ty):
                a = pg.evaluate(f"__pet.screenOf({fx}, {fy})"); t = pg.evaluate(f"__pet.screenOf({tx}, {ty})")
                pg.mouse.move(a['x'], a['y']); pg.mouse.down()
                for k in range(1, 9): pg.mouse.move(a['x'] + (t['x'] - a['x']) * k / 8, a['y'] + (t['y'] - a['y']) * k / 8)
                pg.mouse.up(); pg.evaluate("__pet.advance(0.05)")
            drag(9.5, 4.5, 5.5, 5.5)
            cb = pg.evaluate("__pet.w.items.find(p => p.uid === 'f8')")
            check(cb['x'] == 5 and cb['y'] == 5, f'p3 (a)：拖动把猫窝 (9,4) → ({cb["x"]},{cb["y"]})')
            pg.tap('#bMove'); pg.evaluate("__pet.advance(0.05)")
            ra = pg.evaluate("""([ox, oy]) => { const P = __pet, w = P.w, PE = P.PE, out = { oldS: 0, newS: 0, body: 0, vis: 0 };
              for (let i = 0; i < 40 * 60; i++) { PE.update(w, 1 / 60); const sn = w.dog.anim.name === 'sniff', s = PE.interactSpot(w, 'furn_catbed', 'f8');
                if (sn && Math.hypot(w.dog.x - ox, w.dog.y - oy) < 0.3) out.oldS++; if (sn && s && Math.hypot(w.dog.x - s.spot.x, w.dog.y - s.spot.y) < 0.05) out.newS++;
                if (__p3.boxHit(w)) out.body++; if (__p3.visHit(w)) out.vis++; if (out.newS > 30) break; } P.advance(0); return out; }""", [old['x'], old['y']])
            pg.screenshot(path=f'{SHOTS}/{tag}_8_catbed_moved.png')
            check(ra['oldS'] == 0 and ra['newS'] > 0, f'p3 (a)：搬走后不在旧位置闻（旧 {ra["oldS"]} 帧），跟到新位置闻（新 {ra["newS"]} 帧）')
            check(ra['body'] == 0 and ra['vis'] == 0, f'p3 (c)：去新猫窝一路 + 闻的时候鼻尖不进家具图（地面 {ra["body"]} / 屏幕 {ra["vis"]}）')
            # (b) 拖动交换摇椅 (2,5) ↔ 绿植 (0,6)（经临时空位），刷新后保留
            pg.evaluate("(() => { const w = __pet.w; w.dog.plan = [{ k: 'wait', dur: 60 }]; w.dog.step = null; })()")
            pg.tap('#bMove'); pg.evaluate("__pet.advance(0.05)")
            drag(0.5, 6.5, 1.5, 7.5); drag(2.5, 5.5, 0.5, 6.5); drag(1.5, 7.5, 2.5, 5.5)
            pg.tap('#bMove'); pg.evaluate("__pet.advance(0.05)")
            sw = pg.evaluate("(() => { const w = __pet.w, f = (u) => { const p = w.items.find(q => q.uid === u); return [p.x, p.y]; }; return { chair: f('f10'), plant: f('f12') }; })()")
            check(sw['chair'] == [0, 6] and sw['plant'] == [2, 5], f'p3 (b)：拖动交换 摇椅→{sw["chair"]}、绿植→{sw["plant"]}')
            pg.goto(URL + '?seed=7'); pg.wait_for_function("document.body.dataset.ready==='1'"); pg.evaluate("__pet.manual(true)")
            pg.wait_for_function("__pet.imagesReady().ok === __pet.imagesReady().total", timeout=15000); pg.evaluate("__pet.advance(0)")
            sw2 = pg.evaluate("(() => { const w = __pet.w, f = (u) => { const p = w.items.find(q => q.uid === u); return [p.x, p.y]; }; return { chair: f('f10'), plant: f('f12'), cat: f('f8') }; })()")
            pg.screenshot(path=f'{SHOTS}/{tag}_9_swap_reload.png')
            check(sw2['chair'] == [0, 6] and sw2['plant'] == [2, 5] and sw2['cat'] == [5, 5], f'p3 (b)：刷新后交换保留（摇椅 {sw2["chair"]}、绿植 {sw2["plant"]}、猫窝 {sw2["cat"]}），没被打回默认')
            pg.evaluate(P3_SETUP); r = pg.evaluate(STEP_JS, [60, None])
            check(r['overlap'] == 0 and r['teleport'] == 0 and r['body'] == 0 and r['vis'] == 0, f'p3：新摆设下活动 1 分钟，鼻尖 / 尾巴不进家具（地面 {r["body"]} / 屏幕 {r["vis"]}，朝向 {r["dirs"]}）')
        # ===== p4a 回归（熊大 p3 复核：1 格宽竖走廊里转不开身还播侧身动作，身体两侧穿墙）=====
        pg.goto(URL + '?fresh=1&seed=11'); pg.wait_for_function("document.body.dataset.ready==='1'"); pg.evaluate("__pet.manual(true)")
        pg.wait_for_function("__pet.imagesReady().ok === __pet.imagesReady().total", timeout=15000); pg.evaluate(P3_SETUP)
        def col(x, y0, y1, t): return [{'uid': f'{t}{x}_{y}', 'fid': 'furn_plant', 'x': x, 'y': y} for y in range(y0, y1)]
        def row(y, x0, x1, t): return [{'uid': f'{t}{x}_{y}', 'fid': 'furn_plant', 'x': x, 'y': y} for x in range(x0, x1)]
        CASES = [
            ('竖走廊', col(3, 0, 7, 'L') + col(5, 0, 7, 'R'), 4.5, 2.5, 'S', False),
            ('横走廊', row(1, 2, 9, 'T') + row(3, 2, 9, 'B'), 5.5, 2.5, 'E', True),
            ('死胡同', col(3, 0, 4, 'L') + col(5, 0, 4, 'R') + [{'uid': 'cap', 'fid': 'furn_plant', 'x': 4, 'y': 3}], 4.5, 1.5, 'N', False),
            ('边界格', col(1, 0, 3, 'C'), 0.5, 1.2, 'S', False),
        ]
        for name, items, x, y, dr, side_ok in CASES:
            pg.evaluate("""([items, x, y, dr]) => { const P = __pet, w = P.w, PE = P.PE; PE.setLayout(w, { items }); const d = w.dog;
              d.x = x; d.y = y; d.dir = dr; d.plan = []; d.step = null; d.activity = 'idle'; d.lastGain = -1e9; d.petCdUntil = 0; d.energy = 80; d.tired = false; w.ball.state = 'floor'; P.advance(0); }""", [items, x, y, dr])
            fr = pg.evaluate("(() => { const w = __pet.w; return { E: __pet.PE.bodyFree(w, w.dog.x, w.dog.y, 'E'), W: __pet.PE.bodyFree(w, w.dog.x, w.dog.y, 'W'), V: __pet.PE.bodyFree(w, w.dog.x, w.dog.y, 'V') }; })()")
            pt = pg.evaluate("(() => { const w = __pet.w; return __pet.screenOf(w.dog.x, w.dog.y - 0.4); })()")
            a0 = pg.evaluate("__pet.w.dog.affinity")
            pg.mouse.click(pt['x'], pt['y'])
            r = pg.evaluate(STEP_JS, [3, None]); a1 = pg.evaluate("__pet.w.dog.affinity")
            if name == '边界格': pg.screenshot(path=f'{SHOTS}/{tag}_p4a_edge.png')
            if name == '竖走廊': pg.screenshot(path=f'{SHOTS}/{tag}_p4a_vcorr.png')
            tapped = 'petted' in r['seq'] or a1 > a0
            check(fr['V'] and (fr['E'] or fr['W']) == side_ok, f'p4a {name}：站得下，侧身{"放得下" if side_ok else "放不下"}（E={fr["E"]} W={fr["W"]}）')
            check(tapped and r['body'] == 0 and r['vis'] == 0 and r['overlap'] == 0 and r['teleport'] == 0, f'p4a {name}：点小狗有回应（亲密 {a0}→{a1}），身体盒不穿墙（地面 {r["body"]} / 屏幕 {r["vis"]}，动作 {"→".join(r["seq"][:6])}）')
            if side_ok: check('petted' in r['seq'], f'p4a {name}：侧身放得下 → 正常播侧身抚摸（不误拦）')
            elif name != '边界格': check('petted' not in r['seq'], f'p4a {name}：转不开身 → 不播侧身抚摸（站着摇尾巴）')
            for k, js in (('呼唤', "__pet.PE.call(__pet.w)"), ('抛球', "__pet.PE.throwBall(__pet.w)")):
                pg.evaluate(js); r = pg.evaluate(STEP_JS, [8, None])
                check(r['body'] == 0 and r['vis'] == 0 and r['overlap'] == 0, f'p4a {name}{k}：不穿墙（地面 {r["body"]} / 屏幕 {r["vis"]}）')
            r = pg.evaluate(STEP_JS, [90, None])
            check(r['body'] == 0 and r['vis'] == 0 and r['overlap'] == 0 and r['teleport'] == 0, f'p4a {name}：自主活动 90 秒不穿墙（地面 {r["body"]} / 屏幕 {r["vis"]}，朝向 {r["dirs"]}）')
        check(not errs, '控制台 0 报错 / 0 警告 / 0 坏请求' + ('' if not errs else '：' + '；'.join(errs[:4])))
        ctx.close()
    # 换真图集那条路：把占位帧烘成 2048×1024 图集再按 cell 画
    ctx = b.new_context(**p.devices['iPhone 15']); pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: m.type in ('error', 'warning') and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '?fresh=1&art=atlas&seed=8'); pg.wait_for_function("document.body.dataset.ready==='1'"); pg.wait_for_timeout(1500)
    check(pg.evaluate("__pet.artMode") == 'atlas', '图集模式（按 manifest cell 取帧）能跑')
    pg.screenshot(path=f'{SHOTS}/atlas_mode.png')
    check(not errs, '图集模式 0 报错')
    ctx.close()
    # 手机网络抖：第一次 manifest 请求失败也能自己重试起来，且不报错
    ctx = b.new_context(**p.devices['iPhone 15']); pg = ctx.new_page(); errs = []; hits = {'n': 0}
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
    def flaky(route):
        hits['n'] += 1
        route.abort() if hits['n'] == 1 else route.continue_()
    pg.route('**/art/manifest.json*', flaky)
    pg.goto(URL + '?fresh=1'); pg.wait_for_function("document.body.dataset.ready==='1'", timeout=15000)
    check(hits['n'] >= 2 and not errs, f'manifest 第一次没拉到 → 自动重试成功（请求 {hits["n"]} 次，0 报错）')
    ctx.close(); b.close()
ok = sum(1 for c, _ in results if c)
print(f'\n端到端：{ok} 过 / {len(results) - ok} 挂')
sys.exit(0 if ok == len(results) else 1)
