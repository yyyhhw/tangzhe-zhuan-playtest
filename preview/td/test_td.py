# 塔防样品验收：Playwright WebKit 模拟 iPhone SE / iPhone 15（不是真机）
# 验：8 种塔各自打法 + 同名塔加成、4 位统帅全局技能、局内建设点每局重置、主金币永久升级（原型 / 嵌入两种）、存档键、开局回执、结算回执与重试、10 波过关
# 用法：python3 preview/td/test_td.py [塔防页 URL]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/preview/td/index.html'
HOST_URL = URL.rsplit('/', 1)[0] + '/__host_test.html'
ok = bad = 0
def check(c, msg):
    global ok, bad
    if c: ok += 1; print('  ✓', msg)
    else: bad += 1; print('  ✗ FAIL', msg)
# 假经营页：只为测子页协议；真正的扣款 / 写档由熊二在 app.js 用 E.transact 接
HOST = """<!doctype html><meta charset=utf-8><body style=margin:0><iframe id=f src="index.html?embed=1" style="border:0;width:100vw;height:100vh"></iframe><script>
window.log=[]; window.W={coins:5e9, z:{lv:{},cleared:0,best:0}, blocked:false, ackStart:true, failResult:false};
function send(x){ pt.postMessage(Object.assign({td:'state', coins:W.coins, z:W.z, blocked:W.blocked, muted:true}, x||{})); }
f.onload=()=>{ const ch=new MessageChannel(); window.pt=ch.port1; const T=f.contentWindow.TDCore;
  pt.onmessage=e=>{ const m=e.data; log.push(m);
    if(m.td==='hello') send();
    if(m.td==='buy'){ const z=T.norm(W.z), p=T.price(m.id, z.lv[m.id]), ok=!W.blocked && W.coins>=p && z.lv[m.id]<T.MAX_UP; if(ok){ W.coins-=p; z.lv[m.id]++; W.z=z; } send({ack:'buy', requestId:m.requestId, id:m.id, ok}); }
    if(m.td==='start' && W.ackStart) send({ack:'start', ok:true, runId:m.runId});
    if(m.td==='result'){ if(W.failResult) send({ack:'result', ok:false, runId:m.runId, why:'写盘失败'}); else { const z=T.norm(W.z); T.applyResult(z, m); W.z=z; send({ack:'result', ok:true, runId:m.runId}); } } };
  f.contentWindow.postMessage({td:'port'}, location.origin, [ch.port2]); };
</script>"""
MK = """window.__mk = (d, hp) => ({ type: 'walk', d, hp: hp || 1e6, max: hp || 1e6, sp: 0, r: 0.28, slowT: 0, slowK: 1, stunT: 0, burnT: 0, burnD: 0, x: 0, y: 0 });
window.__fresh = (cmd) => { const G0 = __td.G; if (G0) G0.over = true; __td.cmdSel = cmd; __td.start(1); const G = __td.G; G.breakT = 1e9; G.c.x = G.c.tx = 100; G.c.y = G.c.ty = 100; G.energy = 0; return G; };
window.__fire = (id, cmd, ds, x, y) => { const G = __fresh(cmd); G.cash = 1e5; G.es = ds.map(d => __mk(d)); __td.step(0.0001); __td.build(id, x, y); const tw = G.tw.get(x + ',' + y); tw.cd = 0; __td.step(0.001);
  return { hits: G.es.filter(e => e.hp < 1e6).length, dmg: G.es.map(e => 1e6 - e.hp), burn: G.es.map(e => [e.burnT, e.burnD]), slow: G.es.map(e => e.slowK), cd: tw.cd, rng: __td.towerRange(tw), stun: G.es.map(e => e.stunT) }; };
0;"""
with sync_playwright() as p:
    b = p.webkit.launch(); print('webkit', b.version)
    # ---------- 原型模式：规则 ----------
    c = b.new_context(**p.devices['iPhone 15']); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_function("window.__td && __td.proto.ready"); pg.evaluate(MK)
    E = lambda js, *a: pg.evaluate(js, *a)
    keys = E("Object.keys(TDCore.TOWERS)"); check(len(keys) == 8 and len(E("TDCore.CEO_IDS")) == 4, f'8 种塔 {keys}、4 位统帅')
    # 路：第 1 行 x=0..5（d = x+1），(4,2) 紧挨路
    # 不触发同名加成、也没有全局技能干扰的基线：用火箭老板但把暴击关掉（Math.random=1）
    E("() => { window.__r = Math.random; Math.random = () => 0.999; }")
    def fire(tid, cmd, ds): return E("([i, c, ds]) => __fire(i, c, ds, 4, 2)", [tid, cmd, ds])
    base = 'rocket'
    r = fire('bbq', base, [5, 5.3, 4.7]); check(r['hits'] >= 2 and all(bt > 0 for bt, _ in r['burn'][:1]), f'烧烤火炉：扇形一次烧多只 + 灼烧 {r["hits"]} {r["burn"]}')
    r = fire('tea', base, [5, 5.3, 4.7]); check(r['hits'] == 3 and all(s < 1 for s in r['slow']), f'奶茶冷饮：范围减速 {r["slow"]}')
    r = fire('book', base, [5, 4.4, 3.6, 2.8, 2.2, 1.6]); check(2 <= r['hits'] <= 4, f'书页发射：直线穿透，最多 4 只 hits={r["hits"]}')
    r = fire('tech', base, [5, 4.2, 3.4, 2.6, 1.8, 1.0]); d = sorted([x for x in r['dmg'] if x > 0], reverse=True)
    check(r['hits'] == 4 and d[-1] < d[0], f'科技电塔：链电 1+3 只、逐跳衰减 {[round(x,1) for x in d]}')
    r0 = fire('t77', base, [5]); r1 = fire('t77', 'c77', [5])
    check(r0['burn'][0][0] == 3 and r0['burn'][0][1] > 0, f'77 烤串塔：命中持续燃烧 {r0["burn"]}')
    check(r1['burn'][0][0] == 4 and r1['burn'][0][1] > r0['burn'][0][1] * 2, f'★ 统帅 77 + 77 塔：燃烧 ×2、4 秒 {r0["burn"]} → {r1["burn"]}')
    r0 = fire('tpearl', base, [5, 4, 3, 2, 1, 0.2]); r1 = fire('tpearl', 'pearl', [5, 4, 3, 2, 1, 0.2])
    check(r0['hits'] == 3 and r1['hits'] == 4, f'珍珠塔：弹 2 次；★ 统帅珍珠姐多弹 1 次 {r0["hits"]} → {r1["hits"]}')
    r0 = fire('totaku', base, [5]); r1 = fire('totaku', 'otaku', [5]); one = E("__td.P.totaku.dmg")
    check(abs(r0['dmg'][0] - one * 1.6) < 0.01, f'阿宅漫画塔：去程 + 回程（0.6）都打 {r0["dmg"][0]:.2f}')
    check(r1['dmg'][0] > r0['dmg'][0] * 1.2, f'★ 统帅阿宅 + 漫画塔：回程满伤（再叠阿宅全局射程）{r0["dmg"][0]:.2f} → {r1["dmg"][0]:.2f}')
    r0 = fire('trocket', 'c77', [5, 6.2]); r1 = fire('trocket', 'rocket', [5, 6.2])
    check(r0['hits'] == 1 and r1['hits'] == 2, f'火箭塔：范围爆炸；★ 统帅火箭老板爆炸范围 ×1.5（1.2 格外的也炸到）{r0["hits"]} → {r1["hits"]}')
    # 统帅全局技能（用通用塔 book 测）
    rb = fire('book', 'otaku', [5]); r77 = fire('book', 'c77', [5])
    check(abs(r77['dmg'][0] / rb['dmg'][0] - 1.15) < 0.01 and r77['burn'][0][0] > 0 and rb['burn'][0][0] == 0, f'统帅 77 全局：全场塔伤害 +15%、命中带燃烧 {rb["dmg"][0]:.1f} → {r77["dmg"][0]:.1f}')
    rp = fire('book', 'pearl', [5]); check(abs(rp['cd'] - E("__td.P.book.rate") * 0.82) < 0.01 and abs(rb['cd'] - E("__td.P.book.rate")) < 0.01, f'统帅珍珠姐全局：塔出手间隔 ×0.82 {rb["cd"]:.3f} → {rp["cd"]:.3f}')
    rr = fire('book', 'rocket', [5]); check(abs(rb['rng'] - rr['rng'] - 0.45) < 0.001, f'统帅阿宅全局：塔射程 +0.45 格 {rr["rng"]:.2f} → {rb["rng"]:.2f}')
    E("() => { Math.random = () => 0; }"); rc = fire('book', 'rocket', [5]); E("() => { Math.random = () => 0.999; }")
    check(abs(rc['dmg'][0] / rr['dmg'][0] - 2.2) < 0.01, f'统帅火箭老板全局：暴击 ×2.2 {rr["dmg"][0]:.1f} → {rc["dmg"][0]:.1f}')
    # 防连锁：燃烧跳伤不再续燃烧；击杀不触发额外攻击
    lp = E("() => { const G = __fresh('c77'); G.es = [__mk(5)]; const e = G.es[0]; e.burnT = 2; e.burnD = 10; for (let i = 0; i < 30; i++) __td.step(0.05); return [e.burnT, e.hp]; }")
    check(lp[0] <= 0.5 + 1e-6 and lp[1] < 1e6, f'燃烧会烧完自己结束，不会自我续烧 {lp}')
    E("() => { Math.random = window.__r; }")
    # 统帅大招
    for cmd in ['c77', 'pearl', 'otaku', 'rocket']:
        u = E("(c) => { const G = __fresh(c); G.es = [__mk(5), __mk(8), __mk(12)]; __td.step(0.0001); G.c.x = G.c.tx = 4.5; G.c.y = G.c.ty = 2.5; G.energy = 100; const s0 = ZBSfx.state.count.ult || 0; const ok = __td.castUlt(); return { ok, e: G.energy, hit: G.es.filter(e => e.hp < 1e6).length, stun: G.es.filter(e => e.stunT > 0).length, lbl: document.getElementById('ultLbl').textContent }; }", cmd)
        check(u['ok'] and u['e'] == 0 and u['hit'] >= 1, f'统帅 {cmd} 大招能放、清能量、打到僵尸 {u}')
    # 统帅不占塔位：站的格子能造塔；只走路面
    nb = E("() => { const G = __fresh('pearl'); const ok1 = __td.moveCmd(4, 2), ok2 = __td.moveCmd(2, 1); G.cash = 1e4; const b = __td.build('bbq', 2, 2); return [ok1, ok2, b, __td.build('bbq', 2, 1)]; }")
    check(nb == [False, True, True, False], f'统帅只能走路面、不占塔位；路面不能造塔 {nb}')
    # 局内建设点：每局重置成 160，剩余不兑换主金币；塔可局内升级 / 拆除
    bp = E("() => { const c0 = __td.proto.coins; let G = __fresh('rocket'); const a = G.cash; __td.build('bbq', 4, 2); const b = G.cash; const up = __td.upTower(4, 2); const sl = __td.sell(4, 2); const c = G.cash; G = __fresh('rocket'); return [a, b, up, sl, c, G.cash, __td.proto.coins === c0]; }")
    check(bp[0] == 160 and bp[1] == 100 and bp[2] and bp[3] and bp[5] == 160 and bp[6], f'建设点每局 160，造塔扣点、可升级 / 拆除，下局重置，主金币不变 {bp}')
    # 统帅开局锁定
    lk = E("() => { const G = __fresh('pearl'); __td.cmdSel = 'c77'; return [G.cmd, document.getElementById('ultLbl').textContent]; }")
    check(lk == ['pearl', '冰沙'], f'统帅开局锁定，菜单换人不影响本局 {lk}')
    # 原型：主金币永久升级只写 tangzhe-td-proto
    up = E("() => { if (__td.G) __td.G.over = true; const c0 = __td.proto.coins, p = TDCore.price('bbq', 0); const a = __td.buyUp('bbq'); const c1 = __td.proto.coins; const s = JSON.parse(localStorage.getItem('tangzhe-td-proto')); return { a, spent: c0 - c1, p, lv: __td.proto.lv.bbq, saved: s.lv.bbq, keys: Object.keys(localStorage) }; }")
    check(up['a'] and up['spent'] == up['p'] and up['lv'] == 1 and up['saved'] == 1 and up['keys'] == ['tangzhe-td-proto'], f'原型：永久升级扣模拟金币、只写 tangzhe-td-proto {up}')
    nf = E("() => { const c = __td.proto.coins; __td.proto.coins = 10; const a = __td.buyUp('tea'); __td.proto.lv.book = 30; const b = __td.buyUp('book'); __td.proto.coins = c; return [a, b, __td.proto.lv.tea]; }")
    check(nf == [False, False, 0], f'金币不够 / 满级 30 不能升级 {nf}')
    # 10 波打完 → 过关；进度 best=10、cleared=1
    w = E("() => { const G = __fresh('rocket'); G.wave = 10; G.q = []; G.es = []; __td.step(0.05); return { over: G.over, win: G.win, best: __td.proto.best, cl: __td.proto.cleared, title: document.getElementById('resTitle').textContent }; }")
    check(w['over'] and w['win'] and w['best'] == 10 and w['cl'] == 1 and w['title'] == '守住了！', f'守满 10 波过关，进度记上 {w}')
    l = E("() => { const G = __fresh('rocket'); G.wave = 3; G.lives = 1; G.es = [__mk(26.99, 50)]; G.es[0].sp = 1; __td.step(0.05); return { over: G.over, win: G.win, title: document.getElementById('resTitle').textContent }; }")
    check(l['over'] and not l['win'] and l['title'] == '机房失守', f'生命归零失败 {l}')
    wl = E("() => [__td.waveList(4).includes('mini'), __td.waveList(9).includes('boss'), __td.waveList(3).some(t => t === 'boss' || t === 'mini')]")
    check(wl == [True, True, False], f'第 5 波小 Boss、第 10 波 Boss {wl}')
    check(not errs, f'原型页无报错 {errs[:3]}')
    c.close()
    # ---------- 嵌入：协议（假经营页） ----------
    c = b.new_context(**p.devices['iPhone 15']); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/__host_test.html', lambda r: r.fulfill(body=HOST, content_type='text/html; charset=utf-8'))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.goto(HOST_URL)
    for _ in range(50):
        f = next((x for x in pg.frames if 'embed=1' in x.url), None)
        if f and f.evaluate("!!(window.__td && __td.proto.ready)"): break
        pg.wait_for_timeout(100)
    F = lambda js, *a: f.evaluate(js, *a)
    check(F("__td.EMBED && __td.proto.coins") == 5e9 and F("!document.getElementById('exitBtn').classList.contains('hidden')"), '嵌入：拿到经营页金币，显示「返回经营」')
    F("__td.buyUp('tea')"); pg.wait_for_timeout(200)
    bu = pg.evaluate("({ last: log.filter(m => m.td === 'buy').pop(), coins: W.coins, lv: W.z.lv.tea })"); fs = F("({ c: __td.proto.coins, lv: __td.proto.lv.tea, keys: Object.keys(localStorage) })")
    check(bu['last']['td'] == 'buy' and bu['last']['id'] == 'tea' and isinstance(bu['last'].get('requestId'), str) and bool(bu['last']['requestId']) and 'price' not in bu['last'] and bu['coins'] == 5e9 - 1e6 and fs['c'] == 5e9 - 1e6 and fs['lv'] == 1 and fs['keys'] == [], f'嵌入：升级只发 td:buy（不带价格），经营页扣款后回推，本页不写存档 {bu} {fs}')
    pg.evaluate("W.blocked = true; send()"); pg.wait_for_timeout(100)
    bl = F("[__td.buyUp('bbq'), [...document.querySelectorAll('[data-up]')].every(b => b.disabled)]")
    check(bl == [False, True], f'嵌入：只读坏档时升级全灰、硬调也不发 {bl}')
    pg.evaluate("W.blocked = false; send(); W.ackStart = false"); pg.wait_for_timeout(100)
    F("__td.cmdSel = 'pearl'; __td.start(1)"); pg.wait_for_timeout(100)
    st = F("({ pend: __td.G.pendStart, t0: __td.G.t, run: __td.G.runId })"); pg.wait_for_timeout(300)
    st2 = F("__td.G.t"); sent = pg.evaluate("log.filter(m => m.td === 'start').pop()")
    check(st['pend'] and st2 == 0 and sent['cmd'] == 'pearl' and sent['runId'] == st['run'], f'嵌入：开局先发 td:start（带 runId / 统帅），回执前不计时 {sent}')
    pg.evaluate("send({ack:'start', ok:true, runId:'old-run'})"); pg.wait_for_timeout(100)
    check(F("__td.G.pendStart"), '嵌入：别的 runId 的回执不理')
    pg.evaluate(f"send({{ack:'start', ok:true, runId:'{st['run']}'}})"); pg.wait_for_timeout(300)
    check(not F("__td.G.pendStart") and F("__td.G.t") > 0, '嵌入：本局 runId 的 ok 回执到了才开打')
    pg.evaluate("W.failResult = true")
    F("(() => { const G = __td.G; G.wave = 10; G.q = []; G.es = []; __td.step(0.05); })()"); pg.wait_for_timeout(300)
    rs = pg.evaluate("log.filter(m => m.td === 'result').pop()")
    ui = F("({ t: document.getElementById('resTitle').textContent, retry: !document.getElementById('retryBtn').classList.contains('hidden'), n: document.getElementById('resNote').textContent })")
    check(rs['win'] and rs['waves'] == 10 and rs['cmd'] == 'pearl' and rs['runId'] == st['run'] and ui['t'] == '存档失败' and ui['retry'] and '写盘失败' in ui['n'], f'嵌入：结算带 runId / 统帅；存档失败不显示过关、给「重试保存」 {ui}')
    pg.evaluate("W.failResult = false"); F("document.getElementById('retryBtn').click()"); pg.wait_for_timeout(300)
    ui = F("({ t: document.getElementById('resTitle').textContent, retry: !document.getElementById('retryBtn').classList.contains('hidden') })"); hz = pg.evaluate("W.z")
    check(ui['t'] == '守住了！' and not ui['retry'] and hz['cleared'] == 1 and hz['best'] == 10, f'嵌入：重试保存成功后界面更新为守住了，经营页进度记上 {ui} {hz}')
    pg.evaluate("W.ackStart = false"); F("document.getElementById('menuBtn').click(); __td.start(1)"); pg.wait_for_timeout(4400)
    to = F("({ g: !!__td.G, menu: !document.getElementById('menu').classList.contains('hidden'), toast: document.getElementById('toast').textContent })")
    check(not to['g'] and to['menu'] and '超时' in to['toast'], f'嵌入：4 秒没回执回菜单 {to}')
    pg.evaluate(f"W.ackStart = true"); F("__td.start(1)"); pg.wait_for_timeout(200)
    F("document.dispatchEvent(new Event('visibilitychange'))")
    F("Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange'))")
    hv = F("[__td.paused, ZBSfx.state.on]"); F("delete document.hidden")
    check(hv == [True, False], f'嵌入：切后台自动暂停、音乐停 {hv}')
    check(not errs, f'嵌入页无报错 {errs[:3]}')
    c.close()
    # ---------- 画面：SE / 15 ----------
    for dn in ['iPhone SE', 'iPhone 15']:
        c = b.new_context(**p.devices[dn]); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_function("window.__td && __td.proto.ready"); pg.evaluate(MK)
        tag = dn.replace(' ', '_')
        pg.screenshot(path=f'/tmp/td/{tag}_menu.png')
        mb = pg.evaluate("(() => { const m = document.getElementById('menu'); m.scrollTop = m.scrollHeight; const r = document.getElementById('startBtn').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height > 0; })()")
        check(mb, f'{dn} 菜单拉到底「开守」可点')
        pg.locator('#cmdPick [data-cmd=c77]').tap(); pg.locator('#startBtn').tap(); pg.wait_for_timeout(300)
        pg.evaluate("(() => { const G = __td.G; G.cash = 2000; G.wave = 4; [['bbq',4,2],['t77',2,3],['tech',3,5],['book',4,6],['tea',2,5],['tpearl',6,8],['totaku',4,8],['trocket',0,5]].forEach(a => __td.build(...a)); __td.nextWave(); for (let i = 0; i < 260; i++) __td.step(0.03); })()")
        g = pg.evaluate("__td.geo")
        pg.mouse.click(g['OX'] + g['S'] * 0.5, g['OY'] + g['S'] * 2.5); pg.wait_for_timeout(200)
        lay = pg.evaluate("(() => { const g = __td.geo, bar = document.getElementById('bar').getBoundingClientRect(), top = document.querySelector('.hud-top').getBoundingClientRect(); return { gridTop: g.OY, gridBot: g.OY + g.S * g.ROWS, barTop: bar.top, hudBot: top.bottom, build: !document.getElementById('barBuild').classList.contains('hidden'), n: document.querySelectorAll('#twGrid button').length, star: document.querySelector('#twGrid .syn') && document.querySelector('#twGrid .syn').textContent }; })()")
        check(lay['build'] and lay['n'] == 8 and lay['star'] and '77' in lay['star'], f'{dn} 点空地弹出 8 种塔，同名塔标★ {lay["star"]}')
        check(lay['gridBot'] <= lay['barTop'] + 1 and lay['gridTop'] >= lay['hudBot'] - 1, f'{dn} 地图不被顶栏 / 造塔栏挡住 {lay}')
        pg.screenshot(path=f'/tmp/td/{tag}_build.png')
        pg.locator('#buildX').tap(); pg.evaluate("__td.G.energy = 100"); pg.wait_for_timeout(100); pg.locator('#ultBtn').tap(); pg.wait_for_timeout(120)
        pg.screenshot(path=f'/tmp/td/{tag}_ult.png')
        check(pg.evaluate("__td.G.energy") < 100, f'{dn} 点大招按钮能放')
        check(not errs, f'{dn} 无报错 {errs[:3]}')
        c.close()
    b.close()
print(f'passed {ok}, failed {bad}')
sys.exit(1 if bad else 0)
