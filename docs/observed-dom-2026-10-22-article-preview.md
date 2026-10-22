# 实测记录：列表视图里的长文帖预览卡（X Article preview）

> **状态：本文的判据已落地**，锁在 `tier_article` 的 `art.12`–`art.14`。
> 本文是一次性快照，不是待办清单。采集日期 2026-10-22，界面语言 zh-CN。
> 采集方式：用户本人登录的 Chrome（OpenChamber 浏览器面板），对实时 DOM 逐个选择器探测，
> **没有**复制 `outerHTML`；下面的结构与尺寸都是当时量到的，改动前先确认它是否还对得上。

## 为什么会有这篇

2026-10-09 的记录只覆盖了**状态页**：那里 X 把文章渲染成内联的阅读视图
（`article[data-testid="twitterArticleReadView"]`）。提取器一直只认这个标记。

2026-10-22 用户报告文章帖在**列表视图**（首页 / 个人页）里又不适用了。实测该视图**根本没有**
阅读视图：X 渲染的是一张预览卡。`findArticleReadView` 返回 null，于是

- 卡片丢掉封面与标题，只剩正文；
- 正文末尾的 `x.com/i/article/2112…` 尾巴**没有**被剥掉——剥离只在「本帖确实带文章」时执行
  （见 `extractor.ts` 的 `if (articleData)`），而那时 `article` 是 undefined。

同一个帖在 `/<user>/status/<id>` 上仍然带阅读视图，所以这不是文章整体失效，是**列表视图的形态**变了。

## 两种视图的差别（2026-10-22 实测）

| | 状态页 `/status/<id>` | 列表视图（个人页 / 首页） |
|---|---|---|
| 阅读视图 `article[data-testid="twitterArticleReadView"]` | ✅ 命中（`tagName === 'ARTICLE'`，实测 490×10135） | ❌ 0 个 |
| 标题 `[data-testid="twitter-article-title"]` | ✅ 命中 | ❌ 0 个 |
| 正文区 `twitterArticleRichTextView` / `longformRichTextComponent` | ✅ 命中 | ❌ 0 个 |
| 封面 `div[data-testid="article-cover-image"]` | ❌ 0 个 | ✅ 命中（实测 441×176） |
| 帖子正文 `tweetText` | ❌ 该页不渲染正文 | ✅ 命中（含 `/i/article/` 尾链） |

即：**两个视图的标记互不相交**，只读其中一个必然在另一个上静默失败。
`[data-testid*="rticle"]` 在列表视图整页只命中封面这一个 testid——标题与摘录没有自己的 testid。

## 列表视图的结构

```
article[data-testid="tweet"]
  ├─ div[data-testid="tweetText"]                    ← 正文，末尾是 /i/article/ 尾链
  └─ div                                             ← 预览卡（1px 边框，圆角 12，margin-top 12）
       ├─ div[data-testid="article-cover-image"]     ← 封面；卡片里唯一的文章标记
       │    ├─ (aspect 占位层) > div > img           ← 实际图片，懒加载，未加载时 opacity 0
       │    └─ div[aria-label="文章"] > span         ← 徽标，文案本地化，**不作判据**
       └─ div                                        ← 文字盒（padding 12）
            ├─ div > div                             ← 标题（实测 17px / 字重 800）
            └─ div > span                            ← 摘录（15px，4 行高 80px，overflow hidden）
```

提取器读的是：**封面 → 同一盒里紧跟其后的标题 → 封面里的 `img`**。

- 标题取 `coverBox.nextElementSibling` 的**第一个**子元素；
- 摘录是第二个子元素，**不读**：它是被夹到 4 行、带省略号的预览片段，不是文章的开头行，
  因此预览卡这条路径不填 `openingLine`（`ArticleData.openingLine` 只在正文为空时作导语，
  而这条路径上正文就在旁边）。
- 徽标文案（`文章` / `Article`）与封面 `alt` 都是本地化的，判据里一条都不用。

## 没采到什么

- **首页时间线未单独采样**：本轮样本来自个人页列表（`/peko1487584`）与状态页。两者用的是同一个
  推文卡片组件，但没有在首页上直接看到同一形态；首页当次加载里没有长文帖。
- **没有 `outerHTML`**：本轮靠选择器探测确认存在与结构，没有拿到可归档的原始标记；夹具
  `tests/fixtures/article-preview-tweet.ts` 是按上面这份结构缩写的。若将来要复核，请按
  `docs/real-dom-sampling-checklist.md` 的口径补一份 `article[data-testid="tweet"]` 的 outerHTML。
- **封面图 URL**：面板里图片没有加载（头像、视频海报同样空白），只能确认 `img` 在封面容器内、
  懒加载后出现且为 441×176；URL 形态（`pbs.twimg.com/media/...`）沿用 `urls.ts` 的既有规则。
- **无封面的文章**：没有遇到样本。判据以封面容器为锚点，所以一篇不渲染封面的文章在列表视图里
  仍会漏掉——这是本条判据已知的边界。

## 落地后的真机复跑

构建产物（`v1.0.0·2128`）在真 Chrome 里对夹具跑过一遍（本地服务器 + 与 `dev/verify-extractor.mjs`
相同的注入方式）：触发按钮 1 个、点击后卡片里 `.article-block` 存在、标题为
`你的游戏，怎么才能被Steam算法看见`、封面已挂载、卡片文本里没有 `i/article`、无异常。

加上 `backfillArticle` 后又跑了一遍同样的真机探针（`v1.0.0·2213`），这次在点击前先向 bridge 投递
一份「正文照旧、`article` 被删掉」的 `TweetDetail` 载荷，模拟 21:36 那张卡的来源：卡片同样有
`.article-block`、标题与封面，正文没有 `i/article`，无异常。

## 同日发现的第二个原因：载荷里读不出文章

列表视图的判据落地后，用户用 `v1.0.0·2136`（含上面的修复）重新构建，卡片仍然没有文章，
正文末尾仍印着 `x.com/i/article/2112…`。这一次不是 DOM 的问题：

- **时间线 DOM 里那个帖子根本没有这条链接**：个人页上
  `article[data-testid="tweet"] a[href*="t.co"]` 实测 **0 个**、`a[href*="/i/article/"]` 也是 0 个，
  帖子正文在「看到」处就结束了（预览卡取代了尾链）。
- 而失败卡片的正文**带着**这条链接。正文唯一的来源因此是 **GraphQL 载荷**——且那份载荷里的
  `article` 没有变成一张能用的文章（`parseArticle` 既要求 `__typename === 'ArticleEntity'`，也要求
  有 `title`；缺少其一就返回 undefined，尾链也就不会被剥）。
- 详情载荷按固定顺序尝试，谁先答上就按谁的来，所以「哪一份载荷没有可用的 article」取决于缓存
  里当时有哪几份。

**这份登录态载荷本身没有采到**（面板读不到网络响应），所以「article 字段是缺失、还是不带 title
的存根」仍未定论。修法不依赖这个答案，沿用「GraphQL 已答的地方不被覆盖，只补它缺的」：
`resolver.ts` 的 `backfillArticle` 在载荷的推文没有 `article`、而 DOM 抽到了文章时，接管文章的
封面与标题，并补做载荷自己做不了的尾链剥离（tokens 用共享的 `stripTrailingArticleToken`，
text 用载荷的 `t.co` 形态）。锁在 `tier_resolver` 的 `res.15`（两处变异：去掉兜底、去掉剥离，
各自都会让它变红）。

这条兜底同时覆盖状态页（阅读视图）与列表视图（预览卡）——只要 X 在页面上画了文章，卡片就有。

