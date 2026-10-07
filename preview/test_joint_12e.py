# 12e 联合链路（WebKit；iPhone SE / iPhone 15；13k 起读 state.pets v2）：主页买狗 → 进打僵尸训练扣费 → 返回主页 → 刷新
# 每一步核对：内存金币 = 存档金币、rev 只增不乱（-bak = 上一份主档）、小狗 / 训练等级都在同一份 tangzhe-preview-save 里，不丢档、不加键
# 用法：仓库根目录起静态服务，再 .pwvenv/bin/python preview/test_joint_12e.py [主预览 URL]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49941/preview/index.html'
SAVE = 'tangzhe-preview-save'; BAK = SAVE + '-bak'
res = []
def check(c, m): res.append(bool(c)); print(('  ✓ ' if c else '  ✗ ') + m)
def disk(pg): return pg.evaluate(f"() => {{ const d = JSON.parse(localStorage.getItem('{SAVE}') || 'null'), b = JSON.parse(localStorage.getItem('{BAK}') || 'null'), s = __tzz.state; return {{ mem: s.coins, memRev: s.rev, coins: d && d.coins, rev: d && d.rev, bakRev: b && b.rev, pet: !!(d && d.pets && d.pets.v === 2 && d.pets.list.some(x => x.species === 'dog')), petHome: (d && d.pets && (d.pets.list.find(x => x.species === 'dog') || {{}}).room) || null, legacyPet: !!(d && 'pet' in d), z: d && d.zombie || null, memZ: s.zombie || null, keys: Object.keys(localStorage).sort() }}; }}")
def zframe(pg):
    for _ in range(80):
        for f in pg.frames:
            if '/zombie/' in f.url:
                try:
                    if f.evaluate("!!(window.__zb && __zb.proto.ready)"): return f
                except Exception: pass
        pg.wait_for_timeout(100)
    return None
def boot(pg):
    pg.goto(URL); pg.wait_for_function("window.__tzz && __tzz.state && document.body.dataset.petReady === '1'", timeout=20000)
    pg.evaluate("() => { for (let i = 0; i < 10 && __tzz.modalOpen(); i++) __tzz.closeModal(); }")
with sync_playwright() as p:
    b = p.webkit.launch()
    for dn in ['iPhone SE', 'iPhone 15']:
        print('==', dn); ctx = b.new_context(**p.devices[dn]); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        boot(pg)
        pg.evaluate(f"""() => {{ const E = __tzz.E, s = E.newState(Date.now()); s.coins = 5000000; s.coinFrac = 0; s.rev = 300000; delete s.pet; delete s.pets; delete s.zombie;
          localStorage.clear(); localStorage.setItem('tangzhe-save', 'SENTINEL'); localStorage.setItem('{SAVE}', JSON.stringify(s)); }}""")
        boot(pg); d0 = disk(pg)
        check(d0['mem'] == 5000000 and d0['coins'] == 5000000 and not d0['pet'] and not d0['legacyPet'], f"起点：内存 = 存档 = 500 万，没有小狗（rev {d0['rev']}）")
        # ① 主页买狗
        pg.evaluate("() => { __tzz.setTab('home'); __tzz.homeAct('homeSub', 'mall'); __tzz.homeAct('homePetBuy', 'c77'); }"); pg.wait_for_timeout(300)
        pg.click('#pbYes'); pg.wait_for_timeout(500); d1 = disk(pg)
        check(d1['pet'] and d1['petHome'] == 'c77' and not d1['legacyPet'] and d1['coins'] == 4997000 and d1['mem'] == 4997000 and d1['rev'] == d1['memRev'] and d1['rev'] > d0['rev'] and d1['bakRev'] == d1['rev'] - 1,
              f"① 主页买狗：扣 3000 → 内存 = 存档 = {d1['coins']}，存档有狗，rev {d0['rev']}→{d1['rev']}（-bak {d1['bakRev']}）")
        vis = pg.evaluate("() => { __tzz.homeAct('homeSub', 'room'); __tzz.pets.draw(); const v = __tzz.pets.view(), u = (v.rooms.c77 || [])[0]; return { room: !!document.querySelector('#roomFloor'), w: !!(u && __tzz.pets.world(u)), sub: __tzz.homeSub, n: (v.rooms.c77 || []).length }; }")
        check(vis['room'] and vis['w'] and vis['sub'] == 'room' and vis['n'] == 1, f'① 77 的家里有这只狗（state.pets v2，按 uid 取引擎）{vis}')
        # ② 进打僵尸训练扣费
        pg.evaluate("() => { __tzz.setTab('shop'); __tzz.renderTab(); }"); pg.wait_for_timeout(300)
        pg.locator('[data-act=zombie]').first.tap(); f = zframe(pg)
        check(f is not None, '② 经营页「77 打僵尸」入口打开小游戏')
        if f is None: ctx.close(); continue
        zc = f.evaluate("__zb.proto.coins"); check(zc == 4997000, f'② 小游戏显示的余额 = 买狗后的经营余额（{zc}）')
        f.locator('[data-tr="atk"]').tap(); pg.wait_for_timeout(500); d2 = disk(pg)
        cost = d1['coins'] - d2['coins']
        check(cost > 0 and d2['mem'] == d2['coins'] and d2['z'] and d2['z']['lv']['atk'] == 1 and d2['pet'] and d2['rev'] == d2['memRev'] and d2['rev'] > d1['rev'] and d2['bakRev'] == d2['rev'] - 1,
              f"② 训练 1 次：扣 {cost:,} → 内存 = 存档 = {d2['coins']:,}，atk Lv1 写进同一份档，小狗还在，rev {d1['rev']}→{d2['rev']}（-bak {d2['bakRev']}）")
        # ③ 返回主页
        f.evaluate("document.getElementById('exitBtn').click()"); pg.wait_for_timeout(400)
        closed = pg.evaluate("() => !__tzz.zbOpen && document.getElementById('zbOverlay').classList.contains('hidden')")
        pg.evaluate("() => { __tzz.setTab('home'); __tzz.homeAct('homeSub', 'room'); }"); pg.wait_for_timeout(400); d3 = disk(pg)
        check(closed and d3['mem'] == d2['coins'] and d3['coins'] == d2['coins'] and d3['pet'] and d3['z']['lv']['atk'] == 1 and d3['rev'] >= d2['rev'] and d3['rev'] == d3['memRev'],
              f"③ 返回主页：金币 {d3['coins']:,} 不变（内存 = 存档），小狗 / 训练等级都在，rev {d3['rev']}")
        # ④ 刷新：从存档读回来一模一样
        pg.evaluate("() => __tzz.persist()"); d3b = disk(pg); boot(pg); d4 = disk(pg)
        check(d4['mem'] == d3b['coins'] and d4['pet'] and d4['petHome'] == 'c77' and d4['memZ'] and d4['memZ']['lv']['atk'] == 1 and d4['memRev'] >= d3b['rev'],
              f"④ 刷新后：金币 {d4['mem']:,}、小狗在 77 家、atk Lv1 都读回来，rev {d3b['rev']}→{d4['memRev']}")
        check(d4['keys'] == sorted(['tangzhe-save', SAVE, BAK, 'tangzhe-preview-tab-lock']) and pg.evaluate("localStorage.getItem('tangzhe-save')") == 'SENTINEL', f"没有新增存档键、正式档 tangzhe-save 没碰：{d4['keys']}")
        check(not errs, f'控制台 0 报错 {errs[:3]}')
        ctx.close()
    b.close()
print(f"\n12e 联合链路：{sum(res)} 过 / {len(res) - sum(res)} 挂"); sys.exit(0 if all(res) else 1)
