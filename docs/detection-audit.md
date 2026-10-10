# 推文检测逻辑整改清单

> **状态：P0 与 P1 各条都已落地**（逐条核过代码锚点）；**P2-15 也已落地**，实现名是
> `TweetData.diagnostics`（`extractor.ts` 末尾），不是本文写的 `_diagnostics`。
> **P2-16 也已落地**：`tier2` 的 2.38 一直在测「整页无 `data-testid` 的优雅降级」，
> 只是夹具是手搓的两行；现在换成「真实夹具褪掉属性」，并补上「身份仍在」「正文不吞按钮文字」。
> 仍开着的是 **P2-17**：源码字符串断言还在，但它不是一句「都改为断言行为」能收的。
> 已经换掉的：F27.1、F27.4、F29.1、F29.2、F29.6、F30.1（F29.6 / F30.1 的存储解析半边移到了 `tier2` 2.76）；
> F30.3 / F30.4 直接删掉——前者是源码文本加一段自己 `classList.add` 再 `contains` 的自证，
> 后者要认的 DOM 行为由 `tier2` 2.62 / 2.77 在真跑。
> 还差的：F14.7/8、F20.6、F24.4b、F28.1 是符号/形状 pin，可换；
> F29.3/7/8、F30.2 断言的是 Preact 的渲染结果，而离线套件里没有任何渲染路径；
> F17.x、F23.6、F27.5/6、F28.4/6、F29.4 断言的是 CSS 规则文本，离线没有 CSS 引擎，
> 只能留在文本层（写法上向 F27.6 看齐：先去注释、再切到规则块）。
> 另：`diagnostics.text` 的 `'fallback'` 取不到——`text` 只在 `tweetText` 命中时才产生，
> 所以「fallback/none 上涨即 X 改版信号」这句目前只有 `none` 那一半成立。
> 下面两节「社区确认可依赖的信号」「明确不做的事」是**现行参考**，其余按历史读。

> 基于社区调研（XActions 文档 + 多个 userscript 源码交叉印证 + 未登录页实测）
> 逐条核实本仓库代码后得出。核实方式见每条的「核实」标注。

## 核心结论

**社区主流做法是拦截 GraphQL 而非解析 DOM。** 原因是 DOM 判据在 X 每天多次部署下会持续失效。
但拦截 GraphQL 意味着引入 `window.fetch` hook、queryId 轮换（社区实测已轮换过至少 4 次）、
feature flag 自适应等一整套新机制——对本项目是重大架构变更。

**本清单采取的立场：继续用 DOM，但只依赖「X 自己的锚点 + 结构语义」，剔除全部脆弱判据。**
这是投入产出比最高的路径。若后续要做 GraphQL 方案，应单独立项。

---

## P0 — 正在丢数据或判错（已逐条核实）

| # | 位置 | 问题 | 改法 |
|---|---|---|---|
| 1 | `urls.ts:37` | `name=large` 上限 2048px，非原始尺寸。社区统一用 `name=orig`（上限 4096px）。`webp` 也拿不到原图 | 改 `name=orig`，并把 `format=webp` 改写为 `format=jpg` |
| 2 | `thread.ts:18,31` | `article.querySelector('[data-testid="placementTracking"]')` 只找后代，但 `placementTracking` 常是**祖先** | 改 `article.closest(...)` |
| 3 | `extractor.ts:336` | `[data-testid="gifBadge"]` **全网零结果，是虚构选择器**。社区实测 X 的 GIF 角标是纯文本 `GIF`，无 aria-label | 删虚构 testid，保留文本判据并注明局限 |
| 4 | `extractor.ts:262` | 媒体链接只过滤 `pic.twitter.com`，X 已改用 `pic.x.com`；漏过的链接会被下一行当 @提及 写进正文 | 补 `pic.x.com`，并按「链接文本是否等于 URL」兜底 |
| 5 | `extractor.ts:380` | `div[aria-label*="video" i]` 会命中外链卡片（如 YouTube 视频卡），误判为视频 | 收紧为 `div[aria-label="Embedded video"]` 精确匹配 |
| 6 | `extractor.ts:437-453` | Strategy D 兜底会把**照片**当成视频 poster。混合媒体场景下 A/B/C 失败时产出 `[photo, photo]` | 仅在已确认含 `<video>`/videoPlayer 的容器内执行，且排除 `tweetPhoto` 内图片 |

## P1 — 判据脆弱，会随 X 改版静默失效

| # | 位置 | 问题 | 改法 |
|---|---|---|---|
| 7 | `thread.ts:100-102` | inline style `width:2px` + 混淆类名 `r-11mg6pl`/`r-14lw9vd`/`r-16y2uox`。社区有实证：同一份 DOM 隔两年抓取，混淆类名**无一相同** | **删除**。改用 snowflake ID 单调性 + `socialContext` + 详情页上下文 |
| 8 | `thread.ts:55,64` | `getReplyingToHandle` 文案正则仅 3 种语言；`回复` 会误命中引用推文与 bio 文本；`\b` 对 CJK 无效 | 先查 `div[data-testid="socialContext"]` 内的 `a[href^="/"]` 取 handle，文案降为末级 |
| 9 | `thread.ts:29` | `/\b(?:Promoted\|赞助)\b/i` 独立触发。`赞助` 会命中用户 bio（bio 与推文同在 article 内），假阳性高 | 必须 `placementTracking` 命中后才允许文案辅助 |
| 10 | `extractor.ts:615` | `includes('This post is unavailable')` 文案匹配，至少 20 种语言 | 改结构判据：有 `/status/` 链接但缺 `User-Name` 与 `tweetText` |
| 11 | `extractor.ts:53,90` | `.quote-box` 是 2015 年前老 Twitter 类名，X 从未有过 | 删除死代码 |
| 12 | `injection.ts:277` | `div[role="group"]` 会命中**引用推文内部**，导致按钮误注入、点击后提取到内层推文 | 限定 group 必须不在任何 `quoteTweet` 内 |
| 13 | 全局 | **完全没有转发（retweet）判定**。用户看到的可能是转发内容却被当作原创渲染 | 加 `socialContext` + 其内部 `a[href^="/"]`（转推者 handle 只出现在此容器，结构性、零文案依赖） |
| 14 | `thread.ts:248` | `article[data-testid="tweet"]` 在未登录页 0 命中（社区实测），所有选择器静默返回 null | 加 `role="article"` → `[data-testid="cellInnerDiv"] article` 两级 fallback |

## P2 — 长期维护能力（可选，但价值高）

| # | 建议 |
|---|---|
| 15 | 给 `TweetData` 加 `_diagnostics` 字段，记录每项用了哪级策略、是否命中 tombstone。抄 XActions 的 `_meta` 思路——**X 改版当天从日志发现，而不是等用户投诉** |
| 16 | 补一条测试：模拟完全没有 `data-testid` 的 DOM，断言优雅降级而非抛错 |
| 17 | `tier1_features.test.ts` 中断言源码字符串内容的测试会**把虚构选择器固化成契约**，应改为断言行为 |

---

## 明确不做的事

| 项 | 原因 |
|---|---|
| 引入 `twitter-text` | 3.1.0 自 2020 未更新，API 只处理纯文本字符串，无 DOM 定位能力。X 已把 mention/hashtag 渲染成 `<a>`，直接遍历即可 |
| 引入 snscrape / nitter / twikit | 它们**都不做 DOM 解析**，全走 API/服务端渲染。用它们等于改成 GraphQL 方案 |
| 拦截 GraphQL | 架构级变更，queryId 会轮换，需 feature flag 自适应。应单独立项评估 |
| Community Notes / subscriber-only 判据 | 社区**查不到**任何权威 DOM 选择器。调研明确标注为「未知」，不猜测 |
| `div[aria-label="Embedded video"]` 之外的视频兜底 | 精确匹配 + `video` 元素兜底已足够，宽松匹配只会引入误报 |

---

## 社区确认可依赖的信号

- `article[data-testid="tweet"]`、`tweetText`、`tweetPhoto`、`videoPlayer`、`quoteTweet`
- `div[data-testid="socialContext"]` —— 承载「转发/置顶/回复」**容器**，容器名稳定、内部文字不稳定
- `div[data-testid="placementTracking"]` —— 广告，用 `closest()`
- `div[data-testid="tweet-thread-indicator"]` —— 语义未文档化，仅作弱信号
- `a[href*="/status/"]`、`time[datetime]` —— 结构语义，不会变
- **snowflake ID 大小关系** —— X 官方文档背书的时序。但官方措辞是 "roughly time-ordered"，
  故**只能用作否决条件**（排除不可能的前一条），不能用作肯定条件

### 大小写陷阱（历史上翻过车）
`User-Name`（推文内）≠ `UserName`（个人资料页）；`gifyButton`（官方拼写错误，非 `gifButton`）
