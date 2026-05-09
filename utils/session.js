/**
 * 登录与远端资料/记录加载，对照 code/minigame/src/main.js：
 * loginWithWechat、performLogin、loadRemoteProfile、loadRemoteRecords
 */
const api = require('./api')
const config = require('./config')
const { normalizeSelfRecords } = require('./normalize-records')
const { syncRecordMutualCounts } = require('./record-sync')
const { getAppId } = require('./app-env')

function getApiSource() {
  return config.apiSource || 'minigame'
}

function loginWithWechat() {
  return new Promise((resolve, reject) => {
    if (!wx.login) return reject(new Error('当前环境不支持 wx.login'))
    wx.login({
      success: (res) => {
        if (!res.code) return reject(new Error('未获取到登录 code'))
        api.login({ code: res.code }).then(resolve).catch(reject)
      },
      fail: reject,
    })
  })
}

function loadRemoteProfile(app, userId) {
  if (!userId) return Promise.resolve(null)
  return api
    .getProfile(userId)
    .then((profile) => {
      if (profile && !profile.skipped) {
        app.globalData.profile = {
          nickName: profile.nickName || '',
          avatarUrl: profile.avatarUrl || '',
        }
      } else if (profile && profile.skipped) {
        app.globalData.profile = { skipped: true }
      } else {
        app.globalData.profile = null
      }
      return app.globalData.profile
    })
    .catch(() => {
      app.globalData.profile = null
      return null
    })
}

function loadRemoteRecords(app, userId) {
  if (!userId) return Promise.resolve([])
  return api
    .listRecords(userId)
    .then((records) => {
      const normalized = normalizeSelfRecords(records)
      app.globalData.records = normalized
      const promises = normalized.map((rec) =>
        api
          .getMutualResults(rec.id)
          .then((list) => {
            syncRecordMutualCounts(app, rec.id, Array.isArray(list) ? list : [])
          })
          .catch(() => {})
      )
      return Promise.all(promises).then(() => normalized)
    })
    .catch(() => {
      app.globalData.records = []
      return []
    })
}

function performLogin(app, showFailureToast) {
  app.globalData.authStatus = 'loading'
  app.globalData.authError = ''
  app.globalData.userId = ''

  return loginWithWechat()
    .then((loginRes) => {
      const userId = (loginRes && loginRes.userId) || ''
      if (!userId) throw new Error('未获取到 userId')
      app.globalData.userId = userId
      app.globalData.authError = ''
      return Promise.all([loadRemoteProfile(app, userId), loadRemoteRecords(app, userId)])
    })
    .then(() => {
      app.globalData.authStatus = 'success'
    })
    .catch((err) => {
      app.globalData.authStatus = 'fail'
      app.globalData.authError = (err && err.message) || '微信登录失败，请重试'
      app.globalData.userId = ''
      app.globalData.records = []
      app.globalData.profile = null
      if (showFailureToast && wx.showToast) {
        wx.showToast({ title: '微信登录失败，请重试', icon: 'none' })
      }
      throw err
    })
}

function syncProfileToRemote(app, profile) {
  const userId = app.globalData.userId
  if (!profile || !userId) return Promise.resolve()
  return api
    .saveProfile({
      userId,
      nickName: profile.nickName || '',
      avatarUrl: profile.avatarUrl || '',
      skipped: !!profile.skipped,
      appId: getAppId(),
      source: getApiSource(),
    })
    .catch(() => null)
}

function refreshProfile(app) {
  const userId = app.globalData.userId
  if (!userId) return Promise.resolve(null)
  return loadRemoteProfile(app, userId)
}

module.exports = {
  getAppId,
  getApiSource,
  loginWithWechat,
  loadRemoteProfile,
  loadRemoteRecords,
  performLogin,
  syncProfileToRemote,
  refreshProfile,
}
