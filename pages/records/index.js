const mbtiTypes = require('../../data/mbti-types')
const { hasUsableWechatProfile } = require('../../utils/profile-guard')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')
const { loadRemoteRecords } = require('../../utils/session')
const { MIN_MUTUAL_EVALUATIONS_FOR_VIEW } = require('../../utils/mutual-view-gate')

function getTypeMeta(type) {
  if (!type) return null
  for (let i = 0; i < mbtiTypes.length; i += 1) {
    if (mbtiTypes[i].type === type) return mbtiTypes[i]
  }
  return null
}

const MUTUAL_TOO_FEW_MSG =
  '对您进行的评价，不到10份，无法查看此结果。请继续邀请朋友，对您进行评价。'

function showMutualTooFewModal() {
  wx.showModal({ title: '提示', content: MUTUAL_TOO_FEW_MSG, showCancel: false })
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

function normalizeRecord(rec) {
  const type = (rec.result && rec.result.type) || ''
  const meta = getTypeMeta(type)
  const keywords = (meta && meta.keywords ? meta.keywords.slice(0, 3) : [])
  const mutualTotal = typeof rec.mutualCount === 'number' ? rec.mutualCount : 0
  const todayCount = typeof rec.todayMutualCount === 'number' ? rec.todayMutualCount : 0
  return {
    id: rec.id,
    typeCode: type || '--',
    alias: (meta && meta.alias) || '类型说明',
    keywords,
    timeText: formatTime(rec.createdAt),
    mutualTotal,
    todayCount,
    showToday: todayCount > 0,
  }
}

function buildRows(list) {
  return list.map(normalizeRecord)
}

function totalMutualFriendsCount(list) {
  if (!Array.isArray(list)) return 0
  let n = 0
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i].mutualCount
    if (typeof c === 'number') n += c
  }
  return n
}

Page({
  data: {
    scrollInnerMinPx: 480,
    recordRows: [],
    mutualAllBtnLabel: '0位朋友们眼中的你',
  },

  onReady() {
    this._refreshScrollFill()
  },

  _refreshScrollFill() {
    const px = scrollInnerMinHeightPx({
      bottomRpx: 16 + 104 + 24 + 104 + 24 + 104 + 24,
      aboveScrollRpx: 8 + 20 + 48,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  /** 与 session.loadRemoteRecords 一致；并发时复用同一次请求。 */
  _syncRecordsFromServer() {
    const app = getApp()
    const userId = app.globalData && app.globalData.userId
    if (!userId) return Promise.resolve()
    if (this._recordsRefreshPromise) return this._recordsRefreshPromise
    this._recordsRefreshPromise = loadRemoteRecords(app, userId, { keepOnError: true }).finally(() => {
      this._recordsRefreshPromise = null
    })
    return this._recordsRefreshPromise
  },

  onShow() {
    const app = getApp()
    const gd = app.globalData || {}
    if (gd.authStatus !== 'success') {
      wx.redirectTo({ url: '/pages/records-auth-hint/index?step=login' })
      return
    }
    if (!hasUsableWechatProfile(gd.profile)) {
      wx.redirectTo({ url: '/pages/records-auth-hint/index?step=profile' })
      return
    }
    this.loadRecords()
    this._syncRecordsFromServer().then(() => this.loadRecords())
  },

  onPullDownRefresh() {
    const app = getApp()
    if (!app.globalData.userId || app.globalData.authStatus !== 'success') {
      wx.stopPullDownRefresh()
      return
    }
    this._syncRecordsFromServer()
      .then(() => this.loadRecords())
      .finally(() => wx.stopPullDownRefresh())
  },

  loadRecords() {
    const app = getApp()
    let raw = app.globalData && app.globalData.records
    if (!Array.isArray(raw)) raw = []
    const total = totalMutualFriendsCount(raw)
    this.setData({
      recordRows: buildRows(raw),
      mutualAllBtnLabel: `${total}位朋友们眼中的你`,
    })
    this._rawRecords = raw
  },

  onOpenMutualGiven() {
    wx.navigateTo({ url: '/pages/mutual-given-list/index' })
  },

  onOpenMutual(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/mutual-results/index?recordId=${encodeURIComponent(id)}` })
  },

  onOpenInfo(e) {
    const type = e.currentTarget.dataset.type
    if (!type || type === '--') {
      wx.showToast({ title: '暂无类型', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/info/index?type=${encodeURIComponent(type)}` })
  },

  onMutualAll() {
    const raw = this._rawRecords || []
    if (!raw.length) {
      wx.showToast({ title: '暂无测试记录', icon: 'none' })
      return
    }
    const total = totalMutualFriendsCount(raw)
    if (total < MIN_MUTUAL_EVALUATIONS_FOR_VIEW) {
      showMutualTooFewModal()
      return
    }
    wx.navigateTo({ url: '/pages/mutual-results/index?scope=all' })
  },

  onHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
