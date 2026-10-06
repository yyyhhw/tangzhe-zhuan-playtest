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
        # 第 50 关：经营页写盘失败 → 结算页不报「通关 / 无尽开放」，进度仍 49，原档不动，重打按钮可用
        S(pg, "__tzz.state.zombie = {lv:{atk:30,rate:30,hp:30,ult:30},cleared:49,best:0,endBest:{t:0,kills:0}}; __tzz.state.coins = 5e10; __tzz.persist(); __tzz.closeModal && __tzz.closeModal(); __tzz.openZombie()")
        f = zframe(pg); raw49 = S(pg, f"localStorage.getItem('{SAVE}')"); bak49 = S(pg, f"localStorage.getItem('{SAVE}-bak')")
        S(pg, "window.__ls = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; 0")
        S(f, "__zb.start('level', 50); __zb.G.p.hp = 1e9; __zb.G.t = __zb.G.dur - 0.01; __zb.step(0.05)"); pg.wait_for_timeout(400)
        S(pg, "Storage.prototype.setItem = window.__ls; 0")
        r50 = S(f, "({t: document.getElementById('resTitle').textContent, n: document.getElementById('resNote').textContent, a: document.getElementById('againBtn').textContent, dis: document.getElementById('againBtn').disabled, vis: !document.getElementById('result').classList.contains('hidden'), c: __zb.proto.cleared, eb: document.getElementById('endlessBtn').disabled})")
        m50 = main_st(pg)
        check(r50['vis'] and '通关' not in r50['t'] and '无尽' not in r50['t'] and '存档失败' in r50['n'] and r50['a'] == '再打一次' and not r50['dis'] and r50['c'] == 49 and r50['eb'],
              f'{dn} 第 50 关写盘失败：结算页提示没存上、不报无尽开放、无尽仍锁 {r50}')
        check(m50['z']['cleared'] == 49 and m50['coins'] == 5e10 and S(pg, f"localStorage.getItem('{SAVE}')") == raw49 and S(pg, f"localStorage.getItem('{SAVE}-bak')") == bak49 and m50['proto'] is None and m50['formal'] == 'SENTINEL',
              f'{dn} 第 50 关写盘失败：经营档仍 49、金币不变、主档备份原文不动、不写原型键和正式档 {m50["z"]}')
        f.locator('#againBtn').tap(); pg.wait_for_timeout(200)
        g = S(f, "({n: __zb.G && __zb.G.n, mode: __zb.G && __zb.G.mode, over: __zb.G && __zb.G.over})")
        check(g['n'] == 50 and g['mode'] == 'level' and not g['over'] and '/zombie/' in f.url, f'{dn} 「再打一次」重开第 50 关，不跳无尽、不离开小游戏 {g}')
        S(f, "__zb.G.p.hp = 1e9; __zb.G.t = __zb.G.dur - 0.01; __zb.step(0.05)"); pg.wait_for_timeout(400)
        t50 = S(f, "document.getElementById('resTitle').textContent"); m51 = main_st(pg)
        check('无尽模式开放' in t50 and m51['z']['cleared'] == 50 and m51['savedZ']['cleared'] == 50, f'{dn} 存档正常后第 50 关通关：经营确认后才显示「{t50}」')
        # 无尽：写盘失败不显示新纪录，最好成绩不变
        S(f, "__zb.start('endless'); __zb.G.p.hp = 1e9; __zb.G.t = 120"); S(pg, "Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; 0")
        f.locator('#pauseBtn').tap(); f.locator('#quitBtn').tap(); pg.wait_for_timeout(400); S(pg, "Storage.prototype.setItem = window.__ls; 0")
        te = S(f, "({t: document.getElementById('resTitle').textContent, n: document.getElementById('resNote').textContent})"); me = main_st(pg)
        check('新纪录' not in te['t'] and '存档失败' in te['n'] and me['z']['endBest']['t'] == 0 and me['savedZ']['endBest']['t'] == 0, f'{dn} 无尽写盘失败：不报新纪录，最好成绩不变 {te}')
        f.locator('#againBtn').tap(); S(f, "__zb.G.p.hp = 1e9; __zb.G.t = 120"); f.locator('#pauseBtn').tap(); f.locator('#quitBtn').tap(); pg.wait_for_timeout(400)
        te2 = S(f, "document.getElementById('resTitle').textContent"); me2 = main_st(pg)
        check('新纪录' in te2 and me2['savedZ']['endBest']['t'] >= 120, f'{dn} 无尽正常保存：经营确认后才显示「{te2}」')
        S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(200)
        # 只读坏档（shops[0].lv = -1、无备份 → 经营页 saveBlocked）：小游戏标只读，训练 / 结算都不改内存和存档
        d0 = json.loads(S(pg, f"localStorage.getItem('{SAVE}')")); d0['coins'] = 5e10; d0['shops'][0]['lv'] = -1; d0['zombie'] = {'lv': {'atk': 0, 'rate': 0, 'hp': 0, 'ult': 0}, 'cleared': 3, 'best': 0, 'endBest': {'t': 0, 'kills': 0}}
        pg.goto(URL.rsplit('/', 1)[0] + '/zombie/'); S(pg, f"localStorage.removeItem('{SAVE}-bak'); localStorage.setItem('{SAVE}', {json.dumps(json.dumps(d0))})")
        pg.goto(URL); pg.wait_for_function("window.__tzz && __tzz.state"); rawb = S(pg, f"localStorage.getItem('{SAVE}')")
        S(pg, "__tzz.closeModal && __tzz.closeModal(); __tzz.openZombie()"); f = zframe(pg)
        sb = S(pg, "__tzz.saveBlocked"); mb0 = main_st(pg); zb0 = S(f, "({c: __zb.proto.cleared, b: __zb.proto.blocked, dis: [...document.querySelectorAll('#train [data-tr]')].every(x => x.disabled)})")
        S(f, "__zb.send({zb:'buy',id:'atk'})"); pg.wait_for_timeout(300)
        S(f, "__zb.start('level', __zb.proto.cleared + 1); __zb.G.p.hp = 1e9; __zb.G.t = __zb.G.dur - 0.01; __zb.step(0.05)"); pg.wait_for_timeout(400)
        rb = S(f, "({t: document.getElementById('resTitle').textContent, n: document.getElementById('resNote').textContent, lv: __zb.proto.lv.atk, c: __zb.proto.cleared})"); mb = main_st(pg)
        check(sb and zb0['b'] and zb0['dis'], f'{dn} 只读坏档：经营 saveBlocked={sb}，小游戏也标只读、训练按钮全灰 {zb0}')
        rawb_same = S(pg, f"localStorage.getItem('{SAVE}')") == rawb
        check(rb['lv'] == 0 and rb['c'] == zb0['c'] and mb['z']['lv']['atk'] == 0 and mb['z']['cleared'] == zb0['c'] and mb['coins'] == mb0['coins'] and mb['z'] == mb0['z'] and '通关' not in rb['t'] and '只读' in rb['n'] and rawb_same,
              f'{dn} 只读坏档：硬发训练不扣不升，打满下一关不报通关、提示只读，原档不变 {rb} {mb["coins"]} {mb0["coins"]} {rawb_same}')
        S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(200)
        # 异常档（余额 1e20）：小游戏标记不可花，硬发购买原文一个字节不改
        raw = S(pg, f"localStorage.getItem('{SAVE}')"); d = json.loads(raw); d['coins'] = 1e20
        pg.goto(URL.rsplit('/', 1)[0] + '/zombie/'); S(pg, f"localStorage.setItem('{SAVE}', {json.dumps(json.dumps(d))})")  # 先离开经营页，免得卸载时自动存档盖掉
        pg.goto(URL); pg.wait_for_function("window.__tzz && __tzz.state")
        raw1 = S(pg, f"localStorage.getItem('{SAVE}')"); S(pg, "__tzz.closeModal && __tzz.closeModal(); __tzz.openZombie()"); f = zframe(pg)
        S(f, "__zb.send({zb:'buy',id:'atk'})"); pg.wait_for_timeout(400)
        blk = S(f, "({b: __zb.proto.blocked, w: document.getElementById('walletTxt').textContent})")
        check(blk['b'] and S(pg, f"localStorage.getItem('{SAVE}')") == raw1, f'{dn} 1e20 异常档：小游戏不能花钱，硬发购买存档原文不变 {blk}')
        # 开局角色：经营页 zb:'state' 带 ceo（null = 没人在任）；点开打时锁定，一局里不换，结算原样回传 ceo
        pg.goto(URL.rsplit('/', 1)[0] + '/zombie/'); S(pg, f"localStorage.removeItem('{SAVE}'); localStorage.removeItem('{SAVE}-bak')")
        pg.goto(URL); pg.wait_for_function("window.__tzz && __tzz.state"); S(pg, "__tzz.closeModal && __tzz.closeModal(); __tzz.openZombie()"); f = zframe(pg)
        st = lambda ceo: S(f, f"__zb.onState({{zb:'state', coins:__zb.proto.coins, z:__zb.proto, blocked:false, ceo:{ceo}}})")
        hv = lambda: S(f, "({h: document.getElementById('heroName').textContent, n: document.getElementById('heroNote').textContent, s: document.getElementById('startBtn').disabled, st: __zb.start('level', 1), g: !!__zb.G})")
        st('null'); hn = hv(); st("'otaku'"); hp_ = hv(); S(f, "__zb.setPause(true); document.getElementById('quitBtn').click()"); pg.wait_for_timeout(300); ps = S(f, "__zb.lastSent"); S(f, "document.getElementById('menuBtn').click()"); st("'hacker'"); hx = hv()
        check('派' in hn['n'] and hn['s'] and hn['st'] is False and not hn['g'], f'{dn} ceo=null：提示派 CEO、开不了局 {hn}')
        check(hp_['h'] == '阿宅店长 打僵尸' and '先用 77' in hp_['n'] and not hp_['s'] and hp_['g'], f'{dn} ceo=otaku（技能未做）：先用 77 打法兜底，可以开打 {hp_}')
        check(ps and ps.get('ceo') == 'otaku', f'{dn} 阿宅这局结算回传 ceo=otaku {ps}')
        check(hx['s'] and hx['st'] is False, f'{dn} ceo 非法值按没人在任处理 {hx}')
        st("'c77'"); S(f, "__zb.start('level', 1)"); st("'pearl'"); pg.wait_for_timeout(200)
        lk = S(f, "({g: __zb.G && __zb.G.ceo, over: __zb.G && __zb.G.over})")
        S(f, "__zb.setPause(true); document.getElementById('quitBtn').click()"); pg.wait_for_timeout(300); ls = S(f, "__zb.lastSent")
        check(lk['g'] == 'c77' and not lk['over'] and ls and ls.get('zb') == 'result' and ls.get('ceo') == 'c77', f'{dn} 开打锁定 77：中途在任变珍珠姐也不换人，结算回传 ceo=c77 {lk} {ls}')
        S(f, "__zb.send({zb:'close'})"); pg.wait_for_timeout(200)
        check(not errs, f'{dn} 无 JS 报错 {errs[:3]}')
        c.close()
    b.close()
print(f'passed {passes}, failed {len(fails)}')
sys.exit(1 if fails else 0)
