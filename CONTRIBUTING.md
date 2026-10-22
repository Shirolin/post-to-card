# 为 Post-to-Card 做贡献

谢谢你愿意花时间。这个仓库欢迎 bug 报告、X 页面改版后的适配、主题与文档，
以及任何让卡片更准、更稳、更快的改动。

## 先读这三件事

1. **[AGENTS.md](AGENTS.md)** —— 仓库的门禁链（`build → test → tier5`，顺序不能倒）、
   两个已知的 typecheck 盲区，以及验证提取器 / 扩展的方法。给 agent 看的规矩，
   对人也同样有效：它们说明哪些检查是真的。
2. **[GLOSSARY.md](GLOSSARY.md)** —— 本项目对「卡片 / 画布 / 材质 / 长串 / 导出」等词的
   固定说法。写 issue、写注释、写文档时请沿用。
3. **`src/` 的注释** —— 这个仓库的习惯是把「为什么不是另一种写法」写在代码旁。
   改动前先看那段代码已有的理由，避免重新踩一遍已经被查证过的坑
   （`docs/architecture-review-2026-10-21.md` 记录了几条明确的「不要再试」）。

## 开发环境

- Node.js **24**（CI 用 24；测试直接由 Node 的类型剥离运行 `.ts`）
- pnpm **10**（`pnpm-lock.yaml` 是唯一的锁文件，`pnpm install` 即可）
- Chrome / Chromium 用于可选的真浏览器验证

```bash
pnpm install
pnpm run build      # 必须最先跑：typecheck + lint + 四个 Vite 入口
pnpm test           # tier 1–4 与 i18n / graphql / resolver / article / hygiene
pnpm run test:tier5 # 对抗性门禁，审的是刚 build 出来的 dist/
```

`build` 不能省，也不能放在 `test:tier5` 之后：tier5 里的 T5.3.8 会拒绝比 `src/` 旧的
bundle，它审的就是产物。`.github/workflows/ci.yml` 跑的是同一条链。

想在真浏览器里看效果，但不想装扩展：

```bash
pnpm exec vite --config dev/vite.harness.config.ts
# http://127.0.0.1:5199/ 支持 ?theme=riso&ratio=3:4&bg=paper&canvas=4:5 这类直接切状态
```

## 改动约定

- **一处规则一个主人。** 倍数规则只在 `engine/scale.ts`；选项取值只在 `ui/options.ts`；
  主题 token 只在 `ui/themes.ts`；`adapter/urls.ts` 是 X 图片地址的唯一判断处。
  新增第二份「同一件事的算法」通常是 bug 的温床，不是更快的方式。
- **加测试要有理由。** 能锁住一个真实回归、或覆盖现有门禁够不到的路径，才值得写。
  为覆盖率对称性补的测试会被 review 去掉。
- **注释说理由，不说复述。** 「这里为什么这样做、不那样做」是仓库要的；
  「这里做了什么」如果代码本身已经说清楚，就不要再写一遍。
- **不要凭记忆写 X 的 DOM 或接口。** 选择器、queryId、payload 形状都以
  `docs/detection-audit.md`、`docs/observed-dom-*.md`（注意各自的采集日期）与
  `tests/fixtures/` 里真实采集的标记为准。不带证据的新选择器会被要求补夹具。
- **新增依赖前先说。** 运行时依赖被刻意压到四个（`preact`、`modern-screenshot`、
  `qrcode-generator`、`lucide-preact`），把「纯本地、零外部服务」当成硬约束。
- **本地临时文件**放 `.tmp/`（已在 `.gitignore` 里），不要落在仓库根目录。

## 提交与 Pull Request

- 提交信息用 Conventional Commits：`type(scope): summary`，
  例如 `fix(export): claim the clipboard at the click`。
  正文写清**为什么**——修的是哪一类问题、复现条件、代价是什么。
- 一个 PR 一件事。同时改导出引擎和主题 token 会让回滚变得不安全。
- PR 描述里请给出：

  | 内容 | 为什么需要 |
  |---|---|
  | 复现步骤或截图 | X 的页面状态很难描述，图比字快 |
  | 跑过的门禁 | `pnpm run build`、`pnpm test`、`pnpm run test:tier5` 的结果 |
  | 行为变化 | 有哪些用户可见的变化，以及为什么值得 |
  | 新增的判据 | 如果有新的 DOM 选择器或接口假设，附上采集到的标记 |

- 涉及 X 页面结构的改动，最好附一条 `article[data-testid="tweet"]` 的 outerHTML 夹具，
  或说明 `node dev/verify-extractor.mjs` 在本地是通的。

## 报告问题

提 issue 时请带上：浏览器与版本、扩展版本（卡片右下角的构建号或 `manifest.json` 的
`version`）、X 的界面语言、能复现的最小推文链接（公开推文即可），以及控制台的
`[Post-to-Card]` 日志。**不要**贴出含个人信息、私信或未公开内容的页面截图。

## 许可

本项目以 **GNU GPL v3.0 或更高版本**（`GPL-3.0-or-later`）发布，详见仓库根目录的
[LICENSE](LICENSE)。按 GPL §5，你提交的贡献也以同一许可授权——
提交 Pull Request 即表示你同意这一点。若你的贡献包含第三方代码，
请在 PR 里说明其来源与许可，它必须与本项目的许可兼容。
