const mbtiTypes = require('../../data/mbti-types')
const api = require('../../utils/api')
const { hasUsableWechatProfile } = require('../../utils/profile-guard')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')

function getTypeMeta(type) {
  if (!type) return null
  for (let i = 0; i < mbtiTypes.length; i += 1) {
    if (mbtiTypes[i].type === type) return mbtiTypes[i]
  }
  return null
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

function mapRows(list) {
  if (!Array.isArray(list)) return []
  return list.map((item) => {
    const type = (item.result && item.result.type) || ''
    const meta = getTypeMeta(type)
    const friendName = item.ownerNickName || item.targetName || '好友'
    return {
      id: item.id,
      friendName,
      avatarUrl: (item.ownerAvatarUrl && String(item.ownerAvatarUrl).trim()) || '',
      avatarLoadFailed: false,
      typeCode: type || '--',
      alias: (meta && meta.alias) || '类型说明',
      timeText: formatTime(item.createdAt),
    }
  })
}

/** 接口就绪后在此拉取并 setData rows */
Page({
  data: {
    scrollInnerMinPx: 480,
    /** { id, friendName, avatarUrl, avatarLoadFailed, typeCode, alias, timeText }[] */
    rows: [],
  },

  onReady() {
    this._refreshScrollFill()
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
    const userId = gd.userId
    this._refreshScrollFill()
    if (!userId) {
      this.setData({ rows: [] })
      return
    }
    api
      .listMutualGiven(userId)
      .then((data) => {
        this.setData({ rows: mapRows(data) })
      })
      .catch(() => {
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ rows: [] })
      })
  },

  _refreshScrollFill() {
    const px = scrollInnerMinHeightPx({
      bottomRpx: 16 + 104 + 24,
      aboveScrollRpx: 8 + 20 + 72,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  onOwnerAvatarError(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const rows = this.data.rows.map((r) =>
      r.id === id ? { ...r, avatarLoadFailed: true } : r,
    )
    this.setData({ rows })
  },

  onOpenInfo(e) {
    const type = e.currentTarget.dataset.type
    if (!type || type === '--') {
      wx.showToast({ title: '暂无类型', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/info/index?type=${encodeURIComponent(type)}` })
  },

  onBackRecords() {
    wx.navigateBack({ delta: 1 })
  },
})
