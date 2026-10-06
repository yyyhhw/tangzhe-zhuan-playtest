# 12d 金币安全 v1 端到端（WebKit = iPhone Safari 内核；SE / SE3 / iPhone 15）
# 用法：先在本目录起静态服务，再 .pwvenv/bin/python test_coin_e2e.py [URL]
# 12d3：第 10 / 11 段 = 熊大 22:08 存档四处 + 统一交易（localStorage.setItem 抛异常模拟主档 / 备份写失败，每条改状态路径都要回滚）
# 12d1：第 9 段 = 熊大 17:53 三处阻塞（余额超 MAX_SAFE_INTEGER 进异常模式、原文不覆盖、交易全封；扣款精确；累计收入整数 + 零头；MAX 零余额 = 0）
# 覆盖：熊大 17:00 测试者场景（4.52 亿 / 41.88 万每秒 / 团单 / 离线双倍）、坏档走备份、没备份不覆盖、内存坏值不写盘、
#      余额上限、旧档超上限、等级上限满级显示、MAX / x10 遵守上限、坏离线收益、备份轮换、测试房间不写备份
import sys, json, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49710/index.html'
KEY, BAK = 'tangzhe-preview-save', 'tangzhe-preview-save-bak'
results = []
def check(cond, msg):
    results.append((bool(cond), msg)); print(('  ✓ ' if cond else '  ✗ ') + msg)
def S(pg, expr): return pg.evaluate(expr)
def modal_visible(pg): return pg.evaluate("!document.querySelector('#modal').classList.contains('hidden')")
def close_modals(pg, n=6):
    for _ in range(n):
        if not modal_visible(pg): return
        for sel in ['#mOk', '#pvNo', '#mNo', '#claim']:
            if pg.locator(sel).count():
                pg.locator(sel).first.click(); pg.wait_for_timeout(250); break
        else: return
# 在页面里按经济核心造一份「测试者」存档（4.52 亿、店 53/55/45/28、员工 5、CEO 5 → 41.88 万/秒）；opts 覆盖字段
MK = """(opts)=>{const E=__tzz.E, T=Date.now(), st=E.newState(T); st.coins=1e13; E.hireEmp(st,0); [1,2,3].forEach(i=>{E.openShop(st,i); E.hireEmp(st,i);});
  [53,55,45,28].forEach((lv,i)=>{st.shops[i].lv=lv; st.shops[i].emp=5;}); E.checkUnlocks(st); for(const id in st.ceos) st.ceos[id].lv=5;
  for(let k=0;k<6;k++) E.gachaDraw(st,0.2+k*0.13); E.buyFurniture(st,'furn_bed'); E.placeItem(st,'c77','furn_bed',0,0,0);
  st.coins=452000000.37; delete st.coinFrac; st.totalEarned=2.1e9; st.lastSeen=st.maxSeen=T; st.rev=300; st.taps=5000; st.bigCustomers=40;
  const o=opts||{}; if(o.f) (new Function('st','E','T',o.f))(st,E,T); return JSON.stringify(st);}"""
BLANK = URL.split('?')[0].rsplit('/', 1)[0] + '/version.json'   # 同源静态页：先离开游戏页（让它的 pagehide 存档先跑完），再写测试档，不会被旧页覆盖
def boot(pg, main=None, bak=None, wait=1000, q=''):
    pg.goto(BLANK); pg.evaluate("localStorage.clear()")
    pg.evaluate("([k,b,m,bk])=>{if(m!=null) localStorage.setItem(k,m); if(bk!=null) localStorage.setItem(b,bk);}", [KEY, BAK, main, bak])
    pg.goto(URL + q); pg.wait_for_timeout(wait)
def mk(pg, f=None):
    return pg.evaluate(MK, {'f': f} if f else None)
def ls(pg, k): return pg.evaluate("k=>localStorage.getItem(k)", k)

with sync_playwright() as p:
    b = p.webkit.launch(); errs = []
    def page(dname='iPhone 15'):
        c = b.new_context(**p.devices[dname]); pg = c.new_page()
        pg.on('pageerror', lambda e: errs.append(f'{dname} pageerror: {e}'))
        pg.goto(URL); pg.wait_for_timeout(500); return c, pg
    c, pg = page()
    t_start = time.time()
    print('== 1. 熊大 17:00 场景：4.52 亿余额 / 41.88 万每秒 / 团单结算 / 离线双倍，进度等级完整保留 ==')
    try:
        legacy = mk(pg); L = json.loads(legacy)
        boot(pg, legacy); close_modals(pg)
        s = S(pg, "(()=>{const s=__tzz.state; return {c:s.coins, f:s.coinFrac, shops:s.shops, ceos:s.ceos, owned:s.gacha.owned, homes:s.homes, inv:s.furnInv, rate:__tzz.E.baseRate(s), coinTxt:document.getElementById('coins').textContent, cps:document.getElementById('cps').textContent}})()")
        check(s['c'] >= 452000000 and isinstance(s['c'], int) or float(s['c']).is_integer(), f"12d 旧档（小数余额、没有零头字段）读进来：整数金币 {s['c']} + 零头 {s['f']}")
        check(s['shops'] == L['shops'] and s['ceos'] == L['ceos'] and s['owned'] == L['gacha']['owned'] and s['homes'] == L['homes'] and s['inv'] == L['furnInv'], '12d 测试者档读进来：店铺等级 / 员工 / CEO / 收藏 / 家宅 / 仓库完全一致')
        check(abs(s['rate'] - 418800) < 50 and '41.88万' in s['cps'] and s['coinTxt'] in ('4.52亿', '4.53亿'), f"12d 测试者档：每秒 {s['cps']}，余额显示 {s['coinTxt']}")
        S(pg, "__tzz.forceBig()"); pg.wait_for_timeout(1200)
        o = S(pg, "__tzz.order && {pay:__tzz.order.payout, rate:__tzz.order.rate}")
        c0 = S(pg, "__tzz.E.balance(__tzz.state)"); n0 = S(pg, "__tzz.state.bigCustomers"); t0 = S(pg, "Date.now()")
        S(pg, "(()=>{const o=__tzz.order; if(o) o.progress=1;})()"); pg.wait_for_timeout(500)
        c1 = S(pg, "__tzz.E.balance(__tzz.state)"); t1 = S(pg, "Date.now()")
        auto = s['rate'] * (t1 - t0) / 1000
        check(o and abs(o['pay'] - s['rate'] * 120) < 1 and S(pg, "__tzz.state.bigCustomers") == n0 + 1, f"12d 团单出现并结算：报价 = 产速 × 4 × 30 = {o and round(o['pay'])}")
        check(o and abs((c1 - c0) - (o['pay'] + auto)) < s['rate'] * 0.6 + 1, f"12d 团单入账 + 在线收益 = {round(c1 - c0)}（团单 {o and round(o['pay'])} + 在线约 {round(auto)}）")
        S(pg, "__tzz.persist()"); raw = json.loads(ls(pg, KEY))
        check(float(raw['coins']).is_integer() and 0 <= raw['coinFrac'] < 1 and raw['shops'] == L['shops'] and raw['ceos'] == L['ceos'], f"12d 写盘：coins 是整数 {raw['coins']}、零头 {raw['coinFrac']:.3f} 分开存；等级原样")
        before = S(pg, "__tzz.E.balance(__tzz.state)")
        pg.reload(); pg.wait_for_timeout(1000); close_modals(pg)
        after = S(pg, "({b:__tzz.E.balance(__tzz.state), shops:__tzz.state.shops, ceos:__tzz.state.ceos, src:__tzz.loadInfo.source})")
        check(after['src'] == 'main' and after['b'] >= before and after['b'] - before < s['rate'] * 6 and after['shops'] == L['shops'] and after['ceos'] == L['ceos'], f"12d 刷新后余额 {round(after['b'])} ≥ 刷新前 {round(before)}，等级不变")
        # 离开 2 小时回来：离线收益 50%，今日双倍
        off = mk(pg, "st.lastSeen=st.maxSeen=T-7200e3; st.dailyDoubleDay=null;")
        boot(pg, off, wait=1200)
        vis = modal_visible(pg) and pg.locator('#claimDouble').count() == 1
        cb = S(pg, "__tzz.E.balance(__tzz.state)"); pend = S(pg, "__tzz.state.pending && __tzz.state.pending.amount")
        if vis: pg.click('#claimDouble'); pg.wait_for_timeout(500)
        ca = S(pg, "__tzz.E.balance(__tzz.state)")
        check(vis and pend and abs(pend - s['rate'] * 0.5 * 7200) < s['rate'] and ca - cb >= pend * 2 - 1 and ca - cb < pend * 2 + s['rate'] * 3, f"12d 离开 2 小时：离线 {pend and round(pend)}（50%），双倍领取到账 {round(ca - cb)}")
        check(S(pg, "!__tzz.state.pending && __tzz.state.claimLog.length >= 1"), '12d 领完 pending 清掉、领取记录写入（不会重复领）')

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 2. 坏档：主档金币 / 等级坏值 → 用完整备份恢复，不归零、不降级 ==')
    try:
        good = mk(pg); goodJ = json.loads(good)
        bakJ = json.loads(good); bakJ['coins'] = 451000000; bakJ['rev'] = 290; bak = json.dumps(bakJ)
        variants = {
            'coins = null（∞ 写进 JSON）': lambda r: r.update(coins=None),
            'coins = "abc"': lambda r: r.update(coins='abc'),
            'coins = -1': lambda r: r.update(coins=-1),
            'coins = "NaN"': lambda r: r.update(coins='NaN'),
            '店铺等级 = "abc"': lambda r: r['shops'][0].update(lv='abc'),
            'CEO 等级 = null': lambda r: r['ceos']['rocket'].update(lv=None),
        }
        for nm, fn in variants.items():
            r = json.loads(good); fn(r); r['rev'] = 305; badmain = json.dumps(r)
            boot(pg, badmain, bak); toast = pg.inner_text('#toast') if pg.locator('#toast:not(.hidden)').count() else ''
            st = S(pg, "({c:__tzz.state.coins, src:__tzz.loadInfo.source, shops:__tzz.state.shops, ceos:__tzz.state.ceos, rev:__tzz.state.rev, frozen:__tzz.frozen})")
            close_modals(pg); S(pg, "__tzz.persist()"); m2 = json.loads(ls(pg, KEY))
            check(st['src'] == 'bak' and st['c'] >= 451000000 and st['shops'] == bakJ['shops'] and st['ceos'] == bakJ['ceos'] and not st['frozen'], f"12d 主档 {nm} → 从备份恢复：余额 {st['c']}、等级来自备份、没被多标签锁误冻（rev {st['rev']}）")
            check('备份恢复' in toast and float(m2['coins']).is_integer() and m2['coins'] >= 451000000, f"12d 主档 {nm}：提示「已从完整备份恢复」，主档改写成好档（{m2['coins']}），不是 0")
        trunc = good[:300]
        boot(pg, trunc, bak); st = S(pg, "({c:__tzz.state.coins, src:__tzz.loadInfo.source})")
        check(st['src'] == 'bak' and st['c'] >= 451000000, f'12d 主档 JSON 截断 → 从备份恢复 {st}')

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 3. 坏档且没有可用备份 → 不覆盖原档、提示 ==')
    try:
        r = json.loads(good); r['coins'] = None; badmain = json.dumps(r)
        for bk, nm in [(None, '没有备份'), (badmain, '备份也坏')]:
            boot(pg, badmain, bk, wait=1200)
            info = S(pg, "({blk:__tzz.saveBlocked, badge:!!document.getElementById('saveBadge'), modal:document.getElementById('mpanel').innerText})")
            check(info['blk'] and info['badge'] and '存档读不出来' in info['modal'] and '不会自动保存' in info['modal'], f"12d 主档坏 + {nm}：进入不保存模式，顶部角标 + 弹窗说明")
            close_modals(pg)
            S(pg, "__tzz.persist(); __tzz.tapShop(100,300); __tzz.persist()"); pg.wait_for_timeout(5600)
            check(ls(pg, KEY) == badmain and ls(pg, BAK) == bk, f"12d 主档坏 + {nm}：6 秒自动存档 + 手点 + 手动保存后，原主档 / 备份一个字节都没变")

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 4. 内存里出现坏值 → 不写盘，回到上一次存档 ==')
    try:
        for v in ['NaN', 'Infinity', '-1', "'abc'", 'null', 'undefined']:
            boot(pg, good); close_modals(pg); S(pg, "__tzz.persist()"); saved = ls(pg, KEY); good_c = json.loads(saved)['coins']
            res = S(pg, f"(()=>{{__tzz.state.coins={v}; const ok=__tzz.persist(); return {{ok, c:__tzz.state.coins, toast:document.getElementById('toast').textContent}};}})()")
            check(res['ok'] is False and res['c'] == good_c and ls(pg, KEY) == saved and '回到上一次存档' in res['toast'], f"12d 内存余额 = {v}：拒绝写盘，存档原样，内存回到上一次存档（{res['c']}）")
        boot(pg, good); close_modals(pg); S(pg, "__tzz.persist()"); saved = ls(pg, KEY)
        res = S(pg, "(()=>{__tzz.state.pending={id:'x',sec:1,gap:1,amount:NaN,from:0}; return __tzz.persist();})()")
        check(res is False and ls(pg, KEY) == saved and S(pg, "__tzz.state.pending") is None, '12d 内存待领取收益 NaN：拒绝写盘、回到上一次存档')
        # 坏值时点 UI 购买：等级不动
        boot(pg, good); close_modals(pg)
        S(pg, "__tzz.setTab('shop'); __tzz.switchShop(0)"); pg.wait_for_timeout(300); close_modals(pg)
        lv0 = S(pg, "__tzz.state.shops[0].lv"); S(pg, "__tzz.state.coins=NaN"); pg.locator('[data-act="amt"][data-arg="1"]').click()
        pg.locator('[data-act="up"]').first.click(); pg.wait_for_timeout(300)
        check(S(pg, "__tzz.state.shops[0].lv") == lv0, '12d 余额被写成 NaN 时点「升级」：等级不变')
        pg.locator('[data-act="amt"][data-arg="max"]').click(); pg.wait_for_timeout(200); S(pg, "__tzz.state.coins=NaN")
        pg.locator('[data-act="up"]').first.click(); pg.wait_for_timeout(300)
        check(S(pg, "__tzz.state.shops[0].lv") == lv0, '12d 余额被写成 NaN 时点 MAX「升级」：等级不变')
        S(pg, "__tzz.persist()"); pg.wait_for_timeout(200)
        check(S(pg, "Number.isFinite(__tzz.state.coins) && __tzz.state.coins >= 452000000"), '12d 之后自动存档发现坏值 → 回到上一次存档（余额正常）')

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 5. 余额上限 1e15 ==')
    try:
        capS = mk(pg, "st.coins=1e15-200; st.coinFrac=0;")
        boot(pg, capS, wait=2500); close_modals(pg); pg.wait_for_timeout(500)
        cv = S(pg, "({c:__tzz.state.coins, f:__tzz.state.coinFrac, t:document.getElementById('coins').textContent})")
        S(pg, "__tzz.persist()"); m = json.loads(ls(pg, KEY))
        check(cv['c'] == 1e15 and cv['f'] == 0 and m['coins'] == 1e15, f"12d 差 200 到上限，收入 41.88 万/秒 → 停在正好 1e15（显示 {cv['t']}），存档也是 1e15")
        S(pg, "__tzz.forceBig()"); pg.wait_for_timeout(1200); S(pg, "(()=>{const o=__tzz.order; if(o) o.progress=1;})()"); pg.wait_for_timeout(400)
        check(S(pg, "__tzz.state.coins") == 1e15, '12d 到上限后团单结算也不超过 1e15')

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 6. 旧档已超上限：保留余额和等级，停止增长，读档不降级 ==')
    try:
        over = mk(pg, "st.coins=5e15; st.coinFrac=0; st.shops[0].lv=150; st.shops[1].emp=38; st.ceos.rocket.lv=29;")
        boot(pg, over, wait=1500); close_modals(pg)
        S(pg, "__tzz.setTab('shop'); __tzz.switchShop(0)"); pg.wait_for_timeout(2500); close_modals(pg)
        ov = S(pg, "({c:__tzz.state.coins, lv:__tzz.state.shops[0].lv, emp:__tzz.state.shops[1].emp, rk:__tzz.state.ceos.rocket.lv, up:!!document.querySelector('[data-act=\"up\"]'), mx:[...document.querySelectorAll('[data-max]')].map(e=>e.dataset.max+':'+e.textContent+':'+e.disabled)})")
        check(ov['c'] == 5e15 and ov['lv'] == 150 and ov['emp'] == 38 and ov['rk'] == 29, f"12d 旧档 5e15 / 店 Lv150 / 员工 Lv38 / 火箭 Lv29 读档后 2.5 秒：余额不涨不截、等级不降 {ov['c']}")
        check(not ov['up'] and 'shop:满级:true' in ov['mx'], f"12d 旧档 Lv150 店铺：只显示「满级」（不能买）{ov['mx']}")
        pg.reload(); pg.wait_for_timeout(1000); close_modals(pg)
        check(S(pg, "__tzz.state.coins===5e15 && __tzz.state.shops[0].lv===150"), '12d 旧档超上限刷新后仍保留')

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 7. 等级上限 / MAX / x10（三机型）==')
    try:
        for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
            dc, dp = page(dname)
            sv = mk(dp, "st.coins=5e15; st.coinFrac=0; st.shops[0].lv=100; st.shops[0].emp=35; st.ceos.c77.lv=30; st.shops[3].emp=21; st.ceos.rocket.lv=25;")
            boot(dp, sv); close_modals(dp)
            dp.evaluate("__tzz.setTab('shop'); __tzz.switchShop(0)"); dp.wait_for_timeout(300); close_modals(dp)
            dp.locator('[data-act="amt"][data-arg="max"]').click(); dp.wait_for_timeout(300)
            lab = dp.locator('[data-act="up"]').first.inner_text()
            check('×10' in lab, f"12d {dname}：烧烤 Lv100、钱够 → MAX 按钮只到 ×10（Lv110 封顶）「{lab.splitlines()[0]}」")
            dp.locator('[data-act="up"]').first.click(); dp.wait_for_timeout(500)
            mx = S(dp, "({lv:__tzz.state.shops[0].lv, up:!!document.querySelector('[data-act=\"up\"]'), m:[...document.querySelectorAll('[data-max]')].map(e=>e.dataset.max+':'+e.textContent+':'+e.disabled), g:[...document.querySelectorAll('.gain')].map(e=>e.textContent).filter(x=>x.includes('满级'))})")
            check(mx['lv'] == 110 and not mx['up'] and 'shop:满级:true' in mx['m'], f"12d {dname}：MAX 买到 Lv110 停，店铺按钮变「满级」不能点 {mx['m']}")
            check('emp:满级:true' in mx['m'] and 'ceo:满级:true' in mx['m'] and any('Lv110' in x for x in mx['g']) and any('Lv35' in x for x in mx['g']), f"12d {dname}：员工阿炭 Lv35、77 Lv30 也显示「满级」，写明上限 {mx['g']}")
            dp.evaluate("(()=>{__tzz.state.shops[0].lv=105; __tzz.renderTab();})()"); dp.locator('[data-act="amt"][data-arg="10"]').click(); dp.wait_for_timeout(300)
            lab10 = dp.locator('[data-act="up"]').first.inner_text()
            check('×5' in lab10, f"12d {dname}：Lv105 选 x10 → 只买 ×5「{lab10.splitlines()[0]}」")
            dp.evaluate("__tzz.switchShop(3)"); dp.wait_for_timeout(400); close_modals(dp)
            t3 = S(dp, "[...document.querySelectorAll('[data-max]')].map(e=>e.dataset.max+':'+e.textContent)")
            empbtn = dp.locator('[data-act="emp"]').count()
            check('ceo:满级' in t3 and empbtn == 1, f"12d {dname}：科技公司火箭老板 Lv25 显示「满级」，小栈 Lv21 还能升（上限 22）{t3}")
            dp.locator('[data-act="emp"]').first.click(); dp.wait_for_timeout(300)
            t3b = S(dp, "({e:__tzz.state.shops[3].emp, m:[...document.querySelectorAll('[data-max]')].map(e=>e.dataset.max)})")
            check(t3b['e'] == 22 and 'emp' in t3b['m'], f"12d {dname}：小栈升到 Lv22 后变「满级」{t3b}")
            dp.locator('#bottomNav [data-tab="ceo"]').click(); dp.wait_for_timeout(500); close_modals(dp)
            cm = S(dp, "[...document.querySelectorAll('[data-max=\"ceo\"]')].length")
            check(cm == 2, f"12d {dname}：CEO 页 77（Lv30）和火箭老板（Lv25）都显示「满级」按钮（{cm} 个）")
            dc.close()

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 8. 坏的待领取收益 / 备份轮换 / 测试房间 ==')
    try:
        bp = mk(pg, "st.pending={id:'zz', sec:3600, gap:3600, amount:'abc', from:T}; st.lastSeen=st.maxSeen=T;")
        boot(pg, bp, wait=1200)
        bi = S(pg, "({p:__tzz.state.pending, src:__tzz.loadInfo.source, c:__tzz.state.coins, t:document.getElementById('toast').textContent, m:!document.getElementById('modal').classList.contains('hidden') && document.getElementById('mpanel').innerText})")
        check(bi['p'] is None and bi['src'] == 'main' and 452000000 <= bi['c'] < 452000000 + s['rate'] * 3 and '离线收益数据异常' in bi['t'] and not (bi['m'] and '回来' in bi['m']), f"12d 存档里待领取收益 = \"abc\"：不弹领取、不入账（余额 {bi['c']}），提示数据异常")
        boot(pg, good); close_modals(pg); S(pg, "__tzz.persist()"); m1 = ls(pg, KEY); S(pg, "__tzz.persist()"); m2 = ls(pg, KEY)
        check(ls(pg, BAK) == m1 and json.loads(m1)['rev'] < json.loads(m2)['rev'], '12d 完整备份：每次写档前把上一份好主档整份放进 -bak（备份 = 上一份主档）')
        bk0 = ls(pg, BAK); S(pg, "localStorage.setItem('" + KEY + "', '{\"v\":3,\"coins\":null}')"); S(pg, "__tzz.state.rev=1e9; __tzz.persist()")
        check(ls(pg, BAK) == bk0 and json.loads(bk0)['coins'] >= 452000000 and json.loads(ls(pg, KEY))['coins'] >= 452000000, '12d 主档被外部写坏后再存档：坏主档不会被挪进备份（备份保持原来的好档），主档写回好档')
        boot(pg, q=('&' if '?' in URL else '?') + 'test=homes', wait=1500)
        S(pg, "__tzz.persist(); __tzz.earn(5)"); pg.wait_for_timeout(500)
        check(ls(pg, KEY) is None and ls(pg, BAK) is None, '12d 测试房间仍然不写主档 / 备份')
    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 9. 12d1 熊大 17:53：余额超安全整数封禁交易 / 扣款精确 / 累计收入零头 / MAX 零余额 ==')
    try:
        good = mk(pg); bakJ = json.loads(good); bakJ['coins'] = 451000000; bakJ['rev'] = 290; bak = json.dumps(bakJ)
        for coins, nm in [(1e20, '1e20'), (9007199254740993, 'MAX_SAFE_INTEGER+2')]:
            r = json.loads(good); r['coins'] = coins; r['coinFrac'] = 0; r['shops'][2]['emp'] = 0; r['rev'] = 305; r['lastSeen'] = r['maxSeen'] = r['lastSeen'] - 3600e3; um = json.dumps(r)   # 离开 1 小时回来
            for bk, bn in [(bak, '有好备份'), (None, '没有备份')]:
                boot(pg, um, bk, wait=1200)
                info = S(pg, "({blk:__tzz.saveBlocked, uns:__tzz.loadInfo.unsafe, src:__tzz.loadInfo.source, badge:(document.getElementById('saveBadge')||{}).textContent||'', modal:document.getElementById('mpanel').innerText, coinTxt:document.getElementById('coins').textContent})")
                hint = '备份里有一份正常存档' if bk else '没有找到可用的备份'
                check(info['blk'] and info['uns'] and info['src'] != 'bak' and info['src'] != 'main' and '余额异常' in info['badge'] and '超过了' in info['modal'] and '没有被覆盖' in info['modal'] and hint in info['modal'] and info['coinTxt'] == '存档异常', f"12d1 主档余额 {nm} + {bn}：进入异常模式（不读成正常钱包、不自动拿备份覆盖），角标 + 弹窗说明，余额显示「存档异常」 {info['src']}")
                close_modals(pg)
                S(pg, "__tzz.setTab('shop'); __tzz.switchShop(2)"); pg.wait_for_timeout(300); close_modals(pg)
                mut = S(pg, "new Promise(res=>{let n=0; const ob=new MutationObserver(m=>{n+=m.length}); ob.observe(document.getElementById('tabBody'),{childList:true,subtree:true}); setTimeout(()=>{ob.disconnect(); res(n)},1000)})")
                check(mut < 5 and not S(pg, "!!__tzz.state.pending") and not modal_visible(pg) and S(pg, "Date.now()-__tzz.state.lastSeen") < 2000, f"12d1 主档余额 {nm} + {bn}：离开 1 小时回来不结算离线、不弹领取，时间照常往前记（页面不会每帧重画：1 秒内 {mut} 次 DOM 变动）")
                before = S(pg, "JSON.stringify({c:__tzz.state.coins, s:__tzz.state.shops, ce:__tzz.state.ceos, g:__tzz.state.gacha.owned.length, inv:__tzz.state.furnInv})")
                for sel in ['[data-act="hire"]', '[data-act="emp"]', '[data-act="up"]']:   # force：按钮被拒时会抖动，不等它停稳
                    if pg.locator(sel).count(): pg.locator(sel).first.click(force=True); pg.wait_for_timeout(250)
                pg.locator('[data-act="amt"][data-arg="max"]').click(force=True); pg.wait_for_timeout(200)
                if pg.locator('[data-act="up"]').count(): pg.locator('[data-act="up"]').first.click(force=True); pg.wait_for_timeout(250)
                api = S(pg, "(()=>{const E=__tzz.E,s=__tzz.state; return [E.hireEmp(s,2),E.upgradeShop(s,0),E.upgradeEmp(s,0),E.upgradeCeo(s,'c77'),E.gachaDraw(s,0.5),E.buyFurniture(s,'furn_bed'),E.upgradeHome(s,'c77'),E.addCoins(s,100)].map(r=>!!r.ok)})()")
                after = S(pg, "JSON.stringify({c:__tzz.state.coins, s:__tzz.state.shops, ce:__tzz.state.ceos, g:__tzz.state.gacha.owned.length, inv:__tzz.state.furnInv})")
                check(after == before and not any(api), f"12d1 主档余额 {nm} + {bn}：点雇人 / 升级 / MAX + 8 条买卖接口全部被拒，余额 / 等级 / 收藏一点没变 {api}")
                S(pg, "__tzz.persist(); __tzz.tapShop(100,300); __tzz.persist()"); pg.wait_for_timeout(5600)
                check(ls(pg, KEY) == um and ls(pg, BAK) == bk, f"12d1 主档余额 {nm} + {bn}：6 秒自动存档 + 手点 + 手动保存后，原主档 / 备份一个字节都没变")
        # 扣款精确（UI）：旧档中间段 5e15+1、正常 4.52 亿（升级前一刻冻结收入）
        for coins, nm in [(5e15 + 1, '旧档中间段 5e15+1'), (9007199254740991, 'MAX_SAFE_INTEGER')]:
            sv = mk(pg, f"st.coins={int(coins)}; st.coinFrac=0;"); boot(pg, sv); close_modals(pg)
            S(pg, "__tzz.setTab('shop'); __tzz.switchShop(1)"); pg.wait_for_timeout(300); close_modals(pg); pg.locator('[data-act="amt"][data-arg="1"]').click(); pg.wait_for_timeout(200)
            res = []
            for sel in ['[data-act="up"]', '[data-act="emp"]']:
                c0 = S(pg, "__tzz.state.coins"); cost = int(pg.locator(sel).first.get_attribute('data-cost')); pg.locator(sel).first.click(); pg.wait_for_timeout(250); c1 = S(pg, "__tzz.state.coins")
                res.append((sel, c0 - c1 == cost and c1 < c0 and float(c1).is_integer(), c0, c1, cost))
            check(all(r[1] for r in res), f"12d1 扣款精确（{nm}）：店铺升级 / 员工升级点完余额正好少按钮上的价格 {[(r[0][10:-2], r[2]-r[3], r[4]) for r in res]}")
        # 累计收入整数 + 零头（41.88 万/秒、累计 3e15）
        sv = mk(pg, "st.totalEarned=3e15; st.earnedFrac=0;"); boot(pg, sv); close_modals(pg)
        S(pg, "__tzz.persist()"); a = json.loads(ls(pg, KEY)); pg.wait_for_timeout(3000); S(pg, "__tzz.persist()"); z = json.loads(ls(pg, KEY))
        dte = (z['totalEarned'] - a['totalEarned']) + (z.get('earnedFrac', 0) - a.get('earnedFrac', 0)); dc = (z['coins'] - a['coins']) + (z['coinFrac'] - a['coinFrac'])
        check(float(z['totalEarned']).is_integer() and 'earnedFrac' in z and 0 <= z['earnedFrac'] < 1 and dc > 400000 and abs(dte - dc) < 1e-3, f"12d1 累计收入 3e15 上逐帧入账 3 秒：存档 totalEarned 是整数 + earnedFrac 零头，累计增量 {dte:.3f} = 余额增量 {dc:.3f}")
        # MAX 零余额 = 0（三机型显示 / 禁用）
        for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
            dc_, dp = page(dname)
            boot(dp, mk(dp)); close_modals(dp)
            dp.evaluate("__tzz.setTab('shop'); __tzz.switchShop(0)"); dp.wait_for_timeout(300); close_modals(dp)
            dp.locator('[data-act="amt"][data-arg="max"]').click(); dp.wait_for_timeout(200)
            z0 = S(dp, "(()=>{__tzz.state.coins=0; __tzz.state.coinFrac=0; __tzz.renderTab(); const b=document.querySelector('[data-act=\"up\"]'); return {k:__tzz.shopUpgradeCount(0), lab:b.innerText, cost:+b.dataset.cost, no:b.classList.contains('no'), one:__tzz.E.upgradeCost(0,__tzz.state.shops[0].lv), lv:__tzz.state.shops[0].lv}})()")
            check(z0['k'] == 0 and '×' not in z0['lab'] and z0['cost'] == z0['one'] and z0['no'], f"12d1 {dname}：余额 0 选 MAX → 可买 0 级，按钮显示下一级价格 {z0['cost']} 且置灰（不显示 0 元、不显示 ×N）「{z0['lab'].splitlines()[0]}」")
            dp.evaluate("__tzz.state.coins=0"); dp.locator('[data-act="up"]').first.click(force=True); dp.wait_for_timeout(250)
            t = S(dp, "({lv:__tzz.state.shops[0].lv, t:document.getElementById('toast').textContent})")
            check(t['lv'] == z0['lv'] and '金币不够' in t['t'], f"12d1 {dname}：余额 0 点 MAX「升级」→ 提示金币不够、等级不变（{t['t']}）")
            dc_.close()
    except Exception as ex:
        check(False, f'12d1 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 10. 12d3 熊大 22:08：存档四处 + 统一交易（localStorage.setItem 抛异常模拟主档 / 备份写失败）==')
    # 写失败注入：改 Storage.prototype.setItem（localStorage.setItem 对指定键抛 QuotaExceededError）；keys=[] 恢复正常
    FAILJS = """(keys)=>{ if(!window.__origSet){ window.__origSet=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if(window.__failKeys && window.__failKeys.indexOf(k)>=0){ throw new DOMException('写入失败（测试注入）','QuotaExceededError'); } return window.__origSet.call(this,k,v); }; } window.__failKeys=keys; }"""
    SNAPJS = "JSON.stringify((s=>({c:s.coins, shops:s.shops, ceos:s.ceos, g:s.gacha, homes:s.homes, inv:s.furnInv, wear:s.wear, dh:s.decorHidden, cs:s.crossSeen, pend:s.pending, big:s.bigCustomers, sp:s.specialCustomers, dd:s.dailyDoubleDay, rev:s.rev}))(__tzz.state))"
    # 同一个 evaluate 里取快照 + 装注入，避免中间被 5 秒自动存档插一笔
    # 提示用 MutationObserver 全程记下来（5 秒自动存档的提示可能盖掉交易的提示）
    TOBS = "window.__toasts=[]; if(!window.__tobs){ window.__tobs=new MutationObserver(()=>{ (window.__toasts||(window.__toasts=[])).push(document.getElementById('toast').textContent); }); window.__tobs.observe(document.getElementById('toast'),{childList:true,characterData:true,subtree:true}); }"
    ARM = "(keys)=>{ const f=" + FAILJS + "; __tzz.persist(); __tzz.persist(); " + TOBS + " f(keys); return {s:" + SNAPJS + ", m:localStorage.getItem('" + KEY + "'), b:localStorage.getItem('" + BAK + "'), u:(__tzz.homeUndo&&__tzz.homeUndo.c77||[]).length}; }"
    DISARM = "()=>{ const r={s:" + SNAPJS + ", m:localStorage.getItem('" + KEY + "'), b:localStorage.getItem('" + BAK + "'), t:(window.__toasts||[]).join(' | '), u:(__tzz.homeUndo&&__tzz.homeUndo.c77||[]).length}; window.__failKeys=[]; return r; }"
    QUIET = "(()=>{const E=__tzz.E; if(!E.__rate0){E.__rate0=E.onlineRate; E.onlineRate=()=>0;} __tzz.clearVisitors();})()"   # 在线收入停掉，余额只因本次操作变化
    fails_by = {}
    def case(pg, nm, do, msg, ok_extra=None, modes=('main', 'bak', 'ok')):
        for mode in modes:
            try:
                keys = [KEY] if mode == 'main' else [BAK] if mode == 'bak' else []
                a = pg.evaluate(ARM, keys)
                do(); pg.wait_for_timeout(250)
                z = pg.evaluate(DISARM)
                if mode == 'ok':
                    good_ = z['s'] != a['s'] and z['m'] != a['m'] and json.loads(z['m'])['rev'] > json.loads(a['m'])['rev'] and (ok_extra is None or ok_extra(a, z))
                    check(good_, f"12d3 ③ {nm}：存储正常时照常成功并落盘（rev {json.loads(a['m'])['rev']}→{json.loads(z['m'])['rev']}）")
                else:
                    bak_ok = z['b'] == a['b'] or (mode == 'main' and z['b'] == a['m'])
                    good_ = z['s'] == a['s'] and z['m'] == a['m'] and bak_ok and z['u'] == a['u'] and '保存失败' in z['t'] and msg in z['t']
                    check(good_, f"12d3 ③ {nm}：{'主档' if mode == 'main' else '备份'}写失败 → 钱和进度整档回滚、主档逐字节不变、" + ("备份不动" if mode == 'bak' else "备份只可能是原主档") + f"，提示「{z['t'][:80]}」")
                if not good_: fails_by[nm] = fails_by.get(nm, 0) + 1
                close_modals(pg)
            except Exception as ex:
                fails_by[nm] = fails_by.get(nm, 0) + 1
                try: pg.evaluate("()=>{window.__failKeys=[];}")
                except Exception: pass
                check(False, f"12d3 ③ {nm}（{mode}）抛错（{type(ex).__name__}: {str(ex)[:120]}）")
    def act(pg, a, arg=''): pg.evaluate("([a,g])=>__tzz.act(a,g,null)", [a, arg])
    t12d3 = time.time()
    try:
        c3, p3 = page('iPhone 15')
        # 经营：店铺 x1 / x10 / MAX、员工、CEO（真点按钮）
        base = mk(p3, "st.coins=5e14; st.gacha.owned=[...new Set(st.gacha.owned.concat(['s_portal','h_chili']))]; st.homes.pearl={lv:1,placed:[],next:1};")
        boot(p3, base); close_modals(p3); S(p3, QUIET)
        S(p3, "__tzz.setTab('shop'); __tzz.switchShop(1)"); p3.wait_for_timeout(300); close_modals(p3)
        def click_up(amt):
            def f():
                p3.locator(f'[data-act="amt"][data-arg="{amt}"]').click(force=True); p3.wait_for_timeout(120)
                p3.locator('[data-act="up"]').first.click(force=True)
            return f
        case(p3, '店铺升级 x1（点按钮）', click_up('1'), '升级没有生效')
        case(p3, '店铺升级 x10（点按钮）', click_up('10'), '升级没有生效')
        case(p3, '店铺升级 MAX（点按钮）', click_up('max'), '升级没有生效')
        case(p3, '员工升级（点按钮）', lambda: p3.locator('[data-act="emp"]').first.click(force=True), '员工升级没有生效')
        case(p3, 'CEO 升级', lambda: act(p3, 'ceoUp', 'pearl'), 'CEO 升级没有生效')
        case(p3, '开盲盒', lambda: (act(p3, 'draw'), p3.wait_for_timeout(1000)), '开盒没有生效')
        case(p3, '换装', lambda: act(p3, 'equip', 'c77:hat:h_chili' if S(p3, "__tzz.state.wear.c77.hat")!='h_chili' else 'c77:hat:none'), '换装没有生效')
        case(p3, '店门口装饰显示', lambda: act(p3, 'decor', 'd_stool'), '装饰显示没有切换')
        case(p3, 'CEO 调任 / 交换任职', lambda: (S(p3, "__tzz.showPreview('pearl', __tzz.state.ceos.pearl.at===0?1:0)"), p3.wait_for_timeout(200), p3.locator('#pvYes').click()), '调任没有生效')
        # 家宅：买家具、房子升级、自动摆放、旋转、收回、撤销
        S(p3, "__tzz.setTab('home'); __tzz.homeAct('homeWho','c77'); __tzz.homeMode='decor'"); p3.wait_for_timeout(300); close_modals(p3)
        case(p3, '商城买家具', lambda: (S(p3, "__tzz.homeAct('homeBuy','furn_plant')"), p3.wait_for_timeout(200), p3.locator('#hbYes').click()), '购买没有生效')
        case(p3, '房子升级', lambda: (S(p3, "__tzz.homeAct('homeUp','pearl')"), p3.wait_for_timeout(200), p3.locator('#huYes').click()), '房子升级没有生效', modes=('main', 'bak'))
        case(p3, '仓库家具摆进房间', lambda: S(p3, "__tzz.homeAutoPlace('furn_plant')"), '摆放没有生效')
        uid = lambda: S(p3, "__tzz.state.homes.c77.placed.find(p=>p.fid==='furn_bed').uid")
        case(p3, '家具旋转', lambda: act(p3, 'homeRot', uid()), '摆放没有生效')
        case(p3, '撤销上一步', lambda: act(p3, 'homeUndo', 'c77'), '撤销没有生效', modes=('main', 'bak'))
        def drag_bed():   # 真拖动：按住床 → 拖到另一侧格子 → 松手（走 homeUp 里的 moveItem 分支）
            b = S(p3, "(()=>{const p=__tzz.state.homes.c77.placed.find(p=>p.fid==='furn_bed'); const T=__tzz.E.homeTier(__tzz.state.homes.c77.lv); const z=__tzz.E.furnSize(p.fid,p.rot); return {x:p.x,y:p.y,w:z.w,h:z.h,cols:T.cols,rows:T.rows,uid:p.uid};})()")
            p3.evaluate("document.getElementById('room').scrollIntoView({block:'center'})"); p3.wait_for_timeout(80)
            f = p3.locator('#roomFloor').bounding_box(); cw, ch = f['width'] / b['cols'], f['height'] / b['rows']
            a = p3.locator(f'#roomFloor .furn[data-uid="{b["uid"]}"]').bounding_box()
            tx = (b['cols'] - b['w']) if b['x'] == 0 else 0
            p3.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); p3.mouse.down()
            p3.mouse.move(f['x'] + (tx + b['w'] / 2) * cw, f['y'] + (b['y'] + b['h'] / 2) * ch, steps=10); p3.wait_for_timeout(80); p3.mouse.up(); p3.wait_for_timeout(200)
        case(p3, '家具拖动换位置（真拖）', drag_bed, '摆放没有生效')
        case(p3, '家具收回仓库', lambda: act(p3, 'homeStore', S(p3, "__tzz.state.homes.c77.placed.find(p=>p.fid==='furn_plant').uid")), '摆放没有生效')
        # 入账类：团单、特殊客人、传送门
        S(p3, "__tzz.setTab('shop'); __tzz.switchShop(0)"); p3.wait_for_timeout(300); close_modals(p3)
        def big():
            S(p3, "__tzz.forceBig()"); p3.wait_for_timeout(500); S(p3, "(()=>{const o=__tzz.order; if(o) o.progress=1;})()"); p3.wait_for_timeout(300)
        case(p3, '团单结算入账', big, '团单收入没有入账')
        def spc():
            S(p3, "__tzz.forceSpecial()"); p3.wait_for_timeout(600); S(p3, "(()=>{const s=__tzz.special; if(s){ if(__tzz.state.cur!==s.shop) __tzz.switchShop(s.shop); }})()"); p3.wait_for_timeout(300)
            S(p3, "(()=>{const s=__tzz.special; if(s) __tzz.hitBig(s.x,s.y);})()")
        case(p3, '特殊客人奖励', spc, '特殊客人奖励没有入账')
        case(p3, '次元传送门奖励', lambda: S(p3, "__tzz.forceSupers()"), '传送门奖励没有入账')
        # 重新开始：存不上 → 不清空、不刷新
        def reset():
            S(p3, "window.__mark=7"); act(p3, 'reset'); p3.wait_for_timeout(200); p3.locator('#mYes').click(); p3.wait_for_timeout(400)
        for mode in ['main', 'bak']:
            a = p3.evaluate(ARM, [KEY] if mode == 'main' else [BAK]); reset(); z = p3.evaluate(DISARM); mk_ = S(p3, "window.__mark")
            ok_ = z['s'] == a['s'] and z['m'] == a['m'] and (z['b'] == a['b'] or (mode == 'main' and z['b'] == a['m'])) and mk_ == 7 and '没有清空' in z['t']
            if not ok_: fails_by['重新开始'] = fails_by.get('重新开始', 0) + 1
            check(ok_, f"12d3 ③ 重新开始：{'主档' if mode == 'main' else '备份'}写失败 → 不清空、不刷新页面，进度原样（{z['t']}）")
        # 跳转：存不上不跳
        for mode in ['main', 'bak']:
            a = p3.evaluate(ARM, [KEY] if mode == 'main' else [BAK]); u0 = p3.url
            r = S(p3, "__tzz.goPage ? __tzz.goPage('version.json?jump=1') : 'none'"); p3.wait_for_timeout(500); z = p3.evaluate(DISARM)
            ok_ = r is False and p3.url == u0 and z['m'] == a['m'] and (z['b'] == a['b'] or (mode == 'main' and z['b'] == a['m'])) and '没有跳转' in z['t']
            if not ok_: fails_by['跳转'] = fails_by.get('跳转', 0) + 1
            check(ok_, f"12d3 ⑤ 主页面跳转（宠物 / 打僵尸入口）：{'主档' if mode == 'main' else '备份'}写失败 → 不跳转（{r}，{z['t']}）")
        # ④ 普通自动存档：备份写失败 → 整次放弃，主档不动
        a = p3.evaluate(ARM, [BAK]); r = S(p3, "__tzz.state.coins -= 1; __tzz.persist()"); z = p3.evaluate(DISARM)
        check(r is False and z['m'] == a['m'] and z['b'] == a['b'] and '备份写不进去' in z['t'], f"12d3 ④ persist()：备份 setItem 抛异常 → 返回 false，主档逐字节不变（不再吞掉异常继续写主档）「{z['t']}」")
        a = p3.evaluate(ARM, [KEY]); r = S(p3, "__tzz.persist()"); z = p3.evaluate(DISARM)
        check(r is False and z['m'] == a['m'] and json.loads(z['m'])['rev'] == S(p3, "__tzz.state.rev"), "12d3 ④ persist()：主档 setItem 抛异常 → 返回 false，内存 rev 退回、和盘上一致")
        S(p3, "__tzz.persist()"); p0 = ls(p3, KEY); S(p3, "__tzz.persist()")
        check(ls(p3, BAK) == p0, '12d3 ④ 恢复正常后：写档前把上一份好主档整份放进 -bak（轮换照常）')
        c3.close()
        # 领离线：单独开局
        c4, p4 = page('iPhone 15')
        boot(p4, mk(p4, "st.lastSeen=st.maxSeen=T-7200e3; st.dailyDoubleDay=null;"), wait=1300); S(p4, QUIET)
        def claim():
            if not modal_visible(p4): S(p4, "__tzz.showOffline()"); p4.wait_for_timeout(200)
            p4.locator('#claim').click(); p4.wait_for_timeout(200)
        case(p4, '领离线收益', claim, '离线收益没有到账', modes=('main', 'bak'))
        check(S(p4, "!!__tzz.state.pending"), '12d3 ③ 领离线存不上：待领取那笔还在（没有吞掉，下次能再领）')
        case(p4, '领离线收益', claim, '离线收益没有到账', modes=('ok',), ok_extra=lambda a, z: json.loads(z['s'])['pend'] is None)
        c4.close()
        # 开店 / 雇人：单独开局（书店开着没员工、科技公司没开）
        for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
            c5, p5 = page(dname)
            boot(p5, mk(p5, "st.shops[3]={open:false,lv:0,emp:0}; st.ceos.rocket={unlocked:false,lv:1,at:-1}; st.shops[2].emp=0;")); close_modals(p5); S(p5, QUIET)
            S(p5, "__tzz.setTab('shop'); __tzz.switchShop(2)"); p5.wait_for_timeout(300); close_modals(p5)
            case(p5, f'{dname} 雇人（点按钮）', lambda: p5.locator('[data-act="hire"]').first.click(force=True), '雇人没有生效', modes=('main', 'bak'))
            S(p5, "__tzz.switchShop(3)"); p5.wait_for_timeout(300); close_modals(p5)
            case(p5, f'{dname} 开张（点按钮）', lambda: p5.locator('[data-act="open"]').first.click(force=True), '开张没有生效', modes=('main', 'bak'))
            c5.close()
    except Exception as ex:
        check(False, f'12d3 ③ 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 11. 12d3 熊大 22:08 第 1 / 2 条：结构坏的主档、主档缺失 ==')
    try:
        c6, p6 = page('iPhone 15')
        good3 = mk(p6, "st.shops[0].lv=53;"); g3 = json.loads(good3)
        bk3 = json.loads(good3); bk3['coins'] = 451000000; bk3['rev'] = 290; BK3 = json.dumps(bk3)
        variants3 = {'shops[0] = null': lambda r: r['shops'].__setitem__(0, None), 'shops[1] 缺 emp': lambda r: r['shops'][1].pop('emp'),
                     'ceos.pearl = null': lambda r: r['ceos'].__setitem__('pearl', None), 'homes.c77 = null': lambda r: r['homes'].__setitem__('c77', None),
                     'gacha = null': lambda r: r.__setitem__('gacha', None)}
        for nm, fn in variants3.items():
            r = json.loads(good3); fn(r); r['rev'] = 305; BADM = json.dumps(r)
            boot(p6, BADM, BK3); close_modals(p6)
            st = S(p6, "({src:__tzz.loadInfo.source, c:__tzz.state.coins, shops:__tzz.state.shops, ceos:__tzz.state.ceos, blk:__tzz.saveBlocked})")
            b1 = ls(p6, BAK); S(p6, "__tzz.persist()"); m2 = json.loads(ls(p6, KEY)); b2 = json.loads(ls(p6, BAK))
            check(st['src'] == 'bak' and st['shops'] == bk3['shops'] and st['ceos'] == bk3['ceos'] and st['shops'][0]['lv'] == 53 and m2['shops'][0]['lv'] == 53 and b1 != BADM and ls(p6, BAK) != BADM and p6.evaluate("b=>__tzz.E.checkSave(JSON.parse(b)).length===0", b1) and b2['shops'][0] and b2['shops'][0]['lv'] == 53, f"12d3 ① 主档 {nm} + 好备份 → 用备份（烧烤摊 Lv53 不变 Lv1）；坏主档从没进 -bak（备份始终是通过完整校验的好档）{st['src']}")
        r = json.loads(good3); r['shops'][0] = None; BADM = json.dumps(r)
        boot(p6, BADM, None, wait=1200)
        info = S(p6, "({blk:__tzz.saveBlocked, src:__tzz.loadInfo.source, badge:(document.getElementById('saveBadge')||{}).textContent||'', modal:document.getElementById('mpanel').innerText})")
        check(info['blk'] and info['src'] == 'broken' and '只读' in info['badge'] and '只读' in info['modal'] and '不会自动保存' in info['modal'], f"12d3 ① 主档 shops[0]=null + 没备份 → 只读模式（角标 + 弹窗）{info['src']}")
        close_modals(p6); S(p6, "__tzz.setTab('shop'); __tzz.switchShop(0)"); p6.wait_for_timeout(300); close_modals(p6)
        S(p6, "__tzz.state.coins=1e9"); lv0 = S(p6, "__tzz.state.shops[0].lv"); p6.locator('[data-act="amt"][data-arg="1"]').click(force=True); p6.locator('[data-act="up"]').first.click(force=True); p6.wait_for_timeout(250)
        t_ = S(p6, "document.getElementById('toast').textContent")
        check(S(p6, "__tzz.state.shops[0].lv") == lv0 and S(p6, "__tzz.state.coins") == 1e9 and '只读' in t_, f"12d3 ① 只读模式点「升级」→ 拒绝（等级、余额不变）「{t_}」")
        r_ = S(p6, "__tzz.persist()"); p6.wait_for_timeout(5600)
        check(r_ is False and ls(p6, KEY) == BADM and ls(p6, BAK) is None, '12d3 ① 只读模式：persist() 如实返回 false，6 秒后原主档逐字节不变、没有生成备份')
        for nm, mv in [('缺失', None), ('空字符串', ''), ('JSON null', 'null')]:
            boot(p6, mv, BK3, wait=1200); t_ = p6.inner_text('#toast') if p6.locator('#toast:not(.hidden)').count() else ''
            st = S(p6, "({src:__tzz.loadInfo.source, c:__tzz.state.coins, shops:__tzz.state.shops, blk:__tzz.saveBlocked})"); close_modals(p6)
            b1 = ls(p6, BAK); m2 = json.loads(ls(p6, KEY))
            check(st['src'] == 'bak' and not st['blk'] and st['c'] >= 451000000 and st['shops'] == bk3['shops'] and '主存档不见了' in t_ and m2['coins'] >= 451000000 and m2['shops'] == bk3['shops'] and json.loads(b1)['coins'] >= 451000000 and json.loads(b1)['shops'] == bk3['shops'], f"12d3 ② 主档{nm} + 好备份 → 用备份（余额 {st['c']}，不是零进度），主档 / -bak 都是备份进度（没有零进度档写回去）「{t_}」")
        bb = json.loads(good3); bb['shops'][0] = None; BB = json.dumps(bb)
        boot(p6, None, BB, wait=1200); info = S(p6, "({blk:__tzz.saveBlocked, src:__tzz.loadInfo.source, c:__tzz.state.coins})"); close_modals(p6)
        S(p6, "__tzz.persist()"); p6.wait_for_timeout(300)
        check(info['blk'] and info['src'] != 'new' and ls(p6, KEY) is None and ls(p6, BAK) == BB, f"12d3 ② 主档缺失 + 备份结构坏 → 只读，不生成零进度主档、坏备份原文不动 {info}")
        c6.close()
    except Exception as ex:
        check(False, f'12d3 ①② 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print(f"12d3 段用时 {time.time() - t12d3:.0f} 秒；失败分布 {fails_by}")
    check(not errs, f'12d 没有页面报错 {errs[:3]}')
    b.close()
print(f"coin e2e: {sum(1 for r in results if r[0])} passed, {sum(1 for r in results if not r[0])} failed")
