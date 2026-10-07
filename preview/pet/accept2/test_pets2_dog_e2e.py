# 双宠（只狗）浏览器验收：PET2_DRAFT「Browser and manual acceptance」1–10 的可自动部分。WebKit 模拟 iPhone SE / 15，不算真机；猫相关（C1–C8、U7 猫版）不在这里，继续标未完成。
# 用法：仓库根目录 python3 -m http.server PORT，再 python3 preview/pet/accept2/test_pets2_dog_e2e.py http://127.0.0.1:PORT/preview/index.html
# 只用一次性浏览器上下文 + 预览存档键；正式站 tangzhe-save 放哨兵值，全程比对。
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49961/preview/index.html'
PET_URL = URL.rsplit('/', 1)[0] + '/pet/game/index.html'
SAVE, BAK = 'tangzhe-preview-save', 'tangzhe-preview-save-bak'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shots'); os.makedirs(SHOTS, exist_ok=True)
results = []
def check(c, id, msg): results.append(bool(c)); print(('  ✓ ' if c else '  ✗ ') + id + ' ' + msg)
GROWTH = "(p) => (p && p.eng && p.eng.dog && typeof p.eng.dog.affinity === 'number') ? p.eng.dog.affinity : null"

def boot(pg):
    pg.wait_for_function("window.__tzz && document.body.dataset.petReady==='1'", timeout=20000)
    pg.evaluate("async () => { for (let i = 0; i < 12; i++) { if (__tzz.modalOpen && __tzz.modalOpen()) __tzz.closeModal(); await new Promise(r => setTimeout(r, 120)); } }")
    pg.evaluate("__tzz.pets.manual(true)")
def to_room(pg, who):
    pg.evaluate("(who) => { __tzz.setTab('home'); if (__tzz.homeWho !== who) __tzz.homeAct('homeWho', who); if (__tzz.homeSub !== 'room') __tzz.homeAct('homeSub', 'room'); __tzz.homeMode = 'live'; __tzz.renderTab(); __tzz.pets.draw(); }", who)
    pg.wait_for_timeout(350)
def reload_frozen(pg, room='c77', url=None):
    if url: pg.goto(url)
    else: pg.reload()
    boot(pg); to_room(pg, room)
def seed(pg, mk, room='c77', url=None):
    # mk：JS 片段，拿到 s（新档，rev 高于页面当前）和 eng(aff)（真引擎快照副本）
    pg.evaluate("""([mk, tpl]) => { const E = __tzz.E, s = E.newState(Date.now()); s.rev = __tzz.state.rev + 1000;
      for (const c of E.CEOS) { s.ceos[c.id].unlocked = true; s.ceos[c.id].lv = Math.max(1, s.ceos[c.id].lv || 1); }
      s.coins = 50000; s.coinFrac = 0; delete s.pet; delete s.pets;
      const eng = (aff) => { const e = JSON.parse(tpl); e.dog.affinity = aff; return e; };
      (new Function('s', 'eng', mk))(s, eng);
      localStorage.clear(); localStorage.setItem('tangzhe-save', '{"sentinel":1}'); localStorage.setItem('""" + SAVE + """', JSON.stringify(s)); }""", [mk, TPL])
    reload_frozen(pg, room, url)
view = lambda pg: pg.evaluate("__tzz.pets.view()")
def stable(pg):  # 房间 / 待命 / 每只的 种类·购买时间·成长
    return pg.evaluate("(g) => { const v = __tzz.pets.view(), G = eval(g), R = {}; for (const k in v.rooms) R[k] = v.rooms[k].slice().sort(); return JSON.stringify([R, v.standby.slice().sort(), Object.keys(v.pets).sort().map(u => [u, v.pets[u].species, v.pets[u].boughtAt, G(v.pets[u])])]); }", GROWTH)
def saved_stable(pg):
    return pg.evaluate("(g) => { const s = JSON.parse(localStorage.getItem('" + SAVE + "')), G = eval(g); return JSON.stringify(((s.pets && s.pets.list) || []).map(p => [p.uid, p.room, p.species, p.boughtAt, G(p)]).sort()); }", GROWTH)
full = lambda pg: pg.evaluate("JSON.stringify(__tzz.state)")
raw = lambda pg: pg.evaluate("[localStorage.getItem('" + SAVE + "'), localStorage.getItem('" + BAK + "')]")
sentinel = lambda pg: pg.evaluate("localStorage.getItem('tangzhe-save')") == '{"sentinel":1}'
slots = lambda pg: pg.evaluate("() => [...document.querySelectorAll('#petSlots [data-pet-slot]')].map(e => e.dataset.uid || null)")
modal = lambda pg: pg.evaluate("!!(__tzz.modalOpen && __tzz.modalOpen())")
def fail_key(pg, key):  # 只让某个存档键写失败
    pg.evaluate("(k) => { const o = Storage.prototype.setItem; window.__origSet = o; Storage.prototype.setItem = function (a, b) { if (a === k) throw new DOMException('QuotaExceededError', 'QuotaExceededError'); return o.call(this, a, b); }; }", key)
def restore(pg): pg.evaluate("() => { if (window.__origSet) Storage.prototype.setItem = window.__origSet; }")
def overflow(pg): return pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 0.5 && document.body.scrollWidth <= innerWidth + 0.5")
def click(pg, sel): pg.evaluate("(s) => { const e = document.querySelector(s); e.scrollIntoView({block:'center'}); }", sel); pg.wait_for_timeout(80); pg.tap(sel); pg.wait_for_timeout(250)

THREE = "s.pets = { v:2, list:[ {uid:'a', species:'dog', room:'c77', boughtAt:1, eng:eng(51)}, {uid:'b', species:'dog', room:'c77', boughtAt:2, eng:eng(62)}, {uid:'c', species:'dog', room:null, boughtAt:3, eng:eng(73)} ] };"
TPL = None
with sync_playwright() as p:
    b = p.webkit.launch()
    for dev in ['iPhone SE', 'iPhone 15']:
        print('==', dev); D = dev.replace(' ', '_')
        ctx = b.new_context(**p.devices[dev]); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.goto(URL); boot(pg)
        if TPL is None:   # 用真引擎生成一份快照当模板（只改亲密度）
            pg.evaluate("() => { const E = __tzz.E, s = E.newState(Date.now()); s.rev = __tzz.state.rev + 1000; s.ceos.c77.unlocked = true; s.pets = { v:2, list:[{uid:'t', species:'dog', room:'c77', boughtAt:1, eng:null}] }; localStorage.clear(); localStorage.setItem('" + SAVE + "', JSON.stringify(s)); }")
            reload_frozen(pg); TPL = json.dumps(view(pg)['pets']['t']['eng'])
        # 1 种子：a、b 在 77，c 待命，亲密 51/62/73
        seed(pg, THREE)
        g0 = stable(pg)
        check(json.loads(g0)[2] == [['a','dog',1,51],['b','dog',2,62],['c','dog',3,73]] and sentinel(pg), 'D1', f'种子档读入：三只小狗、亲密 51/62/73，正式站哨兵在 {g0}')
        # 2 布局：两个宠物位、列表标位置、控件 ≥ 40px、不横向滚动
        L = pg.evaluate("""() => { const q = s => [...document.querySelectorAll(s)], r = e => e.getBoundingClientRect();
          return { slots: q('#petSlots [data-pet-slot]').map(e => ({ uid: e.dataset.uid || null, h: r(e).height, l: r(e).left, rr: r(e).right })),
            rows: q('#petList [data-pet-uid]').map(e => [e.dataset.petUid, e.dataset.where, e.textContent.includes('待命')]),
            small: q('.pet-manager button').filter(e => r(e).height < 40 || r(e).right > innerWidth + 0.5 || r(e).left < -0.5).map(e => e.textContent.trim() + ':' + Math.round(r(e).height)), w: innerWidth }; }""")
        check(len(L['slots']) == 2 and sorted(s['uid'] for s in L['slots']) == ['a','b'] and all(s['h'] >= 40 and s['l'] >= 0 and s['rr'] <= L['w'] + 0.5 for s in L['slots']), 'D2', f'房间两个宠物位都在屏内、≥40px，各显示一只 {L["slots"]}')
        check(sorted(x[:2] for x in L['rows']) == [['a','c77'],['b','c77'],['c','standby']] and [x for x in L['rows'] if x[0] == 'c'][0][2], 'D2', f'已拥有列表 3 只、标明房间 / 待命 {L["rows"]}')
        check(not L['small'], 'D2', f'宠物管理区所有按钮 ≥40px 且不出屏 {L["small"]}')
        check(overflow(pg), 'D2', '没有横向滚动')
        pg.evaluate("document.querySelector('.pet-manager').scrollIntoView({block:'start'})"); pg.wait_for_timeout(150)
        pg.screenshot(path=f'{SHOTS}/{D}_pet2_manager.png')
        pg.evaluate("document.querySelector('#roomFloor').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150)
        pg.screenshot(path=f'{SHOTS}/{D}_pet2_room.png')
        # 3 满房放 c：选单只列 a/b；取消 → 整份 state、存档字节都不变
        s0, r0 = full(pg), raw(pg)
        click(pg, '[data-act="petPlace"][data-arg="c"]')
        opts = pg.evaluate("() => [...document.querySelectorAll('#petReplace [data-replace-uid]')].map(e => e.dataset.replaceUid)")
        box = pg.evaluate("() => { const e = document.querySelector('#petReplace'); if (!e) return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, h: innerHeight, w: innerWidth }; }")
        check(sorted(opts) == ['a','b'] and box and box['t'] >= 0 and box['b'] <= box['h'] + 0.5 and box['r'] <= box['w'] + 0.5, 'D3', f'满房：替换选单只列 a/b、不出屏 {opts} {box}')
        pg.screenshot(path=f'{SHOTS}/{D}_pet2_replace.png')
        click(pg, '#petReplaceCancel')
        check(not modal(pg) and full(pg) == s0 and raw(pg) == r0, 'D3', '取消：整份 state、主档 / 备份字节都不变')
        # 4 选 b：a/c 在 77、b 待命，成长和金币不变；读档、刷新后一致
        coins0 = pg.evaluate("__tzz.state.coins")
        click(pg, '[data-act="petPlace"][data-arg="c"]'); click(pg, '#petReplace [data-replace-uid="b"]')
        v = view(pg); g1 = stable(pg)
        check(sorted(v['rooms'].get('c77', [])) == ['a','c'] and v['standby'] == ['b'] and json.loads(g1)[2] == json.loads(g0)[2] and pg.evaluate("__tzz.state.coins") == coins0 and slots(pg) == ['a','c'] or sorted(slots(pg) or []) == ['a','c'] and v['standby'] == ['b'] and json.loads(g1)[2] == json.loads(g0)[2], 'D4', f'替换 b：77 = a/c、b 待命，成长 / 金币不变 {v["rooms"]} {v["standby"]}')
        sv = saved_stable(pg)
        check(json.loads(sv) == [['a','c77','dog',1,51],['b',None,'dog',2,62],['c','c77','dog',3,73]], 'D4', f'存档读回一致 {sv}')
        reload_frozen(pg)
        check(stable(pg) == g1, 'D4', '刷新并重新冻结后：房间 / 待命 / 成长一致')
        # 5 过期选单：打开选单后（仅测试手段）改动参与者，再确认 → 整份 state 不变
        click(pg, '[data-act="petPlace"][data-arg="b"]')
        pg.evaluate("() => { const r = __tzz.pet.PG.assign(__tzz.state, __tzz.E, 'c', 'pearl', { save: () => true }); if (!r.ok) throw new Error('harness move failed ' + r.why); }")
        s1, r1 = full(pg), raw(pg)
        pg.evaluate("document.querySelector('#petReplace [data-replace-uid=\"a\"]').click()"); pg.wait_for_timeout(300)
        check(full(pg) == s1 and raw(pg) == r1 and not modal(pg), 'D5', '选单期间名单变了：确认过期选单整份 state / 存档不变，选单关闭')
        reload_frozen(pg)   # 丢掉上面只在内存里的测试改动
        # 6 写档失败（备份 / 主档分别）：放置失败，state、宠物位、主档都还是动作前
        for k, name in [(BAK, '备份'), (SAVE, '主档')]:
            s0, r0, sl0 = full(pg), raw(pg), slots(pg)
            fail_key(pg, k)
            click(pg, '[data-act="petPlace"][data-arg="b"]')
            if modal(pg): click(pg, '#petReplace [data-replace-uid="a"]')
            pg.evaluate("__tzz.pets.draw()"); pg.wait_for_timeout(150)
            after = (full(pg), raw(pg)[0], slots(pg)); restore(pg)
            check(after[0] == s0 and after[1] == r0[0] and after[2] == sl0, 'D6', f'{name}写失败：整份 state、宠物位 {after[2]}、主档字节都回到动作前')
        # 失败后正常重试能成功（不是一直卡死）
        click(pg, '[data-act="petPlace"][data-arg="b"]'); click(pg, '#petReplace [data-replace-uid="c"]')
        v = view(pg); check(sorted(v['rooms']['c77']) == ['a','b'] and v['standby'] == ['c'] and json.loads(saved_stable(pg))[1][1] == 'c77', 'D6', f'恢复存储后重试成功 {v["rooms"]}')
        # 7 两只狗都画出来、分得开；点一只只有它反应（touchscreen.tap）
        pg.evaluate("""() => { const P = __tzz.pets, wa = P.world('a'), wb = P.world('b'); wa.dog.x = 1.3; wa.dog.y = 2.6; wb.dog.x = Math.max(2.8, wb.cols - 1.6); wb.dog.y = 2.6; }""")
        pg.evaluate("() => { __tzz.pets.step('a', 1.5); __tzz.pets.step('b', 1.5); __tzz.pets.draw(); }"); pg.wait_for_timeout(100)
        pg.evaluate("document.querySelector('#roomFloor').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150); pg.evaluate("__tzz.pets.draw()")
        bx = pg.evaluate("() => ['a','b'].map(u => { const e = document.querySelector('#roomFloor .pet-sprite[data-uid=\"' + u + '\"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vis: getComputedStyle(e).display !== 'none' && r.width > 0 }; })")
        sep = all(bx) and all(x['vis'] for x in bx) and (bx[0]['r'] <= bx[1]['l'] or bx[1]['r'] <= bx[0]['l'] or bx[0]['b'] <= bx[1]['t'] or bx[1]['b'] <= bx[0]['t'])
        check(sep, 'D7', f'两只都画出来、互不重叠 {bx}')
        pg.screenshot(path=f'{SHOTS}/{D}_pet2_two_dogs.png')
        T = "() => ['a','b'].map(u => { const w = __tzz.pets.world(u); return [w.dog.activity, w.stats.petStarts + w.stats.petAbsorbed]; })"
        act0 = pg.evaluate(T)
        xy = pg.evaluate("__tzz.pets.px('a')"); pg.touchscreen.tap(xy['x'], xy['y']); pg.wait_for_timeout(50)
        pg.evaluate("() => { __tzz.pets.step('a', 0.25); __tzz.pets.step('b', 0.25); __tzz.pets.draw(); }")
        act1 = pg.evaluate(T)   # 醒着进 petted；睡着时引擎按设计只记一次“摸到”（不起身），两种都算 a 收到
        check(act1[0][1] > act0[0][1] and act1[1][1] == act0[1][1] and act1[1][0] != 'petted', 'D7', f'触摸点 a：只有 a 收到抚摸（{act0} → {act1}）')
        pg.evaluate("() => { for (let i = 0; i < 24; i++) { __tzz.pets.step('a', 0.25); __tzz.pets.step('b', 0.25); } __tzz.pets.draw(); }")
        affs = pg.evaluate("() => [__tzz.pets.world('a').dog.affinity, __tzz.pets.world('b').dog.affinity]")
        pg.evaluate("__tzz.pets.persist()")
        to_room(pg, 'pearl'); to_room(pg, 'c77')
        ss = {x[0]: x[4] for x in json.loads(saved_stable(pg))}
        check(affs[0] > 51 and affs[1] == 62 and ss['a'] == affs[0] and ss['b'] == 62 and ss['c'] == 73, 'D7', f'摸完亲密只涨在 a（{affs}），离开再回来存档里成长仍属于各自 uid {ss}')
        # 8 购买：空房、满房替换、待命；取消、余额不足、写档失败、连点确认
        def buy_open(home): pg.evaluate("(h) => __tzz.homeAct('homePetBuy', h)", home); pg.wait_for_timeout(250)
        def uids(): return sorted(view(pg)['pets'].keys())
        to_room(pg, 'pearl')
        s0, r0 = full(pg), raw(pg); buy_open('pearl'); click(pg, '#mNo')
        check(full(pg) == s0 and raw(pg) == r0, 'D8', '空房购买弹窗点取消：state / 存档不变')
        pg.evaluate("() => { __tzz.state.coins = 2999; __tzz.state.coinFrac = 0; __tzz.renderTab(); }"); buy_open('pearl')
        dis = pg.evaluate("() => { const b = document.querySelector('#pbYes'); return !!(b && b.disabled); }"); click(pg, '#mNo')
        check(dis and len(uids()) == 3, 'D8', '余额 2999 不够：确认按钮不可点，没多出宠物')
        pg.evaluate("() => { __tzz.state.coins = 20000; __tzz.state.coinFrac = 0; __tzz.persist(); __tzz.renderTab(); }")
        s0, r0 = full(pg), raw(pg); fail_key(pg, SAVE); buy_open('pearl'); click(pg, '#pbYes'); restore(pg)
        check(full(pg) == s0 and raw(pg)[0] == r0[0] and len(uids()) == 3, 'D8', '购买时主档写失败：金币、名单、存档都不变')
        u0 = uids(); c0 = pg.evaluate("__tzz.state.coins"); buy_open('pearl')
        pg.evaluate("() => { const b = document.querySelector('#pbYes'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(300)
        new = [u for u in uids() if u not in u0]; v = view(pg)
        check(len(new) == 1 and pg.evaluate("__tzz.state.coins") == c0 - 3000 and v['rooms'].get('pearl') == new and v['pets'][new[0]]['species'] == 'dog', 'D8', f'空房购买（确认连点 3 下）：只扣 3000、只多 1 个新 uid、住进珍珠姐的家 {new}')
        to_room(pg, 'c77'); u0 = uids(); c0 = pg.evaluate("__tzz.state.coins")
        buy_open('c77'); click(pg, '#petBuyReplace')
        opts = pg.evaluate("() => [...document.querySelectorAll('#petReplace [data-replace-uid]')].map(e => e.dataset.replaceUid).sort()")
        click(pg, '#petReplace [data-replace-uid="b"]'); click(pg, '#pbYes')
        new = [u for u in uids() if u not in u0]; v = view(pg)
        check(opts == ['a','b'] and len(new) == 1 and sorted(v['rooms']['c77']) == sorted(['a'] + new) and 'b' in v['standby'] and pg.evaluate("__tzz.state.coins") == c0 - 3000, 'D8', f'满房明确替换 b 购买：新狗进 77、b 待命、扣 3000 {v["rooms"]["c77"]}')
        u0 = uids(); c0 = pg.evaluate("__tzz.state.coins"); s0 = full(pg)
        buy_open('c77'); click(pg, '#mNo')
        check(full(pg) == s0, 'D8', '满房购买第一步取消：不变')
        buy_open('c77'); click(pg, '#petBuyStandby'); click(pg, '#pbYes')
        new = [u for u in uids() if u not in u0]; v = view(pg)
        check(len(new) == 1 and new[0] in v['standby'] and len(v['rooms']['c77']) == 2 and pg.evaluate("__tzz.state.coins") == c0 - 3000, 'D8', f'满房「购买后待命」：新狗待命、77 仍 2 只、扣 3000 {new}')
        gall = {x[0]: x[4] for x in json.loads(saved_stable(pg))}
        check(gall['a'] == affs[0] and gall['b'] == 62 and gall['c'] == 73, 'D8', f'几次购买后老狗成长都不变 {gall}')
        # 9 迁移：旧单只 state.pet；一间房 4 只的 v2
        seed(pg, "s.pet = { v:1, owned:true, home:'pearl', boughtAt:7, eng:eng(66) }; s.zombie = {lv:{atk:3,rate:2,hp:1,ult:0},cleared:4,best:0,endBest:{t:0,kills:0}}; s.td = {lv:{bbq:1,tea:0,book:0,tech:2,t77:0,tpearl:0,totaku:0,trocket:0,cmd_c77:1,cmd_pearl:0,cmd_otaku:0,cmd_rocket:0},cleared:1,best:3,cmd:'c77'}; s.coins = 123456; s.shops[0].lv = 9;", 'pearl')
        v = view(pg); pe = list(v['pets'].values())
        un = pg.evaluate("() => { const s = __tzz.state; return [s.coins, s.zombie && s.zombie.lv.atk, s.zombie && s.zombie.cleared, s.td && s.td.lv.tech, s.td && s.td.best, s.shops[0].lv, s.ceos.pearl.unlocked]; }")
        check(len(pe) == 1 and v['rooms'] == {'pearl': [pe[0]['uid']]} and pe[0]['boughtAt'] == 7 and pg.evaluate(f"({GROWTH})(__tzz.pets.view().pets['{pe[0]['uid']}'])") == 66, 'D9', f'v13 单只小狗：迁移后仍在珍珠姐的家、购买时间 / 亲密 66 保留 {v["rooms"]}')
        check(un == [123456, 3, 4, 2, 3, 9, True], 'D9', f'迁移不动打僵尸 / 塔防 / 金币 / 店铺 / CEO {un}')
        seed(pg, "s.pets = { v:2, list:[1,2,3,4].map(i => ({uid:'q'+i, species:'dog', room:'c77', boughtAt:i, eng:eng(40+i)})) }; s.coins = 7777;")
        v = view(pg); n = pg.evaluate("document.querySelectorAll('#petList [data-pet-uid]').length")
        gm = sorted(x[3] for x in json.loads(stable(pg))[2])
        check(len(v['rooms']['c77']) == 2 and len(v['standby']) == 2 and n == 4 and gm == [41,42,43,44] and pg.evaluate("__tzz.state.coins") == 7777, 'D9', f'一间房 4 只：2 在房 2 待命、列表 4 只、成长不丢 {v["rooms"]} {v["standby"]}')
        # 10 双页面往返：主预览 → 独立宠物页 → 改一处 → 回主预览
        seed(pg, THREE)
        gm = stable(pg)
        reload_frozen(pg, 'c77', PET_URL)
        gp = stable(pg); slp = sorted(x for x in slots(pg) if x)
        check(gp == gm and slp == ['a','b'] and sentinel(pg), 'D10', f'独立宠物页读同一份预览档：名单 / 成长一致、宠物位 {slp}')
        check(overflow(pg), 'D10', '独立宠物页没有横向滚动')
        pg.screenshot(path=f'{SHOTS}/{D}_pet2_standalone.png')
        to_room(pg, 'pearl'); click(pg, '[data-act="petPlace"][data-arg="c"]')
        gp2 = stable(pg)
        check(json.loads(gp2)[0].get('pearl') == ['c'], 'D10', '独立宠物页把 c 安排进珍珠姐的家')
        reload_frozen(pg, 'c77', URL)
        check(stable(pg) == gp2 and sentinel(pg), 'D10', '回主预览：看到独立页的安排、成长一致、正式站哨兵没变')
        keys = pg.evaluate("Object.keys(localStorage).sort()")
        check(set(keys) <= {'tangzhe-save', SAVE, BAK, 'tangzhe-preview-tab-lock'}, 'END', f'没有新增存档键 {keys}')
        check(not errs, 'END', f'全程没有页面报错 {errs[:3]}')
        ctx.close()
    b.close()
print(f'passed {sum(results)}, failed {len(results) - sum(results)}（只狗；猫 C1–C8 / U7 猫版未实现，未跑）'); sys.exit(0 if all(results) else 1)
