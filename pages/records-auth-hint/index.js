const api = require('../../utils/api')
const { prepareAvatarLocalPath } = require('../../utils/avatar-local-path')
const { getAppId, getApiSource, refreshProfile } = require('../../utils/session')
const { isPlaceholderNickname, hasUsableWechatProfile } = require('../../utils/profile-guard')
const { flushPendingQuizSubmit } = require('../../utils/persist-quiz')

const STEP_LOGIN = 'login'
const STEP_PROFILE = 'profile'
const PURPOSE_QUIZ = 'quiz'
const PURPOSE_RECORDS = 'records'

function loginHintCopy() {
  return {
    navTitle: '测试记录',
    pillText: '查看记录须知',
    subtitle: '请先完成账号登录：测试记录与个人身份绑定存放在云端。',
    headline: '完成登录后，还需授权头像与昵称，才可查看您的测试记录',
    bodyLines: [
      '「测试记录」中的自测与互测信息与您的微信号对应的服务端账号相关联，需要先通过微信登录校验，确认当前设备上的会话。',
      '仅完成静默登录还不够：为把记录准确归属给您本人（并便于互测等场景中展示发起人），微信平台还需要您在选择「测试记录」时主动填写头像与昵称。',
      '若您暂未登录账号，请先点击下方按钮发起微信登录。',
    ],
    loginBtnLabel: '微信登录并继续',
    profileSaveLabel: '保存并查看记录',
  }
}

function profileHintCopy() {
  return {
    navTitle: '测试记录',
    pillText: '完善昵称与头像',
    subtitle: '您已登录，还需授权头像与昵称才能查看云端测试记录',
    headline: '请在下框中选择头像并填写昵称，完成身份信息确认',
    bodyLines: [
      '系统在收到您授权的头像与昵称之前，无法在「测试记录」页面向您展示与个人绑定的云端数据。',
      '头像与昵称由您主动选择与填写，我们不会在此向您索要手机号码。',
      '点击下方「保存并查看记录」后，将进入您的测试记录列表。',
    ],
    loginBtnLabel: '微信登录并继续',
    profileSaveLabel: '保存并查看记录',
  }
}

function quizLoginHintCopy() {
  return {
    navTitle: '保存测试结果',
    pillText: '保存测评结果',
    subtitle: '您已完成本题测评。若要生成结果页并写入账号，需要先完成登录。',
    headline: '登录后还需授权头像与昵称，系统将为您保存这次作答',
    bodyLines: [
      '在您完成授权前，测试结果仅记录在本地流程中：需要登录确认账号归属后，才能把这次自测或互测结果安全写入服务端。',
      '若您已通过静默登录但未填写过头像昵称，还需再完成所选头像与非占位昵称的授权，我们才能提交互测或写入您的测试记录。',
      '本步骤不收集手机号码。请点击下方按钮发起微信登录。',
    ],
    loginBtnLabel: '微信登录并保存结果',
    profileSaveLabel: '保存并生成结果页',
  }
}

function quizProfileHintCopy() {
  return {
    navTitle: '保存测试结果',
    pillText: '完善昵称与头像',
    subtitle: '您已登录。请选择头像并填写昵称，以完成本次测评的云端保存。',
    headline: '保存后即可进入测试结果页（自测会出现在测试记录中）',
    bodyLines: [
      '为保护数据与您本人对应，我们会在您确认后写入本次答题结果。',
      '互测作答将发给邀请的好友；自测将作为一条新记录记入您的云端档案。',
      '点击下方按钮保存后稍候即可跳转结果页。',
    ],
    loginBtnLabel: '微信登录并保存结果',
    profileSaveLabel: '保存并生成结果页',
  }
}

Page({
  data: {
    purpose: PURPOSE_RECORDS,
    step: STEP_LOGIN,
    navTitle: '测试记录',
    loginBtnLabel: '微信登录并继续',
    profileSaveLabel: '保存并查看记录',
    logging: false,
    savingProfile: false,
    authTip: '',
    pillText: '',
    subtitle: '',
    headline: '',
    bodyLines: [],
    profileNickDraft: '',
    profileAvatarDraft: '',
  },

  onLoad(options) {
    const purpose =
      options && String(options.purpose) === PURPOSE_QUIZ ? PURPOSE_QUIZ : PURPOSE_RECORDS
    const step =
      options && String(options.step) === STEP_PROFILE ? STEP_PROFILE : STEP_LOGIN
    this.setData({ purpose })
    this._applyStep(step, purpose)
    this._initDraftFromRemote()
  },

  _isQuizPurpose() {
    return this.data.purpose === PURPOSE_QUIZ
  },

  _goAfterGateSuccess(app) {
    if (this._isQuizPurpose()) {
      if (!app.globalData.pendingQuizPersist) {
        wx.showToast({ title: '暂无待保存的作答', icon: 'none' })
        wx.redirectTo({ url: '/pages/index/index' })
        return
      }
      flushPendingQuizSubmit(app)
        .then(() => wx.redirectTo({ url: '/pages/result/index' }))
        .catch(() => wx.redirectTo({ url: '/pages/result/index' }))
      return
    }
    wx.redirectTo({ url: '/pages/records/index' })
  },

  onShow() {
    const app = getApp()
    const gd = app.globalData || {}
    const ok = gd.authStatus === 'success' && hasUsableWechatProfile(gd.profile)

    if (this._isQuizPurpose()) {
      if (ok && gd.pendingQuizPersist) {
        flushPendingQuizSubmit(app)
          .then(() => wx.redirectTo({ url: '/pages/result/index' }))
          .catch(() => wx.redirectTo({ url: '/pages/result/index' }))
        return
      }
      if (ok && !gd.pendingQuizPersist) {
        wx.redirectTo({ url: '/pages/index/index' })
        return
      }
    } else if (ok) {
      wx.redirectTo({ url: '/pages/records/index' })
      return
    }

    if (gd.authStatus !== 'success') {
      if (this.data.step !== STEP_LOGIN) this._applyStep(STEP_LOGIN, this.data.purpose)
    } else if (!hasUsableWechatProfile(gd.profile)) {
      if (this.data.step !== STEP_PROFILE) this._applyStep(STEP_PROFILE, this.data.purpose)
    }

    this._initDraftFromRemote()
    this._syncTip()
  },

  _initDraftFromRemote() {
    const p = getApp().globalData && getApp().globalData.profile
    if (!p || p.skipped) return
    const nick =
      typeof p.nickName === 'string' && !isPlaceholderNickname(p.nickName) ? p.nickName : ''
    const avatar = typeof p.avatarUrl === 'string' ? p.avatarUrl.trim() : ''
    const patch = {}
    if (nick && nick !== this.data.profileNickDraft) patch.profileNickDraft = nick
    if (avatar && avatar !== this.data.profileAvatarDraft) patch.profileAvatarDraft = avatar
    if (Object.keys(patch).length) this.setData(patch)
  },

  _applyStep(step, purpose) {
    const p = purpose != null ? purpose : this.data.purpose
    let c
    if (p === PURPOSE_QUIZ) {
      c = step === STEP_PROFILE ? quizProfileHintCopy() : quizLoginHintCopy()
    } else {
      c = step === STEP_PROFILE ? profileHintCopy() : loginHintCopy()
    }
    this.setData({
      step,
      navTitle: c.navTitle,
      pillText: c.pillText,
      subtitle: c.subtitle,
      headline: c.headline,
      bodyLines: c.bodyLines,
      loginBtnLabel: c.loginBtnLabel,
      profileSaveLabel: c.profileSaveLabel,
    })
  },

  _syncTip() {
    const err = getApp().globalData.authError
    const authTip =
      err && getApp().globalData.authStatus === 'fail' ? String(err).slice(0, 220) : ''
    if (authTip !== this.data.authTip) this.setData({ authTip })
  },

  onAuthorize() {
    if (this.data.logging) return
    const app = getApp()
    this.setData({ logging: true })
    if (typeof app.ensureLogin !== 'function') {
      this.setData({ logging: false })
      wx.showToast({ title: '请稍后再试', icon: 'none' })
      return
    }
    app
      .ensureLogin()
      .then(() => {
        if (app.globalData.authStatus !== 'success') {
          this._syncTip()
          wx.showToast({ title: app.globalData.authError || '登录未完成', icon: 'none' })
          return
        }
        if (hasUsableWechatProfile(app.globalData.profile)) {
          this._goAfterGateSuccess(app)
        } else {
          this._applyStep(STEP_PROFILE, this.data.purpose)
          this._initDraftFromRemote()
        }
      })
      .catch(() => {
        this._syncTip()
        wx.showToast({ title: app.globalData.authError || '登录失败，请重试', icon: 'none' })
      })
      .finally(() => this.setData({ logging: false }))
  },

  onChooseAvatar(e) {
    const url = e.detail && e.detail.avatarUrl
    this.setData({ profileAvatarDraft: url || '' })
  },

  onNicknameInput(e) {
    this.setData({ profileNickDraft: (e.detail && e.detail.value) || '' })
  },

  onSaveProfileForm() {
    if (this.data.savingProfile) return
    const app = getApp()
    if (app.globalData.authStatus !== 'success' || !app.globalData.userId) {
      wx.showToast({ title: '请先完成微信登录', icon: 'none' })
      this._applyStep(STEP_LOGIN, this.data.purpose)
      return
    }
    const nickName = (this.data.profileNickDraft || '').trim()
    const avatarUrl = (this.data.profileAvatarDraft || '').trim()
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    if (isPlaceholderNickname(nickName)) {
      wx.showToast({ title: '请重新填写昵称', icon: 'none' })
      return
    }
    if (!avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中…', mask: true })
    this.setData({ savingProfile: true })
    const userId = app.globalData.userId
    prepareAvatarLocalPath(avatarUrl)
      .then((localPath) => api.uploadUserAvatar(localPath, userId))
      .then((avatarStoredUrl) =>
        api.saveProfile({
          userId,
          nickName,
          avatarUrl: avatarStoredUrl,
          skipped: false,
          appId: getAppId(),
          source: getApiSource(),
        }),
      )
      .then(() => refreshProfile(app))
      .then(() => {
        wx.hideLoading()
        this.setData({ savingProfile: false })
        wx.showToast({ title: '已保存', icon: 'success' })
        if (hasUsableWechatProfile(getApp().globalData.profile)) {
          this._goAfterGateSuccess(app)
        }
      })
      .catch((e) => {
        wx.hideLoading()
        this.setData({ savingProfile: false })
        wx.showToast({
          title: (e && e.message) || '保存失败，请检查网络',
          icon: 'none',
        })
      })
  },

  onHome() {
    if (this._isQuizPurpose()) getApp().globalData.pendingQuizPersist = null
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
