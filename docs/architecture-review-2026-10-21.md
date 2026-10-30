# 架构深挖评审：八个候选的结论

> **状态：已实施。** 五个 commit 落地（`1f4d62c` 代码 / `2914c01` 构建接线 / `2afb5ac` 文档 /
> `9182fbc` 画幅下限 / `7d89a6d` CI）。本文记录的是**决定怎么做的理由**，不是当前实现的样子——
> 实现是什么，代码与 `GLOSSARY.md` 说。
>
> **这份文档的用处是省下重复的查证。** 八个候选里有三个的**原方案经过查证后不成立**，
> 而查证过程本身是这里最值钱的部分：下一个人若再做一次架构评审，不必把同样的探针再写一遍。
> 每个「查证后发现」都附了证据所在的位置。

评审日期：2026-10-21。范围：`src/` 全量 + `tests/`。

> **2026-10-29 追加**：「有理由的行为变更」之后的「单条推文的作者隐私」一节是之后落地的功能，
> 记录同一类东西（为什么这样做、哪些做法已经查证过不成立）。上面的日期与范围只描述 10-21 那一轮。

## 怎么读

| 你想知道 | 看哪一节 |
|---|---|
| 哪些方向已经被查证过、不要再试 | 「查证后不成立」 |
| 每个模块现在归谁管 | 「落地的归属」 |
| 为什么有两处行为变了 | 「有理由的行为变更」 |
| 真浏览器怎么验 | 「验证」 |

## 起点：找热区

`git log -30` 定出改动最频繁的文件：`Card.tsx`（12 次）、`Controls.tsx`（9）、`App.tsx`（8）、
`themes.ts`（7）、`i18n.ts`（7）、`parse.ts`（5）、`extractor.ts`（4）、`export.ts`（4）、
`card.css`（6）、`modal.css`（8）。八个候选都从这些文件里长出来。

## 落地的归属

| 模块 | 位置 | 它现在是什么的唯一答案 |
|---|---|---|
| Thread Session | `src/content/threadSession.ts` | 卡片现在显示哪几条、串是关于哪条的、还能不能再排除一条 |
| 几何 | `src/content/ui/geometry.ts` | 卡片宽度、画幅下限、网格的首屏权重、装裱、面板断点 |
| 选项 | `src/content/ui/options.ts` | 每个选项可以是什么、没存过时是什么 |
| 归属 | `src/content/adapter/ownership.ts` | 这个元素属于主帖、引用帖，还是 Article 的哪一部分 |
| 弹窗文案 | `src/content/popupCopy.ts` | 弹窗自己的话（与弹窗的界面语言不是同一份） |

## 查证后不成立

这一节是本文存在的理由。三个候选的报告描述与实际不符。

### C2：两条通道的「重复」不是同一份实现写了两遍

**报告说**：作者、rich token、互动数据、Article、媒体、引用层、时间戳、链接——八个概念各有两份
实现，收拢它们能拿到一份真正的单一实现。

**实际**：那些是**同一个输出由两套算法各自推导**。作者：一条从 DOM 的 `<a href>` 推 handle，
一条从 JSON 的 `core.screen_name` 读。富文本 token：一条从 `<a>` 元素重建，一条从 entity 的
`indices` 区间重建。算法不同，输入不同，把它们收进一个共同表示要**增加一层**而不是深化一层。

而且收拢了也消不掉真正的不一致 —— 引用链的深度差是 **X 的 payload 形状**决定的
（`docs/observed-dom-2026-10-14-nested-quote.md` 记了 `deeper=false`），不是实现造成的。

**改成了什么**：把 GraphQL 通道的 interface 做深。`parseError` 原本是一根字符串，四种失败原因
挤在里面、调用方只能比字面量；现在是可区分的判别（`GraphQLParseFailure`），并且失败原因被记进
`diagnostics.graphqlMiss`。

**为什么值得**：`PROJECT.md` 写着「空结果集视为失败而非成功……若把空当成功，接口轮换将无法被
发现」——**在此之前那是做不到的**，失败原因没人读。现在 `no-tweets` 上涨就是轮换已发生的证据。
这个承诺的兑现与「收拢重复」无关，与「失败能不能被看见」有关。

### C3：Signature 的两份几何不是重复

**报告说**：`themePreview` 的缩略图与 `card.css` 画在卡片上的签名装饰，几何各写一份，应该收拢。

**实际**：缩略图是 **34px** 的缩略，卡片是 **640px** 的纸。三个圆点画成卡片上的尺寸（4.5px）
在 34px 里放不下；两者本来就该不同，那是「缩小」的定义。

**改成了什么**：Signature 保持现状。几何（宽度、画幅下限、网格权重、装裱、断点）收进
`geometry.ts`，CSS 通过自定义属性消费，网格规划器从同一组权重**推导**而不是手写推导结果。

**顺带说明**：签名装饰的「重复」是外观上的相似，两处都不是真值 —— 真正的真值是主题 token 里的
`signature.style` 与 `signature.height`，两处各自把它画成自己那个尺度上的形状。

### C5：`fetchImageAsBase64` 不是为测试存在的窄接口

**报告说**：`export.ts` 导出 26 项，「一半是给测试用的窄接口」，点名 `fetchImageAsBase64` 与
`replaceCardImagesWithBase64`。

**实际**：`fetchImageAsBase64` 是**生产路径的一部分**（`export.ts` 的 rasterizer `fetchFn` 用它）。
它自己的注释就写着「the rest of the engine **and its tests**」。真正为测试存在的只有
`replaceCardImagesWithBase64` 一个。

**改成了什么**：删掉 `replaceCardImagesWithBase64`（生产不用）；`fetchImageAsBase64` 的
`fallbackToPlaceholder` 参数生产只用一种模式，收窄成单一语义。测试改打那个区分成败的接口。

**一个必须量的东西**：删掉包装之后，生产的 `fetchFn` 要自己处理「失败」与「blob URL」两种情况。
改动前后必须逐输入对比输出 —— 探针量了 5 个输入（远程图、data URL、blob URL、空串、无 proxy），
0 处分歧。**这类改动的等价性不能靠读代码确认。**

### 单条推文的作者隐私：全局开关成了默认值

`blurAuthor` 从「全卡开关」变成「每条推文的默认」。每条可以单独覆盖，头像就是那条推文的开关。

六个决定值得记下来，它们都不是从代码能读出来的：

**「清理覆盖」与「恢复全部跟随」是两套规则，不能合一。** 点击写的是「当前可见状态的反面」，
所以关掉全局开关之后，已有覆盖在视觉上等于被清掉——这是安全的，因为它们本来都显示着。
但提示条的「跟随全局」按的是**开关自己的值**（`visible = blurAuthor`），不是屏幕上的状态。
两者合一就会在开关为「开」时，把卡片一条条刷成清晰，正好和按钮名字相反。

**引用作者第 2 层不可点。** 卡片画两层引用（`QUOTE_LEVELS = 2`）。第 1 层的作者是这条推文
引用的那个人，有它自己的位置，可以单独改；第 2 层的作者既不是这条推文的作者，也没有自己的位置，
所以只跟随全局。用户 2026-10-28 明确接受了这一点。引用作者的覆盖也**只活在本次打开期间**：
引用推文没有 id，按位置存会串到别的线程。

**开关按钮就是作者块本身，所以它保留 `is-blurred`——但包装层不能有。** 计划原本打算在头像外面套一个
`<button class="author-privacy-toggle is-hidden|is-visible">`，那个写法有两个坑，都实测过：
带 `data-html2canvas-ignore` 的按钮会把里面的头像从产物里一起删掉；而独立包装层若带 `is-blurred`，
就违反了「每个带 `is-blurred` 的元素都必须是作者块」这条断言。现在的做法是让**头像元素本身**成为按钮
（保留 `author-avatar` / `author-avatar-img` 等既有 class，模糊仍由它们与 `.author-avatar.is-blurred img`
承担），于是它天然就是作者块，带 `is-blurred` 是正确而不是僭越；状态另外由 `aria-pressed` 表达，
`is-hidden` / `is-visible` 这两个没有任何样式读取的 class 已经删掉。

按钮的重置写在 `.author-privacy-toggle` 上，**不是** `.author-avatar.author-privacy-toggle`：引用作者那张
20px 头像也会成为按钮，而它没有 `.author-avatar`，只写主头像的选择器会让它带着 UA 按钮的 2px 描边与
`ButtonFace` 底色进到产物里。引用按钮另有一条 `background: transparent`——它没有 `.author-avatar`
的凹色可以继承，UA 面色会在头像周围露出来。

**`zoom: 1` 留着，但探针没能证明它必需。** 计划里的假设是：模糊元素被 `overflow: hidden`
的祖先裁切、又叠上非降级属性时，Chrome 会静默放弃模糊。`dev/verify-motion.mjs` 新增的探针量的是
头像那一块屏幕像素（截图后在页面里解码，比相邻像素差）——它证明模糊**真的画到了屏幕上**，
把 `filter: blur(6px)` 拿掉会变红；但把这行 `zoom: 1` 拿掉，本机 headless Chrome 的读数没有变化。
所以它是留着的一条便宜保险，不是被验证过的必需品；哪个真浏览器上它开始有用了，这个探针会先告警。

**导出画的是「糊脸」，不是「没有脸」——原计划的 `visibility: hidden` 是错的。**
导出的产物是克隆 DOM 再光栅化，`modern-screenshot@4.7.0` 的 `copyCssStyles` 会复制全部计算样式
（`ignoredStyles` 只有 `width` / `height` / `-webkit-text-fill-color`，不含 `filter`），所以预览里的
`filter: blur(6px)` 会跟着进克隆并被画出来——和全局 `blurAuthor` 一直以来的行为一致。
按「隐藏就从克隆里删掉」实现会有两个后果，都实测过：预览是一张糊脸、导出是一块空白，而名字和
handle 还在；`data-author-blur` 那套 `render.filter` 也因此整个删掉了。

同一个错还有另一面：**任何带 `data-html2canvas-ignore` 的节点都会连同内容从克隆里消失**。把头像
包进一个带该属性的按钮，等于让这张脸从每一次导出里消失（引用作者的头像就是这么丢的）。
所以开关按钮就是头像元素本身，而且**不带** ignore：ignore 只落在真正的预览装饰上（图片等待块、
卡片右上角的剔除按钮）。

**头像上不放「已隐藏」标记。** 一度加过一个叠在头像上的眼睛图标，实际效果是坏的：头像为了圆形必须
`overflow: hidden`，标记放在轮廓外就被裁掉一半（看起来像被咬了一口的洞），放在里面又盖住脸，而在
引用面板 20px 的头像上根本读不出来。它本来也不进产物（在 ignore 节点里），所以删掉它等于让预览回到
产物本身。状态由三处承担：模糊的脸本身、按钮的 `aria-pressed`、面板隐私分组里那一行。

**顺带一个坑（已修）**：提示条一开始放在 `.modal-body` 里，而 body 是「预览 + 面板」的两栏 flex row，
于是它成了第三栏，把预览挤到 193px 宽，`fit` 从此完全由宽度决定、不再随卡片高度变化。
探针的「卡片重新适配」一项立刻抓到了。现在它是 dialog 的直接子元素（header 与 body 之间）。

## 有理由的行为变更

两处。其余全部零行为变更。
### 圆角的非法值从 `'12px'` 改成 `'theme'`

存储里存了读不出来的圆角值时，回落成一个**具体的**圆角，等于替用户做了选择；回落到「跟随材质」
是把它交还给材质自己的设计。

代价：`prefs.ts` 里那个 `??` 补丁消失了（它存在的原因就是 `sanitizeRadius` 答 `'12px'` 而出厂默认是
`'theme'` —— 两者不一致，只有这一个字段需要特殊对待）。现在**缺失与非法是同一件事**，都答出厂默认。

### 3:4 画幅下限一度从 `853px` 变成 `853.333px`

`calc()` 比 `round()` 精确，但卡片是**图片**，它的高度是从光栅里读回来的，0.33px 就是 0.33px。

已改回整像素。CSS 侧的兜底规则用 `round()`（Baseline 2024：Chrome 125 / Firefox 118 /
Safari 17.2），与 TS 侧算出同一个数。

**教训**：`calc()` 在 CSS 里比在 TypeScript 里更「准」，但**准不等于对** —— 这里的「对」是
逐像素不变。

## 查证过程中发现的真问题

这三处不是候选，是查证时撞见的。

**`aspectRatio` 从来没被校验过。** 它是 `CardConfig` 的必填字段，`prefs.ts` 的
`...DEFAULT_CARD_CONFIG, ...saved` 让存储里的垃圾值直接进 `data-ratio`，而
`aspectMinHeight` 里 `POSTER_RATIOS[ratio]` 对未知值返回 `undefined` ——
`calc(640px * undefined / undefined)` 上卡片。现在走 `optionValue` 校验，几何模块也有兜底。

**`popup.html` 的中文与 `popup.js` 的 `COPY` 表可以不一致。** 脚本每次都用表里的值覆写标记，
所以不一致时用户会看到一句话闪一下。**没有任何测试守这个** —— `hygiene.2`/`hygiene.3` 守的是
存储键与 locale 列表，不是文案本身。现在有 `hygiene.4` 比对文字。

**tier1 的 `flushEffects` 等 60ms，而「挂载 → 存储配置生效」实测要 78–104ms。** 它只覆盖了一次
Preact flush（35ms），但这条路径需要两次（挂载 effect → 存储回来 → 状态更新 → 再 flush）。
余量是**负的 44ms**，所以测试会偶发红。已改成 150ms。

**顺带一提**：`tier1` 那个偶发红第一次出现时，我去查了而不是直接加长等待 —— 探针量出真实的
78–104ms 之后才改。**加长等待能让症状消失，但只有量过才知道是不是修对了。**

## 验证

| 层次 | 手段 | 覆盖什么 |
|---|---|---|
| 单元 | `npm test`（468 项） | 规则本身 |
| 对抗 | `npm run test:tier5`（23 项） | 真实 bundle 里的 Shadow DOM、样式注入、bundle 新鲜度 |
| 真扩展 | `npm run verify:extension` | manifest 解析、MV3 worker 起来、storage 往返、内容脚本在真 x.com 上初始化 |
| **真提取器** | `npm run verify:extractor` | **已构建的 bundle 在真 Chrome 里对真实采集的标记跑一遍，卡片里有没有这篇帖子的原话** |

最后一项是这次新加的。`verify-extension.mjs` 证明扩展装得上、内容脚本起来了，但**证明不了提取器**
—— 未登录的 x.com 整页 0 个 `data-testid`，没有推文标记可读（脚本自己的注释写了这条）。
tiers 读那些标记用的是没有布局引擎的 DOM shim，所以「浏览器排完版才成立」的规则不被任何一层覆盖。

`verify-extractor.mjs` 用本地服务器承载 `tests/fixtures/` 里真实采集的标记（`retweet.ts` /
`nested-quote-preview.ts` / `quote-tweet.ts` / `article-tweet.ts`），把**已构建的 `dist/content.js`**
注入页面，点开卡片看正文。**不碰 x.com**，所以能 headless 跑，CI 上也就跑得动。

真浏览器里量到的卡片正文（转发帖）：

```
转发自@shirolinhime  Devin Developers @devindevelopers
翻译自英语
两年零326天来不断向@cognition 请求把旧版导出器的预设补齐。
#pleaseexport
2 · 04:07 · 93.9万
```

转发识别、翻译通知、正文、富文本 token、统计、构建戳，六项同时正确 —— 而它们正好是这轮改过
的路径（`ownership.ts` 的归属、`extractor.ts` 的判定、`thread.ts` 的续接）。

**顺带一个答案**：那份夹具里有 5 篇文章，但只有 4 个触发按钮。两个「没有」都是对的 ——
Article 正文里嵌入的推文有自己的操作栏，但那是别人的帖子；Article 的阅读面
（`article[twitterArticleReadView]`）是 `<article>`，但它不是一条推文。这正是 `ownership.ts`
要表达的边界。

## 方法：探针

三次「查证后不成立」都是探针查出来的，不是读代码看出来的。三种探针：

| 探针 | 问什么 | 例 |
|---|---|---|
| 逐元素对比 | 新旧实现在每个元素上给同一个答案吗 | 归属模块：218 个元素，24 → 2 → 1 处分歧 |
| 输入对比 | 新旧实现在每个输入上给同一个答案吗 | export 的 `fetchFn`：5 个输入，0 处分歧 |
| 计时 | 这条路径实际要多久 | `flushEffects`：78–104ms，而等待是 60ms |

**归属模块那 24 处分歧里有一处是真 bug**：我最初把 Article 做成 `'none' | 'read-view' | 'body'`
的三选一枚举，但正文**在**阅读面**里** —— 是嵌套不是并列。探针抓到之后才发现。

**写探针的顺序**：先录基线（旧实现在所有输入上的输出），再改，再逐点对比。**不是改完跑测试看绿不绿**
—— 测试覆盖不到的输入，正是探针存在的理由。

## 没有做的事

**没有把 8 个候选做成 8 个 commit。** C1/C3/C4 改同一批文件（`App.tsx`/`Card.tsx`/`Controls.tsx`），
C6/C7 都动 adapter，逐 hunk 切要对这些共享文件做手术，而它们互相咬合 —— 单独回滚任何一个都可能
留下不一致的中间态。实际切成 5 个 commit：代码 / 构建接线 / 文档 / 画幅下限 / CI。

**没有动 Signature。** 见上。

**没有把两条通道收进一个共同表示。** 见上。

**没有把 `verify:extractor` 加进 `npm test`。** 它要真浏览器，是一条独立的门禁。
