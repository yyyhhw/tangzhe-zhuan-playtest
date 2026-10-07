# 预览 13h（杨总 11:30「经营优先」）：店铺页小游戏入口放到最下面（CEO 任职 / 调离区块之后），顶部不再有大入口
# Playwright WebKit 模拟：iPhone SE / iPhone 15（不是真机）
# 验：① 烧烤摊入口是店铺页最后一块，排在 CEO 区块（调任 / 派 CEO 按钮）之后；概况下面紧接「店铺」，中间没有小游戏
#    ② 没 CEO 时「先派 CEO」入口同样在最底下 ③ 其他店没入口 ④ 滚到底点「去打」能开局 ⑤ 点「返回经营」后浮层关闭、还停在原来的滚动位置、入口仍在眼前
# 用法：.pwvenv/bin/python preview/test_shop_game_bottom_13h.py [预览 URL]
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:49951/preview/index.html'
fails, passes = [], [0]
def check(ok, msg):
    if ok: passes[0] += 1; print('  ✓', msg)
    else: fails.append(msg); print('  ✗ FAIL', msg)
S = lambda f, js: f.evaluate(js)
def zframe(pg):
    for _ in range(80):
        for f in pg.frames:
            if '/zombie/' in f.url:
                try:
                    if f.evaluate("!!(window.__zb && __zb.proto.ready)"): return f
                except Exception: pass
        pg.wait_for_timeout(100)
    return None
ORDER = """(()=>{const body=document.querySelector('.zb-card') && document.querySelector('.zb-card').parentElement; if(!body) return null;
  const kids=[...body.children], zi=kids.indexOf(document.querySelector('.zb-card'));
  const ceoT=kids.findIndex(e=>e.classList.contains('sec-title')&&e.textContent.trim()==='CEO');
  const shopH=kids.findIndex(e=>e.classList.contains('row-head'));
  const sum=kids.findIndex(e=>e.classList.contains('summary'));
  const ceoBtn=kids.findIndex(e=>e.querySelector&&e.querySelector('[data-act=assignTo]'));
  const gt=kids[zi-1];
  return {zi, last: zi===kids.length-1, ceoT, ceoBtn, shopH, sum, title: gt&&gt.classList.contains('sec-title')?gt.textContent.trim():null, nGame: document.querySelectorAll('.zb-card').length};})()"""
with sync_playwright() as p:
    b = p.webkit.launch(); print('webkit', b.version)
    for dn in ['iPhone SE', 'iPhone 15']:
        print(f'== {dn} ==')
        c = b.new_context(**p.devices[dn]); pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL.split('?')[0].rsplit('/', 1)[0] + '/version.json'); S(pg, "localStorage.clear()")
        pg.goto(URL); pg.wait_for_function("window.__tzz && __tzz.state", timeout=20000); pg.wait_for_timeout(500)
        S(pg, "__tzz.closeModal && __tzz.closeModal(); (()=>{const s=__tzz.state; s.coins=5e10; s.coinFrac=0; __tzz.persist();})(); __tzz.setTab('shop'); __tzz.switchShop(0); __tzz.renderTab()"); pg.wait_for_timeout(300)
        o = S(pg, ORDER)
        check(o and o['nGame'] == 1 and o['last'] and o['ceoT'] >= 0 and o['ceoBtn'] > o['ceoT'] and o['zi'] > o['ceoBtn'], f'{dn} ① 入口是店铺页最后一块、在 CEO 任职 / 调离区块之后 {o}')
        check(o and o['sum'] >= 0 and o['shopH'] == o['sum'] + 1 and o['zi'] > o['shopH'], f'{dn} ① 顶部概况下面直接是「店铺」，没有小游戏大入口')
        check(o and o['title'] == '小游戏', f'{dn} ① 入口上面有「小游戏」小标题')
        # ④⑤ 滚到底 → 去打 → 开局 → 返回经营
        S(pg, "(()=>{const pn=document.getElementById('panel'); pn.scrollTop=pn.scrollHeight;})()"); pg.wait_for_timeout(200)
        y0 = S(pg, "document.getElementById('panel').scrollTop")
        btn = pg.locator('.zb-card [data-act=zombie]')
        inview = S(pg, "(()=>{const r=document.querySelector('.zb-card').getBoundingClientRect(), pr=document.getElementById('panel').getBoundingClientRect(); return r.top>=pr.top-1 && r.bottom<=pr.bottom+1;})()")
        check(y0 > 0 and inview, f'{dn} 滚到底能看到入口（scrollTop={y0}）')
        btn.tap(); f = zframe(pg)
        check(f is not None and S(pg, "!document.getElementById('zbOverlay').classList.contains('hidden')"), f'{dn} ④ 点「去打」打开小游戏')
        if f:
            S(f, "__zb.start('level', 1)"); pg.wait_for_timeout(300)
            r0 = S(pg, "(()=>{const r=__tzz.zbRun; return r && {ceoId:r.ceoId, settled:!!r.settled};})()")
            check(S(f, "!!(__zb.G && !__zb.G.over)") and r0 and r0['ceoId'] == 'c77' and not r0['settled'], f'{dn} ④ 能正常开打（父页已登记 {r0}）')
            S(f, "__zb.G.p.hp = 1e9; __zb.G.t = __zb.G.dur - 0.01; __zb.step(0.05)"); pg.wait_for_timeout(400)
            S(f, "document.getElementById('exitBtn').classList.remove('hidden'); document.getElementById('exitBtn').click()"); pg.wait_for_timeout(500)
        hid = S(pg, "document.getElementById('zbOverlay').classList.contains('hidden')")
        y1 = S(pg, "document.getElementById('panel').scrollTop")
        inview = S(pg, "(()=>{const c=document.querySelector('.zb-card'); if(!c) return false; const r=c.getBoundingClientRect(), pr=document.getElementById('panel').getBoundingClientRect(); return r.height>0 && r.top>=pr.top-1 && r.bottom<=pr.bottom+1;})()")
        check(hid and abs(y1 - y0) <= 2 and inview and S(pg, "__tzz.state.cur") == 0, f'{dn} ⑤ 返回经营：浮层关了、还在烧烤摊原位置（scrollTop {y0} → {y1}），入口仍在眼前')
        pg.screenshot(path=f'/tmp/r13h/{dn.replace(" ", "_")}_bottom.png')
        # ② 没 CEO
        S(pg, "(()=>{const s=__tzz.state; __tzz.E.unassignCeo ? __tzz.E.unassignCeo(s,'c77') : (s.ceos.c77.at=-1); __tzz.persist(); __tzz.renderTab();})()"); pg.wait_for_timeout(250)
        o2 = S(pg, ORDER); a = S(pg, "(()=>{const b=document.querySelector('.zb-card button[data-act]'); return b && b.dataset.act;})()")
        check(o2 and o2['last'] and a == 'zbAssign' and o2['zi'] > o2['ceoT'], f'{dn} ② 没 CEO：「先派 CEO」入口也在最底下 {o2} {a}')
        # ③ 其他店
        S(pg, "(()=>{const s=__tzz.state,E=__tzz.E; E.openShop(s,1); E.checkUnlocks(s); __tzz.persist(); __tzz.closeModal&&__tzz.closeModal(); __tzz.switchShop(1); __tzz.setTab('shop'); __tzz.renderTab();})()"); pg.wait_for_timeout(250)
        check(S(pg, "__tzz.state.cur===1 && !document.querySelector('.zb-card') && !document.querySelector('.shop-game-title')"), f'{dn} ③ 奶茶店没有打僵尸入口，也没有空的「小游戏」标题')
        check(not errs, f'{dn} 没有页面报错 {errs[:3]}')
        c.close()
    b.close()
print(f'\n{passes[0]} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
