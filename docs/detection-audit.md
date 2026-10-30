# 推文检测逻辑审计与现行规范

> **状态：P0 / P1 / P2 各条及 GraphQL 双通道均已落地。**
> 本文前半部分（「唯一归属入口」「社区确认可依赖的信号」「明确不做的事」）是**现行参考规范**——修改 `src/content/adapter/**` 或 `src/content/graphql/**` 前必读；后半部分的 P0/P1/P2 清单为早期整改历史归档。

## 1. 核心原则与唯一归属入口

- **双通道架构**：`src/content/graphql/`（`hook.ts` MAIN world + `operations.ts` + `parse.ts` + `bridge.ts`）优先消费 X 自身的结构化响应，`src/content/adapter/` 作为 DOM 兜底通道（调度见 `PROJECT.md` 的 Data Channels，调研见 `docs/x-graphql-research.md`）。
- **「这个元素属于谁」只有一处回答**：判定主帖、引用帖与 Article 归属的规则集中在 `src/content/adapter/ownership.ts`，各提取环节（正文、图片、视频、统计、时间戳）读取同一个答案。改归属前先看那里——历史上同一件事曾由五个私有谓词各答一次，正是虚构选择器或嵌套媒体串味的温床。
- **诊断埋点（`TweetData.diagnostics`）**：位于 `extractor.ts` 末尾，记录每项用了哪级策略與是否命中 tombstone。注意：`diagnostics.text` 的 `'fallback'` 取不到——`text` 只在 `tweetText` 命中时才产生，所以「fallback/none 上涨即 X 改版信号」目前只有 `none` 那一半成立。

---

## 2. 社区确认可依赖的信号（现行参考）

- `article[data-testid="tweet"]`、`tweetText`、`tweetPhoto`、`videoPlayer`
- `div[data-testid="quoteTweet"]` —— 本轮观察只在 outermost 一级出现。2026-10-14
  样本（`observed-dom-2026-10-14-nested-quote.md`）的两级嵌套引用里一个 `quoteTweet`
  都没有：外层引用是 `role=link` 无 testid 容器，内层是 `nestedQuotePreview`。
  该样本下嵌套定位走 `findQuoteContainer` 第 2/3 级回退；`nestedQuotePreview`
  另有显式分支（见该函数 1b 级），外层无 testid 容器仍走结构回退。
- `div[data-testid="nestedQuotePreview"]` —— **2026-10-14 新增**：本轮样本中嵌套引用的容器标记
- `a[data-testid="nestedQuotePreviewMedia"]` —— **2026-10-14 新增**：本轮样本中嵌套引用自己的
  媒体，不在 `tweetPhoto` 里，所以照片扫描通道看不到它
- `div[data-testid="article-cover-image"]` —— **2026-10-22 新增**：**列表视图**里长文帖的预览卡
  只有这一个文章 testid（`twitterArticleReadView` / `twitter-article-title` 在列表视图上是 0 个，
  它们只在状态页出现）。标题与摘录没有 testid，靠「封面 → 紧随其后的文字盒 → 第一个子元素是标题」
  定位；卡片里的徽标文案与封面 `alt` 都是本地化的，不作判据。
  见 `docs/observed-dom-2026-10-22-article-preview.md`，锁在 `tier_article` 的 `art.12`–`art.14`。
- `[data-testid="socialContext"]` —— 承载「转发/置顶/回复」**容器**，testid 稳定、内部文字与标签名不稳定：
  - **2026-10-10 实测修正（详情页回复）**：详情页会话区里这个容器**不存在**（35 条推文 0 个），
    也没有「Replying to / 回复」文案，所以那里 `getReplyingToHandle` 只能返回 null。
    「稳定」目前只对时间线成立过。见 `docs/observed-dom-2026-10-10-authenticated.md`
  - **2026-10-11 实测修正（转发帖）**：`data-testid="socialContext"` **不在 `div` 上，而在 `span` 上**，
    且**转帖者的 handle 是这个 span 自己所在的 `<a>`**，不是容器内的链接：
    `<a href="/ShiroLinHime"><span data-testid="socialContext">你已转帖</span></a>`。
    写 `div[...]` 选择器会**一个都匹配不到**，导致转发帖被当成原创（`getRetweetedBy` 返回 null、
    `classifySocial` 返回 `none`）。**testid 是稳定的，标签不是**——所以判据只认 testid。
    夹具见 `tests/fixtures/retweet.ts`（真实标记原样保留），锁在 `tier2` 2.31b。
- `div[data-testid="previewInterstitial"]` + `aria-label="嵌入式视频"` —— **2026-10-10 新增**：
  自动播放关闭时，视频/GIF 在时间线里以「海报 `img` + 这个 interstitial」出现，**没有 `<video>`**；
  这个状态下 GIF 与视频仍然由**徽标文本**区分（容器内有 `<span>GIF</span>`），
  容器自身的 `aria-label` 是本地化的 `嵌入式视频`，所以 `div[aria-label="Embedded video"]` 那条精确匹配
  在 zh-CN 页面上匹配不到。见 `docs/observed-dom-2026-10-10-authenticated.md`
- **串的判据在 API，不在 DOM** —— **2026-10-10 实测**：X 自己的「这是同一串的下一节」条件是
  `legacy.in_reply_to_status_id_str === 上一条的 id_str`（同时 `in_reply_to_screen_name` 等于上一条作者，
  所以「同作者」是它的推论而不是独立条件），`conversation_id_str` 把整串绑在一起。
  实测一条真实自串（`/ShiroLinHime/status/2088178637904531773`）：续条的 `in_reply_to_status_id_str` 就是首发 id。
  DOM 里**没有**任何对应物：同一个串的状态页上 `tweet-thread-indicator` 0、细线（宽 ≤4px 的元素）0、
  `border-left` 0、伪元素 0、「显示此推文串」0，续条就是平铺在回复框下面的一条普通回复。
  这份 payload 我们**已经在拦**（名单见 `graphql/operations.ts`），`in_reply_to_status_id_str`
  由 `graphql/parse.ts` 收进 `graphql/bridge.ts` 的索引，供列表视图里的 DOM 走查使用。
- **外链卡片媒体在 GraphQL 与 DOM 均须提取** —— **2026-10-13 实测**：外链推文（如 `summary_large_image`）的封面图不走 `entities.media`，而在 `tweet.card.legacy.binding_values`。GraphQL 通道须解析其 `photo_image_full_size_original` 等原图字段，否则权威通道会将其判为无媒体并短路屏蔽 DOM 通道；DOM 端容器以 `[data-testid="card.wrapper"]`（不绑定 `div` 标签）定位，其内标准 `img` 即为卡片封面。
- **头像各尺寸同生共死** —— **2026-10-20 实测**：`profile_images` 路径的 `_400x400` / `_normal` /
  `_bigger` / `_mini` / `_200x200` 五个后缀，对一个存活头像
  （`pbs.twimg.com/profile_images/2103567689515954176/aR-Kjpp4`，取自未登录 `x.com/elonmusk` 的
  `og:image`）**全部 200**（28375 / 2111 / 3151 / 1451 / 10960 B）；对一个 X 没有的路径
  （`pbs.twimg.com/profile_images/1/ada`）**全部 404**；对默认头像占位
  （`abs.twimg.com/sticky/default_profile_images/default_profile`）**全部 200**
  （2872 / 504 / 693 / 303 / 1584 B）。
  即头像**没有**「大图 404、小图还在」的部分失效。照片相反——`orig` 有单独 404 的观测
  （见 `urls.ts` 的 `upgradePhotoUrl`），所以照片的链要走好几个候选，头像的链只有一步
  （`imageFallback.ts` 的 `avatarFallbackAttrs`）。
- `div[data-testid="placementTracking"]` —— 广告，用 `closest()`
- `div[data-testid="tweet-thread-indicator"]` —— 语义未文档化，仅作弱信号
- `a[href*="/status/"]`、`time[datetime]` —— 结构语义，不会变
- **详情页交互条里没有浏览量** —— **2026-10-21 实测**：`/<user>/status/<id>` 的
  `article[data-testid="tweet"]` 内 `div[role="group"]` 只有 1 个，其 testid 集合是
  `reply / retweet / like / bookmark`，**既无 `viewCount` 也无 `a[href*="/analytics"]`**。
  所以 `extractTweetStats` 那两条 views 判据在详情页取不到值，浏览数只能来自载荷
  （`views.count`）。同处的 `retweet` 数字是**转帖＋引用之和**（实测页面「3 次转帖」对应
  `retweet_count` 1 + `quote_count` 2），不能直接与 `stats.reposts` 对比。
  见 `docs/observed-dom-2026-10-21-authenticated.md` §2
- **GraphQL 模块项的形状** —— **2026-10-21 实测**：`TweetDetail` 的非根帖全在
  `conversationthread-*` 模块里，`entry.items[i] = { entryId, item: { itemContent } }`
  ——`items` 直接在 entry 上，**没有 `content` 这一层**，`itemContent` 在**内层 `item`** 上；
  且这批 entry **没有 `sortIndex`**。6 份真实载荷共 102 个模块：`entry.items` 102/102、
  `entry.content.items` 0/102。
  同日按此修复：`collectTweets` 读 `entry.items`、`parseTweet` 接受 `item.itemContent`；
  夹具 `tests/fixtures/graphql.ts` 原先是 wrapper 上有 `content` 的形状（故 tier 全绿），已改成真实形状。
  见 `.scratch/live-verification-relay/issues/01-graphql-module-items-dropped.md`
- **载荷里的 `article` 不一定能读成文章** —— **2026-10-22 实测推断**：同一条长文帖，时间线 DOM 里
  `article[data-testid="tweet"] a[href*="t.co"]` 与 `a[href*="/i/article/"]` 都是 0 个（预览卡取代了
  尾链），而失败的卡片正文却带着 `x.com/i/article/…`——正文只可能来自载荷，且那份载荷的
  `article` 没通过 `parseArticle`（要么缺失，要么是不带 `title` 的存根；登录态怎么排布**未采到**）。
  `resolver.ts` 的 `backfillArticle` 因此按「载荷缺什么、DOM 补什么」接管文章与尾链剥离；
  锁在 `tier_resolver` 的 `res.15`。见 `docs/observed-dom-2026-10-22-article-preview.md`
  §同日发现的第二个原因
- **snowflake ID 大小关系** —— X 官方文档背书的时序。但官方措辞是 "roughly time-ordered"，
  故**只能用作否决条件**（排除不可能的前一条），不能用作肯定条件

### 大小写陷阱（历史上翻过车）
`User-Name`（推文内）≠ `UserName`（个人资料页）；`gifyButton`（官方拼写错误，非 `gifButton`）

---

## 3. 明确不做的事（现行参考）

| 项 | 原因 |
|---|---|
| 引入 `twitter-text` | 3.1.0 自 2020 未更新，API 只处理纯文本字符串，无 DOM 定位能力。X 已把 mention/hashtag 渲染成 `<a>`，直接遍历即可 |
| 引入 snscrape / nitter / twikit | 它们**都不做 DOM 解析**，全走 API/服务端渲染 |
| Community Notes / subscriber-only 判据 | 社区**查不到**任何权威 DOM 选择器。调研明确标注为「未知」，不猜测 |
| `div[aria-label="Embedded video"]` 之外的英文视频兜底 | 精确匹配 + `video` 元素 + `previewInterstitial` 兜底已足够，宽松匹配（如 `aria-label*="video"`）会误把外链 YouTube 卡片判成视频 |

---

## 4. 历史整改归档（已全部落地）

> 基于社区调研（XActions 文档 + 多个 userscript 源码交叉印证 + 实测）逐条核实并修复的历史记录，保留备查。

### P0 — 曾导致丢数据或判错（已修复）

| # | 位置 | 问题 | 改法 |
|---|---|---|---|
| 1 | `urls.ts:37` | `name=large` 上限 2048px，非原始尺寸。社区统一用 `name=orig`（上限 4096px）。`webp` 也拿不到原图 | 改 `name=orig`，并把 `format=webp` 改写为 `format=jpg` |
| 2 | `thread.ts:18,31` | `article.querySelector('[data-testid="placementTracking"]')` 只找后代，但 `placementTracking` 常是**祖先** | 改 `article.closest(...)` |
| 3 | `extractor.ts:336` | `[data-testid="gifBadge"]` **全网零结果，是虚构选择器**。社区实测 X 的 GIF 角标是纯文本 `GIF`，无 aria-label | 删虚构 testid，保留文本判据并注明局限 |
| 4 | `extractor.ts:262` | 媒体链接只过滤 `pic.twitter.com`，X 已改用 `pic.x.com`；漏过的链接会被下一行当 @提及 写进正文 | 补 `pic.x.com`，并按「链接文本是否等于 URL」兜底 |
| 5 | `extractor.ts:380` | `div[aria-label*="video" i]` 会命中外链卡片（如 YouTube 视频卡），误判为视频 | 收紧为 `div[aria-label="Embedded video"]` 精确匹配 |
| 6 | `extractor.ts:437-453` | Strategy D 兜底会把**照片**当成视频 poster。混合媒体场景下 A/B/C 失败时产出 `[photo, photo]` | 仅在已确认含 `<video>`/videoPlayer 的容器内执行，且排除 `tweetPhoto` 内图片 |

### P1 — 曾属脆弱判据（已修复）

| # | 位置 | 问题 | 改法 |
|---|---|---|---|
| 7 | `thread.ts:100-102` | inline style `width:2px` + 混淆类名 `r-11mg6pl`/`r-14lw9vd`/`r-16y2uox`。社区有实证：同一份 DOM 隔两年抓取，混淆类名**无一相同** | **删除**。改用 snowflake ID 单调性 + `socialContext` + 详情页上下文 |
| 8 | `thread.ts:55,64` | `getReplyingToHandle` 文案正则仅 3 种语言；`回复` 会误命中引用推文与 bio 文本；`\b` 对 CJK 无效 | 先查 `[data-testid="socialContext"]` 内的 `a[href^="/"]` 取 handle，文案降为末级；末级里再排除 byline 内的链接，否则作者自己会被当成回复对象 |
| 9 | `thread.ts:29` | `/\b(?:Promoted\|赞助)\b/i` 独立触发。`赞助` 会命中用户 bio（bio 与推文同在 article 内），假阳性高 | 必须 `placementTracking` 命中后才允许文案辅助 |
| 10 | `extractor.ts:615` | `includes('This post is unavailable')` 文案匹配，至少 20 种语言 | 改结构判据：有 `/status/` 链接但缺 `User-Name` 与 `tweetText` |
| 11 | `extractor.ts:53,90` | `.quote-box` 是 2015 年前老 Twitter 类名，X 从未有过 | 删除死代码 |
| 12 | `injection.ts:277` | `div[role="group"]` 会命中**引用推文内部**，导致按钮误注入、点击后提取到内层推文 | 限定 group 必须不在任何 `quoteTweet` 内 |
| 13 | 全局 | **完全没有转发（retweet）判定**。用户看到的可能是转发内容却被当作原创渲染 | 加 `socialContext` + 其外层/内部 `a[href^="/"]`（结构性、零文案依赖） |
| 14 | `thread.ts:248` | `article[data-testid="tweet"]` 在未登录页 0 命中（社区实测），所有选择器静默返回 null | 加 `role="article"` → `[data-testid="cellInnerDiv"] article` 两级 fallback |

### P2 — 长期维护与测试收口（已落地）

- **P2-15（诊断字段）**：实现为 `TweetData.diagnostics`（见 §1）。
- **P2-16（无 `data-testid` 优雅降级）**：`tier2` 的 2.38 用「真实夹具褪掉属性」锁住「不抛错 + 身份仍在 + 正文不吞按钮文字」。
- **P2-17（消除源码字符串断言）**：`tier1` 里不再有任何搜源码正文的断言。样式表通过 `tests/env/render.ts` 的 `cssSheet()` 去注释、按 selector 切规则、带 `@media` 条件读声明（`@keyframes` / `@font-face` 等不包裹规则的 at-rule 整块跳过），渲染类断言（F27.5、F28.4、F29.4、F13.8、F17.22 等）直接渲染真卡片并经 14 个变异探针验证。剩下按文本读取的只有跨文件契约字面量（如 F20.6 的 `qrcode.ts` 必填 `title`）及 `manifest.json` / `vite.config.ts` / `package.json` 等配置文件本身。
