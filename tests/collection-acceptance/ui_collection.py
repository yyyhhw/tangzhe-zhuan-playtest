# 卡牌收集 UI 层验收（Playwright：WebKit + Chromium；844×390 + 568×320）。用例编号对应负向提纲 v3.3。
# 跑法：python3 tests/collection-acceptance/ui_collection.py [页面 URL]
#   默认 URL = $COLLECTION_URL 或 http://127.0.0.1:8790/preview/cards/collection/index.html?collectionTest=1
#   ACCEPT_CONTROL=1 → 反向对照：故意写错期望，必须非零退出（G5）
# 只用普通 locator.click（不 force、不触摸绕过）；Storage.setItem/removeItem/clear 只记录不拦截（G3）。
# 页面约定（ADAPT）：测试模式下暴露 window.CollectionQA.importFixture(fixture) / exportState()；下面的 data-testid。缺就打印「缺接口」exit 1。
import os, sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('COLLECTION_URL', 'http://127.0.0.1:8790/preview/cards/collection/index.html?collectionTest=1')
CONTROL = os.environ.get('ACCEPT_CONTROL') == '1'
ADAPT = dict(draw='draw', dialog='overflow-dialog', text='overflow-text', cont='overflow-continue', cancel='overflow-cancel', suppress='overflow-suppress',
             reveal='reveal', gained='dust-gained', credited='dust-credited', overflow='dust-overflow', restore='restore-overflow-reminder',
             TEXT='超出上限的粉尘会消失，是否继续抽卡？', COST=5_000_000, LOCK_KEYS=os.environ.get('LOCK_KEYS', '').split(',') if os.environ.get('LOCK_KEYS') else [])
# 测试卡池约定：fixture.config 让每抽都是传说 l-x 普通（实现方按 importFixture 的 config 字段接测试配置）
TEST_CFG = dict(pool=[dict(cardId='l-x', rarity='legendary')], weights=dict(legendary=1), goldRate=0, dustMax=1000, dupDust=dict(legendary=400))
def fx(coins=50_000_000, dust=0, prefs=None): return dict(coins=coins, dust=dust, owned={'l-x': {'normal': 2}}, prefs=prefs or {}, seed=11, config=TEST_CFG)
SPY = "(()=>{if(window.__w)return;window.__w=[];const P=Storage.prototype;for(const n of ['setItem','removeItem','clear']){const o=P[n];P[n]=function(...a){window.__w.push([n,a[0]]);return o.apply(this,a);};}})(); 0"
T = lambda t: f'[data-testid="{ADAPT[t]}"]'
P, F, failed = [0], [0], []
def ok(c, i, m):
    if c: P[0] += 1
    else: F[0] += 1; failed.append(i); print('  ✗', i, m)
def wrong(c, i, m): ok(c if CONTROL else not c, i + '[反向对照]', m)
def writes(pg): return [w for w in pg.evaluate('window.__w||[]') if w[1] not in ADAPT['LOCK_KEYS']]
def st(pg): return pg.evaluate('window.CollectionQA.exportState()')
def visible(pg, t):
    l = pg.locator(T(t))
    return l.count() > 0 and l.first.is_visible()
def unobscured(pg, t):   # 568×320 下控件中心点命中的就是控件自己（没被遮挡）
    return pg.evaluate("s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();if(r.width<1||r.bottom>innerHeight||r.right>innerWidth||r.top<0)return false;const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!h&&(h===e||e.contains(h)||h.contains(e)&&h.tagName==='LABEL')}", T(t))
def open_page(ctx, fixture):
    pg = ctx.new_page(); pg.add_init_script(SPY); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_load_state('load')
    if not pg.evaluate("!!(window.CollectionQA&&window.CollectionQA.importFixture&&window.CollectionQA.exportState)"):
        print('✗ 缺接口：window.CollectionQA.importFixture / exportState（见 README「接口约定」）'); print('passed 0, failed 0, 未跑'); sys.exit(1)
    if fixture is not None: pg.evaluate('f=>window.CollectionQA.importFixture(f)', fixture); pg.reload(); pg.wait_for_load_state('load')
    pg.evaluate('window.__w=[]'); pg._errs = errs; return pg
def settle(pg, ms=1500): pg.wait_for_timeout(ms)
def run(engine, W, H):
    tag = f'{engine.browser_type.name}-{W}x{H}'; print('==', tag)
    def ctx(): return engine.new_context(viewport={'width': W, 'height': H})
    c = ctx(); pg = open_page(c, fx(dust=900)); b = st(pg)
    pg.locator(T('draw')).click(); settle(pg, 400)
    ok(visible(pg, 'dialog'), 'N3-2', f'{tag} 有溢出风险应弹窗')
    if visible(pg, 'dialog'):
        ok(pg.locator(T('text')).inner_text().strip() == ADAPT['TEXT'], 'N3-2', '文案逐字一致：' + pg.locator(T('text')).inner_text())
        ok(not pg.locator(T('suppress')).is_checked(), 'N3-2', '「以后不再提醒」默认不勾选')
        for t in ('cont', 'cancel', 'suppress'): ok(unobscured(pg, t), 'N3-2', f'{tag} {t} 不被遮挡')
        a = st(pg); ok(a['coins'] == b['coins'] and a['ledger'] == b['ledger'] and not writes(pg), 'N3-2', f'弹窗期间不扣费、零写入 {writes(pg)}')
        wrong(len(writes(pg)) > 0, 'N3-2', '弹窗期间有写入')
        pg.locator(T('cancel')).click(); settle(pg, 300); a = st(pg)       # N3-3
        ok(a['coins'] == b['coins'] and a['ledger'] == b['ledger'] and not writes(pg) and not visible(pg, 'reveal'), 'N3-3', f'取消：不扣费、无结果、零写入 {writes(pg)}')
        pg.locator(T('draw')).click(); settle(pg, 300); pg.locator(T('suppress')).check(); pg.locator(T('cancel')).click(); settle(pg, 300)   # N3-4
        ok(not writes(pg) and not st(pg)['prefs'].get('suppressOverflowWarn'), 'N3-4', '勾选后取消：偏好不保存、零写入')
        pg.locator(T('draw')).click(); settle(pg, 300); ok(visible(pg, 'dialog') and not pg.locator(T('suppress')).is_checked(), 'N3-4', '下次仍弹且默认不勾')
        pg.keyboard.press('Escape'); settle(pg, 300)                         # N3-8
        ok(not visible(pg, 'dialog') and not writes(pg) and st(pg)['coins'] == b['coins'], 'N3-8', 'Esc 视为取消、零写入')
        pg.locator(T('draw')).click(); settle(pg, 300); pg.locator(T('cont')).click(); settle(pg)   # N3-5 + N3-9
        a = st(pg); ok(a['coins'] == b['coins'] - ADAPT['COST'] and len(a['ledger']) == 1, 'N3-5', f'继续：扣 1 次 500 万 {b["coins"]}→{a["coins"]}')
        ok(a['dust'] == 1000 and a['owned']['l-x'] == {'normal': 2, 'gold': 0} or a['owned']['l-x'].get('normal', 0) + a['owned']['l-x'].get('gold', 0) == 2, 'N3-9', f'粉尘到上限、收藏仍 2：{a["dust"]} {a["owned"]}')
        txt = [pg.locator(T(k)).inner_text().strip() if pg.locator(T(k)).count() else '' for k in ('gained', 'credited', 'overflow')]
        ok(txt == ['400', '100', '300'], 'N3-9', f'结果页 获得/入账/溢出 = {txt}，应 400/100/300')
        rec = list(a['ledger'].values())[0]
        ok(visible(pg, 'reveal') and pg.locator(T('reveal')).get_attribute('data-card-id') == rec['cardId'], 'N5-3', '揭晓卡面 data-card-id = 凭据 cardId')
        pg.evaluate("window.__w=[]"); pg.locator(T('draw')).click(); settle(pg, 300)
        ok(visible(pg, 'dialog'), 'N3-5', '不勾选继续后，下次仍弹')
        pg.locator(T('suppress')).check(); pg.locator(T('cont')).click(); settle(pg)       # N3-6
        ok(st(pg)['prefs'].get('suppressOverflowWarn') is True and len(st(pg)['ledger']) == 2, 'N3-6', '勾选继续：偏好保存 + 抽卡成功')
        pg.reload(); pg.wait_for_load_state('load'); pg.locator(T('draw')).click(); settle(pg)
        ok(not visible(pg, 'dialog') and len(st(pg)['ledger']) == 3, 'N3-6', '刷新后有风险直接抽、不弹窗')
        if pg.locator(T('restore')).count():                                 # N3-7
            c0 = st(pg)['coins']; pg.locator(T('restore')).click(); settle(pg, 300); pg.locator(T('draw')).click(); settle(pg, 300)
            ok(visible(pg, 'dialog') and st(pg)['coins'] == c0, 'N3-7', '设置里恢复提醒后再弹、恢复不扣费'); pg.locator(T('cancel')).click()
        else: ok(False, 'N3-7', '缺「恢复粉尘溢出提醒」入口 ' + T('restore'))
    ok(not pg._errs, 'G1', f'{tag} 页面报错 {pg._errs}'); c.close()
    # N4-1 差 1 金币
    c = ctx(); pg = open_page(c, fx(coins=ADAPT['COST'] - 1)); pg.locator(T('draw')).click(); settle(pg, 800)
    ok(st(pg)['coins'] == ADAPT['COST'] - 1 and not st(pg)['ledger'] and not writes(pg) and not visible(pg, 'dialog'), 'N4-1', f'差 1 金币不能抽、零写入 {writes(pg)}'); c.close()
    # N4-4 双击 / N4-3 刷新 / N5-1 切后台 + 离页重开
    c = ctx(); pg = open_page(c, fx(dust=0)); b = st(pg)
    pg.locator(T('draw')).dblclick(); settle(pg)
    ok(st(pg)['coins'] == b['coins'] - ADAPT['COST'] and len(st(pg)['ledger']) == 1, 'N4-4', f'双击只扣 1 次：{b["coins"]}→{st(pg)["coins"]}')
    a1 = st(pg); pg.locator(T('draw')).click(); pg.wait_for_timeout(20)
    pg.evaluate("Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));0")
    pg.goto('about:blank'); pg.go_back(); pg.wait_for_load_state('load'); settle(pg); a2 = st(pg)
    ok(a2['coins'] in (a1['coins'], a1['coins'] - ADAPT['COST']) and len(a2['ledger']) == (a1['coins'] - a2['coins']) // ADAPT['COST'] + 1, 'N5-1', f'揭晓中切后台+离页返回：扣费次数 = 凭据数 {a2["coins"]} {len(a2["ledger"])}')
    pg.reload(); pg.wait_for_load_state('load'); settle(pg); a3 = st(pg)
    ok(a3['coins'] == a2['coins'] and a3['ledger'] == a2['ledger'], 'N4-3', '刷新不再扣费、不重抽'); c.close()
    # N4-5 两标签同时抽（同一 context 共享 localStorage）
    c = ctx(); A = open_page(c, fx(dust=0)); Bp = open_page(c, None); b = st(A)
    A.locator(T('draw')).click(); Bp.locator(T('draw')).click(); settle(A, 2000); a = st(Bp)
    ok(len(a['ledger']) == (b['coins'] - a['coins']) // ADAPT['COST'] and len(a['ledger']) >= 1, 'N4-5', f'两标签：扣费次数 = 凭据数 {a["coins"]} {len(a["ledger"])}')
    c.close()
with sync_playwright() as p:
    for name in ('webkit', 'chromium'):
        br = getattr(p, name).launch()
        for W, H in ((844, 390), (568, 320)): run(br, W, H)
        br.close()
print(f'\npassed {P[0]}, failed {F[0]}' + ('（ACCEPT_CONTROL=1：应非零退出）' if CONTROL else ''))
if F[0]: print('失败编号：' + ' '.join(dict.fromkeys(failed)))
sys.exit(1 if F[0] else 0)
