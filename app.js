const FONT_FAMILY = 'QingningRounded'
const FONT_URL = 'https://game.jyiai.com/static/fonts/qingning-rounded.ttf'
const { performLogin, syncProfileToRemote } = require('./utils/session')
/** 在 App 入口同步加载，避免 lazyCodeLoading 下子页面 require 题库未进包导致互测白屏 */
const SELF_TEST_QUESTIONS = require('./data/self-test-questions.js')
const MUTUAL_TEST_QUESTIONS = require('./data/mutual-test-questions.js')

App({
  globalData: {
    fontFamily: FONT_FAMILY,
    /** 与 code state.userId 一致，login 后写入 */
    userId: '',
    currentResult: null,
    /** loading | success | fail — 与 code 登录态对应（code 失败写 failed，小程序页用 fail） */
    authStatus: 'loading',
    authError: '',
    /** 服务端拉取；无则 null，首页展示授权说明 */
    profile: null,
    /** 归一化自测记录列表；登录成功后再拉取 */
    records: undefined,
    invite: null,
    /** 与 code pendingInviteId：未登录时打开邀请链暂存 */
    pendingInviteId: '',
    /** 从互测邀请页跳转首页时需弹出资料完善（onShow 消费一次） */
    profileGatePending: false,
    /** 资料保存成功后 navigateTo 的目标，例如邀请进端未完成头像昵称时 */
    pendingNavigateAfterProfile: null,
    /** 答完题后待入库：登录并完善头像昵称后由 utils/persist-quiz 写入 */
    pendingQuizPersist: null,
    /** 答题用题库（与页面 require 双保险） */
    selfTestQuestions: Array.isArray(SELF_TEST_QUESTIONS) ? SELF_TEST_QUESTIONS : [],
    mutualTestQuestions: Array.isArray(MUTUAL_TEST_QUESTIONS) ? MUTUAL_TEST_QUESTIONS : [],
  },

  onLaunch() {
    this.initCustomFont()
    performLogin(this, false)
      .finally(() => this._notifyPagesAuthResolved())
      .catch(() => {})
  },

  /** 登录流程结束后刷新当前栈里的页面（否则首页会一直停在首次 onShow 的「加载中」） */
  _notifyPagesAuthResolved() {
    const pages = getCurrentPages()
    for (let i = 0; i < pages.length; i += 1) {
      const p = pages[i]
      if (p && typeof p.syncState === 'function') p.syncState()
    }
  },

  ensureLogin() {
    return performLogin(this, true).finally(() => this._notifyPagesAuthResolved())
  },

  syncProfileToRemote(profile) {
    return syncProfileToRemote(this, profile)
  },

  initCustomFont() {
    if (typeof wx.loadFontFace !== 'function') return
    wx.loadFontFace({
      family: FONT_FAMILY,
      source: `url("${FONT_URL}")`,
      format: 'truetype',
      global: true,
      success: () => {
        this.globalData.fontFamily = FONT_FAMILY
      },
      fail: () => {
        this.globalData.fontFamily = FONT_FAMILY
      },
    })
  },
})
