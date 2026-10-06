# 12d 金币安全 v1 端到端（WebKit = iPhone Safari 内核；SE / SE3 / iPhone 15）
# 用法：先在本目录起静态服务，再 .pwvenv/bin/python test_coin_e2e.py [URL]
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
        over = mk(pg, "st.coins=3e16; st.coinFrac=0; st.shops[0].lv=150; st.shops[1].emp=38; st.ceos.rocket.lv=29;")
        boot(pg, over, wait=1500); close_modals(pg)
        S(pg, "__tzz.setTab('shop'); __tzz.switchShop(0)"); pg.wait_for_timeout(2500); close_modals(pg)
        ov = S(pg, "({c:__tzz.state.coins, lv:__tzz.state.shops[0].lv, emp:__tzz.state.shops[1].emp, rk:__tzz.state.ceos.rocket.lv, up:!!document.querySelector('[data-act=\"up\"]'), mx:[...document.querySelectorAll('[data-max]')].map(e=>e.dataset.max+':'+e.textContent+':'+e.disabled)})")
        check(ov['c'] == 3e16 and ov['lv'] == 150 and ov['emp'] == 38 and ov['rk'] == 29, f"12d 旧档 3e16 / 店 Lv150 / 员工 Lv38 / 火箭 Lv29 读档后 2.5 秒：余额不涨不截、等级不降 {ov['c']}")
        check(not ov['up'] and 'shop:满级:true' in ov['mx'], f"12d 旧档 Lv150 店铺：只显示「满级」（不能买）{ov['mx']}")
        pg.reload(); pg.wait_for_timeout(1000); close_modals(pg)
        check(S(pg, "__tzz.state.coins===3e16 && __tzz.state.shops[0].lv===150"), '12d 旧档超上限刷新后仍保留')

    except Exception as ex:
        check(False, f'12d 本段抛错（{type(ex).__name__}: {str(ex)[:160]}）')
    print('== 7. 等级上限 / MAX / x10（三机型）==')
    try:
        for dname in ['iPhone SE', 'iPhone SE (3rd gen)', 'iPhone 15']:
            dc, dp = page(dname)
            sv = mk(dp, "st.coins=3e16; st.coinFrac=0; st.shops[0].lv=100; st.shops[0].emp=35; st.ceos.c77.lv=30; st.shops[3].emp=21; st.ceos.rocket.lv=25;")
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
    check(not errs, f'12d 没有页面报错 {errs[:3]}')
    b.close()
print(f"coin e2e: {sum(1 for r in results if r[0])} passed, {sum(1 for r in results if not r[0])} failed")
