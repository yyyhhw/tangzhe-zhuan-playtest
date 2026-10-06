// 生成占位美术 manifest（preview/pet/art/manifest.json）。真美术到位后：按同一份格式改 atlas.image / placeholder:false / 时长 / 嘴巴锚点即可，逻辑不用动。
// 用法：node tools/gen_manifest.js
const fs = require('fs'), path = require('path');
const CLIPS = [
  // [名字, 帧数, 每帧毫秒, 循环?, 朝向, 原地?]
  ['idle_E', 6, [220, 200, 200, 220, 200, 200], true, 'E', false],
  ['idle_N', 4, 240, true, 'N', false],
  ['idle_S', 4, 240, true, 'S', false],
  ['walk_E', 8, 100, true, 'E', false],
  ['walk_N', 8, 100, true, 'N', false],
  ['walk_S', 8, 100, true, 'S', false],
  ['run_E', 6, 70, true, 'E', false],
  ['run_N', 6, 70, true, 'N', false],
  ['run_S', 6, 70, true, 'S', false],
  ['attention', 4, [110, 150, 420, 200], false, 'E', true],
  ['sniff', 6, 180, false, 'E', true],
  ['hop', 8, 70, false, 'E', true],
  ['play', 8, 110, false, 'E', true],
  ['sleep', 6, 420, true, 'E', true],
  ['eat', 6, 170, false, 'E', true],
  ['petted', 6, 180, false, 'E', true],
  ['liedown', 4, 200, false, 'E', true],
  ['getup', 4, 180, false, 'E', true],
];
// 嘴巴锚点（源图 256×256 像素坐标，朝东画；西向自动镜像 x→256−x）
function mouth(name, i, n) {
  const p = n > 1 ? i / (n - 1) : 0, bob = (k) => Math.round(Math.sin(i / n * Math.PI * 2) * k);
  switch (name) {
    case 'idle_E': return [196, 150 + bob(1)];
    case 'idle_N': return [128, 112];
    case 'idle_S': return [128, 162 + bob(1)];
    case 'walk_E': return [198, 150 + bob(2)];
    case 'walk_N': return [128, 112 + bob(2)];
    case 'walk_S': return [128, 162 + bob(2)];
    case 'run_E': return [204, 154 + bob(4)];
    case 'run_N': return [128, 114 + bob(3)];
    case 'run_S': return [128, 164 + bob(3)];
    case 'attention': return [[196, 150], [194, 146], [190, 142], [192, 146]][i];
    case 'sniff': return [[196, 156], [194, 174], [192, 190], [192, 196], [192, 192], [194, 180]][i];
    case 'hop': return [198, 148];
    case 'play': return [[200, 186], [200, 190], [200, 186], [198, 176], [198, 168], [198, 176], [200, 186], [200, 190]][i];
    case 'sleep': return [184, 194];
    case 'eat': return [[194, 170], [192, 192], [192, 198], [192, 196], [192, 198], [194, 190]][i];
    case 'petted': return [196, 150 - Math.round(Math.sin(p * Math.PI) * 4)];
    case 'liedown': return [[196, 152], [194, 166], [190, 180], [184, 192]][i];
    case 'getup': return [[184, 192], [190, 178], [194, 162], [196, 150]][i];
  }
  return [196, 150];
}
const CELL = 128, COLS = 16, ROWS = 8;
let cell = 0;
const clips = {};
for (const [name, n, dur, loop, dir, inPlace] of CLIPS) {
  const frames = [];
  for (let i = 0; i < n; i++) frames.push({ cell: cell++, ms: Array.isArray(dur) ? dur[i] : dur, mouth: mouth(name, i, n) });
  clips[name] = { dir, loop, inPlace, frames };
}
const shadowCell = cell++;
const manifest = {
  schema: 'tangzhe-pet-art/1',
  name: '暖棕白小狗（占位）',
  placeholder: true,
  note: '占位：程序绘制的小狗。真美术到位时把 placeholder 改成 false、atlas.image 指向 2048×1024 图集，帧序 / 时长 / 锚点按实际改，逻辑代码不用动。',
  source: { frameSize: [256, 256], origin: [128, 208], perFrameCrop: false, shadow: 'separate' },
  runtime: { cellSize: CELL, origin: [64, 104], displayTiles: 1.8 },
  atlas: { image: null, size: [COLS * CELL, ROWS * CELL], cols: COLS, rows: ROWS },
  directions: { drawn: ['E', 'N', 'S'], mirror: { W: 'E' } },
  shadow: { cell: shadowCell, radius: [52, 13] },
  clips,
  actions: {
    pick_ball: { clip: 'sniff', frames: [0, 1, 2, 3], events: [{ frame: 3, name: 'ball_pick' }] },
    drop_ball: { clip: 'eat', frames: [0, 1, 2], events: [{ frame: 2, name: 'ball_drop' }] },
  },
};
const out = path.join(__dirname, '..', 'art', 'manifest.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 1) + '\n');
console.log('wrote', out, 'frames', cell - 1, '+ shadow cell', shadowCell);
