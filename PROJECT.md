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
     - 6 套预设主题 (Linear Dark, Sunset Glow, Aurora Purple, Notion Clean White, Cyber Mint, OLED Black)。
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
| F17 | 6 Curated Preset Themes | Linear Dark, Sunset Glow, Aurora Purple, Notion Clean White, Cyber Mint, OLED Black | M4 | ORIGINAL_REQUEST §R2 |
| F18 | Padding & Border Radius Options | 3 档内边距 (16/32/48px) 与 3 档圆角 (0/12/20px) | M4 | ORIGINAL_REQUEST §R2 |
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
export type ThemeId = 'linear-dark' | 'sunset-glow' | 'aurora-purple' | 'notion-clean-white' | 'cyber-mint' | 'oled-black';
export type PaddingOption = '16px' | '32px' | '48px';
export type RadiusOption = '0px' | '12px' | '20px';
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
├── vite.config.ts                 # 双模式/多入口 Vite 构建管道
├── src/
│   ├── types/                     # 共享类型定义
│   │   ├── tweet.ts
│   │   ├── card.ts
│   │   └── messages.ts
│   ├── background/                # Background Service Worker (ESM)
│   │   ├── index.ts
│   │   └── proxy.ts               # twimg 跨域图片抓取与 Base64 缓存
│   ├── content/                   # Content Script (IIFE)
│   │   ├── index.ts               # 入口与 MutationObserver 注入器
│   │   ├── adapter/               # Twitter DOM 适配与数据提取
│   │   │   ├── extractor.ts
│   │   │   ├── emojis.ts
│   │   │   ├── thread.ts
│   │   │   └── urls.ts
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
│       └── tier4_workloads.test.ts
└── dist/                          # 构建产物 (manifest.json, background.js, content.js)
```
