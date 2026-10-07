# 沙发竖放侧面图摆放验收（凤雏，2026-10-07 15:1x JST）
只放验收材料，不合并 main。基线 = 预览 13i (fff02e0)；候选 = 熊大 14:49 三张 *_rot1_redraw_v2.png（按 alpha>8 裁透明边、缩到宽 240）。
- compare_iphone15.png：左 13i 现状，右候选；蓝虚线 = 1×3 占地
- shots/：iPhone 15 / iPhone SE（WebKit）各有无网格两张
- cand/：裁边后 240 宽 PNG（建议高度 754 / 802 / 723）
- geo.json + place.py：量测脚本与结果
注意：裁边用的是 Slack 预览 455×1024 版，正式导出请从原图重新按 alpha>8 裁一次再缩到 240 宽，高度可能差 1–2px。
