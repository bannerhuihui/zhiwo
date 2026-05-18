const app = getApp()
const { buildMbtiType } = require('../../utils/mbti')
const { hasUsableWechatProfile } = require('../../utils/profile-guard')
const { flushPendingQuizSubmit } = require('../../utils/persist-quiz')
const selfQuestions = require('../../data/self-test-questions.js')
/* 必须顶层 require：lazyCodeLoading 下函数内动态 require 可能未进包，互测会题库为空白屏 */
const mutualQuestions = require('../../data/mutual-test-questions.js')

function patchFromQuestion(q, mode, index, total, targetName) {
  const progressPercent = total ? ((index + 1) / total) * 100 : 0
  const opt0 = q && q.options && q.options[0]
  const opt1 = q && q.options && q.options[1]
  return {
    questionIndex: index,
    questionText: (q && q.text) || '',
    optionAText: (opt0 && opt0.text) || '',
    optionBText: (opt1 && opt1.text) || '',
    remaining: Math.max(total - index - 1, 0),
    progressPercent,
    pillFillFull: progressPercent >= 100,
    mutualHint: mode === 'mutual' && !!targetName,
    mutualTargetName: targetName,
    prevDisabled: index <= 0,
  }
}

Page({
  data: {
    quizReady: false,
    qrModalVisible: false,
    mode: 'self',
    navTitle: '自测模式',
    questionIndex: 0,
    questionText: '',
    optionAText: '',
    optionBText: '',
    remaining: 0,
    progressPercent: 0,
    pillFillFull: false,
    mutualHint: false,
    mutualTargetName: '',
    prevDisabled: true,
  },

  onLoad(options) {
    const inviteId = options.inviteId ? decodeURIComponent(options.inviteId) : ''
    this.inviteId = inviteId
    /* 分享链只带 inviteId 时也应进互测；显式 mode=self 才走自测 */
    const mode =
      options.mode === 'mutual' || (inviteId && options.mode !== 'self') ? 'mutual' : 'self'

    const gd = app.globalData || {}
    const poolSelf =
      (Array.isArray(gd.selfTestQuestions) && gd.selfTestQuestions.length
        ? gd.selfTestQuestions
        : null) ||
      (Array.isArray(selfQuestions) && selfQuestions.length ? selfQuestions : null) ||
      []
    const poolMutual =
      (Array.isArray(gd.mutualTestQuestions) && gd.mutualTestQuestions.length
        ? gd.mutualTestQuestions
        : null) ||
      (Array.isArray(mutualQuestions) && mutualQuestions.length ? mutualQuestions : null) ||
      poolSelf

    const pool = mode === 'mutual' ? poolMutual : poolSelf

    this.answers = []
    this.questions = Array.isArray(pool) ? pool.slice() : []

    if (!this.questions.length) {
      wx.showToast({ title: '题库为空，请重启小程序后再试', icon: 'none', duration: 3000 })
      this.setData({ quizReady: false, navTitle: mode === 'mutual' ? '互测模式' : '自测模式' })
      return
    }

    const navTitle = mode === 'mutual' ? '互测模式' : '自测模式'
    const targetName = this._inviteTargetName()
    const total = this.questions.length
    const patch = patchFromQuestion(this.questions[0], mode, 0, total, targetName)

    this.setData({
      quizReady: true,
      mode,
      navTitle,
      ...patch,
    })
  },

  _inviteTargetName() {
    const inv = app.globalData.invite || {}
    return String(inv.targetName || inv.ownerNickName || '').trim()
  },

  _syncQuestionUi(index) {
    const q = this.questions[index]
    const total = this.questions.length
    const targetName = this._inviteTargetName()
    const mode = this.data.mode
    this.setData(patchFromQuestion(q, mode, index, total, targetName))
  },

  chooseA() {
    this.choose(0)
  },
  chooseB() {
    this.choose(1)
  },

  choose(optionIndex) {
    const q = this.questions[this.data.questionIndex]
    if (!q || !q.options || !q.options[optionIndex]) return
    this.answers[this.data.questionIndex] = q.options[optionIndex].letter

    if (this.data.questionIndex >= this.questions.length - 1) {
      const result = buildMbtiType(this.answers)
      app.globalData.currentResult = result
      app.globalData.lastQuizContext = {
        mode: this.data.mode,
        inviteId: this.inviteId || '',
      }

      const createdAt = Date.now()
      app.globalData.pendingQuizPersist = {
        mode: this.data.mode,
        answers: this.answers.slice(),
        result,
        inviteId: this.inviteId || '',
        createdAt,
      }

      const gd = app.globalData
      const canPersist =
        gd.authStatus === 'success' &&
        gd.userId &&
        hasUsableWechatProfile(gd.profile)

      if (!canPersist) {
        const step =
          gd.authStatus === 'success' && gd.userId ? 'profile' : 'login'
        wx.redirectTo({
          url: `/pages/records-auth-hint/index?purpose=quiz&step=${step}`,
        })
        return
      }

      flushPendingQuizSubmit(app)
        .then(() => wx.redirectTo({ url: '/pages/result/index' }))
        .catch(() => wx.redirectTo({ url: '/pages/result/index' }))
      return
    }

    const next = this.data.questionIndex + 1
    this._syncQuestionUi(next)
  },

  onOpenQrModal() {
    this.setData({ qrModalVisible: true })
  },

  onCloseQrModal() {
    this.setData({ qrModalVisible: false })
  },

  onQrModalMove() {},

  prev() {
    if (this.data.questionIndex <= 0) return
    const prevIndex = this.data.questionIndex - 1
    this.answers.length = prevIndex
    this._syncQuestionUi(prevIndex)
  },
})
