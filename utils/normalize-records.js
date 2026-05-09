/** 与 code/minigame/src/data/storage.js normalizeSelfRecords 一致 */
function normalizeSelfRecords(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => item && item.mode !== 'mutual')
    .map((item) => ({
      id: item.selfTestId || item.id,
      mode: item.mode || 'self',
      createdAt: item.createdAt,
      answers: item.answers || [],
      result: item.result || null,
      mutualCount: typeof item.mutualCount === 'number' ? item.mutualCount : 0,
      todayMutualCount: typeof item.todayMutualCount === 'number' ? item.todayMutualCount : 0,
      inviteId: item.inviteId,
    }))
}

module.exports = { normalizeSelfRecords }
