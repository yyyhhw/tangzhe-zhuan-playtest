# v13 上线前：v12 老档原样保留（Playwright WebKit，iPhone 15）
# 用 v12 正式版代码（350eab7）真玩出一份存档（开店 / 升级 / 员工 / CEO / 盲盒 / 穿搭 / 升房 / 买家具摆家具 / 离线待领取），
# 原样放进 v13 的 tangzhe-save / -bak，打开 v13，逐项比对：金币不少、等级不降、家具件数 / 位置 / 朝向、穿搭、盲盒、成就都一样。
# 用法：v12 代码目录（git archive 350eab7）起静态服务 :49942；再 .pwvenv/bin/python test_v12_save_e2e.py [v13 URL] [v12 URL]
import sys, json, math
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49941/index.html'
V12 = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:49942/index.html'
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

with sync_playwright() as p:
    b = p.webkit.launch(); DEV = p.devices['iPhone 15']
    print('== A：v12 中后期老档（摆放都在 v13 禁区外）→ v13 逐项原样 ==')
    info, main, bak, e12 = make_v12(b, SC_A)
    old = json.loads(main)
    placed_ok = [x for x in info['out'] if not x.endswith(' ok')]
    check(not placed_ok and not e12 and old.get('pending') and old['pending'].get('amount', 0) > 0, f"v12 真玩出存档：{len(info['out'])} 件家具都摆上（失败：{placed_ok}）、盲盒 {info['own']} 件、店铺 {info['lv']}、CEO {info['ceo']}、家 {info['homes']}、离线待领取 {round((old.get('pending') or {}).get('amount', 0))}、v12 页面无报错 {e12[:2]}")
    check(old.get('v') == 3 and bak is None and 'coinFrac' not in old, f"v12 档格式：v=3、v12 不写 -bak（只有主档）、没有 coinFrac（金币 {old['coins']} 是小数，考 v13 的整数 / 零头拆分）")
    r = r_a = open_v13(b, main, bak)
    check(not r['errs'] and not r['bad'], f"v13 打开 v12 老档：无脚本报错 {r['errs'][:2]}、无 404 {r['bad'][:3]}")
    gain, newk = compare('A 读档后内存', old, r['mem'], r['secs'])
    check(gain <= 1e6, f'A：内存金币增量只是打开那几秒的在线收益（+{gain:.2f}）')
    gain2, _ = compare('A 写回磁盘', old, r['disk'], r['secs'])
    gain3, _ = compare('A 刷新再读', old, r['mem2'], r['secs'])
    check(counts(old) == counts(r['disk']) == counts(r['mem2']), f"A：每种家具件数（摆出 + 仓库）都一样 {sum(counts(old).values())} 件")
    check(json.dumps(old['homes'], sort_keys=True) == json.dumps(r['disk']['homes'], sort_keys=True) and old.get('furnInv') == r['disk'].get('furnInv'), 'A：四个家（等级 / 每件 uid、坐标、朝向、墙面地板）+ 公共仓库 JSON 完全一致')
    po, pn = old.get('pending') or {}, r['disk'].get('pending') or {}
    check(pn.get('id') == po.get('id') and pn.get('from') == po.get('from') and pn.get('cap') == po.get('cap') and pn.get('amount', 0) >= po.get('amount', 1), f"A：v12 的离线待领取原样留着（同一笔 id，{round(po['amount'])} → {round(pn.get('amount', 0))} 金币：只并进打开前后几秒）")
    cl = r['claim'] or {}
    ok_claim = 'post' in cl and cl['post']['pend'] is None and cl['post']['dpend'] is None and cl['pre']['amt'] - 1 <= cl['post']['c'] - cl['pre']['c'] <= cl['pre']['amt'] + 1e6 and abs(cl['post']['dc'] - cl['post']['c']) < 1e6 and cl['pre']['id'] in cl['post']['log']
    check(ok_claim, f"A：v13 里点「直接领取」：到账 ≈ 待领取 {round(cl.get('pre', {}).get('amt', 0))}（实际 +{round(cl['post']['c'] - cl['pre']['c']) if 'post' in cl else cl}），pending 清空、写盘、领取记录里有这笔 id")
    check([s['lv'] for s in old['shops']] == [s['lv'] for s in r['disk']['shops']] and [s['emp'] for s in old['shops']] == [s['emp'] for s in r['disk']['shops']] and {k: v['lv'] for k, v in old['ceos'].items()} == {k: v['lv'] for k, v in r['disk']['ceos'].items()},
          f"A：店铺 / 员工 / CEO 等级一个都没降（店 {[s['lv'] for s in r['disk']['shops']]}，CEO {[v['lv'] for v in r['disk']['ceos'].values()]}）")
    check(old['gacha'] == r['disk']['gacha'] and old['wear'] == r['disk']['wear'], f"A：盲盒 {len(old['gacha']['owned'])} 件 / 穿搭原样")
    check(sorted(r['keys']) == sorted([KEY, BAK, 'tangzhe-tab-lock']), f"A：localStorage 只有正式键 {r['keys']}（没有 tangzhe-preview-*、没加新键）")
    bk = json.loads(r['bak'] or 'null') or {}
    check(bk.get('coins') is not None and bk.get('rev', -1) < r['disk']['rev'] and counts(bk) == counts(old), f"A：v13 写档前把上一份放进 -bak（rev {bk.get('rev')} < {r['disk']['rev']}，家具件数同 v12）")
    check('pet' not in r['disk'] and 'zombie' not in r['disk'], 'A：没买狗 / 没玩打僵尸：v13 不往老档里塞 pet / zombie 字段')
    print('    v13 新增字段：', newk)
    check(set(newk) <= {'coinFrac', 'earnedFrac'}, f'A：v13 只新增金币零头字段 {newk}（12d 整数金币 + 零头拆分）')

    print('== B：v12 挂在 Lv2/Lv3 新底图窗户位置的画 → v13 挪到最近空墙，件数 / 金币不变 ==')
    info, main, bak, e12 = make_v12(b, SC_B, offline_h=0)
    old = json.loads(main)
    check(all(x.endswith(' ok') for x in info['out']), f"B：v12 里这几幅画都合法挂上 {info['out']}")
    r = open_v13(b, main, bak)
    check(not r['errs'], f"B：v13 无报错 {r['errs'][:2]}")
    compare('B 写回磁盘（家宅除外）', old, r['disk'], r['secs'], allow_home=('otaku', 'pearl', 'c77'))
    check(counts(old) == counts(r['disk']), f'B：每种家具件数守恒 {counts(old)} = {counts(r["disk"])}')
    ow = [p for p in r['disk']['homes']['otaku']['placed'] if p['fid'] == 'furn_painting']
    pw = [p for p in r['disk']['homes']['pearl']['placed'] if p['fid'] == 'furn_painting']
    cw = [p for p in r['disk']['homes']['c77']['placed'] if p['fid'] == 'furn_painting']
    check(cw and (cw[0]['x'], cw[0]['y']) == (0, 0), f'B：没踩禁区的画（77 家 0,0）原地不动 {cw}')
    check(all(p['surf'] == 'wall' for p in ow + pw) and len(ow) + len(pw) + r['disk']['furnInv'].get('furn_painting', 0) == 2 + old['furnInv'].get('furn_painting', 0),
          f"B：踩到新底图窗户的画挪到空墙 / 退仓库，不丢：阿宅 {[(p['x'], p['y']) for p in ow]}、珍珠 {[(p['x'], p['y']) for p in pw]}")
    print('== C：回退演练——v13 写过的档（含小狗 / 打僵尸字段）交回 v12 代码，金币 / 等级 / 家具不丢 ==')
    v13d = dict(r_a['disk']); v13d['pet'] = {'v': 1, 'owned': True, 'home': 'c77', 'boughtAt': v13d['lastSeen'], 'eng': None}
    v13d['zombie'] = {'v': 1, 'lv': {'atk': 2}, 'best': 3}
    ctx = b.new_context(**DEV); pg = ctx.new_page(); e12 = []; pg.on('pageerror', lambda e: e12.append(str(e)))
    pg.goto(blank(V12)); S(pg, f"localStorage.clear(); localStorage.setItem('{KEY}', {json.dumps(json.dumps(v13d))})")
    pg.goto(V12); pg.wait_for_function('window.__tzz && __tzz.state'); pg.wait_for_timeout(900)
    back = S(pg, 'JSON.parse(JSON.stringify(__tzz.state))'); pg.goto(blank(V12)); pg.wait_for_timeout(200)
    bdisk = json.loads(S(pg, f"localStorage.getItem('{KEY}')")); ctx.close()
    c13 = v13d['coins'] + (v13d.get('coinFrac') or 0)
    check(not e12 and back['coins'] >= c13 - 1 and [x['lv'] for x in back['shops']] == [x['lv'] for x in v13d['shops']] and {k: v['lv'] for k, v in back['ceos'].items()} == {k: v['lv'] for k, v in v13d['ceos'].items()} and counts(bdisk) == counts(v13d) and back['gacha'] == v13d['gacha'],
          f"C：回退到 v12 代码：金币（{round(c13)} → {round(back['coins'])}）/ 店铺 / CEO / 家具 {sum(counts(bdisk).values())} 件 / 盲盒都在，无报错 {e12[:2]}")
    lost = [k for k in ('pet', 'zombie', 'coinFrac', 'earnedFrac') if k in v13d and k not in bdisk]
    check(bdisk.get('pet') == v13d['pet'] and bdisk.get('zombie') == v13d['zombie'], f"C：v12 代码读写后存档里的 pet / zombie 字段原样留着（v12 不显示，但再上 v13 小狗和训练都还在；丢的字段：{lost}）")
    print(f"\nv12 save → v13: {n[0] - len(fails)} passed, {len(fails)} failed")
    b.close()
sys.exit(1 if fails else 0)
