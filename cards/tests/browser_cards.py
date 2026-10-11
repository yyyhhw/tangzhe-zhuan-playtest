# 卡牌存档/恢复/入口 浏览器验收（Playwright WebKit 模拟视口，非真机）
# 用法：~/.pwvenv/bin/python preview/cards/tests/browser_cards.py [http://127.0.0.1:49951]
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49951'
CARD = BASE + '/preview/cards/ui/index.html?v=card-s1'
fails, passes = [], [0]
def check(ok, msg):
    if ok: passes[0] += 1; print('  ✓', msg)
    else: fails.append(msg); print('  ✗ FAIL', msg)
DIAG = "(async()=>{const m=await import('/preview/cards/ui/app.mjs?v=card-s1');return m.getDiagnostics();})()"
def diag(f): return f.evaluate(DIAG)
def booted(pg):
    pg.wait_for_function("document.getElementById('resume-dialog').open || (document.getElementById('turn-bar').textContent.length>0 && !document.getElementById('turn-bar').textContent.includes('正在读取'))", timeout=15000); pg.wait_for_timeout(300)
def until(f, cond, timeout=20000):
    # 注意：wait_for_function 遇到 async 表达式会把 Promise 当真值直接通过，所以这里在 Python 侧轮询
    import time; end = time.time() + timeout / 1000
    while time.time() < end:
        d = diag(f)
        if cond(d): return d
        f.wait_for_timeout(100)
    raise AssertionError('until timeout: ' + str(diag(f)))
def human_end(pg):
    r0 = diag(pg)['revision']; pg.click('#end-turn')
    until(pg, lambda d: d['active'] == 0 and d['revision'] > r0 and not d['saveBusy'])
SPY = """(()=>{window.__writes=[];const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__writes.push(k);return o.call(this,k,v);};})()"""
with sync_playwright() as p:
    b = p.webkit.launch(); print('webkit', b.version)
    for vw, vh in [(320, 568), (375, 667), (393, 852), (844, 390)]:
        c = b.new_context(viewport={'width': vw, 'height': vh}, has_touch=True); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '/preview/version.json'); pg.evaluate("localStorage.clear()"); pg.goto(CARD); booted(pg)
        d = diag(pg)
        check(d['lastSaved'] and d['lastSaved']['revision'] == 0 and not d['paused'], f'{vw}x{vh} 空存档：开新局并保存第 0 步')
        sw = pg.evaluate("document.documentElement.scrollWidth")
        check(sw <= vw + 1, f'{vw}x{vh} 无横向溢出 scrollWidth={sw}')
        bb = pg.locator('#end-turn').bounding_box()
        check(bb and bb['width'] > 30 and bb['x'] >= 0 and bb['x'] + bb['width'] <= vw + 1, f'{vw}x{vh} 结束回合按钮可点到')
        human_end(pg); d1 = diag(pg)
        pg.reload(); booted(pg)
        vis = pg.evaluate("document.getElementById('resume-dialog').open && !document.getElementById('resume-continue').hidden")
        bb = pg.locator('#resume-continue').bounding_box()
        check(vis and bb and bb['x'] + bb['width'] <= vw + 1, f'{vw}x{vh} 刷新后显示「继续上一局」且可点到')
        d2 = diag(pg)
        check(d2['hash'] == d1['hash'] and d2['revision'] == d1['revision'] and d2['paused'], f'{vw}x{vh} 恢复后 hash/revision 一致且暂停 r{d2["revision"]}')
        pg.click('#resume-continue'); pg.wait_for_timeout(200)
        check(not diag(pg)['paused'], f'{vw}x{vh} 点继续后恢复操作')
        check(not errs, f'{vw}x{vh} 无页面错误 {errs[:2]}')
        c.close()
    # B14 AI 连续性 / B15 旋转 / B15a 切后台 / B16 保存失败 / B17 坏档 / B20 放弃
    c = b.new_context(viewport={'width': 375, 'height': 667}, has_touch=True); pg = c.new_page()
    pg.goto(BASE + '/preview/version.json'); pg.evaluate("localStorage.clear()"); pg.goto(CARD); booted(pg)
    pg.evaluate("localStorage.setItem('tangzhe-save','SENT');localStorage.setItem('tangzhe-preview-save','PSENT');localStorage.setItem('tangzhe-card-save','FSENT')")
    pg.locator('#hand [data-card]').first.click(); pg.wait_for_timeout(100)
    h0 = diag(pg)['hash']; sel0 = diag(pg)['selected']
    pg.set_viewport_size({'width': 667, 'height': 375}); pg.wait_for_timeout(400)
    d = diag(pg); check(sel0 and d['selected'] is None and d['hash'] == h0, 'B15 旋转：选中清空，hash 不变')
    pg.set_viewport_size({'width': 375, 'height': 667}); pg.wait_for_timeout(300)
    check(diag(pg)['hash'] == h0, 'B15 转回竖屏 hash 仍不变')
    # AI 中途切后台
    pg.click('#end-turn'); until(pg, lambda d: d['active'] == 1)
    pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(300); rA = diag(pg)['revision']; pg.wait_for_timeout(3000); dB = diag(pg)
    check(dB['paused'] and not dB['aiScheduled'] and dB['revision'] == rA, f'B15a 后台期间 AI 停止、无新命令 r{rA}')
    pg.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(600); check(diag(pg)['paused'] and diag(pg)['revision'] == rA, 'B15a 回前台仍暂停，等手动继续')
    # B14：AI 回合中途刷新 vs 连续
    saved_rev = diag(pg)['lastSaved']['revision']
    pg.reload(); booted(pg); dr = diag(pg)
    check(dr['revision'] == saved_rev and dr['active'] == 1, f'B14 AI 回合中刷新回到已存最后一步 r{saved_rev}')
    nxt = pg.evaluate("""(async()=>{const c=await import('/preview/cards/cardcore.mjs?v=card-s1');const s=JSON.parse(localStorage.getItem('tangzhe-preview-card-save'));
      let g=c.deserialize(s.game);const want=[];let h=g;for(let i=0;i<4&&h.active===1&&h.phase==='main';i++){const a=c.chooseAIAction(h);want.push(a.commandId);h=c.apply(h,a).game;}
      return {want, hash:c.hashState(h), rev:h.revision};})()""")
    pg.click('#resume-continue')
    until(pg, lambda d: d['active'] == 0 and not d['saveBusy'])
    got = pg.evaluate("""(async()=>{const s=JSON.parse(localStorage.getItem('tangzhe-preview-card-save'));const g=JSON.parse(s.game).game;return g.log.map(x=>x.command.commandId);})()""")
    check(all(x in got for x in nxt['want']), f'B14 恢复后 AI 命令与连续跑一致 want={nxt["want"]} got_tail={got[-6:]}')
    # B16 保存失败
    pg.evaluate("(()=>{window.__failMain=true;const o=Storage.prototype.setItem;Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){if(window.__failMain&&k==='tangzhe-preview-card-save')throw new Error('QuotaExceededError');return o.call(this,k,v);}});})()")
    good = diag(pg)['lastSaved']['revision']
    pg.click('#end-turn'); pg.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    d = diag(pg); txt = pg.inner_text('#save-text')
    check(d['paused'] and d['saveFailure']['kind'] == 'before-commit' and f'存档仍是第 {good} 步' in txt and '已保存' not in txt, f'B16 保存失败立即暂停，提示存档仍是第 {good} 步')
    check(pg.evaluate("document.getElementById('end-turn').disabled") and pg.evaluate("document.getElementById('save-dialog').open"), 'B16 失败状态下不能接着打')
    pg.wait_for_timeout(800); check(diag(pg)['revision'] == d['revision'], 'B16 失败后 AI 不走')
    pg.evaluate("window.__failMain=false"); pg.click('#save-retry'); pg.wait_for_timeout(500)
    d = diag(pg); check(d['saveFailure'] is None and d['lastSaved']['revision'] == d['revision'] and d['paused'], 'B16a 重试成功，仍暂停等继续')
    pg.click('#pause'); until(pg, lambda d: d['active'] == 0 and not d['saveBusy'] and not d['paused'])
    rr = diag(pg)['revision']; pg.reload(); booted(pg); check(diag(pg)['revision'] == rr, f'B16a 刷新回到最新一步 r{rr}')
    pg.click('#resume-continue'); pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const o=Storage.prototype.setItem;Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){if(k==='tangzhe-preview-card-save')throw new Error('Quota');return o.call(this,k,v);}});})()")
    pg.click('#end-turn'); pg.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    pg.reload(); booted(pg); check(diag(pg)['revision'] == rr and '继续上一局' in pg.inner_text('#resume-text'), f'B16b 一直失败直接刷新：回到第 {rr} 步，不是新开局')
    # B17 坏档
    pg.evaluate("localStorage.setItem('tangzhe-preview-card-save','{broken');localStorage.removeItem('tangzhe-preview-card-save-quarantine')"); pg.reload(); booted(pg)
    t = pg.inner_text('#resume-text'); check('存档损坏，已回到最后一次成功存档' in t and '原数据已另存' in t and diag(pg)['revision'] >= 0, 'B17 坏主档 → 回到 -bak 并提示')
    # B20 放弃
    pg.click('#resume-abandon'); check(pg.evaluate("document.getElementById('resume-dialog').open"), 'B20 放弃第一下只要求确认')
    oldbak = pg.evaluate("localStorage.getItem('tangzhe-preview-card-save-bak')")
    pg.click('#resume-abandon'); pg.wait_for_timeout(400)
    check(diag(pg)['revision'] == 0 and diag(pg)['lastSaved']['revision'] == 0 and pg.evaluate("localStorage.getItem('tangzhe-preview-card-save-bak')") == oldbak, 'B20 二次确认后新开并存第 0 步；坏主档不覆盖有效 -bak')
    pg.click('#end-turn'); until(pg, lambda d: d['active'] == 0 and d['revision'] > 0 and not d['saveBusy']); rb = pg.evaluate("[JSON.parse(localStorage.getItem('tangzhe-preview-card-save-bak')).meta.revision, JSON.parse(localStorage.getItem('tangzhe-preview-card-save')).meta.revision]")
    check(rb[0] == rb[1] - 1, f'B20 新局继续后 -bak 跟着变成上一步 {rb}（只有一个存档位）')
    # B16c 主档写入后回读异常 → 主档不确定 → 明确从备份恢复
    good = diag(pg)['lastSaved']['revision']
    pg.evaluate("""(()=>{window.__rb=true;const os=Storage.prototype.setItem,og=Storage.prototype.getItem;
      Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){const r=os.call(this,k,v);if(window.__rb&&k==='tangzhe-preview-card-save')window.__rbArm=true;return r;}});
      Object.defineProperty(Storage.prototype,'getItem',{configurable:true,writable:true,value:function(k){if(window.__rbArm&&k==='tangzhe-preview-card-save')throw new Error('read fail');return og.call(this,k);}});})()""")
    pg.click('#end-turn'); pg.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    t = pg.inner_text('#save-text'); d = diag(pg)
    check(d['saveFailure']['kind'] == 'rollback-failed' and '主档状态不确定' in t and '已验证的备份可以恢复' in t and '存档仍是第' not in t and '已保存' not in t, f'B16c 回读异常：提示主档不确定、备份可恢复，不报旧步数 「{t}」')
    check(pg.evaluate("document.getElementById('save-retry').hidden") and pg.inner_text('#save-restore') == '从备份恢复', 'B16c 只给「从备份恢复」，不给重试')
    newer = pg.evaluate("window.__rbArm=false;window.__rb=false;JSON.parse(localStorage.getItem('tangzhe-preview-card-save')).meta.revision")
    pg.click('#save-restore'); pg.click('#save-restore'); pg.wait_for_timeout(500)
    d = diag(pg); main = pg.evaluate("JSON.parse(localStorage.getItem('tangzhe-preview-card-save')).meta.revision")
    check(newer > good and d['saveFailure']['kind'] == 'conflict' and main == newer and '主档已能读取' in pg.inner_text('#save-text'), f'B16c 主档当时读不出：恢复不写，主档已可读且有效时提示重新读取（主档 r{newer} 不被备份 r{good} 覆盖）')
    pg.click('#save-restore'); pg.wait_for_function("document.getElementById('resume-dialog').open", timeout=10000)
    check(diag(pg)['revision'] == newer, f'B16c 重新读取得到 r{newer}')
    pg.click('#resume-continue'); human_end(pg); check(diag(pg)['saveFailure'] is None, 'B16c 读回后继续打、正常保存')
    s = pg.evaluate("[localStorage.getItem('tangzhe-save'),localStorage.getItem('tangzhe-preview-save'),localStorage.getItem('tangzhe-card-save')]")
    check(s == ['SENT', 'PSENT', 'FSENT'], 'A10 浏览器端经营主档 / preview 主档 / 正式卡牌键逐字节不变')
    c.close()
    # B18 两个标签页
    c = b.new_context(viewport={'width': 375, 'height': 667}); a = c.new_page(); a.goto(BASE + '/preview/version.json'); a.evaluate("localStorage.clear()"); a.goto(CARD); booted(a)
    bpg = c.new_page(); bpg.goto(CARD); booted(bpg); bpg.click('#resume-continue')
    a.reload(); booted(a); a.click('#resume-continue'); human_end(a)
    bpg.click('#end-turn'); bpg.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    check(bpg.evaluate("(async()=>{const d=(await import('/preview/cards/ui/app.mjs?v=card-s1')).getDiagnostics();return d.saveFailure&&d.saveFailure.kind;})()") == 'conflict', 'B18 两个标签页：后写的一方被拒并提示')
    # B18b A 回滚失败选备份 → B 保存新进度 → A 提交恢复：必须报冲突，B 的新档保留
    a.reload(); booted(a); a.click('#resume-continue')
    a.evaluate("""(()=>{window.__rb=true;const os=Storage.prototype.setItem,og=Storage.prototype.getItem;
      Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){const r=os.call(this,k,v);if(window.__rb&&k==='tangzhe-preview-card-save')window.__rbArm=true;return r;}});
      Object.defineProperty(Storage.prototype,'getItem',{configurable:true,writable:true,value:function(k){if(window.__rbArm&&k==='tangzhe-preview-card-save')throw new Error('read fail');return og.call(this,k);}});})()""")
    a.click('#end-turn'); a.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    check(diag(a)['saveFailure']['kind'] == 'rollback-failed', 'B18b A 回滚失败')
    a.evaluate("window.__rbArm=false;window.__rb=false"); a.click('#save-restore')   # A 选了备份（第一下）
    bpg.reload(); booted(bpg); bpg.click('#resume-continue'); human_end(bpg)
    mainB = a.evaluate("localStorage.getItem('tangzhe-preview-card-save')"); revB = diag(bpg)['revision']
    a.click('#save-restore'); a.wait_for_timeout(600)
    d = diag(a)
    check(d['saveFailure'] and d['saveFailure']['kind'] == 'conflict' and a.evaluate("localStorage.getItem('tangzhe-preview-card-save')") == mainB, f'B18b A 提交恢复报冲突，B 的新档 r{revB} 没被覆盖')
    a.click('#save-restore'); a.wait_for_function("document.getElementById('resume-dialog').open", timeout=10000)
    check(diag(a)['revision'] == revB, f'B18b A 重新读取存档后拿到 B 的 r{revB}')
    # B18c A 主档写入失败且之后读失败（主档/备份都没变）→ B 保存 r2（备份仍是同一份）→ A 恢复：B 的新档始终保留
    a.click('#resume-continue')
    a.evaluate("""(()=>{window.__f2=true;const os=Storage.prototype.setItem,og=Storage.prototype.getItem;
      Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){if(window.__f2&&k==='tangzhe-preview-card-save'){window.__arm2=true;throw new Error('Quota');}return os.call(this,k,v);}});
      Object.defineProperty(Storage.prototype,'getItem',{configurable:true,writable:true,value:function(k){if(window.__arm2&&k==='tangzhe-preview-card-save')throw new Error('read fail');return og.call(this,k);}});})()""")
    a.click('#end-turn'); a.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    check(diag(a)['saveFailure']['kind'] == 'rollback-failed', 'B18c A 写失败且读失败 → 主档不确定')
    a.click('#save-restore'); a.click('#save-restore'); a.wait_for_timeout(400)
    check(diag(a)['saveFailure']['kind'] == 'unreadable', 'B18c 主档还读不出：恢复不写，保持暂停')
    bakA = a.evaluate("window.__f2=false;window.__arm2=false;localStorage.getItem('tangzhe-preview-card-save-bak')")
    # B 只保存一次（结束回合），写完主档立刻切后台暂停，AI 不再继续保存
    bpg.evaluate("""(()=>{window.__once=true;const os=Storage.prototype.setItem;
      Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){const r=os.call(this,k,v);if(window.__once&&k==='tangzhe-preview-card-save'){window.__once=false;Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));}return r;}});})()""")
    bpg.click('#end-turn'); until(bpg, lambda d: d['revision'] > revB and not d['saveBusy']); bpg.wait_for_timeout(800)
    mainB2 = bpg.evaluate("localStorage.getItem('tangzhe-preview-card-save')"); revB2 = diag(bpg)['revision']
    check(bpg.evaluate("localStorage.getItem('tangzhe-preview-card-save-bak')") == bakA, 'B18c 场景成立：B 保存后备份原文没变')
    for i in range(2):
        a.click('#save-restore'); a.wait_for_timeout(400)
        if diag(a)['saveFailure'] and diag(a)['saveFailure']['kind'] != 'conflict' and not a.evaluate("document.getElementById('save-dialog').open"): break
    check(a.evaluate("localStorage.getItem('tangzhe-preview-card-save')") == mainB2 and diag(a)['saveFailure']['kind'] == 'conflict', f'B18c A 再点恢复：报重新读取，B 的 r{revB2} 始终保留')
    a.click('#save-restore'); a.wait_for_function("document.getElementById('resume-dialog').open", timeout=10000)
    check(diag(a)['revision'] == revB2, f'B18c A 重新读取拿到 B 的 r{revB2}')
    # B18d 主档恢复可读但是更高 dataVersion：只读、提示不兼容，不走备份覆盖确认
    a.click('#resume-continue'); until(a, lambda d: d['active'] == 0 and not d['saveBusy'] and not d['aiScheduled'])
    a.evaluate("""(()=>{window.__f3=true;const os=Storage.prototype.setItem,og=Storage.prototype.getItem;
      Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){if(window.__f3&&k==='tangzhe-preview-card-save'){window.__arm3=true;throw new Error('Quota');}return os.call(this,k,v);}});
      Object.defineProperty(Storage.prototype,'getItem',{configurable:true,writable:true,value:function(k){if(window.__arm3&&k==='tangzhe-preview-card-save')throw new Error('read fail');return og.call(this,k);}});})()""")
    a.click('#end-turn'); a.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    fut = '{"ns":"tangzhe-card-save","dataVersion":2,"slotRev":99,"game":"newer"}'
    a.evaluate("f=>{window.__f3=false;window.__arm3=false;localStorage.setItem('tangzhe-preview-card-save',f)}", fut)
    a.click('#save-restore'); a.click('#save-restore'); a.wait_for_timeout(400)
    d = diag(a); t = a.inner_text('#save-text')
    check(d['saveFailure']['kind'] == 'readonly' and d['readOnly'] and '版本不兼容' in t and a.inner_text('#save-restore') == '重新读取存档', f'B18d future 主档：只读、提示版本不兼容，不出「用备份覆盖主档」 「{t}」')
    a.click('#save-restore'); a.click('#save-restore'); a.wait_for_function("document.getElementById('resume-dialog').open", timeout=10000)
    check(a.evaluate("localStorage.getItem('tangzhe-preview-card-save')") == fut and '本页不会写存档' in a.inner_text('#resume-text'), 'B18d future 主档原样保留（dataVersion=2 没被改成 1），重新读取仍只读')
    a.evaluate("m=>localStorage.setItem('tangzhe-preview-card-save',m)", mainB2)
    c.close()
    # C 入口和父子页
    c = b.new_context(**p.devices['iPhone 15']); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("""if(window===window.top){window.__parentReads=[];const g=Storage.prototype.getItem;Storage.prototype.getItem=function(k){window.__parentReads.push(k);return g.call(this,k);};}
      else {window.__writes=[];const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__writes.push(k);return o.call(this,k,v);};}""")
    pg.goto(BASE + '/preview/version.json'); pg.evaluate("localStorage.clear()")
    pg.goto(BASE + '/preview/index.html'); pg.wait_for_function("window.__tzz && __tzz.state", timeout=20000); pg.wait_for_timeout(500)
    pg.evaluate("__tzz.earn(5e10); for(const i of [1,2,3]) __tzz.act('open', String(i)); __tzz.persist(); __tzz.setTab('shop'); __tzz.switchShop(2); __tzz.renderTab()"); pg.wait_for_timeout(300)
    check(pg.locator('.cards-card [data-act=cards]').count() == 1 and pg.evaluate("document.querySelector('.cards-card').previousElementSibling.textContent.trim()") == '小游戏', 'C21 书店页底部有「卡牌对战」入口')
    pg.evaluate("__tzz.switchShop(0); __tzz.renderTab()"); zc = pg.locator('.zb-card').count(); pg.evaluate("__tzz.switchShop(3); __tzz.renderTab()"); tc = pg.locator('.td-card').count()
    check(zc == 1 and tc == 1 and pg.locator('.cards-card').count() == 0, 'C21 打僵尸 / 塔防入口不变，其他店没有卡牌入口')
    pg.evaluate("__tzz.switchShop(2); __tzz.renderTab()"); pg.wait_for_timeout(200)
    def frame():
        for _ in range(100):
            for f in pg.frames:
                if '/cards/ui/' in f.url:
                    try:
                        if f.evaluate("document.getElementById('turn-bar').textContent.length>0"): return f
                    except Exception: pass
            pg.wait_for_timeout(100)
    def tapCards():
        for _ in range(10):
            if not pg.evaluate("!!document.querySelector('.modal:not(.hidden) #mOk')"): break
            pg.evaluate("document.querySelector('.modal:not(.hidden) #mOk').click()"); pg.wait_for_timeout(250)
        pg.evaluate("__tzz.switchShop(2); __tzz.renderTab(); document.querySelector('.cards-card [data-act=cards]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150)
        pg.locator('.cards-card [data-act=cards]').tap()
    muted0 = pg.evaluate("!!__tzz.state.muted")
    tapCards(); f = frame(); pg.wait_for_timeout(600)
    check(f is not None and pg.evaluate("__tzz.cardsOpen") and diag(f)['ported'] and diag(f)['embed'], 'C 打开全屏 iframe，端口已连上')
    check(diag(f)['muted'] == muted0, f'C24 打开时子页收到静音状态 {muted0}')
    pg.evaluate("document.getElementById('mute').click()"); pg.wait_for_timeout(300)
    check(diag(f)['muted'] == (not muted0), 'C24 打开状态下切换静音，子页跟着变')
    pg.evaluate("document.getElementById('mute').click()"); pg.wait_for_timeout(300)
    f.click('#end-turn'); until(f, lambda d: d['active'] == 0 and d['revision'] > 0 and not d['saveBusy'])
    rv = diag(f)['revision']
    w = f.evaluate("window.__writes")
    check(w and all(k.startswith('tangzhe-preview-card-save') for k in w), f'C23 卡牌页只写卡牌键 {sorted(set(w))}')
    # C25b 退出时保存失败 → 选「回到最后成功档」→ 继续打，下一次保存不能把 iframe 关掉
    f.evaluate("(()=>{window.__f=true;const o=Storage.prototype.setItem;Object.defineProperty(Storage.prototype,'setItem',{configurable:true,writable:true,value:function(k,v){if(window.__f&&k==='tangzhe-preview-card-save')throw new Error('Quota');return o.call(this,k,v);}});})()")
    f.click('#end-turn'); f.wait_for_function("document.getElementById('save-dialog').open", timeout=10000)
    pg.evaluate("__tzz.requestCloseCards()"); pg.wait_for_timeout(300)
    check(diag(f)['closing'] and not f.evaluate("document.getElementById('save-exit').hidden") and pg.evaluate("__tzz.cardsOpen"), 'C25b 退出时保存失败：弹窗给「仍要退出」，浮层还开着')
    f.evaluate("window.__f=false"); f.click('#save-restore'); f.click('#save-restore'); f.wait_for_function("document.getElementById('resume-dialog').open", timeout=10000)
    check(not diag(f)['closing'] and not pg.evaluate("__tzz.cardsCloseTimer"), 'C25b 选恢复后 closing 清掉，父页关闭计时器也清掉')
    f.click('#resume-continue'); r1 = diag(f)['revision']; f.click('#end-turn')
    until(f, lambda d: d['active'] == 0 and d['revision'] > r1 and not d['saveBusy']); pg.wait_for_timeout(3300)
    check(pg.evaluate("__tzz.cardsOpen") and diag(f)['saveFailure'] is None, 'C25b 继续打并保存成功后 iframe 仍开着（3 秒后也没被强制关）')
    rv = diag(f)['revision']
    f.click('#exit-embed'); pg.wait_for_timeout(500)
    check(pg.evaluate("document.getElementById('cardsOverlay').classList.contains('hidden') && !__tzz.cardsOpen"), 'C23 返回书店：浮层关闭')
    pr = pg.evaluate("window.__parentReads.filter(k=>k.startsWith('tangzhe-preview-card-save')||k.startsWith('tangzhe-card-save'))")
    check(pr == [], f'C22 父页没读任何卡牌键 {pr[:3]}')
    tapCards(); f = frame(); pg.wait_for_timeout(500)
    check(f.evaluate("document.getElementById('resume-dialog').open") and diag(f)['revision'] == rv, f'C 再进入：显示继续上一局 r{rv}')
    pg.evaluate("__tzz.requestCloseCards()"); pg.wait_for_timeout(600)
    check(not pg.evaluate("__tzz.cardsOpen") and not pg.evaluate("__tzz.cardsCloseTimer"), 'C25 requestClose：子页回 close，父页计时器已清')
    for i in range(5):
        tapCards(); frame(); pg.wait_for_timeout(200); pg.evaluate("__tzz.closeCards()"); pg.wait_for_timeout(150)
    check(not pg.evaluate("__tzz.cardsOpen") and not pg.evaluate("__tzz.cardsCloseTimer") and pg.evaluate("document.getElementById('cardsFrame').src") == 'about:blank' and not [x for x in pg.frames if '/cards/ui/' in x.url], 'C 重复进入 / 关闭 5 次：没有残留 iframe 或计时器')
    check(not errs, f'C 无页面错误 {errs[:2]}')
    # C26 当前店是书店 → 刷新恢复：主页面正常启动、入口在
    pg.evaluate("__tzz.switchShop(2); __tzz.setTab('shop'); __tzz.persist()"); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_function("window.__tzz && __tzz.state", timeout=20000); pg.wait_for_timeout(800)
    check(not errs and pg.locator('.cards-card [data-act=cards]').count() == 1, f'C26 当前店为书店时刷新：无 ReferenceError、入口在 {errs[:2]}')
    c.close(); b.close()
print(f'\n{passes[0]} passed, {len(fails)} failed'); sys.exit(1 if fails else 0)
