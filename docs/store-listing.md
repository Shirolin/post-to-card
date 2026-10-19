# Chrome Web Store 上架文案

商店后台的字段与 `manifest.json` 的 `name` / `description` 是**两份独立存储**：改这里不会改
清单，改清单也不会更新商店页。两边要一起改。

下面英文那版是清单 `description` 的**建议替换**：现在 `manifest.json` 里仍是从前那句
（"Convert Twitter/X posts and threads into beautifully formatted, high-resolution shareable
card images locally and offline."，122 字符），它同样在限制内，但没提「不经服务器」这个
真正区别于同类工具的点。要不要换由你决定——换就把这里的英文抄进清单，别只改一边。

## 名称

```
Post-to-Card
```

## 简短说明（manifest `description`，上限 132 字符）

英文（126 字符，在上限以内）：

```
Turn X posts and threads into clean, high-resolution card images. Rendered in your browser — no account, no upload, no server.
```

中文（商店页用，不受 132 字符限制）：

```
把 X 推文与长串渲染成清晰的高分辨率卡片图。全程在你的浏览器里完成——不登录、不上传、不经服务器。
```

## 详细说明

### 英文

```
Post-to-Card turns any X (Twitter) post or thread into one clean, high-resolution image you can paste anywhere.

Click the ✨ button on a post, pick a theme and shape, then copy the PNG or save it. Everything is rendered in your own browser — no account, no upload, no server of ours in the loop.

WHAT YOU GET

• 12 material themes — Minimal, Midnight, Liquid Glass, Material 3, Gallery, Darkroom, Riso, Sumi, Clay, Terminal, Receipt, plus an experimental Brutalist. Each is a full set: paper colour, rules, type pair, accent and signature detail.
• Output canvas — mount the card on a canvas of its own. Shape: card / 1:1 / 4:5 / 3:4 / 16:9. Background: follow the theme, a solid colour, or a gradient. Both default to off, so the export is the card itself unless you ask for more.
• Whole threads — automatically follows consecutive posts by the same author, skipping ads and other people's replies. Exclude any post you don't want with one click.
• Long-form posts and quotes — recognises X long-form posts and pulls the cover and lede; quoted posts render in a filled or outlined style to match the theme.
• Detail toggles — original-post QR code, engagement stats, timestamp, credit line, video play badge, and author privacy blurring.
• Readability warning — if the picture is so tall that a feed will shrink its text, the panel says so before you export.

PRIVACY

• No remote calls. Nothing is sent to us or to any third party. The only network requests go to X's own image servers (*.twimg.com) to fetch the pictures that go in the card — without them the canvas would fail outright.
• No analytics, no telemetry, no remote config.
• Your settings live in your own browser's local storage.
• Two API permissions — clipboardWrite (to put the image on your clipboard) and storage (to remember your settings) — plus host access to X's image servers, and nothing else.

Requires no login and no X API access — it reads the posts already rendered on the page you are on.

Not affiliated with X Corp.
```

### 中文

```
Post-to-Card 把任意 X（Twitter）推文或长串，渲染成一张可以直接发出去的清晰大图。

在推文上点一下 ✨，挑主题与形状，然后复制 PNG 或保存。渲染完全在你的浏览器里完成——不登录、不上传、不经过我们的服务器。

你会得到

• 12 套材质主题——极简、夜幕、液态玻璃、质感 (MD3)、画廊、暗房、孔版、水墨、软陶、终端、小票，外加一套实验性的粗野派。每套都是完整搭配：纸面色、边线、字对、强调色与签名装饰。
• 输出画布——卡片可以挂在独立画布上导出。画幅：跟随卡片 / 1:1 / 4:5 / 3:4 / 16:9；背景：跟随主题 / 纯色 / 渐变。两项默认关闭，不选就是卡片本身。
• 长串串联——自动沿同作者连续推文拼接，剔除广告与他人的回复；不想要的可以一键排除。
• 长文与引用——识别 X 长文推文并抽出封面与导语；引用推文按材质分填充 / 描边两种呈现。
• 细节开关——原文二维码、互动数据、发布时间、署名、视频播放角标、作者隐私脱敏。
• 可读性提示——图太瘦长、缩到信息流宽度会读不清时，面板会在导出前提醒。

隐私

• 零外部远程调用。不向我们或任何第三方发送数据。唯一的网络请求发往 X 自己的图片服务器（*.twimg.com）取回卡片里的配图——没有它，Canvas 会直接失败。
• 无分析、无遥测、无远程配置。
• 设置存在你自己浏览器的本地存储里。
• 两项 API 权限——clipboardWrite（把图放进剪贴板）与 storage（记住你的设置），外加对 X 图片域名的访问权，没有别的。

无需登录，也不需要 X API 权限——读的是你当前页面上已经渲染出来的推文。

与 X Corp. 无关联。
```

## 单项权限理由（商店后台填写）

| 权限 | 理由（英文） |
|---|---|
| `clipboardWrite` | Puts the rendered PNG on the clipboard so you can paste it into a post or a chat. Used only when you press Copy. |
| `storage` | Remembers your theme, canvas and toggle choices between sessions. Stored locally; never transmitted. |
| `https://*.twimg.com/*`, `https://pbs.twimg.com/*` | Fetches the pictures that belong in the card. A canvas cannot read a cross-origin image, so the export would fail without these; the requests go only to X's own image hosts. |

## 截图与素材

商店要求至少一张 1280×800 截图。仓库里没有现成的，需要用可视化 harness 拍：

```bash
npx vite --config dev/vite.harness.config.ts
```

建议拍四张，覆盖用户最先问的四个问题：

1. `?theme=gallery` — 默认长相（这是绝大多数人看到的第一个界面）
2. `?theme=riso&bg=dusk&canvas=4:5` — 输出画布开着的样子
3. `?theme=terminal` 配一条长串 — 串联能力
4. 弹窗面板本身 — 控件密度

`dev/preview.ts` 的 `?modal=1` 会把真实弹窗整棵渲染出来，比只拍卡片更接近实际。
