# r4 浏览器验收（只狗；猫只测「嵌套版本原样保留」，猫图集 / 动作 / 玩具仍未完成）。WebKit 模拟 iPhone SE / 15，不算真机。
# 覆盖：购买确认不可用 + 原因 + 提交再查；名额满 vs 地面满；买入待命不改目的地；成功才切房、失败 / 待命不切；
#       等待安置提示 + 禁用互动 + 保留回待命 + 空地恢复；无效房间转待命；不支持的成长版本原样保留（保存 / 刷新 / 替换成败）。
# 用法：仓库根目录 python3 -m http.server PORT，再 python3 preview/pet/accept2/test_pets2_r4_e2e.py http://127.0.0.1:PORT/preview/index.html
# 存档写失败（主档键抛错）在浏览器里测；saveBlocked（只读 / 多标签）在 Node：test_pets2_r4.js R4-1 与 test_pets2_ui_vm.js VM-blocked。
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/preview/index.html'
PET_URL = URL.rsplit('/', 1)[0] + '/pet/game/index.html'
SAVE = 'tangzhe-preview-save'
results = []
def check(c, id, msg): results.append(bool(c)); print(('  ✓ ' if c else '  ✗ ') + id + ' ' + msg, flush=True)
FILL = "{ const E = __tzz.E, t = E.homeTier(E.homeOf(s,'c77').lv); for (let y = 0; y < t.rows; y++) for (let x = 0; x < t.cols; x++) { s.coins = 1e9; E.buyFurniture(s,'furn_plant'); E.placeItem(s,'c77','furn_plant',x,y,0,'floor'); } s.coins = 50000; }"
UNSUP = {'v': 99, 'dog': {'affinity': 88}, 'extra': [1, {'a': 2}]}
CATENG = {'v': 1, 'cat': {'v': 42, 'mood': 'x'}}

def boot(pg):
    pg.wait_for_function("window.__tzz && document.body.dataset.petReady==='1'", timeout=20000)
    pg.evaluate("async () => { for (let i = 0; i < 12; i++) { if (__tzz.modalOpen && __tzz.modalOpen()) __tzz.closeModal(); await new Promise(r => setTimeout(r, 120)); } }")
    pg.evaluate("__tzz.pets.manual(true)")
def go(pg, who, sub='room'):
    pg.evaluate("([who, sub]) => { __tzz.setTab('home'); if (__tzz.homeWho !== who) __tzz.homeAct('homeWho', who); if (__tzz.homeSub !== sub) __tzz.homeAct('homeSub', sub); __tzz.homeMode = 'live'; __tzz.renderTab(); __tzz.pets.draw(); }", [who, sub])
    pg.wait_for_timeout(300)
def seed(pg, mk, url, who='c77'):
    pg.evaluate("""(mk) => { const E = __tzz.E, s = E.newState(Date.now()); s.rev = __tzz.state.rev + 1000;
      for (const c of E.CEOS) { s.ceos[c.id].unlocked = true; s.ceos[c.id].lv = Math.max(1, s.ceos[c.id].lv || 1); }
      s.coins = 50000; s.coinFrac = 0; delete s.pet; delete s.pets; (new Function('s', mk))(s);
      localStorage.clear(); localStorage.setItem('tangzhe-save', '{"sentinel":1}'); localStorage.setItem('""" + SAVE + """', JSON.stringify(s)); }""", mk)
    pg.goto(url); boot(pg); go(pg, who)
def reload(pg, url, who='c77'): pg.goto(url); boot(pg); go(pg, who)
def pets(s): return json.loads(s) if isinstance(s, str) else s
roster = lambda pg: pg.evaluate("JSON.stringify(((__tzz.state.pets || {}).list || []).map(p => [p.uid, p.species, p.room, JSON.stringify(p.eng)]))")
saved_eng = lambda pg, uid: pg.evaluate("(u) => { const s = JSON.parse(localStorage.getItem('" + SAVE + "')); const p = ((s.pets || {}).list || []).find(p => p.uid === u); return p ? [p.room, JSON.stringify(p.eng)] : null; }", uid)
live_eng = lambda pg, uid: pg.evaluate("(u) => { const p = ((__tzz.state.pets || {}).list || []).find(p => p.uid === u); return p ? [p.room, JSON.stringify(p.eng)] : null; }", uid)
raw = lambda pg: pg.evaluate("localStorage.getItem('" + SAVE + "')")
where = lambda pg: pg.evaluate("[__tzz.homeWho, __tzz.homeSub]")
modal = lambda pg: pg.evaluate("!!__tzz.modalOpen()")
toast = lambda pg: pg.evaluate("(document.querySelector('#toast') || {}).textContent || ''")
sentinel = lambda pg: pg.evaluate("localStorage.getItem('tangzhe-save')") == '{"sentinel":1}'
def tap(pg, sel): pg.evaluate("(s) => document.querySelector(s).scrollIntoView({block:'center'})", sel); pg.wait_for_timeout(60); pg.tap(sel); pg.wait_for_timeout(250)
def fail_save(pg): pg.evaluate("(k) => { const o = Storage.prototype.setItem; window.__origSet = o; Storage.prototype.setItem = function (a, b) { if (a === k) throw new DOMException('QuotaExceededError', 'QuotaExceededError'); return o.call(this, a, b); }; }", SAVE)
def restore(pg): pg.evaluate("() => { if (window.__origSet) Storage.prototype.setItem = window.__origSet; }")
def bar(pg, uid): return pg.evaluate("(u) => { const q = '[data-uid=\"' + u + '\"]', h = document.querySelector('[data-pet-wait=\"' + u + '\"]'); return { btns: [...document.querySelectorAll('.pet-bar' + q + ' button')].map(b => b.disabled), hint: h ? (h.hidden ? '' : h.textContent) : null, status: (document.querySelector('[data-pet-status=\"' + u + '\"]') || {}).textContent || '', standby: !!document.querySelector('.pet-slot' + q + ' [data-act=petStandby]:not([disabled])') }; }", uid)
def buy_flow(pg, target, pick):  # pick: None（直接确认）/ 'standby' / 替换 uid
    pg.evaluate("(t) => __tzz.homeAct('homePetBuy', t)", target); pg.wait_for_timeout(250)
    if pick == 'standby': tap(pg, '#petBuyStandby')
    elif pick: tap(pg, '#petBuyReplace'); tap(pg, '[data-replace-uid="' + pick + '"]')
    tap(pg, '#pbYes'); pg.wait_for_timeout(150)

def main_cases(pg, D, url):
    # ---- 1 购买确认：钱包异常 / 余额不足 → 不可用 + 原因；提交时再查
    seed(pg, "", url, 'pearl'); r0, s0 = roster(pg), raw(pg)
    for nm, coins, why in [('钱包异常', -5, '金币数据异常'), ('余额不足', 10, '金币不够')]:
        pg.evaluate("(c) => { __tzz.state.coins = c; }", coins)
        pg.evaluate("__tzz.homeAct('homePetBuy', 'c77')"); pg.wait_for_timeout(250)
        st = pg.evaluate("() => { const y = document.querySelector('#pbYes'), w = document.querySelector('#pbWhy'); return { open: __tzz.modalOpen(), dis: !!(y && y.disabled), why: w && !w.hidden ? w.textContent : '' }; }")
        pg.evaluate("() => { const y = document.querySelector('#pbYes'); if (y) { y.disabled = false; y.click(); } }"); pg.wait_for_timeout(200)
        check(st['open'] and st['dis'] and why in st['why'] and roster(pg) == r0 and raw(pg) == s0 and where(pg) == ['pearl', 'room'] and not modal(pg),
              D + ' R4-1', f'{nm}：确认键不可用并写明「{st["why"]}」；强点也不买，名单 / 存档 / 房间不变')
    pg.evaluate("() => { __tzz.state.coins = 50000; }")
    pg.evaluate("__tzz.homeAct('homePetBuy', 'c77')"); pg.wait_for_timeout(250)
    ok_open = pg.evaluate("() => !document.querySelector('#pbYes').disabled")
    pg.evaluate("() => { __tzz.state.coins = 10; }"); tap(pg, '#pbYes')
    check(ok_open and roster(pg) == r0 and '金币不够' in toast(pg) and where(pg) == ['pearl', 'room'], D + ' R4-1', '弹窗打开后余额变少：提交时再查，拒买并提示，名单不变、不切房')
    pg.evaluate("() => { __tzz.state.coins = 50000; }")
    # ---- 3 导航：失败不切、成功切到目标房间
    fail_save(pg); buy_flow(pg, 'c77', None); restore(pg)
    check(roster(pg) == r0 and where(pg) == ['pearl', 'room'] and pg.evaluate("__tzz.state.coins") == 50000 and '保存失败' in toast(pg) and not modal(pg), D + ' R4-3', '存档写失败的购买：金币 / 名单不变，留在珍珠姐家')
    go(pg, 'pearl', 'mall'); buy_flow(pg, 'c77', None)
    v = pets(roster(pg))
    check(len(v) == 1 and v[0][2] == 'c77' and where(pg) == ['c77', 'room'], D + ' R4-3', f'在珍珠姐商城买进 c77：成功后切到 c77 的家（{where(pg)}）')
    pg.screenshot(path=SHOT + D + '_r4_after_buy.png')
    # ---- 2 + 3 名额满 vs 地面满；买入待命不改目的地、不切房；搬家成功切房、地面满拒绝
    seed(pg, FILL + " s.pets = { v:2, list:[{uid:'c', species:'dog', room:null, boughtAt:3, eng:null}] };", url, 'pearl')
    go(pg, 'c77', 'mall')
    card = pg.evaluate("() => { const n = document.querySelector('#petNoRoom'); return n ? n.textContent : ''; }")
    pg.evaluate("__tzz.homeAct('homePetBuy', 'c77')"); pg.wait_for_timeout(250)
    m = pg.evaluate("() => ({ title: (document.querySelector('.mtitle') || {}).textContent, rep: !!document.querySelector('#petBuyReplace'), sb: !!document.querySelector('#petBuyStandby') })")
    check('暂时无法入宅' in card and m['title'] == '暂时无法入宅' and not m['rep'] and m['sb'], D + ' R4-2', 'c77 地面满：商城卡写明暂时无法入宅；弹窗不给替换，只给「购买后待命」')
    tap(pg, '#petBuyStandby'); tap(pg, '#pbYes')
    v = pets(roster(pg))
    check(len(v) == 2 and all(p[2] is None for p in v) and where(pg) == ['c77', 'mall'], D + ' R4-2/3', f'明确买入待命：成功、新宠在待命（没被改去别的房间），不切房（{where(pg)}）')
    go(pg, 'pearl'); r1, s1 = roster(pg), raw(pg)
    pg.evaluate("__tzz.homeAct('homePetMove', 'c77')"); pg.wait_for_timeout(250)
    check(roster(pg) == r1 and raw(pg) == s1 and where(pg) == ['pearl', 'room'] and '暂时无法入宅' in toast(pg), D + ' R4-2/3', '搬进地面满的 c77：拒绝并提示，名单 / 存档不变，不切房')
    go(pg, 'c77'); pg.evaluate("__tzz.homeAct('homePetMove', 'pearl')"); pg.wait_for_timeout(250)
    v = pets(roster(pg))
    check(sum(1 for p in v if p[2] == 'pearl') == 1 and where(pg) == ['pearl', 'room'], D + ' R4-3', f'从 c77 把待命宠物搬进珍珠姐家：成功并切到珍珠姐家（{where(pg)}）')
    # 名额满（地面有空）→ 替换 / 待命二选一
    seed(pg, "s.pets = { v:2, list:[{uid:'a', species:'dog', room:'c77', boughtAt:1, eng:null}, {uid:'b', species:'dog', room:'c77', boughtAt:2, eng:null}] };", url, 'c77')
    pg.evaluate("__tzz.homeAct('homePetBuy', 'c77')"); pg.wait_for_timeout(250)
    m = pg.evaluate("() => ({ title: (document.querySelector('.mtitle') || {}).textContent, rep: !!document.querySelector('#petBuyReplace'), sb: !!document.querySelector('#petBuyStandby') })")
    pg.evaluate("__tzz.closeModal()")
    check(m['title'] == '房间已满 · 2/2' and m['rep'] and m['sb'], D + ' R4-2', '名额满（地面有空）：明确选替换或买入待命')
    # ---- 4 等待安置
    seed(pg, FILL + " s.pets = { v:2, list:[{uid:'a', species:'dog', room:'c77', boughtAt:1, eng:null}] };", url, 'c77')
    pg.evaluate("__tzz.pets.draw()"); w = bar(pg, 'a')
    check(w['btns'] and all(w['btns']) and '等待安置' in w['hint'] and '等待安置' in w['status'] and w['standby'] and live_eng(pg, 'a')[0] == 'c77',
          D + ' R4-4', f'满屋等待：提示「{w["hint"][:14]}…」，呼唤 / 摸摸 / 抛球全禁用，保留回待命，房间归属不变')
    pg.screenshot(path=SHOT + D + '_r4_waiting.png')
    pg.evaluate("() => { const E = __tzz.E, s = __tzz.state; for (const p of E.homeOf(s,'c77').placed.slice()) E.storeItem(s,'c77',p.uid); __tzz.renderTab(); __tzz.pets.draw(); __tzz.pets.draw(); }"); pg.wait_for_timeout(200)
    w2 = bar(pg, 'a')
    check(w2['btns'] and not any(w2['btns']) and w2['hint'] == '' and '跑出来' in toast(pg), D + ' R4-4', '收起家具：互动恢复、等待提示消失、提示小狗跑出来')
    seed(pg, FILL + " s.pets = { v:2, list:[{uid:'a', species:'dog', room:'c77', boughtAt:1, eng:null}] };", url, 'c77')
    tap(pg, '.pet-slot[data-uid="a"] [data-act=petStandby]')
    check(live_eng(pg, 'a')[0] is None and saved_eng(pg, 'a')[0] is None and where(pg) == ['c77', 'room'], D + ' R4-4', '等待中点回待命：成功保存，不切房')
    # ---- 5 无效房间
    seed(pg, "s.ceos.pearl.unlocked = false; s.pets = { v:2, list:[{uid:'x1', species:'dog', room:'pearl', boughtAt:1, eng:" + json.dumps(UNSUP) + "}, {uid:'x2', species:'dog', room:'nope', boughtAt:2, eng:null}] };", url, 'c77')
    v = pets(roster(pg))
    check([p[2] for p in v] == [None, None] and [p[0] for p in v] == ['x1', 'x2'] and v[0][3] == json.dumps(UNSUP, separators=(',', ':')), D + ' R4-5', '未开放 / 未知房间：两只都转待命，uid / 种类 / 成长原样，没被塞进别的房间')

def unsup_cases(pg, D, url):
    J = json.dumps(UNSUP, separators=(',', ':')); CJ = json.dumps(CATENG, separators=(',', ':'))
    seed(pg, "s.pets = { v:2, list:[{uid:'a', species:'dog', room:'c77', boughtAt:1, eng:" + J + "}, {uid:'b', species:'dog', room:'c77', boughtAt:2, eng:null}, {uid:'k', species:'cat', room:null, boughtAt:3, eng:" + CJ + "}] };", url, 'c77')
    pg.evaluate("__tzz.pets.draw()"); w, wb = bar(pg, 'a'), bar(pg, 'b')
    check('版本不支持' in w['status'] and all(w['btns']) and w['standby'] and wb['btns'] and not any(wb['btns']) and pg.evaluate("__tzz.pets.state('a')") == 'unsupported',
          D + ' R4-6', '不支持的成长版本：提示版本不支持、这只的互动禁用（另一只正常）、保留回待命')
    pg.screenshot(path=SHOT + D + '_r4_unsupported.png')
    pg.evaluate("() => { __tzz.pets.manual(false); }"); pg.wait_for_timeout(600); pg.evaluate("() => { __tzz.pets.manual(true); __tzz.pets.persist(); }")
    check(live_eng(pg, 'a') == ['c77', J] and saved_eng(pg, 'a') == ['c77', J] and saved_eng(pg, 'k') == [None, CJ], D + ' R4-6', '跑一段实时帧后保存：未知狗版本和猫嵌套版本逐字节不变（暂停模拟、不写回）')
    reload(pg, url)
    check(live_eng(pg, 'a') == ['c77', J] and pg.evaluate("__tzz.pets.state('a')") == 'unsupported' and live_eng(pg, 'k') == [None, CJ], D + ' R4-6', '刷新后：仍原样、仍暂停，不当新狗')
    r0, s0 = roster(pg), raw(pg)
    fail_save(pg); buy_flow(pg, 'c77', 'a'); restore(pg)
    check(roster(pg) == r0 and raw(pg) == s0 and pg.evaluate("__tzz.state.coins") == 50000 and '保存失败' in toast(pg) and not modal(pg), D + ' R4-6', '买新狗替换它但存档写失败：金币 / 名单 / 原数据全不变')
    buy_flow(pg, 'c77', 'a')
    check(live_eng(pg, 'a') == [None, J] and saved_eng(pg, 'a') == [None, J] and len(pets(roster(pg))) == 4, D + ' R4-6', '替换成功：它回待命，成长数据逐字节保留')
    reload(pg, url)
    check(live_eng(pg, 'a') == [None, J] and live_eng(pg, 'k') == [None, CJ], D + ' R4-6', '替换后刷新：仍逐字节保留（狗 + 猫）')

with sync_playwright() as p:
    import os
    SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shots') + os.sep; os.makedirs(SHOT, exist_ok=True)
    b = p.webkit.launch()
    for dev in ['iPhone SE', 'iPhone 15']:
        print('==', dev, flush=True); D = dev.replace(' ', '_')
        ctx = b.new_context(**p.devices[dev]); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); boot(pg)
        main_cases(pg, D, URL)
        unsup_cases(pg, D, URL)
        print('-- 独立宠物页', flush=True)
        pg.goto(PET_URL); boot(pg)
        unsup_cases(pg, D + '/pet', PET_URL)
        check(sentinel(pg), D + ' S', '正式站存档哨兵全程未改')
        check(not errs, D + ' E', '无页面错误 ' + '; '.join(errs[:3]))
        ctx.close()
    b.close()
n = sum(results); print(f'r4 浏览器：{n} 过 / {len(results) - n} 挂（WebKit 模拟，不算真机；猫图集 / 动作 / 玩具未完成，不在此列）')
sys.exit(0 if n == len(results) else 1)
