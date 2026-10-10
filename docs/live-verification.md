# 登录态真机验证

要验的是「在真实 X 上，扩展对登录后才出现的标记/接口做了什么」。未登录页整页 0 个
`data-testid`（见 `docs/observed-dom-*.md`），所以这条路径只有登录会话能走。

`dev/verify-extension.mjs` **不能**用于这件事：它加载的是真实 `dist/`（`Extensions.loadUnpacked`），
但用的是 `mkdtemp` 出来的**全新临时 profile**，未登录——它验的是「manifest 能解析、MV3 worker 能起、
content script 能初始化」，不是「登录态下判据对不对」。

## 两条路

### A. relay（推荐，用你自己登录的 Chrome）

浏览器由用户提供，页面由你驱动，扩展以真实构建产物注入。本会话用它取得了首页/个人页的真实
payload 与真实点击结果。

1. 连上用户的 Chrome（`app.relay`），**新开标签页**——不要导航用户正在看的页面。
2. 逐条把构建产物注入，顺序不能反：
   - `dist/graphql-hook.js` 必须走 `document_start` 语义（`evaluateOnNewDocument` 或
     `page.addInitScript`）。**用 `addScriptTag` 在 `goto` 之后注入是错的**：X 的时间线请求
     在页面加载时就已发出，hook 装完什么也拦不到，表现为 hook 静默无输出。
   - `dist/content.js` 同样在 `document_start` 注入，这样 bridge 的 `message` 监听在 hook
     转发第一条 payload 之前就绪。
3. 等真实 `article[data-testid="tweet"]` 出现，再真点击驱动（点击扩展自己注入的触发按钮，
   `[data-post-to-card-btn="true"]`），不要直接调内部函数——要验的是整条链路。
4. 读结果：卡片在 `post-to-card-container` 的 shadow root 里，
   `#post-to-card-export-target` 是卡片，`.thread-item` 是每条推文，
   `.modal-header-summary` 是「共 N 条推文」。**用 `.thread-item` 数量判断合并了几条**。
5. 收尾：关掉自己开的标签页。

### B. 离线跑真实标记（无需登录）

拿一条真实 `article[data-testid="tweet"]` 的 `outerHTML`（场景清单见
`docs/real-dom-sampling-checklist.md`），用仓库自己的 DOM shim
（`tests/env/browser.ts` 的 `createDomElement` + `DomDocument`）在 Node 里对真实标记跑
`src/content/adapter/extractor.ts` / `resolver.ts`。真实 payload 则用
`tests/fixtures/graphql.ts` 里同形状的夹具喂进 `bridge.ts` 的 `message` 事件。

这条路的代价是 shim 的 HTML 解析器比浏览器弱，且不执行 CSS——只能验「提取器读到什么」，
验不了布局。

## 两个会咬人的前提

- **x.com 有登录墙**：未登录访问 `/home` 会落到登录页，`article` 数为 0。判据是
  `[data-testid="SideNav_AccountSwitcher_Button"]` 是否存在。
- **相邻同作者只出现在个人页/搜索，不在首页**：2026-10-10 实测首页 4 次加载 54 条推文，
  相邻同作者 0 对；个人页 12 条连发里有 11 对相邻同作者。要验「同作者串是否合并」，
  必须去个人页，别用首页——首页会给出「没合并」的正确结果，看着像 bug 其实是 X 的排布。

## 别把结论只留在会话里

真机结论要写进两处之一：判据类进 `docs/detection-audit.md`（或对应 `observed-dom-*.md`），
行为类进对应 issue 的 `## Comments`。只留在会话或 gitignored 的临时目录里，下次会话就要重做一遍。
