#!/usr/bin/env python3
"""p5：由 build_atlas.py 量出的 art/puppy_atlas_v3.json 生成 art/manifest.json（真图集版）。
用法：python3 tools/gen_manifest_v3.py   （在 preview/pet 下）
- 帧序 / 格号 / 时长 = 熊大 v3 包 proposedP3Cell / p3TimingMs（和 p3 合同一一对应）。
- body = 108 帧真图逐帧 alpha>8 横向范围按朝向取并集（概念 256 坐标）；纵深仍是引擎的 ±0.22，和图高无关。
- displayTiles 1.15（待熊大定最终大小）：真图南向站姿左右半宽 82 / 78 px，引擎网格节点在格内 0.375 / 0.625 处，
  要让「1 格宽竖缝能走、只空 1 格也站得下」（p4 的行为合同）就得半宽 ≤ 0.375 格 → displayTiles ≤ 0.375×256/82 ≈ 1.17，取 1.15。
  这时东向身长 1.01 格、站高约 0.72 格（占位是身长 1.20 格）。
- 嘴巴点（只用来画叼着的球，引擎不用）：walk / run 的 E/S 用熊大 sidecar 目测点；其余东向帧 = 真图鼻尖 + sidecar 平均偏移 (−6.7, +14.3)；
  idle_S 用 walk/run_S sidecar 平均 (128, 112)；N 向全部 null + mouthHidden（被头挡住，叼球时不画球，叼球状态照常）。"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, '..', 'art')
A = json.load(open(os.path.join(ART, 'puppy_atlas_v3.json')))
F = {int(k): v for k, v in A['frames'].items()}
SIDE = A['sidecar']
OFF = (-6.7, 14.3)
CLIPS = [('idle_E', True, False), ('idle_N', True, False), ('idle_S', True, False), ('walk_E', True, False), ('walk_N', True, False), ('walk_S', True, False),
         ('run_E', True, False), ('run_N', True, False), ('run_S', True, False), ('attention', False, True), ('sniff', False, True), ('hop', False, True),
         ('play', False, True), ('sleep', True, True), ('eat', False, True), ('petted', False, True), ('liedown', False, True), ('getup', False, True)]
r1 = lambda v: round(v, 1)
clips, src = {}, {'sidecar': 0, 'noseTip': 0, 'idleS': 0, 'hidden': 0}
body = {'E': [256, 0], 'N': [256, 0], 'S': [256, 0]}
for name, loop, inplace in CLIPS:
    frs = sorted([(c, f) for c, f in F.items() if f['clip'] == name], key=lambda x: x[1]['index'])
    d = frs[0][1]['dir']; out = []
    for cell, f in frs:
        b = body[d]; b[0] = min(b[0], f['alphaX'][0]); b[1] = max(b[1], f['alphaX'][1])
        s = SIDE.get(f'{name}#{f["index"]}')
        if d == 'N':
            fr = {'cell': cell, 'ms': f['ms'], 'mouth': None, 'mouthHidden': True}; src['hidden'] += 1
        elif s and s['mouth']:
            fr = {'cell': cell, 'ms': f['ms'], 'mouth': [r1(s['mouth'][0]), r1(s['mouth'][1])], 'mouthSrc': 'sidecar'}; src['sidecar'] += 1
        elif d == 'E':
            fr = {'cell': cell, 'ms': f['ms'], 'mouth': [r1(f['noseTip'][0] + OFF[0]), r1(f['noseTip'][1] + OFF[1])], 'mouthSrc': 'noseTip'}; src['noseTip'] += 1
        else:
            fr = {'cell': cell, 'ms': f['ms'], 'mouth': [128, 112], 'mouthSrc': 'idleS'}; src['idleS'] += 1
        out.append(fr)
    c = {'dir': d, 'loop': loop, 'inPlace': inplace, 'frames': out}
    if name == 'hop': c['bakedLift'] = True     # 真图腾空帧已画好离地（虚拟地面），引擎不再额外抬高，避免跳两次
    clips[name] = c
m = {
    'schema': 'tangzhe-pet-art/1', 'name': '暖棕白小狗（熊大 v3 候选图）', 'placeholder': False,
    'note': 'p5：熊大 v3 候选包（home-transfer-20261006 3fb4756 batch3_puppy，native zip sha256 40fe9351…）烘成的图集。仍是候选：嘴巴点是目测 / 推算，N 向嘴巴被挡（null），落地点近似。重新生成：tools/build_atlas.py + tools/gen_manifest_v3.py。',
    'source': {'frameSize': [256, 256], 'origin': [128, 208], 'perFrameCrop': False, 'shadow': 'separate'},
    'runtime': {'cellSize': 128, 'origin': [64, 104], 'displayTiles': 1.15},
    'atlas': {'image': 'puppy_atlas_v3.webp', 'size': [2048, 1024], 'cols': 16, 'rows': 8},
    'directions': {'drawn': ['E', 'N', 'S'], 'mirror': {'W': 'E'}},
    'shadow': {'cell': 108, 'radius': [52, 13]},
    'body': body, 'clips': clips,
    'actions': {'pick_ball': {'clip': 'sniff', 'frames': [0, 1, 2, 3], 'events': [{'frame': 3, 'name': 'ball_pick'}]},
                'drop_ball': {'clip': 'eat', 'frames': [0, 1, 2], 'events': [{'frame': 2, 'name': 'ball_drop'}]}},
}
json.dump(m, open(os.path.join(ART, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
print('body', body, 'mouth sources', src)
