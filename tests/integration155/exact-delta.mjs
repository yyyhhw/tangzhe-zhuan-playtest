import fs from 'node:fs';
import {withoutCopy166Delta} from '../copy166/exact-copy-delta.mjs';
const imports=JSON.parse(fs.readFileSync(new URL('./cache-import-delta.json',import.meta.url)));
const preview=JSON.parse(fs.readFileSync(new URL('./preview-ux-delta.json',import.meta.url))).deltas;
function reverse(source,after,before,label){
  if(source.split(after).length!==2)throw Error('INTEGRATION_DELTA_NOT_EXACT: '+label);
  return source.replace(after,()=>before);
}
// Keep every prior guard and original hash. Only these complete import lines may differ.
export function withoutIntegrationCacheDelta(path,source){
  for(const [after,before]of imports[path]??[])source=reverse(source,after,before,path);
  return source;
}
// Account for the two reviewed UX158/160 preview lines independently of HOME155.
export function withoutPreviewUxDelta(path,source){
  source=withoutCopy166Delta(path,source); // 体验-166：TOAST_GOOD 加词在 UX158/160 之后，先撤
  for(const [after,before]of preview[path]??[])source=reverse(source,after,before,path);
  return source;
}
// The only allowed change inside the published autosave frame: one redraw hook.
export function withoutStoryFrameDelta(path,name,source){
  if(name!=='frame'||!['app.js','pet/game/app.js'].includes(path))return source;
  return reverse(source,'  homeAdvanceActor(dt);\n  storyRefreshPeriod();\n','  homeAdvanceActor(dt);\n',path+':frame');
}
