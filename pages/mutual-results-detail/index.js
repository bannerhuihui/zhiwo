const api = require('../../utils/api')
const { publicAvatarUrl } = require('../../utils/avatar-url')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')
const { syncRecordMutualCounts } = require('../../utils/record-sync')
const { getRecordMbtiType } = require('../../utils/mutual-aggregate')
const { MIN_MUTUAL_EVALUATIONS_FOR_VIEW } = require('../../utils/mutual-view-gate')

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

function truncateName(name) {
  if (!name) return ''
  return name.length > 5 ? `${name.slice(0, 5)}...` : name
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTime(createdAt) {
  const t = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pickFriendField(raw, camel, snake) {
  if (!raw || typeof raw !== 'object') return ''
  const a = raw[camel]
  if (a != null && String(a).trim()) return String(a).trim()
  const b = raw[snake]
  if (b != null && String(b).trim()) return String(b).trim()
  return ''
}

function normalizeMutualItem(raw, index, selfType) {
  const id = raw.id || raw._id || `idx-${index}`
  const friendType = getRecordMbtiType(raw) || '--'
  const same = !!selfType && selfType.length === 4 && friendType === selfType
  const nick = pickFriendField(raw, 'friendNickName', 'friend_nick_name')
  const avatar = publicAvatarUrl(pickFriendField(raw, 'friendAvatarUrl', 'friend_avatar_url'))
  return {
    id: String(id),
    friendNickName: truncateName(nick || `朋友${index + 1}`),
    friendAvatarUrl: avatar,
    friendAvatarLoadFailed: false,
    friendType,
    timeText: formatTime(raw.createdAt),
    chipText: same ? '结果一致' : '结果不同',
    chipSame: same,
    raw,
  }
}

function mergeAllFromApi(app) {
  const raw = app.globalData.records
  if (!Array.isArray(raw) || !raw.length) return Promise.resolve([])
  return Promise.all(raw.map((rec) => api.getMutualResults(rec.id).catch(() => []))).then((results) => {
    const merged = []
    results.forEach((list, idx) => {
      const arr = Array.isArray(list) ? list : []
      const rec = raw[idx]
      if (rec) syncRecordMutualCounts(app, rec.id, arr)
      merged.push(...arr)
    })
    return merged
  })
}

Page({
  data: {
    scrollInnerMinPx: 480,
    loading: true,
    scopeAll: false,
    recordId: '',
    selfType: '--',
    showSelfSub: true,
    backLabel: '返回测试记录',
    from: '',
    rows: [],
  },

  onLoad(query) {
    const app = getApp()
    const scopeAll = query.scope === 'all'
    const from = query.from || ''

    if (scopeAll) {
      app.globalData._showMutualSelfResult = false
      const raw = app.globalData.records
      const firstSelf = Array.isArray(raw) ? raw.find((r) => r.result && r.result.type) : null
      if (firstSelf) app.globalData.currentSelfRecord = firstSelf
      this.setData(
        {
          scopeAll: true,
          showSelfSub: false,
          backLabel: '返回汇总',
          from,
        },
        () => this._refreshScrollFill(),
      )
      this.loadListAll()
      return
    }

    const recordId = query.recordId ? decodeURIComponent(query.recordId) : ''
    if (!recordId) {
      wx.showToast({ title: '缺少记录参数', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }
    app.globalData._showMutualSelfResult = true
    const rec = findSelfRecord(app, recordId)
    const selfType = (rec && rec.result && rec.result.type) || '--'
    app.globalData.currentSelfRecord = rec || app.globalData.currentSelfRecord || { id: recordId, result: { type: selfType } }

    const backLabel = from === 'records' ? '返回测试记录' : '返回汇总'
    this.setData(
      {
        scopeAll: false,
        recordId,
        selfType,
        showSelfSub: true,
        backLabel,
        from,
      },
      () => this._refreshScrollFill(),
    )
    this.loadListSingle()
  },

  onReady() {
    this._refreshScrollFill()
  },

  _refreshScrollFill() {
    const { showSelfSub } = this.data
    const px = scrollInnerMinHeightPx({
      bottomRpx: 16 + 116 + 24,
      aboveScrollRpx: showSelfSub ? 88 : 0,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  loadListAll() {
    const app = getApp()
    const apply = (merged) => {
      app.globalData._mutualAllList = merged
      const selfType = '--'
      this.applyList(merged, selfType)
    }

    let merged = app.globalData._mutualAllList
    if (Array.isArray(merged) && merged.length) {
      apply(merged)
      return
    }

    wx.showLoading({ title: '加载中', mask: true })
    mergeAllFromApi(app)
      .then((list) => {
        wx.hideLoading()
        apply(list)
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      })
  },

  loadListSingle() {
    const app = getApp()
    const { recordId } = this.data
    const selfType = this.data.selfType

    const cache = app.globalData._mutualResultsCache && app.globalData._mutualResultsCache[recordId]
    if (Array.isArray(cache)) {
      this.applyList(cache, selfType)
      return
    }

    wx.showLoading({ title: '加载中', mask: true })
    api
      .getMutualResults(recordId)
      .then((list) => {
        wx.hideLoading()
        const arr = Array.isArray(list) ? list : []
        syncRecordMutualCounts(app, recordId, arr)
        app.globalData._mutualResultsCache = app.globalData._mutualResultsCache || {}
        app.globalData._mutualResultsCache[recordId] = arr
        this.applyList(arr, selfType)
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '互测结果加载失败', icon: 'none' })
        this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      })
  },

  applyList(arr, selfTypeForChip) {
    if (!arr.length) {
      this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      return
    }
    if (this.data.scopeAll && arr.length < MIN_MUTUAL_EVALUATIONS_FOR_VIEW) {
      const app = getApp()
      delete app.globalData._mutualAllList
      this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      showMutualTooFewThenBack()
      return
    }
    const rows = arr.map((item, i) => normalizeMutualItem(item, i, selfTypeForChip))
    this.setData({ loading: false, rows }, () => this._refreshScrollFill())
  },

  onFriendAvatarError(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const rows = this.data.rows.map((r) =>
      r.id === id ? { ...r, friendAvatarLoadFailed: true } : r,
    )
    this.setData({ rows })
  },

  onOpenCompare(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const row = this.data.rows.find((r) => r.id === id)
    if (!row || !row.raw) return
    const app = getApp()
    app.globalData.compareContext = {
      selfRecord: app.globalData.currentSelfRecord,
      mutualRecord: row.raw,
    }
    wx.navigateTo({ url: '/pages/compare/index' })
  },

  onBack() {
    wx.navigateBack()
  },
})
