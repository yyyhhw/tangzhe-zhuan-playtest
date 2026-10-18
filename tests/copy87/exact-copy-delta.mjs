import fs from 'node:fs';
export const delta=JSON.parse(fs.readFileSync(new URL('./exact-copy-delta.json',import.meta.url)));
export const cacheDelta=JSON.parse(fs.readFileSync(new URL('./exact-cache-delta.json',import.meta.url)));
// 文案-167：在 copy87 之后的纯文案改动；先精确撤回它，再走 copy87 的撤回。
export const copy167Delta=JSON.parse(fs.readFileSync(new URL('../copy167/exact-copy-delta.json',import.meta.url)));
export function withoutCopy167Delta(path,source){
  for(const [after,before]of copy167Delta[path]?.replacements??[]){
    if(source.split(after).length!==2)throw Error('COPY167_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
export function withoutCopy87CacheDelta(path,source){
  source=withoutCopy167Delta(path,source);
  for(const [after,before]of cacheDelta[path]?.replacements??[]){
    if(source.split(after).length!==2)throw Error('COPY87_CACHE_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
export function withoutCopy87Delta(path,source){
  source=withoutCopy87CacheDelta(path,source);
  for(const [after,before]of delta[path]?.replacements??[]){
    if(source.split(after).length!==2)throw Error('COPY87_DELTA_NOT_EXACT: '+path);
    source=source.replace(after,()=>before);
  }
  return source;
}
