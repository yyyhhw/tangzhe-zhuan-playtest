# 宠物 p4 — 游戏接入端到端测试（WebKit = iPhone Safari 内核；iPhone SE / SE 3 / 15）
# 用法：仓库根目录起静态服务（python3 -m http.server 49761），再 /workspace/.pwvenv/bin/python preview/pet/game/test_petgame_e2e.py [URL]
# 覆盖：旧档（没有 pet 字段）照常读 → 商城看到小狗 → 点购买 → 进家宅出现小狗 → 自己活动（逐帧不压家具）→ 点小狗 / 呼唤 / 抛球
#       → 布置模式暂停、家具摆到它脚下会让开 → 刷新存档保留（短离开原地、长离开在窝里睡）→ 不新增存档键 → 主线预览读这份档不丢小狗 → 换正式图集的接口
# p4b：合法满屋购买（三档）不扣钱、「暂时无法入宅」；已有宠物满屋读档 / 布置挡满 / 搬进满屋 →「等待安置」，腾空 / 升级后自动出来；坏档（字符串 / 无穷 / 负数 / 缺字段 / null）读档不报错、存回去没有 NaN
import sys, os, json, base64
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49941/'   # v13 正式站：没有宠物快照页，测主游戏本体
if not URL.endswith('/'): URL = URL.rsplit('/', 1)[0] + '/' if URL.endswith('.html') else URL + '/'
PREVIEW = URL.rsplit('/pet/game/', 1)[0] + '/' if '/pet/game/' in URL else URL   # 12e：也能直接测主预览本体（宠物已并入）
SAVE = 'tangzhe-save'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_shots'); os.makedirs(SHOTS, exist_ok=True)
results = []
def check(c, msg): results.append((bool(c), msg)); print(('  ✓ ' if c else '  ✗ ') + msg)
DISMISS = """async () => { for (let i = 0; i < 12; i++) { if (__tzz.modalOpen()) { __tzz.closeModal(); const s = document.querySelector('#sheet'); if (s && !s.classList.contains('hidden')) s.classList.add('hidden'); } await new Promise(r => setTimeout(r, 160)); } return !__tzz.modalOpen(); }"""
# 逐帧看守：每个 rAF 查身体盒压家具 / 出界 / 画面上有没有小狗元素
WATCH = """() => { if (window.__pw) return; const PE = window.PetEngine; window.__pw = { frames: 0, overlap: 0, outside: 0, drawn: 0, acts: {} };
  const f = () => { const w = __tzz.pet.w; if (w) { __pw.frames++; if (PE.bodyOverlap(w)) __pw.overlap++; if (w.dog.x < 0 || w.dog.y < 0 || w.dog.x > w.cols || w.dog.y > w.rows) __pw.outside++;
    const el = document.querySelector('#roomFloor .pet-dog'); if (el) __pw.drawn++; __pw.acts[w.dog.activity] = 1; } requestAnimationFrame(f); }; requestAnimationFrame(f); }"""
# p4a：在页面里逐帧推进，独立按逐帧量出的外形（不读 manifest.body）查身体盒有没有压家具 / 出界，记下播过的动作
GSTEP = """async (sec) => { const PE = window.PetEngine, w = __tzz.pet.w, C = PE.CFG, M = __tzz.pet.M, K = M.runtime.displayTiles / 256;
  // p5：独立外形 = 页面里加载真图集逐 cell 量 alpha>8 左右范围的并集（不读 manifest.body），只量一次
  if (!window.__gpx) { const im = new Image(); im.src = (location.pathname.includes('/pet/game/') ? '../art/' : 'pet/art/') + M.atlas.image + '?v=p6'; await im.decode(); const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d', { willReadFrequently: true });
    const U = { E: [256, 0], N: [256, 0], S: [256, 0] }; let n = 0;
    for (const c of Object.values(M.clips)) for (const f of c.frames) { const r = window.PetArt.cellRect(M, f.cell); x.clearRect(0, 0, 128, 128); x.drawImage(im, r.sx, r.sy, r.s, r.s, 0, 0, 128, 128); const d = x.getImageData(0, 0, 128, 128).data; let a = 999, b = -1;
      for (let y = 0; y < 128; y++) for (let xx = 0; xx < 128; xx++) if (d[(y * 128 + xx) * 4 + 3] > 8) { if (xx < a) a = xx; if (xx > b) b = xx; } U[c.dir][0] = Math.min(U[c.dir][0], a * 2); U[c.dir][1] = Math.max(U[c.dir][1], (b + 1) * 2); n++; }
    window.__gpx = U; window.__gpxN = n; }
  const PX = window.__gpx;
  const vis = () => window.PetArt.IN_PLACE.includes(w.dog.anim.name) ? (w.dog.dir === 'W' ? 'W' : 'E') : w.dog.dir;
  const hit = () => { const dir = vis(), e = PX[dir === 'W' ? 'E' : dir]; let l = (128 - e[0]) * K, r = (e[1] - 128) * K; if (dir === 'W') [l, r] = [r, l]; const d = w.dog;
    if (d.x - l < -1e-6 || d.x + r > w.cols + 1e-6 || d.y - C.R < -1e-6 || d.y + C.R > w.rows + 1e-6) return true;
    for (const p of w.items) { if (!PE.isSolid(w, p)) continue; const q = PE.itemRect(w, p); if (d.x - l < q.x + q.w - 1e-6 && d.x + r > q.x + 1e-6 && d.y - C.R < q.y + q.h - 1e-6 && d.y + C.R > q.y + 1e-6) return true; } return false; };
  const out = { body: 0, eng: 0, seq: [], frames: 0 };
  for (let i = 0; i < Math.round(sec * 60); i++) { PE.update(w, 1 / 60); out.frames++; if (hit()) out.body++; if (PE.bodyOverlap(w)) out.eng++; const c = w.dog.anim.name; if (out.seq[out.seq.length - 1] !== c) out.seq.push(c); }
  return out; }"""
def boot(pg, url=None):
    pg.goto(url or URL); pg.wait_for_function("document.body.dataset.petReady==='1' && window.__tzz", timeout=20000); pg.evaluate(DISMISS)
def to_room(pg):
    pg.evaluate("() => { __tzz.setTab('home'); if (__tzz.homeSub !== 'room') __tzz.homeAct('homeSub', 'room'); __tzz.homeMode = 'live'; __tzz.renderTab(); }"); pg.wait_for_timeout(300)
    pg.evaluate("() => document.querySelector('#room').scrollIntoView({ block: 'start' })"); pg.wait_for_timeout(150)
def dog_px(pg):
    return pg.evaluate("() => { const w = __tzz.pet.w, r = document.querySelector('#roomFloor').getBoundingClientRect(), t = r.width / w.cols; return { x: r.left + w.dog.x * t, y: r.top + (w.dog.y - 0.45) * t }; }")
def canvas_ink(pg):
    return pg.evaluate("() => { const c = document.querySelector('#roomFloor .pet-dog canvas'); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; return n; }")

with sync_playwright() as p:
    b = p.webkit.launch()
    for devname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
        tag = 'game_' + devname.replace(' ', '_').replace('(', '').replace(')', '')
        print(f'== {devname} ==')
        ctx = b.new_context(**p.devices[devname]); pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: m.type in ('error', 'warning') and errs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
        pg.on('response', lambda r: r.status >= 400 and errs.append(f'{r.status} {r.url}'))
        pg.on('requestfailed', lambda r: None if 'cancel' in (r.failure or '').lower() else errs.append(f'failed {r.url} {r.failure}'))   # 换页 / 刷新时浏览器取消的在途请求不算坏请求
        boot(pg)
        # ---------- 旧档：没有 pet 字段 ----------
        pg.evaluate("""() => { const E = __tzz.E, s = E.newState(Date.now()); s.coins = 50000; s.taps = 321; s.totalEarned = 1000;
          for (const [f, x, y] of [['furn_sofa', 0, 0], ['furn_rug', 2, 1], ['furn_catbed', 4, 2]]) { s.coins += E.FURN_BY_ID[f].price; E.buyFurniture(s, f); E.placeItem(s, 'c77', f, x, y, 0, 'floor'); }
          s.coins = 50000; s.rev = 100000; delete s.pet; localStorage.clear(); localStorage.setItem('tangzhe-preview-save', '{"sentinel":1}'); localStorage.setItem('""" + SAVE + """', JSON.stringify(s)); }""")
        boot(pg)
        st = pg.evaluate("() => { const s = __tzz.state, raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { pet: 'pet' in s, rawPet: 'pet' in raw, coins: s.coins, taps: s.taps, placed: __tzz.E.homeOf(s, 'c77').placed.map(p => p.fid), keys: Object.keys(localStorage).sort() }; }")
        check(not st['pet'] and not st['rawPet'], '旧档（没有 pet 字段）读进来：没有小狗，存回去也不多字段')
        check(st['coins'] == 50000 and st['taps'] == 321 and st['placed'] == ['furn_sofa', 'furn_rug', 'furn_catbed'], f'旧档其余内容都在（金币 {st["coins"]}、点击 {st["taps"]}、家具 {len(st["placed"])} 件）')
        keys0 = st['keys']
        to_room(pg)
        check(pg.locator('#petNote').count() == 0 and pg.locator('#petBar').count() == 0 and pg.locator('#roomFloor .pet-dog').count() == 0, '家宅：还没小狗 → 不加提示条、不画小狗（12e 并入主预览：没买狗时家宅布局和原来一样）')
        # ---------- 商城 → 购买 ----------
        pg.evaluate("() => __tzz.homeAct('homeSub', 'mall')"); pg.wait_for_timeout(500)
        card = pg.locator('#petCard'); check(card.count() == 1 and card.locator('[data-act=homePetBuy]').count() == 1, '商城第一张是小狗，有「购买 3,000」')
        lay = pg.evaluate("() => { const r = document.querySelector('#petCard').getBoundingClientRect(); return { l: r.left, r: r.right, sw: document.documentElement.scrollWidth, iw: innerWidth }; }")
        check(lay['l'] >= 0 and lay['r'] <= lay['iw'] + 0.5 and lay['sw'] <= lay['iw'], '小狗卡片在屏幕宽度内，没有横向滚动')
        card.scroll_into_view_if_needed(); pg.screenshot(path=f'{SHOTS}/{tag}_1_mall.png')
        card.locator('[data-act=homePetBuy]').click(); pg.wait_for_timeout(350)
        check(pg.locator('#pbYes').count() == 1 and pg.locator('#pbYes').is_enabled(), '确认弹窗：价格 / 余额 / 住进谁家')
        pg.screenshot(path=f'{SHOTS}/{tag}_2_confirm.png')
        pg.click('#pbYes'); pg.wait_for_timeout(1200)
        st = pg.evaluate("() => { const s = __tzz.state, raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { coins: s.coins, pet: s.pet, rawPet: raw.pet, sub: __tzz.homeSub, keys: Object.keys(localStorage).sort() }; }")
        check(st['coins'] == 47000 and st['pet'] and st['pet']['home'] == 'c77' and st['pet']['owned'] is True, f'买到：扣 3000（余 {st["coins"]}），住进 77 的家')
        check(st['rawPet'] and st['rawPet']['owned'] is True, '购买立刻写进原存档（同一个键）')
        check(st['sub'] == 'room', '买完自动翻到家宅')
        check(st['keys'] == keys0 and 'tangzhe-pet-proto' not in st['keys'], '没有新增 localStorage 键：' + ','.join(st['keys']))
        dup = pg.evaluate("() => { const r = __tzz.pet.PG.buy(__tzz.state, __tzz.E, 'c77', Date.now(), __tzz.pet.M); return { ok: r.ok, coins: __tzz.state.coins }; }")
        check(not dup['ok'] and dup['coins'] == 47000, '再买一次：拒绝，不扣钱')
        # ---------- 家宅里：小狗出现 + 自己活动 ----------
        to_room(pg); pg.evaluate(WATCH)
        check(pg.locator('#roomFloor .pet-dog').count() == 1 and pg.locator('#roomFloor .pet-bed').count() == 1, '家宅地板里有小狗 + 小窝')
        check(canvas_ink(pg) > 500, f'小狗画出来了（占位图非空像素 {canvas_ink(pg)}）')
        # 12e（熊大 23:26 第 3 项）：叼着球的 idle_E#0 / run_E#0，朝东 / 朝西（镜像）都不能被画布左右边裁掉——画布最左 / 最右 2 列必须全透明
        pg.wait_for_function("() => __tzz.pet.view && __tzz.pet.view.artMode === 'atlas'", timeout=15000)
        edge = pg.evaluate("""() => { const P = __tzz.pet, w = P.w, v = P.view, fl = document.querySelector('#roomFloor'); P.manual(true); const out = {};
          const b0 = { ...w.ball }, d0 = { dir: w.dog.dir, name: w.dog.anim.name };
          for (const [clip, dir] of [['idle_E', 'E'], ['idle_E', 'W'], ['run_E', 'E'], ['run_E', 'W'], ['sniff', 'E'], ['sniff', 'W']]) {
            w.ball.state = 'carried'; w.dog.dir = dir; w.dog.anim.play(clip, { restart: true }); v.draw(w, fl);
            const cv = v.els.cv, x = cv.getContext('2d'), H = cv.height, a = (cx) => { const d = x.getImageData(cx, 0, 2, H).data; let m = 0; for (let i = 3; i < d.length; i += 4) m = Math.max(m, d[i]); return m; };
            out[clip + '#' + w.dog.anim.frame() + '/' + dir] = [a(0), a(cv.width - 2), cv.width]; }
          Object.assign(w.ball, b0); w.dog.dir = d0.dir; w.dog.anim.play(d0.name, { restart: true }); P.manual(false); return out; }""")
        check(all(v[0] == 0 and v[1] == 0 for v in edge.values()), f'12e 叼球不裁边：idle_E#0 / run_E#0 / sniff#0 朝东朝西，画布最左 / 最右 2 列全透明 {edge}')
        check(pg.locator('#petBar button').count() == 3, '生活模式：呼唤 / 摸摸 / 抛球 三个按钮')
        bh = pg.evaluate("() => Math.min(...[...document.querySelectorAll('#petBar button')].map(b => b.getBoundingClientRect().height))"); check(bh >= 36, f'按钮够大（{bh:.0f}px 高）')
        s0 = pg.evaluate("() => __tzz.pet.snapshot().dog"); t0 = pg.evaluate("() => __tzz.pet.w.t"); pg.wait_for_timeout(7000)
        try: pg.wait_for_function("(t0) => __tzz.pet.w.t >= t0 + 7", arg=t0, timeout=15000)   # 按模拟时间算满 7 秒（机器忙时 rAF 掉帧，dt 封顶 0.1）
        except Exception: pass
        s1 = pg.evaluate("() => __tzz.pet.snapshot().dog"); t1 = pg.evaluate("() => __tzz.pet.w.t")
        moved = abs(s1['x'] - s0['x']) + abs(s1['y'] - s0['y'])
        pw = pg.evaluate("() => window.__pw")
        check(moved > 0.3 or s1['activity'] != s0['activity'], f'自己活动（模拟 {t1 - t0:.1f} 秒：{s0["activity"]} → {s1["activity"]}，走了 {moved:.2f} 格）')
        check(pw['frames'] > 120 and pw['overlap'] == 0 and pw['outside'] == 0, f'逐帧：身体盒不压家具、不出房间（{pw["frames"]} 帧）')
        pg.screenshot(path=f'{SHOTS}/{tag}_3_room.png')
        # 层级：小狗 z 跟家具前沿一致
        z = pg.evaluate("() => { const w = __tzz.pet.w, d = document.querySelector('#roomFloor .pet-dog'); const sofa = document.querySelector('#roomFloor .furn[data-fid=furn_sofa]'); return { dog: +d.style.zIndex, want: 10 + Math.floor(w.dog.y * 10), sofa: +getComputedStyle(sofa).zIndex, actor: +getComputedStyle(document.querySelector('#homeActor')).zIndex }; }")
        check(z['dog'] == z['want'] and z['sofa'] == 10 + 1 * 10 and z['actor'] > 100, f'前后遮挡：小狗 z={z["dog"]}（按落地点）、沙发 z={z["sofa"]}（按前沿）、CEO 在最上')
        # ---------- 互动：点小狗 / 呼唤 / 抛球 ----------
        pg.evaluate("() => { __tzz.pet.manual(true); const w = __tzz.pet.w; window.PetEngine.call(w); window.PetEngine.step(w, 12); }")   # 先叫到你面前站好
        pg.evaluate("() => document.querySelector('#room').scrollIntoView({ block: 'start' })"); pg.wait_for_timeout(200)
        a0 = pg.evaluate("() => { const w = __tzz.pet.w; return { pet: w.stats.petStarts + w.stats.petAbsorbed, ceo: JSON.stringify(__tzz.homeActor.c77 || null) }; }")
        xy = dog_px(pg); pg.mouse.click(xy['x'], xy['y']); pg.wait_for_timeout(100)
        a1 = pg.evaluate("() => { const w = __tzz.pet.w; return { pet: w.stats.petStarts + w.stats.petAbsorbed, act: w.dog.activity, ceo: JSON.stringify(__tzz.homeActor.c77 || null) }; }")
        check(a1['act'] == 'petted' and a1['ceo'] == a0['ceo'], f'点小狗 = 摸摸（{a1["act"]}），不会让 CEO 走过去')
        pg.evaluate("() => { window.PetEngine.step(__tzz.pet.w, 4); __tzz.pet.manual(false); }")
        aff0 = pg.evaluate("() => __tzz.pet.w.dog.affinity")
        pg.click('#petCallBtn'); pg.wait_for_timeout(150)
        check(pg.evaluate("() => __tzz.pet.w.dog.activity") == 'called', '呼唤按钮：小狗跑过来')
        pg.wait_for_timeout(5000)
        pg.click('#petBallBtn'); pg.wait_for_timeout(150)
        bs = pg.evaluate("() => ({ ball: __tzz.pet.w.ball.state, act: __tzz.pet.w.dog.activity, el: !!document.querySelector('#roomFloor .pet-ball') })")
        check(bs['ball'] == 'air' and bs['act'] in ('fetch', 'rest') and bs['el'], f'抛球按钮：球飞出去（{bs["ball"]} / {bs["act"]}）')
        pg.wait_for_function("() => { const w = __tzz.pet.w; return w.dog.activity !== 'fetch'; }", timeout=25000)
        pg.click('#petPatBtn'); pg.wait_for_timeout(5000)
        pw = pg.evaluate("() => window.__pw"); aff1 = pg.evaluate("() => __tzz.pet.w.dog.affinity")
        check(pw['overlap'] == 0 and pw['outside'] == 0 and aff1 >= aff0, f'互动全程不压家具（{pw["frames"]} 帧），亲密 {aff0} → {aff1}')
        pg.screenshot(path=f'{SHOTS}/{tag}_4_play.png')
        # ---------- 布置模式：暂停；家具摆到它脚下会让开 ----------
        pg.evaluate("() => { __tzz.homeAct('homeMode', 'decor'); }"); pg.wait_for_timeout(300)
        dz = pg.evaluate("() => ({ paused: __tzz.pet.w.paused, note: !!document.querySelector('#petNote'), bar: !!document.querySelector('#petBar') })")
        check(dz['paused'] and dz['note'] and not dz['bar'], '布置模式：小狗停下来等，按钮收起')
        pl = pg.evaluate("""() => { const E = __tzz.E, s = __tzz.state, w = __tzz.pet.w; s.coins += 500; E.buyFurniture(s, 'furn_plant');
          const x = Math.max(0, Math.min(5, Math.floor(w.dog.x))), y = Math.max(0, Math.min(3, Math.floor(w.dog.y))); const r = E.placeItem(s, 'c77', 'furn_plant', x, y, 0, 'floor'); __tzz.persist(); __tzz.renderTab(); return { ok: r.ok, why: r.why || '' }; }""")
        pg.wait_for_timeout(300)
        ov = pg.evaluate("() => ({ ov: window.PetEngine.bodyOverlap(__tzz.pet.w), n: __tzz.pet.w.items.length })")
        check((not pl['ok']) or (not ov['ov'] and ov['n'] == 4), f'家具摆到小狗脚下：小狗让开（摆放 {"成功" if pl["ok"] else "被拒:" + pl["why"]}，引擎 {ov["n"]} 件）')
        pg.evaluate("() => { __tzz.homeAct('homeMode', 'live'); }"); pg.wait_for_timeout(300)
        check(not pg.evaluate("() => __tzz.pet.w.paused") and pg.locator('#petBar').count() == 1, '切回生活：继续活动')
        # ---------- 刷新：存档保留 ----------
        pg.wait_for_timeout(1500)
        pg.evaluate("() => { __tzz.pet.manual(true); __tzz.persist(); }")   # 停住再存：刷新前后比较同一个位置
        sv = pg.evaluate("() => { const raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { eng: raw.pet.eng, coins: raw.coins, n: __tzz.E.homeOf(__tzz.state, 'c77').placed.length }; }")
        check(sv['eng'] and sv['eng']['home'] == 'c77' and 'items' not in sv['eng'], '存档里有小狗状态（不含家具，家具以家宅为准）')
        boot(pg); to_room(pg)
        rs = pg.evaluate("() => ({ bedGap: (() => { const w = __tzz.pet.w, s = window.PetEngine.interactSpot(w, 'pet_bed'); return Math.hypot(w.dog.x - s.spot.x, w.dog.y - s.spot.y); })(), pet: __tzz.state.pet && __tzz.state.pet.home, d: __tzz.pet.snapshot().dog, n: __tzz.E.homeOf(__tzz.state, 'c77').placed.length, coins: __tzz.state.coins, el: !!document.querySelector('#roomFloor .pet-dog'), keys: Object.keys(localStorage).sort() })")
        r0 = pg.evaluate("() => __tzz.pet.rt.restored")   # 刷新后第一帧（读档那一刻）的位置；之后它会接着自己活动
        dd = ((r0['x'] - sv['eng']['dog']['x']) ** 2 + (r0['y'] - sv['eng']['dog']['y']) ** 2) ** 0.5
        check(rs['pet'] == 'c77' and rs['el'], '刷新后小狗还在 77 的家')
        asleep = sv['eng']['dog'].get('asleep')
        check((r0['inBed'] if asleep else dd < 0.3) and rs['d']['affinity'] == sv['eng']['dog']['affinity'], f'刷新：接着来（{"存档时在睡 → 窝里接着睡" if asleep else f"位置差 {dd:.2f} 格"}），亲密 {rs["d"]["affinity"]} 保留')
        check(rs['n'] == sv['n'] and rs['coins'] >= sv['coins'], f'刷新：家具 {rs["n"]} 件、金币都在')
        check(rs['keys'] == keys0, '刷新后仍然没有新增存档键')
        pg.screenshot(path=f'{SHOTS}/{tag}_5_reload.png')
        # 长离开：把 savedAt 改到 1 小时前
        pg.evaluate("() => { const raw = JSON.parse(localStorage.getItem('" + SAVE + "')); raw.pet.eng.savedAt -= 3600e3; raw.rev += 5; localStorage.setItem('" + SAVE + "', JSON.stringify(raw)); }")
        boot(pg); to_room(pg)
        sl = pg.evaluate("() => { const w = __tzz.pet.w, s = window.PetEngine.interactSpot(w, 'pet_bed'); return { d: __tzz.pet.snapshot().dog, gap: Math.hypot(w.dog.x - s.spot.x, w.dog.y - s.spot.y) }; }")
        check(sl['gap'] < 0.01 and sl['d']['step'] in ('sleep', 'anim'), f'离开 1 小时再开：在窝里睡（{sl["d"]["label"]}）')
        pg.screenshot(path=f'{SHOTS}/{tag}_6_slept.png')
        # 页面藏起来很久再回来（不刷新）
        ev = pg.evaluate("() => { __tzz.pet.resume(3600e3); return __tzz.pet.rt.lastEvent; }")
        check(ev in ('slept', 'back'), f'切后台回来：按离线重算（{ev}）')
        # ---------- p4a：转不开身不播侧身动作（豪宅 10×6 里摆出 1 格竖走廊 / 横走廊 / 死胡同 / 边界格）----------
        pg.evaluate("() => { const s = __tzz.state, E = __tzz.E; s.coins += 1e8; while (E.homeOf(s, 'c77').lv < 3) E.upgradeHome(s, 'c77'); __tzz.persist(); }")
        def col(x, y0, y1): return [[x, y] for y in range(y0, y1)]
        def row(y, x0, x1): return [[x, y] for x in range(x0, x1)]
        CASES = [('竖走廊', col(3, 0, 5) + col(5, 0, 5), 4.5, 1.5, 'S', False), ('横走廊', row(1, 2, 9) + row(3, 2, 9), 5.5, 2.5, 'E', True),
                 ('死胡同', col(3, 0, 4) + col(5, 0, 4) + [[4, 3]], 4.5, 1.5, 'N', False), ('边界格', col(1, 0, 3), 0.5, 1.2, 'S', False)]
        for name, cells, x, y, dr, side_ok in CASES:
            pg.evaluate("""([cells, x, y, dr]) => { const s = __tzz.state, E = __tzz.E, H = E.homeOf(s, 'c77'); H.placed = [];
              for (const [cx, cy] of cells) { E.buyFurniture(s, 'furn_plant'); E.placeItem(s, 'c77', 'furn_plant', cx, cy, 0, 'floor'); }
              __tzz.pet.manual(true); const w = __tzz.pet.rt.sync(s), d = w.dog; d.x = x; d.y = y; d.dir = dr; d.plan = []; d.step = null; d.activity = 'idle'; d.lastGain = -1e9; d.petCdUntil = 0; d.energy = 80; d.tired = false;
              if (w.ball.state !== 'floor') { w.ball.state = 'floor'; w.ball.flight = null; } __tzz.homeMode = 'live'; __tzz.renderTab(); }""", [cells, x, y, dr])
            pg.wait_for_timeout(150); pg.evaluate("() => document.querySelector('#room').scrollIntoView({ block: 'start' })"); pg.wait_for_timeout(150)
            fr = pg.evaluate("() => { const w = __tzz.pet.w, PE = window.PetEngine; return { n: w.items.length, E: PE.bodyFree(w, w.dog.x, w.dog.y, 'E'), W: PE.bodyFree(w, w.dog.x, w.dog.y, 'W'), V: PE.bodyFree(w, w.dog.x, w.dog.y, 'V') }; }")
            a0 = pg.evaluate("() => __tzz.pet.w.dog.affinity"); xy = dog_px(pg); pg.mouse.click(xy['x'], xy['y'])
            r = pg.evaluate(GSTEP, 3); a1 = pg.evaluate("() => __tzz.pet.w.dog.affinity")
            if name in ('竖走廊', '死胡同'): pg.screenshot(path=f'{SHOTS}/{tag}_p4a_{"v" if name == "竖走廊" else "dead"}.png')
            check(fr['n'] == len(cells) and fr['V'] and (fr['E'] or fr['W']) == side_ok, f'p4a {name}：家宅摆好 {fr["n"]} 件，站得下，侧身{"放得下" if side_ok else "放不下"}')
            check(a1 > a0 and r['body'] == 0 and r['eng'] == 0, f'p4a {name}：点小狗有回应（亲密 {a0}→{a1}），身体盒不穿墙（{r["body"]} 帧，动作 {"→".join(r["seq"][:5])}）')
            if side_ok: check('petted' in r['seq'], f'p4a {name}：侧身放得下 → 正常播侧身抚摸')
            elif name != '边界格': check('petted' not in r['seq'], f'p4a {name}：转不开身 → 站着摇尾巴，不播侧身抚摸')
            for k, js in (('呼唤', "() => __tzz.pet.rt.call(__tzz.state)"), ('抛球', "() => __tzz.pet.rt.throwBall(__tzz.state)"), ('摸摸按钮', "() => __tzz.pet.rt.pet(__tzz.state, 'button')")):
                pg.evaluate(js); r = pg.evaluate(GSTEP, 8)
                check(r['body'] == 0 and r['eng'] == 0, f'p4a {name}{k}：不穿墙（{r["body"]} 帧）')
            r = pg.evaluate(GSTEP, 90)
            check(r['body'] == 0 and r['eng'] == 0, f'p4a {name}：自主活动 90 秒不穿墙（{r["body"]} / {r["frames"]} 帧）')
        pg.evaluate("() => __tzz.pet.manual(false)")
        # ---------- p4b：满屋 = 正常状态（熊大 14:14）；坏档容错（熊大 14:17）----------
        REV = [200000]
        def inject(js):   # js 返回要写进存档的 state（在页面里用 __tzz.E 现做）；rev 每次加大，旧页 pagehide 存档盖不掉
            REV[0] += 100000
            pg.evaluate("(rev) => { const E = __tzz.E; const s = (" + js + ")(E); if (typeof s !== 'string') s.rev = rev; localStorage.setItem('" + SAVE + "', typeof s === 'string' ? s.replace('\"__REV__\"', rev) : JSON.stringify(s)); }", REV[0])
            boot(pg)
        FILL = """(E, s, id, skip) => { const H = E.homeOf(s, id), T = E.homeTier(H.lv), c0 = s.coins; let n = 0;
          for (let y = 0; y < T.rows; y++) for (let x = 0; x < T.cols; x++) { if ((skip || []).some(([a, b]) => a === x && b === y)) continue; s.coins = 1e9; E.buyFurniture(s, 'furn_plant'); if (E.placeItem(s, id, 'furn_plant', x, y, 0, 'floor').ok) n++; }
          s.coins = c0; return n; }"""
        ST = "() => { const s = __tzz.state, raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { coins: s.coins, rawCoins: raw.coins, pet: s.pet || null, rawPet: raw.pet || null, owned: __tzz.pet.PG.owned(s), waiting: __tzz.pet.waiting, dog: !!document.querySelector('#roomFloor .pet-dog'), wait: !!document.querySelector('#petWait'), bar: !!document.querySelector('#petBar'), modal: __tzz.modalOpen(), toast: (document.querySelector('#toast') || {}).textContent || '' }; }"
        # (1) 合法满屋购买：小屋 6×4 摆满 24 个花盆 → 商城卡「暂时无法入宅」、点购买不弹窗不扣钱；公寓 / 豪宅同样
        for lv, nm, cells in ((1, '小屋', 24), (2, '公寓', 40), (3, '豪宅', 60)):
            inject("(E) => { const s = E.newState(Date.now()); s.coins = 1e9; while (E.homeOf(s, 'c77').lv < " + str(lv) + ") E.upgradeHome(s, 'c77'); s.coins = 5000; (" + FILL + ")(E, s, 'c77'); delete s.pet; return s; }")
            pg.evaluate("() => { __tzz.setTab('home'); __tzz.homeAct('homeSub', 'mall'); }"); pg.wait_for_timeout(400)
            cd = pg.evaluate("() => { const c = document.querySelector('#petCard'); const b = document.querySelector('#petNoRoom'); return { room: c && c.dataset.room, btn: b ? b.textContent : '', dis: b ? b.disabled : null, buy: !!document.querySelector('#petCard [data-act=homePetBuy]'), n: __tzz.E.homeOf(__tzz.state, 'c77').placed.length }; }")
            check(cd['n'] == cells and cd['room'] == 'full' and cd['btn'] == '暂时无法入宅' and cd['dis'] and not cd['buy'], f'p4b {nm}合法摆满 {cd["n"]} 个花盆：商城卡显示「暂时无法入宅」（禁用，没有购买键）')
            if lv == 1: pg.locator('#petCard').scroll_into_view_if_needed(); pg.screenshot(path=f'{SHOTS}/{tag}_p4b_full_mall.png')
            pg.evaluate("() => __tzz.homeAct('homePetBuy', 'c77')"); pg.wait_for_timeout(300)
            st = pg.evaluate(ST)
            check(not st['modal'] and '暂时无法入宅' in st['toast'] and st['coins'] == 5000 and not st['owned'] and st['pet'] is None, f'p4b {nm}满屋硬点购买：不弹窗，提示「暂时无法入宅」，金币 5000 → {st["coins"]}，没有宠物')
            r = pg.evaluate("() => { const r = __tzz.pet.PG.buy(__tzz.state, __tzz.E, 'c77', Date.now(), __tzz.pet.M); __tzz.persist(); const raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { ok: r.ok, noRoom: !!r.noRoom, coins: __tzz.state.coins, raw: raw.coins, pet: 'pet' in raw }; }")
            check(not r['ok'] and r['noRoom'] and r['coins'] == 5000 and r['raw'] == 5000 and not r['pet'], f'p4b {nm}满屋直接调购买：拒绝（noRoom），存档金币 {r["raw"]}、无 pet')
        # (2) 已有宠物，读档时满屋 → 等待安置（不崩、所有权 / 金币不变）；收起一盆 → 自动出来
        inject("(E) => { const s = E.newState(Date.now()); s.coins = 7777; (" + FILL + ")(E, s, 'c77'); s.pet = { v: 1, owned: true, home: 'c77', boughtAt: Date.now() - 9e5, eng: { v: 1, savedAt: Date.now() - 5000, t: 120, rs: 99, home: 'c77', dog: { x: 2.5, y: 2.5, dir: 'E', energy: 55, affinity: 47, lastGain: 10, tired: false, asleep: false, lastEat: -1e9 }, ball: { x: 1, y: 1, carried: false } } }; return s; }")
        to_room(pg); pg.wait_for_timeout(300)
        st = pg.evaluate(ST)
        check(st['owned'] and st['waiting'] and st['wait'] and not st['dog'] and not st['bar'] and st['coins'] == 7777, f'p4b 已有宠物 + 满屋读档：不崩，家宅显示「小狗等待安置」，不画小狗、不出按钮，金币 {st["coins"]}')
        pg.screenshot(path=f'{SHOTS}/{tag}_p4b_waiting.png')
        pg.evaluate("() => __tzz.persist()"); st = pg.evaluate(ST)
        check(st['rawPet'] and st['rawPet']['owned'] is True and (((st['rawPet'] or {}).get('eng') or {}).get('dog') or {}).get('affinity') == 47 and st['rawCoins'] == 7777, '等待中存档：所有权 / 亲密 47 / 金币都在')
        pg.evaluate("() => { const s = __tzz.state, H = __tzz.E.homeOf(s, 'c77'); __tzz.E.storeItem(s, 'c77', H.placed.find(p => p.x === 3 && p.y === 2).uid); __tzz.persist(); __tzz.renderTab(); }"); pg.wait_for_timeout(700)
        st = pg.evaluate(ST)
        check(not st['waiting'] and st['dog'] and st['bar'] and not st['wait'] and '跑出来' in st['toast'], f'收起一盆：小狗自动出来（提示「{st["toast"]}」），按钮回来')
        pg.evaluate("() => __tzz.pet.manual(true)"); r = pg.evaluate(GSTEP, 10)
        aff = pg.evaluate("() => __tzz.pet.w.dog.affinity")
        check(r['body'] == 0 and r['eng'] == 0 and aff == 47, f'出来后 1 格里活动 10 秒不压家具（{r["body"]} 帧，动作 {"→".join(r["seq"][:4])}），亲密 {aff}')
        pg.evaluate("() => __tzz.pet.manual(false)")
        # (3) 布置把最后一格挡上 → 等待安置；收起 → 出来
        pg.evaluate("() => { __tzz.homeAct('homeMode', 'decor'); const s = __tzz.state, E = __tzz.E; s.coins += 500; E.buyFurniture(s, 'furn_plant'); E.placeItem(s, 'c77', 'furn_plant', 3, 2, 0, 'floor'); __tzz.persist(); __tzz.renderTab(); }"); pg.wait_for_timeout(500)
        st = pg.evaluate(ST)
        check(st['waiting'] and st['wait'] and not st['dog'] and st['owned'] and st['coins'] == 7777, '布置模式把最后一格摆上：等待安置（提示在，小狗不画），金币不变')
        pg.evaluate("() => { const s = __tzz.state, H = __tzz.E.homeOf(s, 'c77'); __tzz.E.storeItem(s, 'c77', H.placed.find(p => p.x === 3 && p.y === 2).uid); __tzz.homeAct('homeMode', 'live'); __tzz.persist(); __tzz.renderTab(); }"); pg.wait_for_timeout(600)
        st = pg.evaluate(ST); check(not st['waiting'] and st['dog'], '收起刚摆的：小狗出来')
        # (4) 搬进满屋 → 等待安置；升级房子 → 自动出来；金币只扣升级费
        pg.evaluate("() => { const s = __tzz.state, E = __tzz.E; s.ceos.pearl.unlocked = true; (" + FILL + ")(E, s, 'pearl'); __tzz.persist(); __tzz.homeAct('homePetMove', 'pearl'); }"); pg.wait_for_timeout(500)
        to_room(pg); st = pg.evaluate(ST)
        check((st['pet'] or {}).get('home') == 'pearl' and st['owned'] and st['waiting'] and st['wait'] and not st['dog'] and st['coins'] == 7777, f'搬进满屋（珍珠姐家摆满）：搬过去、等待安置，金币不变（提示「{st["toast"][:30]}…」）')
        pg.evaluate("() => { const s = __tzz.state; s.coins += 80000; const r = __tzz.E.upgradeHome(s, 'pearl'); __tzz.persist(); __tzz.renderTab(); return r.ok; }"); pg.wait_for_timeout(600)
        st = pg.evaluate(ST)
        check(not st['waiting'] and st['dog'] and st['coins'] == 7777 and st['owned'], f'升级成公寓：小狗自动出来，金币只扣升级费（{st["coins"]}），宠物还是 1 只')
        # (5) 坏档：eng 字段是字符串 / 无穷（JSON 1e400）/ 负数 / 超界 / null / 缺字段，owned / boughtAt 也坏 → 读档不报错、所有权保留、存回去没有 NaN
        inject("""(E) => { const s = E.newState(Date.now()); s.coins = 4321; s.rev = '__REV__'; s.pet = { v: 1, owned: 'true', home: 'c77', boughtAt: 'x', eng: { v: 1, savedAt: 'NaN', t: 'abc', rs: -1, home: 'c77', dog: { x: '2', y: null, dir: 'toString', energy: -5, affinity: 'big', lastGain: 1e12, tired: 'no' }, ball: [1] } };
          return JSON.stringify(s).replace('"lastGain":1000000000000', '"lastGain":1e400,"lastEat":-1e400'); }""")
        to_room(pg); pg.wait_for_timeout(400)
        cr = pg.evaluate("() => { const w = __tzz.pet.w, d = w && w.dog; __tzz.persist(); const txt = localStorage.getItem('" + SAVE + "'), raw = JSON.parse(txt); return { owned: __tzz.pet.PG.owned(__tzz.state), coins: __tzz.state.coins, fin: !!w && [d.x, d.y, d.energy, d.affinity, d.lastGain, w.t].every(Number.isFinite), ov: !!w && window.PetEngine.bodyOverlap(w), dog: !!document.querySelector('#roomFloor .pet-dog'), bad: /NaN|Infinity/.test(txt), eng: raw.pet ? raw.pet.eng : null, b: raw.pet ? raw.pet.boughtAt : null, o: raw.pet ? raw.pet.owned : null }; }")
        e = cr['eng'] or {}
        check(cr['owned'] and cr['o'] is True and cr['coins'] == 4321 and cr['dog'] and cr['fin'] and not cr['ov'], '坏档（字符串 / 无穷 / 负数 / null / 缺字段）读档：不报错，小狗还在、画出来、数值都有限、不压家具')
        check(not cr['bad'] and isinstance(e.get('savedAt'), (int, float)) and isinstance(e.get('t'), (int, float)) and (e.get('dog') or {}).get('energy') == 0 and (e.get('dog') or {}).get('affinity') == 40 and cr['b'] == 0, f'存回去：没有 NaN / Infinity，savedAt / t 是数字，精力 -5→0、亲密 40、boughtAt 0（eng.t={e.get("t")}）')
        boot(pg); to_room(pg)
        cr2 = pg.evaluate("() => { const w = __tzz.pet.w; return { owned: __tzz.pet.PG.owned(__tzz.state), fin: !!w && [w.dog.x, w.dog.y, w.dog.energy, w.t].every(Number.isFinite), dog: !!document.querySelector('#roomFloor .pet-dog') }; }")
        check(cr2['owned'] and cr2['fin'] and cr2['dog'], '修好的档再刷新：照常')
        check(not errs, '控制台 0 报错 / 0 警告 / 0 坏请求' + ('' if not errs else '：' + '；'.join(errs[:4])))
        # ---------- 只在一台上跑：主线预览读这份档不丢小狗；换正式图集接口 ----------
        if devname == 'iPhone 15':
            # p5 / 熊大 22:08：宠物页的 77 头像也要带 12d2 的单图缓存号（ART_ONE），不能再请求 ?v=11
            pg.evaluate("() => __tzz.setTab('ceo')"); pg.wait_for_timeout(500)
            fs5 = pg.evaluate("() => [...document.querySelectorAll('img')].map(i => i.getAttribute('src') || '').filter(s => /face_c77/.test(s))")
            check(fs5 and all(x.endswith('face_c77.webp?v=13') and x.startswith('../../art/' if '/pet/game/' in URL else 'art/') for x in fs5), f'p5 宠物页 77 头像请求 ../../art/face_c77.webp?v=12d2（不再是 ?v=11）{fs5[:2]}')
            # p5：12d1 异常钱包（主档余额 1e20）→ 买狗被拒，原档逐字节不变
            raw = pg.evaluate("() => localStorage.getItem('" + SAVE + "')"); bad = json.loads(raw); bad.pop('pet', None); bad['coins'] = 1e20; bad['coinFrac'] = 0; bad['rev'] = (bad.get('rev') or 0) + 100000; badJ = json.dumps(bad)   # rev 抬高：旧页 pagehide 存盘不会盖掉
            pg.evaluate("(v) => { localStorage.clear(); localStorage.setItem('" + SAVE + "', v); }", badJ); boot(pg)
            u5 = pg.evaluate("() => { const r0 = __tzz.saveBlocked; __tzz.homeAct('homePetBuy', 'c77'); const st = __tzz.state; return { blk: r0, uns: __tzz.loadInfo && __tzz.loadInfo.unsafe, pet: 'pet' in st, coins: st.coins, modal: __tzz.modalOpen(), toast: document.getElementById('toast').textContent, api: __tzz.pet.PG.buy(st, __tzz.E, 'c77', Date.now(), __tzz.pet.M) }; }")
            pg.wait_for_timeout(5600); after5 = pg.evaluate("() => localStorage.getItem('" + SAVE + "')")
            check(u5['blk'] and u5['uns'] and not u5['pet'] and u5['coins'] == 1e20 and not u5['modal'] and '金币数据异常' in u5['toast'] and not u5['api']['ok'] and after5 == badJ, f"p5 异常钱包（余额 1e20）：商城点买狗 → 提示金币数据异常、不弹购买窗；接口也拒；6 秒后原档逐字节不变 {u5['toast']}")
            # p6（12d3）：保存失败（setItem 抛错）时买狗 → E.transact 整体回滚：金币不扣、没有狗、主档 / 备份逐字节不变、不跳进家宅
            nf = json.loads(raw); nf.pop('pet', None); nf['coins'] = 50000; nf['coinFrac'] = 0; nf['rev'] = (nf.get('rev') or 0) + 150000; nfJ = json.dumps(nf)
            pg.evaluate("(v) => { localStorage.clear(); localStorage.setItem('" + SAVE + "', v); }", nfJ); boot(pg)
            pg.evaluate("() => { __tzz.setTab('home'); __tzz.homeAct('homeSub', 'mall'); }"); pg.wait_for_timeout(300)
            m0 = pg.evaluate("() => [localStorage.getItem('" + SAVE + "'), localStorage.getItem('" + SAVE + "-bak')]")
            pg.evaluate("() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; __tzz.homeAct('homePetBuy', 'c77'); }"); pg.wait_for_timeout(300)
            pg.click('#pbYes'); pg.wait_for_timeout(400)
            sf = pg.evaluate("() => { const st = __tzz.state, r = { pet: 'pet' in st, coins: st.coins, toast: document.getElementById('toast').textContent, sub: __tzz.homeSub, disk: [localStorage.getItem('" + SAVE + "'), localStorage.getItem('" + SAVE + "-bak')] }; Storage.prototype.setItem = window.__realSet; return r; }")
            check(not sf['pet'] and sf['coins'] == 50000 and '保存失败' in sf['toast'] and sf['disk'] == m0 and sf['sub'] == 'mall', f"p6 保存失败时买狗：整体回滚（金币 {sf['coins']}、没有狗、主档 / 备份逐字节不变、留在商城）提示「{sf['toast']}」")
            pg.evaluate("() => __tzz.homeAct('homePetBuy', 'c77')"); pg.wait_for_timeout(300); pg.click('#pbYes'); pg.wait_for_timeout(400)
            ok6 = pg.evaluate("() => { const d = JSON.parse(localStorage.getItem('" + SAVE + "')); return { pet: !!(d.pet && d.pet.owned), coins: d.coins, rev: d.rev, mem: __tzz.state.coins, bak: JSON.parse(localStorage.getItem('" + SAVE + "-bak')).rev }; }")
            check(ok6['pet'] and ok6['coins'] == 47000 and ok6['mem'] == 47000 and ok6['rev'] > json.loads(m0[0])['rev'] and ok6['bak'] == ok6['rev'] - 1, f"p6 存储恢复后再买：落盘有狗、47000 金币、rev {json.loads(m0[0])['rev']}→{ok6['rev']}、-bak = 上一份主档（rev {ok6['bak']}）")
            good = json.loads(raw); good['rev'] = (good.get('rev') or 0) + 200000
            pg.evaluate("(v) => { localStorage.clear(); localStorage.setItem('" + SAVE + "', v); }", json.dumps(good)); boot(pg)
            pg.evaluate("() => __tzz.persist()")
            pg.goto(PREVIEW); pg.wait_for_function("window.__tzz && __tzz.state", timeout=20000); pg.wait_for_timeout(800)
            pv = pg.evaluate("() => { __tzz.persist(); const raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { pet: raw.pet && raw.pet.home, mem: !!__tzz.state.pet, petGame: typeof window.PetGame }; }")
            check(pv['pet'] == 'c77' and pv['mem'] and pv['petGame'] == 'object', '主线预览（12e 起已并入小狗）读写这份档：pet 字段原样保留、内存里也有小狗')
            atlas = pg.evaluate("""async () => { const s = document.createElement('script'); s.src = 'pet/puppy.js'; const a = document.createElement('script'); a.src = 'pet/art.js'; document.head.append(a, s);
              await new Promise(r => setTimeout(r, 600)); const m = await (await fetch('pet/art/manifest.json')).json(); return PetPuppy.bakeAtlas(document, m).toDataURL('image/png'); }""")
            png = base64.b64decode(atlas.split(',', 1)[1])
            def man(route):
                r = route.fetch(); m = r.json(); m['placeholder'] = False; m['atlas']['image'] = 'dog_atlas_test.png'
                route.fulfill(response=r, body=json.dumps(m, ensure_ascii=False), headers={**r.headers, 'content-type': 'application/json'})
            hits = {'img': 0}
            def img(route): hits['img'] += 1; route.fulfill(status=200, body=png, headers={'content-type': 'image/png'})
            pg.route('**/art/manifest.json*', man); pg.route('**/art/dog_atlas_test.png*', img)
            errs.clear(); boot(pg); to_room(pg); pg.wait_for_timeout(800)
            am = pg.evaluate("() => __tzz.pet.view.artMode")
            check(am == 'atlas' and hits['img'] >= 1 and canvas_ink(pg) > 500, f'换正式图集接口：manifest 改 placeholder:false + atlas.image → 按格子取帧（{am}，非空像素 {canvas_ink(pg)}）')
            pg.screenshot(path=f'{SHOTS}/{tag}_7_atlas.png')
            check(not errs, '图集模式 0 报错' + ('' if not errs else '：' + '；'.join(errs[:3])))
        ctx.close()
    # 手机网络抖：manifest 第一次没拉到 → 自动重试
    ctx = b.new_context(**p.devices['iPhone 15']); pg = ctx.new_page(); errs = []; hits = {'n': 0}
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    def flaky(route):
        hits['n'] += 1
        route.abort() if hits['n'] == 1 else route.continue_()
    pg.route('**/art/manifest.json*', flaky)
    pg.goto(URL); pg.wait_for_function("document.body.dataset.petReady==='1'", timeout=20000)
    check(hits['n'] >= 2 and not errs, f'manifest 第一次没拉到 → 自动重试成功（{hits["n"]} 次，0 报错）')
    ctx.close(); b.close()
ok = sum(1 for c, _ in results if c)
print(f'\n宠物 p4/p4b 端到端：{ok} 过 / {len(results) - ok} 挂')
sys.exit(0 if ok == len(results) else 1)
