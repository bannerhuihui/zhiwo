const api = require('../../utils/api')

function shortForButton(name, maxLen) {
  const m = maxLen != null ? maxLen : 6
  const s = (name || '朋友').trim()
  if (!s) return '朋友'
  if (s.length <= m) return s
  return `${s.slice(0, m)}…`
}
const DEBUG_ALLOW_SELF_MUTUAL = false

/** 调试：为 true 时允许本人打开自己的互测邀请（正式环境须为 false） */
function applyQueryFallback(app, query) {
  const inviteId = query.inviteId ? decodeURIComponent(query.inviteId) : ''
  if (!inviteId) return
  app.globalData.invite = {
    inviteId,
    ownerNickName: query.owner ? decodeURIComponent(query.owner) : '朋友',
    selfTestId: query.selfTestId ? decodeURIComponent(query.selfTestId) : '',
  }
}

Page({
  data: {
    ownerName: '朋友',
    ownerShort: '朋友',
  },

  onLoad(query) {
    const app = getApp()
    const inviteId = query.inviteId ? decodeURIComponent(query.inviteId) : ''
    if (!inviteId) {
      this.setData({ ownerName: '朋友', ownerShort: '朋友' })
      return
    }

    wx.showLoading({ title: '加载邀请', mask: true })
    api
      .getInvite(inviteId)
      .then((invite) => {
        wx.hideLoading()
        if (!invite || !invite.inviteId) {
          wx.showToast({ title: '邀请不存在或已失效', icon: 'none' })
          applyQueryFallback(app, query)
          this._syncName(app, query)
          return
        }
        const uid = app.globalData.userId
        if (
          !DEBUG_ALLOW_SELF_MUTUAL &&
          invite.ownerUserId &&
          uid &&
          invite.ownerUserId === uid
        ) {
          wx.showToast({ title: '不能评价自己，请邀请朋友来测', icon: 'none' })
          app.globalData.invite = null
          this.setData({ ownerName: '朋友', ownerShort: '朋友' })
          return
        }
        app.globalData.invite = {
          inviteId: invite.inviteId,
          ownerUserId: invite.ownerUserId,
          ownerNickName: invite.ownerNickName || '',
          selfTestId: invite.selfTestId || (query.selfTestId ? decodeURIComponent(query.selfTestId) : ''),
          targetName: invite.targetName,
        }
        this._syncName(app, query)
      })
      .catch(() => {
        wx.hideLoading()
        applyQueryFallback(app, query)
        this._syncName(app, query)
      })
  },

  _syncName(app, query) {
    const inv = app.globalData.invite
    const owner = query.owner ? decodeURIComponent(query.owner) : ''
    const name = (inv && inv.ownerNickName) || owner || '朋友'
    this.setData({
      ownerName: name,
      ownerShort: shortForButton(name),
    })
  },

  onStartMutual() {
    const app = getApp()
    const inv = app.globalData.invite
    if (!inv || !inv.inviteId) {
      wx.showToast({ title: '请通过邀请链接进入', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/quiz/index?mode=mutual&inviteId=${encodeURIComponent(inv.inviteId)}`,
    })
  },

  onGoHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
