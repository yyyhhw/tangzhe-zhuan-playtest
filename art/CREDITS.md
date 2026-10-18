# 美术来源记录（素材-168，2026-10-18；基线 main 86e8f41）

只记录来源，不改图、不改游戏代码。音频的来源见 `audio/CREDITS.md`，两份分开放。
文件逐张的字节数和 SHA256 不在这里重复抄写，以下面两份清单为准；`tests/art168/credits.test.mjs` 会核对清单和仓库里的实际文件是否一致。

## 星途剧情卡图（25 张）

- 位置：`art/spacecards/*.webp`，1024×768 WebP。8 条航线各 3 张，另加 signal 1 张，和 `space/album.mjs` 里的 25 张卡一一对应。
- 逐张清单（路径、尺寸、字节数、SHA256）：`tests/xt11/art-files.json`。清单留在原处，不挪进 `art/spacecards/`。
- 来源：AI 生成，原图都在生成方工作区的 `generated_images/` 下。每张原图的工作区路径和原图 SHA256 记在 `tests/xt11/generation-sources.json`。原 PNG 不在仓库里，仓库里只能核到 WebP 这一层。
- 生成工具和商用授权条款：未知，待熊大核。卡图的生成记录里没有写工具名，这里不照舱图去推断。
- 游戏里由 `space/overlay.mjs` 引用。

## 星途四舱五级插画（20 张）

- 位置：`art/xingtu-cabins/{bridge,gun,medical,kitchen}-{1..5}.webp`，1200×900 WebP。
- 逐张清单（路径、尺寸、格式、字节数、SHA256）：`art/xingtu-cabins/manifest.json`。
- 来源：AI 生成。`generation-sources.json` 和 `DELIVERY.md` 写的工具是 `image_gen.imagegen`；生成方法和人物参考见同目录的 `DELIVERY.md`；每张原图的工作区路径记在 `art/xingtu-cabins/generation-sources.json`。
- 原图哈希缺失：`generation-sources.json` 只记了原 PNG 的路径，没记哈希，原 PNG 也不在仓库里，所以没法补。仓库里能核的只有 WebP 这一层（manifest 里的 SHA256）。
- 游戏里由 `space/xingtu-views.mjs` 引用。
- 商用授权条款：未知，待熊大核。

## 人物参考：四位 CEO 立绘

舱图的人物是照仓库里这四张已有立绘画的，没有照真人重新设计（见 `art/xingtu-cabins/DELIVERY.md`）。这四张图本身的出图来源和授权：未知，仓库里没有记录，待熊大核。

| 文件 | 字节数 | SHA256 |
|---|---|---|
| `art/ceo_rocket.webp` | 16552 | `a94d4a0f8d4ea5a7c21fe532f77396c5ff6dd500fd57be0b316cb0d9bb4d8fa2` |
| `art/ceo_otaku.webp` | 20424 | `60ae186981068b1697cad2e0bc1a605a0b43651f609cc9d62106d000c2acedf7` |
| `art/ceo_pearl.webp` | 24504 | `c7ad46a8ba0781f6755132e3648c0e664b9e0babbfdf030e2c1e0d394ed272b0` |
| `art/ceo_c77.webp` | 24224 | `9dc9125f1aefe81cff970c5f929dce7bd43ae15eb6df8a99d61028352ce60511` |

## 火箭老板

- 杨总 10/14 21:33 已定：这个游戏是他自己玩的，火箭老板现有的写实插画维持现状，不重画。
- 用法边界（小喇叭 10/18 肖像风险资料，熊二 12:44 记入）：火箭老板不进图标、宣传图和商店截图；文案里不出现真名、谐音或公司名。

## 这份记录没覆盖的

- 家具、衣帽、装饰、故事卡等其余 `art/` 下的图，这次没逐张核来源。
- 原 PNG 都不在仓库，卡图的原图哈希只能照抄生成记录，没有重新计算。
