# 宠物 p4 — 游戏接入端到端测试（WebKit = iPhone Safari 内核；iPhone SE / SE 3 / 15）
# 用法：仓库根目录起静态服务（python3 -m http.server 49761），再 /workspace/.pwvenv/bin/python preview/pet/game/test_petgame_e2e.py [URL]
# 覆盖：旧档（没有 pet 字段）照常读 → 商城看到小狗 → 点购买 → 进家宅出现小狗 → 自己活动（逐帧不压家具）→ 点小狗 / 呼唤 / 抛球
#       → 布置模式暂停、家具摆到它脚下会让开 → 刷新存档保留（短离开原地、长离开在窝里睡）→ 不新增存档键 → 主线预览读这份档不丢小狗 → 换正式图集的接口
import sys, os, json, base64
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49761/preview/pet/game/'
if not URL.endswith('/'): URL = URL.rsplit('/', 1)[0] + '/' if URL.endswith('.html') else URL + '/'
PREVIEW = URL.rsplit('/pet/game/', 1)[0] + '/'
SAVE = 'tangzhe-preview-save'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_shots'); os.makedirs(SHOTS, exist_ok=True)
results = []
def check(c, msg): results.append((bool(c), msg)); print(('  ✓ ' if c else '  ✗ ') + msg)
DISMISS = """async () => { for (let i = 0; i < 12; i++) { if (__tzz.modalOpen()) { __tzz.closeModal(); const s = document.querySelector('#sheet'); if (s && !s.classList.contains('hidden')) s.classList.add('hidden'); } await new Promise(r => setTimeout(r, 160)); } return !__tzz.modalOpen(); }"""
# 逐帧看守：每个 rAF 查身体盒压家具 / 出界 / 画面上有没有小狗元素
WATCH = """() => { if (window.__pw) return; const PE = window.PetEngine; window.__pw = { frames: 0, overlap: 0, outside: 0, drawn: 0, acts: {} };
  const f = () => { const w = __tzz.pet.w; if (w) { __pw.frames++; if (PE.bodyOverlap(w)) __pw.overlap++; if (w.dog.x < 0 || w.dog.y < 0 || w.dog.x > w.cols || w.dog.y > w.rows) __pw.outside++;
    const el = document.querySelector('#roomFloor .pet-dog'); if (el) __pw.drawn++; __pw.acts[w.dog.activity] = 1; } requestAnimationFrame(f); }; requestAnimationFrame(f); }"""
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
        pg.on('requestfailed', lambda r: errs.append(f'failed {r.url}'))
        boot(pg)
        # ---------- 旧档：没有 pet 字段 ----------
        pg.evaluate("""() => { const E = __tzz.E, s = E.newState(Date.now()); s.coins = 50000; s.taps = 321; s.totalEarned = 1000;
          for (const [f, x, y] of [['furn_sofa', 0, 0], ['furn_rug', 2, 1], ['furn_catbed', 4, 2]]) { s.coins += E.FURN_BY_ID[f].price; E.buyFurniture(s, f); E.placeItem(s, 'c77', f, x, y, 0, 'floor'); }
          s.coins = 50000; s.rev = 100000; delete s.pet; localStorage.clear(); localStorage.setItem('tangzhe-save', '{"sentinel":1}'); localStorage.setItem('""" + SAVE + """', JSON.stringify(s)); }""")
        boot(pg)
        st = pg.evaluate("() => { const s = __tzz.state, raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { pet: 'pet' in s, rawPet: 'pet' in raw, coins: s.coins, taps: s.taps, placed: __tzz.E.homeOf(s, 'c77').placed.map(p => p.fid), keys: Object.keys(localStorage).sort() }; }")
        check(not st['pet'] and not st['rawPet'], '旧档（没有 pet 字段）读进来：没有小狗，存回去也不多字段')
        check(st['coins'] == 50000 and st['taps'] == 321 and st['placed'] == ['furn_sofa', 'furn_rug', 'furn_catbed'], f'旧档其余内容都在（金币 {st["coins"]}、点击 {st["taps"]}、家具 {len(st["placed"])} 件）')
        keys0 = st['keys']
        to_room(pg)
        check(pg.locator('#petNote').count() == 1 and pg.locator('#roomFloor .pet-dog').count() == 0, '家宅：还没小狗，只有「商城新到」提示')
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
        dup = pg.evaluate("() => { const r = __tzz.pet.PG.buy(__tzz.state, __tzz.E, 'c77', Date.now()); return { ok: r.ok, coins: __tzz.state.coins }; }")
        check(not dup['ok'] and dup['coins'] == 47000, '再买一次：拒绝，不扣钱')
        # ---------- 家宅里：小狗出现 + 自己活动 ----------
        to_room(pg); pg.evaluate(WATCH)
        check(pg.locator('#roomFloor .pet-dog').count() == 1 and pg.locator('#roomFloor .pet-bed').count() == 1, '家宅地板里有小狗 + 小窝')
        check(canvas_ink(pg) > 500, f'小狗画出来了（占位图非空像素 {canvas_ink(pg)}）')
        check(pg.locator('#petBar button').count() == 3, '生活模式：呼唤 / 摸摸 / 抛球 三个按钮')
        bh = pg.evaluate("() => Math.min(...[...document.querySelectorAll('#petBar button')].map(b => b.getBoundingClientRect().height))"); check(bh >= 36, f'按钮够大（{bh:.0f}px 高）')
        s0 = pg.evaluate("() => __tzz.pet.snapshot().dog"); pg.wait_for_timeout(7000); s1 = pg.evaluate("() => __tzz.pet.snapshot().dog")
        moved = abs(s1['x'] - s0['x']) + abs(s1['y'] - s0['y'])
        pw = pg.evaluate("() => window.__pw")
        check(moved > 0.3 or s1['activity'] != s0['activity'], f'自己活动（7 秒：{s0["activity"]} → {s1["activity"]}，走了 {moved:.2f} 格）')
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
        check(not errs, '控制台 0 报错 / 0 警告 / 0 坏请求' + ('' if not errs else '：' + '；'.join(errs[:4])))
        # ---------- 只在一台上跑：主线预览读这份档不丢小狗；换正式图集接口 ----------
        if devname == 'iPhone 15':
            pg.evaluate("() => __tzz.persist()")
            pg.goto(PREVIEW); pg.wait_for_function("window.__tzz && __tzz.state", timeout=20000); pg.wait_for_timeout(800)
            pv = pg.evaluate("() => { __tzz.persist(); const raw = JSON.parse(localStorage.getItem('" + SAVE + "')); return { pet: raw.pet && raw.pet.home, mem: !!__tzz.state.pet, petGame: typeof window.PetGame }; }")
            check(pv['pet'] == 'c77' and pv['mem'] and pv['petGame'] == 'undefined', '主线预览（不认识小狗）读写这份档：pet 字段原样保留')
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
print(f'\n宠物 p4 端到端：{ok} 过 / {len(results) - ok} 挂')
sys.exit(0 if ok == len(results) else 1)
