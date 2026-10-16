#!/usr/bin/env node
// 测试-136：一键全量测试。只跑已有测试，不改游戏代码、不改测试。
// 用法：node scripts/run-all-tests.mjs [--out 目录] [--compare 旧的 summary.json] [--only node|root]
//  1. 在 8931、8781–8784 起只读静态服务（仓库根目录，.mjs 按 JavaScript 返回），跑完自动关
//  2. 统一带 NODE_OPTIONS=--experimental-vm-modules，自动找 playwright 填 PLAYWRIGHT_MODULE
//  3. 依次（串行）跑：node --test、根目录 test_*.js / test_*.mjs、pet/game/test_petgame.js
//  4. 打印「脚本 → 通过/失败 → 退出码」汇总表，写进 <out>/summary.json，每个脚本的完整输出在 <out>/logs/
//  --compare：和另一次的 summary.json 逐个比，列出退出码、失败数、node --test 失败名的变化（改前/改后对照用）
//  r2 门禁（熊大 18:33 三组反例）：
//   ① node --test 的 TAP 按「# Subtest: 名」→ 同缩进「ok/not ok N - 名」配对；有子测试开了没收口（父级 ok 或输出结束先到）= 未完成，算失败
//   ② summary.json 记每个用例的完整身份（父 > 子 路径）和状态；--compare 时身份集合不同（少了、换了、新增）一律「不可比较」→ 返回 1，
//      身份集合相同时，失败→通过记「不再失败」，通过→失败记新增失败
//   ③ 所有输出文件用 O_EXCL（wx）新建：目标已存在（含指向基线的 symlink / hardlink）就在写之前拒绝；out 与 out/logs 不能是 symlink
//  --replay-node-log FILE：不跑 node --test，改读一份已存的 TAP 日志（复核/负例用），只影响 node --test 那一行
// 不跑 Python 脚本（test_*.py）、tests/ 下的浏览器 .py、WebKit。退出码：有任何一项退出码不等于 0 就返回 1；用了 --compare 时，只有出现新失败才返回 1。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTS = [8931, 8781, 8782, 8783, 8784];
const STEP_TIMEOUT_MS = {node: 20 * 60e3, script: 15 * 60e3};
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json'};

const args = process.argv.slice(2);
const opt = name => {const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined;};
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.resolve(opt('--out') || path.join(process.env.TMPDIR || '/tmp', `tzz-run-all-${stamp}`));
const COMPARE = opt('--compare');
const ONLY = opt('--only');
const REPLAY = opt('--replay-node-log');
function refuse(msg) {console.error(`拒绝：${msg}`); process.exit(2);}
// ③ 输出保护：写之前确认 out / out/logs 是真目录（不是 symlink），要写的文件都还不存在
for (const d of [OUT, path.join(OUT, 'logs')]) {
  let st = null;
  try {st = fs.lstatSync(d);} catch {}
  if (st && st.isSymbolicLink()) refuse(`${d} 是符号链接，不往里写`);
  if (st && !st.isDirectory()) refuse(`${d} 已存在且不是目录`);
  if (!st) fs.mkdirSync(d);
}
function safeWrite(file, data) {
  // wx = O_CREAT|O_EXCL：目标已存在（普通文件、symlink、hardlink 都算）就失败，绝不改写原文件
  try {fs.writeFileSync(file, data, {flag: 'wx'});}
  catch (e) {if (e.code === 'EEXIST') refuse(`${file} 已存在（可能是指向基线的链接），不覆盖`); throw e;}
}
function preflight(names) {
  for (const n of names) {
    const f = path.join(OUT, n);
    let st = null;
    try {st = fs.lstatSync(f);} catch {}
    if (st) refuse(`${f} 已存在${st.isSymbolicLink() ? '（符号链接）' : st.nlink > 1 ? '（硬链接）' : ''}，换一个空的 --out 目录`);
  }
}
preflight(['summary.json', 'logs/node--test.log']);

// ---------- 静态服务 ----------
function serve(port) {
  const server = http.createServer((req, res) => {
    let rel;
    try {rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);} catch {res.writeHead(400); return res.end();}
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) {res.writeHead(403); return res.end();}
    try {if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');} catch {}
    fs.readFile(file, (err, buf) => {
      if (err) {res.writeHead(404); return res.end('not found');}
      res.writeHead(200, {'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(buf);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', e => reject(new Error(`端口 ${port} 起不来（${e.code}）。先关掉占用它的进程再跑。`)));
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

// ---------- playwright ----------
function findPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return process.env.PLAYWRIGHT_MODULE;
  const tries = [ROOT];
  try {tries.push(execFileSync('npm', ['root', '-g'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim());} catch {}
  for (const base of tries) {
    for (const name of ['playwright', '@playwright/test']) {
      // 优先 index.mjs：CJS 的 index.js 被 import() 时拿不到具名导出 chromium
      try {const cjs = createRequire(path.join(base, 'noop.js')).resolve(name), esm = path.join(path.dirname(cjs), 'index.mjs'); return fs.existsSync(esm) ? esm : cjs;} catch {}
      const direct = path.join(base, name, 'index.mjs');
      if (fs.existsSync(direct)) return direct;
      const directCjs = path.join(base, name, 'index.js');
      if (fs.existsSync(directCjs)) return directCjs;
    }
  }
  return null;
}

// ---------- 跑一个子进程 ----------
const children = new Set();
function run(cmd, argv, {timeout, env}) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(cmd, argv, {cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe']});
    children.add(child);
    let out = '', timedOut = false;
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => out += d);
    const timer = setTimeout(() => {timedOut = true; killTree(child);}, timeout);
    child.on('close', (code, signal) => {
      clearTimeout(timer); children.delete(child);
      killTree(child); // 子进程自己留下的浏览器等，一并收掉
      resolve({code: timedOut ? 'timeout' : (code ?? signal), out, seconds: Math.round((Date.now() - t0) / 100) / 10});
    });
  });
}
function killTree(child) {try {process.kill(-child.pid, 'SIGKILL');} catch {}}

// ---------- 从输出里数通过/失败 ----------
function count(out) {
  let m;
  if ((m = out.match(/(\d+)\s+passed,\s*(\d+)\s+failed/))) return {pass: +m[1], fail: +m[2], by: '汇总行 N passed, M failed'};
  if ((m = out.match(/(?:^|\n)\s*(\d+)\/(\d+)\s+PASS\s*(?:\n|$)/))) return {pass: +m[1], fail: +m[2] - +m[1], by: '汇总行 N/M PASS'};
  if ((m = out.match(/(\d+)\s+checks passed/)) && !/fail/i.test(out)) return {pass: +m[1], fail: 0, by: '汇总行 N checks passed'};
  const status = [...out.matchAll(/"status"\s*:\s*"(pass|fail)"/g)].map(x => x[1]);
  if (status.length) return {pass: status.filter(s => s === 'pass').length, fail: status.filter(s => s === 'fail').length, by: 'JSON "status"'};
  const oks = [...out.matchAll(/"ok"\s*:\s*(true|false)/g)].map(x => x[1]);
  if (oks.length) return {pass: oks.filter(s => s === 'true').length, fail: oks.filter(s => s === 'false').length, by: 'JSON "ok"'};
  const pass = (out.match(/^\s*(✓|✔|PASS\b|ok\b)/gm) || []).length, fail = (out.match(/^\s*(✗|✘|×|FAIL\b|not ok\b)/gm) || []).length;
  if (pass || fail) return {pass, fail, by: '逐行标记 ✓/✗/PASS/FAIL'};
  return {pass: null, fail: null, by: '输出里没有可数的结果，只看退出码'};
}
function parseNodeTest(out) {
  const g = k => {const m = out.match(new RegExp(`^# ${k} (\\d+)`, 'm')); return m ? +m[1] : null;};
  // ① 按缩进配对 Subtest 与结果行；cases = 完整身份路径 → pass/fail/skip
  const stack = [], cases = {}, incomplete = [];
  const pathOf = (upto) => stack.slice(0, upto).map(x => x.name);
  for (const line of out.split(/\r?\n/)) {
    const ind = line.length - line.trimStart().length, t = line.trim();
    let m;
    if ((m = t.match(/^# Subtest: (.+)$/))) {
      while (stack.length && stack[stack.length - 1].indent >= ind) incomplete.push([...pathOf(stack.length)].join(' > ')), stack.pop();
      stack.push({name: m[1].trim(), indent: ind});
      continue;
    }
    if ((m = t.match(/^(not ok|ok) \d+(?: - (.*?))?(?: # (SKIP|TODO)\b.*)?$/i))) {
      // 比这一行更深、还没收口的子测试 = 未完成
      while (stack.length && stack[stack.length - 1].indent > ind) incomplete.push(pathOf(stack.length).join(' > ')), stack.pop();
      const name = (m[2] || '').trim();
      let key;
      if (stack.length && stack[stack.length - 1].indent === ind) {key = pathOf(stack.length).join(' > '); stack.pop();}
      else key = [...pathOf(stack.length), name].join(' > ');
      const status = m[3] ? 'skip' : m[1] === 'ok' ? 'pass' : 'fail';
      if (Object.hasOwn(cases, key)) key += ` #${Object.keys(cases).filter(k => k === key || k.startsWith(key + ' #')).length + 1}`;
      cases[key] = status;
    }
  }
  while (stack.length) incomplete.push(pathOf(stack.length).join(' > ')), stack.pop();
  const failed = Object.entries(cases).filter(([, v]) => v === 'fail').map(([k]) => k);
  return {tests: g('tests'), pass: g('pass'), fail: g('fail'), skipped: g('skipped'), failed, cases, incomplete: [...new Set(incomplete)]};
}

// ---------- 主流程 ----------
const servers = [];
async function cleanup() {
  for (const c of children) killTree(c);
  await Promise.all(servers.map(s => new Promise(r => s.close(() => r()))));
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {await cleanup(); process.exit(130);});

let sha = '';
try {sha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();} catch {}
const pw = findPlaywright();
const env = {...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--experimental-vm-modules'].filter(Boolean).join(' ')};
if (pw) env.PLAYWRIGHT_MODULE = pw;

const rows = [];
try {
  for (const p of PORTS) servers.push(await serve(p));
  console.log(`仓库 ${ROOT} @ ${sha || '（不是 git 仓库）'}`);
  console.log(`静态服务：${PORTS.join('、')}；PLAYWRIGHT_MODULE=${pw || '（没找到，浏览器脚本会报错）'}；日志 ${OUT}`);

  if (ONLY !== 'root') {
    process.stdout.write(REPLAY ? `▶ node --test（读已存日志 ${REPLAY}）… ` : '▶ node --test（串行）… ');
    const r = REPLAY ? {out: fs.readFileSync(REPLAY, 'utf8'), code: 'replay', seconds: 0}
      : await run(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap'], {timeout: STEP_TIMEOUT_MS.node, env});
    safeWrite(path.join(OUT, 'logs', 'node--test.log'), r.out);
    const t = parseNodeTest(r.out);
    // 未收口的子测试不能被父级 ok 冲掉：本行记失败
    const exit = t.incomplete.length ? 'incomplete' : REPLAY ? (t.fail === 0 && Object.keys(t.cases).length ? 0 : 1) : r.code;
    rows.push({script: 'node --test', pass: t.pass, fail: t.fail, skipped: t.skipped, tests: t.tests, exit, seconds: r.seconds, by: 'TAP 汇总', failed: t.failed, cases: t.cases, incomplete: t.incomplete, log: 'logs/node--test.log'});
    console.log(`${t.pass}/${t.tests} 过，${t.fail} 败，${t.skipped} 跳，退出码 ${exit}${t.incomplete.length ? `；未收口子测试 ${t.incomplete.length} 个：${t.incomplete.join('；')}` : ''}`);
  }
  if (ONLY !== 'node') {
    const scripts = fs.readdirSync(ROOT).filter(f => /^test_.*\.(m?js)$/.test(f)).sort();
    scripts.push('pet/game/test_petgame.js');
    preflight(['summary.json', ...scripts.map(s => `logs/${s.replace(/\//g, '__')}.log`)]);
    for (const s of scripts) {
      if (!fs.existsSync(path.join(ROOT, s))) continue;
      process.stdout.write(`▶ ${s} … `);
      const r = await run(process.execPath, [s], {timeout: STEP_TIMEOUT_MS.script, env});
      const log = `logs/${s.replace(/\//g, '__')}.log`;
      safeWrite(path.join(OUT, log), r.out);
      const c = count(r.out);
      rows.push({script: s, pass: c.pass, fail: c.fail, exit: r.code, seconds: r.seconds, by: c.by, log});
      console.log(`退出码 ${r.code}`);
    }
  }
} catch (e) {
  console.error(String(e.message || e));
  await cleanup();
  process.exit(2);
}
await cleanup();

// ---------- 汇总 ----------
const cell = v => v === null || v === undefined ? '—' : String(v);
const w = Math.max(...rows.map(r => r.script.length), 6);
console.log(`\n${'脚本'.padEnd(w)}  通过    失败  退出码  秒`);
for (const r of rows) console.log(`${r.script.padEnd(w)}  ${cell(r.pass).padStart(5)}  ${cell(r.fail).padStart(5)}  ${cell(r.exit).padStart(6)}  ${r.seconds}`);
const bad = rows.filter(r => r.exit !== 0);
console.log(`\n共 ${rows.length} 项，退出码非 0 的 ${bad.length} 项：${bad.map(r => r.script).join('、') || '无'}`);
const nodeRow = rows.find(r => r.script === 'node --test');
if (nodeRow?.failed?.length) console.log(`node --test 失败：\n  ${nodeRow.failed.join('\n  ')}`);

const summary = {sha, root: ROOT, at: new Date().toISOString(), node: process.version, playwright: pw, ports: PORTS,
  nodeOptions: env.NODE_OPTIONS, notRun: ['test_*.py', 'tests/**/*.py', 'WebKit'], rows};
safeWrite(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`汇总已写入 ${path.join(OUT, 'summary.json')}`);

let exit = bad.length ? 1 : 0;
if (COMPARE) {
  const old = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
  const prev = new Map(old.rows.map(r => [r.script, r]));
  const diffs = [];
  let worse = false;
  for (const r of rows) {
    const o = prev.get(r.script);
    if (!o) {worse = true; diffs.push(`${r.script}：旧结果里没有（不可比较）`); continue;}
    if (o.exit !== r.exit || o.fail !== r.fail || o.pass !== r.pass) {
      diffs.push(`${r.script}：通过 ${cell(o.pass)}→${cell(r.pass)}，失败 ${cell(o.fail)}→${cell(r.fail)}，退出码 ${cell(o.exit)}→${cell(r.exit)}`);
      if ((r.fail ?? 0) > (o.fail ?? 0) || (o.exit === 0 && r.exit !== 0)) worse = true;
    }
    if (r.cases || o.cases) {
      // ② 按完整用例身份集合比：集合不同 = 不可比较（只数失败名会被「删失败 A + 加通过 C」骗成修好了）
      if (!r.cases || !o.cases) {worse = true; diffs.push(`  ${r.script}：一边没有用例身份清单（旧版 summary），不可比较——请用本版脚本重跑基线`); continue;}
      const ok = Object.keys(o.cases), nk = Object.keys(r.cases);
      const missing = ok.filter(k => !Object.hasOwn(r.cases, k)), extra = nk.filter(k => !Object.hasOwn(o.cases, k));
      if (missing.length || extra.length) {
        worse = true;
        diffs.push(`  用例身份集合变了，不可比较：${missing.length ? `少了 ${missing.join('；')}` : ''}${missing.length && extra.length ? '；' : ''}${extra.length ? `多了 ${extra.join('；')}` : ''}`);
        continue;
      }
      const added = nk.filter(k => r.cases[k] === 'fail' && o.cases[k] !== 'fail'), gone = nk.filter(k => o.cases[k] === 'fail' && r.cases[k] !== 'fail');
      if (added.length) {worse = true; diffs.push(`  新增失败：${added.join('；')}`);}
      if (gone.length) diffs.push(`  不再失败：${gone.join('；')}`);
    }
    if (r.incomplete?.length) {worse = true; diffs.push(`  未收口子测试：${r.incomplete.join('；')}`);}
  }
  for (const s of prev.keys()) if (!rows.some(r => r.script === s)) {worse = true; diffs.push(`${s}：这次没跑（不可比较）`);}
  console.log(`\n对照 ${COMPARE}（${old.sha || '?'} → ${sha || '?'}）：${diffs.length ? '\n' + diffs.join('\n') : '逐项一致'}`);
  exit = worse ? 1 : 0;
}
process.exit(exit);
