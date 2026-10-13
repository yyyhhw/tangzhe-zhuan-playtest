// 板砖 16:43：index.html 里 economy.js 仍用旧 ?v=，缓存玩家盲盒页报 E.gachaDailyLeft is not a function。
// 规则：两个正式 index.html 里每个本地 ?v= 资源，要么用当前发布 token，要么文件内容与固定指纹一致（内容一变必须升 token）。
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import path from 'node:path';
const root=new URL('../../',import.meta.url).pathname;
const read=p=>readFileSync(path.join(root,p));
const release=JSON.parse(read('version.json')).v.replace(/^formal-/,'');
const pins=JSON.parse(read('tests/cachefix/legacy-token-pins.json'));
for(const file of ['index.html','pet/game/index.html']){
  const html=read(file).toString(),refs=[...html.matchAll(/(?:src|href)="([^"]+\?v=[^"]+)"/g)].map(m=>m[1]);
  test(`${file}: economy.js uses current release token`,()=>{const e=refs.filter(r=>/(^|\/)economy\.js\?v=/.test(r));assert.ok(e.length>=1);for(const r of e)assert.equal(r.split('?v=')[1],release,r);});
  test(`${file}: every local ?v= asset uses current token or is byte-identical to its pinned version`,()=>{
    assert.ok(refs.length>10);
    for(const r of refs){const [p,v]=r.split('?v=');if(v===release)continue;const pin=pins[`${file} ${r}`];assert.ok(pin,`unpinned stale token: ${r} (bump to ${release})`);
      assert.equal(createHash('sha256').update(read(path.normalize(path.join(path.dirname(file),p)))).digest('hex'),pin.sha256,`${r} content changed — bump its ?v= to ${release}`);}
  });
}
