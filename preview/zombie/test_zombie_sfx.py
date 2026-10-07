# 打僵尸音效：python3 preview/zombie/test_zombie_sfx.py [经营预览 URL]（需先在仓库根起 http.server 8765）。WebKit 模拟 iPhone，不算真机。
import sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/preview/zombie/'; MAIN = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/preview/index.html'
ok = bad = 0
def check(c, msg):
    global ok, bad
    if c: ok += 1
    else: bad += 1; print('FAIL', msg)
CNT = "JSON.stringify(ZBSfx.state.count)"
with sync_playwright() as p:
    b = p.webkit.launch(); print('webkit', b.version)
    for dn in ['iPhone SE', 'iPhone 15']:
        for ceo in ['c77', 'pearl', 'otaku', 'rocket']:
            c = b.new_context(**p.devices[dn]); pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(BASE + '?ceo=' + ceo); pg.wait_for_timeout(300)
            pg.click('#startBtn'); pg.wait_for_timeout(200)
            st = pg.evaluate("({ctx: ZBSfx.state.ctx && ZBSfx.state.ctx.state, on: ZBSfx.state.on, bpm: ZBSfx.state.bpm, g: __zb.G && __zb.G.ceo})")
            check(st['ctx'] == 'running' and st['on'] and st['bpm'] == 100 and st['g'] == ceo, f'{dn} {ceo} 点开打解锁声音、背景乐起、第 1 关 100 BPM {st}')
            pg.evaluate("__zb.G.p.hp = __zb.G.p.maxHp = 1e9; for (let i = 0; i < 400; i++) __zb.step(0.05); 0"); pg.wait_for_timeout(100)
            n1 = pg.evaluate("ZBSfx.state.count")
            check(n1.get('shot', 0) > 0 and n1.get('hit', 0) > 0 and n1.get('kill', 0) > 0, f'{dn} {ceo} 普攻 / 命中 / 击倒有声 {n1}')
            u = pg.evaluate("(()=>{ __zb.G.ult = 100; const r = __zb.castUlt(); return {r, n: ZBSfx.state.count.ult || 0}; })()")
            check(u['r'] and u['n'] == 1, f'{dn} {ceo} 放大招有声 {u}')
            h = pg.evaluate("(()=>{ const g = __zb.G, p = g.p; g.frost = null; p.inv = 0; const z = g.zs[0] || {}; g.zs = [Object.assign(z, {x: p.x, y: p.y, slow: 0, hp: 1e9})]; __zb.step(0.02); return ZBSfx.state.count.hurt || 0; })()")
            check(h >= 1, f'{dn} {ceo} 挨打有声 hurt={h}')
            pg.click('#pauseBtn'); pg.wait_for_timeout(100); ps = pg.evaluate("ZBSfx.state.on")
            pg.click('#sndBtn'); lbl = pg.text_content('#sndBtn'); m = pg.evaluate("ZBSfx.state.muted")
            pg.click('#resumeBtn'); pg.wait_for_timeout(100); c0 = pg.evaluate(CNT)
            pg.evaluate("for (let i = 0; i < 40; i++) __zb.step(0.05); 0"); c1 = pg.evaluate(CNT); on2 = pg.evaluate("ZBSfx.state.on")
            check(ps is False and m and lbl == '声音：关' and c0 == c1 and not on2, f'{dn} {ceo} 暂停停乐；暂停页关声音后再打不出声 {ps} {lbl} {on2}')
            check(not errs, f'{dn} {ceo} 页面无报错 {errs}')
            c.close()
    # 难度越高越快，有上限
    c = b.new_context(**p.devices['iPhone 15']); pg = c.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
    bp = pg.evaluate("[1, 10, 25, 40, 50, 80, 1e6].map(ZBSfx.bpmFor)")
    check(bp == sorted(bp) and bp[0] == 100 and bp[1] > bp[0] and max(bp) == 150 and bp[-1] == 150, f'BPM 随关卡升高、封顶 150 {bp}')
    pg.evaluate("__zb.proto.cleared = 50; __zb.start('endless'); 0"); pg.wait_for_timeout(100)
    e1 = pg.evaluate("ZBSfx.state.bpm"); pg.evaluate("__zb.G.p.hp = 1e9; __zb.G.t = 3000; __zb.step(0.05); 0"); e2 = pg.evaluate("ZBSfx.state.bpm")
    check(e1 == 150 and e2 == 150, f'无尽模式 BPM 不超上限 {e1} {e2}'); c.close()
    # 嵌入：跟经营页静音开关
    for muted in [False, True]:
        c = b.new_context(**p.devices['iPhone 15']); pg = c.new_page(); pg.goto(MAIN); pg.wait_for_function("window.__tzz && __tzz.state")
        pg.evaluate(f"__tzz.state.muted = {'true' if muted else 'false'}; __tzz.closeModal && __tzz.closeModal(); __tzz.openZombie()"); pg.wait_for_timeout(1200)
        f = [x for x in pg.frames if '/zombie/' in x.url][0]
        em = f.evaluate("({m: ZBSfx.state.muted, src: [...document.scripts].map(s => s.src).filter(s => /zbsfx/.test(s)).length})")
        check(em['m'] == muted and em['src'] == 1, f'嵌入：经营页 muted={muted} → 小游戏静音 {em}'); c.close()
    b.close()
print(f'passed {ok}, failed {bad}')
