#!/usr/bin/env node
// 测试-136：一键全量测试。只跑已有测试，不改游戏代码、不改测试。
// 用法：node scripts/run-all-tests.mjs [--out 目录] [--compare 旧的 summary.json] [--only node|root]
//  1. 在 8931、8781–8784 起只读静态服务（仓库根目录，.mjs 按 JavaScript 返回），跑完自动关
//  2. 统一带 NODE_OPTIONS=--experimental-vm-modules，自动找 playwright 填 PLAYWRIGHT_MODULE
//  3. 依次（串行）跑：node --test、根目录 test_*.js / test_*.mjs、pet/game/test_petgame.js
//  4. 打印「脚本 → 通过/失败 → 退出码」汇总表，写进 <out>/summary.json，每个脚本的完整输出在 <out>/logs/
//  --compare：和另一次的 summary.json 逐个比，列出退出码、失败数、node --test 失败名的变化（改前/改后对照用）
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
fs.mkdirSync(path.join(OUT, 'logs'), {recursive: true});

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
  const failed = [...out.matchAll(/^\s*not ok \d+ - (.+?)(?: # .*)?$/gm)].map(x => x[1].trim());
  return {tests: g('tests'), pass: g('pass'), fail: g('fail'), skipped: g('skipped'), failed: [...new Set(failed)]};
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
    process.stdout.write('▶ node --test（串行）… ');
    const r = await run(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap'], {timeout: STEP_TIMEOUT_MS.node, env});
    fs.writeFileSync(path.join(OUT, 'logs', 'node--test.log'), r.out);
    const t = parseNodeTest(r.out);
    rows.push({script: 'node --test', pass: t.pass, fail: t.fail, skipped: t.skipped, tests: t.tests, exit: r.code, seconds: r.seconds, by: 'TAP 汇总', failed: t.failed, log: 'logs/node--test.log'});
    console.log(`${t.pass}/${t.tests} 过，${t.fail} 败，${t.skipped} 跳，退出码 ${r.code}`);
  }
  if (ONLY !== 'node') {
    const scripts = fs.readdirSync(ROOT).filter(f => /^test_.*\.(m?js)$/.test(f)).sort();
    scripts.push('pet/game/test_petgame.js');
    for (const s of scripts) {
      if (!fs.existsSync(path.join(ROOT, s))) continue;
      process.stdout.write(`▶ ${s} … `);
      const r = await run(process.execPath, [s], {timeout: STEP_TIMEOUT_MS.script, env});
      const log = `logs/${s.replace(/\//g, '__')}.log`;
      fs.writeFileSync(path.join(OUT, log), r.out);
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
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`汇总已写入 ${path.join(OUT, 'summary.json')}`);

let exit = bad.length ? 1 : 0;
if (COMPARE) {
  const old = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
  const prev = new Map(old.rows.map(r => [r.script, r]));
  const diffs = [];
  let worse = false;
  for (const r of rows) {
    const o = prev.get(r.script);
    if (!o) {diffs.push(`${r.script}：旧结果里没有`); continue;}
    if (o.exit !== r.exit || o.fail !== r.fail || o.pass !== r.pass) {
      diffs.push(`${r.script}：通过 ${cell(o.pass)}→${cell(r.pass)}，失败 ${cell(o.fail)}→${cell(r.fail)}，退出码 ${cell(o.exit)}→${cell(r.exit)}`);
      if ((r.fail ?? 0) > (o.fail ?? 0) || (o.exit === 0 && r.exit !== 0)) worse = true;
    }
    if (r.failed && o.failed) {
      const added = r.failed.filter(x => !o.failed.includes(x)), gone = o.failed.filter(x => !r.failed.includes(x));
      if (added.length) {worse = true; diffs.push(`  新增失败：${added.join('；')}`);}
      if (gone.length) diffs.push(`  不再失败：${gone.join('；')}`);
    }
  }
  for (const s of prev.keys()) if (!rows.some(r => r.script === s)) diffs.push(`${s}：这次没跑`);
  console.log(`\n对照 ${COMPARE}（${old.sha || '?'} → ${sha || '?'}）：${diffs.length ? '\n' + diffs.join('\n') : '逐项一致'}`);
  exit = worse ? 1 : 0;
}
process.exit(exit);
