## Agent skills

`docs/agents/` 下两份是 `setup-matt-pocock-skills` 的种子文件：要换追踪方式或文档布局就重跑那个
skill，手改会被它下次重跑覆盖。

### Issue tracker

Local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.

## Repository gates

顺序 build → test → tier5，不能倒：tier5 审的是刚 build 出来的产物，T5.3.8 会拒绝比 `src/` 旧的
bundle。`npm test` 只跑 tier1-4 与 i18n / graphql / resolver / article / hygiene，tier5 是单独一步。
`.github/workflows/ci.yml` 跑同一条链（CI 用 pnpm 10 + Node 24，`pnpm-lock.yaml` 是唯一锁文件；
README 与 CONTRIBUTING 因此也只写 pnpm）。

两处坑：

- `dev/*.mjs` 在 tsc 之外，语法错只有 `npm run typecheck` 里的 `node --check` 会拦（它列着哪些）。
- `tests/tiers/` 基本不在 tsconfig 里（shim 的 `DomElement` 不是 `Element`，跨边界要到处加 cast）；
  唯一的例外是 `tsconfig.test-support.json` 里列着的那三个从不跨边界的文件。改共享类型（`TweetData`
  等）的字段时，grep 一遍测试里的名字，别只信 tsc。

三个真浏览器脚本，按问题选：

- **扩展装得上吗**：`node dev/verify-extension.mjs --url https://x.com/`（headed；headless 会被
  x.com 403）。它证明不了提取器——未登录时整页 0 个 `data-testid`。
- **提取器读得对吗**：`node dev/verify-extractor.mjs`。本地服务器承载 `tests/fixtures/` 里真实
  采集的推文标记，让已构建的 `dist/content.js` 对它们跑一遍再点开卡片看正文。不碰 x.com。
- **按帧才成立的行为对吗**（动效、过渡、滚动、`ResizeObserver` 回调）：`node dev/verify-motion.mjs`。
  浏览器面板里的页面**不跑渲染帧**——`rAF` 不推进、过渡停在起点、`ResizeObserver` 不投递——所以
  这类行为只有真浏览器能验，截图与 tiers 都看不到。它不在 `npm test` 里：判据是时序。

改动效探针的断言时，**先让被修的东西坏掉跑一次**：断言的完成判据是"拿掉修复就会红"。

## 架构决定

`docs/architecture-review-2026-10-21.md` 记着哪些方向**已经被查证过、不要再试**，以及每处有理由
的行为变更的理由。做架构改动前先看它——它记的是「为什么不是别的」，代码只说「是什么」。

## 语言

`docs/i18n.md`：14 种语言怎么组织、为什么是类型化字典而不是 `t('key')`、为什么不引 ICU 复数、
加一门语言的清单，以及 `_locales` 目录名写错会**静默回落**这个坑。改 `locales/`、`popupCopy.ts`、
`public/_locales/` 或 `Locale` 联合之前读它。

## 预览

`docs/loading-states.md`：加载态（首帧 `fit`、图片占位、主题首帧、列表重排）与「要不要引动画库」
的决定规则、每条做与不做的理由、探针怎么用。动 `App.tsx` 的 `fit` 测量、`Card.tsx` 的图片路径，
或者要动效之前读它。

## X DOM observations

`docs/observed-dom-*.md` 是**一次性快照**：每篇自带采集日期，日期之后 X 改版或代码已修，
所以先看它开头的状态行再决定是否采信，别把正文里的判据表当现行事实。

未登录时 `x.com` 整页 0 个 `data-testid`，**离线也能验提取器**：
`docs/real-dom-sampling-checklist.md` 列出待采场景，每个场景只需粘一条
`article[data-testid="tweet"]` 的 outerHTML，即可对真实标记跑
`src/content/adapter/extractor.ts`，无需登录。别在没读它之前断言提取器验不了。

要动 `extractor.ts` 或 `adapter/**` 里的判据，先读 `docs/detection-audit.md`：哪些选择器是真的可依赖、
哪些明确不做，都在那里（P0/P1 已落地，剩下的见它开头的状态行）。虚构选择器就是这么来的——`gifBadge`
曾经被当契约写进判据，而 X 的 DOM 里从来没有它。

要验**登录态**下的真实行为（真实 payload、真实点击、同作者串是否合并），读
`docs/live-verification.md`：里面是 relay 驱动与离线跑真实标记两条路，含 hook 必须 `document_start`
注入、以及「相邻同作者只在个人页出现、不在首页」这两个会误判的前提。`dev/verify-extension.mjs`
用的是全新未登录 profile，验不了这类问题。
