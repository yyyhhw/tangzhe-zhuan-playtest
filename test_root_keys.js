// v13 正式站守门（Node）：node test_root_keys.js
// ① 根目录 app.js / 所有游戏代码里绝不出现预览专用键 tangzhe-preview-save* / tangzhe-preview-tab-lock
// ② 根 app.js 的存档键就是正式键 tangzhe-save / tangzhe-save-bak / tangzhe-tab-lock，不新增、不改名
// ③ 版本号一致：version.json = index.html 自检号 = 所有 ?v= 缓存号
// ④ 发布核对（预览还停在 12e2 时）：根目录代码 = 预览 12e2 换键 / 换版本号后的结果，一字不差
const fs = require('fs'), path = require('path');
const R = __dirname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const rd = (...p) => fs.readFileSync(path.join(R, ...p), 'utf8');

const app = rd('app.js');
ok(!/tangzhe-preview/.test(app), '根 app.js 里没有任何 tangzhe-preview*（含 tangzhe-preview-save / -bak / tangzhe-preview-tab-lock）');
ok(/const SAVE_KEY = 'tangzhe-save', BAK_KEY = 'tangzhe-save-bak', LOCK_KEY = 'tangzhe-tab-lock';/.test(app), '根 app.js 存档键 = tangzhe-save / tangzhe-save-bak / tangzhe-tab-lock');
const keys = [...new Set(app.match(/['"`]tangzhe-[a-z0-9-]+['"`]/g) || [])].sort();
ok(JSON.stringify(keys) === JSON.stringify(["'tangzhe-save'", "'tangzhe-save-bak'", "'tangzhe-tab-lock'"]), '根 app.js 只出现这三个存档键字面量：' + keys.join(','));
ok(!/tangzhe-pet-proto|tangzhe-zombie-proto/.test(app), '根 app.js 不碰宠物 / 打僵尸原型键');

// 根目录所有非测试的 js / html / css（含 pet/、zombie/），排除 preview/
const walk = (d) => fs.readdirSync(d, { withFileTypes:true }).flatMap(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return ['preview', '.git', '_shots', 'node_modules', '__pycache__'].includes(e.name) ? [] : walk(p);
  return /\.(js|html|css)$/.test(e.name) && !/^test_/.test(e.name) ? [p] : [];
});
const files = walk(R), dirty = files.filter(f => /['"`]tangzhe-preview-/.test(fs.readFileSync(f, 'utf8')));
ok(files.length > 10 && !dirty.length, `根目录 ${files.length} 个游戏文件都没有预览键字面量（有：${dirty.map(f => path.relative(R, f)).join('、') || '无'}）`);
const sets = files.filter(f => /localStorage\.setItem\(/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(R, f)).sort();
ok(JSON.stringify(sets) === JSON.stringify(['app.js', 'pet/main.js', 'zombie/zombie.js']), '只有 app.js（正式档）/ pet/main.js（原型键）/ zombie/zombie.js（原型键）写 localStorage：' + sets.join(','));
ok(/'tangzhe-pet-proto'/.test(rd('pet', 'main.js')) && /tangzhe-zombie-proto/.test(rd('zombie', 'zombie.js')), '宠物 / 打僵尸独立原型页只用自己的原型键');
ok(!fs.existsSync(path.join(R, 'pet', 'game', 'app.js')) && !fs.existsSync(path.join(R, 'pet', 'game', 'index.html')), '正式站不带宠物 12d3 快照页（旧代码不能写正式档）');

// 版本号
const V = JSON.parse(rd('version.json')).v, idx = rd('index.html');
ok(V === '13', 'version.json = 13（' + V + '）');
ok(idx.includes(`var B='${V}'`), 'index.html 自检号 = version.json');
const vs = [...idx.matchAll(/\?v=([^"'&]+)/g)].map(m => m[1]);
ok(vs.length === 10 && vs.every(v => v === V), `index.html 10 个资源缓存号都是 ${V}（${[...new Set(vs)].join(',')}）`);
ok(/<title>躺着也能赚<\/title>/.test(idx) && !/预览|未上线/.test(idx), 'index.html 标题是正式版（没有「预览·未上线」）');
ok(app.includes(`const ART_V = '${V}'`) && app.includes(`f.src = 'zombie/?embed=1&v=${V}'`), 'ART_V / 打僵尸 iframe 缓存号 = ' + V);
const zi = rd('zombie', 'index.html'), zv = [...zi.matchAll(/\?v=([^"'&]+)/g)].map(m => m[1]);
ok(idx.includes(`zombie/zbcore.js?v=${V}`) && zv.length === 3 && zv.every(v => v === V), `打僵尸父页面 / iframe 子页面引用同一个缓存号 ${V}（子页面：${zv.join(',')}）`);

// 发布核对：预览 12e2 → 根目录，只差换键 / 换版本号
let pv = null; try { pv = JSON.parse(rd('preview', 'version.json')).v; } catch (e) {}
if (pv === '12e2') {
  const K = s => s.replace(/tangzhe-preview-tab-lock/g, 'tangzhe-tab-lock').replace(/tangzhe-preview-save/g, 'tangzhe-save');
  const pa = K(rd('preview', 'app.js')).replace("const ART_V = '12b2',", "const ART_V = '13',").replace("const ART_ONE = { face_c77:'12d2' };", "const ART_ONE = {};   // v13：整体缓存号已换成 13，单图缓存号清空（机制保留）").replace("v=12e2'", "v=13'");
  ok(pa === app, '根 app.js = 预览 12e2 app.js（只换键 + ART_V/ART_ONE + iframe 缓存号）');
  const pi = rd('preview', 'index.html').replace('<title>躺着也能赚（预览·未上线）</title>', '<title>躺着也能赚</title>').replace(/12e2/g, '13');
  ok(pi === idx, '根 index.html = 预览 12e2 index.html（只换标题 + 版本号）');
  ok(rd('preview', 'zombie', 'index.html').replace(/\?v=z[0-9]/g, '?v=13') === zi, '根 zombie/index.html = 预览 12e2（只换缓存号）');
  const same = ['economy.js', 'style.css', 'sim.js', 'pet/art.js', 'pet/engine.js', 'pet/puppy.js', 'pet/room.js', 'pet/main.js', 'pet/pet.css', 'pet/index.html', 'pet/art/manifest.json',
    'pet/game/petgame.js', 'pet/game/petgame.css', 'zombie/zbcore.js', 'zombie/zombie.js', 'zombie/zombie.css'];
  const diff = same.filter(f => !fs.readFileSync(path.join(R, f)).equals(fs.readFileSync(path.join(R, 'preview', f))));
  ok(!diff.length, `其余 ${same.length} 个代码文件和预览 12e2 逐字节相同（不同：${diff.join('、') || '无'}）`);
  const art = fs.readdirSync(path.join(R, 'preview', 'art')).filter(f => !fs.readFileSync(path.join(R, 'art', f)).equals(fs.readFileSync(path.join(R, 'preview', 'art', f))));
  ok(!art.length, '预览 art/ 每张图都已原样进根目录 art/（不同：' + (art.join('、') || '无') + '）');
  const pat = fs.readdirSync(path.join(R, 'preview', 'pet', 'art')).filter(f => !fs.existsSync(path.join(R, 'pet', 'art', f)) || !fs.readFileSync(path.join(R, 'pet', 'art', f)).equals(fs.readFileSync(path.join(R, 'preview', 'pet', 'art', f))));
  ok(!pat.length, '小狗图集 / manifest 原样进根目录 pet/art/（不同：' + (pat.join('、') || '无') + '）');
} else console.log('  （预览已不是 12e2（' + pv + '），跳过发布核对）');

console.log(`root key guard: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
