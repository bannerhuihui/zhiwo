const mbtiTypes = require('../../data/mbti-types')
const api = require('../../utils/api')
const { getAppId, getApiSource } = require('../../utils/session')
const { hasUsableWechatProfile } = require('../../utils/profile-guard')
const { SHARE_CARD_IMAGE_URL } = require('../../utils/share-assets')
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

function normalizeInviteRow(rec) {
  const type = (rec.result && rec.result.type) || ''
  const meta = getTypeMeta(type)
  const keywords = meta && meta.keywords ? meta.keywords.slice(0, 3) : []
  const rowId = (rec.selfTestId != null && String(rec.selfTestId).trim()) || rec.id
  return {
    id: rowId,
    typeCode: type || '--',
    alias: (meta && meta.alias) || '类型说明',
    keywords,
    timeText: formatTime(rec.createdAt),
    inviteKey: rec.inviteId || rec.id,
  }
}

Page({
  data: {
    scrollInnerMinPx: 480,
    rows: [],
  },

  onReady() {
    this._refreshScrollFill()
  },

  _refreshScrollFill() {
    const px = scrollInnerMinHeightPx({
      bottomRpx: 16 + 116 + 24,
      aboveScrollRpx: 180,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  onShow() {
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
    }
    this.loadRows()
  },

  loadRows() {
    const app = getApp()
    let raw = app.globalData && app.globalData.records
    if (!Array.isArray(raw)) raw = []
    const selfList = raw.filter((r) => {
      if (r.mode === 'mutual') return false
      const t = r.result && r.result.type
      return !!t
    })
    this.setData({ rows: selfList.map(normalizeInviteRow) })
  },

  onOpenInfo(e) {
    const type = e.currentTarget.dataset.type
    if (!type || type === '--') {
      wx.showToast({ title: '暂无类型', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/info/index?type=${encodeURIComponent(type)}` })
  },

  onHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  /**
   * 小程序无 wx.shareAppMessage；open-type="share" 触发本回调。
   * 样式仍用原 .btn-share 渐变，逻辑：先 createInvite 再分享（Promise 需基础库 2.12+）。
   */
  onShareAppMessage(e) {
    const menuFallback = {
      title: '知我几分 · 邀请互测',
      path: '/pages/index/index',
      imageUrl: SHARE_CARD_IMAGE_URL,
    }
    if (!e || e.from !== 'button') {
      return menuFallback
    }
    const ds = ((e.target && e.target.dataset) || (e.currentTarget && e.currentTarget.dataset)) || {}
    const recordId = ds.recordId || ds.recordid
    const typeCode = ds.typeCode || ds.typecode || '--'
    const app = getApp()
    const userId = app.globalData.userId
    if (!userId) {
      wx.showToast({ title: '请先完成登录', icon: 'none' })
      return menuFallback
    }
    const profile = app.globalData.profile || {}
    if (!hasUsableWechatProfile(profile)) {
      wx.showToast({ title: '请先在首页完成真实昵称与头像', icon: 'none' })
      return menuFallback
    }
    if (!recordId) {
      wx.showToast({ title: '记录无效', icon: 'none' })
      return menuFallback
    }

    wx.showLoading({ title: '创建邀请…', mask: true })
    const selfTestId = String(recordId).trim()
    return api
      .createInvite({
        ownerUserId: userId,
        ownerNickName: profile.nickName || '',
        selfTestId,
        targetName: 'TA',
        appId: getAppId(),
        source: getApiSource(),
      })
      .then((invite) => {
        wx.hideLoading()
        const inviteId =
          invite && (invite.inviteId || invite.invite_id) ? invite.inviteId || invite.invite_id : ''
        if (!invite || !inviteId) {
          wx.showToast({ title: '创建邀请失败', icon: 'none' })
          return menuFallback
        }
        const nick = profile.nickName || '我'
        const title =
          typeCode && typeCode !== '--'
            ? `${nick}测出了 ${typeCode}，你觉得准吗？来看看你知我几分`
            : `${nick}发来一份测试，来看看你知我几分`
        return {
          title,
          path: `/pages/mutual-invite/index?inviteId=${encodeURIComponent(inviteId)}&owner=${encodeURIComponent(
            nick
          )}&selfTestId=${encodeURIComponent(selfTestId)}`,
          imageUrl: SHARE_CARD_IMAGE_URL,
        }
      })
      .catch((err) => {
        wx.hideLoading()
        const msg = (err && err.message) || ''
        const short = msg.length > 36 ? `${msg.slice(0, 34)}…` : msg
        wx.showToast({ title: short || '创建邀请失败', icon: 'none' })
        return menuFallback
      })
  },
})
