function analyzeComparison(selfType, mutualType) {
  if (!selfType || !mutualType || selfType.length !== 4 || mutualType.length !== 4) {
    return {
      score: 0,
      title: '结果不足，暂无法分析',
      lines: ['请先确保自测与互测结果都已生成。'],
      diffs: [],
    }
  }

  const labels = ['外向/内向', '现实/直觉', '理性/感性', '秩序/随性']
  let same = 0
  const diffs = []
  for (let i = 0; i < 4; i += 1) {
    if (selfType[i] === mutualType[i]) same += 1
    else diffs.push(labels[i])
  }
  const score = same * 25
  let title = '你们对彼此的认知差异较大'
  if (score === 100) title = '默契度很高，你们的认知几乎一致'
  else if (score >= 75) title = '默契度较高，大部分印象是一致的'
  else if (score >= 50) title = '有一定默契，但也存在明显差异'

  return {
    score,
    title,
    diffs,
    lines: diffs.length
      ? [`差异主要集中在：${diffs.join('、')}`, '这通常说明你眼中的自己，与朋友观察到的一面并不完全相同。']
      : ['四个维度都一致，说明你对自己的认知与朋友的印象高度贴合。'],
  }
}

function buildComparisonText(selfType, mutualType, friendName) {
  const analysis = analyzeComparison(selfType, mutualType)
  const name = friendName || '朋友'
  const summary = [
    '知我几分分析',
    `我的自测：${selfType || '--'}`,
    `${name}眼中的我：${mutualType || '--'}`,
    `认知贴合度：${analysis.score}%`,
    `${analysis.title}`,
  ]
  if (analysis.lines && analysis.lines.length) {
    for (let i = 0; i < analysis.lines.length; i += 1) summary.push(analysis.lines[i])
  }
  return summary.join('\n')
}

module.exports = {
  analyzeComparison,
  buildComparisonText,
}
