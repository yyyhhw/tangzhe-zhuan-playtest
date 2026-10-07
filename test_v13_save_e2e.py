# v14 上线前：v13 老档原样保留（Playwright WebKit，iPhone 15）
# 用 v13 正式版代码（fff02e0 根目录）真玩出一份存档（开店 / 升级 / 员工 / CEO / 盲盒 / 穿搭 / 升房 / 家具 / 买小狗 / 打僵尸训练和通关进度 / 离线待领取），
# 原样放进 v14 的 tangzhe-save / -bak，打开 v14，逐项比对：金币不少、等级不降、家具、穿搭、小狗、打僵尸进度都一样，不新增字段、不加预览键。
# 用法：v13 代码目录起静态服务 :49943；再 python test_v13_save_e2e.py [v14 URL] [v13 URL]
import sys, json, math
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49941/index.html'
V12 = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:49943/index.html'   # 旧版 = v13 正式代码（origin/main 根目录）
KEY, BAK = 'tangzhe-save', 'tangzhe-save-bak'
fails, n = [], [0]
def check(c, m):
    n[0] += 1; print(('  ✓ ' if c else '  ✗ ') + m)
    if not c: fails.append(m)
def S(pg, js): return pg.evaluate(js)
def blank(u): return u.split('?')[0].rsplit('/', 1)[0] + '/version.json'
DISMISS = "document.querySelectorAll('.modal-close,[data-act=\"closeModal\"]').forEach(b=>{try{b.click()}catch(e){}})"

# v12 里真玩：全部走 v12 自己的 Economy 接口（和玩家点按钮是同一段代码）
BUILD = r"""(sc) => { const s = __tzz.state, E = __tzz.E, log = [];
  s.coins = 4.2e10 + 0.375;
  for (let i = 0; i < 4; i++) if (!s.shops[i].open) log.push('open' + i + ':' + E.openShop(s, i).ok);
  const LV = [64, 41, 29, 26], EMP = [14, 9, 6, 3], CEO = [['c77', 17], ['pearl', 9], ['otaku', 5], ['rocket', 2]];
  for (let i = 0; i < 4; i++) { while (s.shops[i].lv < LV[i] && E.upgradeShop(s, i).ok); if (!s.shops[i].emp) E.hireEmp(s, i); while (s.shops[i].emp < EMP[i] && E.upgradeEmp(s, i).ok); }
  E.checkUnlocks(s);
  for (const [id, k] of CEO) for (let j = 1; j < k; j++) E.upgradeCeo(s, id);
  [0.31, 0.72, 0.05, 0.9, 0.44, 0.61, 0.18].forEach(r => E.gachaDraw(s, r));
  const own = s.gacha.owned, by = t => E.ITEMS.filter(i => i.type === t && own.includes(i.id)).map(i => i.id);
  const cl = by('clothes'), ht = by('hat');
  s.wear.c77 = { clothes: cl[0] || null, hat: ht[0] || null }; s.wear.pearl = { clothes: cl[1] || null, hat: null };
  s.coins += 3e7;
  E.upgradeHome(s, 'c77'); E.upgradeHome(s, 'pearl'); E.upgradeHome(s, 'pearl'); E.upgradeHome(s, 'otaku');
  const floor = sc.floor, wall = sc.wall, out = [];
  for (const [id, fid, x, y, rot, surf] of floor.concat(wall)) { const b = E.buyFurniture(s, fid); let px = x, py = y; if (x == null) { const ff = E.findFree(s, id, fid, rot, surf); if (ff) { px = ff.x; py = ff.y; } } const r = b.ok ? E.placeItem(s, id, fid, px, py, rot, surf) : b; out.push(id + ' ' + fid + ' ' + (r.ok ? 'ok' : r.why)); }
  for (const fid of sc.inv) E.buyFurniture(s, fid);
  s.taps = 5321; s.crits = 211; s.bigCustomers = 37; s.specialCustomers = 9; s.muted = true;
  s.coins += 0.25;
  __tzz.persist(); __tzz.persist();
  return { log, out, coins: s.coins, lv: s.shops.map(x => x.lv), ceo: Object.values(s.ceos).map(c => c.lv + '/' + c.unlocked), own: own.length, homes: Object.values(s.homes).map(h => h.lv + ':' + h.placed.length) };
}"""
SC_A = {   # 摆放都在 v12 合法；挂画放在第 1–2 列（v13 新底图禁区以外）——这份档进 v13 必须一个字节都不挪
  'floor': [['c77', 'furn_bed', None, None, 0, 'floor'], ['c77', 'furn_sofa', None, None, 1, 'floor'], ['c77', 'furn_plant', 6, 0, 0, 'floor'], ['c77', 'furn_rug', None, None, 0, 'floor'],
            ['pearl', 'furn_wardrobe', 0, 0, 0, 'floor'], ['pearl', 'furn_pearl_glass_wardrobe', 4, 0, 0, 'floor'], ['pearl', 'furn_pearl_picnic_table', 3, 3, 0, 'floor'],
            ['otaku', 'furn_otaku_kotatsu', 1, 2, 0, 'floor'], ['otaku', 'furn_otaku_floor_futon', 4, 3, 0, 'floor'], ['rocket', 'furn_rocket_captain_chair', 2, 1, 0, 'floor']],
  'wall': [['c77', 'furn_painting', 0, 0, 0, 'wall'], ['pearl', 'furn_painting', 1, 1, 0, 'wall'], ['otaku', 'furn_painting', 0, 1, 0, 'wall']],
  'inv': ['furn_plant', 'furn_plant', 'furn_painting', 'furn_rocket_steel_platform_bed'],
}
SC_B = {   # 杨总 12b 换了 Lv2/Lv3 真底图：v12 里挂在第 4 列的画，v13 底图那里是窗 / 墙饰 → 必须挪到最近空墙或退仓库，件数不变、金币不变
  'floor': [['otaku', 'furn_otaku_kotatsu', 1, 2, 0, 'floor']],
  'wall': [['otaku', 'furn_painting', 3, 1, 0, 'wall'], ['pearl', 'furn_painting', 4, 1, 0, 'wall'], ['c77', 'furn_painting', 0, 0, 0, 'wall']],
  'inv': ['furn_plant'],
}

def flat(o, p=''):
    if isinstance(o, dict):
        r = {}
        for k, v in o.items(): r.update(flat(v, f'{p}.{k}' if p else k))
        return r if o else {p: {}}
    if isinstance(o, list):
        r = {}
        for i, v in enumerate(o): r.update(flat(v, f'{p}[{i}]'))
        return r if o else {p: []}
    return {p: o}

def make_v12(b, sc, offline_h=3):
    ctx = b.new_context(**DEV); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(blank(V12)); pg.evaluate('localStorage.clear()')
    pg.goto(V12); pg.wait_for_function('window.__tzz && __tzz.state'); pg.wait_for_timeout(600)
    info = pg.evaluate(BUILD, sc)
    pg.goto(blank(V12))   # 离开页面（pagehide 存档跑完）
    # 模拟玩家离线 offline_h 小时后再打开 v12：v12 自己算离线收益，写进 pending 待领取
    raw = json.loads(S(pg, f"localStorage.getItem('{KEY}')")); raw['lastSeen'] -= offline_h * 3600e3; raw['maxSeen'] = raw['lastSeen']
    S(pg, f"localStorage.setItem('{KEY}', {json.dumps(json.dumps(raw))})")
    pg.goto(V12); pg.wait_for_function('window.__tzz && __tzz.state'); pg.wait_for_timeout(1200); S(pg, '__tzz.persist()')
    pg.goto(blank(V12)); pg.wait_for_timeout(200)
    main, bak = S(pg, f"localStorage.getItem('{KEY}')"), S(pg, f"localStorage.getItem('{BAK}')")
    ctx.close()
    return info, main, bak, errs

def open_v13(b, main, bak):
    ctx = b.new_context(**DEV); pg = ctx.new_page(); errs, bad = [], []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    pg.goto(blank(URL)); S(pg, 'localStorage.clear()')
    S(pg, f"localStorage.setItem('{KEY}', {json.dumps(main)})" + (f"; localStorage.setItem('{BAK}', {json.dumps(bak)})" if bak else ''))
    t0 = S(pg, 'Date.now()')
    pg.goto(URL); pg.wait_for_function('window.__tzz && __tzz.state', timeout=20000)
    mem = S(pg, 'JSON.parse(JSON.stringify(__tzz.state))'); pg.wait_for_timeout(1500)
    vis = S(pg, "({ver: (window.__tzz && document.querySelector('script[src^=\"app.js\"]').getAttribute('src')), modal: !!document.querySelector('.modal:not(.hidden), #modal:not(.hidden)'), txt: (document.body.innerText||'').slice(0, 4000)})")
    pg.goto(blank(URL)); pg.wait_for_timeout(300)
    disk, bak2 = S(pg, f"localStorage.getItem('{KEY}')"), S(pg, f"localStorage.getItem('{BAK}')")
    keys = S(pg, 'Object.keys(localStorage).sort()')
    pg.goto(URL); pg.wait_for_function('window.__tzz && __tzz.state', timeout=20000); pg.wait_for_timeout(800)
    mem2 = S(pg, 'JSON.parse(JSON.stringify(__tzz.state))'); t1 = S(pg, 'Date.now()')
    claim = None
    if mem2.get('pending'):   # 玩家点「直接领取」：v12 攒下的离线收益在 v13 里真能领到，且只领一次
        try:
            pg.wait_for_selector('#claim', timeout=8000)
            pre = S(pg, '({c: __tzz.state.coins + (__tzz.state.coinFrac || 0), amt: __tzz.state.pending.amount, id: __tzz.state.pending.id})')
            pg.click('#claim'); pg.wait_for_timeout(900)
            post = S(pg, "(() => { const d = JSON.parse(localStorage.getItem('tangzhe-save')); return {c: __tzz.state.coins + (__tzz.state.coinFrac || 0), pend: __tzz.state.pending, dc: d.coins + (d.coinFrac || 0), dpend: d.pending, log: (d.claimLog || []).map(x => x && x.id)}; })()")
            claim = dict(pre=pre, post=post)
        except Exception as e: claim = {'err': str(e)[:200]}
    ctx.close()
    return dict(mem=mem, disk=json.loads(disk), bak=bak2, keys=keys, mem2=mem2, vis=vis, errs=errs, bad=bad, secs=(t1 - t0) / 1000, claim=claim)

TIME = {'rev', 'lastSeen', 'maxSeen'}
MONEY = {'coins', 'coinFrac', 'totalEarned'}
GROW = {'pending.sec', 'pending.gap', 'pending.amount'}   # 离线待领取：v13 打开前后又过了几秒，这几秒并进同一笔（只增不减，id / 起点 / 上限不变）
def compare(tag, old, new, secs, allow_home=()):
    fo, fn = flat(old), flat(new)
    diffs = []
    for k, v in fo.items():
        if k in TIME or k in MONEY: continue
        if k in GROW and isinstance(fn.get(k), (int, float)) and fn[k] >= v and fn[k] - v <= max(60, secs + 30) * (1 if k != 'pending.amount' else max(1.0, v / max(1.0, fo.get('pending.sec', 1)))): continue
        if any(k.startswith(f'homes.{h}.') for h in allow_home) or (allow_home and k.startswith('furnInv')): continue
        if k not in fn: diffs.append(f'{k}: {v!r} → (没了)')
        elif fn[k] != v and not (isinstance(v, (int, float)) and isinstance(fn[k], (int, float)) and not isinstance(v, bool) and v == fn[k]): diffs.append(f'{k}: {v!r} → {fn[k]!r}')
    check(not diffs, f'{tag}：v12 存档 {len(fo)} 个字段（除时间戳 / rev / 金币）逐项相同（不同 {len(diffs)}：{diffs[:6]}）')
    for k in ('rev', 'lastSeen', 'maxSeen'):
        check(new.get(k, 0) >= old.get(k, 0), f'{tag}：{k} 只增不减（{old.get(k)} → {new.get(k)}）')
    c0 = old['coins'] + (old.get('coinFrac') or 0); c1 = new['coins'] + (new.get('coinFrac') or 0)
    check(isinstance(new['coins'], int) or float(new['coins']).is_integer(), f'{tag}：v13 金币整数部分是整数（{new["coins"]}，零头 {new.get("coinFrac")}）')
    check(c1 >= c0 - 1e-6, f'{tag}：金币没少（v12 {c0:.4f} → v13 {c1:.4f}，+{c1 - c0:.4f}）')
    return c1 - c0, sorted(k for k in fn if k not in fo and not any(k.startswith(x) for x in ('homes.', 'furnInv')))

def counts(st):
    c = {}
    for fid, k in (st.get('furnInv') or {}).items(): c[fid] = c.get(fid, 0) + k
    for h in st['homes'].values():
        for p in h['placed']: c[p['fid']] = c.get(p['fid'], 0) + 1
    return c


BUILD13 = BUILD.replace("  __tzz.persist(); __tzz.persist();", """  s.zombie = { lv: { atk: 7, rate: 5, hp: 4, ult: 2 }, cleared: 23, best: 23, endBest: { t: 0, kills: 0 } };
  __tzz.persist(); __tzz.persist();""")
PETBUY = r"""async () => { const s = __tzz.state, E = __tzz.E; const M = await (await fetch('pet/art/manifest.json')).json();
  s.coins += 1e6; const r = window.PetGame.buy(s, E, 'pearl', Date.now(), M, x => { __tzz.persist(); return true; }); __tzz.persist(); return { ok: r.ok, why: r.why, pet: s.pet, z: s.zombie }; }"""

with sync_playwright() as p:
    b = p.webkit.launch(); DEV = p.devices['iPhone 15']
    print('== v13 中后期老档（含小狗 + 打僵尸训练 / 通关 23 关 + 离线待领取）→ v14 逐项原样 ==')
    ctx = b.new_context(**DEV); pg = ctx.new_page(); errs0 = []
    pg.on('pageerror', lambda e: errs0.append(str(e)))
    pg.goto(blank(V12)); pg.evaluate('localStorage.clear()')
    pg.goto(V12); pg.wait_for_function('window.__tzz && __tzz.state'); pg.wait_for_timeout(600)
    check(S(pg, "fetch('version.json?t='+Date.now()).then(r=>r.json()).then(j=>j.v)") == '13', '旧版服务 = v13 正式代码')
    info = pg.evaluate(BUILD13, SC_A)
    z0 = S(pg, 'JSON.parse(JSON.stringify(__tzz.state.zombie))')
    pet = pg.evaluate(PETBUY)
    check(pet['ok'] and pet['pet'] and pet['pet']['home'] == 'pearl', f"v13 里真买小狗（PetGame.buy）：{pet.get('why')} home={pet['pet'] and pet['pet'].get('home')}")
    pg.goto(blank(V12))
    raw = json.loads(S(pg, f"localStorage.getItem('{KEY}')")); raw['lastSeen'] -= 3 * 3600e3; raw['maxSeen'] = raw['lastSeen']
    S(pg, f"localStorage.setItem('{KEY}', {json.dumps(json.dumps(raw))})")
    pg.goto(V12); pg.wait_for_function('window.__tzz && __tzz.state'); pg.wait_for_timeout(1200); S(pg, '__tzz.persist()')
    pg.goto(blank(V12)); pg.wait_for_timeout(200)
    main, bak = S(pg, f"localStorage.getItem('{KEY}')"), S(pg, f"localStorage.getItem('{BAK}')"); ctx.close()
    old = json.loads(main)
    check(not errs0, f'v13 造档过程无报错 {errs0[:2]}')
    check(old.get('zombie', {}).get('cleared') == 23 and old['zombie']['lv'] == z0['lv'] and old.get('pet', {}).get('home') == 'pearl' and old.get('pending'), f"v13 档里有打僵尸进度 {old.get('zombie')}、小狗、离线待领取")
    r = open_v13(b, main, bak)
    check(not r['errs'] and not r['bad'], f"v14 打开 v13 老档：无脚本报错 {r['errs'][:2]}、无 404 {r['bad'][:3]}")
    # 小狗引擎是实时模拟（时钟 / 随机数 / 位置每帧在走），earnedFrac 是收益零头——这两类不逐字比，单独核对只增不减 / 小狗还在
    MONEY.add('earnedFrac')
    eo, en = old.get('pet', {}).get('eng') or {}, r['disk'].get('pet', {}).get('eng') or {}
    check(en.get('savedAt', 0) >= eo.get('savedAt', 0) and en.get('t', 0) >= eo.get('t', 0) and en.get('dog'), f"小狗引擎状态接着走（t {eo.get('t')} → {en.get('t')}，savedAt 只增不减）")
    strip = lambda st: {**st, 'pet': {k: v for k, v in st['pet'].items() if k != 'eng'}}
    fo, fn = flat(strip(old)), flat(strip(r['disk']))
    print('    逐字段不同（时间 / 金币类以外）：', [k for k in fo if k not in TIME | MONEY | GROW and fo[k] != fn.get(k)])
    d, newk = compare('v13→v14', strip(old), strip(r['disk']), r['secs'])
    check(not newk, f'v14 不往 v13 老档里加新字段 {newk}')
    check(r['disk'].get('zombie') == old['zombie'], f"打僵尸训练 / 通关 / 最佳原样：{r['disk'].get('zombie')}")
    check(r['disk'].get('pet', {}).get('home') == 'pearl' and r['disk']['pet'].get('owned'), f"小狗还在珍珠姐家 {r['disk'].get('pet', {}).get('home')}")
    check(r['keys'] == sorted([KEY, BAK]) or set(r['keys']) <= {KEY, BAK, 'tangzhe-tab-lock'}, f"v14 只用正式键 {r['keys']}")
    check(not any('preview' in k for k in r['keys']), 'v14 没写任何 tangzhe-preview* 键')
    bk = json.loads(r['bak']) if r['bak'] else {}
    check(bk.get('rev', -1) < r['disk']['rev'] and counts(bk) == counts(old), f"v14 写档前把上一份放进 -bak（rev {bk.get('rev')} < {r['disk']['rev']}）")
    cl = r['claim'] or {}
    check('post' in cl and not cl['post']['pend'] and cl['post']['c'] > cl['pre']['c'], f"v14 里点「直接领取」：v13 攒的离线收益到账、pending 清空 {str(cl)[:160]}")
    b.close()
print(f'v13 save → v14: {n[0] - len(fails)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
