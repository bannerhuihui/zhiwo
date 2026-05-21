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

/** 可展示说明的四字母 MBTI；争议/不完整时返回空字符串 */
function normalizeInfoType(raw) {
  if (!raw || raw === '--') return ''
  const u = String(raw).trim().toUpperCase()
  if (/^[EI][SN][TF][JP]$/.test(u)) return u
  return ''
}

/** 规范化并从本地数据中取出详情；找不到时返回 null */
function findTypeDetail(raw) {
  const u = normalizeInfoType(raw)
  if (!u) return null
  for (let i = 0; i < mbtiTypes.length; i += 1) {
    if (mbtiTypes[i].type === u) {
      const row = mbtiTypes[i]
      return {
        type: row.type,
        alias: row.alias || '',
        keywords: Array.isArray(row.keywords) ? row.keywords : [],
        summary: row.summary || '',
        strengths: row.strengths || '',
        fit: row.fit || '',
      }
    }
  }
  return null
}

Page({
  data: {
    scrollInnerMinPx: 480,
    /** 双侧类型区标题（默认可来自 compareContext.selfTypesLabel 等覆盖） */
    selfTypesLabel: '你的自测',
    mutualTypesLabel: '朋友眼中的你',
    friendName: '朋友',
    selfType: '--',
    mutualType: '--',
    selfAlias: '—',
    mutualAlias: '—',
    score: 0,
    title: '',
    lines: [],
    typeModalVisible: false,
    modalTypeItem: null,
  },

  onLoad() {
    const app = getApp()
    const ctx = app.globalData.compareContext
    if (!ctx || !ctx.selfRecord || !ctx.mutualRecord) {
      wx.showToast({ title: '数据缺失', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }
    const comparisonVariant =
      ctx.comparisonVariant === 'mutual_given' ? 'mutual_given' : 'default'

    const selfType = (ctx.selfRecord.result && ctx.selfRecord.result.type) || '--'
    const mutualType = (ctx.mutualRecord.result && ctx.mutualRecord.result.type) || '--'
    const friendName = truncateName(ctx.mutualRecord.friendNickName || '朋友')

    let selfTypesLabel = '你的自测'
    let mutualTypesLabel = `${friendName}眼中的你`
    if (comparisonVariant === 'mutual_given') {
      selfTypesLabel = '对方的自测'
      mutualTypesLabel = '你给 TA 的互测'
    }
    if (typeof ctx.selfTypesLabel === 'string' && ctx.selfTypesLabel.trim()) {
      selfTypesLabel = ctx.selfTypesLabel.trim()
    }
    if (typeof ctx.mutualTypesLabel === 'string' && ctx.mutualTypesLabel.trim()) {
      mutualTypesLabel = ctx.mutualTypesLabel.trim()
    }

    const analysis = analyzeComparison(selfType, mutualType, comparisonVariant)
    this._copyText = buildComparisonText(selfType, mutualType, friendName, comparisonVariant)

    this.setData(
      {
        selfTypesLabel,
        mutualTypesLabel,
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
    const detail = findTypeDetail(rawType)
    if (!detail) {
      wx.showToast({ title: '该类型暂无法查看说明', icon: 'none' })
      return
    }
    this.setData({
      typeModalVisible: true,
      modalTypeItem: detail,
    })
  },

  onCloseTypeModal() {
    this.setData({
      typeModalVisible: false,
      modalTypeItem: null,
    })
  },

  /** 仅供弹层面板拦截，减少底层页面误触滚动 */
  onTypeModalCatchMove() {},
})
