const api = require('../../utils/api')
const { publicAvatarUrl } = require('../../utils/avatar-url')
const { hasUsableWechatProfile } = require('../../utils/profile-guard')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTime(createdAt) {
  const t = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 四位 MBTI */
function normalizeFour(type) {
  if (!type || typeof type !== 'string') return ''
  const u = type.trim().toUpperCase()
  return /^[EI][SN][TF][JP]$/.test(u) ? u : ''
}

function truncateName(name) {
  const s = (name || '').trim()
  if (!s) return '好友'
  return s.length > 5 ? `${s.slice(0, 5)}...` : s
}

/** 与同页 mutual-results-detail 一致的列表项字段 + 跳转 compare 用 compare* */
function mapRows(list) {
  if (!Array.isArray(list)) return []
  return list.map((item) => {
    const ownerNickPlain =
      `${item.ownerNickName || ''}`.trim() || `${item.targetName || ''}`.trim() || '好友'

    const peerSelf = normalizeFour((item.ownerSelfResult && item.ownerSelfResult.type) || '')
    const myMutual = normalizeFour((item.result && item.result.type) || '')
    const chipSame = !!(peerSelf && myMutual && peerSelf === myMutual)

    return {
      id: item.id,
      friendNickName: truncateName(ownerNickPlain),
      friendAvatarUrl: publicAvatarUrl(`${item.ownerAvatarUrl || ''}`.trim()),
      friendAvatarLoadFailed: false,
      peerSelfType: peerSelf || '--',
      chipText: chipSame ? '结果一致' : '结果不同',
      chipSame,
      timeText: formatTime(item.createdAt),
      compareSelfType: peerSelf || '--',
      compareMutualType: myMutual || '--',
      compareSubjectNick: ownerNickPlain,
    }
  })
}

Page({
  data: {
    scrollInnerMinPx: 480,
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

  onFriendAvatarError(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const rows = this.data.rows.map((r) =>
      r.id === id ? { ...r, friendAvatarLoadFailed: true } : r,
    )
    this.setData({ rows })
  },

  /** 与 mutual-results-detail 一致：写入 compareContext 后打开 compare */
  onOpenCompare(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const row = this.data.rows.find((r) => r.id === id)
    if (!row) return
    const app = getApp()
    app.globalData.compareContext = {
      comparisonVariant: 'mutual_given',
      selfRecord: { id: String(id), result: { type: row.compareSelfType } },
      mutualRecord: {
        friendNickName: row.compareSubjectNick || '好友',
        result: { type: row.compareMutualType },
      },
    }
    wx.navigateTo({ url: '/pages/compare/index' })
  },

  onBackRecords() {
    wx.navigateBack({ delta: 1 })
  },
})
