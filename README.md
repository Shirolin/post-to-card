# Post-to-Card

把 X（Twitter）的推文与同作者长串，渲染成一张高分辨率卡片图。

在推文操作栏点一下 ✨，弹窗里挑主题、形状、画布，然后**复制**或**保存 PNG**。
渲染完全在你的浏览器里完成——不登录、不上传、不经过任何服务器。

## 安装

尚未上架商店，从源码装（Node.js 24 + pnpm 10）：

```bash
pnpm install
pnpm run build
```

然后打开 `chrome://extensions/`，开启「开发者模式」，点「加载已解压的扩展程序」，
选择本仓库的 `dist/` 目录。

## 用

1. 在 x.com 或 twitter.com 上，把鼠标移到任意推文上，点操作栏里的 **✨**。
   （按钮被关掉时，悬停推文按 **Alt + C** 也一样。）
2. 弹窗里按需调整，然后 **复制图片** 或 **保存 PNG**。
3. 想连发一条长串？打开长串里的任意一条，弹窗会沿同作者连续推文自动串联；
   不想要的可以用每条推文上的「剔除此推文」排除。

## 它做什么

- **12 套材质主题**：极简、夜幕、液态玻璃、质感 (MD3)、画廊、暗房、孔版、水墨、软陶、终端、小票，
  外加一套实验性的粗野派。每套是纸面色、边线、字对、强调色与签名装饰的一整套搭配。
- **输出画布**：卡片可以挂在一层画布上导出。画幅可选跟随卡片 / 1:1 / 4:5 / 3:4 / 16:9，
  背景可选跟随主题 / 纯色 / 渐变。默认两项都关闭，导出的就是卡片本身。
  只选画幅不选背景时，画幅留白是**透明**的（方便你自己后期合成）；想要一张有底的成品图，
  记得配一个背景。
- **清晰度**：单条推文按 3× 导出，很高的长串按 2×（更多也只会被平台缩回显示尺寸）。
  「导出设置」里的「输出最高清晰度」可以让长串也走 3×，适合发到不压缩的渠道。
- **长串串联**：沿同作者连续推文自动拼接，剔除广告与他人的回复。
- **长文与引用**：识别 X 长文推文，抽出封面与导语；引用推文按材质分填充 / 描边两种呈现。
- **细节开关**：原文二维码、互动数据、发布时间、署名与版本、视频播放角标、作者隐私脱敏。
- **可读性提示**：图太瘦长时会提示你——缩到信息流宽度后正文字号会掉到读不清。

## 一些常见问题

**为什么不直接截屏？**
截屏拿到的是屏幕分辨率、带界面元素、还跟着你的缩放设置跑。卡片是重新渲染的：
按 2× 或 3× 光栅化，没有浏览器 UI，字号与间距由主题决定。

**发到平台上被压缩后还清楚吗？**
单条推文按 3× 导出，缩到信息流宽度仍然清晰。但**很长的串会变小**：
一张 640px 宽的图缩进 ~500px 的信息流栏，正文大约从 16px 掉到 12px；
再长一截就会低于舒适阅读的尺寸。这种时候面板会提示，建议拆成几张发。

**引用公开帖子的授权边界在哪？**
卡片保留原作者的头像、昵称、账号与原帖链接——这是引用该有的样子。
但公开可见不等于可以任意转载，商用或大范围传播前请自行确认。

**帖子被删了会怎样？**
已经导出到你硬盘或剪贴板上的图片是你的，不受影响。扩展本身不落盘保存任何推文内容，
只在内存里暂存取回的配图，关掉弹窗就没了。

**需要登录吗？**
不需要，扩展也没有账号体系。它读的是你当前页面上已经渲染出来的推文——
不会拿你的凭据去请求任何 X 接口，也不需要 X API。

## 隐私

- **零外部远程调用**。除了 X 自己的图片域名（`*.twimg.com`），扩展不向任何地址发请求。
- 没有分析、没有遥测、没有远程配置。
- 唯一的网络请求是把推文配图取回来——因为 Canvas 不能读跨域图片，
  否则导出会直接失败。这些请求只发往 X 的图片服务器。
- 设置存在 `chrome.storage.local`，只在你自己的浏览器里。
- API 权限只有两项：`clipboardWrite`（把图放进剪贴板）与 `storage`（记住你的设置）；
  另有对 X 图片域名的 `host_permissions`，用来取回卡片配图，没有读取页面的权限。

完整说明见 [PRIVACY.md](PRIVACY.md)。

## 开发

```bash
pnpm run build       # typecheck + lint + 四入口构建，产物在 dist/
pnpm test            # tier 1-4 与 i18n / graphql / resolver / article / hygiene
pnpm run test:tier5  # 对抗性门禁，审的是刚 build 出来的 dist/
```

顺序不能倒：tier5 审的是构建产物，`build` 之后才跑得对。

可视化调试（不装扩展也能看）：

```bash
pnpm exec vite --config dev/vite.harness.config.ts
```

打开 `http://127.0.0.1:5199/`，可用 `?theme=riso&ratio=3:4&bg=paper&canvas=4:5` 之类直接切状态。

想改点什么，先看 [CONTRIBUTING.md](CONTRIBUTING.md)；它指路的 `AGENTS.md`、`GLOSSARY.md`
与 `docs/` 才是规则本身的出处。

## 文档地图

| 文件 | 它回答什么 |
|---|---|
| [PROJECT.md](PROJECT.md) | 需求、功能清单与里程碑 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 怎么跑、怎么改、怎么提 PR |
| [CHANGELOG.md](CHANGELOG.md) | 每个版本变了什么 |
| [PRIVACY.md](PRIVACY.md) | 扩展会碰到哪些数据、去了哪里 |
| [SECURITY.md](SECURITY.md) | 安全问题怎么报、哪些不算问题 |
| [GLOSSARY.md](GLOSSARY.md) | 卡片 / 画布 / 材质 / 导出这些词的固定含义 |
| [AGENTS.md](AGENTS.md) | 门禁链、typecheck 盲区、验证扩展与提取器的方法 |
| [docs/architecture-review-2026-10-21.md](docs/architecture-review-2026-10-21.md) | 哪些方向已经查证过「不是这样」，不要再试 |
| [docs/detection-audit.md](docs/detection-audit.md) | 哪些 DOM 判据可依赖、哪些明确不做 |
| [docs/real-dom-sampling-checklist.md](docs/real-dom-sampling-checklist.md) | 未登录也能对真实推文标记跑提取器的方法 |

## 许可

本项目以 **GNU General Public License v3.0 或更高版本**（`GPL-3.0-or-later`）发布，
全文见 [LICENSE](LICENSE)。

```
Copyright (C) 2026 Shirolin

Post-to-Card is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.

Post-to-Card is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU General Public License for more details.
```

这意味着：你可以自由使用、修改、再分发，包括商用；但**分发修改版时必须以同一许可公开源码**，
并保留版权声明与免责声明。卡片右下角的署名链接指向源码，正是为此留的出口
（GPL §6：收到作品的人应能拿到对应源码）。

X（Twitter）是 X Corp. 的商标。本项目与 X Corp. 无关联，也未获其背书。
