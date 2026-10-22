# 实测记录：登录态长文推文（X Article）DOM

> **状态：本次发现已全部修复并被测试覆盖。** 本文是一次性快照，不是待办清单。
> 采集日期 2026-10-09，采集时 X 的 `data-app-version` 为 `e9b82655819b239e9de923fddd58156f63f7c23c`。
> 下面列出的判据已被 `tests/tiers/tier_article.test.ts` 锁住（每条都做过变异测试）。

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
修复见 `src/content/adapter/articleScope.ts`：判定嵌套 article 时跳过读视图。（该模块已于 2026-10-12 并入
`extractor.ts`，读视图选择器现在是那里的 `ARTICLE_READ_VIEW`。）

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

> **2026-10-22 补记**：列表视图的预览卡（见
> `docs/observed-dom-2026-10-22-article-preview.md`）之外，还有一处载荷侧的缺口：失败的卡片正文带着
> `/i/article/` 尾链，而时间线 DOM 里没有这条链接，说明正文来自载荷、而那份载荷的 `article` 没能
> 读成文章（缺失或存根，登录态未采到）。卡片现在由 `resolver.ts` 的 `backfillArticle` 从 DOM 兜底，
> `res.15` 锁住。

## 尚未覆盖

- **时间线/搜索结果**：采集时 `bridge.ts` 只监听 `TweetDetail` 与 `TweetResultByRestId`，
  这两个 operation 都不为从首页点开的推文发出，所以那条路径只有 DOM 通道可行。
  本次修的是 DOM 通道，因此时间线路径**应该**已经可用，但**未在真实时间线上验过**。
  （拦截名单此后已扩到列表类 operation，见 `src/content/graphql/operations.ts`；本快照只记
  采集当日的事实。）
  **2026-10-22 更正**：列表视图不是同一个形态——它渲染预览卡，没有阅读视图，所以上面这句
  「应该已经可用」是错的。见 `docs/observed-dom-2026-10-22-article-preview.md`。
- 文章正文里嵌入的视频（`amplify_video_thumb`）在卡片上的呈现：本次判定为文章内容而排除，
  若将来要展示需要单独设计。

## 复核补记（同日）

首次落地后复审又发现并修正了四处，均已加回归用例（`art.5b` / `art.7` / `art.10` 及 `art.6` 的
`text` 断言，逐条变异测试）：

1. **文章链接只在 GraphQL 通道被剥**。DOM 通道的 `cleanTweetText` 与 token pass 都只认
   `pic.twitter.com` 尾链，于是改完之后变成「GraphQL 不印、DOM 印」——恰好是提交自述要去掉的
   不一致。判据现落在 `emojis.ts` 的 `isArticlePermalink`，两个通道共用；DOM 侧 `text` 与
   tokens 两条路都剥，GraphQL 侧 `text` 按实体 `indices` 剥（payload 里 `text` 是 `t.co` 形态，
   展开后的 `/i/article/` 只在 tokens 里）。
2. **`findQuoteContainer` 第 1 级没有文章边界守卫**。正文内嵌推文若自带引用，其
   `div[data-testid="quoteTweet"]` 会被文档序搜索命中，卡片上出现陌生人的引用。第 2、3 级
   早已有守卫，第 1 级补齐。
3. **文章封面被卡片画幅劫持**。封面是 `data-count="1"` 的 media-grid，继承了「单张照片撑满
   海报」那套按卡片 `data-ratio` 命中的尺寸规则：实测 3:4 下拉到 380px、16:9 下压到 200px，
   2.498:1 的横带变成竖构图。现有 `.article-block` 作用域覆盖把它固定回自身比例（实测三种
   画幅均为 231px = 576/2.498）。
4. **夹具的 `&amp;` 未解码，且有一个错误且无人引用的期望常量**。测试 shim 不做 HTML 实体解码，
   而真实 DOM 的 `getAttribute('src')` 返回解码后的 `&`，所以夹具写 `&amp;` 会让封面 URL 变成
   `format=jpg&amp%3Bname=small`。已改回 `&`；`EXPECTED_ARTICLE_TWEET_DATA` 因无人引用且内容
   有误（写成 `name=large`，实际为 `name=orig`）而删除。

## 复核补记二（同日，code-review）

对 `de0f038..f49ee70` 跑双轴审查（Standards / Spec）后，又修了五处：

1. **剥离被施加到每条推文，而非仅长文**（Spec：范围蔓延）。`cleanTweetText` 无条件剥
   `/i/article/` 尾链，于是任何正文恰好以「别人文章」链接结尾的推文会静默丢掉该链接。
   现由调用点按「本推文是否确实带文章」决定是否剥离，DOM 与 GraphQL 两侧都是；新增 `art.9`
   锁住「仅分享他人文章链接不被剥」。
2. **导语渲染在封面/标题之前**（Spec：版式）。用户选定顺序是 封面 → 眉标+标题 → 导语，
   但代码把导语放在最前，且 `renderArticleBlock` 的注释还宣称相反顺序。现改为导语在标题之后；
   浏览器实测确认顺序为 封面 → 长文 → 标题 → 导语。
3. **`ArticleData.restId` 是死字段**（Standards：Speculative Generality）。GraphQL 填充但
   生产渲染无处读取，DOM 侧还明确声明不设。已删除（连同 `dev/preview.ts` 夹具中的对应项）。
4. **`openingLine` 只有 GraphQL 通道填**（Spec：部分实现）。DOM 的 `extractArticle` 原先不返回
   它，于是从时间线（只有 DOM 通道）打开的无正文长文没有导语——正是需求点名的场景。现 DOM 侧
   从正文区首段读取 `openingLine`。
5. **文档与词汇漂移**（Standards）。`GLOSSARY.md` 的 Article 定义补上「自身开头行仅在推文无正文时
   作导语」并新增 **Long-form Post** 词条（此前 `long-form post` 被当作 Article 的同义词使用）；
   `AGENTS.md` 的 tier 数 8→9；`PROJECT.md` 接口契约补 `ArticleData` / `article?`；本文状态行
   的用例数 6→10；`data-article="on"`（无选择器、无测试）随重构移除；封面 grid 不再传
   `t.videoLabel`（封面恒为图片）。

其余为基线 smell 的取舍：封面 `MediaItem` 在 DOM 与 GraphQL 两处各自构造——因两侧输入形态不同
（DOM 读 `getAttribute`，GraphQL 读 JSON 字段）而保留，未强行合并。

## 复核补记三（同日，code-review 二轮）

对 `de0f038..HEAD`（含图片回退与截断标记两项）跑双轴审查后又修了两处，都与本文关系最密的 `openingLine` 有关：

1. **DOM 的 `openingLine` 实际取到整篇正文。** 复核补记二第 4 条声称「从正文区首段读取」，但代码写的是
   `proseEl.querySelector('p, div')`。选择器列表按文档序返回首个命中，而 `longformRichTextComponent`
   （正文容器本身）就是个 `div`，排在所有 `<p>` 之前——于是「首段」变成整篇约 7000 字，恰好是这条修复
   要救的「从时间线打开的无正文长文」场景。改为只查 `p`；`art.11` 锁住，坑写进代码注释。
2. **测试 shim 的逗号选择器返回顺序与浏览器不一致。** `tests/env/browser.ts` 的 `querySelectorAllInternal`
   把各子选择器的结果**分组拼接**（先所有 `p`、再所有 `div`），而真实 `querySelectorAll` 按文档序返回；
   所以上面那个 bug 在测试里被掩盖成「拿到了第一个 `<p>`」。已改为按文档序遍历命中集合——这正是本文档
   反复记的那类教训：夹具会和浏览器对着错。

其余按标准收紧：`extractor.ts` 内联重复的 `ARTICLE_BODY` 选择器改从 `articleScope.ts` 导出复用（两者后来
合成一个模块，现在 `ARTICLE_BODY` 就是 `extractor.ts` 自己的模块私有常量，不再跨模块导出）；
`FALLBACK_ATTR` 无第二调用方，收回为模块私有；`parse.ts` 里 retweet 分支与外层重复的
`entitySourceFor → parseRichTokens → strip` 序列抽成了 `parseBody`。封面 `MediaItem` 的两侧各自构造仍保留。

## 复核补记四（同日，code-review 三轮）

对 `de0f038..HEAD`（此时 HEAD 为 `b8651fa`）再跑一次双轴审查，又修了四处：

1. **视频 poster 的回退链取到了 mp4**（Spec：真 bug）。`parseMedia` 给视频设的 `originalUrl` 是**视频文件**
   （`bestUrl`），而 `imageFallbackAttrs` 从 `originalUrl` 推导变体链，于是 GraphQL 视频 poster 的链是
   `[poster, <mp4>]`——poster 一旦 404，`img.src` 被换成 `.mp4`，比原来更坏。改为视频一律以 poster 为链源。
   诚实的结果：视频缩略图路径（`/amplify_video_thumb/` 等）不被 `getPhotoUrlCandidates` 识别，拿不到变体链、
   也就没有回退，但**视频文件绝不进链**；`Tier 2.37f` 锁住这一点。照片路径不受影响。
2. **`openingLine` 的粒度随通道不同**（Spec）。DOM 只读第一个 `<p>`，GraphQL 却把 X 的整段
   `preview_text`（可含多段）原样当导语，同一篇文章两个通道印不同量。`parse.ts` 新增 `firstParagraph`，
   两通道都只取首段；`art.6` 加了「不含第二段」的断言。
3. **字段改名 `previewText` → `openingLine`**（Standards：Mysterious Name）。同一次改动里 `previewText`
   （文章开头行）与截断推文语境里的「preview」（X 的截断渲染）含义冲突；改名既消除歧义，也更贴合
   GLOSSARY 的「opening line」。
4. **`ArticleData.restId` 类型声明是死字段的最后一截**（Standards：Speculative Generality）。复核补记二
   第 3 条说它「已删除」，但实际只删了 GraphQL 的填充与夹具项，类型声明、`art.4` 的断言与 `extractor.ts`
   的注释都还在。本轮彻底删除。

其余：`TrailingLinkToken`（复核补记三收 `FALLBACK_ATTR` 时漏掉的同类）收回模块私有；`dev/preview.ts`
夹具选择从嵌套三元改为 `FIXTURE_BY_PARAM` 映射；本文状态行用例数 10→11、`art.10` 注释里指向不存在的
`art.8` 已改。
