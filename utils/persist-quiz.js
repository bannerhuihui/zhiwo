const api = require('./api')
const { publicAvatarUrl } = require('./avatar-url')
const { getAppId, getApiSource } = require('./session')
const { hasUsableWechatProfile } = require('./profile-guard')

/**
 * 将 globalData.pendingQuizPersist 入库（需已登录且有可用头像昵称）。
 * @returns {Promise<boolean>} 是否有 pending 并完成一次提交尝试（含失败仍视为处理过）
 */
function flushPendingQuizSubmit(app) {
  const p = app.globalData.pendingQuizPersist
  if (!p || !app.globalData.userId || app.globalData.authStatus !== 'success') {
    return Promise.resolve(false)
  }
  if (!hasUsableWechatProfile(app.globalData.profile)) {
    return Promise.resolve(false)
  }

  app.globalData.currentResult = p.result
  app.globalData.lastQuizContext = {
    mode: p.mode,
    inviteId: p.inviteId || '',
  }

  const createdAt = typeof p.createdAt === 'number' ? p.createdAt : Date.now()

  if (p.mode === 'self') {
    const rec = {
      id: `${createdAt}_${Math.floor(Math.random() * 1e6)}`,
      mode: 'self',
      createdAt,
      answers: p.answers.slice(),
      result: p.result,
      mutualCount: 0,
      todayMutualCount: 0,
    }
    const prev = Array.isArray(app.globalData.records) ? app.globalData.records : []
    app.globalData.records = [rec, ...prev]
    return api
      .saveRecord({
        userId: app.globalData.userId,
        mode: 'self',
        answers: rec.answers,
        result: rec.result,
        createdAt: rec.createdAt,
        selfTestId: rec.id,
        appId: getAppId(),
        source: getApiSource(),
      })
      .then(() => {
        app.globalData.pendingQuizPersist = null
        return true
      })
      .catch(() => {
        wx.showToast({ title: '结果云端保存失败，可稍后在测试记录重试同步', icon: 'none', duration: 2800 })
        app.globalData.pendingQuizPersist = null
        return true
      })
  }

  if (p.mode === 'mutual') {
    const inv = app.globalData.invite || {}
    if (!inv.inviteId) {
      app.globalData.pendingQuizPersist = null
      wx.showToast({ title: '邀请信息已失效，未能提交', icon: 'none' })
      return Promise.resolve(false)
    }
    const prof = app.globalData.profile || {}
    return api
      .completeInvite({
        inviteId: inv.inviteId,
        friendUserId: app.globalData.userId,
        friendNickName: prof.nickName || '',
        friendAvatarUrl: publicAvatarUrl(prof.avatarUrl || ''),
        answers: p.answers.slice(),
        result: p.result,
        createdAt,
      })
      .then(() => {
        app.globalData.pendingQuizPersist = null
        wx.showToast({ title: '已提交给对方', icon: 'none' })
        return true
      })
      .catch(() => {
        wx.showToast({ title: '互测结果提交失败', icon: 'none' })
        app.globalData.pendingQuizPersist = null
        return true
      })
  }

  app.globalData.pendingQuizPersist = null
  return Promise.resolve(false)
}

module.exports = {
  flushPendingQuizSubmit,
}
