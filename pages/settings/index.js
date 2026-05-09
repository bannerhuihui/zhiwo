const api = require('../../utils/api')
const { getAppId, getApiSource, loadRemoteRecords } = require('../../utils/session')

const FONT_CACHE_FILE = 'qingning-rounded.ttf'

function resetAppStateAfterClear(app) {
  app.globalData.userId = ''
  app.globalData.profile = null
  app.globalData.records = []
  app.globalData.invite = null
  app.globalData.pendingInviteId = ''
  app.globalData.currentResult = null
  app.globalData.authStatus = 'loading'
  app.globalData.authError = ''
}

function resetAppCachesAfterCloudWipe(app) {
  app.globalData.records = []
  app.globalData.invite = null
  app.globalData.pendingInviteId = ''
  app.globalData.currentResult = null
  delete app.globalData._mutualAllList
  app.globalData._mutualResultsCache = {}
  app.globalData._showMutualSelfResult = false
}

Page({
  onClearCache() {
    wx.showModal({
      title: '清除本地缓存',
      content: '仅清理当前设备上的字体缓存和本地存储，不会删除云端测试记录。是否继续？',
      confirmText: '清除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) this._doClearCache()
      },
    })
  },

  _doClearCache() {
    let cleared = false
    if (wx.clearStorageSync) {
      try {
        wx.clearStorageSync()
        cleared = true
      } catch (_) {}
    }

    const app = getApp()
    const finish = () => {
      if (typeof app.initCustomFont === 'function') app.initCustomFont()
      resetAppStateAfterClear(app)
      wx.showToast({ title: cleared ? '本地缓存已清除' : '已清理字体缓存', icon: 'none' })
      if (typeof app.ensureLogin === 'function') app.ensureLogin().catch(() => {})
    }

    const fs = wx.getFileSystemManager && wx.env && wx.env.USER_DATA_PATH ? wx.getFileSystemManager() : null
    if (fs) {
      fs.unlink({
        filePath: `${wx.env.USER_DATA_PATH}/${FONT_CACHE_FILE}`,
        complete: () => finish(),
      })
    } else {
      finish()
    }
  },

  onClearCloudTestData() {
    wx.showModal({
      title: '清除云端测试数据',
      content:
        '将永久删除服务器上您的全部自测、互测记录及您发出的测评邀请（不可恢复）。头像与昵称不受影响。是否继续？',
      confirmText: '清除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) this._doClearCloudTestData()
      },
    })
  },

  _doClearCloudTestData() {
    const app = getApp()
    const userId = app.globalData.userId
    if (!userId) {
      wx.showToast({ title: '请先完成登录', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在清除…', mask: true })
    api
      .wipeUserTestData({
        userId,
        appId: getAppId(),
        source: getApiSource(),
      })
      .then(() => {
        resetAppCachesAfterCloudWipe(app)
        return loadRemoteRecords(app, userId)
      })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '云端数据已清除', icon: 'success' })
        if (typeof app._notifyPagesAuthResolved === 'function') app._notifyPagesAuthResolved()
      })
      .catch((e) => {
        wx.hideLoading()
        wx.showToast({ title: (e && e.message) || '清除失败', icon: 'none' })
      })
  },

  onGoHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
