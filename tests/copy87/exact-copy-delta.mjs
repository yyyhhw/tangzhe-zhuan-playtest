import fs from 'node:fs';
export const delta=JSON.parse(fs.readFileSync(new URL('./exact-copy-delta.json',import.meta.url)));
export const cacheDelta=JSON.parse(fs.readFileSync(new URL('./exact-cache-delta.json',import.meta.url)));
export function withoutCopy87CacheDelta(path,source){
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
