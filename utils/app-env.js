/** 与 code/minigame/src/main.js getAppId 一致 */
function getAppId() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
    return (info && info.miniProgram && info.miniProgram.appId) || ''
  } catch (_) {
    return ''
  }
}

module.exports = { getAppId }
