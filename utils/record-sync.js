function todayYmd() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function dayKeyFromCreatedAt(createdAt) {
  if (createdAt == null) return ''
  const n = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt)
  if (Number.isNaN(n)) return ''
  const d = new Date(n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function syncRecordMutualCounts(app, recordId, list) {
  const raw = app.globalData.records
  if (!Array.isArray(raw)) return
  const rec = raw.find((r) => r.id === recordId)
  if (!rec) return
  const arr = Array.isArray(list) ? list : []
  const todayStr = todayYmd()
  const todayCount = arr.filter((item) => dayKeyFromCreatedAt(item && item.createdAt) === todayStr).length
  rec.mutualCount = arr.length
  rec.todayMutualCount = todayCount
}

module.exports = {
  syncRecordMutualCounts,
}
