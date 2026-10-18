import fs from 'node:fs';
// 文案-04（收尾范围，熊二 17:1x 定）：「游戏金币」→「金币」、「+N/秒」→「每秒 +N」、设置卡名「存档」→「设置」；只改两份正式 app.js。
// 撤回时 after 必须恰好出现一次；若已撤回过（after 0 次、before 恰好 1 次）就原样返回，其余一律 NOT_EXACT。
export const copy04Delta=JSON.parse(fs.readFileSync(new URL('./exact-copy-delta.json',import.meta.url)));
export function withoutCopy04Delta(path,source){
  for(const [after,before]of copy04Delta[path]?.replacements??[]){
    const n=source.split(after).length-1;
    if(n===0&&source.split(before).length===2)continue;
    if(n!==1)throw Error('COPY04_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
