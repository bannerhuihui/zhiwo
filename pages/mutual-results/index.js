const api = require('../../utils/api')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')
const { syncRecordMutualCounts } = require('../../utils/record-sync')
const {
  buildFriendSummaryCompositeParts,
  topRawTypes,
  buildAggregateCounts,
  buildDimRows,
} = require('../../utils/mutual-aggregate')
const mbtiTypes = require('../../data/mbti-types')

const MIN_MUTUAL_EVALUATIONS_FOR_VIEW = 10
const MUTUAL_TOO_FEW_MSG =
  '对您进行的评价，不到10份，无法查看此结果。请继续邀请朋友，对您进行评价。'

function showMutualTooFewThenBack() {
  wx.showModal({
    title: '提示',
    content: MUTUAL_TOO_FEW_MSG,
    showCancel: false,
    complete: () => wx.navigateBack(),
  })
}

function findSelfRecord(app, recordId) {
  const raw = app.globalData.records
  if (!Array.isArray(raw)) return null
  return raw.find((r) => r.id === recordId) || null
}

function getTypeMeta(type) {
  if (!type) return null
  for (let i = 0; i < mbtiTypes.length; i += 1) {
    if (mbtiTypes[i].type === type) return mbtiTypes[i]
  }
  return null
}

/** 固定 4 枚胶囊，拆成 2×2；带 pillTone 供 WXML 使用（不依赖 CSS grid） */
function buildPillPairs(pillRows) {
  const defaults = [
    { leftLabel: 'I内向', leftCount: 0, rightLabel: 'E外向', rightCount: 0 },
    { leftLabel: 'S实感', leftCount: 0, rightLabel: 'N直觉', rightCount: 0 },
    { leftLabel: 'T思维', leftCount: 0, rightLabel: 'F情感', rightCount: 0 },
    { leftLabel: 'J判断', leftCount: 0, rightLabel: 'P知觉', rightCount: 0 },
  ]
  const p = Array.isArray(pillRows) ? pillRows.slice(0, 4) : []
  for (let i = 0; i < 4; i += 1) {
    if (!p[i]) p[i] = { ...defaults[i] }
  }
  const tones = ['pill-mint', 'pill-lemon', 'pill-mint', 'pill-lemon']
  const four = p.map((row, i) => ({
    leftLabel: row.leftLabel,
    leftCount: row.leftCount,
    rightLabel: row.rightLabel,
    rightCount: row.rightCount,
    pillTone: tones[i],
  }))
  return [four.slice(0, 2), four.slice(2, 4)]
}

function buildSummaryFields(list) {
  if (!list.length) {
    return {
      hasSummaryData: false,
      composite: '',
      compositeParts: [],
      showTfControversyHint: false,
      aliasTop: '',
      topTypesText: '',
      showTopTypes: false,
      pillRows: [],
      pillPairs: [],
      dimRows: [],
      totalFriends: 0,
    }
  }
  const compositeExtras = buildFriendSummaryCompositeParts(list)
  const composite = compositeExtras.resolvedType
  const compositeParts = compositeExtras.parts
  const showTfControversyHint = compositeExtras.showTfControversyHint
  const meta = composite && !showTfControversyHint ? getTypeMeta(composite) : null
  const aliasTop = (meta && meta.alias) || ''
  const tops = topRawTypes(list, 3)
  const topTypesText = tops.length ? `好友测评中最常出现的类型：${tops.join('、')}` : ''
  const pillRows = buildAggregateCounts(list)
  return {
    hasSummaryData: true,
    composite,
    compositeParts,
    showTfControversyHint,
    aliasTop,
    topTypesText,
    showTopTypes: tops.length > 0,
    pillRows,
    pillPairs: buildPillPairs(pillRows),
    dimRows: buildDimRows(list),
    totalFriends: list.length,
  }
}

Page({
  data: {
    scrollInnerMinPx: 480,
    loading: true,
    modeAll: false,
    showContent: false,
    hasSummaryData: false,
    selfType: '--',
    showSelfSub: false,
    composite: '',
    compositeParts: [],
    showTfControversyHint: false,
    aliasTop: '',
    topTypesText: '',
    showTopTypes: false,
    pillRows: [],
    pillPairs: [],
    dimRows: [],
    totalFriends: 0,
    primaryBtnText: '返回记录',
  },

  onReady() {
    this._refreshScrollMin()
  },

  _refreshScrollMin() {
    const px = scrollInnerMinHeightPx({ bottomRpx: 16 + 104 + 24 + 104 + 24 })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  onLoad(query) {
    if (query.scope === 'all') {
      this.modeAll = true
      this.setData({ modeAll: true, showSelfSub: false })
      this.loadAllMutual()
      return
    }
    this.modeAll = false
    const recordId = query.recordId ? decodeURIComponent(query.recordId) : ''
    if (!recordId) {
      wx.showToast({ title: '缺少记录参数', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }
    this.recordId = recordId
    const app = getApp()
    const rec = findSelfRecord(app, recordId)
    const selfType = (rec && rec.result && rec.result.type) || '--'
    app.globalData.currentSelfRecord = rec || { id: recordId, result: null }
    app.globalData._showMutualSelfResult = true
    this.setData({ selfType, showSelfSub: true })
    this.fetchSingleAndRoute()
  },

  /** 与 code openAllMutualResults：汇总全部记录的互测，先展示过渡页 */
  loadAllMutual() {
    const app = getApp()
    const raw = app.globalData.records
    if (!Array.isArray(raw) || !raw.length) {
      wx.showToast({ title: '暂无测试记录', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }

    const firstSelf = raw.find((r) => r.result && r.result.type)
    app.globalData.currentSelfRecord = firstSelf || raw[0]
    app.globalData._showMutualSelfResult = false

    const finish = (merged, perRecordLists) => {
      perRecordLists.forEach((arr, idx) => {
        const rec = raw[idx]
        if (rec) syncRecordMutualCounts(app, rec.id, Array.isArray(arr) ? arr : [])
      })
      if (!Array.isArray(merged) || merged.length < MIN_MUTUAL_EVALUATIONS_FOR_VIEW) {
        delete app.globalData._mutualAllList
        this.setData({ loading: false, showContent: false }, () => this._refreshScrollMin())
        showMutualTooFewThenBack()
        return
      }
      app.globalData._mutualAllList = merged
      const summary = buildSummaryFields(merged)
      const primaryBtnText = merged.length ? '查看详情' : '返回记录'
      this.setData(
        {
          loading: false,
          showContent: true,
          primaryBtnText,
          ...summary,
        },
        () => this._refreshScrollMin(),
      )
    }

    wx.showLoading({ title: '加载中', mask: true })
    Promise.all(raw.map((rec) => api.getMutualResults(rec.id).catch(() => [])))
      .then((results) => {
        wx.hideLoading()
        const merged = []
        results.forEach((list) => {
          if (Array.isArray(list)) merged.push(...list)
        })
        finish(merged, results)
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '互测结果加载失败', icon: 'none' })
        raw.forEach((rec) => syncRecordMutualCounts(app, rec.id, []))
        setTimeout(() => wx.navigateBack(), 400)
      })
  },

  /** 单条记录：无互测时停留本页；有互测时与 code 一致直达详情 */
  fetchSingleAndRoute() {
    const app = getApp()
    wx.showLoading({ title: '加载中', mask: true })
    api
      .getMutualResults(this.recordId)
      .then((list) => {
        wx.hideLoading()
        const arr = Array.isArray(list) ? list : []
        syncRecordMutualCounts(app, this.recordId, arr)
        app.globalData._mutualResultsCache = app.globalData._mutualResultsCache || {}
        app.globalData._mutualResultsCache[this.recordId] = arr
        if (arr.length) {
          wx.redirectTo({
            url: `/pages/mutual-results-detail/index?recordId=${encodeURIComponent(this.recordId)}&from=records`,
          })
          return
        }
        this.setData(
          {
            loading: false,
            showContent: true,
            hasSummaryData: false,
            primaryBtnText: '返回记录',
          },
          () => this._refreshScrollMin(),
        )
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '互测结果加载失败', icon: 'none' })
        syncRecordMutualCounts(app, this.recordId, [])
        app.globalData._mutualResultsCache = app.globalData._mutualResultsCache || {}
        app.globalData._mutualResultsCache[this.recordId] = []
        this.setData(
          {
            loading: false,
            showContent: true,
            hasSummaryData: false,
            primaryBtnText: '返回记录',
          },
          () => this._refreshScrollMin(),
        )
      })
  },

  onPrimaryTap() {
    if (this.modeAll && this.data.hasSummaryData) {
      wx.navigateTo({
        url: '/pages/mutual-results-detail/index?scope=all&from=summary',
      })
      return
    }
    this.onBackRecords()
  },

  onBackRecords() {
    wx.navigateBack()
  },

  onHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
