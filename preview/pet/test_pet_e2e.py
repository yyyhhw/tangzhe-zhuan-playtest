# 宠物原型 p2 — 手机端端到端测试（WebKit = iPhone Safari 内核）
# 用法：在仓库根目录起静态服务（python3 -m http.server 49761），再 /workspace/.pwvenv/bin/python preview/pet/test_pet_e2e.py [URL]
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49761/preview/pet/index.html'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shots'); os.makedirs(SHOTS, exist_ok=True)
KEY = 'tangzhe-pet-proto'
results = []
def check(c, msg): results.append((bool(c), msg)); print(('  ✓ ' if c else '  ✗ ') + msg)
# 在页面里按帧推进并逐帧检查：不压家具、不瞬移
STEP_JS = """([sec, watch]) => { const P = __pet, w = P.w, PE = P.PE, C = PE.CFG; const out = { overlap: 0, teleport: 0, seq: [], carriedFrames: 0, maxGap: 0, petStarts0: w.stats.petStarts };
  for (let i = 0; i < Math.round(sec * 60); i++) { const ox = w.dog.x, oy = w.dog.y; PE.update(w, 1 / 60);
    if (Math.hypot(w.dog.x - ox, w.dog.y - oy) > C.RUN / 60 + 1e-9) out.teleport++;
    if (PE.minClearance(w) < C.R - 1e-6) out.overlap++;
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
            # 呼唤：点按钮
            pg.evaluate("(() => { const w = __pet.w; w.dog.x = 8.6; w.dog.y = 2.0; w.dog.plan = []; w.dog.step = null; w.dog.activity = 'idle'; })()")
            aff0 = pg.evaluate("__pet.w.dog.affinity")
            pg.tap('#bCall')
            r = pg.evaluate(STEP_JS, [15, 'called'])
            seq = r['seq']; mv = [i for i, c in enumerate(seq) if c.startswith('walk') or c.startswith('run')]
            check('attention' in seq and mv and seq.index('attention') < mv[0], '点「呼唤」：先扭头（attention）再走过来 ' + '>'.join(seq[:5]))
            cs = pg.evaluate("__pet.PE.callSpot(__pet.w)"); d = r['snap']['dog']
            check(abs(d['x'] - cs['x']) < 0.05 and abs(d['y'] - cs['y']) < 0.05 and d['dir'] == 'S', '走到你面前、面朝你')
            check(r['overlap'] == 0 and r['teleport'] == 0, '绕家具过来，没穿过去')
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
            check(r3['overlap'] == 0 and r3['teleport'] == 0, '追球 / 叼回不压家具不瞬移')
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
