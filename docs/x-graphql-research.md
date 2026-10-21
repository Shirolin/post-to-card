# X (Twitter) GraphQL 拦截方案调研报告

> **状态：结论已采纳。** `src/content/graphql/hook.ts` 只按 URL 里的 `operationName` 匹配，
> `queryId` 仅作诊断记录——正是本文 §0 的第 1 条，理由也照抄在那里。
> `docs/x-query-ids-*.json` 是**采样快照**（文件名自带日期），只作证据链：queryId 会轮换，
> 禁止当常量用，要现成的值请对接本文 §1.1 的每日真值源。
>
> **§6.5 的诊断埋点已落地，但比本文建议的更细。** 本文建议的 `parseError?: string` 是一根
> 字符串，四种失败原因挤在里面、调用方只能比字面量；实现改成了可区分的判别
> （`GraphQLParseFailure`），并由 `resolver.ts` 记进 `diagnostics.graphqlMiss`，
> 字段与含义见 `PROJECT.md` 的 Data Channels。§6.4「不要让 GraphQL 静默失败」这条
> 因此现在真的成立：轮换后的端点（零推文）会以 `no-tweets` 报出来，而不是无声无息。
> 本文 §6.5 其余字段（`featureCount`、`bundleOrPayloadBytes`、`degradedAt`）仍未实现。

> 调研日期：**2026-10-02**
> 目标：评估「拦截 X 自己的 GraphQL 响应」替代纯 DOM 解析的可行性，重点是 queryId 轮换风险。

---

## 0. 先说结论

1. **不要硬编码 queryId。** 社区已有成熟做法：只从请求 URL 里取 `operationName`，queryId 根本不参与匹配。
   `prinsss/twitter-web-exporter`（最后提交 2026-08-31，v1.4.3）全部 17+ 个模块**无一例外**用 operationName 正则匹配。
2. **你不需要自己处理认证和 features。** 因为你是 hook 页面自己的请求，可以直接复用页面已经构造好的 `variables` / `features` / `fieldToggles` 和 `x-client-transaction-id`。这些恰恰是社区服务端方案（twscrape / XActions / open-Xdownload）最痛的部分。
3. **轮换比想象的频繁。** `TweetDetail` 在 2025-04 → 2026-09 之间至少有 **5 个不同值**，且在 **2026-09-05 → 2026-09-24 的 19 天窗口内**又轮换了一次。
4. **失效表现是 HTTP 404 + 空 body**，但 404 有至少 5 种不同成因，硬编码方案无法区分。
5. **有现成的每日真值源**：`fa0311/TwitterInternalAPIDocument` 的 `docs/json/GraphQL.json`，机器人每天自动静态分析 x.com bundle 并提交。XActions 直接消费它做 CI 漂移检测。

---

## 1. 当前的 queryId 清单

### 1.1 首选真值源（推荐直接对接）

**`https://github.com/fa0311/TwitterInternalAPIDocument/blob/develop/docs/json/GraphQL.json`**

- 形态：数组，628 条，每条含 `exports.queryId` / `exports.operationName` / `exports.operationType` / `metadata.featureSwitches`（**带 x.com 自己发送的布尔值**）/ `metadata.fieldToggles`
- 更新节奏：机器人每日自动提交。实测提交时间戳：`2026-09-13`、`2026-09-16`、`2026-09-17`×2、`2026-09-19`、`2026-09-24`
- **交叉验证**：`SearchTimeline` = `auLkqtmHqYEpRvflfvLhyQ`，与 `jackwener/opencli-mcp#7`（2026-09-24）在已登录浏览器里独立观测到的 live 值**完全一致** → 该源可信度 **高**
- 消费方：`nirholas/XActions` 的 `scripts/sync-x-endpoints.mjs`

### 1.2 对照表（provenance：**2026-09-24**）

| operationName | queryId | 可信度 |
|---|---|---|
| `TweetDetail` | `zoF7_t363wZyzylk-BLfZQ` | 高 |
| `TweetResultByRestId` | `Xl0tsHf4AzflMRjbw9e70A` | 高 |
| `UserTweets` | `jeAA-59Y9FL7FmjgBNIVPw` | 高 |
| `UserTweetsAndReplies` | `wI-ubAWfScnG6odLK4XgCg` | 高 |
| `UserOriginalsTimeline` | `Yr8749ieoUptxRqQv766Fw` | 高 |
| `UserRepliesTimeline` | `xz348nziCm96wndJ1S0MUQ` | 高 |
| `UserRepostsTimeline` | `CnNg1YiKG7bRgi-RoIfKsw` | 高 |
| `UserMedia` | `TwLiEVUhRjjjKVc98IT0TQ` | 高 |
| `UserPhotoTimeline` | `-7Kl-CfOGxXpmvSvNxuPpA` | 高 |
| `UserVideoTimeline` | `8FjnVm2ZmIymF6l1Tw2fBQ` | 高 |
| `HomeTimeline` | `og4a4SdSF3WiQkkwaPCdPg` | 中（2026-09-05 bundle 里已不在 main，见 §1.4） |
| `HomeLatestTimeline` | `OQPHTgwczzp9RMAPt6BH9A` | 中（同上） |
| `SearchTimeline` | `auLkqtmHqYEpRvflfvLhyQ` | 高（已独立验证） |
| `UserByScreenName` | `KybxDj9RrADIITXlGG8kpw` | 高 |
| `UserByRestId` | `IdmRdjYxIGI39Hdwkwo5cQ` | 高 |
| `ModeratedTimeline` | `kO0Oq6PcLpvQacRyW3LIPw` | 高 |
| `Retweeters` | `uDkA6VZo0_WxiXCKl_7ZTA` | 高 |
| `Bookmarks` | `-dgKZ58Dr9YSJYrcgEb5KA` | 高 |
| `Followers` | `fVGYs5W9kNUuoUrZwYZQpQ` | 中（已迁 POST，见 §2.2） |
| `Following` | `-Mn4uN7C-vxXBwUKtSwS6A` | 中 |
| `ListLatestTweetsTimeline` | `qIrerw_1oakhehcLoFbaOw` | 中 |
| `CommunityTweetsTimeline` | `VgO2y9wXrpUPlzZmfHtKKA` | 中 |
| `UserHighlightsTweets` | `TtovDhtuqVtzzfZ9fpztlw` | 中 |

### 1.3 「查不到」的部分

- **`TweetThread` / 独立 conversation operation：不存在。** 遍历该 628 条全量清单，与 `Thread`/`Conversation` 相关的只有 `TweetDetail`、`ConversationControlChange`、`ConversationControlDelete`、`UnmentionUserFromConversation`、以及 Grok 的一系列。**thread 只能从 `TweetDetail` 拿。** 可信度 高。
- **`TweetPreview`：已不存在**（该源中 ABSENT）。
- **游客 token 走 GraphQL 的可行性：查不到 2025–2026 年可行证据**，详见 §3.2。

### 1.4 我自己做的独立提取（用于验证方法可靠性）

从 X 生产 bundle 直接 grep，方法与 ghostget 生产代码一致：

```
/queryId:"([A-Za-z0-9_\-]{8,128})",operationName:"([A-Za-z][A-Za-z0-9_]{1,127})",operationType:"(query|mutation)",metadata:\{featureSwitches:\[([^\]]*)\],fieldToggles:\[([^\]]*)\]\}/g
```

| bundle | Last-Modified | TweetDetail | SearchTimeline | UserTweets |
|---|---|---|---|---|
| `main.69383b5a.js` | 2026-03-25 | `CysGzLIZa76UzZ3WTe-Bhg` | `GcXk9vN_d1jUfHNqLacXQA` | `FOlovQsiHGDls3c0Q_HaSQ` |
| `main.dd6a5b6a.js` | 2026-08-19 | `XMOz5h24KAZ86qKffKTLdQ` | `hyPfJYJ_XAtDYoslQc-Rgg` | `SXVCYB8XHSS25nzIljNtZA` |
| `main.15e48250ae23af9ea.js` | 2026-08-22 | 同上 | 同上 | 同上 |
| `main.868c69e3a403a8bda.js` | 2026-08-28 | 同上 | 同上 | 同上 |
| `main.7de7adccd6c7c8f0a.js` | 2026-08-30 | 同上 | 同上 | 同上 |
| `main.ae82e9d02d3328bba.js` | 2026-09-05 | 同上 | 同上 | `eviprbEPLvNG88V3smUngQ` |

**方法可靠性已被独立验证**：`main.69383b5a.js`（Last-Modified 2026-03-25）里我提取出的 `SearchTimeline` = `GcXk9vN_d1jUfHNqLacXQA`，与 `epiral/bb-sites#36`（2026-03-26 提交）声称的当前值**完全一致**。

**重要技术细节**：
- 老 bundle（2026-03）main.js 里有 161 个 operation；新 bundle（2026-08 起）只有 104 个，且 `HomeTimeline` / `HomeLatestTimeline` / `Bookmarks` / `Retweeters` / `ListLatestTweetsTimeline` / `TweetPreview` **已不在 main.js**（移到懒加载 chunk 或被移除）。
  → **只扫 main.js 会漏。** `TweetDetail` / `TweetResultByRestId` / `UserTweets` / `SearchTimeline` / `UserByScreenName` 仍在 main.js 内。
- chunk hash 长度会变：`{name}.{7hex}a.js` → `{name}.{16hex}a.js`（`vladkens/twscrape#327`，2026-08-24）。写死长度会炸。
- **匿名请求拿到的是 Vite 登出包**（`/x-web/x-web/entry-client-logged-out-*.js`），**登录会话才拿 legacy webpack 包**（`/responsive-web/client-web/`）。这是我从站外只能取到 2026-03 bundle 的原因。

### 1.5 已过期的值（**不要用**）

以下都是社区源码里现存的硬编码值，**全部已失效**，列出仅为让你认出它们：

| 来源 | 项目最后更新 | 值 | 状态 |
|---|---|---|---|
| twitter-web-exporter 注释（2025-04-03 提交） | 2026-08-31 | `TweetDetail` = `8sK2MBRZY9z-fgmdNpR3LA` | 已过期 |
| twitter-web-exporter 注释 | 2026-08-31 | `SearchTimeline` = `Aj1nGkALq99Xg3XI0OZBtw` | 已过期 |
| twitter-web-exporter 注释 | 2026-08-31 | `UserByScreenName` = `BQ6xjFU6Mgm-WhEP3OiT9w` | 已过期 |
| Twitter Media Downloader（greasyfork 503354 v2.2） | 脚本内含 2025-12 日期样例 | `TweetResultByRestId` = `zAz9764BcLZOJ0JU2wrd1A` | 已过期 |
| open-Xdownload / twitter_media_downloader_pro | 2026-08/09 | `Following` = `7FEKOPNAvxWASt6v9gfCXw`、`UserByScreenName` = `xmU6X_CKVnQ5lSrCbAmJsg`、`UserMedia` = `MOLbHrtk8Ovu7DUNOLcXiA` | 已过期 |

> 注：twitter-web-exporter 的 `# Retired 2026/08` 标记（如 `UserTweets` / `UserMedia`）指的是**它自己的模块不再监听该 operation**（X 前端不再调用），**不代表 operation 已从 bundle 消失**——`UserTweets` 在 2026-09-24 的全量清单里仍然存在。

---

## 2. 轮换规律

### 2.1 频率（有据可查的实测值）

**`TweetDetail` 谱系（≥5 个值）：**

| queryId | 观测时间 | 来源 |
|---|---|---|
| `8sK2MBRZY9z-fgmdNpR3LA` | ≤2025-04-03 | twe commit `5a50bc6` |
| `CysGzLIZa76UzZ3WTe-Bhg` | 2026-03-25 | 本人提取 bundle |
| `B3ZxDiQ__9OXTkCCuAp79w` | 2026-05-04 | `guitaripod/unrager#7` 漂移报告 |
| `XMOz5h24KAZ86qKffKTLdQ` | 2026-08-19 → 2026-09-05 | 本人提取 5 个连续 bundle |
| `zoF7_t363wZyzylk-BLfZQ` | 2026-09-24 | fa0311 每日源 |

**`SearchTimeline` 谱系（≥6 个值）：**
`XN_HccZ9SU-miQVvwTAlFQ` → `BqWLX1Tjvgh6eSZWEMH_kw`（2026-05-04）→ `hz_94eVAtrtQo_vO3my7Rw`（7月）→ `Bcw3RzK-PatNAmbnw54hFw`（≤2026-08-26）→ `hyPfJYJ_XAtDYoslQc-Rgg`（2026-08-19→09-05）→ `auLkqtmHqYEpRvflfvLhyQ`（2026-09-24）

**结论：**
- 你说的「至少有 4 个历史值」是**保守估计**；实测 SearchTimeline 有 ≥6 个、TweetDetail 有 ≥5 个。
- **单个 operation 大致每 1–3 个月轮换一次**，但不是每次 X 部署都轮换。实测 `TweetDetail` 在 2026-08-19 → 2026-09-05 期间跨 **5 次部署**值没变；而 2026-09-05 → 09-24 的 **19 天内**变了一次。
- 社区口述值「每 2-4 周轮换」（`epiral/bb-sites#36` 的讨论）—— **可信度 中**，属个别观察，我未找到成体系的实测统计。
- operation 还可能**整体消失**：`unrager#7` 记录 `Favoriters` / `NotificationsTimeline` 变成 MISSING；`TweetPreview` 现在已 ABSENT。

### 2.2 失效表现 —— 404 有 5 种成因

**主信号：HTTP 404 + 空 body。** 但 404 **不唯一指向 queryId 过期**：

| # | 成因 | 证据 |
|---|---|---|
| 1 | queryId 过期 | `epiral/bb-sites#36`：`oKkjeoNFNQN7IeK7AHYc0A` → 404 |
| 2 | **该 operation 已从 GET 迁到 POST** | `nirholas/XActions#42`（2026-08-20）：SearchTimeline / Followers 用 GET 一律 404（空 body），同一 queryId 换 POST + `{variables, features, queryId}` body 就 200。附 curl 复现表 |
| 3 | **多传了 `fieldToggles`** | `MEOMcGill/xscrape#2`（2026-08-26）：SearchTimeline 带 fieldToggles → 404；移除 → 200 |
| 4 | **缺 `x-client-transaction-id`** | 同上：「same URL, no transaction id → 404」 |
| 5 | 账号健康度（与请求形状无关） | 同上：同一字节请求，12 个账号里 3 个 404、9 个 200 |

**其他状态码：**
- **400 + JSON**：`"The following features cannot be null: a, b, c"` —— X 新增了必需 feature flag。这是**可自愈**的（Twitter Media Downloader 有现成实现：解析这句话、把缺失 flag 补成 `false` 重试一次）。
- **403**：WAF / 限流 / 会话问题，**不是 queryId 信号**。`open-Xdownload` 把 401/403 当作「凭证失效，冷却 30 分钟」；把 429 和 5xx 当作瞬时错误重试。

**最危险的失效模式：静默。** `xscrape#2` 原文：404 被 `_gql_items` 用一句 `return` 吞掉，**死掉的 endpoint 被报告成「空结果集」**——下游一次 72 个单元的抓取报告 `succeeded: 72, failed: 0, total_tweets: 0`。

### 2.3 「发现 → 修复」完整流程（有 3 个可抄的先例）

**A. `hraness/ghostget`（最严格，fail-closed）** — `src/providers/x-web-runtime.ts`
- `parseXWebBundleDescriptors()` 用 §1.4 的正则解析当前 bundle
- `descriptorEvidence(operationName, type)` 要求 evidence 快照里**恰好 1 条**匹配，否则抛错
- `resolveUniqueXWebBundleDescriptor()` 要求当前 bundle 里该 `operationName:type` **恰好 1 条**匹配，否则 `readFailureProjection("contract-drift")`
- `retryDisposition: "do-not-retry"` —— 判定为漂移就**不重试**，直接失败
- 每次更新都作为「revision evidence」单独提交 issue（#102 / #127 / #173），记录 `sourceChunk` 与 `observedOn`
- 明确写了 **"There is no DOM fallback."**

**B. `guitaripod/unrager`（CI 巡检）** — `src/gql/query_ids.rs`
- 每周 `query-ids-watch` workflow，抓当前 bundle 与 `FALLBACK_QUERY_IDS` 比对
- 退出码：`1` = 有轮换/缺失，`2` = scraper 本身坏了
- 自动生成 ROTATED / MISSING 报告，附「下一步」清单（改哪几个文件、发哪个版本）

**C. `nirholas/XActions`（消费每日源 + CI 卡口）** — `scripts/sync-x-endpoints.mjs`
- 从 `fa0311/TwitterInternalAPIDocument@develop` 拉 `docs/json/GraphQL.json`，生成 `src/scrapers/twitter/http/x-endpoints.generated.js`
- `--check` 模式：表过期则退出码 1（可直接挂 CI 门禁）
- 记录上游 commit sha 与时间戳做 provenance
- `copilot-instructions.md` 里明文写着：**"Do not pin GraphQL query IDs. They are discovered from x.com's own bundles"**

---

## 3. 认证与必需参数

### 3.1 必需 header（服务端方案视角）

| header | 值 | 必需性 |
|---|---|---|
| `authorization` | `Bearer AAAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA` | 必需（web bearer，公开常量） |
| `cookie` | `auth_token=…; ct0=…` | **必需** |
| `x-csrf-token` | = `ct0` cookie 值 | 必需 |
| `x-client-transaction-id` | 由 main bundle 里的 lazy webpack 模块生成 | **现在必需，缺则 404** |
| `x-twitter-active-user` | `yes` | 惯例 |
| `x-twitter-auth-type` | `OAuth2Session` | 惯例 |
| `content-type` | `application/json` | POST 时必需 |
| `User-Agent` | 真实 Chrome UA | 必需（否则 Cloudflare 挑战壳，见 `twscrape#330`） |

**Web bearer token 我已实测可用**：用它在 `POST https://api.x.com/1.1/guest/activate.json` 拿到 HTTP 200 + `guest_token`（2026-10-02）。注意 `%3D` 是 URL 编码的 `=`，原样放进 header 也能工作（open-Xdownload 就是这么写的）。

### 3.2 游客 token：**实测不可用于 GraphQL**

- guest token 本身能拿到（我刚验证过）
- 但 `open-Xdownload`（2026-09 更新）**硬性要求** `auth_token` + `ct0`：`"需要先配置 auth_token 和 ct0 才能调用 X GraphQL"`；其 README 写明匿名调用会 403。
- Twitter Media Downloader 用 `credentials: 'include'`，实际也是走登录 cookie。
- **结论：2025–2026 年「纯游客 token 调 GraphQL」我查不到任何可行证据。** 可信度 中（基于两个活跃项目的显式要求 + 匿名 403 的普遍报告）。
- **对你的场景这条不重要** —— 你是页内 hook，用页面自己的 cookie 和 header。

### 3.3 `features` / `fieldToggles`

- **现在每个 timeline 类 operation 约 39–40 个 feature switch + 8 个 field toggle**；`UserByScreenName` 12+2，`UserByRestId` 10+2。
- **缺失 → HTTP 400**，`"The following features cannot be null: …"`，可解析自愈（Twitter Media Downloader 的 `api_parseMissingFeatureNames` + 重试）。
- **多传 → 有时容忍，有时 404**（xscrape#2 的 fieldToggles 案例）。
- 值不重要：**stale 的 feature 值也能 200**（xscrape#2 实测「新 op id + 移除 fieldToggles + stale features → 200，19 条推文」）。
- **有项目把参数结构化管理起来了**：`fa0311` 的 `GraphQL.json` 里 `metadata.featureSwitch.<name>.value` 就是 x.com 自己发的值；XActions / ghostget 都从它生成。

### 3.4 GET vs POST（新增的坑）

`SearchTimeline` 与 `Followers` 已迁 POST（`XActions#42`，2026-08-20 实测）。`UserTweets` 当时仍是 GET（"not all endpoints migrated yet"）。
→ **不要假设 operation 的 HTTP method 恒定。** 页内 hook 天然免疫这个问题。

---

## 4. 可行的兜底策略

| 问题 | 社区答案 | 可信度 |
|---|---|---|
| 有多 operation 互为备份吗？ | 有，但形式是**语义别名**而非备份：`UserTweets` ↔ `UserOriginalsTimeline` / `UserRepliesTimeline` / `UserRepostsTimeline`（X 前端 2026-08 起用后者，前者仍在 bundle 里）。**没有找到「同一数据多 endpoint 兜底」的成熟先例。** | 中 |
| 能用 operationName 之外的特征反查吗？ | **能，而且这是社区主流。** 两条路：(a) 直接从 X 自己的 `abs.twimg.com/responsive-web/client-web/main.*.js` grep；(b) 消费 `fa0311/TwitterInternalAPIDocument` 每日 JSON。 | 高 |
| 有不依赖 queryId 的项目吗？ | **有，且是标杆。** `prinsss/twitter-web-exporter` 全部模块只用 `/\/graphql\/.+\/TweetDetail/` 这类正则从 URL 取 operationName，queryId 只以注释形式存在且**已经过期**（见 §1.5）。 | 高 |
| GraphQL 优先 + DOM 兜底有先例吗？ | **查不到。** ghostget 明写 "There is no DOM fallback."；XActions、twitter-web-exporter、Twitter Media Downloader 都是纯 GraphQL，**没有一个做双通道**。可信度 中（我检查了 7 个 2026 年仍活跃的仓库）。 |

---

## 5. 数据结构（TweetDetail 响应）

依据：`prinsss/twitter-web-exporter` `src/types/tweet.ts` + `src/utils/api.ts`（2026-08-31 代码）+ Twitter Media Downloader v2.2 的独立实现互相印证。

### 5.1 入口路径

```
data.threaded_conversation_with_injections_v2.instructions[]
```
> 注意是 `_v2` 后缀，不是老资料里的 `threaded_conversation_with_injections`。

`instructions[]` 按 `type` 分派：
- `TimelineAddEntries` → `.entries[]`（**可能不存在**，例如加载更多会话时）
- `TimelineAddToModule` → `.moduleItems[]`（懒加载的会话补页，**无 `sortIndex`**）

### 5.2 entry 结构

| 形态 | 判据 | 内容 |
|---|---|---|
| 单条推文 | `entryType === 'TimelineTimelineItem'` 且 `entryId` 以 `tweet-` 开头 | `content.itemContent.__typename === 'TimelineTweet'` |
| thread 模块 | `entryType === 'TimelineTimelineModule'` 且 `entryId` 以 `conversationthread-` 开头 | `content.items[]`，每项 `entryId` 含 `-tweet-` |
| 分页游标 | `entryId` = `conversationthread-{id}-cursor-showmore-{cid}` | **必须过滤掉** |

`TimelineTweet` → `itemContent.tweet_results.result`（`result` 可能整个缺失 → 可见性受限）

### 5.3 result 的 4 种 `__typename`

| `__typename` | 含义 | 处理 |
|---|---|---|
| `Tweet` | 正常 | 用 |
| `TweetWithVisibilityResults` | 受限可见 | 取 `.tweet` 再用 |
| `TweetTombstone` | 已删除 / 保护账号（`tombstone.text.text` 有原因文案） | 丢弃 + 记诊断 |
| `TweetUnavailable` | 不可用（如 NSFW） | 丢弃 + 记诊断 |
| （`result` 为 null/undefined） | 受限可见 | 丢弃 + 记诊断 |

### 5.4 最小可用字段路径清单

**推文本体**
| 字段 | 路径 |
|---|---|
| snowflake id | `result.rest_id`（回退 `result.legacy.id_str`） |
| 文本 | `result.note_tweet.note_tweet_results.result.text`（长推文，**优先**）→ 回退 `result.legacy.full_text` |
| 展示范围 | `result.legacy.display_text_range` |
| 创建时间 | `result.legacy.created_at`（Twitter 格式 `Mon Dec 22 19:38:26 +0000 2025`） |
| 作者 | `result.core.user_results.result` |
| 作者 handle | `result.core.user_results.result.core.screen_name` |
| 互动数 | `result.legacy.{reply_count, retweet_count, favorite_count, quote_count, bookmark_count}` |
| 浏览数 | `result.views.count` |
| 来源 | `result.source`（HTML 字符串） |

**媒体** —— `result.legacy.extended_entities.media[]`（回退 `result.legacy.entities.media`）

> `type` 仍是 `photo` / `video` / `animated_gif` **三值**（2026-08 代码 + TMD 独立印证）。可信度 高。

| 类型 | 高清 URL 构造 |
|---|---|
| `photo` | `media_url_https` → `${base}?format=jpg&name=orig`（推荐，twe 的 `formatTwitterImage`）；TMD 直接 `${media_url_https}?name=orig` |
| `video` | `video_info.variants[]` 里筛 `content_type === 'video/mp4'`，取 **`bitrate` 最大**的 `url` |
| `animated_gif` | 同上，但通常只有一个 mp4 variant |

其他：尺寸 `original_info.{width,height}`；alt 文本 `ext_alt_text`；时长 `video_info.duration_millis`。

> **转发推文的坑**：`extractTweetMedia` 里明确注释「Twitter may truncate the media list for retweets」——**取转发时必须先下钻到 `retweeted_status_result.result` 再取媒体**，否则会漏。

**thread 边界**
| 用途 | 路径 |
|---|---|
| 会话 ID | `result.legacy.conversation_id_str` |
| thread 成员 | `conversationthread-*` entry 的 `content.items[]` |
| 懒加载补页 | `TimelineAddToModule.moduleItems[]` |
| 顺序 | entries 带 `sortIndex`，需**降序**排（X 有时返回乱序） |

**回复关系**：`result.legacy.in_reply_to_screen_name` / `result.legacy.in_reply_to_status_id_str` / `in_reply_to_user_id_str`

**转发判定**：**不是独立 entry**，而是嵌套字段
```
result.legacy.retweeted_status_result.result   // 内层又是 TweetUnion
```
内层同样可能是 `TweetWithVisibilityResults`，要递归解包。

**引用推文**：`result.legacy.is_quote_status` 为 true 时，取 `result.quoted_status_result.result`（`TweetUnion`）。**不是独立 entry。**
> 另有一个 `result.quotedRefResult`（只含 `Partial<TweetUnion>`），别混用。

**可见性受限**：见 §5.3 —— **是 `__typename` 层面的 wrapper，不是某字段的布尔标记**。

### 5.5 已发生的新结构变化（务必知道）

- **用户对象的 `legacy` 正在被移除。** twe 的 `api.ts:305-358` 有明确注释「Since the `legacy` object was removed we need to support both the new and old formats」，新路径：
  `profile_bio.description` / `website.url` / `banner.image_url` / `relationship_counts.{followers,following}` / `tweet_counts.{tweets,media_tweets}` / `action_counts.favorites_count`
  → 你的 `AuthorInfo`（name/handle/avatarUrl/verified）需要双路径兼容。
  > 但 **推文的 `legacy` 仍然必需** —— twe 的 `filterEmptyTweet()` 直接 `if (!tweet.legacy) return null`。

- **隐藏回复走另一个 operation**：`ModeratedTimeline`，路径完全不同：
  ```
  data.tweet.result.timeline_response.timeline.instructions[]
  ```

---

## 6. 实施建议

### 6.1 hook 挂在哪

**推荐：`XMLHttpRequest.prototype.open` + `'load'` 监听，与 twitter-web-exporter 完全一致**（`src/core/extensions/manager.ts:113-139`）。

理由与坑：
- X 的 responsive-web 客户端用 XHR 发 GraphQL（这也是社区都 hook XHR 的原因）。
- `open` 拿 URL，`load` 时读 `xhr.responseText` —— 简单、无 body 克隆问题。
- **MV3 隔离世界是最大的坑。** twe 专门检测这点：content script 里查 `unsafeWindow` 上有没有 `webpackChunk_twitter_responsive_web`，没有就报「Wrong execution context detected」。
  → **MV3 正确解法：`manifest.json` 里 content script 声明 `"world": "MAIN"`**（Chrome 111+），而不是注入 `<script>` 标签。
- **保险起见同时 hook `window.fetch`**（未来 X 迁 fetch 你不会静默失效），并对 `Response` 做 `clone()` 再读。
- **必须在任何请求发出前装好 hook**（twe 在 manager 构造时立刻装）。

### 6.2 匹配逻辑（抗轮换的核心）

```ts
// 只认 operationName，绝不认 queryId
const m = /\/i\/api\/graphql\/[^/]+\/([A-Za-z0-9_]+)/.exec(url);
const op = m?.[1];
if (op === 'TweetDetail') { /* ... */ }
```

**顺便白拿参数**：hook 时把 URL 的 `variables` / `features` / `fieldToggles` 一起 parse 下来存档。这样：
- 你不需要维护 features 清单（X 加 flag 你自动跟上）
- 你不需要自己发请求（免疫 GET/POST 迁移、免疫 transaction-id 要求）
- 你可以在诊断里记录「当时用的 queryId + features 指纹」，轮换当天从日志发现

### 6.3 对上 `ThreadData` 的映射

| `ThreadData` / `TweetData` | 来源 |
|---|---|
| `ThreadData.author` | 首条推文的 `core.user_results.result` |
| `ThreadData.tweets[]` | `TimelineAddEntries.entries[]` 里的 `tweet-*` + `conversationthread-*` 的 `content.items[]` + `TimelineAddToModule.moduleItems[]`，**按 `sortIndex` 降序**合并去重（按 `rest_id`） |
| `ThreadData.targetTweetIndex` | entryId 为 `tweet-{当前 URL 里的 id}` 的那条在数组里的下标 |
| `ThreadData.isSingle` | `tweets.length === 1` |
| `TweetData.id` / `.url` | `rest_id` / `https://x.com/{screen_name}/status/{rest_id}` |
| `TweetData.text` | `note_tweet…text` ?? `legacy.full_text` |
| `TweetData.richTokens` | `legacy.entities.{user_mentions,urls,hashtags}` + `display_text_range` 自行切分（比 DOM 遍历准，且不受 X 渲染改版影响） |
| `TweetData.timestamp` | `legacy.created_at` → `new Date(...)` |
| `TweetData.stats` | `legacy.{reply_count,retweet_count,favorite_count}` + `views.count` + `legacy.bookmark_count` |
| `TweetData.media[]` | §5.4，`type` 映射 `photo→image` / `video→video` / `animated_gif→gif` |
| `TweetData.quotePost` | `quoted_status_result.result`（递归解包 `TweetUnion`） |
| **`TweetData.retweetedBy`** | ⚠️ **你现有模型缺这个字段**。`thread.ts:198` 已经在读 `tweetA.retweetedBy` 但类型里没有。GraphQL 侧用 `legacy.retweeted_status_result.result` 判定与取值 —— 顺带把 detection-audit.md 的 P0-13 一起解决 |

**thread 连续性判断可以大幅简化**：`thread.ts` 现在靠 `tweet-thread-indicator` + 文案正则 + snowflake 单调性拼凑。GraphQL 侧有**权威事实**：
- `legacy.conversation_id_str` 相同 → 同会话
- `legacy.in_reply_to_status_id_str` 指向同会话前一条 → 明确的续接
- entry 的 `conversationthread-*` 分组 → X 自己给的边界

这比 DOM 启发式强得多，且不依赖任何混淆类名。

### 6.4 降级设计

**GraphQL 优先 + DOM 兜底 —— 这是本项目该走的路，且社区没有先例（§4），所以你要自己定义清楚判据。**

```
1. 内容脚本启动 → 立即装 XHR + fetch hook
2. 收到 TweetDetail 响应 → parse → 命中则用 GraphQL 数据，标记 _source='graphql'
3. 用户点按钮时：
   a. 若已捕获到当前 URL 对应的 TweetDetail → 直接用
   b. 否则主动发一次 TweetResultByRestId 请求（复用页面 cookie + 页面 header）
   c. 仍失败 / 解析出 0 条 → 回落现有 DOM adapter，标记 _source='dom'
4. 两条通道都产出 ThreadData → 交给同一个校验层
```

**关键：不要让 GraphQL 静默失败**（xscrape#2 的教训）。判据：
- 命中 `TweetTombstone` / `TweetUnavailable` / `result` 缺失 → 记 `tombstone` 计数，**不算成功**
- 解析出 0 条推文 → **不算成功**，必须回落 DOM
- 建议直接照抄 ghostget 的 `retryDisposition: "do-not-retry"` 思路：判定为漂移就别重试，快速降级

### 6.5 诊断埋点（发现轮换用）

你的 `detection-audit.md` P2-15 已经提了 `_diagnostics`，GraphQL 方案让这件事变得**极其容易且可靠**：

```ts
_diagnostics: {
  source: 'graphql' | 'dom',
  operationName: 'TweetDetail',        // 来自 URL，永不失效
  queryId: 'zoF7_t363wZyzylk-BLfZQ',    // 会失效 —— 这正是你要监控的
  featureCount: 39,                     // X 加 flag 时会变
  bundleOrPayloadBytes: 1234567,
  tombstones: 0,
  visibilityLimited: 0,
  parseError?: string,
  degradedAt?: number,                  // 发生降级的时间戳
}
```

监控规则（建议）：
1. `queryId` 变化 → 记录一次轮换事件（自动，无需人工比对）
2. `_source='dom'` 触发率突然升高 → 告警
3. 某 operation 连续 3 次 404 → 告警

### 6.6 维护策略（建议照抄 ghostget）

1. **代码里不写 queryId。** 需要时从 `fa0311/TwitterInternalAPIDocument@develop` 的 `GraphQL.json` 拉，或从当前 bundle grep。
2. **CI 门禁**：`scripts/sync-x-endpoints.mjs --check` 的模式 —— 比对仓库里的快照与每日源的差异，有差异就红。
3. **轮换修复应该是「改一行快照 + 记录 observedOn」**，不是改代码。你的代码里如果出现 queryId 字面量，它就是 bug。
4. 仓库里我已经放了两个产物：
   - `docs/x-query-ids-daily-2026-09-24.json` —— 23 个目标 operation 的 queryId + 完整 feature 值 + fieldToggles（来自每日源，2026-09-24）
   - `docs/x-query-ids-2026-03-25.json` —— 从 X bundle 提取的 161 个 operation 全量（含 featureSwitches 名单）

---

## 7. 明确的「查不到」清单

1. **游客 token 调 GraphQL 的 2025–2026 可行案例** —— 查不到；现有证据指向不可行。
2. **`TweetThread` / 独立 conversation operation** —— 确认不存在（我遍历了 628 条全量清单）。
3. **「GraphQL 优先 + DOM 兜底」的社区先例** —— 查不到；检查的 7 个活跃仓库全是纯 GraphQL。
4. **同一 operation 多 endpoint 互为备份的成熟先例** —— 查不到；只有语义别名。
5. **queryId 轮换的成体系实测统计** —— 查不到；只有个别 issue 的口述值和本次从 bundle 序列观测到的谱系。
6. **2026-09-24 之后的当前值** —— 拿不到。我这台机器的 IP 被 Cloudflare 全量拦截（`x.com/i/api/*`、`api.x.com/*` 一律 403 空 body），**且阴性对照证明 403 无法区分真假 queryId**，所以我没有、也不会声称做过运行时验证。上表所有值都来自 **X 自己的 bundle / 每日静态分析源**，不是运行时探测。