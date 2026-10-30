# Project: Post-to-Card Chrome Extension

## Architecture
Post-to-Card（PostPress · 印推）是一个基于 Manifest V3 的纯本地 Chrome 扩展，将 X（Twitter）推文及同作者连续长推文串联并渲染为高清晰度出版级卡片图像。

采用多层解耦架构：
1. **Background Service Worker (`background.js`, ESM)**:
   - 具备 `https://*.twimg.com/*` 的 `host_permissions`（并由 `isAllowedHost` 白名单严格校验主机名，阻断 SSRF）。
   - 充当安全 CORS 图片代理：接收 Content Script 的 `FETCH_IMAGE_BASE64` 消息，将远程图片抓取并转化为 Base64 Data URL 返回（带 64MB 字节预算与条数双限的 LRU 内存缓存），从源头消灭 Canvas 跨域污染 (`SecurityError`)。
2. **GraphQL Hook (`graphql-hook.js`, IIFE, `MAIN` world)**:
   - 在 `document_start` 阶段注入页面主环境，挂载 `fetch` 与 `XMLHttpRequest` 拦截器。
   - 仅按 URL 中的 `operationName` 匹配推文与会话响应，通过 `window.postMessage` 将结构化载荷转发给隔离环境中的 Content Script。
3. **Twitter Platform Adapter (`content.js` - DOM & Resolver Layer, `ISOLATED` world)**:
   - 通过 150ms 防抖的 `MutationObserver` 监听页面并注入产品印刷机线稿按钮（防重复标记 `data-post-to-card-injected`）。
   - `resolveThread` 双通道调度：优先消费 GraphQL 结构化会话树，未命中或失败时平滑降级至 DOM 提取器。
   - DOM 通道由 `ownership.ts` 统一裁定元素归属（主帖 / 引用帖 / Article），递归还原 Twemoji 原生 Unicode 表情（`img[alt]`）、提取富文本 Token、升级超清资源链接（头像 `_400x400`，配图优先 `format=jpg&name=orig` 并附带 `orig → large → medium → 原图` 降级链）、提取引用推文与长文（Article），并沿时间线追溯拼接同作者连续推文。
4. **Shadow DOM & Preact Card UI (`content.js` - UI Layer)**:
   - 挂载自定义元素 `<post-to-card-container>`，采用 open ShadowRoot，内联 `:host { all: initial }` 纯净样式表，与宿主页面 CSS 100% 隔离。
   - 基于 Preact 渲染实时配置弹窗与卡片：
     - **12 套材质主题**：11 套常驻材质（Minimal / Midnight / Liquid Glass / Material 3 / Gallery / Darkroom / Riso / Sumi / Clay / Terminal / Receipt）与 1 套实验性材质（Brutalist，默认关闭）。每套由纸面色、边线、字对、单一强调色、签名装饰线（Signature）与呼吸节奏共同定义；旧主题 id 经 `sanitizeTheme` 映射至最接近的现行材质。所有主题色值与装饰定义以 `themes.ts` 为唯一真值源。
     - **版式与画幅**：3 档内边距（`16px` / `32px` / `48px`，默认 `16px`）、4 档圆角（`theme` 跟随材质 / `0px` / `12px` / `20px`，默认 `theme`）、3 档卡片画幅（`auto` / `3:4` / `16:9`，采用 `min-height` 弹性下限，长文向下延展绝不截断）。
     - **独立外层画布（Mat）**：输出画幅（`auto` / `1:1` / `4:5` / `3:4` / `16:9`）与画布背景（`none` / `theme` / 纯色 / 渐变）彼此独立，默认关闭；卡片挂载于 `.ptc-mat` 上，mat 即为导出目标（`#post-to-card-export-target`）。
     - **14 种语言（i18n）**：支持 `'auto'`（跟随浏览器）及 14 种显式语言，同时驱动弹窗 UI、扩展 Popup 与卡面日期格式。
     - **精细控制与逐条作者隐私**：8 个开关按作用范围分组（卡片页脚、隐私、导出、呈现细节）；作者隐私模糊支持全局默认开关，亦支持点击卡片上单条推文（或首层引用推文）的头像单独切换该作者的显隐。
     - **无抖动交互**：背景滚动锁（含滚动条宽度补偿）、`Esc` 与蒙层关闭、首帧 `fit` 测量防闪烁及推文剔除/恢复的双层 FLIP 动画。
5. **Export Engine (`content.js` - Canvas Layer)**:
   - 调用 `modern-screenshot` 进行 Retina 级离线光栅化：单条推文默认 3×，超出 2048px 显示上限的长图自动降为 2×，并受浏览器画布像素上限约束（倍数算法以 `engine/scale.ts` 为唯一真值源）。
   - 渲染前在克隆树中将远程图片替换为 Background 代理返回的 Base64 Data URL（整卡 25s 超时预算，失败图片回落为干净的内联 SVG 占位）。
   - 剪贴板写入在点击当刻发起（`beginClipboardWrite`）：`ClipboardItem` 持有尚未渲染完成的图像 Promise，避免长图渲染耗时导致用户瞬时手势激活过期；若剪贴板写入被拒或不受支持，无缝降级为本地 PNG 下载。
6. **Clean Multi-Entry Vite Build Pipeline**:
   - 四个独立构建入口：`background.js`（ESM）、`graphql-hook.js`（IIFE）、`content.js`（IIFE）、`popup.js`（IIFE，直接复用 `prefs.ts` 与 `popupCopy.ts`）。
   - 严控运行时依赖：仅 `preact`、`modern-screenshot`、`qrcode-generator`、`lucide-preact` 四项，零外部服务，100% 本地运行。

---

## Feature Inventory

> 「任务书」指 [docs/original-brief.md](docs/original-brief.md)——2026-09-29 开工时的原始需求。

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Multi-Entry Build Pipeline | Vite 驱动四独立入口（ESM `background` + IIFE `hook` / `content` / `popup`），含 TS 检查与 knip 扫描 | M1 | 任务书 §R4 |
| F2 | Manifest V3 Packaging | `manifest.json` 声明最小权限、`*.twimg.com` 主机权限、双环境 `content_scripts` 与 `_locales` | M1 | 任务书 §R4 |
| F3 | Minimal Dependencies | 运行时仅引入 `preact`, `modern-screenshot`, `qrcode-generator`, `lucide-preact` | M1 | 任务书 §R4 |
| F4 | Background CORS Image Proxy | Service Worker 监听消息代理抓取 `twimg` 图片并返回 Base64 Data URL（含 64MB 内存缓存） | M2 | 任务书 §R3 |
| F5 | Offline & Security Guarantee | 零外部远程调用，严格校验 `*.twimg.com` 主机名防止 SSRF | M2 | 任务书 §R3 |
| F6 | Tweet Action Bar Injection | 在推文操作栏 `div[role="group"]` 动态插入印刷机图标按钮，跟随原生尺寸与主题色 | M3 | 任务书 §R1 |
| F7 | Debounced MutationObserver | 150ms 防抖监听推文挂载与虚拟滚动，无 UI 抖动 | M3 | 任务书 §R1 |
| F8 | SPA Route Navigation Handling | 适配 X 客户端路由切换（主页 / 状态详情页 / 个人页 / 搜索页） | M3 | 任务书 §R1 |
| F9 | Native Emoji Restoration | 遍历 Twemoji `img[alt]` 还原原生 Unicode emoji，修复 `textContent` 丢失表情问题 | M3 | 任务书 §R1 |
| F10 | Mention, Hashtag & Cashtag Preservation | 识别并保留 `@mentions`、`#hashtags` 与 `$cashtags` 的富文本高亮特征 | M3 | 任务书 §R1 |
| F11 | High-Res Media Upgrade | 头像升级为 `_400x400`，配图升级为 `format=jpg&name=orig`（含多级回退链），视频提取 poster 封面 | M3 | 任务书 §R1 |
| F12 | Multi-Image Grid Extraction | 支持 1–4 张图片网格与堆叠布局元数据解析 | M3 | 任务书 §R1 |
| F13 | Quote Tweet Extraction | 提取被引用推文（含两级嵌套引用预览与独立媒体归属判定）构建 `quotePost` 结构 | M3 | 任务书 §R1 |
| F14 | Dual-Channel Thread Resolution | GraphQL 结构化会话树优先 + DOM 时序/连接线兜底，拼接同作者连续推文并过滤广告与异作者回复 | M3 / M6 | 任务书 §R1 |
| F15 | Custom Element & Shadow DOM | 注册 `<post-to-card-container>`，open ShadowRoot 挂载 | M4 | 任务书 §R2 |
| F16 | Inline CSS Style Isolation | 通过 Vite `?inline` 注入编译后 CSS（`:host { all: initial }`），100% 隔离宿主样式 | M4 | 任务书 §R2 |
| F17 | Curated Material Themes | 11 套常驻材质主题 + 1 套实验性粗野派，含专属签名装饰线与字阶，`themes.ts` 为唯一真值源 | M4 / P2 | 任务书 §R2 |
| F18 | Padding & Border Radius Options | 3 档内边距（`16px` / `32px` / `48px`）与 4 档圆角（`theme` / `0px` / `12px` / `20px`） | M4 | 任务书 §R2 |
| F19 | Downward Expanding Poster Layouts | `auto` 及 `3:4` / `16:9` 画幅采用 `min-height` 弹性下限，长文本平滑向下延展绝不截断 | M4 | 任务书 §R2 |
| F20 | Offline QR Code Generator | 纯本地 `qrcode-generator` 生成原帖链接矢量 SVG 二维码 | M4 | 任务书 §R2 |
| F21 | Interactive Controls & Toggles | 8 个开关按作用范围分组（卡片页脚 / 隐私 / 导出 / 呈现细节），缺失对应元数据时自动隐藏开关 | M4 | 任务书 §R2 |
| F22 | Granular Author Privacy Blurring | 支持全局作者脱敏默认开关，以及点击单条推文或首层引用头像独立切换模糊/显示状态 | M4 / M7 | 任务书 §R2 |
| F23 | Modal UX & Scroll Lock | 弹窗居中、`Esc` 快捷键、蒙层关闭、窄屏默认收起控制栏、背景无抖动滚动锁 | M4 | 任务书 §R2 |
| F24 | Modern-Screenshot Retina Export | 生成 3×（单条）/ 2×（超长串）高分辨率 PNG，支持手动开启全局 3×「输出最高清晰度」 | M5 | 任务书 §R3 |
| F25 | Canvas CORS Taint Prevention | 导出前在克隆节点上置换 Base64 Data URL，导出后无损还原，彻底阻绝 `SecurityError` | M5 | 任务书 §R3 |
| F26 | Gesture-Safe Clipboard Copy & Fallback | 点击当刻锁定剪贴板写入通道（Promise-backed `ClipboardItem`），异常时自动降级为 PNG 下载 | M5 / M7 | 任务书 §R3 |
| F27 | E2E Testing Suite (Tiers 1–4 + 5 专项) | 4 层功能/边界/交互/工作流测试 + `i18n` / `graphql` / `resolver` / `article` / `hygiene` 五大专项门禁 | M-TEST | Acceptance Criteria |
| F28 | Adversarial Testing & Bundle Audit | Tier 5 对抗性边缘强化与构建产物取证审计（含 bundle 新鲜度与 `_locales` 完整性校验） | M6 | Integrity Forensics |
| F29 | Non-Obstructive Video Styling | 视频帖采用不透明胶囊角标，无渐变遮罩或压暗层，不遮挡高清 poster 与字幕 | M6 | Feature Enhancement |
| F30 | Configurable Action Button & Hotkey | 支持推文卡片按钮显隐开关、Popup 快捷唤起、`Alt+C` 快捷键与多标签实时同步 | M6 | Feature Enhancement |
| F31 | Long-form Post (Article) Rendering | 识别状态页阅读视图与列表页预览卡两种 X 长文形态，提取封面、眉标、标题与导语并独立排版 | M6 | Feature Enhancement |
| F32 | Truncated Post Indicator | DOM 通道识别含「显示更多」的截断长推文（`note_tweet`），补省略号与「内容有删减」提示 | M6 | Feature Enhancement |
| F33 | Canvas Mat & Output Ratio | 卡片挂载于外层画布（`.ptc-mat`），支持独立输出画幅（`1:1` / `4:5` / `3:4` / `16:9`）与纯色/渐变/主题背景 | M6 | Feature Enhancement |
| F34 | 14-Locale Internationalization | 类型化字典驱动 14 种界面与卡面语言，支持 `'auto'` 跟随浏览器与 Chrome `_locales` 完整映射 | M6 | Feature Enhancement |
| F35 | Open-Source Release Hygiene | 以 `GPL-3.0-or-later` 发布，配备完整许可、贡献、安全、隐私与变更文档，卡片署名链接指向源码仓库（GPL §6） | M7 | Release Hygiene |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Testing Track | 构建测试运行器、模拟 DOM 夹具、Tiers 1–4 全面测试集与 5 个专项 tier | none | DONE |
| M1 | Project Setup & Clean Vite Packaging | `package.json`, `tsconfig`, Vite 四入口构建, `manifest.json`, 类型定义 | none | DONE |
| M2 | Background Service Worker & Image Proxy | Background 脚本、CORS 图片抓取与 Base64 转换、本地内存缓存 | M1 | DONE |
| M3 | Twitter/X Platform Adapter & Extractor | 注入按钮、防抖 `MutationObserver`、推文与 Thread 连续提取、Emoji/URL 升级 | M1 | DONE |
| M4 | Shadow DOM & Preact Card Modal | `<post-to-card-container>`, Preact 视图、12 材质主题、内边距圆角、防截断画幅、离线二维码与控制开关 | M1 | DONE |
| M5 | Export Engine & End-to-End Integration | `modern-screenshot` 视口渲染、Base64 桥接、剪贴板复制及降级下载、通过 100% E2E 测试 | M2, M3, M4, M-TEST | DONE |
| M6 | Adversarial Hardening & Deepening | GraphQL 双通道、外层画布 Mat、长文 Article、14 语种 i18n、Tier 5 对抗门禁与架构深化 | M5 | DONE |
| M7 | Open-Source Release & UX Polish | `GPL-3.0-or-later` 许可体系、逐条作者隐私、首帧与列表 FLIP 动效探针、薄荷品牌视觉升级 | M6 | DONE |

---

## Interface Contracts

契约的唯一定义在各类型文件里（`src/types/`）。这里只给指针与「为什么」，不抄字段表——
抄一份就多一处会腐的缓存，本节过去正是这样落后于代码的。

### 1. Extracted Tweet Data Model

见 `src/types/tweet.ts`。`TweetData` 随功能增长（`retweetedBy`、`translatedFrom`、`truncated`、
`diagnostics`，以及 `richTokens` 的 `cashtag`），`ThreadData` 另有 `targetTweetIndex`；
字段语义与「为什么这么设计」写在类型自身的注释里，那才是唯一来源。

### 2. Card Customization Configuration

见 `src/types/card.ts`。`ThemeId` 是 12 个在用材质 id（`minimal` … `brutalist`），已退役的旧 id 在
`LegacyThemeId` 里、经 `sanitizeTheme` 映射；`CardConfig` 涵盖主题、边距、圆角、画幅、外层画布
（`canvasRatio` / `canvasBackground`）、图片裁剪与布局、语言偏好（`locale: LocalePreference`，
14 门语言的 id 或 `'auto'`，解析规则见 `docs/i18n.md`）、各类展示开关、最高清晰度偏好（`preferHighResolution`）、
长串排除列表（`excludedTweetIds`）以及逐条作者隐私覆盖（`authorBlurOverrides`）。
选项的合法取值表与回落规则集中在 `src/content/ui/options.ts`，画布背景色表在 `src/content/ui/themes.ts`
（`CANVAS_BACKGROUNDS` / `resolveCanvasBackground`），几何计算在 `src/content/ui/geometry.ts`。

### 3. Background Proxy Message Protocol

见 `src/types/messages.ts`。

---

## Code Layout
```
post-to-card/
├── manifest.json                  # Manifest V3 配置（声明 MAIN / ISOLATED 双脚本与最小权限）
├── package.json                   # 核心依赖与构建/验证脚本
├── tsconfig.json                  # TypeScript 配置（另附 tsconfig.test-support.json）
├── vite.config.ts                 # 四入口 Vite 构建管道（background / hook / content / popup）
├── dev/                           # 开发与真浏览器验证工具（UI harness、verify-extension/extractor/motion）
├── docs/                          # 架构评审、i18n、加载态、DOM 判据审计、实测快照与 GraphQL 调研
├── site/                          # 产品展示站源码（GitHub Pages 自动部署）
├── src/
│   ├── types/                     # 共享类型（TweetData / CardConfig / 消息协议）
│   ├── background/                # Service Worker：twimg 跨域抓取与 Base64 缓存
│   └── content/                   # Content Script：adapter/ 走 DOM 通道，graphql/ 走结构化通道，
│                                  #   ui/ 是 Preact 卡片与弹窗，locales/ 是 14 语种字典，
│                                  #   styles/ 是 Shadow DOM 内的 CSS，engine/ 负责光栅化与导出，
│                                  #   popup.ts 是扩展工具栏弹窗入口
├── tests/                         # runner + tier5_adversarial + fixtures/（真实夹具）+ tiers/（分层验收）
└── dist/                          # 构建产物 (manifest.json, background.js, graphql-hook.js, content.js, popup.js, _locales/)
```

目录逐个文件列在这里只会过期，所以这里只点职责，具体文件看仓库。

---

## Data Channels

推文数据有两条独立通道，`src/content/adapter/resolver.ts` 的 `resolveThread` 负责调度
（`src/content/index.ts` 只是调用方）：

| 通道 | 入口 | 何时使用 |
|---|---|---|
| **GraphQL** | `graphql/hook.ts`（MAIN world，`document_start`）拦截页面自己的 `fetch`/`XHR` | 捕获到可解析响应时优先使用 |
| **DOM** | `adapter/` 全套解析器 | GraphQL 未命中、不可解析或返回空时兜底 |

GraphQL 优先是因为它直接给出 thread 归属、回复目标与转发关系，无需从渲染结果反推。
**空结果集视为失败而非成功** —— X 会把 GraphQL 请求失败静默吞掉（社区实测：72 个单元全部
"succeeded" 却零结果），若把空当成功，接口轮换将无法被发现。

### 为什么绝不硬编码 queryId

X 定期轮换 GraphQL 的 queryId（`TweetDetail` 至少有 5 个历史值，`SearchTimeline` 至少 6 个）。
因此：

- **只按 `operationName` 匹配请求**，queryId 仅写入 `diagnostics` 供轮换监控
- 社区共识（XActions 开发规范、twitter-web-exporter 实现）均如此；代码里出现 queryId 字面量即为 bug
- 因为是页内 hook，可直接复用页面已构造好的 `variables`/`features`/`fieldToggles` 与
  `x-client-transaction-id`，无需自行发请求，也就免疫了 GET→POST 迁移和 feature 清单变更

### 依赖的稳定性分级

| 可靠性 | 信号 |
|---|---|
| 强 | `a[href*="/status/"]`、`time[datetime]`、snowflake ID 大小关系、GraphQL 字段路径 |
| 中 | `data-testid`（X 自己的锚点，但曾被重命名；未登录页完全不存在） |
| 弱 | `[data-testid="socialContext"]` 属性本身稳定（可能挂在 `div` 或 `span` 上），**其内部文案随界面语言变化** |
| 已弃用 | 混淆类名 `r-*`/`css-*`、inline style、界面文案正则 |

`TweetData.diagnostics` 记录每条记录用了哪条通道、哪个 operation、是否走了降级。
`source` 降为 `dom` 的比例突然升高，即为 X 改版的早期信号。

但 `dom` 升高本身不足以报警：时间线上的帖子本来就没有 detail payload，GraphQL 通道
合法地不回答。因此**未命中原因**另有记录 —— `diagnostics.graphqlMiss`：

| 值 | 含义 | 是不是异常 |
|---|---|---|
| `no-payload` | 没有捕获到任何 payload | 否 —— 时间线上的常态 |
| `invalid-json` | 捕获到的 body 不是 JSON | 是 —— 捕获环节坏了 |
| `unexpected-shape` | body 是 JSON 但不是解析器认识的结构 | 是 —— X 改了 payload 形状 |
| `no-tweets` | payload 解析成功但零推文 | **是，且最重要** —— 轮换后的端点长这样 |
| `target-absent` | payload 里有推文但没有要的那条 | 否 —— 缓存里是另一次会话 |

`no-tweets` 之所以最重要：X 把失败的请求静默吞掉，社区实测 72 个单元全部 "succeeded"
却零结果。**这条 reason 上涨，就是接口轮换已经发生的证据** —— 而在此之前，
`parseError` 只是一个没人读的字符串，轮换无法被发现。
