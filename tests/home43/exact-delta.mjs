import {withoutCopy04Delta} from '../copy04/exact-copy-delta.mjs';
import fs from 'node:fs';
// 家宅-43 候补（熊二）：「烟火小馆」24 件家具 + 57 动作类别 + 仓库保留不认识的 fid。
// 旧版本字节指纹链在最前面先撤这一层。撤回时 after 必须恰好出现一次；若已撤回过（after 0 次、before 恰好 1 次）就原样返回，其余一律 NOT_EXACT。
export const home43Delta=JSON.parse(fs.readFileSync(new URL('./exact-delta.json',import.meta.url)));
// 家宅-43 缓存号（熊二）：copy87-preview-20261018-r1 → home43-20261018-r1，整批同号；撤回时新号个数必须正好等于记账数。
export const home43Cache=JSON.parse(fs.readFileSync(new URL('./cache-delta.json',import.meta.url)));
export function withoutHome43CacheDelta(path,source){
  for(const [after,before]of home43Cache.replacements?.[path]??[]){ // 依赖字节钉随缓存号重算
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('HOME43_CACHE_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  const want=home43Cache.counts[path];if(!want)return source;
  const n=source.split(home43Cache.new).length-1;
  if(n===0)return source; // 已撤过
  if(n!==want)throw Error('HOME43_CACHE_DELTA_NOT_EXACT: '+path);
  return source.split(home43Cache.new).join(home43Cache.old);
}
export function withoutHome43Delta(path,source){
  source=withoutCopy04Delta(path,source); // 文案-04 叠在 43 之后：先撤 04
  source=withoutHome43CacheDelta(path,source); // 缓存号叠在 43 之后：再撤缓存号
  for(const [after,before]of home43Delta[path]?.replacements??[]){
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('HOME43_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
