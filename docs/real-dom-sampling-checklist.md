# 真实 DOM 采样清单

> **状态：场景清单仍然可用；「为什么」一列写的是采集当日的判据，不是现行事实。**
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
| 4 | **纯视频** | 确认修复合并后仍只返回 1 项 | 需另找 |
| 5 | **推文串（≥3 条同作者）** | 验证 thread 边界判定 | 需另找 |

## 优先级 P1 —— 判据稳定性

| # | 形态 | 为什么要 |
|---|---|---|
| 6 | **转发（retweet）** | 现有代码**完全没有**转发判定。要确认 X 是否有 `data-testid` 可用 |
| 7 | **回复** | 现在靠 `Replying to`/`回复`/`返信先` 文案匹配，要换成结构信号 |
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

---

## 采集技巧

**批量拿多条**：在时间线页（首页或搜索结果）直接
`copy(document.querySelectorAll('article[data-testid="tweet"]')[0].outerHTML)`
可以取到单条；取多条就把 map 后 join。

**务必包含完整祖先结构**：如果推文在引用框内，请把**外层** article 一起给我，
这样我能验证「嵌套 article」的实际层级（现有代码的 `isInsideNestedArticle` 依赖这个假设）。

**X 的实验性开关会影响 DOM**：如果你开了 "Enable customization of third-party clients" 或类似设置，
`data-testid` 可能变多。请注明你当前的设置状态。

---

## 附：我想从真实 DOM 里确认的关键问题

采到数据后我会重点核对这几处（都是我在代码审查中发现的疑点）：

1. `div[role="group"]` 是否真的出现在**引用推文内部**？如果有，注入按钮就会误落
2. 媒体链接的域名现在到底是 `pic.twitter.com` 还是 `pic.x.com`？
3. GIF 徽标的稳定标记是什么（`data-testid`？还是只有文本「GIF」？）
4. 转发推文有没有专属 `data-testid`？
5. 混淆类名 `r-11mg6pl` 等在当前版本是否还存在？
6. thread 连接线在真实 DOM 里的形态（是 `border-left`？独立 div？还是别的）
7. 引用推文容器当前用的到底是哪个 `data-testid`（`quoteTweet`？还是已改名）
