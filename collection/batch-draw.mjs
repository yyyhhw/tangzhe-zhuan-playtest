/**
 * 十连（batch draw）接口设计 —— 仅设计，未接入正式流程。
 * 正式 host（host-wallet.mjs）的 handle() 不接受任何 batch 命令；本文件不被 bootstrap / index 引用。
 *
 * 设计约定（供后续评审）：
 * - 一次十连 = 一个 batchId 下的 count 笔普通 draw 交易，逐笔走现有 BEGIN→…→COMMIT→ack 流程（不新增经济规则、不打折）。
 * - 容量：开始前一次性按 count × 单笔最坏预留检查；不够就整批拒绝（全有或全无地"开始"），不允许开到一半才发现满。
 * - 中断：已 committed 的子交易保留回执；未完成的子交易按单笔悬挂恢复规则处理；不回滚已提交子交易、不重复扣费。
 */
export const BATCH_DRAW_ENABLED = false;
export const BATCH_DRAW_MAX_COUNT = 10;
export function planBatchDraw({count, usedBytes, reservePerDrawBytes, maxBytes}) {
  if (!Number.isSafeInteger(count) || count < 1 || count > BATCH_DRAW_MAX_COUNT) return {ok:false, code:'INVALID_BATCH_COUNT'};
  for (const v of [usedBytes, reservePerDrawBytes, maxBytes]) if (!Number.isSafeInteger(v) || v < 0) return {ok:false, code:'INVALID_CAPACITY_INPUT'};
  const neededBytes = usedBytes + count * reservePerDrawBytes;
  const fits = neededBytes <= maxBytes;
  // Interface only: even when it fits, the formal flow is disabled.
  return {ok:false, code: fits ? 'BATCH_DRAW_NOT_ENABLED' : 'CAPACITY_LIMIT_REACHED', enabled:BATCH_DRAW_ENABLED, count, neededBytes, maxBytes, fits};
}
