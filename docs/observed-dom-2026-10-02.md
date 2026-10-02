# 实测记录：未登录状态下的 X DOM

> 采集时间：2026-10-02
> 采集方式：OpenChamber 浏览器面板，真实 `x.com` 页面
> 页面：`https://x.com/Wikipedia/status/1888944671579078978`（公开推文详情页，**未登录**）

## 结论：未登录状态下 `data-testid` 整体缺失

对同一页面逐个探测，结果如下：

| 选择器 | 命中 | 说明 |
|---|---|---|
| `article` | ✅ 1 个 | 真实路径 `main > div:nth-of-type(1) > article` |
| `article[data-testid="tweet"]` | ❌ 0 | 扩展的主选择器 |
| `article[role="article"]` | ❌ 0 | 第一级 fallback |
| `[data-testid]` | ❌ **0 个** | 整页无任何 data-testid |
| `article [data-testid="User-Name"]` | ❌ 0 | 作者判据 |
| `article [data-testid="tweetText"]` | ❌ 0 | 正文判据 |
| `article div[role="group"]` | ❌ 0 | 注入按钮的挂载点 |
| `video` | ✅ 1 个 | 媒体判据仍可用 |

## 对本项目的直接影响

**1. 未登录状态下 DOM 通道全面失效**，且是**静默**失效——所有选择器返回 null，不抛错。

这验证了社区实测的结论（XActions 文档与调研报告均记载）：`data-testid` 本身就是
「已登录 + 时间线已 hydrate」的信号。

**2. `TWEET_ARTICLE_SELECTOR` 的三级 fallback 在此状态下全部落空：**

```js
'article[data-testid="tweet"]'            // ❌ 无 testid
'article[role="article"]'                 // ❌ 无 role 属性
'[data-testid="cellInnerDiv"] article'    // ❌ 依赖 testid，同样落空
```

实测可用的第四条路径是 `main article`（裸标签）。**这是待修的缺陷。**

**3. 注入按钮在未登录页无法出现**——`div[role="group"]` 不存在，`injectAll` 匹配 0 条。
这解释了为何用户可能觉得「扩展没生效」，而实际是会话状态问题。

**4. GraphQL 通道在此状态下价值显著更高。** 页面仍会发 GraphQL 请求（未登录用 guest token），
拦截不依赖任何 `data-testid`。这是双通道设计的核心收益。

## 尚未验证（需要登录态）

登录态下 `data-testid` 是否如社区文档所载那样完整可用，本次无法确认。以下判据仍未实测：

- `div[data-testid="tweetPhoto"]` / `videoPlayer` / `quoteTweet` / `socialContext`
- `tweet-thread-indicator`
- 转发（retweet）在登录态的实际 DOM 形态
- 引用推文内是否真的存在 `div[role="group"]`（这决定我加的 `isTopLevelActionBar` 是否必要）
- `pic.x.com` 媒体链接在真实推文里的渲染形式

## 建议的修复

`TWEET_ARTICLE_SELECTOR` 补一级不依赖 testid 的结构回退，并按登录态分派策略：

```js
export const TWEET_ARTICLE_SELECTOR = [
  'article[data-testid="tweet"]',       // 登录态主选择器
  'article[role="article"]',            // 部分中间态
  '[data-testid="cellInnerDiv"] article',// 登录态结构回退
  'main article',                       // 未登录态唯一可用路径
].join(', ');
```

同时 `injectAll` 的挂载点也需要在未登录态下的替代选择器（当前 `div[role="group"]` 落空）。
