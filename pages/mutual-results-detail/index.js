const api = require('../../utils/api')
const { publicAvatarUrl } = require('../../utils/avatar-url')
const { scrollInnerMinHeightPx } = require('../../utils/scroll-layout')
const { syncRecordMutualCounts } = require('../../utils/record-sync')
const { getRecordMbtiType } = require('../../utils/mutual-aggregate')
const { MIN_MUTUAL_EVALUATIONS_FOR_VIEW } = require('../../utils/mutual-view-gate')

const MUTUAL_TOO_FEW_MSG =
  '对您进行的评价，不到10份，无法查看此结果。请继续邀请朋友，对您进行评价。'

function showMutualTooFewThenBack() {
  wx.showModal({
    title: '提示',
    content: MUTUAL_TOO_FEW_MSG,
    showCancel: false,
    complete: () => wx.navigateBack(),
  })
}

function findSelfRecord(app, recordId) {
  const raw = app.globalData.records
  if (!Array.isArray(raw)) return null
  const key = recordId != null ? String(recordId).trim() : ''
  if (!key) return null
  return raw.find((r) => r && String(r.id) === key) || null
}

/** 服务端/本地互测条目上的业务自测 id */
function pickSelfTestId(mutualRaw) {
  if (!mutualRaw || typeof mutualRaw !== 'object') return ''
  const a = mutualRaw.selfTestId
  const b = mutualRaw.self_test_id
  if (a != null && String(a).trim()) return String(a).trim()
  if (b != null && String(b).trim()) return String(b).trim()
  return ''
}

/** 规范为四字母 EBTT，否则返回 '' */
function normalizeLetterFour(raw) {
  if (raw === null || raw === undefined || raw === '') return ''
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  if (s === '--') return ''
  return /^[EI][SN][TF][JP]$/.test(s) ? s : ''
}

/** 用互测条目上的 selfTestId 对上「测试记录」，得到本条对应的自测类型；否则用兜底（当前页所选记录的自测）。 */
function resolveViewerSelfFour(mutualRaw, app, pageSelfFallbackLetters) {
  const sid = pickSelfTestId(mutualRaw)
  if (sid && app && Array.isArray(app.globalData.records)) {
    const rec = app.globalData.records.find((r) => r && String(r.id) === sid)
    if (rec) {
      const t = normalizeLetterFour(getRecordMbtiType(rec) || '')
      if (t) return t
    }
  }
  const fb = normalizeLetterFour(pageSelfFallbackLetters)
  return fb || '--'
}

function resolveCompareSelfRecord(mutualRaw, app, viewerSelfFour) {
  const sid = pickSelfTestId(mutualRaw)
  if (!sid || !Array.isArray(app.globalData.records)) return null
  const rec = app.globalData.records.find((r) => r && String(r.id) === sid)
  if (rec) return rec
  /** 记录在本地尚无（极少见）：用当前解析出的类型造最小上下文，对比页仍可算分 */
  const t = normalizeLetterFour(viewerSelfFour) || '--'
  return { id: sid, result: { type: t }, answers: [] }
}

function truncateName(name) {
  if (!name) return ''
  return name.length > 5 ? `${name.slice(0, 5)}...` : name
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTime(createdAt) {
  const t = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pickFriendField(raw, camel, snake) {
  if (!raw || typeof raw !== 'object') return ''
  const a = raw[camel]
  if (a != null && String(a).trim()) return String(a).trim()
  const b = raw[snake]
  if (b != null && String(b).trim()) return String(b).trim()
  return ''
}

/** 单列页：兜底用页级自测字母；汇总页每条用 selfTestId 解析 */
function normalizeMutualItem(raw, index, app, pageSelfLettersForFallback) {
  const id = raw.id || raw._id || `idx-${index}`
  const friendType = getRecordMbtiType(raw) || '--'
  const viewerSelfType = resolveViewerSelfFour(raw, app, pageSelfLettersForFallback)
  const selfNorm = viewerSelfType === '--' ? '' : viewerSelfType
  const friendNorm = /^[EI][SN][TF][JP]$/.test(String(friendType).toUpperCase()) ? friendType : ''
  const same = !!(selfNorm && friendNorm && selfNorm === friendNorm)
  const nick = pickFriendField(raw, 'friendNickName', 'friend_nick_name')
  const avatar = publicAvatarUrl(pickFriendField(raw, 'friendAvatarUrl', 'friend_avatar_url'))
  return {
    id: String(id),
    friendNickName: truncateName(nick || `朋友${index + 1}`),
    friendAvatarUrl: avatar,
    friendAvatarLoadFailed: false,
    friendType,
    viewerSelfType,
    timeText: formatTime(raw.createdAt),
    chipText: same ? '结果一致' : '结果不同',
    chipSame: same,
    raw,
  }
}

function mergeAllFromApi(app) {
  const raw = app.globalData.records
  if (!Array.isArray(raw) || !raw.length) return Promise.resolve([])
  return Promise.all(raw.map((rec) => api.getMutualResults(rec.id).catch(() => []))).then((results) => {
    const merged = []
    results.forEach((list, idx) => {
      const arr = Array.isArray(list) ? list : []
      const rec = raw[idx]
      if (rec) syncRecordMutualCounts(app, rec.id, arr)
      merged.push(...arr)
    })
    return merged
  })
}

function selfTypeLettersFromFindRecord(rec) {
  if (!rec) return '--'
  const t =
    normalizeLetterFour(getRecordMbtiType(rec) || '') ||
    normalizeLetterFour((rec.result && rec.result.type) || '') ||
    ''
  return t || '--'
}

Page({
  data: {
    scrollInnerMinPx: 480,
    loading: true,
    scopeAll: false,
    recordId: '',
    selfType: '--',
    backLabel: '返回测试记录',
    from: '',
    rows: [],
  },

  onLoad(query) {
    const app = getApp()
    const scopeAll = query.scope === 'all'
    const from = query.from || ''

    if (scopeAll) {
      app.globalData._showMutualSelfResult = false
      const raw = app.globalData.records
      const firstSelf = Array.isArray(raw) ? raw.find((r) => r.result && r.result.type) : null
      if (firstSelf) app.globalData.currentSelfRecord = firstSelf
      this.setData(
        {
          scopeAll: true,
          backLabel: '返回汇总',
          from,
          /** 汇总下列表每行用自己 selfTestId 解析；此项仅作占位，避免旧模板偶发取值异常 */
          selfType: '--',
        },
        () => this._refreshScrollFill(),
      )
      this.loadListAll()
      return
    }

    const recordId = query.recordId ? decodeURIComponent(query.recordId) : ''
    if (!recordId) {
      wx.showToast({ title: '缺少记录参数', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }
    app.globalData._showMutualSelfResult = true
    const rec = findSelfRecord(app, recordId)
    const selfLetters = selfTypeLettersFromFindRecord(rec)
    const selfTypeDisplay = selfLetters || '--'

    /** 兜底：仅用 result.type、无四维时仍可展示 --，对比页仍可依赖互测条目 selfTestId */
    app.globalData.currentSelfRecord =
      rec || app.globalData.currentSelfRecord || { id: recordId, result: { type: selfTypeDisplay } }

    const backLabel = from === 'records' ? '返回测试记录' : '返回汇总'
    this.setData(
      {
        scopeAll: false,
        recordId,
        selfType: selfTypeDisplay,
        backLabel,
        from,
      },
      () => this._refreshScrollFill(),
    )
    this.loadListSingle()
  },

  onReady() {
    this._refreshScrollFill()
  },

  _refreshScrollFill() {
    const px = scrollInnerMinHeightPx({
      bottomRpx: 16 + 116 + 24,
      aboveScrollRpx: 0,
    })
    if (px !== this.data.scrollInnerMinPx) this.setData({ scrollInnerMinPx: px })
  },

  loadListAll() {
    const app = getApp()
    const apply = (merged) => {
      app.globalData._mutualAllList = merged
      /** 汇总：每行 viewerSelfType 由互测条目 selfTestId + 本地 records 决定，不再传死 '--' 导致整页误判 */
      this.applyList(merged, '--')
    }

    let merged = app.globalData._mutualAllList
    if (Array.isArray(merged) && merged.length) {
      apply(merged)
      return
    }

    wx.showLoading({ title: '加载中', mask: true })
    mergeAllFromApi(app)
      .then((list) => {
        wx.hideLoading()
        apply(list)
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      })
  },

  loadListSingle() {
    const app = getApp()
    const { recordId, selfType } = this.data

    const cache = app.globalData._mutualResultsCache && app.globalData._mutualResultsCache[recordId]
    if (Array.isArray(cache)) {
      this.applyList(cache, selfType)
      return
    }

    wx.showLoading({ title: '加载中', mask: true })
    api
      .getMutualResults(recordId)
      .then((list) => {
        wx.hideLoading()
        const arr = Array.isArray(list) ? list : []
        syncRecordMutualCounts(app, recordId, arr)
        app.globalData._mutualResultsCache = app.globalData._mutualResultsCache || {}
        app.globalData._mutualResultsCache[recordId] = arr
        this.applyList(arr, selfType)
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '互测结果加载失败', icon: 'none' })
        this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      })
  },

  applyList(arr, pageSelfLettersForChip) {
    if (!arr.length) {
      this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      return
    }
    if (this.data.scopeAll && arr.length < MIN_MUTUAL_EVALUATIONS_FOR_VIEW) {
      const app = getApp()
      delete app.globalData._mutualAllList
      this.setData({ loading: false, rows: [] }, () => this._refreshScrollFill())
      showMutualTooFewThenBack()
      return
    }
    const app = getApp()
    const pageFb = this.data.scopeAll
      ? ''
      : normalizeLetterFour(pageSelfLettersForChip) ||
        normalizeLetterFour(this.data.selfType) ||
        ''

    const rows = arr.map((item, i) => normalizeMutualItem(item, i, app, pageFb))
    this.setData({ loading: false, rows }, () => this._refreshScrollFill())
  },

  onFriendAvatarError(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const rows = this.data.rows.map((r) =>
      r.id === id ? { ...r, friendAvatarLoadFailed: true } : r,
    )
    this.setData({ rows })
  },

  onOpenCompare(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const row = this.data.rows.find((r) => r.id === id)
    if (!row || !row.raw) return
    const app = getApp()
    const fromRow = resolveCompareSelfRecord(row.raw, app, row.viewerSelfType)
    const resolved =
      fromRow ||
      (this.data.recordId ? findSelfRecord(app, this.data.recordId) : null) ||
      app.globalData.currentSelfRecord ||
      null
    const selfRecord =
      resolved ||
      (() => {
        const sid = pickSelfTestId(row.raw)
        const t = normalizeLetterFour(row.viewerSelfType) || '--'
        return sid ? { id: sid, result: { type: t }, answers: [] } : null
      })()

    app.globalData.compareContext = {
      selfRecord:
        selfRecord || {
          id: pickSelfTestId(row.raw) || this.data.recordId || '',
          result: { type: row.viewerSelfType === '--' ? '--' : row.viewerSelfType },
          answers: [],
        },
      mutualRecord: row.raw,
    }
    wx.navigateTo({ url: '/pages/compare/index' })
  },

  onBack() {
    wx.navigateBack()
  },
})
