import fs from 'node:fs';
import {withoutCopy06Delta} from '../copy06/exact-copy-delta.mjs';
// 体验-166：「集齐 N 张故事卡：」toast 走好消息样式，只在四份 TOAST_GOOD 里加一个词。
// 撤回时 after 必须恰好出现一次；若这条链上游已撤回过（after 0 次、before 恰好 1 次）就原样返回，其余情况一律 NOT_EXACT。
export const copy166Delta=JSON.parse(fs.readFileSync(new URL('./exact-copy-delta.json',import.meta.url)));
export function withoutCopy166Delta(path,source){
  source=withoutCopy06Delta(path,source); // 文案-06 收尾版叠在 166 之后，先撤 06
  for(const [after,before]of copy166Delta[path]?.replacements??[]){
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('COPY166_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
