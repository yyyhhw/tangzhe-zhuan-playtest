# 打僵尸 z1 原型回归（Playwright WebKit，模拟 iPhone）：python3 test_zombie_e2e.py [URL]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/zombie/'
OUT = '/home/ubuntu/qa/zombie'
fails, passes = [], 0
def check(ok, msg):
    global passes
    if ok: passes += 1
    else: fails.append(msg); print('FAIL', msg)
S = lambda pg, js: pg.evaluate(js)
DEV = {'iPhone SE': None, 'iPhone 15': None}
with sync_playwright() as p:
    b = p.webkit.launch(); print('webkit', b.version)
    devs = {'iPhone SE': p.devices['iPhone SE'], 'iPhone 15': p.devices['iPhone 15']}
    se3 = dict(p.devices['iPhone SE']); se3.update(viewport={'width': 375, 'height': 667}, screen={'width': 375, 'height': 667}, device_scale_factor=2); devs['SE3 375x667'] = se3
    for dn, dev in devs.items():
        tag = dn.replace(' ', '_')
        c = b.new_context(**dev); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.evaluate("localStorage.setItem('tangzhe-preview-save','SENTINEL');localStorage.setItem('tangzhe-save','SENTINEL2')"); pg.reload(); pg.wait_for_timeout(500)
        # 菜单 + 训练
        m = S(pg, "({menu:!document.getElementById('menu').classList.contains('hidden'), wallet:document.getElementById('walletTxt').textContent, rows:document.querySelectorAll('#train .tr').length, img:document.querySelector('.hero img').naturalWidth})")
        check(m['menu'] and m['rows'] == 4 and m['img'] > 0, f'{dn} 菜单显示：训练 4 项、77 头像加载 {m}')
        bal0 = S(pg, "__zb.Wallet.balance()"); cost = S(pg, "__zb.price(__zb.TRAIN[0],__zb.proto.lv.atk)")
        pg.locator('[data-tr="atk"]').tap(); pg.wait_for_timeout(150)
        t = S(pg, "({bal:__zb.Wallet.balance(), lv:__zb.proto.lv.atk, saved:JSON.parse(localStorage.getItem('tangzhe-zombie-proto'))})")
        check(t['lv'] == 1 and abs(t['bal'] - (bal0 - cost)) < 1e-6 and t['saved']['lv']['atk'] == 1, f'{dn} 训练升级：扣模拟币 {cost}、等级 +1 并保存到原型键 {t}')
        pg.screenshot(path=f'{OUT}/{tag}_menu.png')
        # 开局 + 实时操作
        pg.locator('#startBtn').tap(); pg.wait_for_timeout(300)
        g = S(pg, "({hud:!document.getElementById('hud').classList.contains('hidden'), hp:__zb.G.p.hp, x:__zb.G.p.x, y:__zb.G.p.y})")
        check(g['hud'] and g['hp'] > 0, f'{dn} 开局：HUD 显示、77 满血 {g}')
        vw, vh = dev['viewport']['width'], dev['viewport']['height']
        sx, sy = vw * 0.5, vh * 0.75
        pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + 60, sy, steps=4); pg.wait_for_timeout(700)
        moved = S(pg, "__zb.G.p.x"); pg.mouse.up()
        check(moved > g['x'] + 30, f'{dn} 拖动摇杆向右：77 右移 {g["x"]:.0f}→{moved:.0f}')
        pg.wait_for_timeout(3500)
        r = S(pg, "({t:__zb.G.t, zs:__zb.G.zs.length, kills:__zb.G.kills, bs:__zb.G.bs.length})")
        check(r['t'] > 3 and r['zs'] + r['kills'] > 0, f'{dn} 实时 4 秒：刷怪并自动出串 {r}')
        pg.screenshot(path=f'{OUT}/{tag}_play.png')
        # 暂停后固定步长推进（避免实时帧干扰）
        pg.locator('#pauseBtn').tap(); pg.wait_for_timeout(100)
        t1 = S(pg, "__zb.G.t"); pg.wait_for_timeout(500); t2 = S(pg, "__zb.G.t")
        check(t1 == t2 and S(pg, "!document.getElementById('pause').classList.contains('hidden')"), f'{dn} 暂停：计时停住 {t1}→{t2}')
        # 普攻扇形：3 根以上，角度对称
        fan = S(pg, """(()=>{const G=__zb.G; G.p.x=innerWidth/2-60; G.bs.length=0; G.zs.length=0; G.zs.push({type:'walker',x:G.p.x+120,y:G.p.y,r:13,hp:1e9,maxHp:1e9,sp:0,dmg:0,col:'#8fbf7a',flash:0,kx:0,ky:0,wob:0}); G.p.fireCd=0; __zb.step(0.016);
          const a=G.bs.map(b=>b.a); return {n:a.length, skew:G.skewers, mid:a.reduce((s,x)=>s+x,0)/a.length, spread:Math.max(...a)-Math.min(...a)};})()""")
        check(fan['n'] == fan['skew'] >= 3 and abs(fan['mid']) < 0.02 and fan['spread'] > 0.3, f'{dn} 普攻扇形飞串：根数 = 当前串数，朝最近僵尸居中展开 {fan}')
        # 大招：未充满不能放；充满后火圈伤害 + 推开
        u = S(pg, """(()=>{const G=__zb.G; __zb.setPause(false); G.ult=50; const a=__zb.castUlt(); G.ult=100; G.zs.length=0; G.bs.length=0;
          for(let i=0;i<8;i++){const ang=i/8*6.283; G.zs.push({type:'walker',x:G.p.x+Math.cos(ang)*60,y:G.p.y+Math.sin(ang)*60,r:13,hp:500,maxHp:500,sp:0,dmg:0,col:'#8fbf7a',flash:0,kx:0,ky:0,wob:0});}
          const b=__zb.castUlt(); const d0=G.zs.map(z=>Math.hypot(z.x-G.p.x,z.y-G.p.y)); G.p.fireCd=99; for(let i=0;i<60;i++) __zb.step(0.016);
          const hp=G.zs.slice(0,8).map(z=>z.hp), d1=G.zs.slice(0,8).map(z=>Math.hypot(z.x-G.p.x,z.y-G.p.y)); __zb.setPause(true);
          return {early:a, cast:b, ring:!!G.ring, ult:G.ult, hurt:hp.every(h=>h<500), pushed:d1.every((d,i)=>d>d0[i])};})()""")
        check(u['early'] is False and u['cast'] and u['ring'] and u['ult'] < 100 and u['hurt'] and u['pushed'], f'{dn} 火圈：能量不满放不出；满了放出后周围 8 只全部掉血并被推开 {u}')
        # 火圈结束
        e = S(pg, "(()=>{const G=__zb.G; for(let i=0;i<250;i++) __zb.step(0.016); return {ring:!!G.ring};})()")
        check(not e['ring'], f'{dn} 火圈 3.5 秒后结束 {e}')
        # 死亡：清空并贴脸
        d = S(pg, """(()=>{const G=__zb.G; G.zs.length=0; G.p.inv=0; G.p.hp=5; G.zs.push({type:'tank',x:G.p.x,y:G.p.y,r:21,hp:1e9,maxHp:1e9,sp:0,dmg:16,col:'#7f8fb8',flash:0,kx:0,ky:0,wob:0}); __zb.step(0.016);
          return {over:G.over, win:G.win, hp:G.p.hp, res:!document.getElementById('result').classList.contains('hidden'), txt:document.getElementById('resTitle').textContent};})()""")
        check(d['over'] and not d['win'] and d['hp'] == 0 and d['res'], f'{dn} 血量归零：结束、显示失败结算 {d}')
        RUN = """(async (n)=>{const G=__zb.G; let boss=false, bad=false, maxZ=0, t0=performance.now();
          for(let i=0;i<n*60 && !G.over;i++){ G.p.hp=G.p.maxHp; if(G.ult>=100) __zb.castUlt(); __zb.step(1/60); maxZ=Math.max(maxZ,G.zs.filter(z=>z.type!=='boss').length); if(G.zs.some(z=>z.type==='boss')) boss=true;
            if(!isFinite(G.p.x)||!isFinite(G.p.y)||G.zs.some(z=>!isFinite(z.x)||!isFinite(z.y)||!isFinite(z.hp))) {bad=true;break;} }
          for(let k=0;k<150&&G.over&&G.wait;k++) await new Promise(r=>setTimeout(r,20));
          return {mode:G.mode, n:G.n, over:G.over, win:G.win, t:G.t, kills:G.kills, boss, bad, maxZ, cleared:__zb.proto.cleared, again:document.getElementById('againBtn').textContent, title:document.getElementById('resTitle').textContent};})"""
        # 关卡：第 1 关 60 秒判胜，解锁第 2 关，「下一关」进入第 2 关
        pg.locator('#againBtn').tap(); pg.wait_for_timeout(100); pg.locator('#pauseBtn').tap()
        a = S(pg, RUN + "(100)")
        check(a['n'] == 1 and a['win'] and 59.9 <= a['t'] <= 60.1 and a['cleared'] == 1 and a['again'] == '下一关' and not a['boss'], f'{dn} 第 1 关 60 秒通关、解锁第 2 关、非 Boss 关无 Boss {a}')
        pg.locator('#againBtn').tap(); pg.wait_for_timeout(100)
        b2 = S(pg, "({n:__zb.G.n, mode:__zb.G.mode, dur:__zb.G.dur, lvl:document.getElementById('lvlTxt').textContent})")
        check(b2 == {'n': 2, 'mode': 'level', 'dur': 62, 'lvl': '第 2 关'}, f'{dn} 「下一关」进入第 2 关（62 秒）{b2}')
        lk = S(pg, """(()=>{__zb.setPause(true); const r={}; r.clamp=(__zb.start('level',5), __zb.G.n); r.endless=__zb.start('endless'); __zb.renderTrain();
          r.next=document.getElementById('lvNext').disabled; r.eb=document.getElementById('endlessBtn').disabled; return r;})()""")
        check(lk == {'clamp': 2, 'endless': False, 'next': True, 'eb': True}, f'{dn} 未解锁：跳关被限到第 2 关、无尽模式锁定 {lk}')
        # 第 50 关（Boss 关 150 秒）：120 秒出差评僵尸王、150 秒判胜、开放无尽
        S(pg, "(__zb.proto.cleared=49, __zb.start('level',50), __zb.setPause(true))")
        w = S(pg, RUN + "(200)")
        check(w['n'] == 50 and w['win'] and 149.9 <= w['t'] <= 150.1 and w['boss'] and not w['bad'] and w['maxZ'] <= 140 and w['cleared'] == 50 and w['again'] == '进入无尽', f'{dn} 第 50 关：Boss 出现、150 秒判胜、无 NaN、普通僵尸 ≤140、开放无尽 {w}')
        # 无尽：不按时间判胜，难度随时间涨，每 60 秒一个 Boss；手动退出结算并记最好成绩
        pg.locator('#againBtn').tap(); pg.wait_for_timeout(100); pg.locator('#pauseBtn').tap()
        en = S(pg, RUN + "(400)")
        S(pg, "(__zb.G.p.hp=1e9, __zb.setPause(false))"); pg.wait_for_timeout(150)
        en2 = S(pg, "({nb:__zb.G.nextBoss, clock:document.getElementById('clock').textContent, lvl:document.getElementById('lvlTxt').textContent})")
        check(en['mode'] == 'endless' and not en['over'] and en['t'] > 399 and not en['bad'] and en2['nb'] == 420 and en2['clock'] == '6:40' and en2['lvl'] == '无尽 难度 63', f'{dn} 无尽 400 秒：不结束、Boss 每 60 秒、计时正数、难度 63 {en} {en2}')
        pg.locator('#pauseBtn').tap(); pg.locator('#quitBtn').tap(); pg.wait_for_timeout(100)
        q = S(pg, "({title:document.getElementById('resTitle').textContent, best:JSON.parse(localStorage.getItem(__zb.PROTO_KEY)).endBest})")
        check(q['title'].startswith('无尽新纪录！') and q['best']['t'] > 399, f'{dn} 无尽手动退出：结算并保存最好成绩 {q}')
        # 性能：120 只同屏时单步模拟耗时
        pg.locator('#againBtn').tap(); pg.wait_for_timeout(100); pg.locator('#pauseBtn').tap()
        pf = S(pg, """(()=>{const G=__zb.G; G.t=120; for(let i=0;i<120;i++) G.zs.push({type:'walker',x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:13,hp:1e9,maxHp:1e9,sp:30,dmg:0,col:'#8fbf7a',flash:0,kx:0,ky:0,wob:0});
          G.p.hp=1e9; const t0=performance.now(); for(let i=0;i<120;i++) __zb.step(1/60); return (performance.now()-t0)/120;})()""")
        check(pf < 4, f'{dn} 性能：120 只同屏单步模拟 {pf:.2f}ms（<4ms）')
        S(pg, "__zb.setPause(false)"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/{tag}_crowd.png')
        # 存档隔离 + 坏档
        iso = S(pg, "({a:localStorage.getItem('tangzhe-preview-save'), b:localStorage.getItem('tangzhe-save'), keys:Object.keys(localStorage).sort()})")
        check(iso['a'] == 'SENTINEL' and iso['b'] == 'SENTINEL2' and iso['keys'] == sorted(['tangzhe-save', 'tangzhe-preview-save', 'tangzhe-zombie-proto', 'tangzhe-zombie-proto-top']), f'{dn} 存档隔离：经营正式 / 预览存档原样，只新增原型键 {iso}')
        pg.evaluate("localStorage.setItem('tangzhe-zombie-proto', JSON.stringify({coins:'abc', lv:{atk:-3, rate:1e9, hp:NaN, ult:'x'}, best:Infinity, cleared:1e9, endBest:{t:'x', kills:-5}})); localStorage.setItem('tangzhe-zombie-proto-top', JSON.stringify([{t:'x', id:'<b>'}, 5, null]))"); pg.reload(); pg.wait_for_timeout(400)
        bad = S(pg, "({c:__zb.proto.coins, lv:__zb.proto.lv, best:__zb.proto.best, cl:__zb.proto.cleared, eb:__zb.proto.endBest, w:document.getElementById('walletTxt').textContent})")
        check(bad['c'] == 5e10 and bad['lv'] == {'atk': 0, 'rate': 30, 'hp': 0, 'ult': 0} and bad['best'] == 0 and bad['cl'] == 50 and bad['eb'] == {'t': 0, 'kills': 0}, f'{dn} 坏档：非法字段回默认 / 截到范围，不报错 {bad}')
        # 上场角色：?ceo= 模拟烧烤店在任 CEO；技能没做的显示即将开放，没人在任提示去派人，两种都开不了局
        hero = lambda: S(pg, "({h: document.getElementById('heroName').textContent, n: document.getElementById('heroNote').textContent, s: document.getElementById('startBtn').disabled, e: document.getElementById('endlessBtn').disabled, img: document.querySelector('.hero img').getAttribute('src'), st: __zb.start('level', 1), g: !!__zb.G})")
        pg.goto(URL + '?ceo=pearl'); pg.wait_for_timeout(400); hp_ = hero()
        check(hp_['h'] == '珍珠姐 打僵尸' and '本局由 珍珠姐' in hp_['n'] and hp_['img'].endswith('face_pearl.webp') and hp_['g'] and S(pg, "__zb.G.ceo") == 'pearl', f'{dn} 珍珠姐在任：显示珍珠姐、可以开打 {hp_}')
        pk = S(pg, """(()=>{ const G = __zb.G; G.p.hp = 1e9; const k = new Set(); let bounced = 0;
          for (let i = 0; i < 600; i++) { __zb.step(1/30); for (const b of G.bs) { k.add(b.kind || 'skewer'); if (b.bounce < G.skewers - 1) bounced++; } }
          return { kinds: [...k], bounced, kills: G.kills, lbl: document.querySelector('#ultBtn .ult-lbl').textContent, desc: document.getElementById('heroDesc').textContent, skew: document.getElementById('skewTxt').textContent }; })()""")
        check(pk['kinds'] == ['pearl'] and pk['bounced'] > 0 and pk['kills'] > 0 and pk['lbl'] == '冰沙' and '珍珠' in pk['desc'] and '弹跳' in pk['skew'], f'{dn} 珍珠姐普攻：只出珍珠弹、打中会弹到下一只、能击倒 {pk}')
        pu = S(pg, """(()=>{ const G = __zb.G; G.ult = 100; const ok = __zb.castUlt(); __zb.step(0.05); const n = G.zs.length, fz = G.zs.filter(z => z.slow > 0).length;
          const x0 = new Map(G.zs.filter(z => z.type !== 'boss').map(z => [z, [z.x, z.y]])); __zb.step(0.2); const mv = G.zs.reduce((m, z) => x0.has(z) ? Math.max(m, Math.hypot(z.x - x0.get(z)[0], z.y - x0.get(z)[1])) : m, 0);
          const ring = !!G.ring; for (let i = 0; i < 100; i++) __zb.step(1/30); return { ok, n, fz, mv, ring, end: G.frost === null }; })()""")
        check(pu['ok'] and pu['n'] > 0 and pu['fz'] == pu['n'] and pu['mv'] < 6 and not pu['ring'] and pu['end'], f'{dn} 珍珠姐大招冰沙风暴：全屏冻住、僵尸几乎不动、不出火圈、3 秒后结束 {pu}')
        pg.screenshot(path=f'{OUT}/{tag}_pearl.png')
        for cid, nm, kind, lbl, key, eff in [('otaku', '阿宅店长', 'book', '分镜', 'panels', 'G.panels && G.panels.waves >= 2 && G.p.inv > 0'), ('rocket', '火箭老板', 'rocket', '星舰', 'wave', 'G.wave && G.wave.hit.size > 0')]:
            pg.goto(URL + f'?ceo={cid}'); pg.wait_for_timeout(400); hh = hero()
            check(hh['h'] == f'{nm} 打僵尸' and f'本局由 {nm}' in hh['n'] and hh['img'].endswith(f'face_{cid}.webp') and hh['g'] and S(pg, "__zb.G.ceo") == cid, f'{dn} {nm}在任：显示本人、可以开打 {hh}')
            pk = S(pg, """(()=>{ const G = __zb.G; G.p.hp = 1e9; const k = new Set();
              for (let i = 0; i < 600; i++) { __zb.step(1/30); for (const b of G.bs) k.add(b.kind || 'skewer'); }
              return { kinds: [...k], kills: G.kills, lbl: document.querySelector('#ultBtn .ult-lbl').textContent }; })()""")
            check(pk['kinds'] == [kind] and pk['kills'] > 0 and pk['lbl'] == lbl, f'{dn} {nm}普攻：只出{kind}、能击倒，大招按钮「{lbl}」 {pk}')
            pu = S(pg, f"""(()=>{{ const G = __zb.G; G.ult = 100; const ok = __zb.castUlt(); let eff = false;
              for (let i = 0; i < 24; i++) {{ __zb.step(1/30); eff = eff || !!({eff}); }}
              const ring = !!G.ring; for (let i = 0; i < 120; i++) __zb.step(1/30); return {{ ok, eff, ring, end: !G.{key}, again: G.ult < 100 }}; }})()""")
            check(pu['ok'] and pu['eff'] and not pu['ring'] and pu['end'], f'{dn} {nm}大招：生效、不出火圈、按时结束 {pu}')
            pg.screenshot(path=f'{OUT}/{tag}_{cid}.png')
        pg.goto(URL + '?ceo=nobody'); pg.wait_for_timeout(400); hn = hero()
        check('派' in hn['n'] and hn['s'] and hn['st'] is False and not hn['g'], f'{dn} 没人在任：提示回经营派 CEO，开不了局 {hn}')
        pg.goto(URL); pg.wait_for_timeout(400); h7 = S(pg, "({h: document.getElementById('heroName').textContent, s: document.getElementById('startBtn').disabled, c: __zb.proto.ceo})")
        check(h7['h'] == '77 打僵尸' and not h7['s'] and h7['c'] == 'c77', f'{dn} 不带 ceo 参数默认 77，可以开打 {h7}')
        check(not errs, f'{dn} 无页面脚本错误 {errs[:3]}')
        c.close()
    b.close()
print(f'passed {passes}, failed {len(fails)}')
sys.exit(1 if fails else 0)
