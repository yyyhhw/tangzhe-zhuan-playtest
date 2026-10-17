/** 家宅-155 exact candidate delta, NOT a general normalizer（同 milestones/protection-baseline.mjs 的做法）.
 * preview/app.js 和 preview/pet/game/app.js 的整文件完整性断言（moon/resources、bb70/integration-scope、autosave15/scope）
 * 在算哈希前把这一行 155 修复换回 main 2af9076 的原行，其余字节照旧逐字锁定；旧哈希一个不改。
 * 这一行缺失、重复或被改动都会直接报错（HOME155_DELTA_NOT_EXACT），所以修复不会被悄悄撤掉。
 * 这只是测试记账，不代表对 155 功能本身的独立验收。
 */
export const HOME155_FILES=['preview/app.js','preview/pet/game/app.js'];
export const HOME155_OLD="  if (el && el.tagName === 'IMG' && el.dataset && el.dataset.homefb) { const fu = el.closest('.furn'); if (fu) fu.classList.remove('art'); el.remove(); } }, true);";
export const HOME155_NEW="  if (el && el.tagName === 'IMG' && el.dataset && el.dataset.homefb) { const fu = el.closest('.furn'); if (fu) fu.classList.remove('art'); if (el.classList.contains('room-art')) { const rm = el.closest('.room'); if (rm) rm.classList.remove('has-art'); } el.remove(); } }, true); // 家宅-155：房间底图坏了 → 先撤 has-art 再删图，退回无底图样子";
export function withoutHome155Delta(path,source){
 if(!HOME155_FILES.includes(path))return source;
 if(source.split(HOME155_NEW).length!==2||source.split(HOME155_OLD).length!==1)throw Error('HOME155_DELTA_NOT_EXACT: '+path);
 return source.replace(HOME155_NEW,()=>HOME155_OLD);
}
