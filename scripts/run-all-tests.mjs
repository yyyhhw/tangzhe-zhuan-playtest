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
//  r3 门禁（熊大 19:18 三类阻断）：
//   ① 身份：node --test 用例身份 = 结构化路径数组 + 同路径序号（JSON 编码，Map 存，不用 {} 和「 > 」拼接，原型键/分隔符/重名都不撞）；
//      普通 test_*.js/mjs 只有在逐行标记数 = 汇总通过+失败数时才算有完整身份；只打印失败名的记「仅失败名」，什么都没有的记「无身份」——
//      后两种只要该行有任何变化（退出码、计数、失败名）一律「不可比较」，不会记成「不再失败」
//   ② 完整性：TAP 缺顶层 1..N 计划、顶层结果数≠N、缺 # tests/# pass/# fail 汇总、YAML 诊断块没收口、子测试没收口，
//      或进程超时/被信号结束/退出码不是 0 或 1，都算「不完整」→ 该行失败、--compare 时一律不可比较，旧基线里的失败不能豁免；YAML 诊断块里的内容不参与解析
//   ③ 基线：--compare 在起服务、跑测试、写任何文件之前读入、校验格式并冻结；基线不存在/畸形/旧版格式/落在 --out 目录里（同路径或同实体）→ 退出 2，什么都不跑不写
//  --replay-node-exit CODE：配合 --replay-node-log 模拟进程结局（0/1/timeout/SIGKILL），负例用
//  r4（熊大 20:31）：① 进程退出退步对所有身份分支都查（基线 0→本轮非 0、或用例全过而进程非 0 都判不一致）；
//      ② 普通脚本只剥「N - 」这类明确序号，名字开头的数字保留；③ 基线每行 schema 严格校验（full 必须有 cases/ids 且类型对），不合格起服务前退出 2
//  测试-144：JSON 计数只认带明确汇总（passed/failed、pass/fail、counts.pass/fail）的测试结果对象，业务 JSON 的 ok/status 不当断言；逐条失败多于汇总按逐条记；
//      r2（熊大 22:23）：只剥 Node 明确警告行，非单个 JSON 却含 ok/status 字段、或多套汇总冲突 → 记不完整、不可比较
//  --replay-root-dir DIR：不跑普通脚本，改读 DIR/<脚本名，/ 换成 __>.log 和同名 .exit（负例用）
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
const REPLAY_EXIT = opt('--replay-node-exit');
const REPLAY_ROOT = opt('--replay-root-dir');
const FORMAT = 3;
function refuse(msg) {console.error(`拒绝：${msg}`); process.exit(2);}
const realOrNull = f => {try {return fs.realpathSync(f);} catch {return null;}};
const inside = (child, dir) => child === dir || child.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
// ③ 基线：先读、校验、冻结，再做别的
function deepFreeze(o) {if (o && typeof o === 'object' && !Object.isFrozen(o)) {Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v);} return o;}
let BASE = null;
if (args.includes('--compare')) {
  if (!COMPARE) refuse('--compare 后面没给文件');
  const abs = path.resolve(COMPARE);
  let st = null;
  try {st = fs.statSync(abs);} catch {}
  if (!st || !st.isFile()) refuse(`基线 ${abs} 不存在或不是普通文件（不会拿本次输出当基线）`);
  const real = realOrNull(abs), outReal = realOrNull(OUT);
  if (abs === path.join(OUT, 'summary.json') || inside(abs, OUT) || (outReal && real && inside(real, outReal)))
    refuse(`基线 ${abs} 落在本次 --out 目录里（同路径或同实体），换一个 --out`);
  let raw;
  try {raw = JSON.parse(fs.readFileSync(abs, 'utf8'));} catch (e) {refuse(`基线 ${abs} 读不了或不是 JSON（${e.message}）`);}
  if (!raw || raw.format !== FORMAT || !Array.isArray(raw.rows) || raw.rows.some(r => !r || typeof r.script !== 'string' || !('exit' in r)))
    refuse(`基线 ${abs} 不是本版（format ${FORMAT}）summary，请用本版脚本重跑基线`);
  if (new Set(raw.rows.map(r => r.script)).size !== raw.rows.length) refuse(`基线 ${abs} 里有重复的脚本行`);
  // r4 P2：逐行 schema 严格校验，不合格在起服务、跑测试、写文件之前拒绝（不再等到比较时崩溃）
  const str = x => typeof x === 'string', okSt = x => x === 'pass' || x === 'fail' || x === 'skip';
  const okCase = c => c && Array.isArray(c.path) && c.path.every(str) && Number.isInteger(c.n) && c.n >= 1 && okSt(c.status);
  const okId = x => x && str(x.name) && (x.status === 'pass' || x.status === 'fail');
  for (const r of raw.rows) {
    const bad = why => refuse(`基线 ${abs} 的「${r.script}」行${why}，请用本版脚本重跑基线`);
    if (!['full', 'failed-only', 'none'].includes(r.idMode)) bad(`身份方式 ${JSON.stringify(r.idMode)} 不认识`);
    if (!(r.exit === 'incomplete' || Number.isInteger(r.exit) || str(r.exit))) bad('退出码类型不对');
    if ('incomplete' in r && !(Array.isArray(r.incomplete) && r.incomplete.every(str))) bad('incomplete 不是字符串数组');
    if (r.idMode === 'full' && r.script === 'node --test' && !(Array.isArray(r.cases) && r.cases.every(okCase))) bad('是完整身份但缺 cases 或类型不对');
    if (r.idMode === 'full' && r.script !== 'node --test' && !(Array.isArray(r.ids) && r.ids.every(okId))) bad('是完整身份但缺 ids 或类型不对');
    if (r.idMode === 'failed-only' && !(Array.isArray(r.ids) && r.ids.every(x => okId(x) && x.status === 'fail'))) bad('是仅失败名但缺 ids 或类型不对');
  }
  BASE = deepFreeze(raw);
}
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
const logName = s => `logs/${s.replace(/\//g, '__')}.log`;
function plainScripts() {
  if (REPLAY_ROOT) return fs.readdirSync(REPLAY_ROOT).filter(f => f.endsWith('.log')).map(f => f.slice(0, -4).replace(/__/g, '/')).sort();
  const list = fs.readdirSync(ROOT).filter(f => /^test_.*\.(m?js)$/.test(f)).sort();
  list.push('pet/game/test_petgame.js');
  return list.filter(s => fs.existsSync(path.join(ROOT, s)));
}
const SCRIPTS = ONLY === 'node' ? [] : plainScripts();
// 所有要写的文件一次性预检，任何一个已存在就在跑之前拒绝（不再先写 node 日志再查普通日志）
preflight(['summary.json', ...(ONLY === 'root' ? [] : ['logs/node--test.log']), ...SCRIPTS.map(logName)]);

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
  // 测试-144：JSON 只认「带明确汇总计数」的测试结果对象（顶层 passed/failed、pass/fail 或 counts.pass/fail 为非负整数）；
  // 没有汇总的 JSON（如业务记录 [{"ok":false,…}]）里的 ok/status 不当断言数，交给下面逐行标记或只看退出码，不凭空生成 PASS/FAIL
  const j = jsonCount(out);
  if (j) return j;
  const pass = (out.match(/^\s*(✓|✔|PASS\b|ok\b)/gm) || []).length, fail = (out.match(/^\s*(✗|✘|×|FAIL\b|not ok\b)/gm) || []).length;
  if (pass || fail) return {pass, fail, by: '逐行标记 ✓/✗/PASS/FAIL'};
  return {pass: null, fail: null, by: '输出里没有可数的结果，只看退出码'};
}
// 144 r2（熊大 22:23）：只剥 Node 明确的非结果警告行「(node:N) XxxWarning: …」及紧跟的「(Use `node --trace-…` …)」提示，其余一字不丢
function stripNodeWarnings(out) {
  return out.split(/\r?\n/).filter(l => !/^\(node:\d+\) \w*Warning: /.test(l) && !/^\(Use `node --trace-[\w-]+ /.test(l)).join('\n').trim();
}
function jsonCount(out) {
  const t = stripNodeWarnings(out);
  let d;
  try {d = JSON.parse(t);} catch {
    // 不是单个可解析 JSON，却带 "ok"/"status" 结果字段（如前置失败 JSON + 后接成功 JSON）→ 不能可靠计数，记不完整、不可比较
    if (/"(ok|status)"\s*:/.test(t)) return {pass: null, fail: null, by: '含 JSON 结果字段但不是单个可解析 JSON', problem: '输出含 "ok"/"status" 结果字段但不是单个可解析 JSON，无法可靠计数'};
    return null;
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const nn = x => Number.isInteger(x) && x >= 0;
  const sets = [];
  if (nn(d.passed) && nn(d.failed)) sets.push([d.passed, d.failed, 'passed/failed']);
  if (nn(d.pass) && nn(d.fail)) sets.push([d.pass, d.fail, 'pass/fail']);
  if (d.counts && nn(d.counts.pass) && nn(d.counts.fail)) sets.push([d.counts.pass, d.counts.fail, 'counts.pass/fail']);
  if (!sets.length) return null;
  // 多套汇总必须完全一致才用，不择首；冲突 → 记不完整、不可比较
  if (sets.some(x => x[0] !== sets[0][0] || x[1] !== sets[0][1]))
    return {pass: null, fail: null, by: 'JSON 多套汇总冲突', problem: `JSON 多套汇总互相冲突：${sets.map(x => `${x[2]} ${x[0]}过${x[1]}败`).join('；')}`};
  let [pass, fail] = sets[0];
  const by = `JSON 汇总 ${sets.map(x => x[2]).join(' = ')}`;
  // 汇总旁的顶层结果数组（元素带 ok 布尔或 status=pass/fail）逐条数一遍：逐条失败比汇总多就按多的记，真实失败不被汇总盖掉
  let rowFail = 0;
  for (const v of Object.values(d)) if (Array.isArray(v)) for (const x of v)
    if (x && typeof x === 'object' && (x.ok === false || x.status === 'fail')) rowFail++;
  if (rowFail > fail) return {pass, fail: rowFail, by: `${by}（逐条失败 ${rowFail} 多于汇总 ${fail}，按逐条记）`};
  return {pass, fail, by};
}
function parseNodeTest(out) {
  const lines = out.split(/\r?\n/);
  // ① 结构化身份：path 是名字数组，n 是同路径第几次出现；Map 键用 JSON 编码，原型键/分隔符/重名都不会撞
  const stack = [], cases = new Map(), seen = new Map(), incomplete = [], problems = [];
  const pathOf = upto => stack.slice(0, upto).map(x => x.name);
  const open = () => incomplete.push(pathOf(stack.length)), pop = () => {open(); stack.pop();};
  let yamlIndent = null, plan = null, top = 0, sum = {};
  for (const line of lines) {
    const ind = line.length - line.trimStart().length, t = line.trim();
    // YAML 诊断块：结果行后的「---」到同缩进「...」之间整段跳过，里面像 Subtest/ok 的文字不算
    if (yamlIndent !== null) {if (t === '...' && ind === yamlIndent) yamlIndent = null; continue;}
    if (t === '---') {yamlIndent = ind; continue;}
    let m;
    if ((m = t.match(/^# Subtest: (.+)$/))) {
      while (stack.length && stack[stack.length - 1].indent >= ind) pop();
      stack.push({name: m[1].trim(), indent: ind});
      continue;
    }
    if ((m = t.match(/^(not ok|ok) \d+(?: - (.*?))?(?: # (SKIP|TODO)\b.*)?$/i))) {
      while (stack.length && stack[stack.length - 1].indent > ind) pop();
      let p;
      if (stack.length && stack[stack.length - 1].indent === ind) {p = pathOf(stack.length); stack.pop();}
      else p = [...pathOf(stack.length), (m[2] || '').trim()];
      const base = JSON.stringify(p), n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      cases.set(JSON.stringify([p, n]), m[3] ? 'skip' : m[1] === 'ok' ? 'pass' : 'fail');
      if (ind === 0) top++;
      continue;
    }
    if (ind === 0 && (m = t.match(/^1\.\.(\d+)$/))) {if (plan !== null) problems.push('顶层计划 1..N 出现多次'); plan = +m[1]; continue;}
    if (ind === 0 && (m = t.match(/^# (tests|pass|fail|skipped|cancelled|todo) (\d+)$/))) sum[m[1]] = +m[2];
  }
  while (stack.length) pop();
  if (yamlIndent !== null) problems.push('YAML 诊断块没收口');
  if (plan === null) problems.push('缺顶层计划 1..N');
  else if (plan !== top) problems.push(`顶层计划 1..${plan} 与顶层结果 ${top} 个对不上`);
  for (const k of ['tests', 'pass', 'fail']) if (!(k in sum)) problems.push(`缺汇总 # ${k}`);
  for (const p of incomplete) problems.push(`未收口子测试 ${p.join(' › ')}`);
  const list = [...cases].map(([k, status]) => {const [p, n] = JSON.parse(k); return {path: p, n, status};});
  return {tests: sum.tests ?? null, pass: sum.pass ?? null, fail: sum.fail ?? null, skipped: sum.skipped ?? null,
    failed: list.filter(c => c.status === 'fail').map(c => c.path.join(' › ') + (c.n > 1 ? `（第${c.n}个）` : '')), cases: list, problems};
}
// 普通脚本：逐行标记能和汇总计数对上才算完整身份；只打印失败名的记「仅失败名」
function plainIds(out, c) {
  const marks = [];
  for (const line of out.split(/\r?\n/)) {
    // r4 P1-②：只剥明确的序号格式「N - / N – / N: 」（如 ok 3 - 名），名字本身开头的数字保留（「3000金币购买」「5 分钟…」不被吞）
    const m = line.match(/^\s*(✓|✔|PASS\b|ok\b|✗|✘|×|FAIL\b|not ok\b)\s*(?:\d+\s+[-–:]\s+|[-–:]\s*)?(.*)$/);
    if (m) marks.push({name: m[2].trim(), status: /^(✗|✘|×|FAIL|not ok)/.test(m[1]) ? 'fail' : 'pass'});
  }
  const nf = marks.filter(x => x.status === 'fail').length;
  if (c.pass !== null && c.fail !== null && marks.length === c.pass + c.fail && nf === c.fail) return {idMode: 'full', ids: marks};
  if (c.fail !== null && nf === c.fail && marks.every(x => x.status === 'fail')) return {idMode: 'failed-only', ids: marks};
  return {idMode: 'none', ids: null};
}
const multiset = ids => {const m = new Map(); for (const x of ids) {const k = JSON.stringify([x.name, x.status]); m.set(k, (m.get(k) || 0) + 1);} return m;};
const sameMultiset = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
const cleanExit = code => code === 0 || code === 1;

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
    const rx = REPLAY_EXIT === undefined ? 'replay' : /^\d+$/.test(REPLAY_EXIT) ? +REPLAY_EXIT : REPLAY_EXIT;
    const r = REPLAY ? {out: fs.readFileSync(REPLAY, 'utf8'), code: rx, seconds: 0}
      : await run(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap'], {timeout: STEP_TIMEOUT_MS.node, env});
    safeWrite(path.join(OUT, 'logs', 'node--test.log'), r.out);
    const t = parseNodeTest(r.out);
    // ② 进程没正常结束（超时/信号/怪退出码）也算不完整；不完整的行不能被父级 ok 或旧基线冲掉
    if (r.code !== 'replay' && !cleanExit(r.code)) t.problems.push(`进程结局 ${r.code}（超时/信号/非 0/1 退出码）`);
    const exit = t.problems.length ? 'incomplete' : r.code === 'replay' ? (t.fail === 0 && t.cases.length ? 0 : 1) : r.code;
    rows.push({script: 'node --test', pass: t.pass, fail: t.fail, skipped: t.skipped, tests: t.tests, exit, rawExit: r.code, seconds: r.seconds, by: 'TAP 汇总', idMode: 'full', failed: t.failed, cases: t.cases, incomplete: t.problems, log: 'logs/node--test.log'});
    console.log(`${t.pass}/${t.tests} 过，${t.fail} 败，${t.skipped} 跳，退出码 ${exit}${t.problems.length ? `；不完整 ${t.problems.length} 处：${t.problems.join('；')}` : ''}`);
  }
  if (ONLY !== 'node') {
    for (const s of SCRIPTS) {
      process.stdout.write(`▶ ${s} … `);
      let r;
      if (REPLAY_ROOT) {
        const b = path.join(REPLAY_ROOT, s.replace(/\//g, '__'));
        let code = 'missing-exit';
        try {const x = fs.readFileSync(b + '.exit', 'utf8').trim(); code = /^\d+$/.test(x) ? +x : x;} catch {}
        r = {out: fs.readFileSync(b + '.log', 'utf8'), code, seconds: 0};
      } else r = await run(process.execPath, [s], {timeout: STEP_TIMEOUT_MS.script, env});
      const log = logName(s);
      safeWrite(path.join(OUT, log), r.out);
      const c = count(r.out), id = plainIds(r.out, c);
      const incomplete = [...(cleanExit(r.code) ? [] : [`进程结局 ${r.code}（超时/信号/非 0/1 退出码）`]), ...(c.problem ? [c.problem] : [])];
      rows.push({script: s, pass: c.pass, fail: c.fail, exit: incomplete.length ? 'incomplete' : r.code, rawExit: r.code, seconds: r.seconds, by: c.by, idMode: id.idMode, ids: id.ids, incomplete, log});
      console.log(`退出码 ${r.code}${incomplete.length ? '（不完整）' : ''}，身份 ${id.idMode}`);
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

const summary = {format: FORMAT, sha, root: ROOT, at: new Date().toISOString(), node: process.version, playwright: pw, ports: PORTS,
  nodeOptions: env.NODE_OPTIONS, notRun: ['test_*.py', 'tests/**/*.py', 'WebKit'], rows};
safeWrite(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`汇总已写入 ${path.join(OUT, 'summary.json')}`);

let exit = bad.length ? 1 : 0;
if (BASE) {
  const old = BASE;
  const prev = new Map(old.rows.map(r => [r.script, r]));
  const diffs = [];
  let worse = false;
  const nc = (why) => {worse = true; diffs.push(why);};
  for (const r of rows) {
    const o = prev.get(r.script);
    if (!o) {nc(`${r.script}：旧结果里没有（不可比较）`); continue;}
    // ② 不完整一律不可比较，旧基线的失败不能豁免
    if (r.incomplete?.length) {nc(`${r.script}：本次不完整，不可比较：${r.incomplete.join('；')}`); continue;}
    if (o.incomplete?.length) {nc(`${r.script}：基线不完整，不可比较：${o.incomplete.join('；')}`); continue;}
    const changed = o.exit !== r.exit || o.fail !== r.fail || o.pass !== r.pass;
    if (changed) diffs.push(`${r.script}：通过 ${cell(o.pass)}→${cell(r.pass)}，失败 ${cell(o.fail)}→${cell(r.fail)}，退出码 ${cell(o.exit)}→${cell(r.exit)}`);
    // r4 P1-①：进程退出退步对所有身份分支（含 full）都查，在分支 continue 之前；旧 exit 1 基线不能豁免
    if (o.exit === 0 && r.exit !== 0) nc(`  ${r.script}：退出码 0→${cell(r.exit)}，退出退步 → 不一致`);
    const noFail = r.idMode === 'full' && (r.cases ? r.cases.every(c => c.status !== 'fail') : r.ids.every(x => x.status !== 'fail'));
    if (r.exit !== 0 && noFail) nc(`  ${r.script}：用例全部通过但进程退出 ${cell(r.exit)} → 不一致（不看基线）`);
    if (r.idMode !== o.idMode) {nc(`  ${r.script}：身份方式 ${o.idMode}→${r.idMode}，不可比较`); continue;}
    if (r.idMode === 'full') {
      // ① 完整身份集合比
      const key = c => JSON.stringify(c.path ? [c.path, c.n] : [c.name, 0]);
      const om = r.cases ? new Map(o.cases.map(c => [key(c), c])) : multiset(o.ids);
      const nm = r.cases ? new Map(r.cases.map(c => [key(c), c])) : multiset(r.ids);
      if (!r.cases) {
        // 普通脚本完整身份：名字+状态的多重集合；集合元素按名字比较
        const names = m => {const x = new Map(); for (const [k, v] of m) {const [nme] = JSON.parse(k); x.set(nme, (x.get(nme) || 0) + v);} return x;};
        if (!sameMultiset(names(om), names(nm))) {nc(`  ${r.script}：用例身份集合变了，不可比较`); continue;}
        const fails = m => {const x = new Map(); for (const [k, v] of m) {const [nme, st] = JSON.parse(k); if (st === 'fail') x.set(nme, v);} return x;};
        const of = fails(om), nf = fails(nm);
        const added = [...nf].filter(([k, v]) => (of.get(k) || 0) < v).map(([k]) => k), gone = [...of].filter(([k, v]) => (nf.get(k) || 0) < v).map(([k]) => k);
        if (added.length) nc(`  ${r.script} 新增失败：${added.join('；')}`);
        if (gone.length) diffs.push(`  ${r.script} 不再失败：${gone.join('；')}`);
        continue;
      }
      const label = c => c.path.join(' › ') + (c.n > 1 ? `（第${c.n}个）` : '');
      const missing = [...om.keys()].filter(k => !nm.has(k)).map(k => label(om.get(k))), extra = [...nm.keys()].filter(k => !om.has(k)).map(k => label(nm.get(k)));
      if (missing.length || extra.length) {
        nc(`  用例身份集合变了，不可比较：${missing.length ? `少了 ${missing.join('；')}` : ''}${missing.length && extra.length ? '；' : ''}${extra.length ? `多了 ${extra.join('；')}` : ''}`);
        continue;
      }
      const added = [...nm].filter(([k, c]) => c.status === 'fail' && om.get(k).status !== 'fail').map(([, c]) => label(c));
      const gone = [...nm].filter(([k, c]) => c.status !== 'fail' && om.get(k).status === 'fail').map(([, c]) => label(c));
      if (added.length) nc(`  新增失败：${added.join('；')}`);
      if (gone.length) diffs.push(`  不再失败：${gone.join('；')}`);
      continue;
    }
    // 没有完整身份：该行任何变化都不可比较，绝不记「不再失败」
    if (r.idMode === 'failed-only') {
      if (changed || !sameMultiset(multiset(o.ids), multiset(r.ids))) nc(`  ${r.script}：只有失败名、没有完整用例身份，这一行有变化 → 不可比较`);
      continue;
    }
    if (changed || r.exit !== 0) nc(`  ${r.script}：没有用例身份${r.exit !== 0 ? '且有失败' : '且计数变了'} → 不可比较`);
  }
  for (const s of prev.keys()) if (!rows.some(r => r.script === s)) nc(`${s}：这次没跑（不可比较）`);
  console.log(`\n对照 ${path.resolve(COMPARE)}（${old.sha || '?'} → ${sha || '?'}）：${diffs.length ? '\n' + diffs.join('\n') : '逐项一致'}`);
  exit = worse ? 1 : 0;
}
process.exit(exit);
