const api = require('../../utils/api')
const { prepareAvatarLocalPath } = require('../../utils/avatar-local-path')
const { getAppId, getApiSource, refreshProfile } = require('../../utils/session')
const { isPlaceholderNickname, hasUsableWechatProfile } = require('../../utils/profile-guard')
const { SHARE_CARD_IMAGE_URL } = require('../../utils/share-assets')

Page({
  data: {
    showMain: true,
    showLoading: false,
    showAuthFail: false,
    showProfileGate: false,
    /** 当前这次弹窗是为哪次跳转准备的（仅首页按钮触发时写入） */
    pendingUrlAfterProfile: '',
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
    // 登录成功即可浏览首页；头像昵称在用户点击功能时再要（showProfileGate 由交互触发）
    let gateRequested = this.data.showProfileGate
    if (gd.profileGatePending) {
      if (authStatus === 'success') {
        gd.profileGatePending = false
        gateRequested = true
      } else if (authStatus === 'fail') {
        gd.profileGatePending = false
        gd.pendingNavigateAfterProfile = null
      }
    }
    const showProfileGate = hasUsableProfile ? false : gateRequested
    const showMain = authStatus === 'success' && !showLoading

    this.setData({
      recordsEmpty,
      authFailLines,
      showLoading,
      showAuthFail,
      showProfileGate,
      showMain,
    })
  },

  /**
   * 需要对外身份前先完善头像昵称；通过后执行 jump
   * @param {string} pendingUrl navigateTo 的 url
   * @param {() => void} jump
   */
  _ensureProfileThen(pendingUrl, jump) {
    const app = getApp()
    if (hasUsableWechatProfile(app.globalData.profile)) {
      jump()
      return
    }
    this.setData({
      showProfileGate: true,
      pendingUrlAfterProfile: pendingUrl || '',
    })
  },

  startSelf() {
    this._ensureProfileThen('/pages/quiz/index?mode=self', () => {
      wx.navigateTo({ url: '/pages/quiz/index?mode=self' })
    })
  },

  startMutual() {
    if (this.data.recordsEmpty) {
      wx.showToast({ title: '请先完成自测', icon: 'none' })
      return
    }
    this._ensureProfileThen('/pages/invite/index', () => {
      wx.navigateTo({ url: '/pages/invite/index' })
    })
  },

  openRecords() {
    this._ensureProfileThen('/pages/records/index', () => {
      wx.navigateTo({ url: '/pages/records/index' })
    })
  },

  openInfo() {
    this._ensureProfileThen('/pages/info/index', () => {
      wx.navigateTo({ url: '/pages/info/index' })
    })
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
    const userId = app.globalData.userId
    prepareAvatarLocalPath(profile.avatarUrl)
      .then((localPath) => api.uploadUserAvatar(localPath, userId))
      .then((avatarStoredUrl) =>
        api.saveProfile({
          userId,
          nickName: profile.nickName,
          avatarUrl: avatarStoredUrl,
          skipped: false,
          appId: getAppId(),
          source: getApiSource(),
        }),
      )
      .then(() => refreshProfile(app))
      .then(() => {
        const urlFromPage = this.data.pendingUrlAfterProfile || ''
        const globalPending = app.globalData.pendingNavigateAfterProfile
        const urlFromGlobal = globalPending && globalPending.url ? globalPending.url : ''
        const targetUrl = urlFromPage || urlFromGlobal
        wx.hideLoading()
        this.setData({
          profileNickDraft: '',
          profileAvatarDraft: '',
          pendingUrlAfterProfile: '',
        })
        app.globalData.pendingNavigateAfterProfile = null
        this.syncState()
        wx.showToast({ title: '已保存', icon: 'success' })
        if (targetUrl) {
          wx.navigateTo({ url: targetUrl })
        }
      })
      .catch((e) => {
        wx.hideLoading()
        wx.showToast({ title: (e && e.message) || '保存失败，请检查网络', icon: 'none' })
      })
  },
})
