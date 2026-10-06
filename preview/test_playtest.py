# 躺着也能赚 — 手机端端到端测试（WebKit = iPhone Safari 内核）
# 用法：先在本目录起静态服务（python3 -m http.server 49710），再 .pwvenv/bin/python test_playtest.py [URL]
import sys, json, os
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49710/index.html'
KEY = 'tangzhe-preview-save'  # 预览专用存档键（11r 起）
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shots')
os.makedirs(SHOTS, exist_ok=True)
results = []
def check(cond, msg):
    results.append((bool(cond), msg)); print(('  ✓ ' if cond else '  ✗ ') + msg)
def S(pg, expr): return pg.evaluate(expr)
def st(pg): return pg.evaluate("JSON.parse(JSON.stringify(__tzz.state))")
def modal_visible(pg): return pg.evaluate("!document.querySelector('#modal').classList.contains('hidden')")
def close_modals(pg, n=6):
    for _ in range(n):
        if not modal_visible(pg): return
        for sel in ['#mOk', '#pvNo', '#mNo', '#claim']:
            if pg.locator(sel).count():
                pg.locator(sel).first.click(); pg.wait_for_timeout(250); break
        else: return

with sync_playwright() as p:
    b = p.webkit.launch()
    dev = p.devices['iPhone 15']
    ctx = b.new_context(**dev)
    pg = ctx.new_page(); errs = []
    def hook(page, tag):
        page.on('console', lambda m: m.type == 'error' and errs.append(f'{tag} {m.type}: {m.text}'))
        page.on('pageerror', lambda e: errs.append(f'{tag} pageerror: {e}'))
        page.on('response', lambda r: r.status >= 400 and errs.append(f'{tag} {r.status} {r.url}'))
    hook(pg, 'p1')
    print('== 1. 新开局 ==')
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(900)
    check(modal_visible(pg) and '欢迎' in pg.inner_text('#mpanel'), '新玩家看到开场说明')
    pg.screenshot(path=f'{SHOTS}/01_intro.png')
    pg.click('#mOk'); pg.wait_for_timeout(200)
    s0 = st(pg)
    check(s0['v'] == 3 and s0['ceos']['c77']['at'] == 0 and s0['shops'][0]['emp'] == 0, '存档 v3：77 坐镇烧烤摊、员工未雇')
    check(S(pg, "__tzz.E.baseRate(__tzz.state)") == 0, '没员工不自动赚')
    box = pg.locator('#scene').bounding_box()
    for _ in range(25): pg.mouse.click(box['x'] + box['width'] * 0.4, box['y'] + box['height'] * 0.55); pg.wait_for_timeout(25)
    s1 = st(pg); check(s1['taps'] == 25 and s1['coins'] >= 25, f"手点 25 下 → {round(s1['coins'],1)} 金")
    pg.evaluate("__tzz.state.coins = Math.max(__tzz.state.coins, 60)"); pg.wait_for_timeout(300)
    pg.locator('[data-act="hire"]').click(); pg.wait_for_timeout(300)
    check(st(pg)['shops'][0]['emp'] == 1 and S(pg, "__tzz.E.baseRate(__tzz.state)") > 0, '雇阿炭后开始自动赚')
    c_a = S(pg, '__tzz.state.coins'); pg.wait_for_timeout(2100); c_b = S(pg, '__tzz.state.coins')
    check(c_b > c_a, f'在线自动产出 {round(c_a,2)} → {round(c_b,2)}')
    # 店铺 / 员工 / CEO 分开升级
    pg.evaluate("__tzz.state.coins = 1e6"); pg.wait_for_timeout(300)
    pg.locator('[data-act="up"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-act="emp"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-act="ceoUp"]').click(); pg.wait_for_timeout(150)
    s2 = st(pg); check(s2['shops'][0]['lv'] == 2 and s2['shops'][0]['emp'] == 2 and s2['ceos']['c77']['lv'] == 2, '店铺 Lv2 / 员工 Lv2 / CEO Lv2 分开升级')
    pg.evaluate("__tzz.state.shops[0].lv = 9; __tzz.renderTab()"); pg.wait_for_timeout(200)
    pg.locator('[data-act="up"]').click(); pg.wait_for_timeout(500)
    check(st(pg)['shops'][0]['lv'] == 10, '冲 Lv10 里程碑')
    pg.screenshot(path=f'{SHOTS}/02_milestone.png')
    print('== 2. 开店 + CEO 解锁 ==')
    pg.locator('#shopTabs [data-shop="1"]').click(); pg.wait_for_timeout(200)
    pg.locator('[data-act="open"]').click(); pg.wait_for_timeout(500)
    check(modal_visible(pg) and '珍珠姐' in pg.inner_text('#mpanel'), '开奶茶店 → 珍珠姐加入弹窗')
    close_modals(pg)
    check(st(pg)['ceos']['pearl']['at'] == 1, '珍珠姐坐镇奶茶店')
    pg.evaluate("""(()=>{const s=__tzz.state, E=__tzz.E; s.coins=1e13; E.hireEmp(s,1); E.openShop(s,2); E.hireEmp(s,2); E.openShop(s,3); s.shops[3].lv=24; __tzz.persist(); __tzz.switchShop(3); __tzz.renderTab();})()""")
    pg.wait_for_timeout(300); close_modals(pg)
    check(not S(pg, "__tzz.E.gachaUnlocked(__tzz.state)"), '科技公司没雇员工前盲盒不开放')
    pg.locator('[data-act="hire"]').click(); pg.wait_for_timeout(400)
    check(modal_visible(pg) and '盲盒' in pg.inner_text('#mpanel'), '雇到科技公司员工 → 盲盒开放弹窗')
    close_modals(pg)
    pg.evaluate("__tzz.state.coins = 1e13"); pg.wait_for_timeout(200)
    pg.locator('[data-act="amt"][data-arg="1"]').click(); pg.wait_for_timeout(100)
    pg.locator('[data-act="up"]').click(); pg.wait_for_timeout(500)
    check(modal_visible(pg) and '火箭老板' in pg.inner_text('#mpanel'), '科技公司 Lv25 → 火箭老板加入')
    close_modals(pg)
    check(st(pg)['ceos']['rocket']['at'] == 3, '火箭老板坐镇科技公司')
    pg.screenshot(path=f'{SHOTS}/03_tech.png')
    print('== 3. 调任预览 ==')
    pg.locator('#bottomNav [data-tab="ceo"]').click(); pg.wait_for_timeout(250)
    stage_ceo = S(pg, "getComputedStyle(document.getElementById('stage')).display")
    compact_ceo = S(pg, "!document.getElementById('compactHead').classList.contains('hidden')")
    check(stage_ceo == 'none' and compact_ceo, 'CEO 页隐藏店景、显示紧凑页头（谁在管哪家店）')
    pg.screenshot(path=f'{SHOTS}/04_ceo_tab.png')
    before = st(pg)
    pg.locator('[data-act="assign"][data-arg="rocket"]').click(); pg.wait_for_timeout(300)
    check(pg.locator('#sheet .pick').count() == 5, '调任选择：4 家店 + 休息')
    pg.screenshot(path=f'{SHOTS}/05_pick.png')
    pg.locator('#sheet [data-pick="0"]').click(); pg.wait_for_timeout(400)
    txt = pg.inner_text('#mpanel')
    check('交换任职预览' in txt and '全街每秒' in txt and '火箭烤炉' in txt and '麻辣服务器' in txt, '预览：每店+全街 调前→调后，列出两个跨行事件')
    check(pg.locator('.pv-table .down').count() >= 2 and pg.locator('.pv-table tr.total .down').count() == 1, '预览：变少的标红（含全街合计）')
    check('8 小时 → 10 小时' in txt, '预览显示离线上限变化')
    check(pg.inner_text('#pvYes') == '交换任职' and pg.locator('.swap-box').count() == 1 and '烧烤摊' in pg.inner_text('.swap-box') and '科技公司' in pg.inner_text('.swap-box') and '/秒' in pg.inner_text('.swap-box'), '目标店有 CEO：按钮「交换任职」+ 两家店 $/s 变化')
    pg.screenshot(path=f'{SHOTS}/06_preview.png')
    pg.click('#pvNo'); pg.wait_for_timeout(250)
    # 涨绿：让珍珠姐先休息，再预览她回奶茶店
    pg.evaluate("__tzz.state.ceos.pearl.at = -1; __tzz.showPreview('pearl', 1)"); pg.wait_for_timeout(300)
    upn = pg.locator('.pv-table .up').count()
    if upn < 2: print('DEBUG', pg.inner_text('#mpanel')[:400])
    check(upn >= 1, '预览：变多的标绿（空缺店派 CEO）')
    pg.click('#pvNo'); pg.wait_for_timeout(200); pg.evaluate("__tzz.state.ceos.pearl.at = 1")
    check(st(pg)['ceos'] == before['ceos'], '「再想想」不改任何安排')
    pg.locator('[data-act="assign"][data-arg="rocket"]').click(); pg.wait_for_timeout(300)
    pg.locator('#sheet [data-pick="0"]').click(); pg.wait_for_timeout(300)
    shops_before = st(pg)['shops']
    pg.click('#pvYes'); pg.wait_for_timeout(600)
    s3 = st(pg)
    check(s3['shops'] == shops_before, '换招牌不重置店铺进度（等级/员工）')
    check(s3['ceos']['rocket']['at'] == 0 and s3['ceos']['c77']['at'] == 3, '确认后火箭老板↔77 互换')
    check(S(pg, "__tzz.E.signOf(__tzz.state,0).name") == '老马烧烤', '招牌换成「老马烧烤」')
    ch = pg.inner_text('#compactHead')
    check('老马烧烤' in ch and '77烧烤店' not in ch, '交换任职后顶部「谁在管哪家店」同步刷新')
    check(modal_visible(pg) and '火箭烤炉' in pg.inner_text('#mpanel') and pg.locator('#mpanel .comic.two .panel4').count() == 2 and '香味先起飞了' in pg.inner_text('#mpanel') and '占位' not in pg.inner_text('#mpanel'), '跨行事件漫画：火箭烤炉（两格定稿）')
    pg.wait_for_function("(()=>{const i=document.querySelector('#mpanel .cross-art img'); return i&&i.complete})()", timeout=8000)
    ci = S(pg, "(()=>{const i=document.querySelector('#mpanel .cross-art img'); return i?{nw:i.naturalWidth,src:i.getAttribute('src'),art:!!document.querySelector('#mpanel .cross-wrap.has-art')}:null})()")
    check(ci and ci['nw'] == 480 and 'cross_rocket_bbq.webp' in ci['src'] and ci['art'], f'11z 首次调任触发：火箭烤炉弹窗显示整图（480 宽）{ci}')
    pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/07_comic.png')
    pg.click('#mOk'); pg.wait_for_timeout(400)
    check(modal_visible(pg) and '麻辣服务器' in pg.inner_text('#mpanel'), '第二个跨行漫画：麻辣服务器')
    pg.wait_for_function("(()=>{const i=document.querySelector('#mpanel .cross-art img'); return i&&i.complete})()", timeout=8000)
    check(S(pg, "(()=>{const i=document.querySelector('#mpanel .cross-art img'); return !!i&&i.naturalWidth===480&&i.getAttribute('src').includes('cross_c77_tech.webp')})()"), '11z 首次调任触发：麻辣服务器弹窗显示整图')
    close_modals(pg)
    check(S(pg, "__tzz.E.offlineCap(__tzz.state)") == 36000, '77 在科技公司：离线上限 10 小时')
    # 让 77 休息：下方卡片和顶部「谁在管哪家店」要同时显示休息中
    pg.evaluate("__tzz.showPreview('c77', -1)"); pg.wait_for_timeout(300); pg.click('#pvYes'); pg.wait_for_timeout(500); close_modals(pg)
    card77 = pg.evaluate("[...document.querySelectorAll('#compactHead .ch-card')].map(e=>e.innerText).find(t=>t.includes('77'))") or ''
    check(st(pg)['ceos']['c77']['at'] == -1 and '休息中' in card77 and '休息中' in pg.inner_text('#tabBody'), '77 休息后顶部和下方卡片同步显示「休息中」')
    pg.screenshot(path=f'{SHOTS}/07b_rest_sync.png')
    pg.evaluate("__tzz.showPreview('c77', 3)"); pg.wait_for_timeout(300); pg.click('#pvYes'); pg.wait_for_timeout(500); close_modals(pg)
    card77 = pg.evaluate("[...document.querySelectorAll('#compactHead .ch-card')].map(e=>e.innerText).find(t=>t.includes('77'))") or ''
    check(st(pg)['ceos']['c77']['at'] == 3 and '休息中' not in card77, '77 调回科技公司，顶部同步更新')
    print('== 3a. CEO×店铺 任职形象 ==')
    close_modals(pg); pg.evaluate("__tzz.renderTab()"); pg.wait_for_timeout(200)
    g = '.job-gal[data-ceo="c77"]'
    check(pg.locator('.job-gal').count() == 4, 'CEO 页每位已加入 CEO 都有任职形象区')
    check(pg.locator(g + ' .job-chip').count() == 4 and pg.locator(g + ' .job-chip.lock').count() == 0 and '科技公司' in pg.inner_text(g + ' .job-chip.on') and '现任' in pg.inner_text(g + ' .job-chip.on'), '77 默认显示现任科技公司，4 家已开店都能点')
    src0 = pg.get_attribute(g + ' .job-pic img', 'src') or ''
    check('现任形象' in pg.inner_text(g + ' .job-cap') and 'job_c77_tech.webp' in src0 and pg.locator(g + ' .job-wip').count() == 0, '77 现任科技公司：显示 job_c77_tech 大图，不再标「画师赶稿中」')
    m16 = S(pg, "(()=>{const ids=['c77','pearl','otaku','rocket'], sh=['bbq','tea','book','tech'], bad=[]; ids.forEach((id,ci)=>sh.forEach((x,i)=>{const u=__tzz.jobURL(id,i), want = ci===i ? 'art/ceo_'+id+'.webp' : 'art/job_'+id+'_'+x+'.webp'; if(!u.startsWith(want)) bad.push(id+'_'+x+'→'+u);})); return bad;})()")
    check(m16 == [], '16 种任职形象 ID 对应正确（本行 4 张用 ceo_<id>，其余 12 张用 job_<CEO>_<店>）' + (' 错：' + str(m16) if m16 else ''))
    ld = S(pg, "Promise.all(['c77','pearl','otaku','rocket'].flatMap(id=>[0,1,2,3].map(i=>new Promise(r=>{const im=new Image(); im.onload=()=>r(im.naturalWidth>=400?null:id+i+' 太小'); im.onerror=()=>r(id+':'+i+' 加载失败'); im.src=__tzz.jobURL(id,i);})))).then(a=>a.filter(Boolean))")
    check(ld == [], '16 张任职大图都能加载（≥400px）' + (' 错：' + str(ld) if ld else ''))
    pg.screenshot(path=f'{SHOTS}/07c_job_gallery.png')
    pg.locator(g + ' [data-act="jobView"][data-arg="c77:0"]').click(); pg.wait_for_timeout(250)
    src = pg.get_attribute(g + ' .job-pic img', 'src') or ''
    check('烧烤摊' in pg.inner_text(g + ' .job-chip.on') and 'ceo_c77.webp' in src and pg.locator(g + ' .job-wip').count() == 0 and '换店预览' in pg.inner_text(g + ' .job-cap'), '点烧烤摊：切到 77 的本行形象（已有图，不标赶稿）')
    check(st(pg)['ceos']['c77']['at'] == 3, '看别家形象不改任职')
    pg.locator(g + ' .job-pic').click(); pg.wait_for_timeout(300)
    check(modal_visible(pg) and pg.locator('#mpanel .job-big img').count() == 1 and '77 × 烧烤摊' in pg.inner_text('#mpanel'), '点图放大看大图')
    close_modals(pg)
    check(S(pg, "(()=>{delete __tzz.JOB_ART.c77_tech; const u=__tzz.jobURL('c77',3); __tzz.JOB_ART.c77_tech=1; return u;})()").startswith('art/ceo_c77.webp') and S(pg, "__tzz.jobURL('c77',3)").startswith('art/job_c77_tech.webp'), '未登记的组合退回本行图，登记后按 job_<CEO>_<店>.webp 加载')
    for (cid, arg, want) in [('pearl', 'pearl:3', 'job_pearl_tech'), ('otaku', 'otaku:1', 'job_otaku_tea'), ('rocket', 'rocket:0', 'job_rocket_bbq')]:
        gg = f'.job-gal[data-ceo="{cid}"]'; before = st(pg)['ceos'][cid]['at']
        pg.locator(gg + f' [data-act="jobView"][data-arg="{arg}"]').click(); pg.wait_for_timeout(250)
        s2 = pg.get_attribute(gg + ' .job-pic img', 'src') or ''
        nw = S(pg, f"(()=>{{const im=document.querySelector('{gg} .job-pic img'); return im && im.complete ? im.naturalWidth : -1;}})()")
        check(want in s2 and st(pg)['ceos'][cid]['at'] == before, f'{cid} 点 {arg.split(":")[1]} 号店切到 {want}，任职不变')
    pg.screenshot(path=f'{SHOTS}/07d_job_gallery_full.png')
    check(S(pg, "(()=>{const s=__tzz.state.ceos.c77; s.at=2; const v=__tzz.jobShown('c77'); s.at=3; return v;})()") == 2, '调任后默认显示新任职形象')
    check(S(pg, "(()=>{__tzz.state.shops[2].open=false; __tzz.renderTab(); const n=document.querySelectorAll('.job-gal[data-ceo=\"c77\"] .job-chip.lock').length; __tzz.state.shops[2].open=true; __tzz.renderTab(); return n;})()") == 1, '没开的店锁着不能看')
    pg.locator('#bottomNav [data-tab="shop"]').click(); pg.locator('#shopTabs [data-shop="0"]').click(); pg.wait_for_timeout(1300)
    pg.screenshot(path=f'{SHOTS}/08_laoma_bbq.png')
    print('== 3b. 大客户团单 / 漫画杯套 ==')
    pg.evaluate("__tzz.forceBig()"); pg.wait_for_timeout(1400)
    bg = S(pg, "__tzz.order && {x:__tzz.order.x, y:__tzz.order.y, p:__tzz.order.progress, pay:__tzz.order.payout}")
    check(bg is not None and bg['p'] is not None and bg['p'] >= 0, '大客户团单出现（可见进度）')
    pg.screenshot(path=f'{SHOTS}/08b_big_customer.png')
    c_before = S(pg, '__tzz.state.coins'); pay = bg and bg.get('pay') or 0
    if bg:
        pg.mouse.click(box['x'] + bg['x'], box['y'] + bg['y']); pg.wait_for_timeout(200)
        for _ in range(8):
            pg.mouse.click(box['x'] + bg['x'], box['y'] + bg['y']); pg.wait_for_timeout(80)
        pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const o=__tzz.order; if(o){o.progress=1;}})()"); pg.wait_for_timeout(500)
    s_big = st(pg)
    check(s_big['bigCustomers'] >= 1 and S(pg, '__tzz.order') is None, '团单完成后大客户计数 +1，订单清掉')
    check(S(pg, '__tzz.state.coins') >= c_before + pay * 0.95 - 1, '团单收入一次性入账（≈旧 ×5 多出来的部分）')
    check(S(pg, '!(__tzz.state.boostEnd > Date.now())'), '不再有持续 ×5 加成')
    pg.evaluate("(()=>{const s=__tzz.state; __tzz.E.assignCeo(s,'otaku',1); s.shops[1].lv=24; s.coins=1e13; __tzz.switchShop(1); __tzz.setTab('shop');})()"); pg.wait_for_timeout(300)
    close_modals(pg)
    c_b = S(pg, '__tzz.state.coins'); cost = S(pg, '__tzz.E.upgradeCost(1, 24)')
    pg.locator('[data-act="amt"][data-arg="1"]').click(); pg.locator('[data-act="up"]').click(); pg.wait_for_timeout(700)
    pg.screenshot(path=f'{SHOTS}/08c_manga_cup_milestone.png')
    check(S(pg, '__tzz.state.shops[1].lv') == 25 and S(pg, '__tzz.state.coins') > c_b - cost, '漫画杯套：阿宅在奶茶店冲 Lv25 → 分镜特效 + 小红包')
    pg.evaluate("__tzz.E.assignCeo(__tzz.state,'pearl',1); __tzz.persist()"); close_modals(pg)
    print('== 4. 盲盒（36 件不重复：32 普通 + 4 超级，原子保存） ==')
    pg.evaluate("__tzz.state.coins = 5e6"); pg.locator('#bottomNav [data-tab="gacha"]').click(); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{SHOTS}/09_gacha.png')
    c0 = S(pg, '__tzz.state.coins')
    pg.locator('[data-act="draw"]').click(); pg.wait_for_timeout(200)
    s4 = st(pg)  # 动画还没播完，结果已经存好
    saved = json.loads(S(pg, f"localStorage.getItem('{KEY}')"))
    check(len(s4['gacha']['owned']) == 1 and saved['gacha']['owned'] == s4['gacha']['owned'] and abs(saved['coins'] - (c0 - 200000)) < 1e-6 or saved['coins'] < c0, '开盒：扣币+结果+入库已在动画前一起存档')
    pg.reload(); pg.wait_for_timeout(900)
    txt = pg.inner_text('#mpanel') if modal_visible(pg) else ''
    s5 = st(pg)
    check('上次开盒' in txt and s5['gacha']['owned'] == s4['gacha']['owned'], '刷新后只展示已确定的结果，不重抽')
    check(s5['gacha']['draws'] == 1 and s5['coins'] >= saved['coins'] - 1, '刷新后没有重复扣钱（只扣过 1 次）')
    close_modals(pg)
    pg.locator('#bottomNav [data-tab="gacha"]').click(); pg.wait_for_timeout(200)
    txt_g = pg.inner_text('#tabBody')
    check('超级装饰' in txt_g and '保底' in txt_g and '普通收藏' in txt_g, '盲盒页：超级 / 普通概率分开显示 + 保底提示')
    super_shot = False
    for k in range(35):
        pg.evaluate("__tzz.state.coins = Math.max(__tzz.state.coins, 1e6)")
        pg.locator('[data-act="draw"]').click(); pg.wait_for_timeout(950)
        if not super_shot and S(pg, "!!(__tzz.state.gacha.last && __tzz.state.gacha.last.super)"):
            pg.screenshot(path=f'{SHOTS}/10b_super_reveal.png'); super_shot = True
            check('超级装饰' in pg.inner_text('#mpanel'), '抽到超级装饰：专属弹窗')
        if k == 34: pg.screenshot(path=f'{SHOTS}/10_reveal.png')
        close_modals(pg)
    s6 = st(pg)
    check(len(s6['gacha']['owned']) == 36 and len(set(s6['gacha']['owned'])) == 36, '36 抽集齐、无重复')
    pg.screenshot(path=f'{SHOTS}/09b_gacha_full.png', full_page=True)
    check(pg.locator('button:has-text("已集齐")').count() == 1, '集齐后按钮变「已集齐」')
    r = S(pg, "(()=>{const s=__tzz.state,c=s.coins,r=__tzz.E.gachaDraw(s,.5);return {ok:r.ok,same:s.coins===c,n:s.gacha.owned.length};})()")
    check((not r['ok']) and r['same'] and r['n'] == 36, '集齐后不能再买、不扣金币')
    check(S(pg, "__tzz.E.cardsComplete(__tzz.state)"), '8 张故事卡 → 金牌摊主外观')
    pg.locator('#bottomNav [data-tab="col"]').click(); pg.wait_for_timeout(300)
    pg.locator('[data-act="equip"][data-arg="c77:clothes:c_gold"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-act="equip"][data-arg="c77:hat:h_gold"]').click(); pg.wait_for_timeout(150)
    check(st(pg)['wear']['c77'] == {'clothes':'c_gold','hat':'h_gold'}, '给 77 换上金马甲 + 金厨师帽')
    pg.locator('[data-act="wearWho"][data-arg="pearl"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-act="equip"][data-arg="pearl:clothes:c_qipao"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-act="equip"][data-arg="pearl:hat:h_boba"]').click(); pg.wait_for_timeout(150)
    w = st(pg)['wear']
    check(w['pearl'] == {'clothes':'c_qipao','hat':'h_boba'} and w['c77'] == {'clothes':'c_gold','hat':'h_gold'}, '每位 CEO 各穿各的（珍珠姐：旗袍 + 奶茶杯帽）')
    pg.screenshot(path=f'{SHOTS}/11_collection.png')
    ceo_at0 = S(pg, "JSON.stringify(Object.fromEntries(Object.entries(__tzz.state.ceos).map(([k,v])=>[k,v.at])))")
    pg.evaluate("__tzz.E.assignCeo(__tzz.state,'pearl',0); __tzz.persist(); __tzz.switchShop(0); __tzz.setTab('shop')"); pg.wait_for_timeout(600); close_modals(pg)
    check(st(pg)['wear']['pearl']['hat'] == 'h_boba', '换店后穿搭跟着人走')
    txt_s = pg.inner_text('#tabBody')
    check('当前暴击率 50%' in txt_s and '基础概率 35%' in txt_s and '超级装饰 +15%' in txt_s and '暴击倍率 ×5 / ×10 / ×20' in txt_s and '熊猫食神' in txt_s, '烧烤摊：熊猫食神 → 当前暴击率 50%（基础概率 35% + 超级装饰 15%）/ 倍率 ×5/×10/×20 分开显示')
    check('暴击 25%' in txt_s and '超级暴击 15%' in txt_s and '超超超级暴击 10%' in txt_s, '三档概率分开列出：25% / 15% / 10%')
    pg.screenshot(path=f'{SHOTS}/16_panda_pearl_bbq.png')
    pg.evaluate("(m)=>{const a=JSON.parse(m); for (const k in a) __tzz.state.ceos[k].at=a[k]; __tzz.persist();}", ceo_at0); close_modals(pg)
    rate_a = S(pg, "__tzz.E.baseRate(__tzz.state)")
    pg.evaluate("__tzz.state.gacha.owned=__tzz.E.SUPER_ITEMS.map(i=>i.id)"); rate_b = S(pg, "__tzz.E.baseRate(__tzz.state)")
    pg.evaluate(f"__tzz.state.gacha.owned={json.dumps(s6['gacha']['owned'])}")
    check(abs(rate_a - rate_b) < 1e-6 * max(1, rate_a), '普通收藏不加产速（只有超级装饰加）')
    # 超级装饰在线效果：直接触发
    pg.evaluate("__tzz.switchShop(1); __tzz.setTab('shop'); __tzz.forceSupers()"); pg.wait_for_timeout(400)
    t1 = pg.inner_text('#tabBody')
    check(S(pg, "__tzz.E.rushActive(__tzz.state,'tea',Date.now())") and '当前暴击率 100%' in t1, '珍珠喷泉：连续爆单中，奶茶店手点必暴击')
    tiers_f = S(pg, "(()=>{const s=__tzz.state; const r=[0.01,0.5,0.99].map(x=>__tzz.E.tapReward(s,1,Date.now(),x,0).tier); return r;})()")
    check(tiers_f[0] == 1 and tiers_f[1] == 2 and tiers_f[2] == 3, f'必暴击时仍走三档（不是必出最高档）{tiers_f}')
    pg.screenshot(path=f'{SHOTS}/17_fountain_rush.png')
    pg.evaluate("__tzz.switchShop(3)"); pg.wait_for_timeout(400)
    check(S(pg, "__tzz.E.rushActive(__tzz.state,'tech',Date.now())") and '暴击倍率 ×10 / ×20 / ×40' in pg.inner_text('#tabBody'), '人造太阳：超频中，三档暴击倍率翻倍 ×10/×20/×40')
    pg.screenshot(path=f'{SHOTS}/18_sun_overclock.png')
    pg.evaluate("__tzz.switchShop(2)"); pg.wait_for_timeout(400); pg.screenshot(path=f'{SHOTS}/19_portal.png')
    pg.evaluate("__tzz.switchShop(3); __tzz.setTab('shop')"); pg.wait_for_timeout(1300)
    pg.screenshot(path=f'{SHOTS}/12_tech_77_gold.png')
    print('== 4b. 连击：1 秒内续连、每 50 连击 +5%、动画中不吞点击 ==')
    pg.evaluate("__tzz.state.gacha.owned=__tzz.state.gacha.owned.filter(x=>x!=='s_panda'); __tzz.switchShop(0); __tzz.setTab('shop')"); pg.wait_for_timeout(500); close_modals(pg)
    pg.evaluate("__tzz.clearVisitors()"); t0 = S(pg, '__tzz.state.taps')
    # 真实 pointer：动画期间连点不吞；再同步补到 50 验证档位
    box = pg.locator('#scene').bounding_box()
    for _ in range(12): pg.mouse.click(box['x'] + box['width'] * 0.4, box['y'] + box['height'] * 0.55); pg.wait_for_timeout(35)
    cb = S(pg, '({n:__tzz.combo.n, taps:__tzz.state.taps})')
    check(cb['taps'] - t0 == 12 and cb['n'] == 12, f"快速连点 12 下：一下不吞、连击 12 {cb}")
    # 同步连点补到 50（同一次调用内不算间隔）；不调 renderTab，只靠 tapShop 每下自带的轻量刷新
    crit_q = "(()=>{const q=s=>(document.querySelector(s)||{}).textContent; return {n:__tzz.combo.n, chance:__tzz.E.critChance(__tzz.state,0,Date.now(),__tzz.combo.n), pct:q('#critPct'), base:q('#critBase'), bonus:q('#critBonus'), txt:q('#critLine')};})()"
    pg.evaluate("(()=>{const n=__tzz.combo.n; for(let k=n;k<50;k++)__tzz.tapShop(120,90);})()")
    hud = S(pg, crit_q)
    check(hud['n'] == 50 and abs(hud['chance'] - 0.5) < 1e-9 and hud['pct'] == '50%', f"满 50 连击 → 不整页重画，下方当前暴击率当场就是 50%（和店景 HUD 一致）{hud['pct']}")
    check(hud['base'] == '35%' and '基础概率 35%' in hud['txt'] and '连击 50 下 +15%' in hud['bonus'], f"下方同时标明基础概率 35%、连击加成 +15% {hud['base']} {hud['bonus']}")
    # 真实连点（每下间隔 < 1 秒，走 pointer + 渲染循环），每下之后下方当前率都和 HUD 同一套算法对上
    syn = []
    for _ in range(3):
        pg.mouse.click(box['x'] + box['width'] * 0.4, box['y'] + box['height'] * 0.55)
        syn.append(S(pg, "(()=>{const c=__tzz.combo; return [(document.querySelector('#critPct')||{}).textContent, Math.round(__tzz.E.critChance(__tzz.state,0,Date.now(),c.n)*100)+'%'];})()"))
        pg.wait_for_timeout(60)
    check(all(a == b for a, b in syn), f'连点中每下：下方当前暴击率 = 店景 HUD 暴击率 {syn}')
    pg.screenshot(path=f'{SHOTS}/16b_combo50.png')
    pg.wait_for_timeout(1400)   # 停手 > 1 秒：不调 renderTab，靠 refreshDynamic 每 0.25 秒自动回基础
    hud = S(pg, crit_q)
    check(hud['pct'] == '35%' and hud['base'] == '35%' and '基础概率' in hud['txt'] and '连击' not in hud['bonus'], f"停手超过 1 秒：连击断了，当前暴击率自动回到 35%，基础概率仍是 35% {hud['pct']} {hud['bonus']}")
    pg.evaluate("__tzz.tapShop(120,90)")
    check(S(pg, '__tzz.combo.n') == 1, '断连后下一击从 1 重新算')
    pg.evaluate(f"__tzz.state.gacha.owned={json.dumps(s6['gacha']['owned'])}")
    print('== 5. 离线收益（50%、封顶、每日双倍、防重复） ==')
    pg.evaluate("__tzz.persist()")
    rate = S(pg, "__tzz.E.baseRate(__tzz.state)")
    pg.close()
    pg2 = ctx.new_page(); hook(pg2, 'p2')
    pg2.goto(URL.replace('index.html', 'icon.svg'))
    pg2.evaluate(f"""()=>{{const s=JSON.parse(localStorage.getItem('{KEY}'));s.lastSeen=Date.now()-2*3600e3;s.maxSeen=s.lastSeen;s.dailyDoubleDay=null;s.boostEnd=Date.now()+20000;localStorage.setItem('{KEY}',JSON.stringify(s));}}""")
    pg2.goto(URL); pg2.wait_for_timeout(900)
    pend = S(pg2, '__tzz.state.pending')
    check(modal_visible(pg2) and pend and abs(pend['amount'] - rate * 0.5 * 7200) / (rate * 0.5 * 7200) < 0.01, f"离开 2 小时 → 50% = {pend and round(pend['amount'])}（期望 {round(rate*0.5*7200)}，不含团单/×5）")
    check(pg2.locator('#claimDouble').count() == 1, '今日双倍按钮可用')
    pg2.screenshot(path=f'{SHOTS}/13_offline.png')
    c_b = S(pg2, '__tzz.state.coins'); pg2.click('#claimDouble'); pg2.wait_for_timeout(300); c_a = S(pg2, '__tzz.state.coins')
    check(abs((c_a - c_b) - pend['amount'] * 2) / (pend['amount'] * 2) < 0.01, '双倍领取 = ×2')
    saved = json.loads(S(pg2, f"localStorage.getItem('{KEY}')"))
    check(saved['pending'] is None and saved['claimLog'][-1]['id'] == pend['id'], '入账和领取记录同一次存档')
    pg2.reload(); pg2.wait_for_timeout(800)
    check(not modal_visible(pg2) and S(pg2, '__tzz.state.pending') is None, '刷新后不能重复领取')
    # 20 小时：77 在科技公司 → 10 小时封顶；双倍已用
    pg2.goto(URL.replace('index.html', 'icon.svg'))
    pg2.evaluate(f"""()=>{{const s=JSON.parse(localStorage.getItem('{KEY}'));s.lastSeen=Date.now()-20*3600e3;s.maxSeen=s.lastSeen;localStorage.setItem('{KEY}',JSON.stringify(s));}}""")
    pg2.goto(URL); pg2.wait_for_timeout(900)
    pend = S(pg2, '__tzz.state.pending')
    check(pend and abs(pend['sec'] - 36000) < 2, f"离开 20 小时 → 按 10 小时封顶（麻辣服务器）：{pend and round(pend['sec']/3600,2)}h")
    check(pg2.locator('#claimDouble').count() == 0 and '重置' in pg2.inner_text('#mpanel'), '今日双倍已用 → 只能普通领取，提示 5 点重置')
    pg2.screenshot(path=f'{SHOTS}/14_offline_cap.png')
    pg2.click('#claim'); pg2.wait_for_timeout(300)
    print('== 6. 时间回拨 / 每日重置 / 旧档迁移 ==')
    pg2.goto(URL.replace('index.html', 'icon.svg'))
    pg2.evaluate(f"""()=>{{const s=JSON.parse(localStorage.getItem('{KEY}'));s.maxSeen=Date.now()+3*3600e3;s.lastSeen=Date.now()-5*3600e3;localStorage.setItem('{KEY}',JSON.stringify(s));}}""")
    pg2.goto(URL); pg2.wait_for_timeout(800)
    check(S(pg2, '__tzz.state.pending') is None and not modal_visible(pg2), '手机时间往回调 → 不发离线收益')
    check(S(pg2, "__tzz.E.dayKey(Date.UTC(2026,9,5,20,59))") == '2026-10-05' and S(pg2, "__tzz.E.dayKey(Date.UTC(2026,9,5,21,0))") == '2026-10-06', '每日双倍 05:00 MYT 切日（不跟手机时区）')
    v1 = {'v':1,'coins':4321,'shops':[{'open':True,'lv':12,'hired':True},{'open':True,'lv':3,'hired':False},{'open':False,'lv':0,'hired':False},{'open':False,'lv':0,'hired':False}],
          'gacha':{'owned':[],'draws':0},'lastSeen':0,'maxSeen':0,'claimLog':[]}
    pg2.goto(URL.replace('index.html', 'icon.svg'))
    pg2.evaluate(f"(v)=>{{localStorage.clear(); v.lastSeen=Date.now()-10e3; v.maxSeen=v.lastSeen; localStorage.setItem('{KEY}', JSON.stringify(v));}}", v1)
    pg2.goto(URL); pg2.wait_for_timeout(800)
    s7 = st(pg2)
    check(s7['v'] == 3 and s7['shops'][0]['emp'] == 1 and s7['ceos']['pearl']['at'] == 1 and S(pg2, "!!localStorage.getItem('tangzhe-preview-save-bak-v1')"), '旧档 v1 → v3 迁移（伙伴→员工、CEO 就位、留备份）')
    print('== 7. Safari 多标签：只有一个页面能玩 ==')
    pgA = pg2; pgB = ctx.new_page(); hook(pgB, 'pB')
    pgB.goto(URL); pgB.wait_for_timeout(1000)
    check(S(pgA, '__tzz.frozen') and pgA.is_visible('#lockOverlay'), '第二个标签打开 → 第一个标签冻结')
    check(not S(pgB, '__tzz.frozen'), '新标签正常')
    pgA.screenshot(path=f'{SHOTS}/15_multitab_lock.png')
    coinsB = S(pgB, '__tzz.state.coins'); r = S(pgA, "__tzz.persist()")
    check(r is False, '冻结的标签写不了存档')
    print('== 8. 切后台：声音暂停 ==')
    pgB.mouse.click(200, 300); pgB.wait_for_timeout(500)
    a1 = S(pgB, '__tzz.audioState()')
    pgB.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))"); pgB.wait_for_timeout(400)
    a2 = S(pgB, '__tzz.audioState()')
    pgB.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))"); pgB.wait_for_timeout(400)
    a3 = S(pgB, '__tzz.audioState()')
    check(a2 in ('suspended', 'none') and (a1 != 'running' or a2 == 'suspended'), f'切后台声音暂停：{a1} → {a2} → 回来 {a3}')
    ctx.close()

    print('== 8b. CEO 生活篇：经营 → 家宅 → 商城（翻页 / 买 / 拖 / 转 / 收回 / 撤销） ==')
    hc = b.new_context(**dev); hp = hc.new_page(); hook(hp, 'home')
    hp.goto(URL); hp.evaluate("localStorage.clear()"); hp.reload(); hp.wait_for_timeout(900); close_modals(hp)
    vv = S(hp, "fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(j=>[j.v, document.querySelector('script[src^=\"app.js\"]').getAttribute('src'), document.querySelector('script[src^=\"economy.js\"]').getAttribute('src'), document.querySelector('link[href^=\"style.css\"]').getAttribute('href')])")
    B = vv[0]; check(vv == [B, f'app.js?v={B}', f'economy.js?v={B}', f'style.css?v={B}'], f'缓存号统一 {B}：{vv}')
    hp.evaluate("__tzz.state.coins = 1e6; __tzz.persist()")
    check(S(hp, "__tzz.E.onlineRate(__tzz.state, Date.now())") == 0, '（测试前提）没雇员工 → 每秒 0，金币只会被买东西改变')
    hp.locator('#bottomNav [data-tab="home"]').click(); hp.wait_for_timeout(450)
    check(S(hp, "document.getElementById('app').dataset.tab") == 'home' and S(hp, "getComputedStyle(document.getElementById('stage')).display") == 'none' and hp.locator('#room').count() == 1, '底栏「家宅」→ 翻到家宅页（店景隐藏、出现房间）')
    check(hp.locator('.book-tabs button').count() == 3 and '经营' in hp.inner_text('.book-tabs') and '商城' in hp.inner_text('.book-tabs'), '家宅页顶部翻页签：经营 / 家宅 / 商城')
    check(hp.locator('.home-who .who').count() == 4 and hp.locator('.home-who .who.locked').count() == 3 and S(hp, "__tzz.homeWho") == 'c77', 'CEO 切换：77 能进，其余 3 位锁着')
    check('小屋' in hp.inner_text('.home-card') and '6×4' in hp.inner_text('.home-card') and S(hp, "getComputedStyle(document.getElementById('room')).getPropertyValue('--cols').trim()") == '6', '77 的小屋：6×4 格')
    hp.locator('.home-who [data-arg="pearl"]').click(); hp.wait_for_timeout(250)
    check('还没开放' in hp.inner_text('#tabBody') and hp.locator('#room').count() == 0, '点锁着的珍珠姐：显示「家还没开放」')
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(450)
    NF = S(hp, '__tzz.E.FURNITURE.length'); check(hp.locator('.mall-card:not(.mall-ghost):not(.pet-card)').count() == NF and hp.locator('.home-lock').count() == 0 and '还没加入' in hp.inner_text('.mall-head') and '珍珠姐' in hp.inner_text('.mall-head'), '选着锁着的珍珠姐点「商城」：照样能逛公共商城（顶部提示她还没加入）')
    hp.locator('.book-tabs [data-arg="room"]').click(); hp.wait_for_timeout(450)
    check('还没开放' in hp.inner_text('#tabBody') and hp.locator('#room').count() == 0, '再回「家宅」：珍珠姐的家仍显示没开放')
    hp.locator('.home-who [data-arg="c77"]').click(); hp.wait_for_timeout(200)
    # 商城
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(450)
    names = S(hp, "[...document.querySelectorAll('.mall-card:not(.mall-ghost):not(.pet-card) .name')].map(e=>e.firstChild.textContent.trim())")
    check(hp.locator('.mall-card:not(.mall-ghost):not(.pet-card)').count() == NF and all(n in names for n in ['床','沙发','桌子','台灯','地毯','绿植','书架','电视','冰箱','衣柜','挂画','猫窝']), f'商城 {NF} 件家具（含新接入）：{"/".join(names)}')
    check(hp.locator('#mallSearch').count() == 1 and hp.locator('.mall-cats .mc').count() >= 9, '商城有固定搜索框 + 分类')
    check(S(hp, "[...document.querySelectorAll('.mall-card:not(.mall-ghost):not(.pet-card)')].every(c=>c.querySelector('[data-act=homeBuy] small') && /豪华 \\+\\d+/.test(c.innerText) && /占地 \\d×\\d/.test(c.innerText))"), '每件都标价格 / 豪华度 / 占地')
    check('余额' in hp.inner_text('.mall-head') and '100.0万' in hp.inner_text('.mall-head'), '商城顶部显示余额')
    hp.locator('.mall-cats [data-arg="bed"]').click(); hp.wait_for_timeout(200)
    NB = S(hp, "__tzz.E.FURNITURE.filter(f=>f.cat==='bed').length"); check(hp.locator('.mall-card:not(.mall-ghost):not(.pet-card)').count() == NB and '床' in hp.inner_text('.mall-list') and '沙发' not in hp.inner_text('.mall-list'), f'分类「床具」只显示床类（{NB} 件：旧床 + 云朵 / 舱式 + 11v 新床）')
    hp.locator('.mall-cats [data-arg="cabinet"]').click(); hp.wait_for_timeout(200)
    NC = S(hp, "__tzz.E.FURNITURE.filter(f=>f.cat==='cabinet').length"); check(hp.locator('.mall-subs').count() == 1 and hp.locator('.mall-card:not(.mall-ghost):not(.pet-card)').count() == NC and NC >= 9, f'柜架：子类 + 全部柜架 {NC} 件（书架/衣柜 + 11v 7 件）')
    hp.locator('.mall-subs [data-arg="wardrobe"]').click(); hp.wait_for_timeout(200)
    check(hp.locator('.mall-card:not(.mall-ghost):not(.pet-card)').count() == 1 and '衣柜' in hp.inner_text('.mall-list'), '柜架 → 衣柜')
    hp.locator('[data-act="mallClear"]').click(); hp.wait_for_timeout(200)
    hp.fill('#mallSearch', '挂画'); hp.wait_for_timeout(300)
    check(hp.locator('.mall-card:not(.mall-ghost):not(.pet-card)').count() == 1 and '挂画' in hp.inner_text('.mall-list'), '搜索「挂画」→ 挂画（11v 起「挂」还会搜到挂钩小格柜 / 拼布故事挂毯）')
    hp.locator('[data-act="mallClear"]').click(); hp.wait_for_timeout(200)
    c0 = S(hp, '__tzz.state.coins')
    hp.locator('[data-act="homeBuy"][data-arg="furn_bed"]').click(); hp.wait_for_timeout(300)
    mt = hp.inner_text('#mpanel')
    check(modal_visible(hp) and '价格' in mt and '12,000' in mt and '当前余额' in mt and '100.0万' in mt and '买后余额' in mt, '买之前先看价格 + 当前余额 + 买后余额')
    hp.click('#mNo'); hp.wait_for_timeout(200)
    check(S(hp, '__tzz.state.coins') == c0 and not S(hp, "__tzz.state.furnInv.furn_bed"), '「再想想」不扣钱、不进仓库')
    hp.locator('[data-act="homeBuy"][data-arg="furn_bed"]').click(); hp.wait_for_timeout(250); hp.click('#hbYes'); hp.wait_for_timeout(300)
    saved = json.loads(S(hp, f"localStorage.getItem('{KEY}')"))
    check(S(hp, '__tzz.state.coins') == c0 - 12000 and S(hp, "__tzz.state.furnInv.furn_bed") == 1 and saved['furnInv'].get('furn_bed') == 1 and saved['coins'] == c0 - 12000, '买床：扣 12,000 进仓库，并且已存档')
    hp.evaluate("__tzz.state.coins = 100"); hp.locator('[data-act="homeBuy"][data-arg="furn_tv"]').click(); hp.wait_for_timeout(250)
    check(S(hp, "document.getElementById('hbYes').disabled") and '还差' in hp.inner_text('#mpanel'), '钱不够：确认按钮灰掉、显示还差多少')
    hp.click('#mNo'); hp.wait_for_timeout(150)
    check(S(hp, '__tzz.state.coins') == 100 and not S(hp, "__tzz.state.furnInv.furn_tv"), '钱不够买不了，不扣钱')
    hp.evaluate(f"__tzz.state.coins = {c0 - 12000}; __tzz.persist()")
    for fid in ['furn_sofa', 'furn_rug', 'furn_plant', 'furn_lamp', 'furn_painting']:
        hp.locator(f'[data-act="homeBuy"][data-arg="{fid}"]').click(); hp.wait_for_timeout(200); hp.click('#hbYes'); hp.wait_for_timeout(200)
    hp.wait_for_timeout(2200); hp.evaluate("document.getElementById('panel').scrollTop = 0"); hp.wait_for_timeout(200)
    hp.screenshot(path=f'{SHOTS}/mall_v10.png')
    coins_room = S(hp, '__tzz.state.coins')
    # 回家宅：切到布置模式再拖家具
    hp.locator('.book-tabs [data-arg="room"]').click(); hp.wait_for_timeout(500)
    check(hp.locator('.mode-tabs').count() == 1 and '生活' in hp.inner_text('.mode-tabs'), '家宅有「生活 / 布置」模式')
    check(S(hp, "__tzz.homeMode") == 'live' and hp.locator('.inv-item').count() == 0, '默认生活模式：不显示仓库条')
    hp.locator('.mode-tabs [data-arg="decor"]').click(); hp.wait_for_timeout(300)
    check(S(hp, "__tzz.homeMode") == 'decor' and hp.locator('.inv-item').count() == 6, '布置模式：仓库里有 6 种刚买的家具')
    def fbox(wall=False): return hp.locator('#wallGrid' if wall else '#roomFloor').bounding_box()
    def view(wall=False):  # 仓库条贴到面板底部：房间地板 + 仓库同屏（真机上拖到面板边缘也会自动滚）
        hp.evaluate("(document.querySelector('.inv-strip')||document.getElementById('room')).scrollIntoView({block:'end'})"); hp.wait_for_timeout(60)
        f = fbox(wall); rows = 2 if wall else 4; return f, f['width'] / 6, f['height'] / rows
    def view_wall():  # 拖墙上已挂的画：墙面放到屏幕中间（view() 会把仓库条贴底，墙面第一排可能滚出屏）
        hp.evaluate("document.getElementById('roomWall').scrollIntoView({block:'center'})"); hp.wait_for_timeout(60)
        f = fbox(True); return f, f['width'] / 6, f['height'] / 2
    def drag(sel, gx, gy, mid=None, wall=False):  # gx/gy：目标指针位置（格子单位）；wall=True 拖到墙面
        f, w, h = view_wall() if sel.startswith('#wallGrid') else view(wall); a = hp.locator(sel).bounding_box(); hp.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); hp.mouse.down()
        hp.mouse.move(f['x'] + gx * w, f['y'] + gy * h, steps=10); hp.wait_for_timeout(80)
        if mid: mid()
        hp.mouse.up(); hp.wait_for_timeout(300)
    def home(): return S(hp, "JSON.parse(JSON.stringify(__tzz.state.homes.c77))")
    def item(fid): return next((p for p in home()['placed'] if p['fid'] == fid), None)
    fb, cw, ch = view()
    seen = {}
    def mid_ok():
        seen['hl'] = S(hp, "document.getElementById('roomHl').className"); seen['scroll'] = S(hp, "document.getElementById('panel').scrollTop"); seen['ghost'] = hp.locator('.drag-ghost').count()
    sc0 = S(hp, "document.getElementById('panel').scrollTop")
    drag('.inv-item[data-fid="furn_bed"]', 1, 2.5, mid_ok)
    bed = item('furn_bed')
    check(seen.get('ghost') == 1 and 'ok' in (seen.get('hl') or ''), f"拖动中：跟手的家具 + 绿色可放高亮（{seen.get('hl')}）")
    check(bed is not None and (bed['x'], bed['y'], bed['rot']) == (0, 1, 0) and not S(hp, "__tzz.state.furnInv.furn_bed"), f'从仓库拖床进房间，吸附到格子 (0,1)：{bed}')
    ta = S(hp, "[getComputedStyle(document.querySelector('.inv-item')).touchAction, getComputedStyle(document.getElementById('roomFloor')).touchAction, getComputedStyle(document.querySelector('#roomFloor .furn')).touchAction]")
    check(seen.get('scroll') == sc0 and ta == ['pan-x', 'none', 'none'], f'拖动时页面不跟着上下滚（仓库条只许横滑 / 房间和家具 touch-action:none）：{ta}，滚动 {sc0}→{seen.get("scroll")}')
    view(); st0 = S(hp, "document.getElementById('panel').scrollTop"); pr = hp.locator('#panel').bounding_box(); n0 = len(home()['placed'])
    a = hp.locator('.inv-item').first.bounding_box(); hp.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); hp.mouse.down()
    hp.mouse.move(pr['x'] + pr['width'] / 2, pr['y'] + 6, steps=12); hp.wait_for_timeout(700)
    st1 = S(hp, "document.getElementById('panel').scrollTop"); hp.mouse.up(); hp.wait_for_timeout(300)
    check(st0 > 0 and st1 < st0 and len(home()['placed']) == n0, f'拖到面板上沿：面板自动往上滚（{st0} → {st1}），松在房间外不摆')
    seen.clear()
    drag('.inv-item[data-fid="furn_sofa"]', 1.5, 1.5, mid_ok)
    check('bad' in (seen.get('hl') or '') and item('furn_sofa') is None and S(hp, "__tzz.state.furnInv.furn_sofa") == 1, f"拖到床上：红色高亮，松手不放、留在仓库（{seen.get('hl')}）")
    drag('.inv-item[data-fid="furn_sofa"]', 3, 5.6)
    check(item('furn_sofa') is None, '拖出房间外：不放')
    drag('.inv-item[data-fid="furn_sofa"]', 4.5, 3.5)
    sofa = item('furn_sofa'); check(sofa and (sofa['x'], sofa['y']) == (3, 3), f'沙发放到 (3,3)：{sofa}')
    # 拖已摆的家具换位置
    drag(f'#roomFloor .furn[data-uid="{sofa["uid"]}"]', 4.5, 2.5)
    s2 = item('furn_sofa'); check(s2['x'] == 3 and s2['y'] == 2, f'拖动已摆好的沙发 → 吸附到 (3,2)：{s2}')
    drag(f'#roomFloor .furn[data-uid="{sofa["uid"]}"]', 2, 2.5)
    check(item('furn_sofa')['x'] == 3, '拖去和床重叠：弹回原位')
    # 点选 → 旋转 / 收回 / 撤销
    hp.locator(f'#roomFloor .furn[data-uid="{bed["uid"]}"]').click(); hp.wait_for_timeout(250)
    check(S(hp, "__tzz.homeSel") == bed['uid'] and hp.locator('[data-act="homeRot"]').count() == 1 and hp.locator('[data-act="homeStore"]').count() == 1, '点一下床：选中，出现「旋转 / 收回」')
    hp.locator('[data-act="homeRot"]').click(); hp.wait_for_timeout(250)
    b1 = item('furn_bed')
    check(b1['rot'] == 1 and S(hp, f"__tzz.E.canPlace(__tzz.state,'c77','furn_bed',{b1['x']},{b1['y']},1,'{bed['uid']}').ok") and S(hp, "(()=>{const e=document.querySelector('#roomFloor .furn[data-fid=furn_bed]');return Math.round(e.offsetWidth/e.offsetHeight*10)/10})()") == round(3 * cw / (2 * ch), 1), f'旋转 90°：2×3 → 3×2，仍放得下（{b1}）')
    lux_txt = hp.inner_text('#homeLux'); lux = S(hp, "__tzz.E.homeLuxury(__tzz.state,'c77')")
    check(lux_txt == str(lux) and lux == 15 + 12, f'家宅页显示豪华度 {lux_txt}（床 15 + 沙发 12 + 小屋 0）')
    hp.locator('[data-act="homeStore"]').click(); hp.wait_for_timeout(250)
    check(item('furn_bed') is None and S(hp, "__tzz.state.furnInv.furn_bed") == 1 and S(hp, "__tzz.homeSel") is None, '收回：床回到仓库')
    hp.locator('[data-act="homeUndo"]').click(); hp.wait_for_timeout(250)
    b2 = item('furn_bed'); check(b2 and b2['rot'] == 1 and (b2['x'], b2['y']) == (b1['x'], b1['y']) and not S(hp, "__tzz.state.furnInv.furn_bed"), '撤销收回：床回到原位（还是转过的方向）')
    hp.locator('[data-act="homeUndo"]').click(); hp.wait_for_timeout(250)
    check(item('furn_bed')['rot'] == 0, '再撤销：旋转也撤回')
    hp.locator('[data-act="homeUndo"]').click(); hp.wait_for_timeout(250)
    check(item('furn_sofa')['y'] == 3, '再撤销：沙发移动撤回 (3,3)')
    check(S(hp, '__tzz.state.coins') == coins_room, f'摆放 / 移动 / 旋转 / 收回 / 撤销：金币一分没动（{coins_room}）')
    # 轻点仓库 = 自动找空位；地毯能垫在床下；挂画只挂墙面、避开窗户
    hp.locator('.inv-item[data-fid="furn_plant"]').click(); hp.wait_for_timeout(250)
    check(item('furn_plant') is not None, '轻点仓库里的绿植：自动找空位摆上')
    drag('.inv-item[data-fid="furn_rug"]', 1.5, 2)
    check(item('furn_rug') is not None, '地毯可以垫在床下面')
    def toast_txt(): return S(hp, "(()=>{const t=document.getElementById('toast');return t&&!t.classList.contains('hidden')?t.textContent:''})()")
    drag('.inv-item[data-fid="furn_painting"]', 4, 2.5)  # 拖到地板中间 → 不行
    check(item('furn_painting') is None and toast_txt() == '挂画只能放墙面', f'挂画拖到地板：不行，提示「挂画只能放墙面」（{toast_txt()}）')
    # 挂画：先让墙面进视口，再拖；窗户格拒、空位收；拖动中斜纹标出禁区（和自动摆放同一份）
    vp0 = hp.viewport_size; hp.set_viewport_size({'width': vp0['width'], 'height': 1100}); hp.wait_for_timeout(250)  # 挂画段：屏幕拉高，墙面和仓库条同屏（小屏靠拖到边缘自动滚，上面单测过）
    seen_w = {}
    def mid_wall():
        seen_w['cls'] = S(hp, "document.getElementById('wallGrid').className"); seen_w['hl'] = S(hp, "document.getElementById('wallHl').className")
        seen_w['blk'] = S(hp, "[...document.querySelectorAll('#wallGrid .wall-block')].filter(e=>getComputedStyle(e).display!=='none').length")
    hp.evaluate("document.getElementById('roomWall').scrollIntoView({block:'center'})"); hp.wait_for_timeout(120)
    drag('.inv-item[data-fid="furn_painting"]', 2.5, 0.6, mid_wall, wall=True)  # 围裙挂钩 / 窗户
    check(item('furn_painting') is None and 'bad' in (seen_w.get('hl') or ''), f"挂画拖到装饰 / 窗户：红色高亮，不行（{seen_w.get('hl')}）")
    check('show-block' in (seen_w.get('cls') or '') and seen_w.get('blk') == 8 and 'show-block' not in S(hp, "document.getElementById('wallGrid').className"), f"拖挂画时显示 8 格禁区斜纹（右 4 列 × 2 排），松手就藏（{seen_w.get('blk')}）")
    hp.evaluate("document.getElementById('roomWall').scrollIntoView({block:'center'})"); hp.wait_for_timeout(80)
    drag('.inv-item[data-fid="furn_painting"]', 4.6, 0.6, wall=True)  # 右上窗户 (4,0)
    check(item('furn_painting') is None, '挂画拖到右上窗户：不行')
    hp.evaluate("document.getElementById('roomWall').scrollIntoView({block:'center'})"); hp.wait_for_timeout(80)
    drag('.inv-item[data-fid="furn_painting"]', 1.0, 0.6, wall=True)  # 左上空墙 (0,0)
    pt = item('furn_painting')
    check(pt is not None and pt.get('surf') == 'wall' and (pt['x'], pt['y']) == (0, 0), f'挂画挂上左上空墙 (0,0)：{pt}')
    check(hp.locator('#wallGrid .furn[data-fid="furn_painting"]').count() == 1 and hp.locator('#roomFloor .furn[data-fid="furn_painting"]').count() == 0, '挂画 DOM 在墙面容器里，不在地板')
    wg = S(hp, "(()=>{const e=document.querySelector('#wallGrid .furn[data-fid=furn_painting]'), fi=e&&e.querySelector('.fi'), i=e&&e.querySelector('img'), w=document.getElementById('wallGrid').getBoundingClientRect(); if(!e||!fi||!i) return null; const a=e.getBoundingClientRect(), b=fi.getBoundingClientRect(); return {dTop:Math.abs(a.top-w.top), fiTop:Math.abs(b.top-a.top), fiH:Math.abs(b.height-a.height), op:getComputedStyle(i).objectPosition}})()")
    check(wg and wg['dTop'] < 1.5 and wg['fiTop'] < 1.5 and wg['fiH'] < 1.5 and wg['op'].replace('center', '50%').split()[-1] in ('0%', 'top', '0px'), f'挂画贴墙壁最上面挂：画框顶 = 墙顶（天花板），图顶对齐不居中（{wg}）')
    nb, wb = hp.locator('#roomWall .rw-name').bounding_box(), fbox(True)
    check(nb['x'] >= wb['x'] + wb['width'] * 2 / 6, f"房名牌挪到右上（禁区上），不压左边空墙：牌 x={round(nb['x'])}，空墙右界 {round(wb['x'] + wb['width'] * 2 / 6)}")
    # 墙面拖动换位
    if pt:
        hp.evaluate("document.getElementById('roomWall').scrollIntoView({block:'center'})"); hp.wait_for_timeout(80)
        drag(f'#wallGrid .furn[data-uid="{pt["uid"]}"]', 1.0, 1.4, wall=True)
        pt2 = item('furn_painting')
        check(pt2 and pt2['surf'] == 'wall' and (pt2['x'], pt2['y']) == (0, 1), f'挂画在墙面可拖动换位到左下 (0,1)：{pt2}')
        hp.evaluate("document.getElementById('roomWall').scrollIntoView({block:'center'})"); hp.wait_for_timeout(80)
        drag(f'#wallGrid .furn[data-uid="{pt["uid"]}"]', 4.6, 0.6, wall=True)
        check((item('furn_painting')['x'], item('furn_painting')['y']) == (0, 1), '已挂的画拖到右上窗户：弹回原位')
        hp.evaluate("document.getElementById('roomWall').scrollIntoView({block:'center'})"); hp.wait_for_timeout(80)
        drag(f'#wallGrid .furn[data-uid="{pt["uid"]}"]', 3, 3.5)
        check((item('furn_painting')['x'], item('furn_painting')['y']) == (0, 1) and toast_txt().startswith('挂画只能放墙面'), f'已挂的画拖到地板：放回原位，提示「{toast_txt()}」')
    # 轻点仓库自动挂：和手动同一份禁区 → 只去左边空墙，不盖窗户；满了提示
    hp.evaluate("__tzz.state.coins += 1e5; __tzz.E.buyFurniture(__tzz.state,'furn_painting'); __tzz.E.buyFurniture(__tzz.state,'furn_painting'); __tzz.renderTab()"); hp.wait_for_timeout(200)
    hp.locator('.inv-item[data-fid="furn_painting"]').click(); hp.wait_for_timeout(300)
    wp = sorted((p['x'], p['y']) for p in home()['placed'] if p['fid'] == 'furn_painting')
    check(wp == [(0, 0), (0, 1)], f'轻点仓库自动挂第二幅：去左上空墙 (0,0)，不盖右上窗户：{wp}')
    hp.locator('.inv-item[data-fid="furn_painting"]').click(); hp.wait_for_timeout(300)
    check(len([p for p in home()['placed'] if p['fid'] == 'furn_painting']) == 2 and '挂满' in toast_txt() and S(hp, "__tzz.state.furnInv.furn_painting") == 1, f'空墙挂满再点：不硬塞到窗户上，提示「{toast_txt()}」')
    hp.evaluate("__tzz.state.coins -= 1e5 - 2 * __tzz.E.FURN_BY_ID.furn_painting.price; __tzz.renderTab()"); hp.wait_for_timeout(150)
    hp.set_viewport_size(vp0); hp.wait_for_timeout(250)
    hp.locator('.inv-item[data-fid="furn_lamp"]').click(); hp.wait_for_timeout(250)
    check(S(hp, '__tzz.state.coins') == coins_room, '摆完一屋子家具，金币还是没变')
    # 生活模式互动
    hp.locator('.mode-tabs [data-arg="live"]').click(); hp.wait_for_timeout(300)
    check(S(hp, "__tzz.homeMode") == 'live' and hp.locator('.inv-strip').count() == 0, '生活模式：仓库条收起')
    fb = fbox(); hp.mouse.click(fb['x'] + fb['width'] * 0.85, fb['y'] + fb['height'] * 0.85); hp.wait_for_timeout(1000)
    ac = S(hp, "(()=>{const a=__tzz.homeActor.c77; return {x:Math.round(a.x*10)/10,y:Math.round(a.y*10)/10,line:!!a.line};})()")
    check(ac['x'] >= 4 and ac['y'] >= 2 and ac['line'], f'生活模式点空地：CEO 走过去并说话 {ac}')
    hp.locator('#roomFloor .furn[data-fid="furn_bed"]').click(); hp.wait_for_timeout(700)
    ac2 = S(hp, "(()=>{const a=__tzz.homeActor.c77; return {act:a.act,line:!!a.line};})()")
    check(ac2['act'] == 'rest' and ac2['line'], f'点床：休息 + 台词 {ac2}')
    # 新云朵纱帐床（bed 类）同样休息：先点空地清掉状态，再摆一张新床点它
    hp.mouse.click(fb['x'] + fb['width'] * 0.1, fb['y'] + fb['height'] * 0.1); hp.wait_for_timeout(500)
    check(S(hp, "__tzz.homeActor.c77.act") != 'rest', f'点空地后不再是休息状态')
    cb = S(hp, "(()=>{const s=__tzz.state,E=__tzz.E; s.coins+=E.FURN_BY_ID.furn_s77_cloud_canopy.price; const r=E.buyFurniture(s,'furn_s77_cloud_canopy'); const sp=E.findFree(s,'c77','furn_s77_cloud_canopy',0); if(!r.ok||!sp) return {ok:false,why:r.why||'没空位'}; const q=E.placeItem(s,'c77','furn_s77_cloud_canopy',sp.x,sp.y,0); __tzz.renderTab(); return {ok:!!q.ok,uid:q.uid,x:sp.x,y:sp.y};})()")
    hp.wait_for_timeout(300)
    if cb.get('ok'):
        hp.locator(f'#roomFloor .furn[data-uid="{cb["uid"]}"]').click(); hp.wait_for_timeout(700)
        ac3 = S(hp, "(()=>{const a=__tzz.homeActor.c77; return {act:a.act,line:!!a.line};})()")
        check(ac3['act'] == 'rest' and ac3['line'], f'点新云朵纱帐床：同样休息 + 台词 {ac3}')
        hp.screenshot(path=f'{SHOTS}/07c_cloud_bed_rest.png')
        hp.evaluate(f"(()=>{{const s=__tzz.state,E=__tzz.E,h=s.homes.c77,i=h.placed.findIndex(p=>p.uid==='{cb['uid']}'); h.placed.splice(i,1); s.furnInv.furn_s77_cloud_canopy=0; delete s.furnInv.furn_s77_cloud_canopy; __tzz.renderTab();}})()"); hp.wait_for_timeout(200)
    else:
        check(False, f'摆新云朵床失败 {cb}')
    # 舱式单层床 2×1（索引提案 2×3 实测改小）：画面贴在占地里、上一排不挡、旋转 / 收回 / 休息都正常
    snapH = S(hp, "JSON.stringify(__tzz.state.homes.c77)"); snapI = S(hp, "JSON.stringify(__tzz.state.furnInv)")
    cap = S(hp, """(()=>{const s=__tzz.state,E=__tzz.E,id='furn_rocket_capsule_bunk',h=s.homes.c77,T=E.homeTier(h.lv); s.coins+=E.FURN_BY_ID[id].price; const b=E.buyFurniture(s,id); if(!b.ok) return {ok:false,why:b.why};
      const pick=()=>{for(let y=1;y<T.rows;y++)for(let x=0;x+2<=T.cols;x++) if(E.canPlace(s,'c77',id,x,y,0).ok&&E.canPlace(s,'c77','furn_plant',x,y-1,0).ok&&E.canPlace(s,'c77','furn_plant',x+1,y-1,0).ok) return {x,y}; return null;};
      let sp=pick(), stored=0; while(!sp&&h.placed.length){ const q=h.placed.find(p=>p.surf!=='wall'&&p.fid!=='furn_bed'); if(!q) break; E.storeItem(s,'c77',q.uid); stored++; sp=pick(); }
      if(!sp) return {ok:false,why:'没空位'}; const r=E.placeItem(s,'c77',id,sp.x,sp.y,0); __tzz.renderTab(); return {ok:!!r.ok,uid:r.uid,x:sp.x,y:sp.y,cols:T.cols,rows:T.rows,stored};})()""")
    hp.wait_for_timeout(500)
    if cap.get('ok'):
        sel = f'#roomFloor .furn[data-uid="{cap["uid"]}"]'
        def geo():
            return S(hp, f"""(()=>{{const fl=document.querySelector('#roomFloor').getBoundingClientRect(),el=document.querySelector('{sel}'); if(!el) return null; const r=el.getBoundingClientRect(),im=el.querySelector('img'),ir=im?im.getBoundingClientRect():null;
              return {{cw:fl.width/{cap['cols']},ch:fl.height/{cap['rows']},w:r.width,h:r.height,top:r.top,bot:r.bottom,l:r.left,rt:r.right,img:im?{{ok:im.complete&&im.naturalWidth>0,nw:im.naturalWidth,t:ir.top,b:ir.bottom,l:ir.left,r:ir.right}}:null,tall:el.classList.contains('tall'),art:el.classList.contains('art'),flTop:fl.top,flLeft:fl.left}};}})()""")
        g = geo()
        check(g and abs(g['w'] - 2 * g['cw']) < 2 and abs(g['h'] - g['ch']) < 2, f'舱式床在房间里占 2×1 格（{g and round(g["w"])}×{g and round(g["h"])}px，格 {g and round(g["cw"])}×{g and round(g["ch"])}）')
        check(g and g['img'] and g['img']['ok'] and g['img']['nw'] == 400 and g['art'] and g['tall'], f'舱式床图加载成功（400 宽 webp）{g and g["img"]}')
        check(g and g['img'] and abs(g['img']['b'] - g['bot']) < 2 and g['img']['t'] >= g['top'] - 2 and g['img']['l'] >= g['l'] - 1 and g['img']['r'] <= g['rt'] + 1, '舱式床图底脚贴占地底边，整张图都在占地 2×1 里面（不伸出去盖别的格）')
        above = S(hp, f"""(()=>{{const fl=document.querySelector('#roomFloor').getBoundingClientRect(),cw=fl.width/{cap['cols']},ch=fl.height/{cap['rows']}; return [0,1].map(k=>{{const e=document.elementFromPoint(fl.left+({cap['x']}+k+0.5)*cw, fl.top+({cap['y']}-0.5)*ch); const f=e&&e.closest('.furn'); return f?f.dataset.uid:null;}});}})()""")
        check(cap['uid'] not in above, f'床正上方一排点下去不是床（没有空白挡位）{above}')
        pa = S(hp, f"(()=>{{const s=__tzz.state,E=__tzz.E; s.coins+=E.FURN_BY_ID.furn_plant.price; E.buyFurniture(s,'furn_plant'); const r=E.placeItem(s,'c77','furn_plant',{cap['x']},{cap['y']}-1,0); __tzz.renderTab(); return r.ok;}})()")
        check(pa, '床正上方那格能真摆一盆植物')
        hp.wait_for_timeout(300)
        hp.locator(sel).click(); hp.wait_for_timeout(700)
        ac4 = S(hp, "(()=>{const a=__tzz.homeActor.c77; return {act:a.act,line:!!a.line};})()")
        check(ac4['act'] == 'rest' and ac4['line'], f'点舱式床：休息 + 台词 {ac4}')
        hp.screenshot(path=f'{SHOTS}/07d_capsule_rest.png')
        hp.locator('.mode-tabs [data-arg="decor"]').click(); hp.wait_for_timeout(300)
        hp.locator(sel).click(); hp.wait_for_timeout(250)
        hp.locator(f'[data-act="homeRot"][data-arg="{cap["uid"]}"]').click(); hp.wait_for_timeout(400)
        pr = S(hp, f"(()=>{{const s=__tzz.state,E=__tzz.E,p=s.homes.c77.placed.find(q=>q.uid==='{cap['uid']}'); return p?{{rot:p.rot,x:p.x,y:p.y,ok:E.canPlace(s,'c77',p.fid,p.x,p.y,p.rot,p.uid).ok}}:null;}})()")
        g2 = geo()
        check(pr and pr['rot'] == 1 and pr['ok'] and g2 and abs(g2['w'] - g2['cw']) < 2 and abs(g2['h'] - 2 * g2['ch']) < 2, f'点「旋转」：变 1×2、位置合法、不压植物 {pr}')
        check(g2 and g2['img'] and g2['img']['l'] >= g2['l'] - 1 and g2['img']['r'] <= g2['rt'] + 1 and g2['img']['b'] <= g2['bot'] + 2, '竖放后图仍在占地里')
        hp.screenshot(path=f'{SHOTS}/07e_capsule_rot.png')
        hp.locator(sel).click(); hp.wait_for_timeout(250)
        n0 = S(hp, "__tzz.state.furnInv.furn_rocket_capsule_bunk||0")
        st_btn = hp.locator(f'[data-act="homeStore"][data-arg="{cap["uid"]}"]')
        if st_btn.count() == 0:
            hp.locator(sel).click(); hp.wait_for_timeout(250)
        hp.locator(f'[data-act="homeStore"][data-arg="{cap["uid"]}"]').click(); hp.wait_for_timeout(400)
        gone = S(hp, f"!__tzz.state.homes.c77.placed.some(q=>q.uid==='{cap['uid']}') && !document.querySelector('{sel}')")
        check(gone and S(hp, "__tzz.state.furnInv.furn_rocket_capsule_bunk||0") == n0 + 1, f'点「收回」：房间里没了，仓库 +1（{n0}→{S(hp, "__tzz.state.furnInv.furn_rocket_capsule_bunk||0")}）')
        hp.evaluate(f"(()=>{{__tzz.state.homes.c77=JSON.parse({json.dumps(snapH)}); __tzz.state.furnInv=JSON.parse({json.dumps(snapI)}); __tzz.renderTab();}})()")
        hp.locator('.mode-tabs [data-arg="live"]').click(); hp.wait_for_timeout(250)
    else:
        check(False, f'摆舱式床失败 {cap}')
    hp.locator('.mode-tabs [data-arg="decor"]').click(); hp.wait_for_timeout(250)
    view(); hp.locator('#roomFloor .furn[data-fid="furn_sofa"]').click(); hp.wait_for_timeout(2200)
    view(); hp.wait_for_timeout(200)
    hp.screenshot(path=f'{SHOTS}/home_v10.png')
    # 四位 CEO 的 Lv1 底图都登记了，且原图是 1200×1200
    hl = S(hp, "Promise.all(['c77','pearl','otaku','rocket'].map(id=>new Promise(r=>{ if(!__tzz.HOME_ART[id+'_1']) return r(id+' 没登记'); const im=new Image(); im.onload=()=>r(im.naturalWidth===1200&&im.naturalHeight===1200?null:id+' 尺寸 '+im.naturalWidth+'×'+im.naturalHeight); im.onerror=()=>r(id+' 加载失败'); im.src='art/home_'+id+'_1.webp';}))).then(a=>a.filter(Boolean))")
    check(hl == [], f'四位 CEO 的 Lv1 家宅底图都登记且是 1200×1200 {hl}')
    hl2 = S(hp, "Promise.all([['c77_2',1600,1400],['c77_3',2000,1600],['pearl_2',1600,1400],['pearl_3',2000,1600]].map(([k,w,h])=>new Promise(r=>{ if(!__tzz.HOME_ART[k]) return r(k+' 没登记'); const im=new Image(); im.onload=()=>r(im.naturalWidth===w&&im.naturalHeight===h?null:k+' 尺寸 '+im.naturalWidth+'×'+im.naturalHeight); im.onerror=()=>r(k+' 加载失败'); im.src='art/home_'+k+'.webp';}))).then(a=>a.filter(Boolean))")
    check(hl2 == [], f'12b1 77 / 珍珠姐 Lv2/Lv3 底图都登记、加载成功、尺寸对（公寓 1600×1400、豪宅 2000×1600）{hl2}')
    # 存档往返
    h_before = home(); inv_before = S(hp, "JSON.parse(JSON.stringify(__tzz.state.furnInv))")
    hp.reload(); hp.wait_for_timeout(900); close_modals(hp)
    check(S(hp, "JSON.parse(JSON.stringify(__tzz.state.homes.c77))") == h_before and S(hp, "JSON.parse(JSON.stringify(__tzz.state.furnInv))") == inv_before, '刷新后家具位置 / 仓库原样读回')
    # 升级房子
    hp.locator('#bottomNav [data-tab="home"]').click(); hp.wait_for_timeout(450)
    hp.locator('[data-act="homeUp"]').click(); hp.wait_for_timeout(250)
    mt = hp.inner_text('#mpanel')
    check('小屋 → 公寓' in mt and '8×5' in mt and '80,000' in mt and '当前余额' in mt, '升级前看价格 80,000 + 余额 + 新格子 8×5')
    cu = S(hp, '__tzz.state.coins'); hp.click('#huYes'); hp.wait_for_timeout(400)
    check(S(hp, "__tzz.state.homes.c77.lv") == 2 and S(hp, '__tzz.state.coins') == cu - 80000 and S(hp, "getComputedStyle(document.getElementById('room')).getPropertyValue('--cols').trim()") == '8' and S(hp, "document.getElementById('room').dataset.tier") == 'apt', '升级公寓：扣 80,000，房间变 8×5、换公寓样式')
    check(home()['placed'] == h_before['placed'], '升级后家具原位保留')
    hp.wait_for_timeout(700); hp.screenshot(path=f'{SHOTS}/home_v10_apt.png')
    # 翻回经营：店景回来、画布尺寸正常、还能点
    hp.locator('.book-tabs [data-arg="shop"]').click(); hp.wait_for_timeout(600)
    sz = S(hp, "(()=>{const r=document.getElementById('scene').getBoundingClientRect(), c=__tzz.canvasSize; return {tab:document.getElementById('app').dataset.tab, disp:getComputedStyle(document.getElementById('stage')).display, rw:r.width, rh:r.height, W:c.W, H:c.H, tabs:getComputedStyle(document.getElementById('shopTabs')).display}})()")
    check(sz['tab'] == 'shop' and sz['disp'] != 'none' and sz['tabs'] != 'none' and sz['rh'] > 100 and abs(sz['W'] - sz['rw']) < 2 and abs(sz['H'] - sz['rh']) < 2, f'翻回经营：店景 / 店铺签回来，画布重新量尺寸 {round(sz["W"])}×{round(sz["H"])}')
    t0 = S(hp, '__tzz.state.taps'); bx = hp.locator('#scene').bounding_box(); hp.mouse.click(bx['x'] + bx['width'] * 0.4, bx['y'] + bx['height'] * 0.55); hp.wait_for_timeout(200)
    check(S(hp, '__tzz.state.taps') == t0 + 1, '回到经营后点店铺照常赚钱')
    hp.locator('#bottomNav [data-tab="home"]').click(); hp.wait_for_timeout(300); hp.locator('#bottomNav [data-tab="ceo"]').click(); hp.wait_for_timeout(300); hp.locator('#bottomNav [data-tab="shop"]').click(); hp.wait_for_timeout(500)
    check(S(hp, "getComputedStyle(document.getElementById('stage')).display") != 'none' and S(hp, "__tzz.canvasSize.H") > 100, '家宅 → CEO → 经营：店景正常')
    # 调任不影响家宅
    hp.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e7; E.openShop(s,1); __tzz.persist();})()"); hp.wait_for_timeout(300); close_modals(hp)
    hb = home(); hp.evaluate("__tzz.E.assignCeo(__tzz.state,'c77',1); __tzz.persist()")
    check(home() == hb and S(hp, "__tzz.E.homeOpen(__tzz.state,'pearl')"), '开奶茶店 → 珍珠姐的家解锁；77 调任不影响 77 的家')
    hc.close()
    # 旧档（v3，还没有家宅）→ 自动补每人一间空小屋
    hc = b.new_context(**dev); hp = hc.new_page(); hook(hp, 'home-old')
    hp.goto(URL.replace('index.html', 'icon.svg'))
    hp.evaluate(f"()=>{{localStorage.clear(); const s={{v:3,rev:5,coins:777,totalEarned:777,shops:[{{open:true,lv:4,emp:1}},{{open:false,lv:0,emp:0}},{{open:false,lv:0,emp:0}},{{open:false,lv:0,emp:0}}],ceos:{{c77:{{unlocked:true,lv:2,at:0}}}},gacha:{{owned:[],draws:0,pity:0,last:null}},claimLog:[],lastSeen:Date.now()-5000,maxSeen:Date.now()-5000,created:Date.now()-1e6}}; localStorage.setItem('{KEY}', JSON.stringify(s));}}")
    hp.goto(URL); hp.wait_for_timeout(900); close_modals(hp)
    so = st(hp)
    check(all(so['homes'][c]['lv'] == 1 and so['homes'][c]['placed'] == [] for c in ['c77', 'pearl', 'otaku', 'rocket']) and so['furnInv'] == {} and so['shops'][0]['lv'] == 4 and so['coins'] >= 777, '旧档（无家宅）读入：每人补一间空小屋，原进度不变')
    hp.locator('#bottomNav [data-tab="home"]').click(); hp.wait_for_timeout(400)
    check(hp.locator('#room').count() == 1, '旧档玩家也能直接进家宅')
    hc.close()

    print('== 8c. 高家具：书架 / 衣柜（占地 2×1，图往上伸到墙上，底脚对齐，按底脚排前后） ==')
    hc = b.new_context(**dev); hp = hc.new_page(); hook(hp, 'tall')
    hp.goto(URL); hp.evaluate("localStorage.clear()"); hp.reload(); hp.wait_for_timeout(900); close_modals(hp)
    ld = S(hp, "Promise.all(['bookshelf','wardrobe'].map(n=>new Promise(r=>{ if(!__tzz.FURN_ART[n]||!__tzz.FURN_UP[n]) return r(n+' 没登记'); const im=new Image(); im.onload=()=>r(im.naturalWidth===400&&im.naturalHeight===600?null:n+' '+im.naturalWidth+'×'+im.naturalHeight); im.onerror=()=>r(n+' 加载失败'); im.src='art/furn_'+n+'.webp';}))).then(a=>a.filter(Boolean))")
    check(ld == [], f'书架 / 衣柜图登记了，都是 400×600 {ld}')
    hp.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e6; ['furn_bookshelf','furn_wardrobe','furn_lamp','furn_plant'].forEach(f=>E.buyFurniture(s,f)); E.placeItem(s,'c77','furn_lamp',4,0,0); E.placeItem(s,'c77','furn_bookshelf',3,1,0); __tzz.persist();})()")
    hp.locator('#bottomNav [data-tab="home"]').click(); hp.wait_for_timeout(500); close_modals(hp)
    hp.locator('.mode-tabs [data-arg="decor"]').click(); hp.wait_for_timeout(300)
    def tview():
        hp.evaluate("(document.querySelector('.inv-strip')||document.getElementById('room')).scrollIntoView({block:'end'})"); hp.wait_for_timeout(60)
        f = hp.locator('#roomFloor').bounding_box(); return f, f['width'] / 6, f['height'] / 4
    def tdrag(sel, gx, gy):
        f, w, h = tview(); a = hp.locator(sel).bounding_box(); hp.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); hp.mouse.down()
        hp.mouse.move(f['x'] + gx * w, f['y'] + gy * h, steps=10); hp.wait_for_timeout(80); hp.mouse.up(); hp.wait_for_timeout(300)
    def titem(fid): return next((p for p in S(hp, "JSON.parse(JSON.stringify(__tzz.state.homes.c77.placed))") if p['fid'] == fid), None)
    def geo(fid): return S(hp, f"(()=>{{const e=document.querySelector('#roomFloor .furn[data-fid={fid}]'), i=e&&e.querySelector('img'); if(!e||!i) return null; const a=e.getBoundingClientRect(), b=i.getBoundingClientRect(), r=document.getElementById('room').getBoundingClientRect(); return {{eT:a.top,eB:a.bottom,eL:a.left,eR:a.right,eH:a.height,iT:b.top,iB:b.bottom,iL:b.left,iR:b.right,iH:b.height,iW:b.width,rT:r.top,ov:getComputedStyle(e).overflow,tall:e.classList.contains('tall'),tf:getComputedStyle(i.parentNode).transform}}}})()")
    tdrag('.inv-item[data-fid="furn_wardrobe"]', 1, 0.5)
    w0 = titem('furn_wardrobe'); f, cw, ch = tview(); g = geo('furn_wardrobe')
    check(w0 and (w0['x'], w0['y'], w0['rot']) == (0, 0, 0), f'从仓库拖衣柜靠后墙：吸附到 (0,0) {w0}')
    check(g and g['tall'] and g['ov'] == 'visible' and abs(g['eH'] - ch) < 1.5, f'衣柜占地只有 1 排格子（{round(g["eH"],1)} ≈ 格高 {round(ch,1)}），图可以伸出占地框')
    check(g and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iH'] - 3 * ch) < 2 and abs(g['iW'] - 2 * cw) < 2, f'衣柜图 2 格宽 × 3 格高，底边贴着占地底边（图底 {round(g["iB"],1)} / 占地底 {round(g["eB"],1)}）')
    check(g and g['iT'] >= g['rT'] - 0.5 and abs(g['iT'] - (f['y'] - 2 * ch)) < 6, f'靠墙那排：图往上正好盖满两格高的后墙，没被房间顶边裁掉（图顶 {round(g["iT"],1)}，房间顶 {round(g["rT"],1)}）')
    order = S(hp, "[...document.querySelectorAll('#roomFloor .furn')].map(e=>e.dataset.fid)")
    check(order.index('furn_lamp') < order.index('furn_bookshelf') and order.index('furn_wardrobe') < order.index('furn_bookshelf'), f'前后遮挡按底脚排：第 2 排的书架画在第 1 排的台灯 / 衣柜前面 {order}')
    sel = S(hp, "(()=>{const e=document.querySelector('#roomFloor .furn.sel'); return e&&[e.dataset.fid, getComputedStyle(e).outlineStyle, getComputedStyle(e.querySelector('.fn')).display]})()")
    check(sel and sel[0] == 'furn_wardrobe' and sel[1] != 'none' and sel[2] != 'none', f'摆下的衣柜自动选中：红框只框出脚下的占地范围、显示名字 {sel}')
    tdrag('#roomFloor .furn[data-fid="furn_wardrobe"]', 1, 3.5)
    w1 = titem('furn_wardrobe'); g = geo('furn_wardrobe')
    check(w1 and (w1['x'], w1['y']) == (0, 3) and g and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iH'] - 3 * ch) < 2, f'拖动衣柜到最前排 (0,3)：图跟着走，底脚还是贴着占地底边 {w1}')
    tdrag('#roomFloor .furn[data-fid="furn_wardrobe"]', 4, 1.5)
    check(titem('furn_wardrobe')['y'] == 3, '衣柜拖去和书架重叠：弹回原位')
    hp.locator('#roomFloor .furn[data-fid="furn_bookshelf"]').click(); hp.wait_for_timeout(250); hp.locator('[data-act="homeRot"]').click(); hp.wait_for_timeout(300)
    bk = titem('furn_bookshelf'); g = geo('furn_bookshelf')
    check(bk and bk['rot'] == 1 and g and 'matrix' not in g['tf'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - cw) < 2 and abs(g['iH'] - 1.5 * cw) < 2 and g['iT'] >= g['eT'] - 0.5, f'书架转 90°（占地 1×2）：图保持竖直不躺倒，缩成 1 格宽、底脚对齐、不超出占地 {bk}')
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(400)
    mi = S(hp, "['furn_bookshelf','furn_wardrobe'].map(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'), i=c&&c.querySelector('img'); if(!i) return false; const a=c.getBoundingClientRect(), b=i.getBoundingClientRect(); return b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.height>0})")
    check(mi == [True, True], f'商城里书架 / 衣柜的小图在方框内完整显示 {mi}')
    hp.locator('.book-tabs [data-arg="room"]').click(); hp.wait_for_timeout(400)
    hp.locator('#roomFloor .furn[data-fid="furn_bookshelf"]').click(); hp.wait_for_timeout(250); hp.locator('[data-act="homeRot"]').click(); hp.wait_for_timeout(300)
    hp.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; E.placeItem(s,'c77','furn_plant',2,0,0); __tzz.persist(); __tzz.renderTab();})()"); hp.wait_for_timeout(300)
    tview(); hp.wait_for_timeout(1200); hp.locator('#room').screenshot(path=f'{SHOTS}/home_tall.png')
    # 熊大第一 / 二组基础家具：桌子 2×2、冰箱 1×1 往上伸、沙发 3×1、地毯 3×2、绿植 / 台灯 1×1 往上伸
    NEW6 = ['table', 'fridge', 'sofa', 'rug', 'plant', 'lamp']
    ld6 = S(hp, "Promise.all(" + str(NEW6) + ".map(n=>new Promise(r=>{ if(!__tzz.FURN_ART[n]) return r(n+' 没登记'); const im=new Image(); im.onload=()=>r(im.naturalWidth>=200&&im.naturalHeight>0&&(n==='rug'||Math.abs(im.naturalHeight/im.naturalWidth-__tzz.FURN_UP[n])<0.01)?null:n+' '+im.naturalWidth+'×'+im.naturalHeight); im.onerror=()=>r(n+' 加载失败'); im.src='art/furn_'+n+'.webp';}))).then(a=>a.filter(Boolean))")
    check(ld6 == [], f'桌子 / 冰箱 / 沙发 / 地毯 / 绿植 / 台灯 图都登记了、能加载，往上伸的比例和图一致 {ld6}')
    hp.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.homes.c77.placed.slice().forEach(p=>E.storeItem(s,'c77',p.uid)); s.coins=1e7; ['furn_table','furn_fridge','furn_sofa','furn_rug'].forEach(f=>E.buyFurniture(s,f)); E.placeItem(s,'c77','furn_fridge',0,0,0); E.placeItem(s,'c77','furn_plant',5,0,0); E.placeItem(s,'c77','furn_lamp',4,0,0); E.placeItem(s,'c77','furn_rug',1,1,0); E.placeItem(s,'c77','furn_table',2,1,0); E.placeItem(s,'c77','furn_sofa',0,3,0); __tzz.persist(); __tzz.renderTab();})()"); hp.wait_for_timeout(400)
    f, cw, ch = tview()
    arts = S(hp, "['furn_table','furn_fridge','furn_sofa','furn_rug','furn_plant','furn_lamp'].map(f=>{const e=document.querySelector('#roomFloor .furn[data-fid='+f+']'); return !!(e&&e.classList.contains('art')&&e.querySelector('img'))})")
    check(arts == [True] * 6, f'房间里 6 件都显示图、不再是表情 {arts}')
    g = geo('furn_fridge')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - cw) < 2 and abs(g['iH'] - 512 / 240 * cw) < 3 and abs(g['eH'] - ch) < 1.5, f'冰箱占地 1×1，图 1 格宽、往上伸约 2.1 格高，底脚贴占地底边')
    g = geo('furn_sofa')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 3 * cw) < 2 and abs(g['eH'] - ch) < 1.5, f'沙发占地 3×1，图 3 格宽、底脚贴占地底边')
    g = geo('furn_table')
    check(g and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 2 * cw) < 2 and abs(g['eH'] - 2 * ch) < 1.5 and g['iT'] >= g['eT'] - 0.5, f'桌子占地 2×2，图 2 格宽、竖直站在占地里')
    g = geo('furn_rug')
    check(g and abs(g['iW'] - 3 * cw) < 2 and abs(g['iH'] - 2 * ch) < 2, f'地毯图铺满 3×2 占地')
    for n in ['furn_plant', 'furn_lamp']:
        g = geo(n); check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and g['iH'] > 1.5 * cw, f'{n} 1×1 往上伸、底脚贴占地底边')
    hp.wait_for_timeout(800); hp.locator('#room').screenshot(path=f'{SHOTS}/home_furn6.png')
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(400)
    mi = S(hp, "['furn_table','furn_fridge','furn_sofa','furn_rug','furn_plant','furn_lamp'].map(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'), i=c&&c.querySelector('img'); if(!i||!i.complete||!i.naturalWidth) return false; const a=c.getBoundingClientRect(), b=i.getBoundingClientRect(); return b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.height>0})")
    check(mi == [True] * 6, f'商城缩略图 6 件都换成图、在方框内完整显示 {mi}')
    hp.locator('.mall-card[data-fid="furn_fridge"]').scroll_into_view_if_needed(); hp.wait_for_timeout(300); hp.screenshot(path=f'{SHOTS}/mall_furn6.png')
    # 熊大第三组：电视 2×1、猫窝 1×1（正面图、底脚贴占地底边）、挂画 2×1 只上墙
    NEW3 = ['tv', 'catbed', 'painting']
    ld3 = S(hp, "Promise.all(" + str(NEW3) + ".map(n=>new Promise(r=>{ if(!__tzz.FURN_ART[n]) return r(n+' 没登记'); const im=new Image(); im.onload=()=>r(im.naturalWidth>=200&&im.naturalHeight>0&&(n==='painting'||Math.abs(im.naturalHeight/im.naturalWidth-__tzz.FURN_UP[n])<0.01)?null:n+' '+im.naturalWidth+'×'+im.naturalHeight); im.onerror=()=>r(n+' 加载失败'); im.src='art/furn_'+n+'.webp';}))).then(a=>a.filter(Boolean))")
    check(ld3 == [], f'电视 / 猫窝 / 挂画 图都登记了、能加载，比例和图一致 {ld3}')
    hp.locator('.book-tabs [data-arg="room"]').click(); hp.wait_for_timeout(400)
    r3 = S(hp, "(()=>{const s=__tzz.state,E=__tzz.E; s.homes.c77.placed.slice().forEach(p=>E.storeItem(s,'c77',p.uid)); s.coins=1e7; ['furn_tv','furn_catbed','furn_painting'].forEach(f=>E.buyFurniture(s,f)); const a=E.placeItem(s,'c77','furn_tv',1,2,0), b=E.placeItem(s,'c77','furn_catbed',4,3,0), c=E.placeItem(s,'c77','furn_painting',0,0,0,'wall'); __tzz.persist(); __tzz.renderTab(); return [a.ok,b.ok,c.ok,c.why||''];})()"); hp.wait_for_timeout(400)
    check(r3[:3] == [True, True, True], f'电视、猫窝摆地上，挂画挂墙上都成功 {r3}')
    f, cw, ch = tview()
    g = geo('furn_tv')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 2 * cw) < 2 and abs(g['eH'] - ch) < 1.5, f'电视占地 2×1，图 2 格宽、底脚贴占地底边')
    g = geo('furn_catbed')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - cw) < 2 and abs(g['eH'] - ch) < 1.5, f'猫窝占地 1×1，图 1 格宽、底脚贴占地底边')
    pw = S(hp, "(()=>{const e=document.querySelector('#wallGrid .furn[data-fid=furn_painting]'), i=e&&e.querySelector('img'); if(!e||!i||!i.complete||!i.naturalWidth) return null; const a=e.getBoundingClientRect(), b=i.getBoundingClientRect(); return {art:e.classList.contains('art'), inside:b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.left>=a.left-1&&b.right<=a.right+1, fl:document.querySelectorAll('#roomFloor .furn[data-fid=furn_painting]').length}})()")
    check(pw and pw['art'] and pw['inside'] and pw['fl'] == 0, f'挂画在墙面显示图、完整在框内、不在地板 {pw}')
    hp.wait_for_timeout(800); hp.locator('#room').screenshot(path=f'{SHOTS}/home_furn3.png')
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(400)
    mi3 = S(hp, "['furn_tv','furn_catbed','furn_painting'].map(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'), i=c&&c.querySelector('img'); if(!i||!i.complete||!i.naturalWidth) return false; const a=c.getBoundingClientRect(), b=i.getBoundingClientRect(); return b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.height>0})")
    check(mi3 == [True] * 3, f'商城缩略图电视 / 猫窝 / 挂画都换成图、在方框内完整显示 {mi3}')
    # 11v：packs 01–10 的 43 件（跳过已接入的云朵纱帐床）：图全登记、宽 = 占地×200（1 格 240）；地上件按图高/宽贴底，地毯铺满，墙饰只挂墙
    NEW43 = ["furn_s77_quilt_daybed", "furn_s77_drawer_bed", "furn_s77_book_nook_bed", "furn_s77_peg_cubby", "furn_s77_ladder_shelf", "furn_s77_basket_cabinet", "furn_s77_round_corner_chest", "furn_s77_sewing_cabinet", "furn_s77_pantry_hutch", "furn_s77_attic_trunk", "furn_s77_reading_stool", "furn_s77_rocking_chair", "furn_s77_heart_bench", "furn_s77_folding_tray", "furn_s77_quilt_ottoman", "furn_s77_window_bench", "furn_s77_sewing_desk", "furn_s77_curved_sectional", "furn_s77_lantern_stand", "furn_s77_mushroom_lamp", "furn_s77_petal_uplight", "furn_s77_quilt_shade_lamp", "furn_s77_hearth_light", "furn_s77_box_fan", "furn_s77_toaster_cart", "furn_s77_record_console", "furn_s77_sewing_machine_stand", "furn_s77_stove_oven", "furn_s77_laundry_pair", "furn_s77_braided_runner", "furn_s77_patchwork_flower_rug", "furn_s77_quilt_island_rug", "furn_s77_embroidery_hoops", "furn_s77_wood_cuckoo", "furn_s77_quilt_wall", "furn_s77_pressed_flower_frame", "furn_s77_family_silhouette", "furn_s77_watering_stand", "furn_s77_knitting_basket", "furn_s77_olive_planter", "furn_s77_mini_greenhouse", "furn_pearl_tea_daybed", "furn_pearl_pearl_bed"]
    l43 = S(hp, "Promise.all(" + json.dumps(NEW43) + ".map(id=>new Promise(r=>{ const f=__tzz.E.FURN_BY_ID[id], n=id.replace(/^furn_/,''); if(!f) return r(id+' 不在商城'); if(!__tzz.FURN_ART[n]) return r(n+' 没登记图'); const im=new Image(); im.onload=()=>{ const W=f.w===1?240:f.w*200, k=im.naturalHeight/im.naturalWidth; let bad=im.naturalWidth!==W; if(f.layer==='rug') bad=bad||Math.abs(k-f.h/f.w)>0.01||!!__tzz.FURN_UP[n]; else if(f.wall) bad=bad||!!__tzz.FURN_UP[n]; else bad=bad||!__tzz.FURN_UP[n]||Math.abs(k-__tzz.FURN_UP[n])>0.01; r(bad?n+' '+im.naturalWidth+'×'+im.naturalHeight:null); }; im.onerror=()=>r(n+' 加载失败'); im.src='art/furn_'+n+'.webp?v='+Date.now();}))).then(a=>a.filter(Boolean))")
    check(len(NEW43) == 43 and l43 == [], f'11v 43 件图都登记、能加载，宽 = 占地×200（1 格 240），往上伸比例 / 地毯铺满比例对得上 {l43}')
    r43 = S(hp, "(()=>{const s=__tzz.state,E=__tzz.E; s.homes.c77.placed.slice().forEach(p=>E.storeItem(s,'c77',p.uid)); s.coins=1e9; ['furn_s77_curved_sectional','furn_s77_pantry_hutch','furn_s77_petal_uplight','furn_s77_braided_runner','furn_s77_quilt_wall','furn_s77_drawer_bed'].forEach(f=>E.buyFurniture(s,f)); const a=[E.placeItem(s,'c77','furn_s77_curved_sectional',0,2,0), E.placeItem(s,'c77','furn_s77_pantry_hutch',0,0,0), E.placeItem(s,'c77','furn_s77_petal_uplight',2,0,0), E.placeItem(s,'c77','furn_s77_braided_runner',5,1,0), E.placeItem(s,'c77','furn_s77_quilt_wall',0,0,0,'wall'), E.placeItem(s,'c77','furn_s77_drawer_bed',3,1,0)]; __tzz.persist(); __tzz.renderTab(); return a.map(x=>x.ok?1:x.why);})()")
    check(r43 == [1] * 6, f'摆 11v 新件：转角沙发 3×2 / 餐具柜 2×1 / 上照灯 1×1 / 长廊毯 1×3（垫在床边）/ 挂毯 2×2 上墙 / 抽屉床 2×2 都成功 {r43}')
    hp.locator('.book-tabs [data-arg="room"]').click(); hp.wait_for_timeout(600)
    f, cw, ch = tview()
    g = geo('furn_s77_curved_sectional')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 3 * cw) < 2 and abs(g['eH'] - 2 * ch) < 1.5 and g['iT'] >= g['eT'] - 0.5, f'花瓣转角沙发占地 3×2（索引 3×3 实测改），图 3 格宽、贴底、不超出占地')
    g = geo('furn_s77_pantry_hutch')
    check(g and g['tall'] and g['ov'] == 'visible' and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 2 * cw) < 2 and abs(g['iH'] - min(693 / 400 * 2, 3) * ch) < 3 and abs(g['eH'] - ch) < 1.5, f'玻璃餐具柜占地 2×1，图往上伸（11z 起最高到房间顶边 = 占地 + 2 格后墙，等比缩不裁）、底脚贴占地底边')
    g = geo('furn_s77_petal_uplight')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - cw) < 2 and g['iH'] > 2 * cw, f'花瓣上照灯 1×1 往上伸、底脚贴占地底边')
    g = geo('furn_s77_braided_runner')
    check(g and not g['tall'] and abs(g['iW'] - cw) < 2 and abs(g['iH'] - 3 * ch) < 2, f'麻花长廊毯铺满 1×3 占地')
    g = geo('furn_s77_drawer_bed')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 2 * cw) < 2 and abs(g['eH'] - 2 * ch) < 1.5, f'抽屉收纳床占地 2×2（11w 熊大拍板），图 2 格宽、贴底')
    qw = S(hp, "(()=>{const e=document.querySelector('#wallGrid .furn[data-fid=furn_s77_quilt_wall]'), i=e&&e.querySelector('img'); if(!e||!i||!i.complete||!i.naturalWidth) return null; const a=e.getBoundingClientRect(), b=i.getBoundingClientRect(); return {art:e.classList.contains('art'), inside:b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.left>=a.left-1&&b.right<=a.right+1, fl:document.querySelectorAll('#roomFloor .furn[data-fid=furn_s77_quilt_wall]').length}})()")
    check(qw and qw['art'] and qw['inside'] and qw['fl'] == 0, f'拼布故事挂毯挂在墙面、显示图、完整在框内 {qw}')
    hp.locator('#roomFloor .furn[data-fid="furn_s77_drawer_bed"]').click(); hp.wait_for_timeout(300)
    hp.wait_for_timeout(800); hp.locator('#room').screenshot(path=f'{SHOTS}/home_11v.png')
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(400)
    hp.wait_for_function("[...document.querySelectorAll('.mall-card .furn-ico img')].every(i=>i.complete)", timeout=20000)
    mi43 = S(hp, json.dumps(NEW43) + ".filter(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'), i=c&&c.querySelector('img'); if(!i||!i.complete||!i.naturalWidth) return true; const a=c.getBoundingClientRect(), b=i.getBoundingClientRect(); return !(b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.height>0)})")
    check(mi43 == [], f'商城里 43 件新家具都有卡片、缩略图加载并在方框内完整显示 {mi43}')
    hp.locator('.mall-card[data-fid="furn_s77_curved_sectional"]').scroll_into_view_if_needed(); hp.wait_for_timeout(300); hp.screenshot(path=f'{SHOTS}/mall_11v.png')

    # 11w 熊大拍板占地 + 底边迁移：旧档坐标按脚重锚；两张床都能休息；二次迁移跳过
    mig = S(hp, """(()=>{const E=__tzz.E; const raw={v:3,coins:777,totalEarned:777,homes:{c77:{lv:1,next:5,placed:[
      {uid:'u1',fid:'furn_s77_drawer_bed',x:1,y:0,rot:0,surf:'floor'},
      {uid:'u2',fid:'furn_pearl_pearl_bed',x:3,y:1,rot:0,surf:'floor'},
      {uid:'u3',fid:'furn_s77_rocking_chair',x:5,y:2,rot:0,surf:'floor'},
      {uid:'u4',fid:'furn_s77_quilt_shade_lamp',x:0,y:2,rot:0,surf:'floor'}]}},furnInv:{},ceos:{c77:{unlocked:true,lv:1,at:0},pearl:{unlocked:false,lv:1,at:-1},otaku:{unlocked:false,lv:1,at:-1},rocket:{unlocked:false,lv:1,at:-1}},shops:[{open:true,lv:1,emp:1},{open:false,lv:0,emp:0},{open:false,lv:0,emp:0},{open:false,lv:0,emp:0}]};
      const st=E.migrate(raw,Date.now()).st; const m1=E.migrateFootprint11w(st); const by=Object.fromEntries(st.homes.c77.placed.map(p=>[p.uid,p]));
      const m2=E.migrateFootprint11w(st);
      return {shifted:m1.shifted,stored:m1.stored,skip2:!!m2.skipped,coins:st.coins,
        y1:by.u1&&by.u1.y,y2:by.u2&&by.u2.y,y3:by.u3&&by.u3.y,y4:by.u4&&by.u4.y,
        rest:E.furnLiveAct('furn_s77_drawer_bed')==='rest'&&E.furnLiveAct('furn_pearl_pearl_bed')==='rest',
        wh:[E.FURN_BY_ID.furn_s77_drawer_bed.h,E.FURN_BY_ID.furn_pearl_pearl_bed.h,E.FURN_BY_ID.furn_s77_rocking_chair.h,E.FURN_BY_ID.furn_s77_quilt_shade_lamp.h,E.FURN_BY_ID.furn_s77_curved_sectional.h]};})()""")
    check(mig and mig['stored']==0 and mig['y1']==1 and mig['y2']==2 and mig['y3']==3 and mig['y4']==3 and mig['skip2'] and mig['coins']==777 and mig['rest'] and mig['wh']==[2,2,1,1,2], f'11w 占地迁移底边锚定 + 只跑一次 + 两床休息 + 金币不变 {mig}')

    # 11w：packs 13/16/19/27/30/33/36/39 的 34 件：图全登记、能加载、尺寸比例对；摆放 / 贴底 / 铺满；商城缩略图
    NEW34 = ["furn_pearl_cup_carousel", "furn_pearl_bakery_display", "furn_pearl_sideboard_island", "furn_pearl_archive_apothecary", "furn_pearl_conversation_pit", "furn_pearl_tea_gongfu_desk", "furn_pearl_paper_pear_lamp", "furn_pearl_tea_glass_lamp", "furn_pearl_boba_globe_lamp", "furn_pearl_tea_mat", "furn_pearl_scallop_rug", "furn_pearl_tea_river_runner", "furn_otaku_floor_chair", "furn_otaku_modular_couch", "furn_otaku_arcade_bench", "furn_otaku_streaming_desk", "furn_otaku_panel_rug", "furn_otaku_controller_rug", "furn_otaku_speed_runner", "furn_otaku_pixel_succulent", "furn_otaku_manga_book_stack", "furn_otaku_robot_planter", "furn_otaku_aquatic_pixel_tank", "furn_rocket_field_cot", "furn_rocket_cargo_crate", "furn_rocket_mesh_rack", "furn_rocket_airlock_wardrobe", "furn_rocket_rail_bench", "furn_rocket_mission_table", "furn_rocket_zero_g_lounger", "furn_rocket_cage_lamp", "furn_rocket_tripod_searchlight", "furn_rocket_pipe_valve_lamp", "furn_rocket_rocket_nozzle_light"]
    l34 = S(hp, "Promise.all(" + json.dumps(NEW34) + ".map(id=>new Promise(r=>{ const f=__tzz.E.FURN_BY_ID[id], n=id.replace(/^furn_/,''); if(!f) return r(id+' 不在商城'); if(!__tzz.FURN_ART[n]) return r(n+' 没登记图'); const im=new Image(); im.onload=()=>{ const W=f.w===1?240:f.w*200, k=im.naturalHeight/im.naturalWidth; let bad=im.naturalWidth!==W; if(f.layer==='rug') bad=bad||Math.abs(k-f.h/f.w)>0.01||!!__tzz.FURN_UP[n]; else bad=bad||!__tzz.FURN_UP[n]||Math.abs(k-__tzz.FURN_UP[n])>0.01; r(bad?n+' '+im.naturalWidth+'×'+im.naturalHeight:null); }; im.onerror=()=>r(n+' 加载失败'); im.src='art/furn_'+n+'.webp?v='+Date.now();}))).then(a=>a.filter(Boolean))")
    check(len(NEW34) == 34 and l34 == [], f'11w 34 件图都登记、能加载，宽 = 占地×200（1 格 240），往上伸 / 地毯铺满比例对得上 {l34}')
    mi34 = S(hp, json.dumps(NEW34) + ".filter(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'); if(!c) return true; c.scrollIntoView(); return false})")
    check(mi34 == [], f'商城里 34 件 11w 新家具都有卡片 {mi34}')
    hp.wait_for_function("[...document.querySelectorAll('.mall-card .furn-ico img')].every(i=>i.complete)", timeout=20000)
    mi34 = S(hp, json.dumps(NEW34) + ".filter(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'), i=c&&c.querySelector('img'); if(!i||!i.complete||!i.naturalWidth) return true; const a=c.getBoundingClientRect(), b=i.getBoundingClientRect(); return !(b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.height>0)})")
    check(mi34 == [], f'商城 34 件 11w 缩略图加载并在方框内完整显示 {mi34}')
    hp.locator('.mall-card[data-fid="furn_pearl_conversation_pit"]').scroll_into_view_if_needed(); hp.wait_for_timeout(300); hp.screenshot(path=f'{SHOTS}/mall_11w.png')
    r34 = S(hp, "(()=>{const s=__tzz.state,E=__tzz.E; s.homes.c77.placed.slice().forEach(p=>E.storeItem(s,'c77',p.uid)); s.coins=1e9; ['furn_otaku_controller_rug','furn_pearl_conversation_pit','furn_rocket_airlock_wardrobe','furn_pearl_tea_glass_lamp','furn_rocket_field_cot'].forEach(f=>E.buyFurniture(s,f)); const a=[E.placeItem(s,'c77','furn_otaku_controller_rug',0,2,0), E.placeItem(s,'c77','furn_pearl_conversation_pit',0,2,0), E.placeItem(s,'c77','furn_rocket_airlock_wardrobe',0,0,0), E.placeItem(s,'c77','furn_pearl_tea_glass_lamp',2,0,0), E.placeItem(s,'c77','furn_rocket_field_cot',4,1,0)]; __tzz.persist(); __tzz.renderTab(); return a.map(x=>x.ok?1:x.why);})()")
    check(r34 == [1] * 5, f'摆 11w 新件：手柄绒毯 3×2 上叠茶会沙发 3×2 / 气闸衣柜 2×1 / 立柱灯 1×1 / 行军床 2×3 都成功 {r34}')
    hp.locator('.book-tabs [data-arg="room"]').click(); hp.wait_for_timeout(600)
    f, cw, ch = tview()
    g = geo('furn_pearl_conversation_pit')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 3 * cw) < 2 and abs(g['eH'] - 2 * ch) < 1.5, f'环形茶会沙发占地 3×2（索引 3×3 实测改），图 3 格宽、贴底')
    g = geo('furn_rocket_airlock_wardrobe')
    check(g and g['tall'] and g['ov'] == 'visible' and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 2 * cw) < 2 and abs(g['iH'] - min(633 / 400 * 2, 3) * ch) < 3 and abs(g['eH'] - ch) < 1.5, f'气闸圆门衣柜占地 2×1，图往上伸（最高到房间顶边）、底脚贴占地底边')
    g = geo('furn_pearl_tea_glass_lamp')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - cw) < 2 and abs(g['iH'] - 3 * ch) < 2, f'茶玻璃立柱灯 1×1 往上伸到房间顶边（原图约 4.2 格高，11z 起等比缩到 3 格不被裁）、底脚贴底')
    g = geo('furn_otaku_controller_rug')
    check(g and not g['tall'] and abs(g['iW'] - 3 * cw) < 2 and abs(g['iH'] - 2 * ch) < 2, f'手柄轮廓绒毯铺满 3×2 占地')
    g = geo('furn_rocket_field_cot')
    check(g and g['tall'] and abs(g['iB'] - g['eB']) < 1.5 and abs(g['iW'] - 2 * cw) < 2 and abs(g['eH'] - 3 * ch) < 1.5, f'折叠行军床占地 2×3（按索引），图 2 格宽、贴底')
    hp.wait_for_timeout(800); hp.locator('#room').screenshot(path=f'{SHOTS}/home_11w.png')
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(400)
    # 11y：missing107 的 106 件新 ID（capsule 仅换 art）：图全登记、能加载、尺寸比例对；地毯铺满 / 墙饰挂墙；商城缩略图
    NEW106 = ["furn_pearl_tea_loft", "furn_pearl_canopy_lounge", "furn_pearl_capsule_daybed", "furn_pearl_tea_cat_hammock", "furn_pearl_tea_cubby", "furn_pearl_glass_wardrobe", "furn_pearl_rattan_bookcase", "furn_pearl_tea_trolley_shelf", "furn_pearl_tea_stool", "furn_pearl_cafe_chair", "furn_pearl_round_tea_table", "furn_pearl_scallop_sofa", "furn_pearl_tea_bar", "furn_pearl_bar_stool", "furn_pearl_picnic_table", "furn_pearl_egg_swing", "furn_pearl_fan_shade_lamp", "furn_pearl_tea_arc_lamp", "furn_pearl_fountain_light", "furn_pearl_tea_kettle_cart", "furn_pearl_juice_press", "furn_pearl_milk_frother_bar", "furn_pearl_tea_brewer", "furn_pearl_dessert_chiller", "furn_pearl_marble_pearl_rug", "furn_pearl_tea_menu_board", "furn_pearl_cup_wall_rack", "furn_pearl_sunburst_mirror", "furn_pearl_tea_leaf_relief", "furn_pearl_moon_window_art", "furn_pearl_herb_crate", "furn_pearl_tea_bonsai", "furn_pearl_ceramic_cup_stack", "furn_pearl_terrarium_orb", "furn_pearl_tea_tree_screen", "furn_otaku_floor_futon", "furn_otaku_sofa_sleeper", "furn_otaku_bunk_manga", "furn_otaku_gaming_pod", "furn_otaku_projector_bed", "furn_otaku_cat_keyboard_cave", "furn_otaku_locker_wardrobe", "furn_otaku_disc_tower", "furn_otaku_figure_vitrine", "furn_otaku_comic_wheel_cart", "furn_otaku_controller_drawers", "furn_otaku_modular_pixel_shelf", "furn_otaku_server_display_rack", "furn_otaku_beanbag", "furn_otaku_kotatsu", "furn_otaku_gaming_chair", "furn_otaku_manga_desk", "furn_otaku_snack_sidecar", "furn_otaku_cocoon_lounger", "furn_otaku_panel_lamp", "furn_otaku_gooseneck_stand", "furn_otaku_pixel_cube_light", "furn_otaku_arcade_marquee_lamp", "furn_otaku_orbital_neon_floor", "furn_otaku_sleep_timer_totem", "furn_otaku_mini_fridge", "furn_otaku_console_station", "furn_otaku_arcade_cabinet", "furn_otaku_projector_cart", "furn_otaku_triple_monitor_station", "furn_otaku_pixel_map_rug", "furn_otaku_speech_bubble_board", "furn_otaku_manga_page_triptych", "furn_otaku_controller_wall_mount", "furn_otaku_pixel_city_lightbox", "furn_otaku_cactus_cartridge", "furn_rocket_steel_platform_bed", "furn_rocket_cryo_rest_pod", "furn_rocket_observatory_bed", "furn_rocket_landing_cat_pod", "furn_rocket_steel_locker", "furn_rocket_pipe_bookcase", "furn_rocket_tool_chest", "furn_rocket_specimen_drawer", "furn_rocket_orbital_archive", "furn_rocket_bolt_stool", "furn_rocket_workbench", "furn_rocket_drafting_chair", "furn_rocket_pipe_sofa", "furn_rocket_oil_drum_table", "furn_rocket_captain_chair", "furn_rocket_cantilever_desk", "furn_rocket_orbital_ring_lamp", "furn_rocket_solar_array_lamp", "furn_rocket_industrial_fan", "furn_rocket_vacuum_dock", "furn_rocket_coffee_pressure_unit", "furn_rocket_air_purifier", "furn_rocket_hydroponic_unit", "furn_rocket_planetarium_console", "furn_rocket_workshop_mat", "furn_rocket_orbit_rug", "furn_rocket_runway_runner", "furn_rocket_lunar_relief_rug", "furn_rocket_blueprint_frame", "furn_rocket_gear_clock", "furn_rocket_mission_patch_board", "furn_rocket_moon_sample_relief", "furn_rocket_orbital_map_panel", "furn_rocket_concrete_succulent", "furn_rocket_pipe_vase"]
    l106 = S(hp, "Promise.all(" + json.dumps(NEW106) + ".map(id=>new Promise(r=>{ const f=__tzz.E.FURN_BY_ID[id], n=id.replace(/^furn_/,''); if(!f) return r(id+' 不在商城'); if(!__tzz.FURN_ART[n]) return r(n+' 没登记图'); const im=new Image(); im.onload=()=>{ const W=f.w===1?240:f.w*200, k=im.naturalHeight/im.naturalWidth; let bad=im.naturalWidth!==W; if(f.layer==='rug') bad=bad||Math.abs(k-f.h/f.w)>0.01||!!__tzz.FURN_UP[n]; else if(f.wall) bad=bad||!!__tzz.FURN_UP[n]; else bad=bad||!__tzz.FURN_UP[n]||Math.abs(k-__tzz.FURN_UP[n])>0.01; r(bad?n+' '+im.naturalWidth+'×'+im.naturalHeight:null); }; im.onerror=()=>r(n+' 加载失败'); im.src='art/furn_'+n+'.webp?v='+Date.now();}))).then(a=>a.filter(Boolean))")
    check(len(NEW106) == 106 and l106 == [], f'11y 106 件图都登记、能加载，宽 = 占地×200（1 格 240），往上伸 / 地毯铺满 / 墙饰比例对得上 {l106}')
    mi106 = S(hp, json.dumps(NEW106) + ".filter(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'); if(!c) return true; c.scrollIntoView(); return false})")
    check(mi106 == [], f'商城里 106 件 11y 新家具都有卡片 {mi106}')
    hp.wait_for_function("[...document.querySelectorAll('.mall-card .furn-ico img')].every(i=>i.complete)", timeout=60000)
    mi106 = S(hp, json.dumps(NEW106) + ".filter(f=>{const c=document.querySelector('.mall-card[data-fid='+f+'] .furn-ico'), i=c&&c.querySelector('img'); if(!i||!i.complete||!i.naturalWidth) return true; const a=c.getBoundingClientRect(), b=i.getBoundingClientRect(); return !(b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.height>0)})")
    check(mi106 == [], f'商城 106 件 11y 缩略图加载并在方框内完整显示 {mi106}')
    hp.locator('.mall-card[data-fid="furn_otaku_disc_tower"]').scroll_into_view_if_needed(); hp.wait_for_timeout(300); hp.screenshot(path=f'{SHOTS}/mall_11y.png')
    r106 = S(hp, "(()=>{const s=__tzz.state,E=__tzz.E; s.homes.c77.placed.slice().forEach(p=>E.storeItem(s,'c77',p.uid)); s.coins=1e9; ['furn_rocket_orbit_rug','furn_otaku_disc_tower','furn_otaku_panel_lamp','furn_rocket_orbital_ring_lamp','furn_otaku_sleep_timer_totem','furn_rocket_blueprint_frame'].forEach(f=>E.buyFurniture(s,f)); const a=[E.placeItem(s,'c77','furn_rocket_orbit_rug',0,2,0), E.placeItem(s,'c77','furn_otaku_disc_tower',0,0,0), E.placeItem(s,'c77','furn_otaku_panel_lamp',1,0,0), E.placeItem(s,'c77','furn_rocket_orbital_ring_lamp',2,0,0), E.placeItem(s,'c77','furn_otaku_sleep_timer_totem',3,0,0), E.placeItem(s,'c77','furn_rocket_blueprint_frame',0,0,0)]; __tzz.persist(); __tzz.renderTab(); return a.map(x=>x.ok?1:x.why);})()")
    check(r106 == [1] * 6, f'摆 11y 特殊件：轨道圆毯 / 光盘塔 / 面板灯 / 轨道灯 / 计时图腾 / 蓝图框 都成功 {r106}')
    hp.locator('.book-tabs [data-arg="room"]').click(); hp.wait_for_timeout(600)
    hp.wait_for_timeout(800); hp.locator('#room').screenshot(path=f'{SHOTS}/home_11y.png')
    hp.locator('.book-tabs [data-arg="mall"]').click(); hp.wait_for_timeout(400)
    em = S(hp, "__tzz.E.FURNITURE.filter(f=>!__tzz.FURN_ART[f.id.replace(/^furn_/,'')]).map(f=>f.id)")
    check(em == [], f'商城全部 {S(hp, "__tzz.E.FURNITURE.length")} 件家具都有图，没有表情占位了 {em}')
    hc.close()

    print('== 8z. 11z：4 张跨行漫画整图 / 文字兜底 / 短屏；9 件占地迁移 fpMig11z；靠后墙超高件不被顶边裁 ==')
    CROSS4 = {'rocket@0': ('cross_rocket_bbq', '火箭烤炉'), 'c77@3': ('cross_c77_tech', '麻辣服务器'), 'pearl@2': ('cross_pearl_book', '奶茶漫画联名'), 'otaku@1': ('cross_otaku_tea', '漫画杯套')}
    for dname in ['iPhone 15', 'iPhone SE']:
        zc = b.new_context(**p.devices[dname]); zp = zc.new_page(); hook(zp, 'cross-' + dname)
        zp.goto(URL); zp.evaluate("localStorage.clear()"); zp.reload(); zp.wait_for_timeout(800); close_modals(zp)
        zp.evaluate("(()=>{const s=__tzz.state; ['c77','pearl','otaku','rocket'].forEach(id=>s.ceos[id].unlocked=true); __tzz.persist();})()")
        for k, (fn, title) in CROSS4.items():
            zp.evaluate(f"__tzz.showComic('{k}', true)"); zp.wait_for_timeout(250)
            zp.wait_for_function("(()=>{const i=document.querySelector('#mpanel .cross-art img'); return i&&i.complete})()", timeout=8000)
            g = S(zp, """(()=>{const i=document.querySelector('#mpanel .cross-art img'), mp=document.querySelector('#mpanel').getBoundingClientRect(); const r=i&&i.getBoundingClientRect(); const ok=document.querySelector('#mOk').getBoundingClientRect();
              return {nw:i&&i.naturalWidth, src:i&&i.getAttribute('src'), w:r&&r.width, h:r&&r.height, l:r&&r.left, rt:r&&r.right, vw:innerWidth, vh:innerHeight, mpB:mp.bottom, mpT:mp.top,
                cap:document.querySelector('#mpanel .cross-cap').innerText, panelsHidden:getComputedStyle(document.querySelector('#mpanel .comic.two')).display==='none', okH:ok.height, seen:!!__tzz.state.crossSeen[%s]};})()""" % json.dumps(k))
            okv = g and g['nw'] == 480 and fn in g['src'] and g['w'] >= 170 and abs(g['w'] - g['h']) < 1.5 and g['l'] >= 0 and g['rt'] <= g['vw'] and g['mpB'] <= g['vh'] + 0.5 and g['mpT'] >= -0.5 and len(g['cap']) > 8 and g['panelsHidden'] and g['seen']
            check(okv, f"{dname} {title}：整图 {g and round(g['w'])}px 方图在屏内、两句文字在、弹窗 {g and round(g['mpT'])}–{g and round(g['mpB'])} ≤ 屏高 {g and g['vh']}、标记已看 {g and {kk: g[kk] for kk in ['nw','panelsHidden','seen']}}")
            zp.locator('#mOk').scroll_into_view_if_needed(); vis = S(zp, "(()=>{const r=document.querySelector('#mOk').getBoundingClientRect(); return r.top>=0&&r.bottom<=innerHeight})()")
            check(vis, f'{dname} {title}：「知道了」按钮能看到能点')
            if k == 'pearl@2': zp.wait_for_timeout(700); zp.screenshot(path=f"{SHOTS}/cross11z_{dname.replace(' ','_')}.png")
            zp.click('#mOk'); zp.wait_for_timeout(250)
        # 跨行组合重看：CEO 页「跨行组合」按钮（非首次 fresh=false）
        zp.locator('#bottomNav [data-tab="ceo"]').click(); zp.wait_for_timeout(400)
        for k, (fn, title) in CROSS4.items():
            zp.locator(f'.cross-item[data-arg="{k}"]').scroll_into_view_if_needed(); zp.locator(f'.cross-item[data-arg="{k}"]').click(); zp.wait_for_timeout(300)
            zp.wait_for_function("(()=>{const i=document.querySelector('#mpanel .cross-art img'); return i&&i.complete})()", timeout=8000)
            rv = S(zp, "(()=>{const i=document.querySelector('#mpanel .cross-art img'); return {n:i&&i.naturalWidth, src:i&&i.getAttribute('src'), b:document.querySelector('#mpanel .mbubble').innerText}})()")
            check(rv['n'] == 480 and fn in rv['src'] and '跨行组合' in rv['b'], f'{dname} 跨行组合重看「{title}」：整图照样显示 {rv}')
            zp.click('#mOk'); zp.wait_for_timeout(250)
        if dname == 'iPhone 15':
            # 文字兜底：图坏了自动退回两格头像 + 文字
            ne = len(errs); zp.evaluate("__tzz.CROSS_ART['otaku@1']='cross_missing_test'; __tzz.showComic('otaku@1', false)"); zp.wait_for_timeout(1200)
            errs[ne:] = [e for e in errs[ne:] if not ('cross_missing_test' in e or 'Failed to load resource' in e)]   # 故意制造的坏图，不算错误
            fb = S(zp, "(()=>({art:!!document.querySelector('#mpanel .cross-art'), has:!!document.querySelector('#mpanel .cross-wrap.has-art'), panels:[...document.querySelectorAll('#mpanel .comic.two .panel4')].filter(e=>e.offsetParent).length, txt:document.querySelector('#mpanel').innerText}))()")
            check(not fb['art'] and not fb['has'] and fb['panels'] == 2 and '结尾呢' in fb['txt'], f"整图加载失败 → 自动退回两格头像 + 文字 {dict((kk, fb[kk]) for kk in ['art','has','panels'])}")
            zp.click('#mOk'); zp.wait_for_timeout(200)
        zc.close()

    print('== 8z1. 11z1：4 张跨行漫画弹窗标题完整可见（刚打开 / 滚到底再回顶）+ 点图放大复用大图弹窗 ==')
    TITLE_JS = """(()=>{const mp=document.querySelector('#mpanel'), R=mp.getBoundingClientRect(), bl=mp.clientTop||0;
      const vis=e=>{const r=e.getBoundingClientRect(); return {t:Math.round(r.top), b:Math.round(r.bottom), ok:r.top>=Math.max(0,R.top+bl)-0.5 && r.bottom<=Math.min(innerHeight,R.bottom-bl)+0.5 && r.height>0};};
      const t=document.querySelector('#mpanel .mtitle'), bb=document.querySelector('#mpanel .mbubble'), ok=document.querySelector('#mOk');
      return {title:t.innerText, tv:vis(t), bv:vis(bb), okv:vis(ok), st:Math.round(mp.scrollTop), sh:mp.scrollHeight, ch:mp.clientHeight, vh:innerHeight};})()"""
    for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
        dn = dname.replace(' ', '_').replace('(', '').replace(')', '')
        zc = b.new_context(**p.devices[dname]); zp = zc.new_page(); hook(zp, 'zoom-' + dname)
        zp.goto(URL); zp.evaluate("localStorage.clear()"); zp.reload(); zp.wait_for_timeout(800); close_modals(zp)
        zp.evaluate("(()=>{const s=__tzz.state; ['c77','pearl','otaku','rocket'].forEach(id=>s.ceos[id].unlocked=true); __tzz.persist();})()")
        for k, (fn, title) in CROSS4.items():
            kk = k.replace('@', '')
            zp.evaluate(f"__tzz.showComic('{k}', true)")
            zp.wait_for_function("(()=>{const i=document.querySelector('#mpanel .cross-art img'); return i&&i.complete&&i.naturalWidth>0})()", timeout=8000); zp.wait_for_timeout(600)
            a = S(zp, TITLE_JS)
            check(a['st'] == 0 and a['tv']['ok'] and a['bv']['ok'] and title in a['title'], f"{dname} {title} 刚打开：标题「{a['title']}」和角标完整可见（标题 y {a['tv']['t']}–{a['tv']['b']}，弹窗可滚 {a['sh']-a['ch']}px）")
            zp.screenshot(path=f"{SHOTS}/z1_{dn}_{kk}_1open.png")
            zp.evaluate("(()=>{const mp=document.querySelector('#mpanel'); mp.scrollTop=mp.scrollHeight;})()"); zp.wait_for_timeout(300)
            bt = S(zp, TITLE_JS)
            check(bt['okv']['ok'], f"{dname} {title} 滚到底：「知道了」完整可见（滚了 {bt['st']}px）")
            zp.screenshot(path=f"{SHOTS}/z1_{dn}_{kk}_2bottom.png")
            zp.evaluate("document.querySelector('#mpanel').scrollTop=0"); zp.wait_for_timeout(300)
            tp = S(zp, TITLE_JS)
            check(tp['st'] == 0 and tp['tv']['ok'] and tp['bv']['ok'], f"{dname} {title} 滚回顶部：标题和角标完整可见")
            zp.screenshot(path=f"{SHOTS}/z1_{dn}_{kk}_3top.png")
            # 点图放大
            sw = S(zp, "document.querySelector('#mpanel .cross-art img').getBoundingClientRect().width")
            hint = S(zp, "(()=>{const z=document.querySelector('#crossZoom'); return z&&z.tagName==='BUTTON'&&z.innerText.includes('点图放大')})()")
            zp.click('#crossZoom'); zp.wait_for_function("(()=>{const i=document.querySelector('#crossBigImg'); return i&&i.complete&&i.naturalWidth>0})()", timeout=8000); zp.wait_for_timeout(400)
            zb = S(zp, """(()=>{const i=document.querySelector('#crossBigImg'), r=i.getBoundingClientRect(), mp=document.querySelector('#mpanel'), M=mp.getBoundingClientRect(), ok=document.querySelector('#mOk').getBoundingClientRect();
              return {nw:i.naturalWidth, src:i.getAttribute('src'), w:r.width, h:r.height, inV:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight, panelIn:M.top>=-0.5&&M.bottom<=innerHeight+0.5&&M.left>=0&&M.right<=innerWidth,
                okIn:ok.top>=0&&ok.bottom<=innerHeight, okTxt:document.querySelector('#mOk').innerText, bigWrap:!!i.closest('.job-big'), zoom:mp.classList.contains('zoom'), scroll:mp.scrollHeight-mp.clientHeight, vw:innerWidth}})()""")
            check(hint and zb['nw'] == 480 and fn in zb['src'] and zb['bigWrap'] and zb['zoom'] and zb['w'] >= sw * 1.1 and abs(zb['w'] - zb['h']) < 1.5 and zb['inV'] and zb['panelIn'] and zb['okIn'] and zb['scroll'] <= 1 and '返回' in zb['okTxt'],
                  f"{dname} {title} 点图放大：大图弹窗 {round(sw)}px → {round(zb['w'])}px（屏宽 {zb['vw']}），整图和「返回漫画」都在屏内不用滚")
            zp.screenshot(path=f"{SHOTS}/z1_{dn}_{kk}_4zoom.png")
            zp.click('#mOk'); zp.wait_for_timeout(350)
            bk = S(zp, "(()=>({b:document.querySelector('#mpanel .mbubble').innerText, t:document.querySelector('#mpanel .mtitle').innerText, img:!!document.querySelector('#mpanel .cross-art img'), st:document.querySelector('#mpanel').scrollTop, zoom:document.querySelector('#mpanel').classList.contains('zoom')}))()")
            check('跨行事件' in bk['b'] and title in bk['t'] and bk['img'] and bk['st'] == 0 and not bk['zoom'], f"{dname} {title} 放大后「返回漫画」：回到原漫画（角标仍是「{bk['b']}」、标题在顶部）")
            zp.click('#mOk'); zp.wait_for_timeout(250)
            check(not modal_visible(zp), f"{dname} {title}：「知道了」关闭弹窗")
        if dname == 'iPhone 15':
            # 连弹两张时放大再返回，排队的下一张不丢；点大图本身也能返回；放大不重复记已看
            zp.evaluate("(()=>{const s=__tzz.state; delete s.crossSeen['rocket@0']; delete s.crossSeen['c77@3']; __tzz.persist(); __tzz.queueModal(()=>__tzz.showComic('rocket@0', true)); __tzz.queueModal(()=>__tzz.showComic('c77@3', true));})()")
            zp.wait_for_timeout(500); zp.click('#crossZoom'); zp.wait_for_timeout(400)
            zp.click('#crossBigImg'); zp.wait_for_timeout(350)
            q1 = S(zp, "document.querySelector('#mpanel .mtitle').innerText"); zp.click('#mOk'); zp.wait_for_timeout(600)
            q2 = S(zp, "(()=>({t:document.querySelector('#mpanel .mtitle')&&document.querySelector('#mpanel .mtitle').innerText, vis:!document.querySelector('#modal').classList.contains('hidden')}))()")
            check('火箭烤炉' in q1 and q2['vis'] and '麻辣服务器' in (q2['t'] or ''), f"连弹两张：第一张放大→点大图返回→知道了，第二张「麻辣服务器」照常弹出 {q1} / {q2}")
            zp.click('#mOk'); zp.wait_for_timeout(250)
            # 重看（非首次）也能放大，返回仍是「跨行组合」
            zp.locator('#bottomNav [data-tab="ceo"]').click(); zp.wait_for_timeout(400)
            zp.locator('.cross-item[data-arg="pearl@2"]').scroll_into_view_if_needed(); zp.locator('.cross-item[data-arg="pearl@2"]').click(); zp.wait_for_timeout(400)
            zp.click('#crossZoom'); zp.wait_for_timeout(400); zp.click('#mOk'); zp.wait_for_timeout(300)
            check('跨行组合' in S(zp, "document.querySelector('#mpanel .mbubble').innerText"), '跨行组合重看也能放大，返回仍是「跨行组合」')
            zp.click('#mOk'); zp.wait_for_timeout(250)
            # 坏图：文字兜底时没有放大入口
            ne = len(errs); zp.evaluate("__tzz.CROSS_ART['otaku@1']='cross_missing_test'; __tzz.showComic('otaku@1', false)"); zp.wait_for_timeout(1200)
            errs[ne:] = [e for e in errs[ne:] if not ('cross_missing_test' in e or 'Failed to load resource' in e)]
            fz = S(zp, "(()=>({z:!!document.querySelector('#crossZoom'), panels:[...document.querySelectorAll('#mpanel .comic.two .panel4')].filter(e=>e.offsetParent).length}))()")
            check(not fz['z'] and fz['panels'] == 2, f'整图坏了退回文字版时，放大入口一起去掉 {fz}')
            zp.click('#mOk'); zp.wait_for_timeout(200)
        zc.close()

    # 11z 占地迁移：已跑过 11w 的档（fpMig11w=1）读入 → 9 件按旋转后真实高差锚底边；刷新两次幂等；金币、件数、休息不变
    zc = b.new_context(**dev); zp = zc.new_page(); hook(zp, 'mig11z')
    zp.goto(URL.replace('index.html', 'icon.svg'))
    zp.evaluate(f"""()=>{{localStorage.clear(); const T=Date.now(); const s={{v:3,rev:7,coins:4321,totalEarned:4321,fpMig11w:1,shops:[{{open:true,lv:4,emp:1}},{{open:false,lv:0,emp:0}},{{open:false,lv:0,emp:0}},{{open:false,lv:0,emp:0}}],
      ceos:{{c77:{{unlocked:true,lv:2,at:0}}}},gacha:{{owned:[],draws:0,pity:0,last:null}},claimLog:[],lastSeen:T-5000,maxSeen:T-5000,created:T-1e6,
      furnInv:{{furn_rocket_captain_chair:1}},
      homes:{{c77:{{lv:1,next:9,placed:[
        {{uid:'a',fid:'furn_pearl_tea_loft',x:0,y:0,rot:0,surf:'floor'}},
        {{uid:'b',fid:'furn_otaku_kotatsu',x:2,y:0,rot:0,surf:'floor'}},
        {{uid:'c',fid:'furn_plant',x:4,y:0,rot:0,surf:'floor'}},
        {{uid:'d',fid:'furn_otaku_bunk_manga',x:2,y:2,rot:1,surf:'floor'}},
        {{uid:'e',fid:'furn_rocket_cryo_rest_pod',x:4,y:1,rot:2,surf:'floor'}},
        {{uid:'f',fid:'furn_plant',x:5,y:0,rot:0,surf:'floor'}}]}}}}}};
      localStorage.setItem('{KEY}', JSON.stringify(s));}}""")
    zp.goto(URL); zp.wait_for_timeout(1000); close_modals(zp)
    def zpos(): return {q['uid']: (q['x'], q['y'], q['rot']) for q in st(zp)['homes']['c77']['placed']}
    z1 = zpos(); s1 = st(zp)
    exp = {'a': (0, 2, 0), 'b': (2, 1, 0), 'c': (4, 0, 0), 'd': (2, 2, 1), 'f': (5, 0, 0)}
    check(all(z1.get(k) == v for k, v in exp.items()) and z1.get('e') == (4, 2, 2) and s1.get('fpMig11z') == 1, f'11z 读档迁移：高架床→(0,2)、被炉→(2,1)、上下铺 rot1 不挪、休息舱 rot2 (4,1)→(4,2)，两盆植物不动 {z1}')
    check(s1['coins'] >= 4321 and s1['furnInv'].get('furn_rocket_captain_chair') == 1 and len(z1) == 6, f"金币不减、仓库指挥椅仍 1 件、房里 6 件 {s1['coins']} {s1['furnInv']}")
    zp.reload(); zp.wait_for_timeout(900); close_modals(zp); z2 = zpos()
    zp.reload(); zp.wait_for_timeout(900); close_modals(zp); z3 = zpos()
    check(z1 == z2 == z3, f'刷新两次：坐标不再挪（幂等）{z3}')
    rest = S(zp, "['furn_pearl_tea_loft','furn_otaku_bunk_manga','furn_rocket_cryo_rest_pod','furn_otaku_floor_futon','furn_pearl_capsule_daybed','furn_rocket_steel_platform_bed'].every(f=>__tzz.E.furnLiveAct(f)==='rest')")
    nov = S(zp, "(()=>{const s=__tzz.state,E=__tzz.E; return s.homes.c77.placed.every(p=>E.canPlace(s,'c77',p.fid,p.x,p.y,p.rot,p.uid,p.surf).ok)})()")
    check(rest and nov, f'6 张床类仍能休息；房内全局无重叠 rest={rest} noOverlap={nov}')
    # 回仓所有权守恒：收回高架床再摆回
    rt = S(zp, "(()=>{const s=__tzz.state,E=__tzz.E; const o0=E.furnStats(s,'furn_pearl_tea_loft').owned; const r1=E.storeItem(s,'c77','a'); const o1=E.furnStats(s,'furn_pearl_tea_loft').owned; const r2=E.placeItem(s,'c77','furn_pearl_tea_loft',0,3,0); const o2=E.furnStats(s,'furn_pearl_tea_loft').owned; __tzz.persist(); return [o0,o1,o2,!!r1.ok,!!r2.ok]})()")
    check(rt[0] == rt[1] == rt[2] == 1 and rt[3] and rt[4], f'高架床回仓再摆：拥有数始终 1 {rt}')
    zp.locator('#bottomNav [data-tab="home"]').click(); zp.wait_for_timeout(700); close_modals(zp)
    zp.wait_for_timeout(600); zp.locator('#room').screenshot(path=f'{SHOTS}/home_11z_mig.png')
    zc.close()

    # 靠后墙（y=0）的超高 1×1 件：整图不被房间顶边裁掉（等比缩小、脚底贴底）
    zc = b.new_context(**dev); zp = zc.new_page(); hook(zp, 'tall11z')
    zp.goto(URL); zp.evaluate("localStorage.clear()"); zp.reload(); zp.wait_for_timeout(800); close_modals(zp)
    TALL = ['furn_otaku_disc_tower', 'furn_otaku_panel_lamp', 'furn_otaku_orbital_neon_floor', 'furn_otaku_sleep_timer_totem', 'furn_pearl_tea_glass_lamp', 'furn_pearl_boba_globe_lamp']
    pr = S(zp, "(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e9; const ids=" + json.dumps(TALL) + "; ids.forEach(f=>E.buyFurniture(s,f)); const a=ids.map((f,i)=>E.placeItem(s,'c77',f,i,0,0)); __tzz.persist(); return a.map(x=>x.ok?1:x.why)})()")
    check(pr == [1] * 6, f'6 件超高灯/塔靠后墙一排摆好 {pr}')
    zp.locator('#bottomNav [data-tab="home"]').click(); zp.wait_for_timeout(600); close_modals(zp)
    zp.wait_for_function("[...document.querySelectorAll('#roomFloor .furn img')].every(i=>i.complete&&i.naturalWidth)", timeout=15000)
    cl = S(zp, "(()=>{const rm=document.querySelector('#room'), rr=rm.getBoundingClientRect(), bt=parseFloat(getComputedStyle(rm).borderTopWidth)||0; return " + json.dumps(TALL) + ".map(f=>{const e=document.querySelector('#roomFloor .furn[data-fid='+f+']'), i=e.querySelector('img'), b=i.getBoundingClientRect(), eb=e.getBoundingClientRect(); const sc=Math.min(b.width/i.naturalWidth,b.height/i.naturalHeight), top=b.bottom-i.naturalHeight*sc; return [f, Math.round((rr.top+bt-top)*10)/10, Math.abs(b.bottom-eb.bottom)<1.5]})})()")
    bad = [c for c in cl if c[1] > 1 or not c[2]]
    check(bad == [], f'靠后墙超高件整图都在房间里（顶边超出 ≤1px、脚底贴占地底）{cl}')
    zp.wait_for_timeout(500); zp.locator('#room').screenshot(path=f'{SHOTS}/home_11z_tall.png')
    zc.close()

    # 12b：真实页面读档链路（localStorage → loadState → E.migrate → boot 整理）：坏画排前也不挤走合法画，如实提示；记录换序结果一样；刷新幂等
    for tag, order in [('坏画在前', ['bad', 'ok']), ('合法画在前', ['ok', 'bad'])]:
        wc = b.new_context(**dev); wp = wc.new_page(); hook(wp, 'wall12b-' + tag)
        wp.goto(URL.replace('index.html', 'icon.svg'))
        recs = {'bad': {'uid': 'bad', 'fid': 'furn_painting', 'x': 5, 'y': 0, 'rot': 0, 'surf': 'wall'}, 'ok': {'uid': 'ok', 'fid': 'furn_painting', 'x': 0, 'y': 0, 'rot': 0, 'surf': 'wall'}}
        wp.evaluate("""(pl)=>{localStorage.clear(); const T=Date.now(); const s={v:3,rev:3,coins:999,totalEarned:999,fpMig11w:1,fpMig11z:1,shops:[{open:true,lv:4,emp:1},{open:false,lv:0,emp:0},{open:false,lv:0,emp:0},{open:false,lv:0,emp:0}],
          ceos:{c77:{unlocked:true,lv:2,at:0}},gacha:{owned:[],draws:0,pity:0,last:null},claimLog:[],lastSeen:T-3000,maxSeen:T-3000,created:T-1e6,furnInv:{},
          homes:{c77:{lv:2,next:9,placed:pl}}}; localStorage.setItem('""" + KEY + """', JSON.stringify(s));}""", [recs[k] for k in order])
        wp.goto(URL); wp.wait_for_timeout(700)
        tt = S(wp, "(()=>{const t=document.getElementById('toast');return t&&!t.classList.contains('hidden')?t.textContent:''})()")
        close_modals(wp)
        wpos = lambda: {q['uid']: (q['x'], q['y'], q.get('surf')) for q in st(wp)['homes']['c77']['placed']}
        w1 = wpos(); s1 = st(wp)
        check(w1.get('ok') == (0, 0, 'wall') and w1.get('bad') == (2, 0, 'wall') and len(w1) == 2 and not s1['furnInv'].get('furn_painting'), f'12b/12b1 真读档（{tag}）：合法画留 (0,0)，压在 77 公寓真拱窗上的坏画挪到最近空墙 (2,0)（12b1 前无底图时是 (5,1)），没退仓 {w1}')
        check('墙面整理' in tt and '1 幅' in tt, f'12b 真读档（{tag}）：如实提示挪了 1 幅「{tt}」')
        wp.reload(); wp.wait_for_timeout(700)
        tt2 = S(wp, "(()=>{const t=document.getElementById('toast');return t&&!t.classList.contains('hidden')?t.textContent:''})()")
        close_modals(wp); w2 = wpos()
        check(w2 == w1 and '墙面整理' not in tt2, f'12b 刷新（{tag}）：位置不变、不再提示 {w2}「{tt2}」')
        wc.close()

    print('== 12c. 漫画 UI 系统：导航图标 / 面板 / 按钮 / 弹窗关闭钮 / 小屏不溢出 / 减少动态 ==')
    UI_JS = """(()=>{const vw=innerWidth, cs=e=>getComputedStyle(e), R=e=>e.getBoundingClientRect();
      const nav=[...document.querySelectorAll('#bottomNav button')].map(b=>{const u=b.querySelector('svg.ic use'), h=u&&u.getAttribute('href'), r=R(b), ir=b.querySelector('svg.ic')&&R(b.querySelector('svg.ic'));
        return {tab:b.dataset.tab, sym:!!(h&&document.querySelector(h)&&document.querySelector(h).tagName.toLowerCase()==='symbol'), iw:ir?Math.round(ir.width):0, w:Math.round(r.width), h:Math.round(r.height), emoji:/\\p{Extended_Pictographic}/u.test(b.textContent), on:b.classList.contains('on')};});
      const vis=[...document.querySelectorAll('#tabBody .buy, #bottomNav button, #shopTabs button, .book-tabs button, .mode-tabs .mt')].filter(x=>x.offsetParent);
      const clip=vis.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent.trim().slice(0,12));
      const panel=document.getElementById('panel'), root=cs(document.documentElement);
      const card=document.querySelector('#tabBody .card'), buy=document.querySelector('#tabBody .buy:not([disabled])'), sec=document.querySelector('#tabBody .sec-title');
      return {vw, sw:document.documentElement.scrollWidth, pw:panel.scrollWidth, pc:panel.clientWidth, nav, clip,
        tok:['--lw-1','--lw-2','--lw-3','--sh-3','--tone-ink','--fs-title','--fs-num','--red-ink'].every(k=>root.getPropertyValue(k).trim()!==''),
        card:card?{bw:cs(card).borderTopWidth, sh:cs(card).boxShadow}:null, buy:buy?{sh:cs(buy).boxShadow, bw:cs(buy).borderTopWidth}:null, sec:sec?cs(sec).backgroundColor:null};})()"""
    for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
        uc = b.new_context(**p.devices[dname]); up = uc.new_page(); hook(up, 'ui12c-' + dname)
        up.goto(URL); up.evaluate("localStorage.clear()"); up.reload(); up.wait_for_timeout(800); close_modals(up)
        up.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.coins=5e7; E.hireEmp(s,0); s.shops[0].lv=12; E.openShop(s,1); E.hireEmp(s,1); E.openShop(s,2); E.hireEmp(s,2); E.buyFurniture(s,'furn_painting'); __tzz.persist(); __tzz.renderTab();})()"); up.wait_for_timeout(500); close_modals(up)
        for tb in ['shop', 'home', 'ceo']:
            up.locator(f'#bottomNav [data-tab="{tb}"]').click(); up.wait_for_timeout(600); close_modals(up)
            if tb == 'home': up.evaluate("__tzz.act('homeMode','decor')"); up.wait_for_timeout(300)
            u = S(up, UI_JS)
            nv = u['nav']
            check(len(nv) == 5 and all(n['sym'] and n['iw'] >= 20 and not n['emoji'] and n['h'] >= 44 and n['w'] >= 44 for n in nv) and [n['tab'] for n in nv if n['on']] == [tb],
                  f"12c {dname} {tb}：底栏 5 个同套线稿图标（symbol 引用、≥20px、无 emoji），按钮 ≥44×44，只有当前页高亮 {[(n['tab'], n['w'], n['h'], n['iw']) for n in nv]}")
            check(u['sw'] <= u['vw'] and u['pw'] <= u['pc'] + 1 and not u['clip'], f"12c {dname} {tb}：无横向溢出（页 {u['sw']}≤{u['vw']}，面板 {u['pw']}≤{u['pc']}），按钮文字没被裁 {u['clip']}")
            check(u['tok'] and u['card'] and float(u['card']['bw'][:-2]) >= 3 and '4px 4px' in u['card']['sh'] and u['buy'] and '3px 3px' in u['buy']['sh'] and (u['sec'] == 'rgb(20, 20, 20)' or (tb == 'home' and u['sec'] is None)),
                  f"12c {dname} {tb}：设计令牌生效（卡片 ≥3px 墨边 + 4px 墨影、按钮 3px 墨影、段标题墨底）{u['card']} {u['buy']}")
        # 弹窗统一关闭钮：× = 代按「再想想」，不改任何东西
        up.locator('#bottomNav [data-tab="home"]').click(); up.wait_for_timeout(500)
        h0 = st(up); up.evaluate("__tzz.act('homeUp','c77')"); up.wait_for_timeout(500)
        xm = S(up, """(()=>{const x=document.querySelector('#mpanel .cx-close'), m=document.querySelector('#mpanel'); if(!x) return null; const r=x.getBoundingClientRect(), M=m.getBoundingClientRect(), bb=document.querySelector('#mpanel .mbubble').getBoundingClientRect();
          return {w:r.width, h:r.height, inP:r.left>=M.left&&r.right<=M.right&&r.top>=M.top&&r.bottom<=innerHeight, overlap:!(r.right<=bb.left||r.left>=bb.right||r.bottom<=bb.top||r.top>=bb.bottom), use:!!x.querySelector('use[href="#ic-close"]'), hasx:m.classList.contains('has-x')}})()""")
        check(modal_visible(up) and xm and xm['w'] >= 34 and xm['inP'] and not xm['overlap'] and xm['use'] and xm['hasx'], f'12c {dname}：房子升级弹窗有统一 × 关闭钮（在弹窗内、不压对白泡）{xm}')
        up.click('#mX'); up.wait_for_timeout(300); h1 = st(up)
        check(not modal_visible(up) and h1['homes'] == h0['homes'] and h1['coins'] >= h0['coins'] and h1['furnInv'] == h0['furnInv'], f"12c × 关闭升级弹窗：等同「再想想」，房子 / 仓库不变、没扣钱（{round(h0['coins'])} → {round(h1['coins'])}，自动收入照常涨）")
        up.locator('#bottomNav [data-tab="ceo"]').click(); up.wait_for_timeout(400)
        c0 = st(up)['ceos']; up.evaluate("__tzz.showPreview('pearl', 0)"); up.wait_for_timeout(400)
        check(modal_visible(up) and up.locator('#mpanel #mX').count() == 1, f'12c {dname}：调任预览弹窗有 ×')
        up.click('#mX'); up.wait_for_timeout(300)
        check(not modal_visible(up) and st(up)['ceos'] == c0, '12c × 关闭调任预览：任职安排不变')
        up.evaluate("__tzz.openAssign('pearl')"); up.wait_for_timeout(400)
        check(S(up, "!document.getElementById('sheet').classList.contains('hidden')") and up.locator('#sheetX').count() == 1, f'12c {dname}：调任选店抽屉有 ×')
        up.click('#sheetX'); up.wait_for_timeout(300)
        check(S(up, "document.getElementById('sheet').classList.contains('hidden')") and st(up)['ceos'] == c0, '12c 抽屉 × 关闭：不改安排')
        uc.close()
    # 减少动态：弹窗 / 提示不弹跳
    rc = b.new_context(**p.devices['iPhone SE (3rd gen)'], reduced_motion='reduce'); rp = rc.new_page(); hook(rp, 'ui12c-rm')
    rp.goto(URL); rp.evaluate("localStorage.clear()"); rp.reload(); rp.wait_for_timeout(800)
    rm = S(rp, "(()=>({m:getComputedStyle(document.getElementById('mpanel')).animationName, t:getComputedStyle(document.getElementById('toast')).animationName, x:!!document.querySelector('#mpanel #mX')}))()")
    check(rm['m'] == 'none' and rm['t'] == 'none' and rm['x'], f'12c 减少动态：开场弹窗 / 提示条不做弹出动画，× 照常有 {rm}')
    rc.close()

    print('== 12c1. 熊大 13:18 视觉基准：配色 / 3px·2px 线 / 正文无网点 / 只主操作大黄块 / 无系统 emoji / 触控 ≥44 / 3 头身人物 ==')
    SPEC_JS = """(()=>{const cs=(e,p)=>getComputedStyle(e,p), R=e=>e.getBoundingClientRect(), root=cs(document.documentElement), vis=s=>[...document.querySelectorAll(s)].filter(x=>x.offsetParent);
      const card=vis('#tabBody .card:not(.dim)')[0], buy=vis('#tabBody .buy:not([disabled]):not(.alt):not(.ghost):not(.red):not(.no)')[0];
      const tok={ink:root.getPropertyValue('--ink').trim(), paper:root.getPropertyValue('--paper').trim(), panel:root.getPropertyValue('--panel').trim(), yellow:root.getPropertyValue('--yellow').trim(), red:root.getPropertyValue('--red').trim()};
      const cardA=card?cs(card,'::after'):null;
      const yel=vis('#tabBody *, #shopTabs *, #bottomNav *').filter(e=>cs(e).backgroundColor==='rgb(255, 210, 63)'&&!e.closest('.buy')&&R(e).width*R(e).height>1600).map(e=>e.className||e.tagName);
      const emo=['#bottomNav','#shopTabs','.book-tabs','.mode-tabs','.home-card','.room-tools','.room-wall .rw-deco','.home-who','.job-gal','#compactHead','.who-row'].flatMap(s=>vis(s)).map(e=>[...e.textContent.matchAll(/\\p{Extended_Pictographic}/gu)].map(m=>m[0]).join('')).join('');
      const icons=vis('#shopTabs button, .home-card .ava.sq, .job-chip').map(e=>{const u=e.querySelector('svg.ic use'); const h=u&&u.getAttribute('href'); return !!(h&&document.querySelector(h)&&document.querySelector(h).tagName.toLowerCase()==='symbol'&&R(e.querySelector('svg.ic')).height>=12&&R(e.querySelector('svg.ic')).height<=40);});
      return {tok, app:cs(document.getElementById('app')).backgroundImage, card:card?{bw:cs(card).borderTopWidth, bg:cs(card).backgroundColor, tone:cardA.display==='none'||cardA.content==='none'}:null,
        buy:buy?{bw:cs(buy).borderTopWidth, bg:cs(buy).backgroundColor}:null, nav:cs(document.getElementById('bottomNav')).borderTopWidth, navBg:cs(document.getElementById('bottomNav')).backgroundImage,
        yel, emo, icons};})()"""
    HIT_JS = """(()=>{const R=e=>e.getBoundingClientRect(), vis=s=>[...document.querySelectorAll(s)].filter(x=>x.offsetParent&&!x.disabled);
      const nav=R(document.getElementById('bottomNav')).top, out=[]; for(const s of ['#bottomNav button','#shopTabs button','.book-tabs button','.mode-tabs .mt','.job-chip','.buyamt button','#dailyChip','#mute','#tabBody .buy','.mall-go']){
        for(const e of vis(s)){const r=R(e); const inNav=!!e.closest('#bottomNav'); if(r.top<0||(!inNav&&r.bottom>nav-2)||r.bottom>innerHeight) continue; const cx=r.left+r.width/2, cy=r.top+r.height/2;
          const hit=(x,y)=>{const t=document.elementFromPoint(x,y); return !!t&&(t===e||e.contains(t));};
          const h=[-21.5,21.5].every(d=>hit(cx,cy+d)), w=[-21.5,21.5].every(d=>hit(cx+d,cy));
          if(!(h&&w)) out.push(s+' '+e.textContent.trim().slice(0,8)+' '+Math.round(r.width)+'×'+Math.round(r.height));}}
      return out;})()"""
    for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
        sc = b.new_context(**p.devices[dname]); sp = sc.new_page(); hook(sp, 'spec12c1-' + dname)
        sp.goto(URL); sp.evaluate("localStorage.clear()"); sp.reload(); sp.wait_for_timeout(800)
        intro = S(sp, """(()=>{const m=document.getElementById('mpanel'), lines=e=>{if(!e) return 0; const r=document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].filter(q=>q.width>1).map(q=>Math.round(q.top))).size;};
          return {open:!m.closest('.hidden'), x:!!m.querySelector('#mX'), ok:(m.querySelector('#mOk')||{}).textContent, bub:lines(m.querySelector('.mbubble')), title:lines(m.querySelector('.mtitle'))};})()""")
        check(intro['open'] and intro['x'] and '开摊' in (intro['ok'] or '') and intro['bub'] == 1 and intro['title'] == 1, f"12c1 {dname}：开摊介绍弹窗对白泡和标题都是一行（不在 × 旁折行）{intro}")
        xl = S(sp, "(()=>{const x=document.querySelector('#mpanel #mX'), r=x.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, hit=(dx,dy)=>{const e=document.elementFromPoint(cx+dx,cy+dy); return !!e && (e===x || x.contains(e));}; return {label:x.getAttribute('aria-label'), w:r.width, h:r.height, cx, cy, hits:[[0,0],[-15,0],[15,0],[0,-15],[0,15],[-21.5,0],[21.5,0],[0,-21.5],[0,21.5],[-22,0],[22,0],[0,-22],[0,22]].map(d=>hit(d[0],d[1])), ins:getComputedStyle(x,'::before').top};})()")
        check(xl['label'] == '关闭' and len(xl['hits']) == 13 and all(xl['hits']), f"12c3/12b3 {dname}：开摊介绍 × 朗读标签是「关闭」（不叫「开摊」），× 中心和上下左右 15 / 21.5 / 22px 实测点（elementFromPoint）都得到 × 本身（热区 46px）{xl}")
        b0 = S(sp, "__tzz.bubble.until"); sp.mouse.click(xl['cx'], xl['cy']); sp.wait_for_timeout(400)
        xi = S(sp, "({open:!document.getElementById('modal').classList.contains('hidden'), au:__tzz.audioState(), same:__tzz.bubble.until===" + json.dumps(b0) + "})")
        check(not xi['open'] and xi['au'] == 'none' and xi['same'], f"12c1/12c3 {dname}：开摊介绍按坐标实点 × 只关窗——不解锁音频、77 不新说开摊台词 {xi}")
        # 12b3：板砖 16:28 × 边缘——WebKit 按下→松开：在 ±22px 边缘按下（:active 让按钮右下移 2px），按住时四个方向 ±21.5 / ±22px 仍命中 ×，原地松开只关窗、不解锁音频、77 不说开摊台词
        for ex, ey in [(-22, 0), (22, 0), (0, -22), (0, 22)]:
            sp.evaluate("localStorage.clear()"); sp.reload(); sp.wait_for_timeout(800)
            r0 = S(sp, "(()=>{const r=document.querySelector('#mpanel #mX').getBoundingClientRect(); return {cx:r.left+r.width/2, cy:r.top+r.height/2};})()")
            b0 = S(sp, "__tzz.bubble.until"); sp.mouse.move(r0['cx'] + ex, r0['cy'] + ey); sp.mouse.down(); sp.wait_for_timeout(120)
            pr = S(sp, "(()=>{const x=document.querySelector('#mpanel #mX'), cx=" + json.dumps(r0['cx']) + ", cy=" + json.dumps(r0['cy']) + ", hit=(dx,dy)=>{const e=document.elementFromPoint(cx+dx,cy+dy); return !!e && (e===x || x.contains(e));}; return {act:x.matches(':active'), tf:getComputedStyle(x).transform, bt:getComputedStyle(x,'::before').transform, hits:[[-22,0],[22,0],[0,-22],[0,22],[-21.5,0],[21.5,0],[0,-21.5],[0,21.5]].map(d=>hit(d[0],d[1]))};})()")
            sp.mouse.up(); sp.wait_for_timeout(400)
            xr = S(sp, "({open:!document.getElementById('modal').classList.contains('hidden'), au:__tzz.audioState(), same:__tzz.bubble.until===" + json.dumps(b0) + "})")
            check(pr['act'] and pr['tf'] != 'none' and all(pr['hits']), f"12b3 {dname}：× 在 ({ex},{ey}) 边缘按住（:active 位移 {pr['tf']}，热区反向 {pr['bt']}）时四方向 ±21.5 / ±22px 仍命中 × {pr['hits']}")
            check(not xr['open'] and xr['au'] == 'none' and xr['same'], f"12b3 {dname}：× 在 ({ex},{ey}) 边缘按下→松开只关窗——不解锁音频、77 不说开摊台词 {xr}")
        # 12b3：同写法的声音按钮 / 每日双倍芯片：按住（:active 位移 2px）时 ±21.5 / ±22px 四个方向的命中结果和松手时一模一样（热区不跟着跑）
        mc = b.new_context(**p.devices[dname]); mp = mc.new_page(); hook(mp, 'press12b3-' + dname)
        mp.goto(URL); mp.evaluate("localStorage.clear()"); mp.reload(); mp.wait_for_timeout(800); close_modals(mp)
        PT = "[[-21.5,0],[21.5,0],[0,-21.5],[0,21.5],[-22,0],[22,0],[0,-22],[0,22]]"
        for sel in ['#mute', '#dailyChip']:
            HJ = "(()=>{const x=document.querySelector('" + sel + "'), r=x.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, hit=(dx,dy)=>{const e=document.elementFromPoint(cx+dx,cy+dy); return !!e && (e===x || x.contains(e));}; return {act:x.matches(':active'), tf:getComputedStyle(x).transform, cx, cy, w:r.width, h:r.height, hits:" + PT + ".map(d=>hit(d[0],d[1]))};})()"
            r0 = S(mp, HJ); pts = json.loads(PT); k = next((i for i, h in enumerate(r0['hits']) if h and pts[i][0] != 0), 0)
            mp.mouse.move(r0['cx'] + pts[k][0], r0['cy'] + pts[k][1]); mp.mouse.down(); mp.wait_for_timeout(120)
            r1 = S(mp, HJ.replace("cx=r.left+r.width/2, cy=r.top+r.height/2", "cx=" + json.dumps(r0['cx']) + ", cy=" + json.dumps(r0['cy'])))
            mp.mouse.up(); mp.wait_for_timeout(300); close_modals(mp)
            if sel == '#mute': mp.click('#mute'); mp.wait_for_timeout(200)
            check(r1['act'] and r1['tf'] != 'none' and r1['hits'] == r0['hits'] and all(r0['hits'][:2]), f"12b3 {dname}：{sel}（{round(r0['w'])}×{round(r0['h'])}）按住时热区不跑——±21.5 / ±22px 命中 松手 {r0['hits']} = 按住 {r1['hits']}（位移 {r1['tf']}）")
        if dname == 'iPhone 15':
            lk3 = S(mp, "(()=>{const L=__tzz.LOOKS.c77, s=__tzz.state; s.wear=s.wear||{}; const w=s.wear.c77; s.wear.c77={clothes:'c_work'}; const a=__tzz.lookOf('c77').pants; if(w===undefined) delete s.wear.c77; else s.wear.c77=w; return [L.apron,L.pants,L.shoe,a];})()")
            check(lk3 == ['#f0a08e', '#4a2f26', '#835233', None], f"12b3 77 店内小人跟新形象：粉围裙 / 深棕长裤 / 棕靴；换上背带裤等衣服时裤子回衣服默认色 {lk3}")
        mc.close()
        if dname == 'iPhone SE':
            sp.reload(); sp.wait_for_timeout(800); b0 = S(sp, "__tzz.bubble.until"); sp.click('#mOk'); sp.wait_for_timeout(400)
            ki = S(sp, "({au:__tzz.audioState(), line:__tzz.bubble.txt, changed:__tzz.bubble.until!==" + json.dumps(b0) + "})")
            check(ki['au'] != 'none' and '串串烤起走' in (ki['line'] or '') and ki['changed'], f'12c1 对照：点「开摊！」照旧解锁音频 + 77 说开摊台词 {ki}')
        close_modals(sp)
        sp.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.coins=5e7; E.hireEmp(s,0); s.shops[0].lv=12; E.openShop(s,1); E.hireEmp(s,1); E.openShop(s,2); E.hireEmp(s,2); E.buyFurniture(s,'furn_painting'); __tzz.persist(); __tzz.renderTab();})()"); sp.wait_for_timeout(500); close_modals(sp)
        for tb in ['shop', 'home', 'ceo']:
            sp.locator(f'#bottomNav [data-tab="{tb}"]').click(); sp.wait_for_timeout(600); close_modals(sp)
            if tb == 'home': sp.evaluate("__tzz.act('homeMode','decor')"); sp.wait_for_timeout(300)
            u = S(sp, SPEC_JS)
            check(u['tok'] == {'ink': '#141414', 'paper': '#f7f1e3', 'panel': '#fffaf0', 'yellow': '#ffd23f', 'red': '#e63946'}, f"12c1 {dname} {tb}：五个基准色令牌 = 墨 #141414 / 纸 #f7f1e3 / 内容底 #fffaf0 / 黄 #ffd23f / 红 #e63946 {u['tok']}")
            check(u['card'] and u['card']['bw'] == '3px' and u['card']['bg'] == 'rgb(255, 250, 240)' and u['nav'] == '3px' and u['buy'] and u['buy']['bw'] == '2px' and u['buy']['bg'] == 'rgb(255, 210, 63)',
                  f"12c1 {dname} {tb}：外框 3px（卡片 / 底栏）、内框 2px（主按钮，主黄 #ffd23f），卡片底 #fffaf0 {u['card']} 底栏 {u['nav']} 按钮 {u['buy']}")
            check(u['app'] == 'none' and u['card']['tone'] and u['navBg'] == 'none', f"12c1 {dname} {tb}：正文区不铺网点（页底 {u['app'][:30]}、卡片角网点关、底栏 {u['navBg'][:30]}）")
            check(not u['yel'], f"12c1 {dname} {tb}：大黄块只给主操作按钮，选中态不再是整块主黄 {u['yel'][:6]}")
            check(u['emo'] == '' and u['icons'] and all(u['icons']), f"12c1 {dname} {tb}：导航 / 店铺切换 / 家宅升级 / 任职签无系统 emoji（剩 {u['emo']!r}），店铺 / 家宅 / 锁图标全是同套 SVG symbol（{len(u['icons'])} 个）")
            icv = S(sp, """(()=>{const v=e=>e?getComputedStyle(e).getPropertyValue('--ica').trim():null, vis=s=>[...document.querySelectorAll(s)].filter(x=>x.offsetParent);
              const grp=s=>vis(s).filter(b=>b.querySelector('svg.ic')).map(b=>[b.classList.contains('on'), v(b.querySelector('svg.ic'))]);
              return {nav:grp('#bottomNav button'), book:grp('.book-tabs button:not(:first-child)'), mode:grp('.mode-tabs .mt')};})()""")
            okc = lambda g: all((c == '#e63946') if on else (c == '#f0a9af') for on, c in g) and sum(on for on, _ in g) == 1
            check(okc(icv['nav']) and (tb != 'home' or (okc(icv['book']) and okc(icv['mode']))), f"12c1 {dname} {tb}：图标跟随选中态（选中主红 #e63946、未选淡红 #f0a9af；底栏{' / 翻页签 / 生活·布置' if tb == 'home' else ''}）{icv}")
            adj = S(sp, """(()=>{const R=e=>e.getBoundingClientRect(), nav=R(document.getElementById('bottomNav')).top, out=[];
              for(const g of ['#shopTabs button','.book-tabs button','.mode-tabs .mt','.buyamt button','.job-gal .job-chips']){
                for(const box of document.querySelectorAll(g.endsWith('job-chips')?g:g.split(' ')[0])){ const items=g.endsWith('job-chips')?[...box.querySelectorAll('.job-chip')]:[...document.querySelectorAll(g)];
                  for(const e of items){ if(!e.offsetParent||e.disabled) continue; const r=R(e); if(r.top<0||r.bottom>nav-2) continue; const cy=r.top+r.height/2, cx=r.left+r.width/2;
                    for(const [x,y] of [[r.left+3,cy],[r.right-3,cy],[cx,r.top+3],[cx,r.bottom-3]]){const t=document.elementFromPoint(x,y); if(!t||!(t===e||e.contains(t))) out.push(g+' '+e.textContent.trim().slice(0,6)+' @'+Math.round(x)+','+Math.round(y)+'→'+(t?(t.textContent||'').trim().slice(0,6):null));}}
                  if(!g.endsWith('job-chips')) break; }}
              return out;})()""")
            check(not adj, f"12c1 {dname} {tb}：相邻控件不误触（店铺签 / 翻页签 / 生活·布置 / 数量切换 / 任职签，每格四边内 3px 点到的都是自己）{adj[:4]}")
            coin = S(sp, "(()=>{const b=[...document.querySelectorAll('#tabBody .buy:not([disabled]):not(.no)')].find(x=>x.offsetParent&&x.querySelector('small')); if(!b) return null; const s=getComputedStyle(b.querySelector('small'),'::before'); return {bg:s.backgroundColor, img:s.backgroundImage.slice(0,15), btn:getComputedStyle(b).backgroundColor};})()")
            check(coin is None or (coin['bg'] == 'rgb(233, 161, 0)' and coin['bg'] != coin['btn']), f"12c1 {dname} {tb}：按钮里的金币是深金币（不再是黄按钮上的空圈）{coin}")
            miss = S(sp, HIT_JS)
            check(not miss, f"12c1 {dname} {tb}：可见控件实测点击盒 ≥44×44（elementFromPoint 中心 ±21.5px 都打得到本控件）{miss[:6]}")
            if tb == 'home':
                sp.evaluate("__tzz.act('homeSub','mall')"); sp.wait_for_timeout(400)
                miss = S(sp, HIT_JS); check(not miss, f'12c1 {dname} 商城：页签 / 按钮点击盒 ≥44 {miss[:6]}')
                mc = S(sp, "(()=>{const c=document.querySelector('.mall-count'), n=c&&c.querySelector('.mc-num'); return n?{t:n.textContent, w:n.getBoundingClientRect().width, cw:c.getBoundingClientRect().width}:null})()")
                import re as _re
                check(mc and _re.fullmatch(r'显示\d+/ \d+ 件', mc['t']) and mc['w'] < mc['cw'] * 0.6, f"12c1 {dname} 商城「显示 N / 200 件」是一组、不被拉散 {mc}")
                sp.evaluate("__tzz.act('homeSub','room')"); sp.wait_for_timeout(300)
        # 误触：扩出来的点击区不吃掉邻居；数量切换只切自己；每日双倍扩展区外不算点中
        sp.locator('#bottomNav [data-tab="shop"]').click(); sp.wait_for_timeout(500); close_modals(sp)
        sp.evaluate("document.querySelector('.buyamt').scrollIntoView({block:'center'})"); sp.wait_for_timeout(200)
        mis = S(sp, """(()=>{const R=e=>e.getBoundingClientRect(), d=document.getElementById('dailyChip'), m=document.getElementById('mute'), dr=R(d), mr=R(m);
          const at=(x,y)=>{const t=document.elementFromPoint(x,y); return t&&(t.closest('#dailyChip')?'daily':t.closest('#mute')?'mute':'other');};
          const bs=[...document.querySelectorAll('.buyamt button')];
          const dy=dr.top+dr.height/2, my=mr.top+mr.height/2;
          return {dIn:at(dr.left+dr.width/2, dy+21.5), dOut:at(dr.left+dr.width/2, dy+30), mIn:at(mr.left+mr.width/2, my+21.5), gap:at((dr.right+mr.left)/2, dy), mL:at(mr.left-2, my), amt:bs.map(b=>{const r=R(b), t=document.elementFromPoint(r.left+3, r.top+r.height/2); return !!t&&t.closest('.buyamt button')===b;})};})()""")
        check(mis['dIn'] == 'daily' and mis['dOut'] != 'daily' and mis['mIn'] == 'mute' and mis['gap'] != 'daily' and mis['mL'] == 'mute' and all(mis['amt']),
              f"12c1 {dname}：扩展点击区不越界（每日双倍中心 +21.5 算、+30 不算；声音键 +21.5 算；每日双倍不往声音键那边扩、声音键左缘外 2px 仍是声音键；数量切换每格左缘点到的是自己）{mis}")
        btns = sp.locator('.buyamt button'); seen = []
        for k in range(btns.count()):
            btns.nth(k).click(); sp.wait_for_timeout(150); seen.append([sp.locator('.buyamt button').nth(j).get_attribute('class') or '' for j in range(btns.count())])
        check(len(seen) >= 2 and all(('on' in seen[k][k]) and sum('on' in c.split() for c in seen[k]) == 1 for k in range(len(seen))), f'12c1 {dname}：数量切换 ×1 / ×10 / MAX 点哪个只选中哪个（无误触）')
        sc.close()
    # 经营人物：约 3 头身 + 袖口 / 弯肘 / 裤腿；四位 CEO 沿用立绘发型 / 配饰 / 主色
    pc = b.new_context(**p.devices['iPhone 15']); pp = pc.new_page(); hook(pp, 'person12c1')
    pp.goto(URL); pp.evaluate("localStorage.clear()"); pp.reload(); pp.wait_for_timeout(800); close_modals(pp)
    fig = S(pp, """(()=>{const T=window.__tzz; const box=(fn)=>{const o=document.createElement('canvas'); o.width=200; o.height=220; const c=o.getContext('2d'); c.translate(100,200); fn(c);
        const d=c.getImageData(0,0,200,220).data; let t=999,b=-1; for(let y=0;y<220;y++)for(let x=0;x<200;x++) if(d[(y*200+x)*4+3]>40){if(y<t)t=y;if(y>b)b=y;}
        return {h:b-t+1, d};};
      const near=(d,x,y,hex,tol)=>{const m=/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex); let h=m[1]; if(h.length===3) h=h.replace(/./g,c=>c+c); const n=parseInt(h,16), R=n>>16&255,G=n>>8&255,B=n&255;
        for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++){const i=(yy*200+xx)*4; if(Math.abs(d[i]-R)<tol&&Math.abs(d[i+1]-G)<tol&&Math.abs(d[i+2]-B)<tol) return true;} return false;};
      const out={}; for(const id of ['c77','pearl','otaku','rocket','e0','e1','e2','e3']){ const L=T.LOOKS[id];
        const body=box(c=>T.drawPerson(c,0,0,1,Object.assign({},L,{hat:null}),{t:0,pose:''}));
        const pants=L.pants||'#3d405b', sleeve=L.sleeve||L.top;
        // 静止姿势：左上臂中点约 (-21,-60)，小臂袖口下约 (-19,-40)，裤管约 (±9,-25)
        out[id]={ratio:+(body.h/38).toFixed(2), pants:near(body.d,91,175,pants,12)&&near(body.d,109,175,pants,12), sleeve:near(body.d,79,140,sleeve,14), skin:near(body.d,81,160,L.skin,12)};
      }
      const lk=id=>{const L=T.lookOf(id); return [L.style,L.top,L.bow||L.pin||L.glasses||L.lapel||null];};
      out.looks={c77:lk('c77'), pearl:lk('pearl'), otaku:lk('otaku'), rocket:lk('rocket')};
      return out;})()""")
    lk = fig.pop('looks')
    check(all(2.7 <= v['ratio'] <= 3.3 for v in fig.values()), f"12c1 店内人物约 3 头身（全身高 ÷ 头径 38）{ {k: v['ratio'] for k, v in fig.items()} }")
    check(all(v['pants'] and v['sleeve'] and v['skin'] for v in fig.values()), f"12c1 店内人物有裤腿（两条裤管取色）、袖子（上臂是衣服色）、袖口下露小臂肤色 { {k: (v['pants'], v['sleeve'], v['skin']) for k, v in fig.items()} }")
    check(lk == {'c77': ['pony', '#e84d3c', '#f4837a'], 'pearl': ['wavy', '#bfe3c4', True], 'otaku': ['messy', '#25335c', True], 'rocket': ['swept', '#2b2b2b', True]},
          f'12c1/12b3 四位 CEO 店内小人沿用立绘：77 高马尾 + 粉蝴蝶结 + 红 T（12b3 按漫画新形象换色），珍珠姐卷发 + 珍珠发夹 + 薄荷衬衫，阿宅乱发 + 圆眼镜 + 藏青连帽衫，火箭老板背头 + 黑西装翻领 {lk}')
    wear = S(pp, "(()=>{const s=__tzz.state; const old=s.wear&&s.wear.rocket; s.wear=s.wear||{}; s.wear.rocket={clothes:'c_suit'}; const L=__tzz.lookOf('rocket'); if(old) s.wear.rocket=old; else delete s.wear.rocket; return [L.top, !!L.lapel, !!L.inner];})()")
    check(wear == ['#264653', False, False], f'12c1 换装覆盖立绘专属的内搭 / 翻领（穿 c_suit 不叠两层西装）{wear}')
    pp.locator('#bottomNav [data-tab="shop"]').click(); pp.wait_for_timeout(1500)
    check(not [e for e in errs if 'person12c1' in e or 'spec12c1' in e], '12c1 新人物 / 图标绘制无控制台报错')
    pc.close()

    print('== 12c2. 家具：面板灯等比显示（不拉变形）/ 竖放选图（有侧面图用侧面图，没有保持正面图兜底）==')
    import struct, zlib
    def png_bytes(w, h):
        raw = b''.join(b'\x00' + bytes([230, 57, 70, 255]) * w for _ in range(h))
        def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    GEO_JS = """(uid=>{const e=document.querySelector('#roomFloor .furn[data-uid="'+uid+'"]'); if(!e) return null; const i=e.querySelector('img'), fi=e.querySelector('.fi'), rm=document.querySelector('#room'), rr=rm.getBoundingClientRect(), bt=parseFloat(getComputedStyle(rm).borderTopWidth)||0; if(!i) return {noimg:true, cls:e.className};
      const eb=e.getBoundingClientRect(), b=i.getBoundingClientRect(), sc=Math.min(b.width/i.naturalWidth,b.height/i.naturalHeight), dw=i.naturalWidth*sc, dh=i.naturalHeight*sc, cs=getComputedStyle(i);
      return {src:i.getAttribute('src'), cls:i.className, art:e.classList.contains('art'), nw:i.naturalWidth, nh:i.naturalHeight, ew:eb.width, eh:eb.height, dw, dh, dcx:b.left+b.width/2, ecx:eb.left+eb.width/2, foot:Math.abs(b.bottom-eb.bottom), top:b.bottom-dh, roomTop:rr.top+bt, fit:cs.objectFit, tf:cs.transform, fiH:fi.style.height}})"""
    def place12c2(pg, items):
        return S(pg, "(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e9; s.homes.c77.placed.slice().forEach(q=>E.storeItem(s,'c77',q.uid)); const items=" + json.dumps(items) + "; items.forEach(([f])=>E.buyFurniture(s,f)); const r=items.map(([f,x,y,rot])=>{const q=E.placeItem(s,'c77',f,x,y,rot); return q.ok?q.uid:q.why}); __tzz.persist(); __tzz.renderTab(); return r;})()")
    def wait_imgs(pg): pg.wait_for_function("[...document.querySelectorAll('#roomFloor .furn img')].every(i=>i.complete&&i.naturalWidth)", timeout=15000)
    # 1) 面板灯：素材 240×1331（5.55:1），占地 1×1；房间顶边封顶 = 占地 1 + 后墙 2 = 3 格高 → 等比最宽 ≈ 0.54 格。三机型锁住：比例不变、高 = 3 格、贴底居中、不出房间顶
    for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
        lc = b.new_context(**p.devices[dname]); lp = lc.new_page(); hook(lp, '12c2-lamp-' + dname)
        lp.goto(URL); lp.evaluate("localStorage.clear()"); lp.reload(); lp.wait_for_timeout(800); close_modals(lp)
        lp.locator('#bottomNav [data-tab="home"]').click(); lp.wait_for_timeout(600); close_modals(lp)
        u = place12c2(lp, [['furn_otaku_panel_lamp', 0, 0, 0], ['furn_otaku_panel_lamp', 3, 3, 1], ['furn_lamp', 1, 0, 0]])
        check(all(isinstance(x, str) and len(x) > 0 and x == x.strip() for x in u) and len(set(u)) == 3, f'12c2 {dname}：面板灯 ×2（靠后墙 / 前排转 90°）+ 普通落地灯摆好 {u}')
        wait_imgs(lp)
        for uid, where in [(u[0], '靠后墙'), (u[1], '前排转 90°')]:
            g = S(lp, GEO_JS + "('" + uid + "')")
            ok = g and g['nw'] == 240 and g['nh'] == 1331 and g['fit'] == 'contain' and g['tf'] == 'none' \
                and abs((g['dh'] / g['dw']) - 1331 / 240) < 0.06 and abs(g['dh'] - 3 * g['eh']) < 1.5 \
                and g['dw'] / g['ew'] >= 0.53 and g['dw'] <= g['ew'] + 0.5 and abs(g['dcx'] - g['ecx']) < 1 and g['foot'] < 1.5 and g['top'] >= g['roomTop'] - 1
            check(ok, f"12c2 {dname} 面板灯（{where}）：等比 {round(g['dh']/g['dw'],2) if g else '?'}≈5.55、高 3 格（封顶到房间顶）、宽 {round(g['dw']/g['ew']*100) if g else '?'}% 格（等比最大）、贴底居中、不越顶 {g and {k: round(v,1) if isinstance(v,float) else v for k,v in g.items() if k in ('ew','eh','dw','dh','top','roomTop','foot')}}")
        if dname == 'iPhone 15':
            g2 = S(lp, GEO_JS + "('" + u[2] + "')")
            check(g2 and abs(g2['dw'] - g2['ew']) < 1 and abs(g2['dh'] / g2['dw'] - 468 / 240) < 0.03, f"12c2 普通落地灯不受影响：满 1 格宽、等比 468/240 {g2 and (round(g2['dw'],1), round(g2['dh'],1))}")
        lc.close()
    # 2) 选图（纯函数，全 200 件 × 4 个方向）：rot 1/3 且 FURN_SIDE 登记了 → 侧面图；其余 → 正面图（原兜底）
    sc = b.new_context(**dev); sp = sc.new_page(); hook(sp, '12c2-side')
    sp.goto(URL); sp.evaluate("localStorage.clear()"); sp.reload(); sp.wait_for_timeout(800); close_modals(sp)
    sel = S(sp, """(()=>{const E=__tzz.E, A=__tzz.FURN_ART, SD=__tzz.FURN_SIDE, all=Object.values(E.FURN_BY_ID), bad=[]; let n=0;
      for (const f of all) { const nm=f.id.replace(/^furn_/,''); if(!A[nm]) continue; for (const r of [0,1,2,3]) { const h=__tzz.furnInner(f.id,r,true), side=(r&1)&&SD[nm]&&__tzz.FURN_UP[nm]; n++;
        const want=side?'art/furn_'+nm+'_side.webp':'art/furn_'+nm+'.webp'; if(!h.includes('src="'+want)) bad.push(f.id+'@'+r); } }
      const tallOdd=all.filter(f=>!f.wall&&f.layer!=='rug'&&f.w!==f.h&&__tzz.FURN_UP[f.id.replace(/^furn_/,'')]).length;
      return {n, bad, side:Object.keys(SD), tallOdd}})()""")
    check(sel['n'] >= 700 and sel['bad'] == [], f"12c2 选图：有图家具 × 4 方向共 {sel['n']} 组，竖放登记侧面图的用侧面图、其余都用正面图（侧面图登记 {sel['side']}；非方形、往上伸的家具 {sel['tallOdd']} 件目前都没侧面图 → 正面图兜底）{sel['bad'][:5]}")
    sp.locator('#bottomNav [data-tab="home"]').click(); sp.wait_for_timeout(600); close_modals(sp)
    # 3) 沙发竖放，没侧面图：保持原兜底（正面图、1 格宽、等比 225/600、贴底）
    u = place12c2(sp, [['furn_sofa', 5, 1, 1], ['furn_rocket_pipe_sofa', 4, 1, 1], ['furn_sofa', 0, 3, 0]])
    check(len(u) == 3 and all(isinstance(x, str) and x for x in u), f'12c2 沙发竖放 (5,1) / 钢管沙发竖放 (4,1) / 沙发横放 (0,3) 摆好 {u}')
    wait_imgs(sp)
    g = S(sp, GEO_JS + "('" + u[0] + "')")
    check(g and g['src'].startswith('art/furn_sofa.webp') and abs(g['dw'] - g['ew']) < 1 and abs(g['dh'] / g['dw'] - 225 / 600) < 0.02 and g['foot'] < 1.5 and abs(g['eh'] - 3 * g['ew']) < 2, f"12c2 沙发竖放、没侧面图：保持正面图兜底（1 格宽、等比、贴底）{g and (g['src'], round(g['dw'],1), round(g['dh'],1))}")
    # 4) 模拟熊大补了 furn_sofa_side.webp（240×800）：竖放换侧面图、1 格宽、高 800/240 格、贴底；rot 3 镜像；横放仍正面图
    sp.route('**/art/furn_sofa_side.webp*', lambda r: r.fulfill(status=200, content_type='image/png', body=png_bytes(240, 800)))
    S(sp, "__tzz.FURN_SIDE.sofa = 800/240; __tzz.FURN_SIDE.rocket_pipe_sofa = 3; __tzz.renderTab()")
    sp.wait_for_function("(()=>{const e=document.querySelector('#roomFloor .furn[data-uid=\"" + u[1] + "\"] img'); return e&&e.complete&&e.naturalWidth&&!e.dataset.front})()", timeout=15000)
    wait_imgs(sp)
    g = S(sp, GEO_JS + "('" + u[0] + "')")
    check(g and g['src'].startswith('art/furn_sofa_side.webp') and g['nw'] == 240 and g['nh'] == 800 and 'mir' not in g['cls'] and abs(g['dw'] - g['ew']) < 1 and abs(g['dh'] - g['ew'] * 800 / 240) < 1.5 and g['foot'] < 1.5,
          f"12c2 登记侧面图后：沙发竖放（rot 1）用 furn_sofa_side.webp、1 格宽、高 {round(g['dh']/g['ew'],2) if g else '?'} 格（=800/240）、贴底 {g and g['src']}")
    gh = S(sp, GEO_JS + "('" + u[2] + "')")
    check(gh and gh['src'].startswith('art/furn_sofa.webp') and abs(gh['dw'] - gh['ew']) < 1, f"12c2 同一件沙发横放仍用正面图 {gh and gh['src']}")
    # 4b) 侧面图加载失败（钢管沙发登记了但没这张图）→ 自动回正面图、高度回正面比例、不丢图
    gp = S(sp, GEO_JS + "('" + u[1] + "')")
    check(gp and gp['src'].startswith('art/furn_rocket_pipe_sofa.webp') and gp['art'] and abs(gp['dh'] / gp['dw'] - 337 / 600) < 0.02 and abs(gp['dw'] - gp['ew']) < 1 and gp['foot'] < 1.5, f"12c2 侧面图缺失/加载失败 → 回正面图兜底（不变 emoji、比例 337/600）{gp and (gp['src'], gp['fiH'])}")
    r3 = S(sp, "(()=>{const s=__tzz.state,E=__tzz.E,q=s.homes.c77.placed.find(x=>x.uid==='" + u[0] + "'); q.rot=3; const ok=E.canPlace(s,'c77',q.fid,q.x,q.y,3,q.uid).ok; __tzz.persist(); __tzz.renderTab(); return ok})()")
    wait_imgs(sp)
    g = S(sp, GEO_JS + "('" + u[0] + "')")
    check(r3 and g and g['src'].startswith('art/furn_sofa_side.webp') and 'mir' in g['cls'] and g['tf'].startswith('matrix(-1'), f"12c2 rot 3：同一张侧面图水平镜像 {g and (g['cls'], g['tf'])}")
    sp.locator('#room').screenshot(path=f'{SHOTS}/12c2_side_sim.png')
    S(sp, "delete __tzz.FURN_SIDE.sofa; delete __tzz.FURN_SIDE.rocket_pipe_sofa; __tzz.renderTab()")
    sc.close()
    errs[:] = [e for e in errs if not (e.startswith('12c2-side') and ('_side.webp' in e or '404' in e))]  # 4b 故意请求不存在的侧面图

    print('== 12b2. 阿宅 / 火箭老板 Lv2/Lv3 底图 + 真禁区；77 漫画新全身 / 头像；测试房间 ?test=homes 不碰真存档 ==')
    TURL = URL + ('&' if '?' in URL else '?') + 'test=homes'
    WB12B2 = {'otaku_2': (10, 1600, 1400), 'otaku_3': (16, 2000, 1600), 'rocket_2': (10, 1600, 1400), 'rocket_3': (14, 2000, 1600)}   # 禁区格数 = 列数 × 2 排
    zc = b.new_context(**p.devices['iPhone 15']); zp = zc.new_page(); hook(zp, '12b2')
    zp.goto(URL); zp.evaluate("localStorage.clear()"); zp.reload(); zp.wait_for_timeout(800); close_modals(zp)
    hl3 = S(zp, "Promise.all(" + json.dumps([[k, v[1], v[2]] for k, v in WB12B2.items()]) + ".map(([k,w,h])=>new Promise(r=>{ if(!__tzz.HOME_ART[k]) return r(k+' 没登记'); const im=new Image(); im.onload=()=>r(im.naturalWidth===w&&im.naturalHeight===h?null:k+' 尺寸 '+im.naturalWidth+'×'+im.naturalHeight); im.onerror=()=>r(k+' 加载失败'); im.src='art/home_'+k+'.webp';}))).then(a=>a.filter(Boolean))")
    check(hl3 == [], f'12b2 阿宅 / 火箭老板 Lv2/Lv3 底图都登记、加载成功、尺寸对（公寓 1600×1400、豪宅 2000×1600）{hl3}')
    a77 = S(zp, "Promise.all([['ceo_c77',480],['face_c77',192]].map(([n,w])=>new Promise(r=>{const im=new Image(); im.onload=()=>r(im.naturalWidth===w&&im.naturalHeight===w?null:n+' '+im.naturalWidth+'×'+im.naturalHeight); im.onerror=()=>r(n+' 加载失败'); im.src='art/'+n+'.webp?v='+(n==='face_c77'?'12d2':'12b2');}))).then(a=>a.filter(Boolean))")
    check(a77 == [], f'12b2 77 漫画新全身 ceo_c77 480×480、头像 face_c77 192×192（12d2 换回原版）都能加载 {a77}')
    zp.locator('#bottomNav [data-tab="ceo"]').click(); zp.wait_for_timeout(500)
    srcs = S(zp, "[...document.querySelectorAll('img')].map(i=>i.getAttribute('src')||'').filter(s=>/_c77\\.webp/.test(s))")
    check(srcs and all(s.endswith('?v=12d2') if 'face_c77' in s else s.endswith('?v=12b2') for s in srcs) and any('face_c77' in s for s in srcs) and any('ceo_c77' in s for s in srcs), f'12b2/12d2 CEO 页 77：头像带单图缓存号 ?v=12d2（换回原版）、全身仍 ?v=12b2 {srcs[:4]}')
    # 12d2：服务器上的头像字节 = 72323b4^ 原版，全身 = 72323b4 新版（线上跑就是核对线上文件）
    import hashlib, urllib.request
    _base = URL.split('?')[0].rsplit('/', 1)[0]
    def _sha(n, v):
        for _ in range(3):
            try: return hashlib.sha256(urllib.request.urlopen(f'{_base}/art/{n}.webp?v={v}', timeout=30).read()).hexdigest()
            except Exception as e: _err = e
        return 'ERR ' + str(_err)
    fs_, cs_ = _sha('face_c77', '12d2'), _sha('ceo_c77', '12b2')
    check(fs_ == '020bcc1fba97f778e96841d71c29174ab4ee8af7075a927a3e1322d73dd81342' and cs_ == '0233b7ed158ee38ec7c34d6dc411b29bb5685b46bab6161f535f10837212a2c4', f'12d2 站上 face_c77.webp = 72323b4^ 原版（{fs_[:12]}）、ceo_c77.webp = 72323b4 新版（{cs_[:12]}）')
    fsrc = S(zp, "(()=>{const i=[...document.querySelectorAll('img')].find(i=>/face_c77/.test(i.getAttribute('src')||'')); return i ? {ok:i.complete && i.naturalWidth===192, src:i.getAttribute('src')} : null})()")
    check(fsrc and fsrc['ok'], f'12d2 CEO 页 77 头像图片实际加载成功（192×192）{fsrc}')
    S(zp, "(()=>{const s=__tzz.state; s.ceos.otaku.unlocked=true; s.ceos.rocket.unlocked=true; s.coins=1e9; __tzz.persist();})()")
    zp.locator('#bottomNav [data-tab="home"]').click(); zp.wait_for_timeout(500); close_modals(zp)
    for key, (nb, W, H) in WB12B2.items():
        cid, lv = key.split('_')[0], int(key[-1])
        S(zp, f"(()=>{{const s=__tzz.state; s.homes.{cid}.lv={lv}; s.homes.{cid}.placed=[]; __tzz.persist(); __tzz.homeAct('homeWho','{cid}'); __tzz.renderTab();}})()")
        zp.wait_for_function("(()=>{const i=document.querySelector('#room .room-art'); return i&&i.complete&&i.naturalWidth>0})()", timeout=15000)
        g = S(zp, "(()=>{const r=document.getElementById('room'),im=r.querySelector('.room-art'); return {has:r.classList.contains('has-art'), src:im.getAttribute('src'), nw:im.naturalWidth, nh:im.naturalHeight, blocks:document.querySelectorAll('#wallGrid .wall-block').length, n:__tzz.E.wallBlockedCells(__tzz.state,__tzz.homeWho).length}})()")
        check(g['has'] and g['src'].startswith(f'art/home_{key}.webp') and g['nw'] == W and g['nh'] == H and g['blocks'] == g['n'] == nb, f"12b2 {key}：房间用真底图 {g['nw']}×{g['nh']}，墙面禁区 {g['blocks']} 格（应 {nb}）")
    zc.close()
    # —— 测试房间：先造一份真存档（另一个标签开着真游戏），再开 ?test=homes 狂操作，真存档 / 备份 / 多标签锁一个字节都不能变 ——
    tc = b.new_context(**p.devices['iPhone 15']); rp = tc.new_page(); hook(rp, '12b2-real')
    rp.goto(URL); rp.evaluate("localStorage.clear()"); rp.reload(); rp.wait_for_timeout(800); close_modals(rp)
    S(rp, "(()=>{const s=__tzz.state,E=__tzz.E; s.coins=123456; s.taps=77; E.buyFurniture(s,'furn_painting'); E.placeItem(s,'c77','furn_painting',0,1,0,'wall'); __tzz.persist();})()")
    LS = "(()=>{const o={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return o})()"
    rp.close()   # 真游戏标签自己每 5 秒 / 切后台关页时也会存档：先关掉，再从同源的静态页（version.json，不跑游戏）拍 localStorage 快照，下面逐字节比
    vj = tc.new_page(); vj.goto(URL.rsplit('/', 1)[0] + '/version.json'); snap0 = S(vj, LS); real0 = json.loads(snap0[KEY])
    tp = tc.new_page(); hook(tp, '12b2-test'); tp.goto(TURL); tp.wait_for_timeout(900)
    t = S(tp, "(()=>{const s=__tzz.state,b=document.getElementById('testBadge'); return {tm:__tzz.TEST_MODE, tab:document.getElementById('app').dataset.tab, badge:b&&getComputedStyle(b).display!=='none'&&b.getBoundingClientRect().height>0?b.textContent:'', lv:['c77','pearl','otaku','rocket'].map(id=>s.homes[id].lv), open:['c77','pearl','otaku','rocket'].every(id=>s.ceos[id].unlocked), n:['c77','pearl','otaku','rocket'].map(id=>s.homes[id].placed.length), wall:['c77','pearl','otaku','rocket'].map(id=>s.homes[id].placed.filter(q=>q.surf==='wall').length), inv:s.furnInv.furn_painting, coins:s.coins, modal:!document.querySelector('#modal').classList.contains('hidden')}})()")
    check(t['tm'] and t['tab'] == 'home' and '不存档' in t['badge'] and t['lv'] == [2, 2, 2, 2] and t['open'] and t['n'] == [8, 8, 8, 8] and t['wall'] == [1, 1, 1, 1] and t['inv'] == 4 and t['coins'] >= 1e12 and not t['modal'],
          f"12b2 ?test=homes：直接进家宅、角标「{t['badge']}」、四家公寓都开、每家 7 件家具 + 1 幅画、仓库 4 幅画、不弹开场 {t['lv']} {t['n']}")
    S(tp, "__tzz.homeAct('homeWho','otaku'); __tzz.renderTab()"); tp.wait_for_function("(()=>{const i=document.querySelector('#room .room-art'); return i&&i.complete&&i.naturalWidth>0&&[...document.querySelectorAll('#room .furn img')].every(x=>x.complete)})()", timeout=15000)
    rr = S(tp, "(()=>{const r=document.getElementById('room'); return {has:r.classList.contains('has-art'), src:r.querySelector('.room-art').getAttribute('src'), furn:r.querySelectorAll('.furn').length, blocks:r.querySelectorAll('.wall-block').length}})()")
    check(rr['has'] and 'home_otaku_2.webp' in rr['src'] and rr['furn'] == 8 and rr['blocks'] == 10, f"12b2 测试房间阿宅公寓：真底图、8 件家具画出来、墙面禁区 {rr['blocks']} 格 {rr['src']}")
    # 挂画拖到禁区被拒（如实提示），拖到空墙可以；买家具 / 摆 / 升级 / 自动保存都只在内存
    nb = S(tp, "(()=>{const s=__tzz.state,E=__tzz.E,q=s.homes.otaku.placed.find(x=>x.surf==='wall'); const bad=E.moveItem(s,'otaku',q.uid,4,0), good=E.moveItem(s,'otaku',q.uid,1,1); E.buyFurniture(s,'furn_sofa'); const pl=E.placeItem(s,'otaku','furn_sofa',4,1,0); const up=E.upgradeHome(s,'rocket'); __tzz.persist(); __tzz.renderTab(); return {bad:bad.ok, why:bad.why, good:good.ok, pl:pl.ok, up:up.ok, rocket:s.homes.rocket.lv}})()")
    check(not nb['bad'] and '窗户' in (nb['why'] or '') and nb['good'] and nb['pl'] and nb['up'] and nb['rocket'] == 3, f"12b2 测试房间：画拖到第 5 列被拒「{nb['why']}」、拖到空墙可以、买 / 摆沙发、火箭老板升豪宅都正常")
    tp.locator('.mode-tabs [data-arg="decor"]').first.click() if tp.locator('.mode-tabs [data-arg="decor"]').count() else None
    tp.wait_for_timeout(6500)   # 等过一轮 5 秒自动保存
    snap1 = S(tp, LS)
    check(snap1 == snap0 and not S(tp, '__tzz.frozen'), f'12b2 测试房间操作 + 自动保存后：localStorage 一字不差（{len(snap0)} 个键：{sorted(snap0)}）')
    tp.reload(); tp.wait_for_timeout(900)
    t2 = S(tp, "(()=>{const s=__tzz.state; return {tm:__tzz.TEST_MODE, rocket:s.homes.rocket.lv, n:s.homes.otaku.placed.length}})()")
    check(t2['tm'] and t2['rocket'] == 2 and t2['n'] == 8 and S(tp, LS) == snap0, f'12b2 测试房间刷新 = 重置成初始假数据（火箭老板回公寓、阿宅回 8 件），真存档仍不变 {t2}')
    l3 = tc.new_page(); hook(l3, '12b2-lv3'); l3.goto(TURL + '&lv=3'); l3.wait_for_timeout(900)
    t3 = S(l3, "(()=>{const s=__tzz.state,ids=['c77','pearl','otaku','rocket']; return {tm:__tzz.TEST_MODE, lv:ids.map(id=>s.homes[id].lv), ok:ids.every(id=>s.homes[id].placed.every(q=>__tzz.E.canPlace(s,id,q.fid,q.x,q.y,q.rot,q.uid,q.surf).ok)), badge:document.getElementById('testBadge').textContent}})()")
    check(t3['tm'] and t3['lv'] == [3, 3, 3, 3] and t3['ok'] and '豪宅' in t3['badge'], f"12b2 ?test=homes&lv=3：四家都是豪宅、摆放全合法、角标「{t3['badge']}」")
    l3.close()
    # 版本自检重开（缓存旧页 → 带新版本号重开）也要保住 test=homes，不会掉回真存档
    vp = tc.new_page(); hook(vp, '12b2-ver'); vp.route('**/version.json*', lambda r: r.fulfill(status=200, content_type='application/json', body='{"v":"99z"}'))
    vp.goto(TURL); vp.wait_for_timeout(1500)
    check('v=99z' in vp.url and 'test=homes' in vp.url and S(vp, '__tzz.TEST_MODE') and S(vp, LS) == snap0, f'12b2 版本自检重开后网址仍带 test=homes（{vp.url.split("/")[-1]}），仍是测试房间、真存档不变')
    vp.close()
    # 不带参数 / 参数不对都进不了测试房间：读回的就是刚才那份真存档
    for q in ['', '?test=home', '?test=HOMES', '?homes=1']:
        np_ = tc.new_page(); hook(np_, '12b2-no'); np_.goto(URL + q); np_.wait_for_timeout(900)
        r = S(np_, "(()=>({tm:__tzz.TEST_MODE, coins:Math.floor(__tzz.state.coins), taps:__tzz.state.taps, badge:!!document.getElementById('testBadge'), lv:__tzz.state.homes.otaku.lv, wall:__tzz.state.homes.c77.placed.filter(x=>x.surf==='wall').map(x=>x.x+','+x.y)}))()")
        check(not r['tm'] and not r['badge'] and r['coins'] == int(real0['coins']) and r['taps'] == 77 and r['lv'] == 1 and r['wall'] == ['0,1'], f"12b2 网址「{q or '（无参数）'}」：不是测试房间，读的是真存档（金币 {r['coins']}、点击 77、77 墙上原来那幅画 {r['wall']}）")
        np_.close()
    # 真游戏标签开着的时候再开测试房间：真标签不被挤下线（多标签锁没被改），测试房间也不会因为真标签存档而冻结
    rp = tc.new_page(); hook(rp, '12b2-real2'); rp.goto(URL); rp.wait_for_timeout(900); close_modals(rp)
    lock0 = S(rp, "localStorage.getItem('tangzhe-preview-tab-lock')")
    tp2 = tc.new_page(); hook(tp2, '12b2-test2'); tp2.goto(TURL); tp2.wait_for_timeout(900)
    S(tp2, "(()=>{const s=__tzz.state,E=__tzz.E; E.buyFurniture(s,'furn_lamp'); E.upgradeHome(s,'c77'); __tzz.persist();})()"); S(rp, "__tzz.persist()"); tp2.wait_for_timeout(6000)
    lock1 = S(rp, "localStorage.getItem('tangzhe-preview-tab-lock')"); rs = json.loads(S(rp, LS)[KEY])
    check(lock1 == lock0 and not S(rp, '__tzz.frozen') and not S(tp2, '__tzz.frozen') and rs['homes']['c77']['lv'] == 1 and rs.get('test') is None, f'12b2 真游戏 + 测试房间同时开：真标签没被挤下线、多标签锁没被改，测试房间里升的房子没进真存档（77 仍小屋）')
    tp2.close()
    after = json.loads(S(rp, LS)[KEY])
    check(after.get('test') is None and after['homes']['otaku']['lv'] == 1 and after['coins'] >= real0['coins'], '12b2 真存档里没有任何测试房间的数据（没有 test 标记、阿宅仍是小屋）')
    tc.close()

    print('== 9. 各尺寸 iPhone 视口 ==')
    for name in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 13 Mini', 'iPhone 15', 'iPhone 15 Pro Max', 'iPhone 16 Pro Max']:
        c = b.new_context(**p.devices[name]); q = c.new_page(); hook(q, name)
        q.goto(URL); q.evaluate("localStorage.clear()"); q.reload(); q.wait_for_timeout(700); close_modals(q)
        q.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e8; E.hireEmp(s,0); s.shops[0].lv=12; E.openShop(s,1); E.hireEmp(s,1); __tzz.persist(); __tzz.renderTab();})()"); q.wait_for_timeout(600); close_modals(q)
        m = q.evaluate("""(()=>{const vw=innerWidth,vh=innerHeight,r=s=>document.querySelector(s).getBoundingClientRect();
          const btns=[...document.querySelectorAll('.buy,#bottomNav button,#shopTabs button,.icon-btn')].filter(x=>x.offsetParent);
          return {vw,vh,sw:document.documentElement.scrollWidth, nav:r('#bottomNav').bottom, stage:r('#stage').height, panel:r('#panel').height,
            minBtn:Math.min(...btns.map(x=>Math.min(x.getBoundingClientRect().height, x.getBoundingClientRect().width)))}})()""")
        ok = m['sw'] <= m['vw'] and m['nav'] <= m['vh'] + 1 and m['stage'] >= 140 and m['panel'] >= 110 and m['minBtn'] >= 32
        check(ok, f"{name} {m['vw']}×{m['vh']}: 无横向溢出 {m['sw']}≤{m['vw']}，底栏在屏内，画面 {round(m['stage'])}px，面板 {round(m['panel'])}px，最小按钮 {round(m['minBtn'])}px")
        q.screenshot(path=f"{SHOTS}/vp_{name.replace(' ','_').replace('(','').replace(')','')}.png")
        c.close()
    b.close()
print('\nERRORS:', errs)
bad = [m for ok, m in results if not ok]
print(f'\nRESULT: {len(results) - len(bad)}/{len(results)} passed' + (f'; FAILED: {bad}' if bad else ''))
sys.exit(1 if bad or errs else 0)
