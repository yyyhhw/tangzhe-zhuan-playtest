# 从 preview/ 生成 preview/pet/game/ 的快照副本 + 宠物钩子（可重跑；每处替换都断言命中次数）
import re, pathlib, sys
SRC = pathlib.Path(__file__).resolve().parents[3]; DST = SRC / 'pet' / 'game'; V = 'p6'
def rep(s, old, new, n=1):
    c = s.count(old); assert c == n, (old[:80], c); return s.replace(old, new)
base = (SRC / 'version.json').read_text().strip()
bv = re.search(r'"v"\s*:\s*"([^"]+)"', base).group(1)
if '--main' not in sys.argv:
    # ---------- economy.js：原样 ----------
    (DST / 'economy.js').write_text((SRC / 'economy.js').read_text())
    # ---------- style.css：原样（宠物样式另放 petgame.css） ----------
    (DST / 'style.css').write_text((SRC / 'style.css').read_text())
    # ---------- version.json ----------
    (DST / 'version.json').write_text('{"v":"%s"}\n' % V)
    # ---------- index.html ----------
    h = (SRC / 'index.html').read_text()
    h = rep(h, '<title>躺着也能赚（预览·未上线）</title>', f'<title>躺着也能赚（宠物 {V} 预览·未上线）</title>')
    h = rep(h, 'href="icon.svg"', 'href="../../icon.svg"')
    h = rep(h, 'href="apple-touch-icon.png"', 'href="../../apple-touch-icon.png"')
    h = rep(h, f'<link rel="stylesheet" href="style.css?v={bv}">', f'<link rel="stylesheet" href="style.css?v={V}">\n<link rel="stylesheet" href="petgame.css?v={V}">')
    h = rep(h, f"var B='{bv}'", f"var B='{V}'")
    h = rep(h, f'<script src="economy.js?v={bv}"></script>\n<script src="app.js?v={bv}"></script>',
            f'<script src="economy.js?v={V}"></script>\n<script src="../art.js?v={V}"></script>\n<script src="../puppy.js?v={V}"></script>\n<script src="../room.js?v={V}"></script>\n<script src="../engine.js?v={V}"></script>\n<script src="petgame.js?v={V}"></script>\n<script src="app.js?v={V}"></script>')
    h = h.replace('<head>', f'<head>\n<!-- 宠物 p5：预览 {bv} 的快照副本（../../ 是预览目录）+ 小狗接入。生成脚本见 README「p4」。 -->', 1)
    (DST / 'index.html').write_text(h)
# ---------- app.js ----------
def patch_app(a, main=False):
    """把宠物钩子打进预览 app.js。main=True：并进主预览本体（art/ 路径不改，宠物资源在 pet/ 下）"""
    if not main: a = a.replace('(() => {\n', f'/* 宠物 p5 副本：基于预览 {bv} 的 app.js，只加小狗钩子（搜「宠物 p4」）；存档键不变，小狗只占 state.pet 一个字段 */\n(() => {{\n', 1)
    if not main:
        a = rep(a, '`art/', '`../../art/', 5)
        a = rep(a, 'src="art/', 'src="../../art/', 2)
    # 12d 起读档走 E.loadSave（主档 → 备份 → 不保存模式），在返回读出的 state 前补 pet 字段校验
    a = rep(a, '  if (m.blocked) saveBlocked = true;\n  return m.st;\n', '  if (m.blocked) saveBlocked = true;\n  if (window.PetGame) PetGame.norm(m.st, E);   // 宠物 p4：没有 pet 字段 = 没买，旧档原样\n  return m.st;\n')
    a = rep(a, '  state.maxSeen = Math.max(state.maxSeen || 0, state.lastSeen);\n  state.rev++;\n', '  state.maxSeen = Math.max(state.maxSeen || 0, state.lastSeen);\n  petBeforePersist();   // 宠物 p4：小狗状态写进 state.pet.eng（同一份存档）\n  state.rev++;\n')
    a = rep(a, 'height:${sz.h / rows * 100}%;--fc:${f.color}">', 'height:${sz.h / rows * 100}%;--fc:${f.color};--fz:${10 + (p.y + sz.h) * 10}">')
    a = rep(a, "  const inv = Object.entries(E.furnInvOf(state)).filter(([, n]) => n > 0);\n  if (homeMode === 'decor') {", "  h += petRoomBar(id);\n  const inv = Object.entries(E.furnInvOf(state)).filter(([, n]) => n > 0);\n  if (homeMode === 'decor') {")
    a = rep(a, '  h += `<div class="mall-search">', '  h += petMallCard();\n  h += `<div class="mall-search">')
    a = rep(a, "    case 'homeUp': return confirmHomeUp(arg);\n", "    case 'homeUp': return confirmHomeUp(arg);\n    case 'homePetBuy': return confirmPetBuy(arg || homeWho);\n    case 'homePetMove': return petMoveHere(arg || homeWho);\n    case 'homePetCall': return petDo('call');\n    case 'homePetPat': return petDo('pet');\n    case 'homePetBall': return petDo('ball');\n")
    a = rep(a, '    e.preventDefault(); audioUnlock(); homeLiveTap(e); return;', '    e.preventDefault(); audioUnlock(); if (petTap(e)) return; homeLiveTap(e); return;')
    a = rep(a, '  if (dirty) renderTab();\n  saveAcc += dt;', '  if (dirty) renderTab();\n  petFrame(dt);   // 宠物 p4：小狗一直在过日子；在它家的生活页才画\n  saveAcc += dt;')
    a = rep(a, 'function onHide() { if (frozen) return; ', 'function onHide() { if (frozen) return; petHiddenAt = now(); ')
    a = rep(a, '  tick(); audioResume(); lastFrame = performance.now();\n}', '  tick(); audioResume(); lastFrame = performance.now(); petResume();\n}')
    glue = (pathlib.Path(__file__).with_name('glue.js')).read_text()
    if main: glue = rep(glue, "'../art/", "'pet/art/", 2)
    a = rep(a, 'function homeCommit(r, msg) {', glue + 'function homeCommit(r, msg) {')
    a = rep(a, 'boot();\n\n// 测试/调试钩子', 'boot();\npetInit();\n\n// 测试/调试钩子')
    a = rep(a, 'get canvasSize() { return { W, H }; }', 'get canvasSize() { return { W, H }; }, pet: petHooks')   # 12c1 起后面还有 lookOf 等钩子，只锚定这一项

    return a

MAIN = '--main' in sys.argv
a = (SRC / 'app.js').read_text()
if MAIN:
    # 12e：宠物并进主预览本体（preview/app.js + index.html 原地打钩子）；只能打一次
    assert 'petInit();' not in a, '主预览已经并过宠物'
    (SRC / 'app.js').write_text(patch_app(a, main=True))
    h = (SRC / 'index.html').read_text()
    h = rep(h, f'<link rel="stylesheet" href="style.css?v={bv}">', f'<link rel="stylesheet" href="style.css?v={bv}">\n<link rel="stylesheet" href="pet/game/petgame.css?v={bv}">')
    h = rep(h, f'<script src="app.js?v={bv}"></script>', f'<script src="pet/art.js?v={bv}"></script>\n<script src="pet/puppy.js?v={bv}"></script>\n<script src="pet/room.js?v={bv}"></script>\n<script src="pet/engine.js?v={bv}"></script>\n<script src="pet/game/petgame.js?v={bv}"></script>\n<script src="app.js?v={bv}"></script>')
    (SRC / 'index.html').write_text(h)
    print('ok merged into main preview', bv)
else:
    assert 'petInit();' not in a, '主预览已并入宠物：game/ 快照不再从主预览重生成（直接看 preview/ 本体）'
    (DST / 'app.js').write_text(patch_app(a))
    print('ok base', bv)
