#!/usr/bin/env python3
"""p5：把熊大狗 v3 候选包（home-transfer-20261006 3fb4756 transfer/batch3_puppy）烘成手机用的 2048×1024 图集。
用法：python3 build_atlas.py <解压后的 native 包目录（含 runtime_manifest.json / anchors_body_v1.json / sources/*.png）> <输出目录 preview/pet/art>
- 只读原始 PNG（权威母版，不改、不进仓库）；每帧按 runtime_manifest 的 sourceRect（小数格）+ drawToConceptual 变换，
  统一 0.5 概念→运行时缩放，落地点 (64,104)，不逐帧缩放、不裁轮廓；格外像素（邻格串色）一律透明。
- 108 帧放 proposedP3Cell 0..107，cell 108 = 程序画的椭圆影子（包里没有影子图，影子仍是占位）。
- 输出：puppy_atlas_v3.webp（图集）+ puppy_atlas_v3.json（逐帧：cell、时长、概念坐标下的 alpha 横向范围 / 上下沿、嘴巴点来源）。"""
import sys, json, math, hashlib, os
from PIL import Image, ImageDraw, ImageFilter

SS = 4                      # 先在 4× 画布上按小数偏移贴，再整体缩回 128，保证亚像素对齐
CELL, COLS, ROWS = 128, 16, 8
ORIGIN_RT = (64, 104)

def main(src_dir, out_dir):
    man = json.load(open(os.path.join(src_dir, 'runtime_manifest.json')))
    side = json.load(open(os.path.join(src_dir, 'anchors_body_v1.json')))
    sheets = {}
    atlas = Image.new('RGBA', (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    frames = {}
    for clip, c in man['clips'].items():
        for f in c['frames']:
            cell = f['proposedP3Cell']
            if cell is None: continue           # stand_* 是静态参考，不进图集
            sid = c['sourceId']
            if sid not in sheets:
                p = os.path.join(src_dir, man['sources'][sid]['file'])
                assert hashlib.sha256(open(p, 'rb').read()).hexdigest() == man['sources'][sid]['sha256'], p
                sheets[sid] = Image.open(p).convert('RGBA')
            im = sheets[sid]
            rx, ry, rw, rh = f['sourceRect']                     # 小数格（和 groundAnchorLocal / drawToConceptual 是一对，不混用整数版）
            x0, y0, x1, y1 = math.floor(rx), math.floor(ry), math.ceil(rx + rw), math.ceil(ry + rh)
            crop = im.crop((x0, y0, x1, y1))
            # 小数格边：格外的像素清透明（防邻格串色）；半像素边按覆盖率乘 alpha
            a = crop.getchannel('A'); px = a.load(); W, H = crop.size
            for xx in range(W):
                cov_x = min(x0 + xx + 1, rx + rw) - max(x0 + xx, rx)
                if cov_x >= 1: continue
                for yy in range(H): px[xx, yy] = int(px[xx, yy] * max(0.0, cov_x))
            for yy in range(H):
                cov_y = min(y0 + yy + 1, ry + rh) - max(y0 + yy, ry)
                if cov_y >= 1: continue
                for xx in range(W): px[xx, yy] = int(px[xx, yy] * max(0.0, cov_y))
            crop.putalpha(a)
            s = f['drawToConceptual']['scale']; tx, ty = f['drawToConceptual']['translate']
            k = s * 0.5 * SS                                      # 源像素 → 4× 运行时像素
            ox = ((x0 - rx) * s + tx) * 0.5 * SS; oy = ((y0 - ry) * s + ty) * 0.5 * SS
            ix, iy = math.floor(ox), math.floor(oy); fx, fy = ox - ix, oy - iy
            tw, th = max(1, round((W + fx / k) * k)), max(1, round((H + fy / k) * k))
            pre = crop.convert('RGBa')
            # 亚像素：先在源上补 fx/k 的透明边再缩放
            padL, padT = fx / k, fy / k
            big = Image.new('RGBa', (W + math.ceil(padL) + 1, H + math.ceil(padT) + 1), (0, 0, 0, 0))
            big.paste(pre, (0, 0))
            big = big.transform(big.size, Image.AFFINE, (1, 0, -padL, 0, 1, -padT), resample=Image.BICUBIC)
            sc = big.resize((max(1, round(big.size[0] * k)), max(1, round(big.size[1] * k))), Image.LANCZOS)
            canvas = Image.new('RGBa', (CELL * SS, CELL * SS), (0, 0, 0, 0))
            canvas.paste(sc, (ix, iy))
            out = canvas.resize((CELL, CELL), Image.LANCZOS).convert('RGBA')
            atlas.paste(out, ((cell % COLS) * CELL, (cell // COLS) * CELL))
            frames[cell] = {'clip': clip, 'index': f['index'], 'ms': f['p3TimingMs'], 'dir': c['dir'], 'sourceId': sid}
    # 影子（占位）：cell 108，概念半径 [52,13] → 运行时 [26,6.5]
    sh = Image.new('RGBA', (CELL * SS, CELL * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    cx, cy, rxs, rys = ORIGIN_RT[0] * SS, ORIGIN_RT[1] * SS, 26 * SS, 6.5 * SS
    d.ellipse((cx - rxs, cy - rys, cx + rxs, cy + rys), fill=(40, 28, 20, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(SS * 1.2)).resize((CELL, CELL), Image.LANCZOS)
    atlas.paste(sh, ((108 % COLS) * CELL, (108 // COLS) * CELL))
    # 逐帧量真图：alpha>8 的横向范围 / 上下沿（概念坐标 = 运行时 ×2）
    A = atlas.getchannel('A').load()
    for cell, fr in frames.items():
        bx, by = (cell % COLS) * CELL, (cell // COLS) * CELL
        xs = [x for x in range(CELL) if any(A[bx + x, by + y] > 8 for y in range(CELL))]
        ys = [y for y in range(CELL) if any(A[bx + x, by + y] > 8 for x in range(CELL))]
        fr['alphaX'] = [xs[0] * 2, (xs[-1] + 1) * 2]; fr['alphaY'] = [ys[0] * 2, (ys[-1] + 1) * 2]
        # 东向鼻尖：头部高度带（上沿 ~ 上沿+45%）里最右的不透明点
        top, bot = ys[0], ys[-1]
        best = None
        for y in range(top, top + max(4, int((bot - top) * 0.55))):
            row = [x for x in range(CELL) if A[bx + x, by + y] > 128]
            if row and (best is None or row[-1] > best[0]): best = (row[-1], y)
        fr['noseTip'] = [best[0] * 2 + 1, best[1] * 2 + 1] if best else None
    # 熊大 sidecar：E/S 的嘴巴目测点（概念坐标），N 为 null（被挡住）
    sidemap = {}
    for r in side['frames']:
        sidemap[(r['clip'], r['frameIndex'])] = r
    os.makedirs(out_dir, exist_ok=True)
    atlas.save(os.path.join(out_dir, 'puppy_atlas_v3.webp'), 'WEBP', quality=92, alpha_quality=100, method=6, exact=False)
    meta = {'source': 'home-transfer-20261006@3fb4756 transfer/batch3_puppy/puppy_complete_native_candidates_20261006_v3.zip (sha256 40fe9351bfdf4225ce289fe92be8b29a41b0c6968943370ef431950f96548895)',
            'manifestSha256': hashlib.sha256(open(os.path.join(src_dir, 'runtime_manifest.json'), 'rb').read()).hexdigest(),
            'frames': {str(k): v for k, v in sorted(frames.items())},
            'sidecar': {f'{k[0]}#{k[1]}': {'mouth': (r.get('mouth') or {}).get('conceptual'), 'nose': (r.get('nose') or {}).get('conceptual'), 'cell': r.get('p3CandidateCell')} for k, r in sidemap.items()}}
    json.dump(meta, open(os.path.join(out_dir, 'puppy_atlas_v3.json'), 'w'), ensure_ascii=False, indent=1)
    print('atlas ok', len(frames), 'frames', os.path.getsize(os.path.join(out_dir, 'puppy_atlas_v3.webp')), 'bytes')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
