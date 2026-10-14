# 实测记录：嵌套引用推文（quote of a quote）DOM

> 采集日期 2026-10-14，采集时 X 的 `data-app-version` 见下（本轮未记录，属缺漏）。
> **本文所有判据均已被 `tests/fixtures/nested-quote-preview.ts` 锁住**，逐条做过变异测试。
> 采集方式：用户在本人登录的 Chrome 里执行探针脚本取得一条时间线条目的
> `article[data-testid="tweet"]` outerHTML（推文：`/GKev1n/status/2110105649778700290`，
> 内容为 gKev1n 引用 devindevelopers、后者又引用 cognition）。

## 为什么必须重新采

前几轮快照（`observed-dom-2026-10-02*.md`、`-10-09.md`、`-10-10.md`）**全都只采到
 outermost 一级的引用**，所以 `docs/real-dom-sampling-checklist.md` 第 3 条虽然打了勾，
那份样本里的引用本身没有再引用别人。于是代码里所有引用判据都是按「单层引用」写的，
`quoteTweet` 这个 testid 就是那时确立的主判据——**而它在「引用里的引用」这一级上根本不存在**。

本轮是第一次采到两级引用，结论直接推翻了两处既有假设。

## 结构

```
article[data-testid="tweet"]
├─ div[data-testid="tweetText"]                                  ← 主推文正文
└─ div                                                        ← 引用包裹层
   ├─ div > span「引用」                                        ← 「Quoting」标签（本地化文案，不作判据）
   └─ div[role=link][tabindex=0]                               ← 外层引用容器，无 testid
      ├─ div[data-testid="User-Name"]                          ← devindevelopers
      ├─ div > (翻译行 + div[data-testid="tweetText"])          ← 原文是英语，页面显示译文
      └─ div[data-testid="nestedQuotePreview"]                 ← 内层引用容器
         ├─ div > div[data-testid="User-Name"]                  ← cognition
         └─ div
            ├─ a[data-testid="nestedQuotePreviewMedia"] > img   ← 内层引用自己的图！
            └─ div[data-testid="tweetText"]                     ← 被 line-clamp 截断
```

## 逐项核验

| 判据 | 结果 | 备注 |
|---|---|---|
| `div[data-testid="quoteTweet"]` 用于嵌套层 | ❌ **整篇 0 个** | 两级引用都不用这个 testid |
| `div[data-testid="nestedQuotePreview"]` | ✅ 命中，唯一的内层引用标记 | 本轮新发现 |
| `div[data-testid="User-Name"]` | ✅ 每级一个，共 3 个 | 主推文 + 两级引用 |
| `div[data-testid="tweetText"]` | ✅ 每级一个，共 3 个 | |
| `a[data-testid="nestedQuotePreviewMedia"]` | ✅ 命中 | 内层引用的图，**不是 `tweetPhoto`** |
| `div[data-testid="tweetPhoto"]` | ❌ 内层引用里不存在 | 所以走照片扫描那条路完全看不到它 |
| `svg[data-testid="icon-verified"]` | ✅ 每级都有 | 主推文和内层都是金色渐变款 |
| `<time datetime>` | ✅ 外层引用有，内层引用**也有** | 本轮样本三层都有 datetime |
| 内层引用的 permalink | 只有 `…/photo/1` | **没有**指向推文本身的链接 |
| `style="-webkit-line-clamp: N"` | ✅ 两级引用的正文都被截断 | 5 和 2 行 |

## 这里踩到的四个坑（均已修复并加回归用例）

### 1. 内层引用的图走的是另一条媒体通道

`collectPhotoAndVideoMedia` 扫的是 `div[data-testid="tweetPhoto"]`，
而预览形态下内层引用的图是 `a[data-testid="nestedQuotePreviewMedia"] > img`，
**两个节点都不在 `tweetPhoto` 里**。于是内层那条推文的图在卡片上完全消失。
已改为在引用层级上直接读 `nestedQuotePreviewMedia`（`tier2` 2.83）。

### 2. 主推文的 permalink 被内层引用抢走

`findTweetStatusLink` 原来只排除 `div[data-testid="quoteTweet"]` 内部的链接。
本形态下**一个 `quoteTweet` 都没有**，于是文档序第一个 `/status/` 链接——
也就是内层引用那张图的 `/photo/1`——被当成了主推文的链接，
主推文卡片上的 URL 和时间戳链接全都指向别人的相册页。
已改为用与媒体/统计同一套的引用容器边界来排除（`tier2` 2.82）。

### 3. 引用推文的 permalink 不能直接当成推文链接

预览形态下内层引用**唯一的链接就是 `/status/<id>/photo/1`**。
原代码 `href.startsWith('http') ? href : ...` 会原样拼出这个 URL，
卡片上的时间戳就指向了某张照片而非那条推文。已改为从 href 中截取 `/status/<id>`
段（`tier2` 2.84）。

### 4. 夹具本身写坏了，而且坏得很隐蔽

手写这份 fixture 时多打了一个 `</div>`，DOM 树因此塌掉：
`role="group"` 整块丢失、只剩 2 个 `<time>`（应有 4 个）、主推文链接消失。
症状看起来像提取器有 bug，实际是夹具不合规。教训：**fixture 写完后要核对
标签配对**——这次是靠 `<div` 计数（65 开 66 闭）定位到的。测试 DOM 没有
布局引擎，树塌了也不报错，只会静默给出错误结论。

## 与既有判据的关系

- `docs/detection-audit.md` 里「`quoteTweet` 是社区确认可依赖的信号」这句**只对
  outermost 一级成立**，本轮起不再作为嵌套层的判据。
- 结构回退（`findQuoteContainer` 第 3 级：第二个 `User-Name` + `tweetText`）
  在本形态下**仍然有效**，两级引用都能正确定位——这印证了当初保留多级回退的价值。
- `docs/real-dom-sampling-checklist.md` 第 3 条「引用推文」应补充
  「需分别采 outermost 与嵌套两级，两者容器形态不同」。

## 尚未核验

- **更深层（第三级引用）**：本轮只采到两级。`QUOTE_LEVELS = 2` 之外还有什么形态，
  未采到样本；若 X 实际渲染第三级，需补采。
- **timeline 之外的来源**：只从时间线采到一条。详情页/搜索结果的嵌套引用
  容器是否同样用 `nestedQuotePreview`，未验。
- **`nestedQuotePreview` 里如果没有图**（纯文字内层引用）时容器长什么样，未采。
- **`data-app-version`**：本轮忘记记录，无法与前几轮快照的版本对照。
