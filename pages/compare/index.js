const { analyzeComparison, buildComparisonText } = require('../../utils/compare')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')

function truncateName(name) {
  if (!name) return '朋友'
  return name.length > 5 ? `${name.slice(0, 5)}...` : name
}

Page({
  data: {
    scrollInnerMinPx: 480,
    friendName: '朋友',
    selfType: '--',
    mutualType: '--',
    score: 0,
    title: '',
    lines: [],
  },

  onLoad() {
    const app = getApp()
    const ctx = app.globalData.compareContext
    if (!ctx || !ctx.selfRecord || !ctx.mutualRecord) {
      wx.showToast({ title: '数据缺失', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }
    const selfType = (ctx.selfRecord.result && ctx.selfRecord.result.type) || '--'
    const mutualType = (ctx.mutualRecord.result && ctx.mutualRecord.result.type) || '--'
    const friendName = truncateName(ctx.mutualRecord.friendNickName || '朋友')
    const analysis = analyzeComparison(selfType, mutualType)
    this._copyText = buildComparisonText(selfType, mutualType, friendName)
    this.setData(
      {
        friendName,
        selfType,
        mutualType,
        score: analysis.score,
        title: analysis.title,
        lines: analysis.lines || [],
      },
      () => this._refreshScrollFill(),
    )
  },

  onReady() {
    this._refreshScrollFill()
  },

  _refreshScrollFill() {
    const px = scrollInnerMinHeightPx({
      bottomRpx: 16 + 32 + 24,
      includeSafeBottom: false,
      extraPx: 12,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  onCopy() {
    const t = this._copyText || ''
    if (!t) return
    wx.setClipboardData({
      data: t,
      success: () => wx.showToast({ title: '已复制', icon: 'none' }),
    })
  },
})
