const mbtiTypes = require('../../data/mbti-types')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')

function findTypeIndex(code) {
  if (!code || typeof code !== 'string') return 0
  const u = code.trim().toUpperCase()
  for (let i = 0; i < mbtiTypes.length; i += 1) {
    if (mbtiTypes[i].type === u) return i
  }
  return 0
}

Page({
  data: {
    scrollInnerMinPx: 480,
    infoIndex: 0,
    total: mbtiTypes.length,
    pillText: `1/${mbtiTypes.length}`,
    item: mbtiTypes[0],
  },

  onLoad(options) {
    const idx = findTypeIndex(options.type)
    this.applyIndex(idx)
  },

  onReady() {
    this._refreshScrollFill()
  },

  _refreshScrollFill() {
    const px = scrollInnerMinHeightPx({
      bottomRpx: 16 + 116 + 24,
      aboveScrollRpx: 4 + 20 + 40,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  applyIndex(idx) {
    const n = mbtiTypes.length
    let i = idx % n
    if (i < 0) i += n
    const item = mbtiTypes[i]
    this.setData(
      {
        infoIndex: i,
        item,
        pillText: `${i + 1}/${n}`,
      },
      () => this._refreshScrollFill(),
    )
  },

  onPrev() {
    this.applyIndex(this.data.infoIndex - 1)
  },

  onNext() {
    this.applyIndex(this.data.infoIndex + 1)
  },

  onHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
})
