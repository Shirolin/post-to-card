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
`.github/workflows/ci.yml` 跑同一条链。

只有这里写着的两处坑：

- `public/popup.js` 与 `dev/verify-extension.mjs` 在 tsc 的 `include` 之外，改它们时只有 build 里的
  `node --check` 会拦语法错。
- `tests/tiers/` 不在任何 tsconfig 里（shim 的 `DomElement` 不是 `Element`）——改共享类型（`TweetData`
  等）的字段时，grep 一遍测试里的名字，别只信 tsc。

装扩展进真实浏览器用 `node dev/verify-extension.mjs --url https://x.com/`（零依赖，headed；
headless 会被 x.com 403）。

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
