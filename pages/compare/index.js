const { analyzeComparison, buildComparisonText } = require('../../utils/compare')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')
const mbtiTypes = require('../../data/mbti-types')

function truncateName(name) {
  if (!name) return '朋友'
  return name.length > 5 ? `${name.slice(0, 5)}...` : name
}

function typeAlias(code) {
  if (!code || code === '--') return '—'
  const u = String(code).trim().toUpperCase()
  for (let i = 0; i < mbtiTypes.length; i += 1) {
    if (mbtiTypes[i].type === u) return mbtiTypes[i].alias || u
  }
  return '未知类型'
}

/** 可跳转说明页的四字母类型，争议/不完整时返回空 */
function normalizeInfoType(raw) {
  if (!raw || raw === '--') return ''
  const u = String(raw).trim().toUpperCase()
  if (/^[EI][SN][TF][JP]$/.test(u)) return u
  return ''
}

Page({
  data: {
    scrollInnerMinPx: 480,
    friendName: '朋友',
    selfType: '--',
    mutualType: '--',
    selfAlias: '—',
    mutualAlias: '—',
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
        selfAlias: typeAlias(selfType),
        mutualAlias: typeAlias(mutualType),
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

  onOpenSelfType() {
    this._openTypeInfo(this.data.selfType)
  },

  onOpenMutualType() {
    this._openTypeInfo(this.data.mutualType)
  },

  _openTypeInfo(rawType) {
    const type = normalizeInfoType(rawType)
    if (!type) {
      wx.showToast({ title: '该类型暂无法查看说明', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/info/index?type=${encodeURIComponent(type)}` })
  },
})
