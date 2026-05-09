const app = getApp()
const mbtiTypes = require('../../data/mbti-types.js')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')

function getTypeMeta(type) {
  const list = Array.isArray(mbtiTypes) ? mbtiTypes : []
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].type === type) return list[i]
  }
  return null
}

function getDimensionRows(counts) {
  if (!counts) return []
  const defs = [
    { leftLabel: 'I内向', lk: 'I', rightLabel: 'E外向', rk: 'E', grad: 'linear-gradient(90deg, #d8243f 0%, #3d62b6 100%)' },
    { leftLabel: 'S实感', lk: 'S', rightLabel: 'N直觉', rk: 'N', grad: 'linear-gradient(90deg, #7b39b2 0%, #efb076 100%)' },
    { leftLabel: 'T思维', lk: 'T', rightLabel: 'F情感', rk: 'F', grad: 'linear-gradient(90deg, #f5bb13 0%, #1480d8 100%)' },
    { leftLabel: 'J判断', lk: 'J', rightLabel: 'P知觉', rk: 'P', grad: 'linear-gradient(90deg, #2a9e9a 0%, #d06d10 100%)' },
  ]
  return defs.map((d) => {
    const lv = counts[d.lk] || 0
    const rv = counts[d.rk] || 0
    const t = Math.max(lv + rv, 1)
    const leftPercent = Math.round((lv / t) * 100)
    const rightPercent = Math.round((rv / t) * 100)
    return {
      leftLabel: d.leftLabel,
      rightLabel: d.rightLabel,
      leftPercent,
      rightPercent,
      splitPercent: leftPercent,
      grad: d.grad,
      leftCaption: `${d.leftLabel} ${leftPercent}%`,
      rightCaption: `${rightPercent}% ${d.rightLabel}`,
    }
  })
}

Page({
  data: {
    scrollInnerMinPx: 480,
    pageTitle: '测试结果',
    mode: 'self',
    type: '--',
    alias: '类型说明',
    keywords: [],
    summary: '',
    strengths: '',
    fit: '',
    showDimension: false,
    dimRows: [],
  },

  onReady() {
    this._refreshScrollFill()
  },

  _refreshScrollFill() {
    const mode = this.data.mode === 'mutual' ? 'mutual' : 'self'
    const bottomRpx =
      mode === 'mutual' ? 12 + 96 + 8 + 24 : 12 + 96 + 24 + 96 + 8 + 24
    const px = scrollInnerMinHeightPx({ bottomRpx })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  onShow() {
    const result = app.globalData.currentResult || {}
    const ctx = app.globalData.lastQuizContext || {}
    const mode = ctx.mode === 'mutual' ? 'mutual' : 'self'
    const type = result.type || '--'
    const meta =
      getTypeMeta(type) || {
        alias: '类型说明',
        keywords: [],
        summary: '当前结果暂无详细说明。',
        strengths: '请继续完善类型说明内容。',
        fit: '适合方向待补充。',
      }

    const pageTitle = mode === 'mutual' ? '互测已完成' : '测试结果'
    const showDimension = mode === 'mutual'
    const dimRows = showDimension ? getDimensionRows(result.counts) : []

    this.setData(
      {
        pageTitle,
        mode,
        type,
        alias: meta.alias || '',
        keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
        summary: meta.summary || '',
        strengths: meta.strengths || '',
        fit: meta.fit || '',
        showDimension,
        dimRows,
      },
      () => this._refreshScrollFill(),
    )
  },

  onInvite() {
    wx.navigateTo({ url: '/pages/invite/index' })
  },

  onHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
