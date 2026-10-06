# 从 preview/ 生成 preview/pet/game/ 的快照副本 + 宠物钩子（可重跑；每处替换都断言命中次数）
import re, pathlib
SRC = pathlib.Path(__file__).resolve().parents[3]; DST = SRC / 'pet' / 'game'; V = 'p4b'
def rep(s, old, new, n=1):
    c = s.count(old); assert c == n, (old[:80], c); return s.replace(old, new)
base = (SRC / 'version.json').read_text().strip()
bv = re.search(r'"v"\s*:\s*"([^"]+)"', base).group(1)
# ---------- economy.js：原样 ----------
(DST / 'economy.js').write_text((SRC / 'economy.js').read_text())
# ---------- style.css：原样（宠物样式另放 petgame.css） ----------
(DST / 'style.css').write_text((SRC / 'style.css').read_text())
# ---------- version.json ----------
(DST / 'version.json').write_text('{"v":"%s"}\n' % V)
# ---------- index.html ----------
h = (SRC / 'index.html').read_text()
h = rep(h, '<title>躺着也能赚（预览·未上线）</title>', '<title>躺着也能赚（宠物 p4b 预览·未上线）</title>')
h = rep(h, 'href="icon.svg"', 'href="../../icon.svg"')
h = rep(h, 'href="apple-touch-icon.png"', 'href="../../apple-touch-icon.png"')
h = rep(h, f'<link rel="stylesheet" href="style.css?v={bv}">', f'<link rel="stylesheet" href="style.css?v={V}">\n<link rel="stylesheet" href="petgame.css?v={V}">')
h = rep(h, f"var B='{bv}'", f"var B='{V}'")
h = rep(h, f'<script src="economy.js?v={bv}"></script>\n<script src="app.js?v={bv}"></script>',
        f'<script src="economy.js?v={V}"></script>\n<script src="../art.js?v={V}"></script>\n<script src="../puppy.js?v={V}"></script>\n<script src="../room.js?v={V}"></script>\n<script src="../engine.js?v={V}"></script>\n<script src="petgame.js?v={V}"></script>\n<script src="app.js?v={V}"></script>')
h = h.replace('<head>', f'<head>\n<!-- 宠物 p4：预览 {bv} 的快照副本（../../ 是预览目录）+ 小狗接入。生成脚本见 README「p4」。 -->', 1)
(DST / 'index.html').write_text(h)
# ---------- app.js ----------
a = (SRC / 'app.js').read_text()
a = a.replace('(() => {\n', f'/* 宠物 p4 副本：基于预览 {bv} 的 app.js，只加小狗钩子（搜「宠物 p4」）；存档键不变，小狗只占 state.pet 一个字段 */\n(() => {{\n', 1)
a = rep(a, '`art/', '`../../art/', 4)
a = rep(a, 'src="art/', 'src="../../art/', 2)
a = rep(a, '  const m = E.migrate(raw, now());\n', '  const m = E.migrate(raw, now());\n  if (window.PetGame) PetGame.norm(m.st, E);   // 宠物 p4：没有 pet 字段 = 没买，旧档原样\n')
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
a = rep(a, 'function homeCommit(r, msg) {', glue + 'function homeCommit(r, msg) {')
a = rep(a, 'boot();\n\n// 测试/调试钩子', 'boot();\npetInit();\n\n// 测试/调试钩子')
a = rep(a, 'get canvasSize() { return { W, H }; }', 'get canvasSize() { return { W, H }; }, pet: petHooks')   # 12c1 起后面还有 lookOf 等钩子，只锚定这一项
(DST / 'app.js').write_text(a)
print('ok base', bv)
