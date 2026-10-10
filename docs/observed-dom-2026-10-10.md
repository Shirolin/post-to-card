# 登录态真实 DOM 采样 — 2026-10-10

> **状态：本轮采样只覆盖了清单的一部分，未覆盖的都写在最后「没采到什么」里。**
> 采集方式：relay 驱动的真实 Chrome（登录态，界面 zh-CN），标签页切到前台后
> 用 `document.querySelectorAll` 读取实时 DOM，不是截图推断。
> 采到的形态会被后续改版覆盖；代码改动前请先确认本文是否还对得上。

## 0. 环境事实

| 项 | 实测 |
|---|---|
| 页面 | 主页 / 搜索页（Top 与 Latest）/ 三条推文详情页 |
| `[data-testid]` 总数（主页） | 222 |
| 推文元素 | `article[data-testid="tweet"]` 命中，且同时带 `role="article"` |
| 界面语言 | zh-CN —— **UI 文案与 `aria-label` 全是中文** |

### 一个采样方法上的坑（会让人误判）

标签页在后台（`document.visibilityState === "hidden"`）时，X **不会把媒体挂进 DOM**：
`article img` 里只剩 emoji，既没有 video 也没有海报 `img`。第一次采样就因此得出过
「媒体被滤镜挡住」的错误结论。切到前台（`bringToFront`）后海报 `img` 立刻出现。
**采样必须在可见标签页里做。**

## 1. 混淆类名：仍在（P1-7 的判断站得住）

6/6 采到的推文（含详情页回复）都带 `r-*` 混淆类名，例如
`r-1ut4w64 r-18u37iz r-1udh08x`。把它当判据迟早会全灭，这条不用再怀疑。

## 2. 媒体链接域名：`pic.x.com`

搜索页里 3/3 条 `a[href*="pic."]` 全是 `pic.x.com/...`，没有一条 `pic.twitter.com`。
（P0-4 的结论在真实页面成立。）

## 3. 媒体在时间线里的真实形态：海报 img + previewInterstitial

自动播放关闭时，一条视频/GIF 在时间线里**没有 `<video>`**，只有：

```html
<div data-testid="tweetPhoto">
  <div style="visibility: hidden;">
    <div style="padding-bottom: 104.444%;"></div>            <!-- 占位，比例在这 -->
    <div aria-label="嵌入式视频" data-testid="previewInterstitial"> … </div>
  </div>
  <img src="https://pbs.twimg.com/tweet_video_thumb/HUPRvp-a4AAE2fG?format=…">  <!-- 海报 -->
</div>
```

采到的海报 URL 形态两种，都能区分：

| 形态 | 例子 | 含义 |
|---|---|---|
| `amplify_video_thumb/<id>/…` | `pbs.twimg.com/amplify_video_thumb/2108526219511894016/…` | 普通视频 |
| `tweet_video_thumb/<id>?format=…` | `pbs.twimg.com/tweet_video_thumb/HUPRvp-a4AAE2fG?format=jpg` | **GIF** |

点击后才出现 `div[data-testid="videoPlayer"]`，那时容器的 `aria-label` 是 `嵌入式视频`。

### 对判据的影响（含一处自我更正）

**徽标是存在的**，形态是媒体容器里的 `<span class="css-1jxf684 …">GIF</span>` 文本节点，
同容器还有 `button[aria-label="播放这个 GIF"]`。**没有** `gifBadge` testid（这一点审计说得对）。

> 更正：本文初稿写过「这个状态下徽标根本没渲染」。那是我查询取窄了——我只看海报 `img`
> 的直接父节点（interstitial 内层），而徽标 span 是同一 `tweetPhoto` 容器下的**另一个子树**。
> 教训：读实测时，查询范围要覆盖你声称在描述的那个容器。

于是判断走的是现有规则，且**实测成立**（用真实嵌套跑过 `extractTweetData`，见 F29.1 的
`GIF_POSTER_ONLY_HTML` / `VIDEO_POSTER_ONLY_HTML` 两个夹具）：

| 形态 | 判据给出的类型 |
|---|---|
| GIF：`tweet_video_thumb` 海报 + `<span>GIF</span>` 徽标，无 `<video>` | `gif` ✓ |
| 视频：`amplify_video_thumb` 海报，无徽标 | `video` ✓ |

也就是说 **不需要**改用海报 URL 来判 GIF：徽标文本是有效信号，而「`tweet_video_thumb` = GIF」
这个映射本轮**没能证实**（我唯一抓到的那张 `tweet_video_thumb` 恰好带徽标，所以它无法验证映射本身）。
如果再叠一条未证实的信号，只会多一个误判来源。

`isGifMedia` 读的是「容器自身 `aria-label` 含 `GIF`」或「容器内 `span`/`div` 文本正好是 `GIF`」；
`aria-label` 那条在真实页面里不成立（容器上是 `嵌入式视频`，不是英文 `Embedded video`，
exact-match 的选择器也匹配不到），真正起作用的是文本那条。

## 4. 详情页的回复：没有 `socialContext`，也没有「回复」文案

三条详情页里，会话区共 35 条推文：

| 项 | 实测 |
|---|---|
| `div[data-testid="socialContext"]` | **0 个** |
| 回复里含 `Replying to` / `回复` 的文本 | **无** |
| `div[data-testid="quoteTweet"]` | 0（本轮没碰到引用推文） |
| `div[data-testid="tweet-thread-indicator"]` | 0 |

所以 `getReplyingToHandle` 在详情页里对回复**只能返回 null**：容器不在，文案也不在，
末级兜底连 notice 都匹配不到。结论：

- 「`socialContext` 容器稳定」这条只对**时间线**成立过；**详情页会话区实测没有**。
- 详情页的线程合并只能靠作者一致 + 时间邻近 + snowflake 顺序那三条规则，
  回复对象的否决（`isThreadConnectedPair` 第 4 步）在那里不会触发。
- 清单第 7 条的问题因此有了答案：容器不是每次都出现。

## 5. 没采到什么（下一轮要补）

| 场景 | 为什么没采到 |
|---|---|
| 引用推文（含「引用里有没有 `div[role="group"]`」） | 本轮时间线/搜索/详情页都没出现引用推文 |
| 转发（retweet）的 `socialContext` 形态 | 同上，没碰到转发 |
| 推文串（≥3 条同作者） | 详情页未见 `tweet-thread-indicator`，也没碰到独立串 |
| 图 + GIF 并排 | 需要一个混合媒体帖 |
| 社区笔记 / 订阅者限定 / 不可见推文 | 需要特定帖子 |

> GIF 徽标本体已采到（见 §3）；视频点开后 `video[loop=false]`、无徽标，两种形态都拿到了。
