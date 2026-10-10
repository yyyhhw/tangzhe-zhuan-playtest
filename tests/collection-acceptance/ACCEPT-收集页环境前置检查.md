# ACCEPT 收集页环境前置检查

只写 md，不改断言，不改游戏代码，不动 v1、v1.1、v10a，不重跑冒烟。依据：`accept.sh`、`ui_collection.py` 第 1–15 行和第 94–96 行、`ACCEPT-收集页失败分类速查.md` 第 8 行。
跑 `accept.sh` 之前先逐项看一眼。**这几项缺了都算环境问题，不算失败**：修好以后重跑就行，不退回熊大；第 5、6 项除外，见表。

| # | 查什么 | 一眼怎么判 | 缺了先怎么修 | 算不算失败 |
|---|---|---|---|---|
| 1 | node | `export PATH=~/.nvm/versions/node/v24.19.0/bin:$PATH; node -v`，能打出 `v24.19.0` | 设好上面的 PATH，或者用 `NODE=/path/to/node` 指过去。缺 node 时 `accept.sh` 会 exit 2 | 不算 |
| 2 | python 和 Playwright | `python3 -c "import playwright"` 不报错；WebKit、Chromium 两个浏览器能启动（第 96 行会 `launch()` 这两个） | 按 `qa-env` 的说明装 Playwright 的浏览器和系统依赖 | 不算 |
| 3 | 端口 | `ss -ltn \| grep -q ':8790 ' && echo 被占`，什么都不打印才行 | 加 `PORT=<别的端口>`。没给 `COLLECTION_URL` 时，默认地址会跟着这个端口走 | 不算。端口被占时页面打不开，看起来像「页面打不开」，先排除这一项 |
| 4 | 骨架和 adapter | `ls $S/SHA256.txt $A`，两个文件都在 | 设好 `S`、`A` 两个变量（写在复验口令第一节） | 不算 |
| 5 | `COLLECTION_URL` | 不设的话，用默认路径 `preview/cards/collection/index.html`，`ls` 能看到；熊大放在别的路径，就 `echo $COLLECTION_URL` 看指的是不是那个地址 | 设对 `COLLECTION_URL`。地址设对了文件还是没有，就是核对表第 1 项没过 | 地址设错算环境问题；文件没有就退回熊大 |
| 6 | `?collectionTest=1` | `echo "$COLLECTION_URL" \| grep -q 'collectionTest=1'`；没设 `COLLECTION_URL` 的话，默认地址已经带上了 | 在 URL 末尾补上 `?collectionTest=1` | 漏写了算环境问题；补上以后还是没有 `CollectionQA`，就是核对表第 2 项，退回熊大 |
| 7 | 夹具 | 不用查路径。夹具直接写在 `ui_collection.py` 第 15 行（`TEST_CFG`），没有单独的文件 | 不用修。第 15 行要是被改过，`git diff` 一眼就能看出来；被改了就恢复，断言不改 | 不算 |
| 8 | 日志目录 | `/tmp/collection-accept` 能写；也可以用 `LOG_DIR` 换一个目录 | 设 `LOG_DIR` | 不算 |

8 项都过了，再按 `ACCEPT-收集页复验口令.md` 跑。
