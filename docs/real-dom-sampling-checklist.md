# 真实 DOM 采样清单

> **状态：第 2、3、7 条已由 `docs/observed-dom-2026-10-10-authenticated.md` 回答（结论见那篇），
> 其余仍未采到；「为什么」一列写的是采集当日的判据，不是现行事实。**
> 已经采到的场景在 `docs/observed-dom-*.md`（每篇开头有状态行），先看那里，再决定还差哪几条。

用于验证推文检测逻辑。每项只要**推文所在 `<article>` 元素**（在 Chrome 检查器里选中
`article[data-testid="tweet"]` → 右键 → Copy → Copy outerHTML）。

采集中请**同时保留**该 article 的 `outerHTML`，这样能同时验证选择器和嵌套结构。

## 优先级 P0 —— 缺失会导致判据无法验证

| # | 形态 | 为什么要 | 你截图里那个帖子能否覆盖 |
|---|---|---|---|
| 1 | **图 + GIF 并排** | 当前 bug：视频检测短路导致图片丢失 | ���（左侧截图 + 右侧 GIF） |
| 2 | **纯图片（1~4 张）** | 基线，确认照片提取没被改坏 | 你截图里那个是混合，需另找一个纯图的 |
| 3 | **引用推文** | 验证 `findQuoteContainer` 4 级 fallback + 媒体不串味 | ✅（红框「查看引用」那条） |
| 3b | **嵌套引用（引用里的引用）** | 两级引用的容器形态**不同**：外层是 `role=link` 无 testid，内层是 `nestedQuotePreview`，媒体是 `nestedQuotePreviewMedia` 而非 `tweetPhoto` | ✅（2026-10-14，`observed-dom-2026-10-14-nested-quote.md`） |
| 4 | **纯视频** | 确认修复合并后仍只返回 1 项 | 需另找 |
| 5 | **推文串（≥3 条同作者）** | 验证 thread 边界判定 | 需另找 |

> 2026-10-10 补：自动播放关闭时，视频/GIF 在时间线里**没有 `<video>`**，只有海报 `img`
> 加一个 `aria-label="嵌入式视频"` 的 `previewInterstitial`；`tweet_video_thumb` 海报是 GIF，
> `amplify_video_thumb` 是视频。所以第 4 条要看的其实是「海报状态」的媒体，点开才变成 `<video>`。

## 优先级 P1 —— 判据稳定性

| # | 形态 | 为什么要 |
|---|---|---|
| 6 | **转发（retweet）** | **已答（2026-10-11）**：`data-testid="socialContext"` 在 **`span`** 上（不是 `div`），转帖者 handle 是该 span 自己的外层 `<a>`。据此已修 `adapter/social.ts` 并加真实夹具 `tests/fixtures/retweet.ts`（锁在 `tier2` 2.31b）。 |
| 7 | **回复** | **已答（2026-10-10）**：详情页会话区 35 条推文里 `socialContext` 为 0 个，也没有「Replying to / 回复」文案——那个容器不是每次都出现，详情页里 `getReplyingToHandle` 只能返回 null。时间线里的回复形态仍未见样本 |
| 8 | **有链接卡片**（如「来自 nintendo.com」） | `extractLinkCardMedia` 路径 |
| 9 | **含 hashtag / mention / cashtag** | 验证 token 分类，尤其 `$` cashtag |
| 10 | **含表情（Twemoji）** | `restoreUnicodeEmojis` 在真实 DOM 的表现 |

## 优先级 P2 —— 降级路径

| # | 形态 | 为什么要 |
|---|---|---|
| 11 | **不可见推文**（作者屏蔽了你 / 需登录） | 当前只在 quote 里处理了「此推文不可用」，主推文没有 |
| 12 | **社区笔记（Community Notes）** | 可能污染正文提取 |
| 13 | **订阅者限定推文** | 特殊受限态 |
| 14 | **广告 / 推广** | 现在靠 `Promoted`/`赞助` 文案 + `placementTracking` |
| 15 | **未登录页的推文（整页 0 个 `data-testid`）** | 身份仍能取到（靠 `a[href*="/status/"]` + `time[datetime]`），正文/媒体/统计则全部降级为空并把推文标成 unavailable；`tier2` 的 2.38 已用「真实夹具褪掉属性」锁住「不抛错 + 身份仍在 + 正文不吞按钮文字」这条底线，真样本能确认这个降级形态是否可接受 |

---

## 采集技巧

**批量拿多条**：在时间线页（首页或搜索结果）直接
`copy(document.querySelectorAll('article[data-testid="tweet"]')[0].outerHTML)`
可以取到单条；取多条就把 map 后 join。

**务必包含完整祖先结构**：如果推文在引用框内，请把**外层** article 一起给我，
这样我能验证「嵌套 article」的实际层级（现有代码的 `isInsideNestedArticle` 依赖这个假设）。

**X 的实验性开关会影响 DOM**：如果你开了 "Enable customization of third-party clients" 或类似设置，
`data-testid` 可能变多。请注明你当前的设置状态。

**必须在前台标签页里采**：后台标签页（`document.visibilityState === "hidden"`）里，
X 连海报 `img` 和 `<video>` 都不挂进 DOM —— 2026-10-10 那轮就这么误判过一次，
得出了「媒体被滤镜挡住」的错误结论。切到前台再看。

**自动播放关掉时，视频/GIF 没有 `<video>`**：只有海报 `img` 加
`div[data-testid="previewInterstitial"]`（`aria-label="嵌入式视频"`）。要采「播放器里长什么样」，
得先点开媒体。

---

## 附：我想从真实 DOM 里确认的关键问题

采到数据后我会重点核对这几处（都是我在代码审查中发现的疑点）：

1. `div[role="group"]` 是否真的出现在**引用推文内部**？如果有，注入按钮就会误落
2. ~~媒体链接的域名现在到底是 `pic.twitter.com` 还是 `pic.x.com`？~~ **已答（2026-10-10）**：`pic.x.com`，3/3 条全是它，没有 `pic.twitter.com`。
3. ~~GIF 徽标的稳定标记是什么？~~ **已答（2026-10-10）**：徽标是媒体容器里的 `<span>GIF</span>` 文本节点（**没有** `gifBadge` testid），容器自身的 `aria-label` 是 `嵌入式视频`（本地化，不是英文 `Embedded video`）。用真实嵌套跑过：带徽标的 GIF → `gif`，无徽标的视频海报 → `video`，所以现有判据成立、不需要改用海报 URL。
4. 转发推文有没有专属 `data-testid`？
5. ~~混淆类名 `r-11mg6pl` 等在当前版本是否还存在？~~ **已答（2026-10-10）**：还在，6/6 条推文（含详情页回复）都带 `r-*` 类名。
6. thread 连接线在真实 DOM 里的形态（是 `border-left`？独立 div？还是别的）
7. 引用推文容器当前用的到底是哪个 `data-testid`（`quoteTweet`？还是已改名）
