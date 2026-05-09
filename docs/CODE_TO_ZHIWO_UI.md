# code → zhiwo：UI 优先迁移对照表

目标：**先把各页 UI 与 `code` Canvas 版做到一致**，再接 `app.js` / `utils/api` 等逻辑。  
逻辑与状态字段以 `code/minigame/src/state.js`、`main.js` 为准。

本仓库已落地的辅助文件：

- `zhiwo/styles/code-theme.wxss`：与 `code/minigame/src/ui/theme.js` 及常用 scene 硬编码色对齐的 CSS 变量（已在 `app.wxss` 中 `@import`）。
- 列表与互测数据来自 `utils/session` 拉取后的 `globalData.records` 及 `utils/api.getMutualResults`（已无本地 mock）。
- `zhiwo/app.wxss`：`.shell-root` / `.shell-scroll` / `.shell-page` 等占位页通用布局。
- `zhiwo/pages/*/index`：`records`、`info`、`invite`、`mutual-invite`、`mutual-results`、`mutual-results-detail`、`compare`、`settings` 已注册为可跳转的 **UI 占位页**（首页入口已指向其中部分页面）。

---

## 1. 场景 → 小程序页面

| code `state.scene` | 说明 | zhiwo 建议路径 | code 绘制入口 |
| ------------------ | ---- | -------------- | ------------- |
| `home` | 首页 | `pages/index/index` | `scenes/home.js` |
| `quiz` | 自测 / 互测答题 | `pages/quiz/index` | `scenes/quiz.js` |
| `result` | 自测结果 | `pages/result/index` | `scenes/result.js` |
| `records` | 测试记录列表 | `pages/records/index` | `scenes/records.js` |
| `info` | 性格类型说明 | `pages/info/index` | `scenes/info.js` |
| `invite` | 邀请互测（记录维度） | `pages/invite/index` | `scenes/invite.js` |
| `mutualInvite` | 寻找知音入口 | `pages/mutual-invite/index` | `scenes/mutual-invite.js` |
| `mutualResults` | 朋友们眼中的你（汇总） | `pages/mutual-results/index` | `scenes/mutual-results.js` |
| `mutualResultsDetail` | 互测详情列表 | `pages/mutual-results-detail/index` | `scenes/mutual-results-detail.js` |
| `compare` | 自测 vs 某条互测对比 | `pages/compare/index` | `scenes/compare.js` |
| `settings` | 设置 | `pages/settings/index` | `scenes/settings.js` |

`code/minigame/src/router.js` 中的 key 与上表 `scene` 一致。

---

## 2. 全局设计 token（先抄这里再调 rpx）

| 用途 | code 位置 | 小程序 |
| ---- | --------- | ------ |
| 颜色、字号缩放函数 `s` | `src/ui/theme.js` | `zhiwo/styles/code-theme.wxss` 中 CSS 变量 |
| 安全区、缩放封装 | `src/state.js` 中 `s`, `topSafeY` | 导航用 `navigation-bar`；内容区用 `safe-area-inset-*` 或 padding |
| 字体 | `theme.fontFamily` + 加载逻辑 | `app.wxss` + `wx.loadFontFace`（已与 code 同源字体名对齐时沿用） |

**资源路径（`main.js` `loadImage`）**

- 首页背景：`images/index.jpg` → `zhiwo/images/index.jpg`
- 答题/多数内页底图：`images/question.jpg` → `zhiwo/images/question.jpg`
- 设置齿轮：`images/settings.png`（若该页需要）

---

## 3. 按页：从 code 抄 UI 时看哪里

以下列出**背景、主色、关键字号（均为 `s(数字)`，需按屏宽换算）** 与滚动相关状态。

### 首页 `home`

- 文件：`scenes/home.js`
- 背景：渐变 `#f6cdd3` → `#cfeee2` → `#f7f2df`，叠加 `homeBg`（contain + blur fill）
- 主按钮：`lemon` 填充 + `cardStroke` 描边；标题多用到 `bold s(28)`、`bold s(22)`、`s(20)` 链接色

### 答题 `quiz`

- 文件：`scenes/quiz.js`
- 背景：`commonBg` cover，失败时 `#f7f2df`
- 顶栏：`bold s(24)`；题目 `bold s(28)`；选项 `bold s(22)`，选项底 `lemon` / `mint`
- 头部条为渐变（见该文件 `createLinearGradient` 段）

### 结果 `result`

- 文件：`scenes/result.js`
- 维度条颜色与 `result.js` 内数组一致（与 `code-theme.wxss` 中 `--qy-dim-*` 对应）
- **可滚动正文**：与 `resultScrollY` / `resultScrollMax` 对应 → 小程序用 `scroll-view` + 固定底部按钮区

### 记录 `records`

- 文件：`scenes/records.js`
- 「今日」红色：`#d32f2f`，互测/今日为 `bold s(14)`
- 底部「朋友们眼中的你」与列表间距：见 `listBottom` 留白逻辑

### 说明 `info`

- 文件：`scenes/info.js`
- 类型大卡：`bold s(42)` 类型名，多 tab/列表与 `infoIndex` 对应

### 邀请 `invite`

- 文件：`scenes/invite.js`
- 布局与 `records` 相近，同一套卡片与 `commonBg`

### 互测入口 `mutualInvite`

- 文件：`scenes/mutual-invite.js`
- 视觉与首页类似（同渐变 + `homeBg`）

### 互测汇总 `mutualResults`

- 文件：`scenes/mutual-results.js`
- 汇总卡顶部：聚合类型 + 别名 + 高频原始类型（如 INFP、ESFP）
- 维度条配色与 `result` 一致

### 互测详情 `mutualResultsDetail`

- 文件：`scenes/mutual-results-detail.js`
- 标签同色：`#477A61` / `#A35D3A`
- 底部按钮与列表留白：`mutualResultsDetailScrollMax` 等区域

### 对比 `compare`

- 文件：`scenes/compare.js`
- 大分数字号 `bold s(42)` / `bold s(48)` 等

### 设置 `settings`

- 文件：`scenes/settings.js`

---

## 4. 建议的「静态壳」完成标准（每页打勾）

- [ ] 背景图 / 渐变 / 铺色与 code 一致  
- [ ] 标题栏样式与 safe 区一致  
- [ ] 主按钮，圆角、描边、`lemon`/`mint` 用法一致  
- [ ] 列表项：字号、颜色、`#d32f2f` 今日条一致  
- [ ] 需要滚动的区域已用 `scroll-view`，底部固定按钮不遮挡内容  
- [x] 数据字段与 `main.js` / 后端 `MinigameStorage` 一致（登录、saveRecord、getMutualResults 等）。

---

## 5. `state.js` 与路由参数（接逻辑时对齐）

常用字段：`mode`（`self` | `mutual`）、`questionIndex`、`answers`、`result`、`records`、`currentSelfRecord`、`mutualResults`、`invite`、`pendingInviteId`、`_mutualDetailBackToRecords` 等。  
跳转时建议 query 与现有 `code` 的「意图」一致（如 `recordId`、`inviteId`、`from=records`），便于互测详情返回按钮文案与 code 一致。

---

## 6. 工具与数据复用

- 题库：`code/minigame/src/data/questions.js` 或 JSON ↔ `zhiwo/data/`  
- 类型文案：`code/minigame/src/data/mbti-types.js` ↔ `zhiwo/data/mbti-types.js`  
- MBTI 计算：`code/minigame/src/data/mbti.js` ↔ `zhiwo/utils/mbti.js`  

UI 阶段只需保证 **展示用文案结构** 一致；算法可最后再接。
