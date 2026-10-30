# 登录态真实 DOM/载荷采样 — 2026-10-21

> **状态：本轮只覆盖了「登录态真机验证」这一个 brief 需要的几处；没采的场景见 §7。**
> 采集方式：用户本人登录的 Chrome，经 CDP（`DevToolsActivePort`）新建标签页，读实时 DOM 与
> 页面自己发出的 GraphQL 响应；不是截图推断。界面语言 zh-CN。
> 采到的形态会被后续改版覆盖；改判据前先确认本文是否还对得上。
>
> 这一轮**只验证、不改 `src/`**。文末 §6 记录了一处与本文形态不符、已单独立 issue 的代码问题。

## 0. 环境事实

| 项 | 实测 |
|---|---|
| 界面语言 | zh-CN，`aria-label` 全中文 |
| 登录判据 | `[data-testid="SideNav_AccountSwitcher_Button"]` 在 `/home`、个人页、详情页都为 `true`；未登录落地页 `[data-testid]` 计数 **0** |
| 采样页面 | `/home`、`/<user>`（4 个账号）、`/search?q=...&f=live`、`/<user>/status/<id>`（2 条） |
| 构建 | 注入用 `dist/`（stamp `v1.0.0·1650`）；浏览器里已装的那份 unpacked 是 `v1.0.0·1637`（早于 16:51 那次重建）。`build.ts` 说明两份只差 stamp |

### 0.1 两种注入法的差别（会误判，先看这条）

| 注入法 | 内容脚本世界 | `chrome.runtime` | 能验什么 |
|---|---|---|---|
| `Page.addScriptToEvaluateOnNewDocument` 注入 `dist/content.js` | 页面主世界 | **不存在** | 提取、合并、卡片结构 |
| 浏览器自己按 `manifest.json` 装好的 unpacked 扩展 | 隔离世界 | 存在 | 以上 **+ 导出**（背景页图片代理） |

同一张卡、同一张图：注入法导出得到灰块（`prepareCardImages` 拿不到 `chrome.runtime`，回退
`FALLBACK_PLACEHOLDER_DATA_URL`），装好的扩展导出得到完整图（PNG 1,158,674 B / 1280×1992，
卡片里那张图 `naturalWidth=880 naturalHeight=836`）。**所以「导出有没有灰块」只能用装好的扩展验。**

## 1. 单帖卡片的 DOM：`.thread-item` 不能用来数条数

```html
<div class="post-to-card-body-content">
  <div class="single-tweet-block"> … </div>        <!-- 单帖：没有 .thread-item -->
  <!-- 或 -->
  <div class="thread-list"><div class="thread-item"> … </div> … </div>
</div>
```

- 单帖卡 `.thread-item` 数量 **0**，`summary` 文案「共 1 条推文」；串卡才有 `.thread-item`。
- 因此**只数 `.thread-item` 无法区分「合并了 1 条」与「什么都没渲染」**。
  判断合并条数要用：`.thread-item` 数量（>0 时）＋ 摘要文案 ＋ 单帖时补 `.single-tweet-block` 计数。
- 实测样本：`/realNyarime/status/<id>` 卡片 `threadItems=0, summary=共 1 条推文, single-tweet-block=1`；
  `/simonw` 个人页点第 1 条，`threadItems=2, summary=共 2 条推文`。

## 2. 交互条里的 testid（详情页，2026-10-21）

一条 `article[data-testid="tweet"]` 内 `div[role="group"]` 数量 **1**，其内部 testid 集合：

```
reply, retweet, like, bookmark, app-text-transition-container
```

- **没有** `viewCount`，也**没有** `a[href*="/analytics"]`。详情页的浏览量不在交互条里，
  `extractor.ts` 那两条 views 判据在该形态下取不到值（本轮卡片的 6.8K 来自 GraphQL 载荷）。
- 转帖数的 `aria-label` 是「**3 次转帖。转帖**」，而同一帖的载荷 `legacy.retweet_count` 是 **1**、
  `quote_count` 是 **2** —— 页面这个数字是**转帖＋引用之和**，卡片显示的 1 只是转帖。
  逐项比对时不能把页面的「次转帖」直接当 `stats.reposts` 的对照组。
- 其余：`aria-label="N 回复。回复"`、`"N 喜欢次数。喜欢"`、`"N 书签。加入书签"`，
  文本节点是纯数字（`innerText` 依次为 `6 / 3 / 28 / 20`）。

## 3. `TweetDetail` 载荷的真实形状（本轮最重要的采集）

同一个 `article[data-testid="tweet"]` 之外，`TweetDetail` 的 instruction 列表：

```
TimelineClearCache
TimelineAddEntries
  ├─ entryId "tweet-<目标 id>"        content.itemContent.tweet_results.result   ← 根帖在这里
  ├─ entryId "conversationthread-<id>" content.items[]                        ← 串/会话模块
  │     └─ items[i] = { entryId, item: { clientEventInfo, itemContent } }
  ├─ … 其余全是 conversationthread- 模块（单条回复也是模块）
  └─ entryId "cursor-bottom-<id>"
TimelineTerminateTimeline
```

实测三条要点：

1. **模块项的 `itemContent` 在内层 `item` 上**：wrapper 的键是 `['entryId','item']`，
   `item` 的键是 `['clientEventInfo','itemContent']`，wrapper 上**没有** `content`。
2. **entry 没有 `sortIndex`**（详情页这批全是 `undefined`）——`collectTweets` 按 `sortIndex`
   兜 0 排序，结果等值、靠插入顺序稳定。
3. 模块里的 `tweet_results.result` 可以是 `null`（本轮见到 `(None, None)` 一项），
   即「该串一节缺失」的形态。

根帖的 `legacy` 计数与页面逐项对得上：

| 项 | 载荷 | 页面交互条 | 卡片 |
|---|---|---|---|
| 回复 | `reply_count` 6 | 「6 回复」 | 6 |
| 转帖 | `retweet_count` 1（`quote_count` 2） | 「3 次转帖」= 1+2 | 1 |
| 喜欢 | `favorite_count` 28 | 「28 喜欢次数」 | 28 |
| 书签 | `bookmark_count` 20 | 「20 书签」 | 有浏览量时不显示 |
| 浏览 | `views.count` 6841 | 交互条里没有 | 6.8K |

`TweetResultByRestId` 的形状仍是 `data.tweet.result`、**无** instructions。

## 4. 引用推文与「串」的 DOM 形态

- 详情页会话区、个人页、首页、搜索页：本轮读到的 130+ 条推文里
  `[data-testid="socialContext"]` 全为 `null`、`tweet-thread-indicator` **0**、
  「显示此推文串」链接 **0**。即 `isThreadConnectedPair` 第 7 条在个人页里能拿到的正向证明，
  **只有**载荷里的 `in_reply_to_status_id_str`。（与 2026-10-10 的结论一致，本轮样本更大。）
- 引用推文（`/search?q=filter:quote …&f=live`）：外层 article 的 quote 相关 testid 大多是 **0 个**，
  仅偶见 `nestedQuotePreview`；引用容器无 testid，与 2026-10-14 那条一致。
  卡片的引用面板是 `.quote-card[data-quote-depth="1"]`，其正文与媒体取自**被引用帖自己**：
  外层媒体 `media/HVJRvdFbkAAzQA0?format=jpg&name=orig`，引用内媒体
  `media/HVD0woAaMAA8KiW?format=jpg&name=orig`，两者不同且各自正确。
- 视频/GIF 海报：`previewInterstitial` 仍在；视频是 `播放此视频` + `amplify_video_thumb` /
  `ext_tw_video_thumb` 海报，GIF 是 `播放这个 GIF` + `tweet_video_thumb` 海报（与 2026-10-10 一致）。
  卡片上视频角标实测为时长文本（`.video-indicator-badge` / `.video-badge-pill`，本轮读到 `0:31`、`0:27`）；
  **GIF 帖的卡片角标本轮没有点开验**，不在本次验收项内。

## 5. 载荷里的 queryId（只作日期快照，**不得写死**）

| operationName | queryId（2026-10-21） |
|---|---|
| `TweetDetail` | `3BlMtudy4N-d78ch7zTLZQ` |
| `TweetResultByRestId` | `xZfFqfOmKQu_OXekGI59mg` |
| `UserOriginalsTimeline` | `QLGv_wL7wziqsHhU0K100w` |
| `HomeTimeline` | `svLglq6U2wlTyZMGDDcLYQ` |
| `SearchTimeline` | `irezafrnzav4Ulf1vDkEBg` |

与 `docs/x-query-ids-*.json` 里的旧值都不同——正是「按名字匹配、不按 queryId」的理由。

## 6. 与本文形态不符的代码问题（2026-10-21 已修）

真实模块项是 `items[i].item.itemContent`，而 `parse.ts` 的 `collectTweets` 把整个 item 当 entry
交给 `parseTweet`，后者读 `entry.content.itemContent` —— **模块项全部读空**。
用同一个真实载荷跑仓库自己的 `parseTweetDetailResponse`：修复前得 **1 条**（只有根帖）。
详见 `.scratch/live-verification-relay/issues/01-graphql-module-items-dropped.md`。

修复后的复测（`collectTweets` 改读 `entry.items`、`parseTweet` 同时接受 `item.itemContent`；
「修复前」是同一份载荷按旧逻辑能取到的条数 = 非模块项，模块项全被丢弃）：

| 本轮保存的真实载荷 | 模块项被丢 | 修复前 | 修复后 |
|---|---|---|---|
| `detail-click1.json` `TweetDetail`（13 项） | 11 | 2 | **13**，含同作者的 **5 连**（回复链逐条相接） |
| `compare.json` `TweetDetail` | 5 | 1 | **6** |
| `real-detail.json` / `payload-detail.json` `TweetDetail` | 3 | 1 | **4** |
| `order.json` `TweetDetail` × 2（各 66 模块项） | 66 | — | **36 / 36** |

即本文件 §7 说的「≥3 条连发只在个人页找不到」已不再是解析侧的限制：同一份
`TweetDetail` 载荷里有 5 条同作者连续回复链，修复前只解析出 2 条（根帖 + 1 条平铺项）。

## 7. 没采到什么

| 场景 | 说明 |
|---|---|
| 首页上的相邻同作者 | 本轮首页 9 条 / 13 条两次加载，相邻同作者 **0 对**（与 2026-10-10 一致） |
| ≥3 条连发的个人页 | 4 个账号 + 2 条搜索、共 130+ 条推文，按载荷 `in_reply_to_status_id_str` 配对，最长只有 **2 连** |
| GIF 徽标在卡片上的表现 | 本轮碰到的 GIF 帖角标是时长文本；该判定不在本轮验收项内 |
| 社区笔记 / 订阅者限定 / 不可见推文 | 未遇到 |
