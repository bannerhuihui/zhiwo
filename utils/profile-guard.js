/**
 * 微信 getUserProfile 等接口常返回占位昵称「微信用户」，不能当作真实资料。
 * 真实昵称需用户点击 <input type="nickname"> 由微信昵称填写能力提供。
 */
const PLACEHOLDER_NICKNAMES = new Set(['微信用户', 'WeChat User', ''])

function isPlaceholderNickname(name) {
  const n = (name || '').trim()
  return !n || PLACEHOLDER_NICKNAMES.has(n)
}

function hasUsableWechatProfile(profile) {
  if (!profile || profile.skipped) return false
  if (isPlaceholderNickname(profile.nickName)) return false
  if (!(profile.avatarUrl && String(profile.avatarUrl).trim())) return false
  return true
}

module.exports = {
  isPlaceholderNickname,
  hasUsableWechatProfile,
}
