# Chrome Web Store 上架文案

商店后台的字段与 `manifest.json` 的 `name` / `description` 是**两份独立存储**：改这里不会自动更新商店页，改 `public/_locales/` 也不会同步到商店后台。

目前 `manifest.json` 的 `name` 与 `description` 已通过 `__MSG_extTitle__` 与 `__MSG_extDesc__` 接入 14 国语言目录（`public/_locales/<locale>/messages.json`），其中 `en_US` 与 `zh_CN` 的文案与下方「名称」「简短说明」完全一致。调整简短说明时请同步更新对应的 `messages.json`。

## 名称

```
PostPress · 印推
```
*(英文主名称：`PostPress — X & Thread Card Studio`)*

## 简短说明（manifest `description`，上限 132 字符）

英文（125 字符，在上限以内）：

```
Press X posts and threads into print-grade cards. 12 tactile themes, custom canvas mats, 100% local rendering, zero uploads.
```

中文（43 字符）：

```
把 X 推文与长串装帧成出版级高清卡片。12 款纸张肌理与自由画幅，纯本地排印，零数据上传。
```

## 详细说明

### 英文

```
PostPress — Press X posts and threads into publication-grade cards.

Stop sharing cluttered, low-DPI browser screenshots. Click the press icon on any post (or press Alt + C), and PostPress typesets single posts or multi-post threads into crisp, print-grade cards—ready to copy to your clipboard or export as 3× Retina PNGs.

WHAT YOU GET:

• 12 Tactile & Digital Themes — Minimal, Midnight, Liquid Glass, Material 3, Gallery, Darkroom, Riso, Sumi, Clay, Terminal, Receipt, plus an experimental Brutalist. Each is a complete design system: paper grain, border rules, typographic pairs, accents, and signature marks.
• Independent Canvas Matting — Mount the card on a standalone canvas mat. Aspect ratios: 1:1, 4:5, 3:4, 16:9 (elastic min-height; long text never truncates). Backdrops: follow theme, solid color, gradient, or transparent whitespace.
• Smart Thread Stitching — Dual-pipeline resolution (GraphQL with DOM fallback) seamlessly threads consecutive posts by the same author while filtering out ads and third-party replies. Exclude individual posts with one click.
• Long-form & Rich Quotes — Natively parses X Articles with cover images, kickers, titles, and ledes; quoted posts render in filled or outlined styles matching the active theme.
• Granular Controls & Per-Author Privacy — Toggle source QR code, engagement metrics, timestamp, credit watermark, and video play badge. Blur all authors globally, or click any post's avatar in the preview to anonymize just that author.
• 14 Languages & Readability Guard — Localized into 14 languages (following your browser or pinned manually). Alerts you before export if an ultra-long card would scale down too small in social feeds.

PRIVACY:

• Zero Remote Telemetry: Never transmits user data. The only network calls fetch card media from X's official CDN (*.twimg.com) to prevent HTML5 Canvas cross-origin tainting.
• 100% Local: No account, no API keys, and no backend servers. Everything renders right in your browser.
• Local Storage Only: Custom presets are saved purely in chrome.storage.local.
• Minimal Permissions: clipboardWrite (to put the image on your clipboard), storage (to remember your settings), and host access to X's image servers.

Requires no login and no X API access — it reads the posts already rendered on the page you are on.

Not affiliated with X Corp.
```

### 中文

```
PostPress · 印推 —— 把 X（Twitter）推文与长串，排印成出版级质感卡片。

告别夹带浏览器杂乱 UI 与模糊缩放的普通截屏。在推文操作栏轻点印刷机图标（或按快捷键 Alt + C），PostPress（印推）即刻在本地将单条推文或同作者长串（Thread）重新组版，装帧为可一键复制或导出 3× 超清 PNG 的精美卡片。

你会得到：

• 12 套实体级材质主题——从孔版印刷（Riso）、水墨宣纸、画廊装裱、暗房银盐，到极简、液态玻璃与热敏小票，外加一套实验性粗野派。每套主题均配备严谨匹配的纸面基调、边线质感、字体配对、强调色与专属签名装饰。
• 独立外层画布装裱（Mat）——支持将卡片承托在外层画布上导出。提供 1:1、4:5、3:4、16:9 预设画幅（采用 min-height 弹性下限，长文本绝不截断），并支持跟随主题、纯色或渐变背景；仅选画幅时留白保持透明，便于二次合成。
• 智能长串拼合（Thread）——双通道解析（GraphQL 优先 + DOM 降级兜底），自动识别并拼接同作者连续推文，剔除干扰广告与第三方回复，支持单条自由剔除。
• 长文与深度排版——原生识别 X 长文推文（Article），提取封面、眉标、标题与导语；引用推文依主题呈现为填充或描边双重质感；支持 Twemoji Unicode 还原与 1~4 张高清网格图片解析。
• 精细开关与逐条隐私脱敏——独立控制原文二维码、互动统计、发布时间戳、视频播放角标与署名版本；支持全局作者高斯模糊，也可直接点击卡片上某条推文的头像仅脱敏该作者。
• 14 国语言与可读性警示——内置中、英、日、韩等 14 种界面与卡面日期语言；当长图比例过大、缩至社交平台信息流宽度可能导致字号难以阅读时，面板主动呈现视觉警示，建议分段导出。

隐私保障：

• 零外部远程通信：除通过安全代理向 X 官方图片服务器（*.twimg.com）拉取配图（用于规避 Canvas 跨域污染 SecurityError）外，绝不向任何外部服务器发送请求。
• 无遥测与追踪：无数据分析、无行为埋点、无远程动态配置。
• 纯本地存储：个性化排版偏好仅保存在浏览器本地 chrome.storage.local。
• 权限最小化：仅声明 clipboardWrite（复制图片至剪贴板）、storage（保存用户偏好）及 twimg.com 图片代理权限。

无需登录，也无需 X API 权限——直接读取当前页面已渲染的内容。

与 X Corp. 无关联。
```

## 单项权限理由（商店后台填写）

| 权限 | 理由（英文） |
|---|---|
| `clipboardWrite` | Puts the rendered PNG on the clipboard so you can paste it into a post or a chat. Used only when you press Copy. |
| `storage` | Remembers your theme, canvas and toggle choices between sessions. Stored locally; never transmitted. |
| `https://*.twimg.com/*` | Fetches the pictures that belong in the card. A canvas cannot read a cross-origin image, so the export would fail without this; requests go only to X's own image hosts. |

## 语言

商店后台的「详细说明」按所添加的商店展示语种分别粘贴；而扩展安装后在 `chrome://extensions` 与工具栏显示的 `name` / `description` 则由 `public/_locales/` 下的 14 个语种目录自动决定（见 `docs/i18n.md`）。
