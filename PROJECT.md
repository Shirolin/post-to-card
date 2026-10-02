# Project: Post-to-Card Chrome Extension

## Architecture
Post-to-Card 是一个基于 Manifest V3 的离线 Chrome 扩展，将 Twitter/X 推文及同作者连续长推文串联转换并渲染为高清晰度卡片图像。
采用多层解耦架构：
1. **Background Service Worker (ESM)**:
   - 具备 `twimg.com` / `pbs.twimg.com` 的 `host_permissions`。
   - 充当安全 CORS 图片代理：接收 Content Script 的 `FETCH_IMAGE_BASE64` 消息，将远程图片抓取并转化为 Base64 Data URL 返回，从源头消灭 Canvas 跨域污染 (`SecurityError`)。
2. **Twitter Platform Adapter (Content Script - DOM Layer)**:
   - 运行于 Twitter/X 页面。
   - 通过 150ms 防抖的 `MutationObserver` 监听页面并注入 "✨" 触发按钮（防重复机制标记 `data-post-to-card-injected`）。
   - 从推文 DOM 中递归还原原生 Unicode 表情（解析 Twemoji `img[alt]`）、提取富文本 Token、重写超清资源链接 (`_400x400` / `name=large`)、解析引用推文 (Quote Tweet)、沿推文链追溯并剔除广告与异作者回复，构建完整的单推/长推数据结构。
3. **Shadow DOM & Preact Card UI (Content Script - UI Layer)**:
   - 挂载自定义元素 `<post-to-card-container>`，采用 open ShadowRoot。
   - 注入经 Vite `?inline` 编译后的纯净 CSS 样式，切断继承链，保证与宿主 CSS 100% 隔离。
   - 基于 Preact 渲染现代化配置弹窗与卡片：
     - 3 套主推纸张主题 (羊皮纸 Parchment / 暗刊 Nocturne / 细线 Hairline) + 恢复的 3 套经典 (Linear Dark / OLED Black / Notion White) + 二期 3 套 (终端 Terminal / 报纸栏 Broadsheet / 粗野派 Brutalist)：每套由纸面色、边线、字对、强调色与一条签名装饰线定义，取代早期 6 套渐变皮肤。旧主题 id 经 `sanitizeTheme` 映射迁移。认证徽标用纸面墨色而非 Twitter 蓝——卡面上只允许一个强调色。所有主题色值只有 `themes.ts` 一处来源，由 `Card.tsx` 注入 CSS 自定义属性。
     - 3 档内边距 (16/32/48px)、3 档圆角 (0/12/20px)。
     - Auto 及 3:4 / 16:9 画幅（弹性下限法则 `min-height` + `height: auto`，向下平滑延展，绝不截断长文本）。
     - 离线矢量 SVG 二维码生成 (`qrcode-generator`)。
     - 5 大独立开关（二维码、互动数据、时间戳、水印、作者信息高斯模糊）。
     - 背景无抖动滚动锁、Esc 快捷键及点击蒙层关闭。
4. **Export Engine (Content Script - Canvas Layer)**:
   - 调用 `modern-screenshot` 进行 Retina 级 (scale: 2 或 3) 离线渲染。
   - 渲染前将所有图片替换为 Background 代理返回的 Base64 Data URL。
   - 优先调用 `navigator.clipboard.write` 复制 PNG 位图至剪贴板；若失去激活或权限被拒，无缝自动降级为触发本地高分 PNG 下载。
5. **Clean Multi-Entry Vite Build Pipeline**:
   - `background.js` 输出为标准 ESM 脚本。
   - `content.js` 输出为完全自包含的 IIFE 脚本（无顶层 import/export）。
   - 严控依赖：仅 `preact`, `modern-screenshot`, `qrcode-generator`，零外部依赖，100% 离线运行。

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Multi-Entry Build Pipeline | Vite 打包出 IIFE content.js 与 ESM background.js，支持 TS 检查与 Manifest V3 | M1 | ORIGINAL_REQUEST §R4 |
| F2 | Manifest V3 Packaging | manifest.json 配置，申明权限、twimg 域名权限、content_scripts | M1 | ORIGINAL_REQUEST §R4 |
| F3 | Minimal Dependencies | 仅引入 preact, modern-screenshot, qrcode-generator | M1 | ORIGINAL_REQUEST §R4 |
| F4 | Background CORS Image Proxy | Background Service Worker 监听消息代理请求 twimg 图片并返回 Base64 Data URL | M2 | ORIGINAL_REQUEST §R3 |
| F5 | Offline & Security Guarantee | 零外部远程调用，仅在本地及 twimg 授权域名内请求资源 | M2 | ORIGINAL_REQUEST §R3 |
| F6 | Tweet Action Bar Injection | 在 div[role="group"] 中动态插入 "✨" 按钮，携带防重复属性 | M3 | ORIGINAL_REQUEST §R1 |
| F7 | Debounced MutationObserver | 150ms 防抖监听推文挂载与虚拟滚动，无 UI 抖动 | M3 | ORIGINAL_REQUEST §R1 |
| F8 | SPA Route Navigation Handling | 适配 Twitter 客户端路由变化（主页/状态页/个人页） | M3 | ORIGINAL_REQUEST §R1 |
| F9 | Native Emoji Restoration | 遍历 Twemoji img[alt] 还原原生 Unicode emoji，修复 textContent 为空问题 | M3 | ORIGINAL_REQUEST §R1 |
| F10 | Mention & Hashtag Preservation | 识别并保留 @mentions 与 #hashtags 的富文本与高亮特征 | M3 | ORIGINAL_REQUEST §R1 |
| F11 | High-Res Media Upgrade | 头像升级为 _400x400，图片升级为 name=large，视频提取 poster 封面 | M3 | ORIGINAL_REQUEST §R1 |
| F12 | Multi-Image Grid Extraction | 支持 1-4 张图片网格媒体元数据解析 | M3 | ORIGINAL_REQUEST §R1 |
| F13 | Quote Tweet Extraction | 提取被引用推文（作者、文本、图片）构建 quotePost 结构 | M3 | ORIGINAL_REQUEST §R1 |
| F14 | Continuous Thread Connector | 追溯同作者连续推文，剔除广告与他人回复，构建长推文串联时间线 | M3 | ORIGINAL_REQUEST §R1 |
| F15 | Custom Element & Shadow DOM | 注册 `<post-to-card-container>`，open ShadowRoot 挂载 | M4 | ORIGINAL_REQUEST §R2 |
| F16 | Inline CSS Style Isolation | 通过 Vite ?inline 注入编译后 CSS，100% 隔离 Twitter 宿主样式 | M4 | ORIGINAL_REQUEST §R2 |
| F17 | Curated Themes | 3 套主推纸张（羊皮纸 / 暗刊 / 细线）+ 3 套恢复的经典（Linear 暗黑 / 极致纯黑 / Notion 纯白）+ 2 套二期材料（终端 / 报纸栏）+ 1 套实验性（粗野派，默认关闭）；token 表为唯一来源 | M4 / P2 | ORIGINAL_REQUEST §R2 |
| F18 | Padding & Border Radius Options | 3 档内边距 (16/32/48px) 与 4 档圆角（跟随主题 / 0/12/20px） | M4 | ORIGINAL_REQUEST §R2 |
| F19 | Downward Expanding Poster Layouts | Auto 及 3:4 / 16:9 画幅弹性下限 min-height，长文本平滑向下延展绝不截断 | M4 | ORIGINAL_REQUEST §R2 |
| F20 | Offline QR Code Generator | 纯本地 qrcode-generator 生成推文链接矢量 SVG 二维码 | M4 | ORIGINAL_REQUEST §R2 |
| F21 | Interactive Controls & Toggles | 二维码、互动数据、时间戳、水印开关 | M4 | ORIGINAL_REQUEST §R2 |
| F22 | Author Privacy Blurring | 对作者昵称、Handle、头像启用 filter: blur(...) 隐私保护 | M4 | ORIGINAL_REQUEST §R2 |
| F23 | Modal UX & Scroll Lock | 弹窗居中、Esc 快捷键、蒙层关闭、背景无抖动滚动锁 | M4 | ORIGINAL_REQUEST §R2 |
| F24 | Modern-Screenshot Retina Export | 调用 modern-screenshot 生成 2x/3x 高分辨率 PNG | M5 | ORIGINAL_REQUEST §R3 |
| F25 | Canvas CORS Taint Prevention | 导出前置换 Base64 Data URL，彻底阻绝 SecurityError | M5 | ORIGINAL_REQUEST §R3 |
| F26 | Clipboard Copy with Fallback | 复制图片至剪贴板，异常时自动平滑降级为本地 PNG 下载 | M5 | ORIGINAL_REQUEST §R3 |
| F27 | E2E Testing Suite (Tiers 1-4) | 4 层验收测试套件，全面覆盖全部特性与真实用例 | M-TEST | Acceptance Criteria |
| F28 | Adversarial Testing & Audit | Tier 5 对抗性边缘强化与 Forensic Auditor 门禁审计 | M6 | Integrity Forensics |
| F29 | Non-Obstructive Video Styling | 视频帖不透明胶囊角标，无渐变进度条、无压暗层（角标已自带底色），不遮挡高清 poster 与烧录字幕 | M6 | Feature Enhancement |
| F30 | Configurable Action Button | 支持推文卡片按钮显隐开关、Popup 快捷管理、Alt+C 快捷键与多标签实时同步 | M6 | Feature Enhancement |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-TEST | E2E Testing Track | 构建测试运行器、模拟 DOM 夹具、Tiers 1-4 全面测试集，输出 TEST_READY.md | none | DONE |
| M1 | Project Setup & Clean Vite Packaging | package.json, tsconfig, vite multi-entry build, manifest.json, 类型定义 | none | DONE |
| M2 | Background Service Worker & Image Proxy | Background 脚本、CORS 图片抓取与 Base64 转换、本地内存缓存 | M1 | DONE |
| M3 | Twitter/X Platform Adapter & Extractor | 注入按钮、防抖 MutationObserver、推文与 Thread 连续提取、Emoji/URL 升级 | M1 | DONE |
| M4 | Shadow DOM & Preact Card Modal | `<post-to-card-container>`, Preact 视图、6 主题、内边距圆角、防截断画幅、离线二维码与控制开关 | M1 | DONE |
| M5 | Export Engine & End-to-End Integration | modern-screenshot 视口渲染、Base64 桥接、剪贴板复制及降级下载、通过 100% E2E 测试 | M2, M3, M4, M-TEST | DONE |
| M6 | Adversarial Hardening & Forensic Victory Audit | Tier 5 盲区对抗性压力测试、代码审查与 Forensic Auditor 最终门禁审计 | M5 | DONE |

---

## Interface Contracts

### 1. Extracted Tweet Data Model (`src/types/tweet.ts`)
```typescript
export interface AuthorInfo {
  name: string;
  handle: string;
  avatarUrl: string;
  verified?: boolean;
}

export interface MediaItem {
  type: 'image' | 'video' | 'gif';
  url: string; // upgraded to large or 400x400
  originalUrl?: string;
  posterUrl?: string;
  alt?: string;
  aspectRatio?: number;
}

export interface TweetStats {
  replies?: string;
  reposts?: string;
  likes?: string;
  views?: string;
  bookmarks?: string;
}

export interface QuoteTweetData {
  author: AuthorInfo;
  text: string;
  media?: MediaItem[];
  timestamp?: string;
}

export interface TweetData {
  id: string;
  url: string;
  author: AuthorInfo;
  text: string; // unicode emojis restored
  richTokens?: Array<{ type: 'text' | 'mention' | 'hashtag' | 'link' | 'emoji'; value: string; href?: string }>;
  timestamp: string; // ISO or formatted
  stats?: TweetStats;
  media?: MediaItem[];
  quotePost?: QuoteTweetData;
  isThreadPart?: boolean;
  threadIndex?: number;
  threadTotal?: number;
}

export interface ThreadData {
  author: AuthorInfo;
  tweets: TweetData[];
  isSingle: boolean;
}
```

### 2. Card Customization Configuration (`src/types/card.ts`)
```typescript
export type ThemeId = 'parchment' | 'nocturne' | 'hairline' | 'linear-dark' | 'oled-black' | 'notion-white' | 'terminal' | 'broadsheet' | 'brutalist';
export type PaddingOption = '16px' | '32px' | '48px';
export type RadiusOption = 'theme' | '0px' | '12px' | '20px';
export type AspectRatioOption = 'auto' | '3:4' | '16:9';

export interface CardConfig {
  theme: ThemeId;
  padding: PaddingOption;
  borderRadius: RadiusOption;
  aspectRatio: AspectRatioOption;
  showQrCode: boolean;
  showStats: boolean;
  showTimestamp: boolean;
  showWatermark: boolean;
  blurAuthor: boolean;
}
```

### 3. Background Proxy Message Protocol (`src/types/messages.ts`)
```typescript
export type ExtensionMessage =
  | { type: 'FETCH_IMAGE_BASE64'; url: string }
  | { type: 'PING' };

export type ExtensionResponse =
  | { success: true; dataUrl: string; contentType: string }
  | { success: false; error: string };
```

---

## Code Layout
```
d:/Project/post-to-card/
├── manifest.json                  # Manifest V3 模板/配置
├── package.json                   # 核心依赖 (preact, modern-screenshot, qrcode-generator)
├── tsconfig.json                  # TypeScript 配置
├── vite.config.ts                 # 三模式/多入口 Vite 构建管道
├── dev/                           # 仅开发用：可视化 UI harness
│   ├── preview.html
│   ├── preview.ts                 # 内存夹具 + ?bare=1 + ?a11y=1 焦点陷阱审计
│   └── vite.harness.config.ts
├── docs/
│   ├── detection-audit.md         # 检测逻辑整改清单（P0/P1/P2）
│   ├── x-graphql-research.md      # GraphQL 拦截方案调研
│   └── real-dom-sampling-checklist.md  # 真实 DOM 采样清单
├── src/
│   ├── types/                     # 共享类型定义
│   │   ├── tweet.ts
│   │   ├── card.ts
│   │   └── messages.ts
│   ├── background/                # Background Service Worker (ESM)
│   │   ├── index.ts
│   │   └── proxy.ts               # twimg 跨域图片抓取与 Base64 缓存
│   ├── content/                   # Content Script (IIFE)
│   │   ├── index.ts               # 入口、双通道调度
│   │   ├── adapter/               # Twitter DOM 适配与数据提取
│   │   │   ├── extractor.ts
│   │   │   ├── emojis.ts
│   │   │   ├── thread.ts
│   │   │   ├── social.ts          # 转发/回复/置顶的结构化判据
│   │   │   ├── injection.ts
│   │   │   └── urls.ts
│   │   ├── graphql/               # 结构化数据通道
│   │   │   ├── hook.ts            # MAIN world 拦截 fetch/XHR
│   │   │   ├── bridge.ts          # 隔离 world 接收与缓存
│   │   │   └── parse.ts           # 响应 → ThreadData
│   │   ├── container/             # Shadow DOM 自定义元素封装
│   │   │   └── element.ts
│   │   ├── ui/                    # Preact 界面与卡片组件
│   │   │   ├── App.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Controls.tsx
│   │   │   ├── qrcode.ts
│   │   │   └── themes.ts
│   │   ├── styles/                # CSS 样式 (内联导入)
│   │   │   ├── card.css
│   │   │   └── modal.css
│   │   └── engine/                # 截图与导出引擎
│   │       ├── export.ts
│   │       └── fallback.ts
├── tests/                         # E2E 测试轨与夹具
│   ├── runner.ts
│   ├── fixtures/
│   └── tiers/
│       ├── tier1_features.test.ts
│       ├── tier2_boundaries.test.ts
│       ├── tier3_interactions.test.ts
│       ├── tier4_workloads.test.ts
│       ├── tier_i18n.test.ts
│       └── tier_graphql.test.ts
└── dist/                          # 构建产物 (manifest.json, background.js, graphql-hook.js, content.js)
```

---

## Data Channels

推文数据有两条独立通道，`src/content/index.ts` 的 `resolveThreadData` 负责调度：

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
| 弱 | `div[data-testid="socialContext"]` 容器本身稳定，**其内部文案随界面语言变化** |
| 已弃用 | 混淆类名 `r-*`/`css-*`、inline style、界面文案正则 |

`TweetData.diagnostics` 记录每条记录用了哪条通道、哪个 operation、是否走了降级。
`source` 降为 `dom` 的比例突然升高，即为 X 改版的早期信号。
