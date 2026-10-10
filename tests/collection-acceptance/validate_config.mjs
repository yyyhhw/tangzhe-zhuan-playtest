// 拍板后配置自检：node tests/collection-acceptance/validate_config.mjs <config.json>（需 SKELETON_DIR=骨架解压目录）
// 只调用骨架 src/config.mjs 的 validateConfig；不写任何存档，也不代替批准记录（admitIntegrationConfig）。
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const dir = process.env.SKELETON_DIR, file = process.argv[2];
if (!dir || !file) { console.log('✗ 用法：SKELETON_DIR=<骨架目录> node validate_config.mjs <config.json>'); process.exit(2); }
const { validateConfig } = await import(pathToFileURL(path.join(dir, 'src/config.mjs')).href);
try {
  const c = validateConfig(JSON.parse(fs.readFileSync(file, 'utf8')));
  const n = {}; for (const p of c.pool) n[p.rarity] = (n[p.rarity] || 0) + 1;
  console.log(`✓ validateConfig 通过 configVersion=${c.configVersion} poolVersion=${c.poolVersion} purpose=${c.purpose} pool=${c.pool.length} ${JSON.stringify(n)} dustBalanceCap=${c.dustBalanceCap}`);
  const R = c.rarities || [], maxGild = Math.max(...R.map(r => r.gildDustCost)), maxDup = Math.max(...R.map(r => r.duplicateDust));
  const bad = [[c.dustBalanceCap >= maxGild, `粉尘上限 ${c.dustBalanceCap} < 最高镀金价 ${maxGild}，永远镀不起`], [c.dustBalanceCap >= maxDup, `粉尘上限 ${c.dustBalanceCap} < 单张最高重复粉尘 ${maxDup}`]].filter(x => !x[0]);
  for (const [, m] of bad) console.log('✗ 交叉检查（validateConfig 不拦）：' + m);
  if (bad.length) process.exit(1);
} catch (e) { console.log('✗ validateConfig 拒绝：' + (e.code || e.message)); process.exit(1); }
