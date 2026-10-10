# G7 真浏览器冒烟骨架（S1–S5，对应 G6-G7.md）。Playwright：WebKit + Chromium，844×390。
# 跑法：python3 tests/collection-acceptance/smoke_g7.py [页面 URL]（默认 $COLLECTION_URL）
# 页面约定：window.CollectionQA.importFixture / exportState（同 ui_collection.py）+ 可选钩子：
#   walletMode   'real' = 经 CardHost 扣经营公用金币；缺省或其他值一律按「模拟」记，不算 G7 通过
#   replayTx(txId)        同一 txId 重放（S4b），缺则跳过，依赖熊大补
#   economyWrite()        触发一次普通经营写档（S5b），缺则跳过，依赖 G4 父页
#   exportState().coinFrac 金币零头（S1e），缺则跳过；PROD_URL 环境变量 = 正式站页面（S5c），缺则跳过
# 模拟 coins / 固定 seed 只是测试夹具，不进生产钱包桥。
# 退出码：0 = 全通过且真实经营钱包；1 = 有失败或缺基础接口；3 = 无失败，但有跳过或用的是模拟钱包（不算 G7 通过）。
import os, sys, json, hashlib
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('COLLECTION_URL', 'http://127.0.0.1:8790/preview/cards/collection/index.html?collectionTest=1')
COST, TEXT = 5_000_000, '超出上限的粉尘会消失，是否继续抽卡？'
ROOT_KEYS = {'tangzhe-save', 'tangzhe-save-bak', 'tangzhe-tab-lock'}
CFG = dict(pool=[dict(cardId='l-x', rarity='legendary')], weights=dict(legendary=1), goldRate=0, dustMax=1000, dupDust=dict(legendary=400))
def fx(coins=50_000_000, dust=0, owned=None, frac=0): return dict(coins=coins, coinFrac=frac, dust=dust, owned=owned or {}, prefs={}, seed=11, config=CFG)
PROD = os.environ.get('PROD_URL')   # 正式站页面 URL（S5c），缺则跳过
FULL = {'l-x': {'normal': 2}}
INIT = """(()=>{if(window.__w)return;window.__w=[];window.__fail=false;const P=Storage.prototype;
for(const n of ['setItem','removeItem','clear']){const o=P[n];P[n]=function(...a){if(window.__fail&&n==='setItem')throw new DOMException('QA quota','QuotaExceededError');window.__w.push([n,a[0]]);return o.apply(this,a);};}})(); 0"""
T = lambda t: f'[data-testid="{t}"]'
rows = []   # (引擎, 用例, 结果, 说明)
def rec(eng, case, res, note=''): rows.append((eng, case, res, note)); print(f'  {"✓" if res == "通过" else "✗" if res == "失败" else "-"} {eng} {case} {res} {note}')
def check(eng, case, conds):
    bad = [m for c, m in conds if not c]; rec(eng, case, '失败' if bad else '通过', '；'.join(bad))
st = lambda pg: pg.evaluate('window.CollectionQA.exportState()')
snap = lambda pg: hashlib.sha256(pg.evaluate('JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))').encode()).hexdigest()
vis = lambda pg, t: pg.locator(T(t)).count() > 0 and pg.locator(T(t)).first.is_visible()
has = lambda pg, h: pg.evaluate(f'typeof window.CollectionQA.{h} === "function"')
def wait(pg, ms=1200): pg.wait_for_timeout(ms)
def open_page(c, fixture):
    pg = c.new_page(); pg.add_init_script(INIT); pg.goto(URL); pg.wait_for_load_state('load')
    if not pg.evaluate('!!(window.CollectionQA&&window.CollectionQA.importFixture&&window.CollectionQA.exportState)'):
        print('✗ 缺接口：window.CollectionQA.importFixture / exportState'); print('passed 0, failed 0, 未跑'); sys.exit(1)
    if fixture is not None: pg.evaluate('f=>window.CollectionQA.importFixture(f)', fixture); pg.reload(); pg.wait_for_load_state('load')
    pg.evaluate('window.__w=[]'); return pg
WALLET = ['未知']
def run(br):
    eng = br.browser_type.name; ctx = lambda: br.new_context(viewport={'width': 844, 'height': 390})
    # S1 单抽扣款
    c = ctx(); pg = open_page(c, fx()); WALLET[0] = '真实经营' if pg.evaluate('window.CollectionQA.walletMode') == 'real' else '模拟≠真实经营'
    b = st(pg); pg.locator(T('draw')).click(); wait(pg); a = st(pg); L = list(a['ledger'].values())
    check(eng, 'S1 单抽扣款', [(a['coins'] == b['coins'] - COST, f'金币 {b["coins"]}→{a["coins"]}，应少 500 万'), (len(L) == 1, f'凭据 {len(L)} 条'),
        (bool(L) and L[0].get('committed') is True and L[0].get('cost', COST) == COST, '凭据未提交或扣费不对'), (not vis(pg, 'overflow-dialog'), '空收藏不该弹溢出窗')])
    keys = set(pg.evaluate('Object.keys(localStorage)'))
    if WALLET[0] == '真实经营': check(eng, 'S1b 只写主档根 key', [(keys <= ROOT_KEYS, f'多出根 key {sorted(keys - ROOT_KEYS)}')])
    else: rec(eng, 'S1b 只写主档根 key', '跳过', '依赖 G4 CardHost 接主档')
    c.close()
    # S1c/S1d 余额正好 500 万 / 差 1；S1e 带零头
    c = ctx(); pg = open_page(c, fx(coins=COST)); pg.locator(T('draw')).click(); wait(pg); a = st(pg)
    check(eng, 'S1c 余额正好 500 万', [(a['coins'] == 0 and len(a['ledger']) == 1, f'应能抽、抽后 0：金币 {a["coins"]}、凭据 {len(a["ledger"])}')]); c.close()
    c = ctx(); pg = open_page(c, fx(coins=COST - 1)); h0 = snap(pg); pg.locator(T('draw')).click(); wait(pg); a = st(pg)
    check(eng, 'S1d 余额差 1', [(a['coins'] == COST - 1 and not a['ledger'], '不该抽成'), (snap(pg) == h0 and not pg.evaluate('window.__w'), '不该写入')]); c.close()
    c = ctx(); pg = open_page(c, fx(coins=COST, frac=0.75))
    if 'coinFrac' in (st(pg) or {}):
        b = st(pg); pg.locator(T('draw')).click(); wait(pg); a = st(pg)
        check(eng, 'S1e 带零头', [(a['coins'] == 0 and abs(a['coinFrac'] - b['coinFrac']) < 1e-9, f'扣 500 万后零头应保留：{b["coinFrac"]}→{a["coinFrac"]}，金币 {a["coins"]}')])
    else: rec(eng, 'S1e 带零头', '跳过', '缺 exportState().coinFrac，依赖 G4 接主档 coinFrac')
    c.close()
    # S2 溢出弹窗 + 空收藏反向
    c = ctx(); pg = open_page(c, fx(dust=601, owned=FULL)); b = st(pg); h0 = snap(pg)
    pg.locator(T('draw')).click(); wait(pg, 400); shown = vis(pg, 'overflow-dialog')
    conds = [(shown, '有满 2 张的卡且剩余 399 < 400，应弹窗')]
    if shown:
        conds += [(pg.locator(T('overflow-text')).inner_text().strip() == TEXT, '文案不一致'), (not pg.locator(T('overflow-suppress')).is_checked(), '「以后不再提醒」默认应不勾')]
        pg.locator(T('overflow-cancel')).click(); wait(pg, 300); conds.append((snap(pg) == h0 and not pg.evaluate('window.__w').__len__(), '取消后有写入'))
        pg.locator(T('draw')).click(); wait(pg, 300); pg.locator(T('overflow-suppress')).check(); pg.locator(T('overflow-continue')).click(); wait(pg); a = st(pg)
        g = [pg.locator(T(k)).inner_text().strip() for k in ('dust-gained', 'dust-credited', 'dust-overflow')]
        conds += [(a['coins'] == b['coins'] - COST and len(a['ledger']) == 1, f'继续后应只扣 1 次：{b["coins"]}→{a["coins"]}'), (g == ['400', '399', '1'], f'g/a/o={g}，应 400/399/1')]
        pg.reload(); pg.wait_for_load_state('load'); pg.locator(T('draw')).click(); wait(pg, 400); conds.append((not vis(pg, 'overflow-dialog'), '勾选后刷新仍弹'))
    check(eng, 'S2 溢出弹窗', conds); c.close()
    c = ctx(); pg = open_page(c, fx(dust=1000)); pg.locator(T('draw')).click(); wait(pg, 400)
    check(eng, 'S2b 空收藏粉尘满不弹', [(not vis(pg, 'overflow-dialog'), '空收藏没有可能化尘的卡，不该弹')]); c.close()
    # S3 写档失败不写入
    c = ctx(); pg = open_page(c, fx()); h0 = snap(pg); pg.evaluate('window.__fail=true'); pg.locator(T('draw')).click(); wait(pg)
    pg.evaluate('window.__fail=false'); h1 = snap(pg); note = pg.locator(T('notice')).inner_text() if pg.locator(T('notice')).count() else ''
    b = st(pg); pg.locator(T('draw')).click(); wait(pg); a = st(pg)
    check(eng, 'S3 写档失败不写入', [(h1 == h0, '写档失败后存储有变化'), (bool(note.strip()), '没有失败提示'),
        (a['coins'] == b['coins'] - COST and len(a['ledger']) == 1, f'恢复写入后应只提交 1 次：凭据 {len(a["ledger"])}')]); c.close()
    # S4 提交途中刷新 + 同 txId 重放
    c = ctx(); pg = open_page(c, fx()); b = st(pg); pg.locator(T('draw')).click(); pg.reload(); pg.wait_for_load_state('load'); wait(pg); a1 = st(pg)
    n = (b['coins'] - a1['coins']) // COST; pg.reload(); pg.wait_for_load_state('load'); wait(pg); a2 = st(pg)
    check(eng, 'S4 刷新不重复扣', [(n in (0, 1) and len(a1['ledger']) == n, f'扣 {n} 次、凭据 {len(a1["ledger"])} 条，应一致且 ≤1'), (a2 == a1, '再刷新后状态变了')])
    if has(pg, 'replayTx') and a1['ledger']:
        tx = next(iter(a1['ledger'])); pg.evaluate('t=>window.CollectionQA.replayTx(t)', tx); wait(pg); check(eng, 'S4b 同 txId 重放', [(st(pg) == a2, '重放后金币或凭据变了')])
    else: rec(eng, 'S4b 同 txId 重放', '跳过', '缺 CollectionQA.replayTx，依赖熊大补')
    c.close()
    # S5 跨标签冲突
    c = ctx(); A = open_page(c, fx(dust=601, owned=FULL)); B = open_page(c, None); b = st(A)
    A.locator(T('draw')).click(); wait(A, 300); B.locator(T('draw')).click(); wait(B, 300)
    if vis(B, 'overflow-dialog'): B.locator(T('overflow-continue')).click()
    wait(B); A.locator(T('overflow-continue')).click(); wait(A); a = st(A); n = (b['coins'] - a['coins']) // COST
    check(eng, 'S5 跨标签冲突', [(n == len(a['ledger']) == 1, f'两标签共扣 {n} 次、凭据 {len(a["ledger"])}，应各 1'), (bool(A.locator(T('notice')).inner_text().strip()) or (vis(A, 'reveal') and A.locator(T('reveal')).get_attribute('data-card-id') in [r['cardId'] for r in a['ledger'].values()]), 'A 既没有冲突提示，也没有按同一 txId 返回原结果')])
    if has(A, 'economyWrite'): rec(eng, 'S5b 普通经营写档并发', '跳过', '钩子已在，断言待 G4 桥接定稿')
    else: rec(eng, 'S5b 普通经营写档并发', '跳过', '缺 CollectionQA.economyWrite，依赖 G4 父页')
    c.close()
    # S5c 正式站与 preview 隔离：preview 导入 + 抽卡后，正式站主档原文不变
    if PROD:
        c = ctx(); pr = c.new_page(); pr.goto(PROD); pr.wait_for_load_state('load'); k = "JSON.stringify(['tangzhe-save','tangzhe-save-bak'].map(x=>localStorage.getItem(x)))"; h0 = pr.evaluate(k)
        pg = open_page(c, fx()); pg.locator(T('draw')).click(); wait(pg); pr.reload(); pr.wait_for_load_state('load')
        check(eng, 'S5c 正式站与 preview 隔离', [(pr.evaluate(k) == h0, 'preview 抽卡改动了正式站的 tangzhe-save / -bak')]); c.close()
    else: rec(eng, 'S5c 正式站与 preview 隔离', '跳过', '缺 PROD_URL（正式站页面），依赖 G4 发布审批')
with sync_playwright() as p:
    for name in ('webkit', 'chromium'):
        br = getattr(p, name).launch(); print('==', name); run(br); br.close()
cnt = {k: sum(r[2] == k for r in rows) for k in ('通过', '失败', '跳过')}
print(f'\n钱包：{WALLET[0]}\n| 引擎 | 用例 | 结果 | 钱包 | 说明 |\n|---|---|---|---|---|')
for e, cs, r, n in rows: print(f'| {e} | {cs} | {r} | {WALLET[0]} | {n} |')
print(f'\npassed {cnt["通过"]}, failed {cnt["失败"]}, skipped {cnt["跳过"]}（钱包：{WALLET[0]}）')
sys.exit(1 if cnt['失败'] else 0 if (not cnt['跳过'] and WALLET[0] == '真实经营') else 3)
