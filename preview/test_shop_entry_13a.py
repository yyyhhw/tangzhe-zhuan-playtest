# 预览 13a：烧烤摊店铺页「打僵尸」入口 + 当前 CEO 上场（方案 1：每家店一个小游戏，烧烤摊 = 打僵尸）
# Playwright WebKit：iPhone SE / SE3 375x667 / iPhone 15
# 13c 另验：父页开局登记 zbRun → 中途调岗结算仍按开局 CEO、同一 result 重发不双结
# 13e 另验：zb:'state' 带 muted，静音切换即同步小游戏
# 13d 另验：开局登记防重——同一 runId 重发 start 不重建 / 不翻回未结算，旧 runId 的 start / result 一律拒
# 验：① zb:'state' 带 ceo（77 在烧烤摊 → 'c77'；别的 CEO 在烧烤摊 → 那人；没人 → null）② 没 CEO 时入口写「先派 CEO」，点了打开烧烤摊的派 CEO 选单，派完入口跟着变
#    ③ 开局锁人：这局中途调任（经营页再发新 ceo）不换人，结算回传开局那位；下一局才换 ④ 只有烧烤摊有入口 ⑤ state.zombie 原样（不挪到 CEO 名下、不加字段）、不加存档键
#    ⑥ v12（350eab7 真代码）老档 77 调去别家 → 13a 读档逐项一致、入口显示现任；v13（根目录 5a27148 真代码）带打僵尸进度的老档 → 13a 往返一致
#    ⑦ 回退：13a 写过的档交给 v13 正式代码（根目录），不只读、不报错、打僵尸进度 / CEO / 等级 / 金币都在
# 用法：仓库根目录起静态服务（根目录 = v13 正式代码），v12 代码（git archive 350eab7）另起一个服务：
#   .pwvenv/bin/python preview/test_shop_entry_13a.py [预览 URL] [v13 根 URL] [v12 URL]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49951/preview/index.html'
V13 = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:49951/index.html'
V12 = sys.argv[3] if len(sys.argv) > 3 else 'http://127.0.0.1:49952/index.html'
OUT = '/home/ubuntu/qa/shop13a'
PK, PB, PL = 'tangzhe-preview-save', 'tangzhe-preview-save-bak', 'tangzhe-preview-tab-lock'
FK, FB = 'tangzhe-save', 'tangzhe-save-bak'
fails, passes = [], [0]
def check(ok, msg):
    if ok: passes[0] += 1; print('  ✓', msg)
    else: fails.append(msg); print('  ✗ FAIL', msg)
S = lambda f, js: f.evaluate(js)
blank = lambda u: u.split('?')[0].rsplit('/', 1)[0] + '/version.json'
def zframe(pg):
    for _ in range(60):
        for f in pg.frames:
            if '/zombie/' in f.url:
                try:
                    if f.evaluate("!!(window.__zb && __zb.proto.ready)"): return f
                except Exception: pass
        pg.wait_for_timeout(100)
    return None
def boot(pg, url=URL):
    pg.goto(url); pg.wait_for_function("window.__tzz && __tzz.state", timeout=20000); pg.wait_for_timeout(500)
    S(pg, "__tzz.closeModal && __tzz.closeModal()")
def shop0(pg):
    S(pg, "__tzz.closeModal && __tzz.closeModal(); __tzz.setTab('shop'); __tzz.switchShop(0); __tzz.renderTab()"); pg.wait_for_timeout(250)
    return S(pg, "(()=>{const c=document.querySelector('.zb-card'); if(!c) return null; const b=c.querySelector('button[data-act]'); const im=c.querySelector('.ava img'); return {ceo:c.dataset.zbCeo, txt:c.innerText, act:b&&b.dataset.act, btn:b&&b.textContent, img:im?im.getAttribute('src'):null, vis:c.getBoundingClientRect().height>0}})()")
def finish(f):  # 打满当前关
    S(f, "__zb.G.p.hp = 1e9; __zb.G.t = __zb.G.dur - 0.01; __zb.step(0.05)")
def put(pg, key, raw, url=URL, bak=None):
    pg.goto(blank(url)); S(pg, f"localStorage.clear(); localStorage.setItem({json.dumps(key)}, {json.dumps(raw)})" + (f"; localStorage.setItem({json.dumps(key + '-bak')}, {json.dumps(bak)})" if bak else ''))
def disk(pg, key=PK): return json.loads(S(pg, f"localStorage.getItem({json.dumps(key)})") or 'null')
ZKEYS = ['best', 'cleared', 'endBest', 'lv']
def flat(o, p=''):
    if isinstance(o, dict):
        r = {}
        for k, v in o.items(): r.update(flat(v, f'{p}.{k}' if p else k))
        return r if o else {p: {}}
    if isinstance(o, list):
        r = {}
        for i, v in enumerate(o): r.update(flat(v, f'{p}[{i}]'))
        return r if o else {p: []}
    return {p: o}
SKIP = ('rev', 'lastSeen', 'maxSeen', 'coins', 'coinFrac', 'totalEarned', 'earnedFrac', 'pending.')
def same(a, b):
    fa, fb = flat(a), flat(b); d = []
    for k, v in fa.items():
        if k.startswith(SKIP): continue
        if k not in fb: d.append(f'{k}: {v!r} → (没了)')
        elif fb[k] != v and not (isinstance(v, (int, float)) and not isinstance(v, bool) and isinstance(fb[k], (int, float)) and v == fb[k]): d.append(f'{k}: {v!r} → {fb[k]!r}')
    return d

with sync_playwright() as p:
    b = p.webkit.launch(); print('webkit', b.version)
    se3 = dict(p.devices['iPhone SE']); se3.update(viewport={'width': 375, 'height': 667}, screen={'width': 375, 'height': 667}, device_scale_factor=2)
    DEVS = {'iPhone SE': p.devices['iPhone SE'], 'SE3 375x667': se3, 'iPhone 15': p.devices['iPhone 15']}
    for dn, dev in DEVS.items():
        print(f'== {dn} ==')
        tag = dn.replace(' ', '_'); c = b.new_context(**dev); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(blank(URL)); S(pg, "localStorage.clear(); localStorage.setItem('tangzhe-save','SENTINEL')")
        boot(pg)
        S(pg, "(()=>{const s=__tzz.state; s.coins=5e10; s.coinFrac=0; __tzz.persist();})()")
        z_before = json.dumps(disk(pg).get('zombie'))
        # ① 新档：77 在烧烤摊
        k = shop0(pg)
        check(k and k['vis'] and k['ceo'] == 'c77' and '上场：77' in k['txt'] and k['act'] == 'zombie' and k['btn'] == '去打' and k['img'] and 'face_c77' in k['img'],
              f'{dn} 新档：烧烤摊店铺页入口显示上场 77（头像 {k and k["img"]}）、按钮「去打」')
        pg.screenshot(path=f'{OUT}/{tag}_1_c77.png', full_page=True)
        S(pg, "(()=>{const s=__tzz.state,E=__tzz.E; E.openShop(s,1); E.checkUnlocks(s); __tzz.persist(); __tzz.switchShop(1); __tzz.setTab('shop'); __tzz.renderTab();})()"); pg.wait_for_timeout(250)
        S(pg, "__tzz.closeModal && __tzz.closeModal()")
        check(S(pg, "__tzz.state.cur === 1 && !document.querySelector('.zb-card') && !document.querySelector('[data-act=zombie],[data-act=zbAssign]')"), f'{dn} 奶茶店页没有打僵尸入口（其他三家以后各有自己的游戏）')
        shop0(pg); pg.locator('.zb-card [data-act=zombie]').tap(); f = zframe(pg)
        check(f is not None and S(f, "__zb.ceo") == 'c77', f'{dn} 点「去打」打开小游戏，zb:state 里 ceo = c77（{f and S(f, "__zb.ceo")}）')
        # 13e：zb:'state' 带 muted，经营页静音开关一切换就同步给开着的小游戏
        S(pg, "(()=>{const P=MessagePort.prototype; if(!P.__spy){const o=P.postMessage; P.__spy=1; P.postMessage=function(m,...a){ if(m&&m.zb==='state') window.__lastZb=m; return o.call(this,m,...a); };} window.__lastZb=null;})()")
        m0 = S(pg, "!!__tzz.state.muted")
        for i in range(2):
            S(pg, "document.querySelector('#mute').click()"); pg.wait_for_timeout(120)
            lz = S(pg, "window.__lastZb && {muted: window.__lastZb.muted, st: !!__tzz.state.muted}")
            want = (not m0) if i == 0 else m0
            check(lz and lz['muted'] is want and lz['st'] is want, f'{dn} 13e 静音开关第 {i+1} 次切换：zb:state.muted = {want}（{lz}）')
        S(f, "__zb.start('level', 1)"); pg.wait_for_timeout(200)
        g0 = S(f, "__zb.G && __zb.G.ceo"); r0 = S(pg, "(()=>{const r=__tzz.zbRun; return r && {ceoId:r.ceoId, settled:!!r.settled, runId:r.runId};})()")
        check(g0 == 'c77' and r0 and r0['ceoId'] == 'c77' and not r0['settled'] and r0['runId'] == S(f, "__zb.G.runId"),
              f'{dn} 13c 开局：小游戏锁 c77，父页 zbRun 已登记同 runId、未结算 {r0}')
        finish(f); pg.wait_for_timeout(350)
        check(g0 == 'c77' and S(pg, "__tzz.zbLastCeo") == 'c77' and S(pg, "__tzz.state.zombie.cleared") == 1 and S(pg, "__tzz.zbRun && __tzz.zbRun.settled"),
              f'{dn} 77 打满第 1 关：开局锁 c77、结算回传 ceo=c77、通关记进 state.zombie、zbRun.settled')
        # ③ 开局锁人：这局中途把珍珠姐调来烧烤摊
        S(f, "__zb.start('level', 2)"); pg.wait_for_timeout(200)
        S(pg, "(()=>{const s=__tzz.state; __tzz.E.assignCeo(s,'pearl',0); __tzz.persist(); __tzz.zbReply();})()"); pg.wait_for_timeout(250)
        mid = S(f, "({host: __zb.ceo, run: __zb.G.ceo, over: __zb.G.over})")
        check(mid['host'] == 'pearl' and mid['run'] == 'c77' and not mid['over'], f'{dn} 中途调任：经营页新发 ceo=pearl，这局仍锁 c77 {mid}')
        finish(f); pg.wait_for_timeout(350)
        check(S(pg, "__tzz.zbLastCeo") == 'c77' and S(pg, "__tzz.state.zombie.cleared") == 2 and S(f, "document.getElementById('resTitle').textContent").startswith('第 2 关通关'),
              f'{dn} 中途调任那局结算：回传 ceo=c77、第 2 关照样记上（关卡进度共用）')
        # 13c（熊大 06:33 第 1 条）：父页开局登记 zbRun；结算只认这份；同一结果重发不双结
        run = S(pg, "(()=>{const r=__tzz.zbRun; return r && {runId:r.runId, ceoId:r.ceoId, settled:!!r.settled};})()")
        check(run and run['ceoId'] == 'c77' and run['settled'] and isinstance(run['runId'], str) and len(run['runId']) >= 6,
              f'{dn} 13c 父页 zbRun：开局登记 c77 且已 settled {run}')
        before = S(pg, "({c: __tzz.state.zombie.cleared, coins: __tzz.state.coins, last: __tzz.zbLastCeo})")
        S(f, "(()=>{const g=__zb.G; __zb.send({zb:'result', mode:g.mode, n:g.n, win:true, t:999, kills:99, ceo:g.ceo, runId:g.runId});})()")
        pg.wait_for_timeout(300)
        after = S(pg, "({c: __tzz.state.zombie.cleared, coins: __tzz.state.coins, last: __tzz.zbLastCeo, settled: !!(__tzz.zbRun&&__tzz.zbRun.settled)})")
        check(after['c'] == before['c'] == 2 and after['coins'] == before['coins'] and after['last'] == 'c77' and after['settled'],
              f'{dn} 13c 同一结果重发不双结：cleared 仍 2、金币不变、仍 settled {before}→{after}')
        # 伪造：换 ceo / 换 runId / 不带 runId → 父页拒收（本局已 settled 时即使对得上也拒）
        S(f, "__zb.send({zb:'result', mode:'level', n:3, win:true, t:999, kills:1, ceo:'pearl', runId: __zb.G.runId})"); pg.wait_for_timeout(200)
        check(S(pg, "__tzz.state.zombie.cleared") == 2 and S(pg, "__tzz.zbLastCeo") == 'c77', f'{dn} 13c settled 后伪造下一关 result 不进档')
        # 13d（熊大 09:54 第 2 条）：已结算的 runId 再发 start → 不重新登记、仍 settled；随后同 result 再发也不双结
        S(f, f"__zb.send({{zb:'start', runId:{json.dumps(run['runId'])}, ceo:'c77'}})"); pg.wait_for_timeout(200)
        rd = S(pg, "(()=>{const r=__tzz.zbRun; return r && {runId:r.runId, ceoId:r.ceoId, settled:!!r.settled};})()")
        check(rd == run, f'{dn} 13d 已结算 runId 重发 start：zbRun 原样（仍 settled，不翻回未结算）{rd}')
        S(f, f"__zb.send({{zb:'result', mode:'level', n:2, win:true, t:999, kills:99, ceo:'c77', runId:{json.dumps(run['runId'])}}})"); pg.wait_for_timeout(200)
        check(S(pg, "__tzz.state.zombie.cleared") == 2 and S(pg, "__tzz.state.coins") == before['coins'], f'{dn} 13d 重发 start 后再发 result 仍不双结')
        f.locator('#againBtn').tap(); pg.wait_for_timeout(150)
        # 下一局开局：父页重新登记（现任已是 pearl）
        run2 = S(pg, "(()=>{const r=__tzz.zbRun; return r && {runId:r.runId, ceoId:r.ceoId, settled:!!r.settled};})()")
        check(S(f, "__zb.G && __zb.G.n === 3 && __zb.G.ceo") == 'pearl', f'{dn} 下一局才换人：第 3 关上场 pearl')
        check(run2 and run2['ceoId'] == 'pearl' and not run2['settled'] and run2['runId'] != run['runId'],
              f'{dn} 13c 下一局父页重新登记 pearl（新 runId）{run2}')
        # 13d：进行中这局的 runId 重发 start → 原样回执，不重建记录（startedAt 不变）
        t0 = S(pg, "__tzz.zbRun.startedAt")
        S(f, f"__zb.send({{zb:'start', runId:{json.dumps(run2['runId'])}, ceo:'pearl'}})"); pg.wait_for_timeout(200)
        check(S(pg, "__tzz.zbRun.startedAt") == t0 and S(pg, "__tzz.zbRun.runId") == run2['runId'] and not S(pg, "__tzz.zbRun.settled") and S(f, "__zb.G && !__zb.G.over && __zb.G.runId") == run2['runId'],
              f'{dn} 13d 进行中 runId 重发 start：父页记录不重建，小游戏这局照常')
        S(f, "__zb.setPause(true)"); S(f, "document.getElementById('quitBtn').click()"); pg.wait_for_timeout(300)
        check(S(pg, "__tzz.zbLastCeo") == 'pearl', f'{dn} 珍珠姐那局结算回传 ceo=pearl')
        # 13d：拿上一局（已消费）的 runId 来 start → 拒收，不把旧编号重新激活、不动当前记录；旧编号的 result 也不认
        cur = S(pg, "(()=>{const r=__tzz.zbRun; return r && {runId:r.runId, ceoId:r.ceoId, settled:!!r.settled};})()")
        c0 = S(pg, "({c: __tzz.state.zombie.cleared, coins: __tzz.state.coins})")
        S(f, f"__zb.send({{zb:'start', runId:{json.dumps(run['runId'])}, ceo:'c77'}})"); pg.wait_for_timeout(200)
        old = S(pg, "(()=>{const r=__tzz.zbRun; return r && {runId:r.runId, ceoId:r.ceoId, settled:!!r.settled};})()")
        check(cur and cur['runId'] == run2['runId'] and old == cur, f'{dn} 13d 旧 runId 重发 start 被拒：zbRun 仍是珍珠姐这局 {old}')
        S(f, f"__zb.send({{zb:'result', mode:'level', n:3, win:true, t:999, kills:99, ceo:'c77', runId:{json.dumps(run['runId'])}}})"); pg.wait_for_timeout(200)
        check(S(pg, "({c: __tzz.state.zombie.cleared, coins: __tzz.state.coins})") == c0 and S(pg, "__tzz.zbLastCeo") == 'pearl', f'{dn} 13d 旧 runId 的 result 不进档、不改 zbLastCeo')
        # 伪造 / 缺省回传：只认真 CEO id，不影响进度校验
        for bad in ["'__proto__'", "'constructor'", "123", "null"]:
            S(f, f"__zb.send({{zb:'result',mode:'level',n:3,win:false,t:1,kills:1,ceo:{bad}}})")
        S(f, "__zb.send({zb:'result',mode:'level',n:3,win:false,t:2,kills:2})"); pg.wait_for_timeout(300)
        # 13c：伪造 ceo / 缺 runId 的 result 一律拒收，zbLastCeo 保持上一局成功结算的 pearl，进度仍 2
        check(S(pg, "__tzz.zbLastCeo") == 'pearl' and S(pg, "__tzz.state.zombie.cleared") == 2, f'{dn} 回传 ceo 伪造（__proto__ / constructor / 数字 / null / 不带）→ 拒收，zbLastCeo 仍 pearl，进度仍 2 关')
        S(f, "__zb.send({zb:'result',mode:'level',n:9,win:true,t:999,ceo:'pearl'})"); pg.wait_for_timeout(250)
        check(S(pg, "__tzz.state.zombie.cleared") == 2, f'{dn} 带合法 ceo 的跳关结果照样不认（ceo 不是通行证）')
        S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(250)
        # ② 入口跟着现任 CEO 变（不刷新）
        k = shop0(pg)
        check(k and k['ceo'] == 'pearl' and '上场：珍珠姐' in k['txt'] and k['img'] and 'face_pearl' in k['img'] and '共用' in k['txt'] and '已通关 2/50' in k['txt'],
              f'{dn} 珍珠姐调到烧烤摊：入口改成上场珍珠姐（头像 face_pearl）、提示训练 / 关卡共用、进度 2/50 不变')
        pg.screenshot(path=f'{OUT}/{tag}_2_pearl.png', full_page=True)
        pg.locator('.zb-card [data-act=zombie]').tap(); f = zframe(pg)
        check(f is not None and S(f, "__zb.ceo") == 'pearl', f'{dn} 别的 CEO 在烧烤摊：zb:state ceo = pearl')
        S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(250)
        # 烧烤摊空着：先派 CEO
        S(pg, "(()=>{const s=__tzz.state; __tzz.E.assignCeo(s,'pearl',-1); __tzz.persist();})()")
        k = shop0(pg)
        check(k and k['ceo'] == '' and k['act'] == 'zbAssign' and k['btn'] == '先派 CEO' and '没有 CEO' in k['txt'], f'{dn} 烧烤摊没 CEO：入口按钮「先派 CEO」{k and k["btn"]}')
        pg.screenshot(path=f'{OUT}/{tag}_3_empty.png', full_page=True)
        S(pg, "__tzz.openZombie()"); f = zframe(pg)
        nz = S(f, "({ceo: __zb.ceo, dis: document.getElementById('startBtn').disabled, txt: document.getElementById('startBtn').textContent, ok: __zb.start('level', 1), g: !!__zb.G})")
        check(f is not None and nz['ceo'] is None and nz['dis'] and '派' in nz['txt'] and nz['ok'] is False and not nz['g'], f'{dn} 没 CEO 时（硬开小游戏）：zb:state ceo = null，开打按钮灰、start 不开局 {nz}')
        S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(250); shop0(pg)
        pg.locator('.zb-card [data-act=zbAssign]').tap(); pg.wait_for_timeout(300)
        sh = S(pg, "({open: !document.getElementById('sheet').classList.contains('hidden'), title: (document.querySelector('#sheet .sheet-title')||{}).innerText||'', picks: [...document.querySelectorAll('#sheet [data-ceo]')].map(x=>x.dataset.ceo), zb: __tzz.zbOpen})")
        check(sh['open'] and '烧烤' in sh['title'] and sorted(sh['picks']) == ['c77', 'pearl'] and not sh['zb'], f'{dn} 点「先派 CEO」打开烧烤摊派 CEO 选单（{sh["title"]}，可选 {sh["picks"]}），不开小游戏')
        pg.locator('#sheet [data-ceo="pearl"]').tap(); pg.wait_for_timeout(300); pg.locator('#pvYes').tap(); pg.wait_for_timeout(500)
        S(pg, "__tzz.closeModal && __tzz.closeModal()"); k = shop0(pg)
        check(S(pg, "__tzz.E.ceoAt(__tzz.state, 0)") == 'pearl' and k and k['ceo'] == 'pearl' and k['act'] == 'zombie' and disk(pg)['ceos']['pearl']['at'] == 0, f'{dn} 选单里派珍珠姐 → 确认调任：入口变成上场珍珠姐，存档里珍珠姐在烧烤摊')
        # ⑤ 存档：state.zombie 只有原 4 个字段、不加存档键
        d = disk(pg); keys = S(pg, "Object.keys(localStorage).sort()")
        check(sorted(d['zombie'].keys()) == ZKEYS and d['zombie']['cleared'] == 2 and not any('zombie' in json.dumps(v) or 'zb' in v for v in d['ceos'].values()) and 'zbCeo' not in d and 'zbLastCeo' not in d,
              f'{dn} 存档 state.zombie 仍是 {ZKEYS}（没挪到 CEO 名下、没加字段），CEO 记录里没有打僵尸字段')
        check(set(keys) <= {PK, PB, PL, 'tangzhe-save'} and S(pg, "localStorage.getItem('tangzhe-save')") == 'SENTINEL' and S(pg, "localStorage.getItem('tangzhe-zombie-proto')") is None,
              f'{dn} localStorage 只有预览键 + 原样的正式键哨兵 {keys}')
        check(z_before != json.dumps(d['zombie']), f'{dn}（对照）这一轮确实打出了进度，存档在变')
        check(not errs, f'{dn} 无 JS 报错 {errs[:3]}')
        c.close()

    # ⑥ 老档
    DEV = DEVS['iPhone 15']
    print('== 老档 v12（350eab7 真代码）：77 调去奶茶店、珍珠姐管烧烤摊 ==')
    c = b.new_context(**DEV); pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(blank(V12)); S(pg, 'localStorage.clear()'); boot(pg, V12)
    S(pg, """(()=>{const s=__tzz.state,E=__tzz.E; s.coins=3e9; for(let i=0;i<3;i++){ if(!s.shops[i].open) E.openShop(s,i); if(!s.shops[i].emp) E.hireEmp(s,i); for(let j=0;j<12;j++) E.upgradeShop(s,i); }
      E.checkUnlocks(s); for(let j=0;j<4;j++) E.upgradeCeo(s,'c77'); E.assignCeo(s,'c77',1); __tzz.persist();})()""")
    pg.goto(blank(V12)); pg.wait_for_timeout(200); v12raw = S(pg, f"localStorage.getItem('{FK}')"); v12 = json.loads(v12raw)
    check(v12['ceos']['c77']['at'] == 1 and v12['ceos']['pearl']['at'] == 0 and 'zombie' not in v12, f"v12 真代码出档：77 在奶茶店、珍珠姐在烧烤摊（{ {k: v['at'] for k, v in v12['ceos'].items()} }）、没有 zombie 字段")
    put(pg, PK, v12raw); boot(pg); k = shop0(pg); mem = S(pg, 'JSON.parse(JSON.stringify(__tzz.state))')
    check(k and k['ceo'] == 'pearl' and '上场：珍珠姐' in k['txt'] and '已通关 0/50' in k['txt'], f'v12 老档进 13a：入口显示现任珍珠姐上场（77 已调走不硬塞）')
    d1 = same(v12, mem); check(not d1, f'v12 老档读进 13a：除时间 / 金币外 {len(flat(v12))} 个字段逐项相同（不同：{d1[:5]}）')
    pg.goto(blank(URL)); pg.wait_for_timeout(200); w = disk(pg); boot(pg); mem2 = S(pg, 'JSON.parse(JSON.stringify(__tzz.state))')
    d2 = same(v12, w) + same(v12, mem2)
    check(not d2 and mem2['ceos'] == v12['ceos'] and set(w.keys()) - set(v12.keys()) <= {'coinFrac', 'earnedFrac', 'zombie'}, f'v12 老档写回 / 刷新往返：逐项相同、CEO 任职原样，新增字段只有 {sorted(set(w.keys()) - set(v12.keys()))}')
    check('zombie' not in w or sorted(w['zombie'].keys()) == ZKEYS, 'v12 老档：没玩打僵尸前不出现奇怪的 zombie 结构')
    check(not errs, f'v12 老档无 JS 报错 {errs[:2]}'); c.close()

    print('== 老档 v13（根目录 5a27148 真代码）：带打僵尸训练 / 进度，77 调去漫画店 ==')
    c = b.new_context(**DEV); pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(blank(V13)); S(pg, 'localStorage.clear()'); boot(pg, V13)
    check(S(pg, "__tzz.SAVE_KEY") == FK and S(pg, "fetch('version.json?t='+Date.now()).then(r=>r.json()).then(j=>j.v)") == '13', 'v13 根目录 = 正式 v13 代码（存档键 tangzhe-save、version 13）')
    S(pg, """(()=>{const s=__tzz.state,E=__tzz.E; s.coins=9e10; for(let i=0;i<4;i++){ if(!s.shops[i].open) E.openShop(s,i); if(!s.shops[i].emp) E.hireEmp(s,i); for(let j=0;j<10;j++) E.upgradeShop(s,i); }
      E.checkUnlocks(s); E.assignCeo(s,'otaku',0); __tzz.persist();})()""")
    S(pg, "__tzz.openZombie()"); f = zframe(pg)
    for t in ['atk', 'atk', 'rate', 'hp', 'ult']: f.locator(f'[data-tr="{t}"]').tap(); pg.wait_for_timeout(200)
    S(f, "__zb.start('level', 1)"); finish(f); pg.wait_for_timeout(300); S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(200)
    pg.goto(blank(V13)); pg.wait_for_timeout(200); v13raw = S(pg, f"localStorage.getItem('{FK}')"); v13 = json.loads(v13raw)
    check(v13['zombie']['lv'] == {'atk': 2, 'rate': 1, 'hp': 1, 'ult': 1} and v13['zombie']['cleared'] == 1 and v13['ceos']['otaku']['at'] == 0 and v13['ceos']['c77']['at'] == 2,
          f"v13 真代码出档：训练 {v13['zombie']['lv']}、通关 {v13['zombie']['cleared']}、阿宅在烧烤摊、77 在漫画店")
    put(pg, PK, v13raw); boot(pg); k = shop0(pg); mem = S(pg, 'JSON.parse(JSON.stringify(__tzz.state))')
    check(k and k['ceo'] == 'otaku' and '已通关 1/50' in k['txt'] and mem['zombie'] == v13['zombie'], f'v13 老档进 13a：入口上场阿宅、打僵尸训练 / 通关原样（{mem["zombie"]}）')
    d1 = same(v13, mem); check(not d1, f'v13 老档读进 13a：{len(flat(v13))} 个字段逐项相同（不同：{d1[:5]}）')
    S(pg, "__tzz.openZombie()"); f = zframe(pg)
    zz = S(f, "({ceo: __zb.ceo, lv: __zb.proto.lv, c: __zb.proto.cleared})")
    check(zz['ceo'] == 'otaku' and zz['lv'] == v13['zombie']['lv'] and zz['c'] == 1, f'v13 老档：小游戏收到 ceo=otaku、训练 / 进度同 v13 {zz}')
    S(f, "__zb.start('level', 2)"); finish(f); pg.wait_for_timeout(300); S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(200)
    pg.goto(blank(URL)); pg.wait_for_timeout(200); w = disk(pg)
    check(set(w.keys()) == set(v13.keys()) and sorted(w['zombie'].keys()) == ZKEYS and w['zombie']['lv'] == v13['zombie']['lv'] and w['zombie']['cleared'] == 2 and w['ceos'] == v13['ceos'],
          f'v13 老档在 13a 打一局后写回：顶层字段集合和 v13 一样（没加新字段）、zombie 只多了通关 2、CEO 不动')
    boot(pg); mem2 = S(pg, 'JSON.parse(JSON.stringify(__tzz.state))'); w2 = dict(w)
    check(not same(w2, mem2), f'13a 写的档刷新再读逐项一致')
    check(not errs, f'v13 老档进 13a 无 JS 报错 {errs[:2]}'); c.close()

    print('== ⑦ 回退：13a 写过的档交给 v13 正式代码 ==')
    c = b.new_context(**DEV); pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    put(pg, FK, json.dumps(w), V13); boot(pg, V13)
    bk = S(pg, "({blocked: __tzz.saveBlocked, li: __tzz.loadInfo && {src: __tzz.loadInfo.source, blocked: !!__tzz.loadInfo.blocked, unsafe: !!__tzz.loadInfo.unsafe}, st: JSON.parse(JSON.stringify(__tzz.state))})")
    check(not bk['blocked'] and not bk['li']['blocked'] and not bk['li']['unsafe'], f"v13 代码读 13a 档：不进只读 / 异常模式 {bk['li']}")
    d3 = same(w, bk['st']); check(not d3 and bk['st']['zombie'] == w['zombie'] and bk['st']['ceos'] == w['ceos'] and bk['st']['coins'] >= w['coins'], f'v13 代码读 13a 档：逐项一致（打僵尸 {bk["st"]["zombie"]["cleared"]} 关 / 训练 / CEO / 金币都在）{d3[:4]}')
    S(pg, "__tzz.openZombie()"); f = zframe(pg)
    check(f is not None and S(f, "__zb.proto.cleared") == 2 and S(f, "__zb.proto.lv") == w['zombie']['lv'], 'v13 代码的打僵尸照样读到 13a 存的进度（通关 2、训练同）')
    S(f, "__zb.start('level', 3)"); finish(f); pg.wait_for_timeout(300); S(f, "__zb.send({zb:'close'})"); pg.goto(blank(V13)); pg.wait_for_timeout(200)
    back = disk(pg, FK)
    check(back['zombie']['cleared'] == 3 and set(back.keys()) == set(w.keys()) and back['ceos'] == w['ceos'], 'v13 代码回退后还能继续打、写档（通关 3），字段集合不变')
    check(not errs, f'回退演练无 JS 报错 {errs[:2]}'); c.close()
    b.close()
print(f'\n13a/13c/13d/13e shop entry: {passes[0]} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
