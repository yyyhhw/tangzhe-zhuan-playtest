# 真实父页补测（熊大 13j 复核要求的 4 项）：回执超时同 requestId 重试只扣一次、迟到回执、等回执时刷新的原子性、结算迟到同 runId 不重复记。
# 父页 app.js / persist / E.transact 都是真的；只在父页 MessagePort.prototype.postMessage 上「扣住」某类回执，模拟回执丢失或晚到。
# python3 preview/td/test_td_parent_late.py http://127.0.0.1:8765/preview/index.html   （WebKit 模拟 iPhone SE / 15，不算真机）
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/preview/index.html'
assert '/preview/' in URL, 'This integration test is preview-only'
KEY = 'tangzhe-preview-save'
passed = failed = 0
def check(ok, msg):
    global passed, failed
    if ok: passed += 1; print('PASS', msg)
    else: failed += 1; print('FAIL', msg)
INIT = """if (window === window.top) {
  window.requestAnimationFrame = () => 0;
  const op = MessagePort.prototype.postMessage;
  window.__hold = { kind: null, q: [] }; window.__acks = [];
  MessagePort.prototype.postMessage = function (d, ...r) {
    if (d && d.ack) { window.__port = this; window.__acks.push(JSON.parse(JSON.stringify(d))); }
    if (d && d.ack && d.ack === window.__hold.kind) { window.__hold.q.push([this, d]); return; }
    return op.call(this, d, ...r);
  };
  window.__releaseAt = i => { const [x] = window.__hold.q.splice(i, 1); op.call(x[0], x[1]); return x[1]; };
  window.__inject = d => op.call(window.__port, d);
  window.__release = () => { const q = window.__hold.q; window.__hold = { kind: null, q: [] }; q.forEach(([p, d]) => op.call(p, d)); return q.length; };
  window.__w = 0; const os = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === window.__failKey) throw Error('test write failure'); if (k === '%s') window.__w++; return os.call(this, k, v); };
} else {
  window.__rx = []; const od = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage');
  Object.defineProperty(MessagePort.prototype, 'onmessage', { configurable: true, get() { return od.get.call(this); },
    set(fn) { od.set.call(this, typeof fn === 'function' ? ev => { window.__rx.push(ev.data && ev.data.ack || null); return fn(ev); } : fn); } });
}""" % KEY
def child(pg):
    pg.wait_for_function("__tzz.tdOpen")
    for _ in range(400):
        for f in pg.frames:
            if '/td/index.html' in f.url:
                try:
                    if f.evaluate('!!(window.__td && __td.proto.ready)'): return f
                except Exception: pass
        pg.wait_for_timeout(50)
    diag = [(fr.url, fr.evaluate('JSON.stringify(window.__td ? {ready: __td.proto.ready, blocked: __td.proto.blocked} : null)') if '/td/' in fr.url else '') for fr in pg.frames]
    raise AssertionError('TD child did not initialize: ' + str(diag) + ' tdOpen=' + str(pg.evaluate('__tzz.tdOpen')))
def setup(pg):
    pg.goto(URL); pg.wait_for_function('!!window.__tzz')
    pg.evaluate("""() => { const t=__tzz, s=Economy.newState(Date.now()); s.rev=t.state.rev;
      s.coins=5e10; s.totalEarned=1; s.cur=3; s.muted=true; s.shops.forEach(x=>{x.open=true;x.lv=1;x.emp=0;});
      s.integrationSentinel={value:42}; t.state=s; t.closeModal(); t.persist(); t.switchShop(3); t.renderTab(); }""")
def disk(pg):
    return pg.evaluate("(k) => { const s = JSON.parse(localStorage.getItem(k)); return { coins: s.coins, rev: s.rev, td: s.td || null }; }", KEY)
def mem(pg):
    return pg.evaluate("() => ({ coins: __tzz.state.coins, rev: __tzz.state.rev, td: __tzz.state.td || null })")
def lv(x, id='bbq'): return ((x.get('td') or {}).get('lv') or {}).get(id, 0)
def cleared(x): return (x.get('td') or {}).get('cleared', 0)
def acks(pg, kind): return pg.evaluate("(k) => __acks.filter(a => a.ack === k)", kind)
def open_td(pg):
    pg.evaluate('__tzz.closeModal(); __tzz.openTD()'); return child(pg)
def wait_q(pg, f, n):
    try: pg.wait_for_function("__hold.q.length === %d" % n, polling=50, timeout=3000)   # 父页 rAF 被桩掉，必须定时轮询
    except Exception:
        print('DIAG', pg.evaluate("JSON.stringify({q: __hold.q.length, kind: __hold.kind, acks: __acks.slice(-3).map(a => ({ack: a.ack, ok: a.ok, dup: a.dup, why: a.why})), run: __tzz.tdRun, blocked: __tzz.saveBlocked})"),
              f.evaluate("JSON.stringify({sent: __td.lastSent, G: !!__td.G, pend: __td.pend, ready: __td.proto.ready, blocked: __td.proto.blocked, rx: __rx.slice(-3)})")); raise
def wait_rx(f, n0, kind):
    f.wait_for_function("(a) => __rx.slice(a[0]).includes(a[1])", arg=[n0, kind], polling=50, timeout=3000)
    return f.evaluate("(n) => __rx.slice(n)", n0)
def win_wave(f):
    f.evaluate('__td.G.wave=10;__td.G.q=[];__td.G.es=[];__td.step(.01)')

with sync_playwright() as p:
    browser = p.webkit.launch()
    for device in ['iPhone SE', 'iPhone 15']:
        c = browser.new_context(**p.devices[device]); errors = []
        c.add_init_script(INIT)
        pg = c.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
        setup(pg); f = open_td(pg)
        D = device + ' '

        # ① 购买回执超时 → 同一个 requestId 重试 → 只扣一次
        price = pg.evaluate("TDCore.price('bbq', 0)"); c0 = mem(pg)['coins']
        pg.evaluate("__hold.kind='buy'"); f.evaluate("__td.buyUp('bbq')")
        rid1 = f.evaluate('__td.lastSent.requestId')
        pg.wait_for_timeout(4400)
        check(f.locator('#buyRetryBtn').is_visible() and f.evaluate('__td.pend') and f.evaluate("document.querySelector('#startBtn').disabled"),
              D + '① 回执超时：出现「重试升级确认」，仍在等待，开局和其他升级都锁住')
        check(mem(pg)['coins'] == c0 - price and lv(mem(pg)) == 1 and disk(pg)['coins'] == c0 - price and lv(disk(pg)) == 1,
              D + '① 父页已一次性提交：扣 %d、bbq Lv1，内存和磁盘一致' % price)
        pg.evaluate("__hold.q=[]")   # 第一张回执彻底丢掉（模拟丢失），继续扣住重试那张
        f.locator('#buyRetryBtn').click(); wait_q(pg, f, 1)
        rid2 = f.evaluate('__td.lastSent.requestId')
        pg.evaluate("__release()"); f.wait_for_function('!__td.pend', timeout=3000)
        bacs = acks(pg, 'buy')
        check(rid1 == rid2 and rid1.startswith('b-'), D + '① 重试用的是同一个 requestId（%s）' % rid1)
        check(mem(pg)['coins'] == c0 - price and lv(mem(pg)) == 1 and disk(pg)['coins'] == c0 - price and lv(disk(pg)) == 1,
              D + '① 重试后仍只扣一次、只升一级（内存 + 磁盘）')
        check(len(bacs) >= 2 and bacs[-1].get('ok') is True and bacs[-1].get('dup') is True and bacs[-1].get('requestId') == rid1,
              D + '① 父页对重试回 ok + dup，回执带原 requestId')
        check(not f.locator('#buyRetryBtn').is_visible() and f.evaluate("__td.proto.lv.bbq") == 1, D + '① 子页收到确认：重试按钮消失，菜单显示 Lv1')

        # ② 迟到回执：超时后原回执晚到仍能确认；之后再来的旧回执（含状态快照）一律不理
        c1 = mem(pg)['coins']; price2 = pg.evaluate("TDCore.price('tea', 0)")
        pg.evaluate("__hold.kind='buy'"); f.evaluate("__td.buyUp('tea')"); rid3 = f.evaluate('__td.lastSent.requestId')
        pg.wait_for_timeout(4400)
        check(f.locator('#buyRetryBtn').is_visible(), D + '② 回执扣住 4 秒：子页显示超时可重试')
        late = pg.evaluate("JSON.parse(JSON.stringify(__hold.q.map(x => x[1])))")
        pg.evaluate("__release()"); f.wait_for_function('!__td.pend', timeout=3000)
        check(f.evaluate("__td.proto.lv.tea") == 1 and not f.locator('#buyRetryBtn').is_visible() and mem(pg)['coins'] == c1 - price2,
              D + '② 迟到的匹配回执仍能确认：tea Lv1，只扣一次 %d' % price2)
        coins_child = f.evaluate('__td.proto.coins')
        rx0 = f.evaluate('__rx.length')
        pg.evaluate("(m) => __inject(Object.assign({}, m, { coins: 1, z: Object.assign({}, m.z, { lv: Object.assign({}, m.z.lv, { tea: 9 }) }) }))", late[0])
        got = wait_rx(f, rx0, 'buy')
        check(f.evaluate('__td.proto.coins') == coins_child and f.evaluate('__td.proto.lv.tea') == 1 and got == ['buy'],
              D + '② 旧购买回执（带假余额和假等级）经父页真实 MessagePort 送达子页 port.onmessage，子页不理')
        rx1 = f.evaluate('__rx.length')
        pg.evaluate("(m) => __inject(Object.assign({}, m, { coins: 1, z: Object.assign({}, m.z, { lv: Object.assign({}, m.z.lv, { tea: 9 }) }) }))", late[0])
        got = wait_rx(f, rx1, 'buy')
        check(got == ['buy'] and f.evaluate('__td.proto.coins') == coins_child and f.evaluate('__td.proto.lv.tea') == 1 and not f.evaluate('__td.pend'),
              D + '② 同一张旧回执再注入一次（真实通道，带假余额和假等级）：子页不理，状态不变')
        # 开局回执迟到：超时回菜单，晚到的 ok 不能把这局复活；再开用新 runId
        pg.evaluate("__hold.kind='start'"); f.evaluate("__td.cmdSel='rocket';__td.start(1)"); r_old = f.evaluate('__td.G.runId')
        pg.wait_for_timeout(4400)
        check(f.evaluate('__td.G') is None, D + '② 开局回执 4 秒没到：回菜单（开局登记超时）')
        rxs = f.evaluate('__rx.length'); pg.evaluate("__release()"); wait_rx(f, rxs, 'start')
        check(f.evaluate('__td.G') is None, D + '② 迟到的开局 ok（子页已收到） 不会把这局复活')
        f.evaluate("__td.cmdSel='rocket';__td.start(1)"); f.wait_for_function('__td.G && !__td.G.pendStart', timeout=3000)
        r_new = f.evaluate('__td.G.runId')
        check(r_new != r_old and pg.evaluate('__tzz.tdRun.runId') == r_new, D + '② 再点开打用新 runId，父页登记的是新这局')
        f.evaluate('__td.setPause && __td.setPause(false)'); pg.evaluate('__tzz.closeTD()')

        # ③ 等回执期间刷新：父页提交要么整体生效要么整体没发生
        f = open_td(pg); c2 = mem(pg)['coins']; lv2 = lv(mem(pg), 'book'); price3 = pg.evaluate("TDCore.price('book', 0)")
        pg.evaluate("__hold.kind='buy'"); f.evaluate("__td.buyUp('book')"); wait_q(pg, f, 1)
        pre = disk(pg)
        check(pre['coins'] == c2 - price3 and lv(pre, 'book') == lv2 + 1, D + '③ 刷新前已确认：父页处理完（回执已生成并扣住），磁盘已有扣款和升级')
        pg.reload(); pg.wait_for_function('!!window.__tzz')
        m, d = mem(pg), disk(pg)
        check(m['coins'] == c2 - price3 and lv(m, 'book') == lv2 + 1 and d['coins'] == m['coins'] and lv(d, 'book') == lv(m, 'book'),
              D + '③ 父页已提交、回执没送到就刷新：刷新后扣款和升级都在，只算一次')
        f = open_td(pg); c3 = mem(pg)['coins']
        pg.evaluate("window.__failKey='%s'; __hold.kind='buy'" % KEY); f.evaluate("__td.buyUp('book')"); wait_q(pg, f, 1)
        check(pg.evaluate("__hold.q[0][1].ok") is not True, D + '③ 刷新前已确认：父页处理完，写档失败的回执不是 ok')
        pg.evaluate("window.__failKey=null")
        before = disk(pg); pg.reload(); pg.wait_for_function('!!window.__tzz'); m = mem(pg)
        check(m['coins'] == c3 and lv(m, 'book') == lv2 + 1 and before['coins'] == c3,
              D + '③ 写档失败、回执扣住时刷新：刷新后没扣款也没升级')
        f = open_td(pg); cl0 = cleared(mem(pg))
        pg.evaluate("__hold.kind='start'"); f.evaluate("__td.cmdSel='pearl';__td.start(1)")
        wait_q(pg, f, 1)
        check(pg.evaluate('!!__tzz.tdRun'), D + '③ 刷新前已确认：父页已处理开局（登记了这局，回执扣住）')
        pg.reload(); pg.wait_for_function('!!window.__tzz')
        check(pg.evaluate('__tzz.tdRun') is None and cleared(mem(pg)) == cl0, D + '③ 开局回执没到就刷新：父页没有残留的登记，进度不变')

        # ④ 结算回执迟到：同一个 runId 重试不重复记，晚到的原回执也不改结果
        f = open_td(pg); cl1 = cleared(mem(pg)); best1 = (mem(pg)['td'] or {}).get('best', 0)
        f.evaluate("__td.cmdSel='otaku';__td.start(%d)" % (cl1 + 1)); f.wait_for_function('__td.G && !__td.G.pendStart', timeout=3000)
        run = f.evaluate('__td.G.runId')
        pg.evaluate("__hold.kind='result'"); win_wave(f); wait_q(pg, f, 1)
        w0 = pg.evaluate('__w'); d0 = disk(pg)
        check(cleared(d0) == cl1 + 1 and cleared(mem(pg)) == cl1 + 1, D + '④ 父页已记下过关（cleared %d → %d），回执被扣住' % (cl1, cl1 + 1))
        pg.wait_for_timeout(4200)
        check(f.locator('#retryBtn').is_visible() and not f.evaluate('__td.G.saveOk'), D + '④ 结算回执 4 秒没到：子页显示「重试保存」')
        pg.evaluate("__hold.kind='result'")   # 原回执继续扣着，重试那张也先扣
        f.locator('#retryBtn').click(); wait_q(pg, f, 2)
        check(f.evaluate('__td.lastSent.runId') == run and pg.evaluate('__w') == w0 and disk(pg) == d0,
              D + '④ 重试用同一个 runId，父页没再写档（写入次数和磁盘都不变）')
        first = pg.evaluate("__releaseAt(1)"); f.wait_for_function('__td.G.saveOk', timeout=3000)
        check(first.get('ok') is True and first.get('dup') is True and first.get('runId') == run and cleared(mem(pg)) == cl1 + 1 and cleared(disk(pg)) == cl1 + 1 and pg.evaluate('__w') == w0,
              D + '④ 重试的 dup 回执先到：子页确认守住，cleared 仍是 %d，没有重复记' % (cl1 + 1))
        rx4 = f.evaluate('__rx.length'); n = pg.evaluate('__release()'); got = wait_rx(f, rx4, 'result')
        check(n == 1 and 'result' in got and f.evaluate('__td.G.saveOk') and cleared(mem(pg)) == cl1 + 1 and cleared(disk(pg)) == cl1 + 1 and pg.evaluate('__w') == w0,
              D + '④ 原回执后到（子页已收到 result）：子页结果不变，cleared 仍是 %d，父页没再写档' % (cl1 + 1))
        check(f.evaluate("document.querySelector('#resTitle').textContent") == '守住了！', D + '④ 结算页显示「守住了！」')
        check(pg.evaluate('__tzz.state.integrationSentinel.value') == 42 and pg.evaluate("localStorage.getItem('tangzhe-td-proto')") is None,
              D + '无关字段不变，嵌入时不建原型存档')
        # ⑤ 购买重试的 dup 回执先到、原回执后到：只扣一次、只升一级，后到的原回执不改状态
        pg.evaluate('__tzz.closeTD()'); f = open_td(pg); c5 = mem(pg)['coins']; price5 = pg.evaluate("TDCore.price('tech', 0)")
        pg.evaluate("__hold.kind='buy'"); f.evaluate("__td.buyUp('tech')"); rid5 = f.evaluate('__td.lastSent.requestId')
        pg.wait_for_timeout(4400); f.locator('#buyRetryBtn').click(); wait_q(pg, f, 2)
        first = pg.evaluate("__releaseAt(1)"); f.wait_for_function('!__td.pend', timeout=3000)
        check(first.get('dup') is True and first.get('requestId') == rid5 and f.evaluate('__td.proto.lv.tech') == 1 and mem(pg)['coins'] == c5 - price5 and disk(pg)['coins'] == c5 - price5 and lv(disk(pg), 'tech') == 1,
              D + '⑤ 购买重试的 dup 回执先到：子页确认 tech Lv1，只扣一次 %d（内存 + 磁盘）' % price5)
        coins5 = f.evaluate('__td.proto.coins'); rx5 = f.evaluate('__rx.length'); n = pg.evaluate('__release()'); got = wait_rx(f, rx5, 'buy')
        check(n == 1 and 'buy' in got and f.evaluate('__td.proto.lv.tech') == 1 and f.evaluate('__td.proto.coins') == coins5 and not f.evaluate('__td.pend') and mem(pg)['coins'] == c5 - price5 and lv(disk(pg), 'tech') == 1,
              D + '⑤ 原回执后到（子页已收到 buy）：子页不理，等级和余额不变')
        check(not errors, D + 'no page errors: ' + str(errors))
        c.close()
    browser.close()
print('TD 真实父页补测（WebKit 模拟）：%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
