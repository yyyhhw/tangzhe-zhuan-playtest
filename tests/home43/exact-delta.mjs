import fs from 'node:fs';
// 家宅-43 候补（熊二）：「烟火小馆」24 件家具 + 57 动作类别 + 仓库保留不认识的 fid。
// 旧版本字节指纹链在最前面先撤这一层。撤回时 after 必须恰好出现一次；若已撤回过（after 0 次、before 恰好 1 次）就原样返回，其余一律 NOT_EXACT。
export const home43Delta=JSON.parse(fs.readFileSync(new URL('./exact-delta.json',import.meta.url)));
export function withoutHome43Delta(path,source){
  for(const [after,before]of home43Delta[path]?.replacements??[]){
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('HOME43_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
