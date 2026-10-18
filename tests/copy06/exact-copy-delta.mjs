import fs from 'node:fs';
// 文案-06（收尾版）：盲盒规则、离线说明改短，只改正式 app.js / pet/game/app.js 两处字。
// 撤回时 after 必须恰好出现一次；若上游已撤回过（after 0 次、before 恰好 1 次）就原样返回，其余情况一律 NOT_EXACT。
export const copy06Delta=JSON.parse(fs.readFileSync(new URL('./exact-copy-delta.json',import.meta.url)));
export function withoutCopy06Delta(path,source){
  for(const [after,before]of copy06Delta[path]?.replacements??[]){
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('COPY06_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
