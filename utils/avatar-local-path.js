/**
 * chooseAvatar：可能是临时文件路径；也可能是 https 预览图。
 * 上传 OSS 前先下载成本地临时路径，便于 wx.uploadFile。
 */
function prepareAvatarLocalPath(pathOrHttps) {
  return new Promise((resolve, reject) => {
    const p = pathOrHttps == null ? '' : String(pathOrHttps).trim()
    if (!p) {
      reject(new Error('empty path'))
      return
    }
    if (/^https?:\/\//i.test(p)) {
      wx.downloadFile({
        url: p,
        success: (res) => {
          if (res.statusCode === 200 && res.tempFilePath) {
            resolve(res.tempFilePath)
            return
          }
          reject(new Error('download avatar failed'))
        },
        fail: () => reject(new Error('download avatar failed')),
      })
      return
    }
    resolve(p)
  })
}

module.exports = {
  prepareAvatarLocalPath,
}
