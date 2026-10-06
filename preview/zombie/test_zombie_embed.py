# 打僵尸嵌入经营页回归（Playwright WebKit，模拟 iPhone）：python3 test_zombie_embed.py [经营页 URL]
# 验：入口 → iframe → 训练只走经营统一钱包扣款 → 写进同一份预览档；伪造消息 / 跳关 / 异常档都不能改金币或进度。
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/preview/index.html'
OUT = '/home/ubuntu/qa/zbembed'
fails, passes = [], 0
def check(ok, msg):
    global passes
    if ok: passes += 1
    else: fails.append(msg); print('FAIL', msg)
S = lambda f, js: f.evaluate(js)
SAVE = 'tangzhe-preview-save'
def zframe(pg):
    for _ in range(50):
        for f in pg.frames:
            if '/zombie/' in f.url:
                try:
                    if f.evaluate("!!(window.__zb && __zb.proto.ready)"): return f
                except Exception: pass
        pg.wait_for_timeout(100)
    return None
def main_st(pg):
    return S(pg, f"(() => {{ const s = __tzz.state, d = JSON.parse(localStorage.getItem('{SAVE}') || 'null'); return {{ coins: s.coins, z: s.zombie || null, saved: d && d.coins, savedZ: d && d.zombie || null, proto: localStorage.getItem('tangzhe-zombie-proto'), formal: localStorage.getItem('tangzhe-save'), open: __tzz.zbOpen }}; }})()")
with sync_playwright() as p:
    b = p.webkit.launch(); print('webkit', b.version)
    se3 = dict(p.devices['iPhone SE']); se3.update(viewport={'width': 375, 'height': 667}, screen={'width': 375, 'height': 667}, device_scale_factor=2)
    for dn, dev in {'iPhone SE': p.devices['iPhone SE'], 'SE3 375x667': se3, 'iPhone 15': p.devices['iPhone 15']}.items():
        tag = dn.replace(' ', '_'); c = b.new_context(**dev); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); pg.evaluate("localStorage.setItem('tangzhe-save','SENTINEL')"); pg.wait_for_function("window.__tzz && __tzz.state")
        S(pg, "__tzz.state.coins = 5e10; __tzz.state.coinFrac = 0; __tzz.persist(); __tzz.closeModal && __tzz.closeModal()"); pg.wait_for_timeout(400)
        S(pg, "__tzz.closeModal && __tzz.closeModal()")
        card = S(pg, "!!document.querySelector('[data-act=zombie]')")
        check(card, f'{dn} 经营页有「77 打僵尸」入口')
        pg.locator('[data-act=zombie]').first.tap(); f = zframe(pg)
        check(f is not None and S(pg, "!document.getElementById('zbOverlay').classList.contains('hidden')"), f'{dn} 点入口打开全屏小游戏')
        if f is None: c.close(); continue
        z0 = S(f, "({coins: __zb.proto.coins, embed: __zb.EMBED, wallet: document.getElementById('walletTxt').textContent, lbl: document.getElementById('walletLbl').textContent, exit: !document.getElementById('exitBtn').classList.contains('hidden')})")
        check(z0['embed'] and z0['coins'] == 5e10 and z0['lbl'] == '金币' and z0['exit'], f'{dn} 小游戏显示经营余额 500 亿、有返回按钮 {z0}')
        f.locator('[data-tr="atk"]').tap(); pg.wait_for_timeout(300)
        m = main_st(pg); zl = S(f, "__zb.proto.lv.atk")
        check(m['coins'] == 5e10 - 1e6 and m['z']['lv']['atk'] == 1 and m['saved'] == 5e10 - 1e6 and m['savedZ']['lv']['atk'] == 1 and zl == 1,
              f'{dn} 训练 1 次：经营钱包扣 100 万并写进 {SAVE}，小游戏同步 Lv1 {m}')
        check(m['proto'] is None and m['formal'] == 'SENTINEL', f'{dn} 嵌入模式不写原型键、不碰正式档 tangzhe-save')
        pg.screenshot(path=f'{OUT}/{tag}_menu.png')
        # 正常打完第 1 关 → 解锁
        S(f, "__zb.start('level', 1); __zb.G.p.hp = 1e9; __zb.G.t = __zb.G.dur - 0.01; __zb.step(0.05)"); pg.wait_for_timeout(300)
        m = main_st(pg); check(m['z']['cleared'] == 1 and m['savedZ']['cleared'] == 1, f'{dn} 打满第 1 关：经营档记已通关 1 {m["z"]}')
        # 伪造：跳关、没打满时长、未通 50 关的无尽、主页面自己发、坏 id
        bad = ["__zb.send({zb:'result',mode:'level',n:10,win:true,t:999})",
               "__zb.send({zb:'result',mode:'level',n:2,win:true,t:5})",
               "__zb.send({zb:'result',mode:'endless',t:9999,kills:5})",
               "__zb.send({zb:'buy',id:'__proto__'})",
               "__zb.send({zb:'buy',id:'atk',price:1}); 0"]
        for js in bad[:4]: S(f, js)
        S(pg, "postMessage({zb:'buy',id:'atk'},location.origin)"); S(f, "parent.postMessage({zb:'buy',id:'atk'},location.origin)"); pg.wait_for_timeout(300)
        m2 = main_st(pg)
        check(m2['z']['cleared'] == 1 and m2['z']['endBest']['t'] == 0 and m2['coins'] == m['coins'] and m2['z']['lv'] == m['z']['lv'],
              f'{dn} 伪造跳关 / 秒过 / 无尽 / 坏 id / 不走端口的 window.postMessage都不改金币和进度 {m2["z"]}')
        # 带假价格的 buy：仍按 ZBCore 原价扣
        S(f, bad[4]); pg.wait_for_timeout(300); m3 = main_st(pg)
        check(m3['coins'] == m2['coins'] - 1.9e6 and m3['z']['lv']['atk'] == 2, f'{dn} 小游戏传来的价格被忽略，按 Lv1→2 原价 190 万扣 {m2["coins"]}→{m3["coins"]}')
        # 余额不足
        S(pg, "__tzz.state.coins = 10; __tzz.persist()"); S(f, "__zb.send({zb:'hello'})"); pg.wait_for_timeout(300)
        dis = S(f, "[...document.querySelectorAll('#train [data-tr]')].every(x => x.disabled)")
        S(f, "__zb.send({zb:'buy',id:'rate'})"); pg.wait_for_timeout(300); m4 = main_st(pg)
        note = S(f, "document.getElementById('trainNote').textContent")
        check(dis and m4['coins'] == 10 and m4['z']['lv']['rate'] == 0 and '不够' in note, f'{dn} 余额 10：按钮全灰，硬发购买也不扣、不升级，提示「{note}」')
        # 写盘失败：扣款和训练等级整体回滚
        S(pg, "__tzz.state.coins = 5e10; __tzz.persist()"); pg.wait_for_timeout(100)
        before = main_st(pg)
        S(pg, "window.__ls = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; 0")
        S(f, "__zb.send({zb:'buy',id:'hp'})"); pg.wait_for_timeout(300)
        S(f, "__zb.send({zb:'result',mode:'level',n:2,win:true,t:999})"); pg.wait_for_timeout(300)
        mf = main_st(pg); S(pg, "Storage.prototype.setItem = window.__ls; 0"); nf = S(f, "document.getElementById('trainNote').textContent")
        check(mf['coins'] == before['coins'] and mf['z']['lv']['hp'] == 0 and mf['z']['cleared'] == 1 and mf['saved'] == before['saved'] and S(f, "__zb.proto.lv.hp") == 0 and '存档失败' in nf,
              f'{dn} 写盘失败：训练不扣金币、不升级，通关不记，存档原样，提示「{nf}」')
        # 返回经营
        S(pg, "__tzz.state.coins = 5e10; __tzz.persist()")
        f.locator('#menuBtn').tap() if S(f, "!document.getElementById('result').classList.contains('hidden')") else None
        pg.wait_for_timeout(200); f.locator('#exitBtn').tap(); pg.wait_for_timeout(300)
        m5 = main_st(pg); check(not m5['open'] and S(pg, "document.getElementById('zbOverlay').classList.contains('hidden')"), f'{dn} 返回经营：小游戏关闭 {m5["open"]} {[x.url for x in pg.frames]}')
        # 刷新后进度还在（读档不丢 zombie 字段）
        pg.reload(); pg.wait_for_function("window.__tzz && __tzz.state"); m6 = main_st(pg)
        check(m6['z'] and m6['z']['lv']['atk'] == 2 and m6['z']['cleared'] == 1, f'{dn} 刷新经营页后训练 / 通关进度保留 {m6["z"]}')
        # 异常档（余额 1e20）：小游戏标记不可花，硬发购买原文一个字节不改
        raw = S(pg, f"localStorage.getItem('{SAVE}')"); d = json.loads(raw); d['coins'] = 1e20
        pg.goto(URL.rsplit('/', 1)[0] + '/zombie/'); S(pg, f"localStorage.setItem('{SAVE}', {json.dumps(json.dumps(d))})")  # 先离开经营页，免得卸载时自动存档盖掉
        pg.goto(URL); pg.wait_for_function("window.__tzz && __tzz.state")
        raw1 = S(pg, f"localStorage.getItem('{SAVE}')"); S(pg, "__tzz.closeModal && __tzz.closeModal(); __tzz.openZombie()"); f = zframe(pg)
        S(f, "__zb.send({zb:'buy',id:'atk'})"); pg.wait_for_timeout(400)
        blk = S(f, "({b: __zb.proto.blocked, w: document.getElementById('walletTxt').textContent})")
        check(blk['b'] and S(pg, f"localStorage.getItem('{SAVE}')") == raw1, f'{dn} 1e20 异常档：小游戏不能花钱，硬发购买存档原文不变 {blk}')
        check(not errs, f'{dn} 无 JS 报错 {errs[:3]}')
        c.close()
    b.close()
print(f'passed {passes}, failed {len(fails)}')
sys.exit(1 if fails else 0)
