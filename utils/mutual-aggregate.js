/**
 * 与 code scenes/mutual-results.js 展示一致；统计口径增强：
 * - 优先累加每条互测记录的 result.counts（与单条结果页维度同源，和 buildMbtiType 一致）
 * - 无 counts 时再按 result.type / answers 推算的四字母，每维各 +1（与 code 原逻辑一致）
 */
const { buildMbtiType } = require('./mbti')

const LETTER_KEYS = ['E', 'I', 'S', 'N', 'T', 'F', 'J', 'P']

function emptyLetterTotals() {
  return { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
}

function getRecordMbtiType(rec) {
  if (!rec || typeof rec !== 'object') return ''
  const raw = (rec.result && rec.result.type) || ''
  const t = String(raw).trim().toUpperCase()
  if (t && /^[IE][SN][TF][JP]$/.test(t)) return t
  const answers = rec.answers
  if (Array.isArray(answers) && answers.length) {
    const computed = buildMbtiType(answers)
    const ct = (computed && computed.type) || ''
    if (ct && /^[IE][SN][TF][JP]$/.test(ct)) return ct
  }
  return ''
}

function addCountsMapToTotals(cm, totals) {
  if (!cm || typeof cm !== 'object' || Array.isArray(cm) || !totals) return 0
  let added = 0
  for (let k = 0; k < LETTER_KEYS.length; k += 1) {
    const key = LETTER_KEYS[k]
    const rawVal = cm[key] != null ? cm[key] : cm[key.toLowerCase()]
    if (rawVal == null) continue
    const n = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal), 10)
    if (!Number.isNaN(n) && n > 0) {
      totals[key] += n
      added += n
    }
  }
  return added
}

/** 从单条互测记录累加到八维总数：result.counts → answers 推算 counts → 否则四字母各 +1 */
function mergeRecordIntoLetterTotals(rec, totals) {
  if (!rec || typeof rec !== 'object' || !totals) return
  const r = rec.result
  if (r && r.counts && addCountsMapToTotals(r.counts, totals) > 0) return

  const answers = rec.answers
  if (Array.isArray(answers) && answers.length) {
    const computed = buildMbtiType(answers)
    if (computed && computed.counts && addCountsMapToTotals(computed.counts, totals) > 0) return
  }

  const type = getRecordMbtiType(rec)
  for (let j = 0; j < type.length; j += 1) {
    const ch = type[j]
    if (totals[ch] !== undefined) totals[ch] += 1
  }
}

function aggregateLetterTotalsFromList(list) {
  const counts = emptyLetterTotals()
  if (!Array.isArray(list)) return counts
  for (let i = 0; i < list.length; i += 1) {
    mergeRecordIntoLetterTotals(list[i], counts)
  }
  return counts
}

function aggregateTypeCodeFromList(list) {
  const counts = aggregateLetterTotalsFromList(list)
  if (counts.I + counts.E + counts.S + counts.N + counts.T + counts.F + counts.J + counts.P === 0) return ''
  const i = counts.I >= counts.E ? 'I' : 'E'
  const sn = counts.S >= counts.N ? 'S' : 'N'
  const tf = counts.T >= counts.F ? 'T' : 'F'
  const jp = counts.J >= counts.P ? 'J' : 'P'
  return `${i}${sn}${tf}${jp}`
}

/**
 * 「朋友们眼中的你」汇总标题：T/F 原始计数持平时第三字母显示为红色 ?，并用于展示争议提示。
 */
function buildFriendSummaryCompositeParts(list) {
  const counts = aggregateLetterTotalsFromList(list)
  const sum =
    counts.I + counts.E + counts.S + counts.N + counts.T + counts.F + counts.J + counts.P
  if (sum === 0) {
    return { parts: [], resolvedType: '', showTfControversyHint: false }
  }
  const i = counts.I >= counts.E ? 'I' : 'E'
  const sn = counts.S >= counts.N ? 'S' : 'N'
  const tf = counts.T >= counts.F ? 'T' : 'F'
  const jp = counts.J >= counts.P ? 'J' : 'P'
  const resolvedType = `${i}${sn}${tf}${jp}`
  const tCount = counts.T || 0
  const fCount = counts.F || 0
  const tfTie = tCount === fCount && tCount + fCount > 0
  const parts = tfTie
    ? [
        { text: i, disputed: false },
        { text: sn, disputed: false },
        { text: '?', disputed: true },
        { text: jp, disputed: false },
      ]
    : resolvedType.split('').map((ch) => ({ text: ch, disputed: false }))
  return { parts, resolvedType, showTfControversyHint: tfTie }
}

function topRawTypes(list, limit) {
  const freq = {}
  for (let i = 0; i < list.length; i += 1) {
    const t = getRecordMbtiType(list[i])
    if (t) freq[t] = (freq[t] || 0) + 1
  }
  const entries = Object.keys(freq).map((type) => ({ type, n: freq[type] }))
  entries.sort((a, b) => b.n - a.n || a.type.localeCompare(b.type))
  return entries.slice(0, limit).map((e) => e.type)
}

function buildAggregateCounts(list) {
  const counts = aggregateLetterTotalsFromList(list)
  const rows = [
    ['I内向', 'I', 'E外向', 'E'],
    ['S实感', 'S', 'N直觉', 'N'],
    ['T思维', 'T', 'F情感', 'F'],
    ['J判断', 'J', 'P知觉', 'P'],
  ]
  return rows.map(([leftLabel, leftKey, rightLabel, rightKey]) => ({
    leftLabel,
    leftCount: counts[leftKey] || 0,
    rightLabel,
    rightCount: counts[rightKey] || 0,
  }))
}

function buildDimRows(list) {
  const rows = [
    ['I内向', 'I', 'E外向', 'E', ['#d8243f', '#3d62b6']],
    ['S实感', 'S', 'N直觉', 'N', ['#7b39b2', '#efb076']],
    ['T思维', 'T', 'F情感', 'F', ['#f5bb13', '#1480d8']],
    ['J判断', 'J', 'P知觉', 'P', ['#2a9e9a', '#d06d10']],
  ]
  const counts = aggregateLetterTotalsFromList(list)
  return rows.map(([leftLabel, leftKey, rightLabel, rightKey, colors]) => {
    const total = Math.max(counts[leftKey] + counts[rightKey], 1)
    const c0 = colors[0]
    const c1 = colors[1]
    const lc = counts[leftKey] || 0
    const rc = counts[rightKey] || 0
    const splitEven = lc === rc && lc + rc > 0
    let splitHeavy = 'even'
    if (!splitEven) {
      if (lc > rc) splitHeavy = 'left'
      else if (rc > lc) splitHeavy = 'right'
    }
    return {
      leftLabel,
      rightLabel,
      leftPercent: Math.round((lc / total) * 100),
      rightPercent: Math.round((rc / total) * 100),
      splitHeavy,
      /** 整段渐变字符串，避免 WXML 里 {{item.colors[0]}} 在 Skyline 下不生效 */
      grad: `linear-gradient(90deg, ${c0}, ${c1})`,
    }
  })
}

module.exports = {
  getRecordMbtiType,
  aggregateLetterTotalsFromList,
  aggregateTypeCodeFromList,
  buildFriendSummaryCompositeParts,
  topRawTypes,
  buildAggregateCounts,
  buildDimRows,
}
