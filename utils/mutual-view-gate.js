/**
 * 互测相关门槛配置（仅小程序「朋友们眼中的你」汇总等逻辑使用）。
 *
 * MIN_MUTUAL_EVALUATIONS_FOR_VIEW：进入「全部汇总」页所需的累计互测条数下限（0=不限制）。
 *
 * MIN_FRIEND_MUTUAL_FOR_DIM：「维度倾向」区块开放条件。
 * - 汇总拉取的累计互测记录数（merged 条数）小于该值 → 显示遮罩 + 遮罩文案，隐藏下方维度条。
 * - 大于等于该值 → 不显示遮罩，维度倾向完整展示。
 *（每条互测对应一次好友作答；若产品要求「5 个不同好友」而非「5 条记录」，需在合并结果上对 friendUserId 去重后再判断。）
 */
module.exports = {
  MIN_MUTUAL_EVALUATIONS_FOR_VIEW: 0,

  /**
   * 累计好友互测条数 ≥ 此数值时，开放「维度倾向」；小于则遮罩。
   */
  MIN_FRIEND_MUTUAL_FOR_DIM: 5,
}
