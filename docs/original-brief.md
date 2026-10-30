# 立项任务书

> 2026-09-29 开工时的原始需求，保留在这里作为 `PROJECT.md` 功能表里「任务书 §R*」的来源。
> 它说明的是**当时**要做什么，不是现行接口契约：行为以 `src/` 与 `tests/` 为准，
> 已经偏离原文的地方以代码和测试记录的为准。
> 文中「工作目录」与「Integrity mode」两行是当时生成环境的元数据，原样保留。

## 2026-09-29T14:13:45Z

Develop a Chrome Extension (Manifest V3) called "Post-to-Card" that converts Twitter/X posts and threads into beautifully formatted, high-resolution shareable card images completely offline and locally in the browser.

Working directory: d:/Project/post-to-card
Integrity mode: development

## Requirements

### R1. Twitter/X Platform Adapter & Dynamic Injection
Inject a sleek "✨" button into tweet action bars (`div[role="group"]`) on Twitter/X using a debounced MutationObserver without UI jitter or duplicate buttons. Accurately extract single posts and continuous threads of the same author (strictly filtering out other users' replies). Restore native emojis from `img[alt]`, preserve `@mentions` and `#hashtags` styling, convert media URLs to ultra-high resolution (`_400x400` for avatars, `format=jpg&name=large` for photos), extract video poster frames, and capture quote tweets (`quotePost`).

### R2. Isolated Universal UI in Shadow DOM (Preact)
Mount the interactive preview modal into a dedicated custom element (`<post-to-card-container>`) using open Shadow DOM, injecting compiled styles via inline CSS to ensure 100% style isolation from Twitter's host DOM. Provide 6 curated preset themes (Linear Dark, Sunset Glow, Aurora Purple, Notion Clean White, Cyber Mint, OLED Black), 3 padding options (16px / 32px / 48px), and 3 border-radius options (0px / 12px / 20px). Support Auto aspect ratio by default, with 3:4 and 16:9 poster layouts that smoothly expand downward for long text without clipping. Provide independent toggles for QR code (locally generated), stats, timestamp, watermark, and author privacy blurring. Handle Esc key and background scroll locking.

### R3. Export Engine with Canvas CORS Protection & Fallback
Export cards at retina resolution (scale: 2 or 3) using modern-screenshot. Prevent Canvas CORS taint by proxying image fetches through the Background Service Worker (`host_permissions: ["https://*.twimg.com/*", "https://pbs.twimg.com/*"]`) to convert them to Base64 Data URLs prior to rendering. Support direct copy-to-clipboard (`navigator.clipboard.write`) with automatic graceful fallback to downloading the high-res PNG if user activation is lost or clipboard permissions fail.

### R4. Clean Build & Extension Packaging
Configure a robust multi-entry Vite build pipeline without fragile third-party extension wrappers. Output an IIFE bundle for `content.js` and an ESM bundle for `background.js`. Include a valid `manifest.json` and type-safe configuration.

## Acceptance Criteria

### Build & Compilation
- [ ] `pnpm install` installs cleanly with minimal dependencies (`preact`, `modern-screenshot`, `qrcode-generator`).
- [ ] `pnpm run build` runs TypeScript check (`tsc`) and Vite build with 0 errors or warnings.
- [ ] Output directory `dist/` contains valid `manifest.json`, `content.js`, and `background.js`.

### Runtime & Functional Guardrails
- [ ] Content script successfully observes and injects the trigger button on dynamic feeds and status pages without performance regressions or duplication.
- [ ] Shadow DOM modal opens centered, isolates host CSS completely, locks background scroll, and closes reliably on Esc or backdrop click.
- [ ] Card accurately renders text, emojis, media grids (1-4 images), quote tweets, and continuous thread timeline connectors.
- [ ] Export engine completes without Canvas taint errors (`SecurityError`), successfully generating PNG and copying to clipboard (or gracefully downloading on failure).
- [ ] Extension works 100% offline without communicating with any external servers.

