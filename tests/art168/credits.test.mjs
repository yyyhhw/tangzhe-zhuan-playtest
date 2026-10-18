// 素材-168：art/CREDITS.md 引用的两份清单和四张人物参考图，必须和仓库里的实际文件逐字节对得上。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=b=>createHash('sha256').update(b).digest('hex');
const credits=read('art/CREDITS.md').toString('utf8');
const cards=JSON.parse(read('tests/xt11/art-files.json')),cardSrc=JSON.parse(read('tests/xt11/generation-sources.json'));
const cabins=JSON.parse(read('art/xingtu-cabins/manifest.json')),cabinSrc=JSON.parse(read('art/xingtu-cabins/generation-sources.json'));
function checkRows(rows){for(const r of rows){const b=read(r.path);assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);}}
test('art168: CREDITS names both manifests, both generation records and both runtime users',()=>{
  for(const s of ['tests/xt11/art-files.json','tests/xt11/generation-sources.json','art/xingtu-cabins/manifest.json','art/xingtu-cabins/generation-sources.json','space/overlay.mjs','space/xingtu-views.mjs','image_gen.imagegen','原图哈希缺失'])assert(credits.includes(s),s);
});
test('art168: 25 card images match art-files.json and every card has an original hash record',()=>{
  assert.equal(cards.length,25);assert.equal(new Set(cards.map(r=>r.sha256)).size,25);checkRows(cards);
  assert.deepEqual(cardSrc.map(r=>r.key).sort(),cards.map(r=>r.key).sort());
  for(const r of cardSrc)assert.match(r.originalSha256,/^[0-9a-f]{64}$/,r.key);
});
test('art168: 20 cabin images match manifest; sources list every file and carry no original hash (as CREDITS says)',()=>{
  assert.equal(cabins.length,20);checkRows(cabins);
  assert.deepEqual(cabinSrc.map(r=>'art/xingtu-cabins/'+r.file).sort(),cabins.map(r=>r.path).sort());
  for(const r of cabinSrc)assert.equal('originalSha256' in r,false,r.file);
});
test('art168: four CEO reference images listed with exact bytes and SHA256',()=>{
  const rows=[...credits.matchAll(/^\| `(art\/ceo_[a-z0-9]+\.webp)` \| (\d+) \| `([0-9a-f]{64})` \|$/gm)];
  assert.deepEqual(rows.map(m=>m[1]).sort(),fs.readdirSync(new URL('art/',root)).filter(f=>/^ceo_.*\.webp$/.test(f)).map(f=>'art/'+f).sort());
  for(const [,p,n,h] of rows){const b=read(p);assert.equal(b.length,Number(n),p);assert.equal(sha(b),h,p);}
});
test('art168: negative control — a one-byte change is caught',()=>{
  const r=cabins[0],b=Buffer.from(read(r.path));b[b.length-1]^=1;assert.notEqual(sha(b),r.sha256);
  assert.throws(()=>checkRows([{...cards[0],sha256:'0'.repeat(64)}]));
});
