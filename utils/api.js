/**
 * 与 code/minigame/src/data/api.js 一一对照（方法名、HTTP 方法、path 片段相同）。
 * 后端：admin/qy MinigameAuthController、MinigameStorageController
 */
const config = require('./config')

/** 避免域名未配置或网络挂起导致永远停在「加载中」 */
const REQUEST_TIMEOUT_MS = 20000

function parseResponseData(raw) {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (_) {
      return {}
    }
  }
  return raw
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    if (!config.apiBaseUrl) return reject(new Error('apiBaseUrl 未配置'))
    const payload = data !== undefined ? data : {}
    const isPostLike = method === 'POST' || method === 'PUT' || method === 'PATCH'
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method,
      timeout: REQUEST_TIMEOUT_MS,
      data: payload,
      header: isPostLike ? { 'content-type': 'application/json' } : {},
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        const body = parseResponseData(res.data)
        const code = body.code
        // 兼容部分环境下 code 为字符串 "2000"，避免误判为失败
        if (code != null && Number(code) !== 2000) {
          const fromData = typeof body.data === 'string' ? body.data : ''
          const msg = fromData || body.message || '接口调用失败'
          return reject(new Error(msg))
        }
        if (Object.prototype.hasOwnProperty.call(body, 'data')) resolve(body.data)
        else resolve(body)
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '网络请求失败'
        reject(new Error(msg))
      },
    })
  })
}

function login(data) {
  return request('POST', '/auth/login', data)
}

function saveProfile(data) {
  return request('POST', '/storage/profile', data)
}

function getProfile(userId) {
  return request('GET', `/storage/profile/${encodeURIComponent(userId)}`)
}

function saveRecord(data) {
  return request('POST', '/storage/record', data)
}

function listRecords(userId) {
  return request('GET', `/storage/records/${encodeURIComponent(userId)}`)
}

function syncRecords(data) {
  return request('POST', '/storage/records/sync', data)
}

function createInvite(data) {
  return request('POST', '/storage/invite', data)
}

function getInvite(inviteId) {
  return request('GET', `/storage/invite/${encodeURIComponent(inviteId)}`)
}

function listInvites(ownerUserId) {
  return request('GET', `/storage/invites/${encodeURIComponent(ownerUserId)}`)
}

function completeInvite(data) {
  return request('POST', '/storage/invite/complete', data)
}

function getMutualResults(selfTestId) {
  return request('GET', `/storage/mutual-results/${encodeURIComponent(selfTestId)}`)
}

/** 当前用户作为好友完成过的互测列表（friendUserId 为登录用户本人） */
function listMutualGiven(friendUserId) {
  return request('GET', `/storage/mutual-given/${encodeURIComponent(friendUserId)}`)
}

/** 清除当前用户在服务端的自测、互测记录及本人发起的邀请（不删头像昵称等资料） */
function wipeUserTestData(data) {
  return request('POST', '/storage/user-data/wipe', data)
}

/** 头像二进制上传至服务端 TOS，返回 HTTPS 永久 url */
function uploadUserAvatar(localFilePath, userId) {
  return new Promise((resolve, reject) => {
    if (!config.apiBaseUrl) return reject(new Error('apiBaseUrl 未配置'))
    if (!localFilePath) return reject(new Error('缺少头像文件路径'))
    wx.uploadFile({
      url: `${config.apiBaseUrl}/storage/upload/image`,
      filePath: localFilePath,
      name: 'file',
      formData: {
        userId: String(userId || ''),
      },
      timeout: REQUEST_TIMEOUT_MS,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const body = parseResponseData(res.data)
        const code = body.code != null ? Number(body.code) : NaN
        if (code !== 2000) {
          reject(new Error((body.message && String(body.message)) || '图片上传失败'))
          return
        }
        const url = body.data && body.data.url
        if (!url) {
          reject(new Error('上传成功但未返回地址'))
          return
        }
        resolve(String(url).trim())
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || '图片上传失败'))
      },
    })
  })
}

module.exports = {
  request,
  login,
  saveProfile,
  getProfile,
  uploadUserAvatar,
  saveRecord,
  listRecords,
  syncRecords,
  createInvite,
  getInvite,
  listInvites,
  completeInvite,
  getMutualResults,
  listMutualGiven,
  wipeUserTestData,
}
