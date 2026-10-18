import fs from 'node:fs';
// 文案-04（收尾范围，熊二 17:1x 定）：「游戏金币」→「金币」、「+N/秒」→「每秒 +N」、设置卡名「存档」→「设置」；只改两份正式 app.js。
// 撤回时 after 必须恰好出现一次；若已撤回过（after 0 次、before 恰好 1 次）就原样返回，其余一律 NOT_EXACT。
export const copy04Delta=JSON.parse(fs.readFileSync(new URL('./exact-copy-delta.json',import.meta.url)));
// 文案-04 缓存号（熊二）：home43-20261018-r1 → copy04-20261018-r1，整批同号（app.js 经 bootstrap.mjs 加载，bootstrap 本身也按号缓存，只换 app.js 那一处到不了老玩家）。
export const copy04Cache=JSON.parse(fs.readFileSync(new URL('./cache-delta.json',import.meta.url)));
export function withoutCopy04CacheDelta(path,source){
  const rows=copy04Cache.replacements?.[path]??[];
  if(rows.length&&rows.every(([after])=>!source.includes(after)))return withoutCopy04TokenOnly(path,source); // 整组钉已撤过（下层可能又撤了一遍），原样往下
  for(const [after,before]of rows){ // 依赖字节钉随缓存号重算
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('COPY04_CACHE_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return withoutCopy04TokenOnly(path,source);
}
function withoutCopy04TokenOnly(path,source){
  const want=copy04Cache.counts[path];if(!want)return source;
  const n=source.split(copy04Cache.new).length-1;
  if(n===0)return source; // 已撤过
  if(n!==want)throw Error('COPY04_CACHE_DELTA_NOT_EXACT: '+path);
  return source.split(copy04Cache.new).join(copy04Cache.old);
}
export function withoutCopy04Delta(path,source){
  source=withoutCopy04CacheDelta(path,source); // 缓存号叠在 04 之后：先撤缓存号
  for(const [after,before]of copy04Delta[path]?.replacements??[]){
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('COPY04_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
