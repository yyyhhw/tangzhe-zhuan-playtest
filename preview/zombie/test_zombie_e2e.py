# 打僵尸 z1 原型回归（Playwright WebKit，模拟 iPhone）：python3 test_zombie_e2e.py [URL]
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/preview/zombie/'
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
        pg.goto(URL); pg.evaluate("localStorage.setItem('tangzhe-save','SENTINEL');localStorage.setItem('tangzhe-preview-save','SENTINEL2')"); pg.reload(); pg.wait_for_timeout(500)
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
        # 整局 3 分钟（固定步长，无敌模拟自动打）：Boss 在 150 秒出现，180 秒判胜，无 NaN
        pg.locator('#againBtn').tap(); pg.wait_for_timeout(100); pg.locator('#pauseBtn').tap()
        w = S(pg, """(()=>{const G=__zb.G; let boss=false, bad=false, maxZ=0, t0=performance.now();
          for(let i=0;i<200*60 && !G.over;i++){ G.p.hp=G.p.maxHp; if(G.ult>=100) __zb.castUlt(); __zb.step(1/60); maxZ=Math.max(maxZ,G.zs.filter(z=>z.type!=='boss').length); if(G.zs.some(z=>z.type==='boss')) boss=true;
            if(!isFinite(G.p.x)||!isFinite(G.p.y)||G.zs.some(z=>!isFinite(z.x)||!isFinite(z.y)||!isFinite(z.hp))) {bad=true;break;} }
          return {over:G.over, win:G.win, t:G.t, kills:G.kills, boss, bad, maxZ, skew:G.skewers, ms:(performance.now()-t0)/(G.t*60)};})()""")
        check(w['over'] and w['win'] and 179.9 <= w['t'] <= 180.1 and w['boss'] and not w['bad'] and w['maxZ'] <= 140, f'{dn} 整局：150 秒出差评僵尸王、180 秒判胜、无 NaN、普通僵尸同屏 ≤140 {w}')
        # 性能：120 只同屏时单步模拟耗时
        pg.locator('#againBtn').tap(); pg.wait_for_timeout(100); pg.locator('#pauseBtn').tap()
        pf = S(pg, """(()=>{const G=__zb.G; G.t=120; for(let i=0;i<120;i++) G.zs.push({type:'walker',x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:13,hp:1e9,maxHp:1e9,sp:30,dmg:0,col:'#8fbf7a',flash:0,kx:0,ky:0,wob:0});
          G.p.hp=1e9; const t0=performance.now(); for(let i=0;i<120;i++) __zb.step(1/60); return (performance.now()-t0)/120;})()""")
        check(pf < 4, f'{dn} 性能：120 只同屏单步模拟 {pf:.2f}ms（<4ms）')
        S(pg, "__zb.setPause(false)"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/{tag}_crowd.png')
        # 存档隔离 + 坏档
        iso = S(pg, "({a:localStorage.getItem('tangzhe-save'), b:localStorage.getItem('tangzhe-preview-save'), keys:Object.keys(localStorage).sort()})")
        check(iso['a'] == 'SENTINEL' and iso['b'] == 'SENTINEL2' and iso['keys'] == ['tangzhe-preview-save', 'tangzhe-save', 'tangzhe-zombie-proto'], f'{dn} 存档隔离：经营正式 / 预览存档原样，只新增原型键 {iso}')
        pg.evaluate("localStorage.setItem('tangzhe-zombie-proto', JSON.stringify({coins:'abc', lv:{atk:-3, rate:1e9, hp:NaN, ult:'x'}, best:Infinity}))"); pg.reload(); pg.wait_for_timeout(400)
        bad = S(pg, "({c:__zb.proto.coins, lv:__zb.proto.lv, best:__zb.proto.best, w:document.getElementById('walletTxt').textContent})")
        check(bad['c'] == 5e10 and bad['lv'] == {'atk': 0, 'rate': 30, 'hp': 0, 'ult': 0} and bad['best'] == 0, f'{dn} 坏档：非法字段回默认 / 截到范围，不报错 {bad}')
        check(not errs, f'{dn} 无页面脚本错误 {errs[:3]}')
        c.close()
    b.close()
print(f'passed {passes}, failed {len(fails)}')
sys.exit(1 if fails else 0)
