const mbtiTypes = require('../../data/mbti-types')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')

function getTypeMeta(type) {
  if (!type) return null
  for (let i = 0; i < mbtiTypes.length; i += 1) {
    if (mbtiTypes[i].type === type) return mbtiTypes[i]
  }
  return null
}

const MIN_MUTUAL_EVALUATIONS_FOR_VIEW = 10
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
      bottomRpx: 16 + 104 + 24 + 104 + 24,
      aboveScrollRpx: 8 + 20 + 48,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  onShow() {
    this.loadRecords()
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
