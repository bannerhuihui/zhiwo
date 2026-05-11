/**
 * chooseAvatar 偶发返回 wxfile 等本机路径：写库后他人拉列表无法展示，提交与展示前统一过滤。
 */
function publicAvatarUrl(url) {
  const u = (url || '').trim()
  if (!u) return ''
  const low = u.toLowerCase()
  if (low.startsWith('wxfile://')) return ''
  if (low.startsWith('wxlocalresource://')) return ''
  return u
}

module.exports = {
  publicAvatarUrl,
}
