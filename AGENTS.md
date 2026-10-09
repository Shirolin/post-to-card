## Agent skills

### Issue tracker

Local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.

### X DOM observations

`docs/observed-dom-*.md` 是**一次性快照**：每篇自带采集日期，日期之后 X 改版或代码已修，
所以先看它开头的状态行再决定是否采信，别把正文里的判据表当现行事实。
未被任何文档引用 —— 从这里进。

未登录时 `x.com` 整页 0 个 `data-testid`，**离线也能验提取器**：
`docs/real-dom-sampling-checklist.md` 列出待采场景，每个场景只需粘一条
`article[data-testid="tweet"]` 的 outerHTML，即可对真实标记跑
`src/content/adapter/extractor.ts`，无需登录。别在没读它之前断言提取器验不了。

### Repository gates

`npm run build` 含 typecheck 与两处 `node --check`（`public/popup.js`、`dev/verify-extension.mjs`
—— 两者都在 tsconfig 的 `include` 之外，tsc 看不到），`npm test` 跑 9 个 tier，
`npm run test:tier5` 审计构建产物且自带产物新鲜度检查（T5.3.8）—— 顺序是
build → test → tier5。改动落地前按此顺序全跑一遍。`.github/workflows/ci.yml` 跑同一条链。

装扩展进真实浏览器用 `node dev/verify-extension.mjs --url https://x.com/`（零依赖，
headed；headless 会被 x.com 403）。

### Session linking

Link working-set via `session.link`: 被处理、新建、解决的 issue 或 change，识别即 link；仅 link 工作集。
