# 实测记录：登录态 X DOM 判据核验

> 采集时间：2026-10-02
> 页面：`https://x.com/Wikipedia/status/1888944671579078978`（已登录，主推文为 GIF + 含引用推文的回复）

## 与未登录态的对比

未登录时整页 **0 个 `data-testid`**（见 `observed-dom-2026-10-02.md` 的前半部分）。
登录后 `data-testid` 大量出现，社区文档所述的结构基本成立。

## 逐项核验

| 判据 | 结果 | 备注 |
|---|---|---|
| `article[data-testid="tweet"]` | ✅ 命中 | 主选择器成立 |
| `div[data-testid="tweetText"]` | ✅ 命中 | 正文判据成立 |
| `div[role="group"]` | ✅ 命中 | 注入挂载点成立，label 含完整互动数据 |
| `article [data-testid="tweetPhoto"] img` | ⚠️ **命中但危险** | 见下 |
| `div[data-testid="videoPlayer"]` | ❌ **不存在** | 容器已改版 |
| `div[data-testid="quoteTweet"]` | ❌ **不存在** | 容器已改版 |
| `button[data-testid="playButton"]` | ✅ 命中 | GIF 播放按钮，aria-label `播放这个 GIF` |

## 三个需要修复的实测发现

### 1. `videoPlayer` 已改版，视频检测靠 `video` 兜底才没失效

`extractVideoMedia` 的选择器是：
```
'div[data-testid="videoPlayer"], div[data-testid="videoComponent"], div[aria-label="Embedded video"], video'
```
前三个在当前版本**均不命中**，只有末位 `video` 兜底生效。
这解释了为何 GIF 仍能被识别——但纯属侥幸，`targetContainer` 退化为整个 article，
使 Strategy D 的作用域收窄失去意义（我上一轮刚加的隔离）。

**稳定信号是 `button[data-testid="playButton"]`** 及其 aria-label（含 `GIF` 字样），
可作为视频/GIF 的可靠判据。

### 2. `tweetPhoto` 容器也包裹 GIF 的 poster 图层

`article [data-testid="tweetPhoto"] img` 命中了一张 `opacity: 0`、`z-index: -1` 的
隐藏 img —— 那是 GIF 的 poster 帧，不是用户上传的照片。

后果：一条**纯 GIF 推文**会被 `extractTweetMedia` 同时当作「1 张照片 + 1 个视频」提取，
渲染出重复内容。这与用户最初报的 bug 同源，只是方向相反。

### 3. `quoteTweet` 已改版，引用推文识别依赖结构回退

`findQuoteContainer` 的主判据失效，实际命中的是第 3 级（嵌套 `article`）或第 4 级
（第二个 `User-Name` + `tweetText` 的结构回退）。功能未失效，但已无主判据保护。

## 尚未核验

- 转发（retweet）帖的实际 `socialContext` 结构 —— 本页主推文非转发，回复区未见转发样本
- `tweet-thread-indicator` 是否存在
- 图 + GIF 混合的真实布局（本页是纯 GIF，混合场景仍需用户那条帖子）

## 建议修复

1. `extractVideoMedia` 增加 `button[data-testid="playButton"]` 作为容器判据，
   使 `targetContainer` 重新收窄到真正的 media 区域
2. `extractTweetMedia` 过滤掉不可见 img（`opacity: 0` 等），避免 GIF poster 被当照片
3. 为 `quoteTweet` 找到新的主判据，或确认结构回退足够并调整优先级说明
