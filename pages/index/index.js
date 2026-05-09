const api = require('../../utils/api')
const { getAppId, getApiSource, refreshProfile } = require('../../utils/session')
const { isPlaceholderNickname, hasUsableWechatProfile } = require('../../utils/profile-guard')
const { SHARE_CARD_IMAGE_URL } = require('../../utils/share-assets')

Page({
  data: {
    showMain: true,
    showLoading: false,
    showAuthFail: false,
    showProfileGate: false,
    recordsEmpty: true,
    authFailLines: [],
    profileNickDraft: '',
    profileAvatarDraft: '',
  },

  onShow() {
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
    }
    this.syncState()
  },

  onShareAppMessage() {
    return {
      title: '知我几分 · 性格测试',
      path: '/pages/index/index',
      imageUrl: SHARE_CARD_IMAGE_URL,
    }
  },

  syncState() {
    const app = getApp()
    const gd = app.globalData || {}
    const authStatus = gd.authStatus != null ? gd.authStatus : 'loading'
    const profile = gd.profile
    const records = gd.records

    const recordsEmpty = !Array.isArray(records) || records.length === 0

    const authFailLines = [
      gd.authError || '未完成微信登录，请重试',
      '登录成功后才会拉取你的测试记录与资料',
    ]

    const showLoading = authStatus === 'loading'
    const showAuthFail = authStatus === 'fail'
    const hasUsableProfile = hasUsableWechatProfile(profile)
    const showProfileGate = authStatus === 'success' && !hasUsableProfile
    const showMain = authStatus === 'success' && hasUsableProfile && !showLoading

    this.setData({
      recordsEmpty,
      authFailLines,
      showLoading,
      showAuthFail,
      showProfileGate,
      showMain,
    })
  },

  startSelf() {
    wx.navigateTo({ url: '/pages/quiz/index?mode=self' })
  },

  startMutual() {
    if (this.data.recordsEmpty) {
      wx.showToast({ title: '请先完成自测', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/invite/index' })
  },

  openRecords() {
    wx.navigateTo({ url: '/pages/records/index' })
  },

  openInfo() {
    wx.navigateTo({ url: '/pages/info/index' })
  },

  openSettings() {
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  retryLogin() {
    const app = getApp()
    if (typeof app.ensureLogin === 'function') {
      app.ensureLogin().then(() => this.syncState()).catch(() => this.syncState())
      return
    }
    wx.showToast({ title: '请接入 ensureLogin', icon: 'none' })
  },

  onChooseAvatar(e) {
    const url = e.detail && e.detail.avatarUrl
    this.setData({ profileAvatarDraft: url || '' })
  },

  onNicknameInput(e) {
    this.setData({ profileNickDraft: (e.detail && e.detail.value) || '' })
  },

  /** 微信能力：chooseAvatar + nickname 填写，同样写入服务端 */
  onSaveProfileForm() {
    const app = getApp()
    if (!app.globalData.userId) {
      wx.showToast({ title: '正在登录，请稍候', icon: 'none' })
      return
    }
    const nickName = (this.data.profileNickDraft || '').trim()
    const avatarUrl = (this.data.profileAvatarDraft || '').trim()
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    if (isPlaceholderNickname(nickName)) {
      wx.showToast({ title: '请重新选择昵称', icon: 'none' })
      return
    }
    if (!avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    this._persistProfile(app, { nickName, avatarUrl })
  },

  _persistProfile(app, profile) {
    wx.showLoading({ title: '保存资料…', mask: true })
    api
      .saveProfile({
        userId: app.globalData.userId,
        nickName: profile.nickName,
        avatarUrl: profile.avatarUrl,
        skipped: false,
        appId: getAppId(),
        source: getApiSource(),
      })
      .then(() => refreshProfile(app))
      .then(() => {
        wx.hideLoading()
        this.setData({ profileNickDraft: '', profileAvatarDraft: '' })
        this.syncState()
        wx.showToast({ title: '已保存', icon: 'success' })
      })
      .catch((e) => {
        wx.hideLoading()
        wx.showToast({ title: (e && e.message) || '保存失败，请检查网络', icon: 'none' })
      })
  },
})
