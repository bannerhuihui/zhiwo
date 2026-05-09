/**
 * 计算 scroll-view 内层 min-height（px），配合 WXML 中 .qy-scroll-fill 顶占位，
 * 解决「内容不足一屏时卡片与底部固定按钮之间大块空白」问题。
 */

function rpxToPx(rpx, windowWidth) {
  const w = windowWidth || 375
  return (rpx * w) / 750
}

function getWindowMetrics() {
  const w = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const windowHeight = w.windowHeight || w.screenHeight || 667
  const windowWidth = w.windowWidth || w.screenWidth || 375
  const statusBarHeight =
    w.statusBarHeight != null ? w.statusBarHeight : w.safeArea ? w.safeArea.top : 20
  const safeBottom =
    w.safeArea && w.screenHeight != null ? Math.max(0, w.screenHeight - w.safeArea.bottom) : 0
  return { windowHeight, windowWidth, statusBarHeight, safeBottom }
}

/**
 * @param {object} opts
 * @param {number} opts.bottomRpx - 底栏在样式里占的垂直 rpx（padding + 按钮 + gap，不含 safe 区）
 * @param {number} [opts.aboveScrollRpx=0] - 导航条下方、scroll-view 以上的区域高度（rpx）
 * @param {number} [opts.navContentPx=44] - 自定义导航内容区高度（px），不含状态栏
 * @param {number} [opts.extraPx=8] - 额外扣减
 * @param {boolean} [opts.includeSafeBottom=true] - 是否在底栏高度上叠加 safe-area（scroll 内边距已含 safe 的页面可设 false）
 */
function scrollInnerMinHeightPx(opts) {
  const bottomRpx = opts.bottomRpx
  const aboveScrollRpx = opts.aboveScrollRpx || 0
  const navContentPx = opts.navContentPx != null ? opts.navContentPx : 44
  const extraPx = opts.extraPx != null ? opts.extraPx : 8
  const includeSafeBottom = opts.includeSafeBottom !== false

  const { windowHeight, windowWidth, statusBarHeight, safeBottom } = getWindowMetrics()
  const navBarPx = navContentPx + statusBarHeight
  const bottomPx = rpxToPx(bottomRpx, windowWidth) + (includeSafeBottom ? safeBottom : 0)
  const abovePx = rpxToPx(aboveScrollRpx, windowWidth)
  return Math.max(Math.floor(windowHeight - navBarPx - bottomPx - abovePx - extraPx), 120)
}

module.exports = {
  getWindowMetrics,
  scrollInnerMinHeightPx,
  rpxToPx,
}
