# 产品页

`site/` 是 PostPress 的产品页，纯静态：`index.html` + `styles.css` + `app.js` + `assets/`，
没有构建步骤，由 [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) 发布到 GitHub Pages。
仓库设置里 Pages 的 Source 要选 **GitHub Actions**，否则工作流不会生效。

- **两套皮，同一张版**：默认近黑（`#0c0e11` 底 + 薄荷按钮），另一套是纸面（`#ecedea` 底 + 深绿按钮 + 近黑结尾）。
  右上角切换，存在 `localStorage`，`?theme=light` 也能直接打开。两套都跑过 `inspect.mjs`（0 FAIL）。
- **内容带停在 1680px**：超宽屏时背景色块仍铺满整宽，文字与栅格收进 `--edge` 边距，字号也上一个台阶。
  改版前在 2048 宽上「长串」一节左半边是空的——宽屏要单独验，别只信 1440。
- **配色取品牌**：近黑 `#0c0e11`（底）、`#1e2229`（右侧舞台）、米白 `#f2f4f0`（字）、
  薄荷 `#6cc59c`（只给按钮与选中态，来自 `ui/brandMark.ts` 的机身）、结尾的纸色 `#f5f6f4`。
  卡片自己的纸色是页面上唯一的彩色，别的颜色不要加。
- 首屏右半是产品本身：一张真实导出的卡片 + 12 个材质按钮（`data-ui`），点一张换一张，**页面下方跟着换**。
  默认材质跟着皮走：深色给「夜幕」，浅色给「极简」；手动点过任意材质后就不再自动切。
- 文案中英双语：中文写在 HTML 里，英文在 `app.js` 的 `EN` 表里，右上角切换，选择存在 `localStorage`。
  关掉 JS 时中文版本与第一张样张仍完整可读。
- `assets/cards/*` 是 `src/content/ui/Card.tsx` 用同一段示例内容渲染出的真实卡片，不是画的示意图：
  12 套材质 × 5 张（首屏大图 `{id}.webp`、长串 `thread-{id}.webp`、长文 `article-{id}.webp`、
  三种页脚状态 `switch-{full|plain|blur}-{id}.webp`），外加 12 张 `thumb-{id}.webp` 给材质条、
  12 张 `panel-{id}.webp`（真实 `Controls` 面板在 2× 下的截图，680×1906）。
  **换材质时整页一起换**——首屏、长串、长文、三种页脚状态、控制面板共用同一个选择。
  全部 WebP（q80–88，Pillow 转的）：合计 6.1 MB，一次访问只取当前那套，约 600 KB。
  `og.jpg` 是例外——社交预览用 og.jpg（1200×630），有的爬虫不认 WebP。
  卡片里的人物、账号与推文是示例；两张配图来自 Wikimedia Commons，署名在页面页脚。
- 卡片改动之后这些图会过时，需要重新截：用真实组件在 2× 下渲染每套材质，再替换同名文件即可。
