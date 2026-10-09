# 实测记录：登录态长文推文（X Article）DOM

> **状态：本次发现已全部修复并被测试覆盖。** 本文是一次性快照，不是待办清单。
> 采集日期 2026-10-09，采集时 X 的 `data-app-version` 为 `e9b82655819b239e9de923fddd58156f63f7c23c`。
> 下面列出的判据已被 `tests/tiers/tier_article.test.ts` 的 6 条用例锁住（每条都做过变异测试）。

> 采集时间：2026-10-09
> 页面：`https://x.com/kevinleguillou/status/2108306407921443081?s=20`（已登录）
> 采集方式：`dev/verify-extension.mjs` 起的是**全新临时 profile，未登录**，拿不到登录态标记；
> 本次由用户在本人登录的 Chrome 里执行探针脚本取得。

## 为什么必须用登录态

未登录时 x.com 走的是另一套客户端（`/x-web/x-web/entry-client-logged-out-*.js`，Vite + Tailwind），
整页 0 个 `data-testid`，文章正文容器的类名是 `.x-article-body`。

登录态走 legacy webpack 包（`/responsive-web/client-web/`），标记完全不同：
**没有 `.x-article-body`**，改用 `data-testid`。两套结构不可互推，所以判据只能从登录态取。

## 结构

```
article[data-testid="tweet"]
  └─ article[data-testid="twitterArticleReadView"]        ← 文章阅读视图，本身是嵌套 <article>
       ├─ div[data-testid="tweetPhoto"] > img             ← 封面（alt 为本地化文案，如「图像」）
       ├─ div[data-testid="twitter-article-title"]        ← 文章标题
       └─ div[data-testid="twitterArticleRichTextView"]
            └─ div[data-testid="longformRichTextComponent"]
                 ├─ div[data-testid="simpleTweet"]        ← 正文内嵌的推文，自带 User-Name/tweetText/tweetPhoto/role=group
                 └─ h1/h2 …                               ← 正文章节标题
```

## 逐项核验

| 判据 | 结果 | 备注 |
|---|---|---|
| `article[data-testid="twitterArticleReadView"]` | ✅ 命中，`tagName === 'ARTICLE'` | 文章块是**嵌套 `<article>`** |
| `div[data-testid="twitter-article-title"]` | ✅ 命中 | 标题原文 `"Anime Harry Potter"` |
| `div[data-testid="twitterArticleRichTextView"]` | ✅ 命中 | 正文 6985 字符 |
| `div[data-testid="tweetPhoto"] img` | ✅ 命中 | 封面；`alt` 是本地化文案 |
| `div[data-testid="quoteTweet"]` | ❌ **不存在** | 这条推文没有引用 |
| `img[alt="Article cover image"]` | ❌ 登录态不存在 | 那是未登录客户端的标记 |

## 这里踩到的三个坑（均已修复）

### 1. 文章块是嵌套 `<article>`，被当成引用推文

`findQuoteContainer` 的第 2 级 fallback 是裸的 `article.querySelector('article')`，
**必然**命中 `twitterArticleReadView`。整篇文章因此变成假引用框。

同时 `isInsideNestedArticle` 把"嵌套 article 内的元素"判定为引用内容，于是：

- `extractTweetStats` 里 `if (isInsideQuoteTweet(actionBar)) return undefined` → **互动数据全丢**
- `extractTweetMedia` 的过滤器 `!isInsideQuoteTweet(img)` → **封面被过滤**

实测确认：互动条与封面都位于读视图**内部**（`barInRv: true`、`photoInRv: true`）。
修复见 `src/content/adapter/articleScope.ts`：判定嵌套 article 时跳过读视图。

### 2. 正文内嵌推文，其媒体与统计会串进卡片

`twitterArticleRichTextView` 里嵌着一条 `simpleTweet`，自带 `User-Name`、`tweetText`、
`tweetPhoto`（视频缩略图）和 `role="group"`。

`article.querySelector('div[role="group"]')` 是文档序第一个，命中的是**内嵌推文**的操作栏，
于是卡片显示的点赞数是内嵌推文（`4.3K`）而不是本条（`153`）。这条是写测试时才暴露的。

### 3. GraphQL 通道会印出文章的 t.co 尾巴

`TweetResultByRestId` 的 `url_entities` 里有一条 `t.co/MXcei1QhVg`，
展开为 `https://x.com/i/article/2108301504562262016`。

X 自己**不渲染**它（未登录 SSR 的正文里没有，`card.id` base64 解码为
`Card:https://t.co/MXcei1QhVg` 说明它被当作卡片链接剥掉了），但 GraphQL 通道会当普通链接印出来，
导致同一条推文在两条通道下长相不同。

## 两条通道的同一份数据（交叉验证）

GraphQL 的 `TweetResultByRestId` 里其实带着文章：

```
result.article.article_results.result = {
  __typename: "ArticleEntity",
  rest_id: "2108301504562262016",
  title: "Anime Harry Potter ",          ← 注意 X 带了尾随空格
  preview_text: "This is a writeup for …, locally",
  cover_media_results.result.media_info = {
    original_img_url: "https://pbs.twimg.com/media/HUIxgCnWEAEUKgI.jpg",
    original_img_width: 1344, original_img_height: 538      ← 5:2
  }
}
```

DOM 的封面 `HUIxgCnWEAEUKgI` 与 GraphQL 的 `original_img_url` 是**同一个 media id**，
两条通道对同一张图的说法一致——这是判据可信的硬证据。

## 尚未覆盖

- **时间线/搜索结果**：`bridge.ts` 只监听 `TweetDetail` 与 `TweetResultByRestId`，
  这两个 operation 都不为从首页点开的推文发出，所以那条路径只有 DOM 通道可行。
  本次修的是 DOM 通道，因此时间线路径**应该**已经可用，但**未在真实时间线上验过**。
- 文章正文里嵌入的视频（`amplify_video_thumb`）在卡片上的呈现：本次判定为文章内容而排除，
  若将来要展示需要单独设计。
