<!--
  一个 PR 一件事。同时改导出引擎和主题 token 会让回滚变得不安全（CONTRIBUTING.md）。
  下面四行是 review 真正要看的东西，缺哪一行就先补上再提。
-->

## 这个 PR 做了什么

<!-- 一两句话。如果是修 bug，说明修的是哪一类问题、在什么条件下出现。 -->

## 复现步骤或截图

<!-- X 的页面状态很难描述，图比字快。安全相关的复现请走 SECURITY.md 的私密渠道。 -->

## 行为变化

<!-- 有哪些用户可见的变化，以及为什么值得。没有用户可见变化就写「无」。 -->

## 跑过的门禁

- [ ] `pnpm run build`（typecheck + knip + 四个 Vite 入口）
- [ ] `pnpm test`（tier 1–4 与 i18n / graphql / resolver / article / hygiene）
- [ ] `pnpm run test:tier5`（审的是刚 build 出来的 `dist/`，顺序不能倒）

## 新增的判据

<!--
  如果有新的 DOM 选择器或接口假设，附上采集到的标记（一条 article[data-testid="tweet"]
  的 outerHTML），或说明 node dev/verify-extractor.mjs 在本地是通的。
  没有就写「无」。
-->
