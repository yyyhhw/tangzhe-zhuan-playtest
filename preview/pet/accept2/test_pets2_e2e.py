# 每房两只宠物 + 换宠界面 + 猫首样 — 端到端验收（WebKit = iPhone Safari 内核；iPhone SE / iPhone 15，模拟，不算真机）
# 用法：仓库根目录 python3 -m http.server 49761，再 python3 preview/pet/accept2/test_pets2_e2e.py [主预览 URL]
# 用例编号对应 ACCEPT.md 的 U1–U11、C1–C8。页面钩子 / 选择器 / 动作名都在下面 ADAPT 一处，实现方换了名字只改这里。
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49761/preview/index.html'
SAVE = 'tangzhe-preview-save'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shots'); os.makedirs(SHOTS, exist_ok=True)
ADAPT = {
  'slots': '#petSlots [data-pet-slot]',           # 房间管理界面的两个宠物位；有宠物的位带 data-uid
  'list': '#petList [data-pet-uid]',              # 已拥有列表：每只一项，data-where = CEO id 或 standby，文字写 CEO 名字或「待命」
  'place': '[data-act="petPlace"][data-arg="{uid}"]',  # 列表里「放进这间房」按钮
  'replace': '#petReplace [data-replace-uid]',    # 满房时弹出的替换选单：两只在房的各一个按钮
  'cancel': '#petReplace [data-act="petReplaceCancel"]',
  'sprite': '#roomFloor .pet-sprite[data-uid="{uid}"]',
  # __tzz.pets：view() 同 Node 版；world(uid) → { pet:{ x, y, dir, anim:{ name } }, cols, rows }；step(uid, 秒)；toy(uid, x, y) 在房间格坐标放逗猫玩具；px(uid) → 屏幕坐标
  'cat_seq': ['idle', 'stalk', 'crouch', 'pounce', 'land', 'paw', 'groom', 'idle'],   # 熊大规格：待机→低身靠近玩具→蹲伏蓄力→扑抓→落地→拍打→舔爪→回待机
  'cat_touch': ['arch', 'rub'],                    # 触摸：拱背→蹭手
  # 测试期间冻结实时引擎（不跑 rAF、不自动存档），只由 step() 推进；draw() 立刻按当前状态重画
  'freeze': "__tzz.pets.manual(true)",
  'draw': "__tzz.pets.draw()",
  # 存档 / 视图只比稳定字段：uid、房间、种类、购买时间、成长（亲密度）；位置、精力这些实时值不比
  # 成长值（同 Node 版 ADAPT.growth）：入参是存档里或 view() 里的一只宠物，拿不到返回 null
  'growth': "(p) => (p && p.eng && p.eng.dog && typeof p.eng.dog.affinity === 'number') ? p.eng.dog.affinity : null",
  'proj': "(L) => (L || []).map(p => [p.uid, p.room === undefined ? null : p.room, p.species, p.boughtAt, (GROWTH)(p)]).sort((a, b) => a[0] < b[0] ? -1 : 1)",
  'mk': "s.pets = { v: 2, list: L.map(p => Object.assign({ boughtAt: 1, eng: null }, p)) }",
}
ADAPT['proj'] = ADAPT['proj'].replace('GROWTH', ADAPT['growth'])
results = []
def check(c, id, msg): results.append(bool(c)); print(('  ✓ ' if c else '  ✗ ') + id + ' ' + msg)
PER_DEV = 21   # 每台设备的用例数（U1–U11 + C1–C8 + 结尾两项），两台共 42
def seed(pg, L, room='c77', extra=''):
    pg.evaluate("""([L]) => { const E = __tzz.E, s = E.newState(Date.now()); for (const c of E.CEOS) { s.ceos[c.id].unlocked = true; s.ceos[c.id].lv = Math.max(1, s.ceos[c.id].lv || 1); }
      s.rev = __tzz.state.rev; s.coins = 50000; delete s.pet; """ + ADAPT['mk'] + """; """ + extra + """ localStorage.clear(); localStorage.setItem('tangzhe-save', '{"sentinel":1}'); localStorage.setItem('""" + SAVE + """', JSON.stringify(s)); }""", [L])
    reload_frozen(pg, room)
def reload_frozen(pg, room='c77'):   # 每次刷新后都重新冻结实时引擎
    pg.reload(); boot(pg); pg.evaluate(ADAPT['freeze']); to_room(pg, room)
def boot(pg):
    pg.wait_for_function("window.__tzz && document.body.dataset.petReady==='1'", timeout=20000)
    pg.evaluate("async () => { for (let i = 0; i < 12; i++) { if (__tzz.modalOpen && __tzz.modalOpen()) __tzz.closeModal(); await new Promise(r => setTimeout(r, 120)); } }")
def to_room(pg, who):
    pg.evaluate("(who) => { __tzz.setTab('home'); if (__tzz.homeWho !== who && __tzz.homeAct) __tzz.homeAct('homeWho', who); if (__tzz.homeSub !== 'room') __tzz.homeAct('homeSub', 'room'); __tzz.homeMode = 'live'; __tzz.renderTab(); }", who)
    pg.wait_for_timeout(400)
view = lambda pg: pg.evaluate("__tzz.pets.view()")
def sview(pg):   # 视图的稳定部分（房间 / 待命 / 每只的成长）
    v = pg.evaluate("(g) => { const v = __tzz.pets.view(), G = eval(g); return { rooms: v.rooms, standby: v.standby, pets: Object.fromEntries(Object.entries(v.pets).map(([u, p]) => [u, [p.species, G(p)]])) }; }", ADAPT['growth'])
    return json.dumps([{k: sorted(a) for k, a in v['rooms'].items()}, sorted(v['standby']), v['pets']], sort_keys=True)
saved = lambda pg: pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('" + SAVE + "')); return s && s.pets && (" + ADAPT['proj'] + ")(s.pets.list); }")
sentinel = lambda pg: pg.evaluate("localStorage.getItem('tangzhe-save')") == '{"sentinel":1}'
def tap(pg, uid):
    xy = pg.evaluate("(u) => __tzz.pets.px(u)", uid); pg.touchscreen.tap(xy['x'], xy['y'])
def frame(pg):   # step 之后立刻重画再量 DOM
    pg.evaluate(ADAPT['draw']); pg.evaluate("() => new Promise(r => requestAnimationFrame(() => r()))")
def seq_until(pg, uid, sec, stop=None):
    return pg.evaluate("""([uid, sec, stop]) => { const P = __tzz.pets, out = [], pos = [], dirs = {}; for (let i = 0; i < sec * 60; i++) { P.step(uid, 1 / 60); const w = P.world(uid), a = w.pet.anim.name;
      if (out[out.length - 1] !== a) { out.push(a); pos.push([w.pet.x, w.pet.y]); } dirs[w.pet.dir] = 1; if (stop && out.length > 1 && a === stop && out.slice(0, -1).includes(stop)) break; } return { seq: out, pos, dirs: Object.keys(dirs) }; }""", [uid, sec, stop])
def subseq(want, got):
    it = iter(got); return all(any(g == w for g in it) for w in want)

with sync_playwright() as p:
    b = p.webkit.launch()
    for dev in ['iPhone SE', 'iPhone 15']:
        print('==', dev); ctx = b.new_context(**p.devices[dev]); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.goto(URL); boot(pg)
        if not pg.evaluate("!!(__tzz.pets && __tzz.pets.view && __tzz.pets.world)"):
            print('  ✗ 缺接口：__tzz.pets（见 ACCEPT.md「接口约定」）'); print('passed 0, failed 0, 未跑（缺接口，每台约 %d 项没跑）' % PER_DEV); sys.exit(1)
        A = [{'uid': 'cat1', 'species': 'cat', 'room': 'c77', 'boughtAt': 1}, {'uid': 'dog1', 'species': 'dog', 'room': 'c77', 'boughtAt': 2}, {'uid': 'cat2', 'species': 'cat', 'room': None, 'boughtAt': 3}]
        seed(pg, A)
        # U1 两个宠物位，都看得见、够大
        sl = pg.evaluate(f"() => [...document.querySelectorAll('{ADAPT['slots']}')].map(e => {{ const r = e.getBoundingClientRect(); return {{ uid: e.dataset.uid || null, h: r.height, vis: r.width > 0 && r.right <= innerWidth + 0.5 }}; }})")
        check(len(sl) == 2 and all(s['vis'] and s['h'] >= 40 for s in sl) and sorted(s['uid'] for s in sl) == ['cat1', 'dog1'], 'U1', f'房间两个宠物位，各显示一只 {sl}')
        # U2 拥有列表标明房间 / 待命
        li = pg.evaluate(f"() => [...document.querySelectorAll('{ADAPT['list']}')].map(e => [e.dataset.petUid, e.dataset.where, e.textContent])")
        check(len(li) == 3 and dict((u, w) for u, w, _ in li) == {'cat1': 'c77', 'dog1': 'c77', 'cat2': 'standby'} and any('待命' in t for u, _, t in li if u == 'cat2'), 'U2', f'拥有列表 3 只，标明所在房间 / 待命 {[x[:2] for x in li]}')
        pg.screenshot(path=f"{SHOTS}/{dev.replace(' ', '_')}_slots.png")
        # U3 满房放第三只：先弹替换选单（两只可选），取消后什么都不变
        s0 = saved(pg); pg.click(ADAPT['place'].format(uid='cat2')); pg.wait_for_timeout(300)
        opts = pg.evaluate(f"() => [...document.querySelectorAll('{ADAPT['replace']}')].map(e => e.dataset.replaceUid)")
        box = pg.evaluate("() => { const e = document.querySelector('#petReplace'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; }")
        check(sorted(opts) == ['cat1', 'dog1'] and box and box['top'] >= 0 and box['bottom'] <= box['h'] + 0.5, 'U3', f'满房：弹替换选单，两只可选，选单不出屏 {opts} {box}')
        pg.click(ADAPT['cancel']); pg.wait_for_timeout(200)
        check(saved(pg) == s0 and view(pg)['standby'] == ['cat2'], 'U4', '取消替换：存档、房间都不变')
        # U11 满房把房里已有的那只再放进同一间房：无操作，不弹替换
        if pg.query_selector(ADAPT['place'].format(uid='cat1')): pg.click(ADAPT['place'].format(uid='cat1')); pg.wait_for_timeout(250)
        check(not pg.query_selector(ADAPT['replace']) and saved(pg) == s0, 'U11', '同房再放：不弹替换、存档不变')
        # U5 选替换 dog1：cat2 进房，dog1 回待命，刷新后保持，成长不变
        g0 = json.loads(sview(pg))[2]
        pg.click(ADAPT['place'].format(uid='cat2')); pg.wait_for_timeout(200); pg.click(ADAPT['replace'] + '[data-replace-uid="dog1"]'); pg.wait_for_timeout(300)
        v = view(pg); reload_frozen(pg); v2 = view(pg)
        check(sorted(v['rooms'].get('c77', [])) == ['cat1', 'cat2'] and v['standby'] == ['dog1'] and v2['rooms'] == v['rooms'] and json.loads(sview(pg))[2] == g0 and saved(pg) != s0, 'U5', f'替换成功、刷新保留、成长不变 {v["rooms"]}')
        # U6 保存失败：整次调配回滚（内存、界面、存档）
        s0 = saved(pg); v0 = sview(pg)
        pg.evaluate(f"() => {{ window.__si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) {{ if (k.startsWith('{SAVE}')) throw new Error('QuotaExceededError'); return __si.call(this, k, v); }}; }}")
        pg.click(ADAPT['place'].format(uid='dog1')); pg.wait_for_timeout(200)
        if pg.query_selector(ADAPT['replace']): pg.click(ADAPT['replace'] + '[data-replace-uid="cat1"]'); pg.wait_for_timeout(300)
        bad = pg.evaluate(f"() => [...document.querySelectorAll('{ADAPT['slots']}')].map(e => e.dataset.uid || null).sort()")
        pg.evaluate("() => { Storage.prototype.setItem = __si; }")
        check(sview(pg) == v0 and saved(pg) == s0 and bad == ['cat1', 'cat2'], 'U6', f'写档失败：内存 / 界面 / 存档整次回滚 {bad}')
        # U7 两只在房里各自活动，点一只只有这一只反应
        pg.evaluate("() => { for (const u of ['cat1','cat2']) __tzz.pets.step(u, 1.5); }"); frame(pg)
        n = pg.evaluate(f"() => ['cat1','cat2'].filter(u => document.querySelector('{ADAPT['sprite']}'.replace('{{uid}}', u))).length")
        a0 = pg.evaluate("() => ['cat1','cat2'].map(u => __tzz.pets.world(u).pet.anim.name)")
        tap(pg, 'cat1'); pg.evaluate("() => { for (const u of ['cat1','cat2']) __tzz.pets.step(u, 0.25); }")
        a1 = pg.evaluate("() => ['cat1','cat2'].map(u => __tzz.pets.world(u).pet.anim.name)")
        check(n == 2 and a1[0] in ADAPT['cat_touch'] and a1[1] not in ADAPT['cat_touch'], 'U7', f'两只都画出来；点 cat1 只有它拱背 / 蹭手 {a0} → {a1}')
        # U8 旧档一间房 4 只：2 只在房、2 只待命，列表 4 只全在
        seed(pg, [{'uid': f'x{i}', 'species': 'cat', 'room': 'c77', 'boughtAt': i} for i in range(4)])
        v = view(pg); li = pg.evaluate(f"() => document.querySelectorAll('{ADAPT['list']}').length")
        check(len(v['rooms'].get('c77', [])) == 2 and len(v['standby']) == 2 and li == 4, 'U8', f'旧档超额：房里 2、待命 2、列表 4 {v["rooms"]} {v["standby"]}')
        # U9 v13 单只小狗旧档：读档后在原来的家，一只不丢
        seed(pg, [], extra="delete s.pets; s.pet = { v: 1, owned: true, home: 'pearl', boughtAt: 1, eng: null };")
        v = view(pg); check(sum(len(x) for x in v['rooms'].values()) == 1 and list(v['rooms'].keys()) == ['pearl'], 'U9', f'v13 单只小狗：留在珍珠姐的家 {v}')
        # U10 不新增存档键、没有横向滚动、没有报错
        keys = pg.evaluate("Object.keys(localStorage).sort()"); sw = pg.evaluate("document.documentElement.scrollWidth <= innerWidth")
        check(sentinel(pg) and set(keys) <= {'tangzhe-save', SAVE, SAVE + '-bak', 'tangzhe-preview-save-bak'} and sw and not errs, 'U10', f'正式站存档没被改 {sentinel(pg)}；存档键 {keys}；不横向滚动 {sw}；报错 {errs[:3]}')
        # ---------- 猫首样 ----------
        seed(pg, [{'uid': 'cat1', 'species': 'cat', 'room': 'c77', 'boughtAt': 1}])
        M = pg.evaluate("() => { const w = __tzz.pets.world('cat1'); return { clips: Object.keys((w.manifest || w.pet.anim.manifest || {}).clips || {}), atlas: ((w.manifest || {}).atlas || {}).image, dogAtlas: __tzz.pet && __tzz.pet.M && __tzz.pet.M.atlas.image, cols: w.cols }; }")
        need = set(ADAPT['cat_seq'] + ADAPT['cat_touch'])
        check(need <= set(M['clips']) and M['atlas'] and M['atlas'] != M['dogAtlas'], 'C1', f'猫有自己的整套动作和图集（不复用狗的）缺 {sorted(need - set(M["clips"]))} 图集 {M["atlas"]} vs 狗 {M["dogAtlas"]}')
        for side, tx in [('左', 0.8), ('右', M['cols'] - 0.8 if M['cols'] else 5)]:
            pg.evaluate("([x]) => { const w = __tzz.pets.world('cat1'); w.pet.x = w.cols / 2; __tzz.pets.toy('cat1', x, w.pet.y); }", [tx])
            r = seq_until(pg, 'cat1', 25, 'idle')
            check(subseq(ADAPT['cat_seq'], r['seq']), 'C2' if side == '左' else 'C3', f'玩具在{side}边：完整播完 待机→靠近→蹲伏→扑抓→落地→拍打→舔爪→待机 {r["seq"]}')
            li = r['seq'].index('land') if 'land' in r['seq'] else -1
            d = abs(r['pos'][li][0] - tx) if li >= 0 else 99
            check(d <= 0.45, 'C4' if side == '左' else 'C5', f'{side}边落地点在玩具上（相距 {d:.2f} 格 ≤ 0.45）')
        # C6 扑抓中连点 10 下：落地照样播完，不会直接跳到拱背
        pg.evaluate("() => { const w = __tzz.pets.world('cat1'); __tzz.pets.toy('cat1', 1, w.pet.y); }")
        pg.evaluate("() => { for (let i = 0; i < 1800 && __tzz.pets.world('cat1').pet.anim.name !== 'pounce'; i++) __tzz.pets.step('cat1', 1 / 60); }")
        for _ in range(10):
            frame(pg); tap(pg, 'cat1')
        r = seq_until(pg, 'cat1', 6)
        check(r['seq'][:2] == ['pounce', 'land'] or (r['seq'] and r['seq'][0] == 'land'), 'C6', f'扑抓中连点：先落地再响应 {r["seq"][:5]}')
        # C7 触摸：拱背 → 蹭手 → 回待机
        pg.evaluate("() => { for (let i = 0; i < 600; i++) __tzz.pets.step('cat1', 1 / 60); }")
        frame(pg); tap(pg, 'cat1'); r = seq_until(pg, 'cat1', 8, 'idle')
        check(subseq(ADAPT['cat_touch'], r['seq']), 'C7', f'摸猫：拱背 → 蹭手 {r["seq"]}')
        # C8 猫画在房间里、不被裁切（贴左右墙时也是）
        clip = []
        for edge in ['l', 'r']:
            pg.evaluate("(e) => { const w = __tzz.pets.world('cat1'); w.pet.x = e === 'l' ? 0.3 : w.cols - 0.3; __tzz.pets.step('cat1', 1 / 60); }", edge); frame(pg)
            clip.append(pg.evaluate(f"""() => {{ const f = document.querySelector('#roomFloor').getBoundingClientRect(), e = document.querySelector('{ADAPT['sprite']}'.replace('{{uid}}', 'cat1'));
              if (!e) return '无'; const r = e.getBoundingClientRect(); return r.left >= f.left - 1 && r.right <= f.right + 1 ? 'ok' : [r.left, r.right, f.left, f.right]; }}"""))
        check(clip == ['ok', 'ok'], 'C8', f'贴左墙 / 右墙不裁切 {clip}')
        check(not errs, 'END', f'猫那段也没有页面报错 {errs[:3]}'); check(sentinel(pg), 'END', '正式站存档 tangzhe-save 全程没被改')
        pg.screenshot(path=f"{SHOTS}/{dev.replace(' ', '_')}_cat.png"); ctx.close()
    b.close()
print(f'passed {sum(results)}, failed {len(results) - sum(results)}'); sys.exit(0 if all(results) else 1)
