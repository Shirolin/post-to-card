<div align="center">
  <img src="public/icons/icon-128.png" width="108" height="108" alt="PostPress Icon" />

  <h1>PostPress · 印推</h1>
  <p>
    <b>Press X (Twitter) posts and same-author threads into publication-grade, high-resolution cards</b>
  </p>

  <p>
    <a href="README.md">简体中文</a> | English · <a href="https://shirolin.github.io/post-to-card/">Interactive Showcase & Gallery ↗</a>
  </p>

  <p>
    <a href="https://github.com/Shirolin/post-to-card/actions/workflows/ci.yml"><img src="https://github.com/Shirolin/post-to-card/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  </p>

  <p>
    <code>Manifest V3</code> · <code>Preact 10 + Shadow DOM</code> · <code>12 Tactile Themes</code> · <code>14 Languages (i18n)</code> · <code>100% Local Rendering</code> · <code>GPL-3.0-or-later</code>
  </p>
</div>

---

## 🚀 Overview

**PostPress** is a publication-grade card studio extension built for X (Twitter). Stop sharing cluttered, low-DPI browser screenshots—click the **press icon** in any post's action bar (or press `Alt + C`), and PostPress typesets single posts or multi-post threads inside an isolated live modal. Mix and match paper materials, aspect ratios, and outer canvas mats, then **copy directly to your clipboard** or **export as a 3× Retina PNG** with one click.

Every step—parsing, layout, and rasterization—runs 100% locally in your browser: **no login required, zero credential access, and zero external server communication**.

---

## 📸 Preview

> Explore interactive theme switching and all 12 materials on the product page: <https://shirolin.github.io/post-to-card/> (source in [`site/`](site/)).

### Material Themes (6 of 12 Shown)

| Minimal | Riso | Darkroom |
| :---: | :---: | :---: |
| ![Minimal](site/assets/cards/minimal.webp) | ![Riso](site/assets/cards/riso.webp) | ![Darkroom](site/assets/cards/darkroom.webp) |
| **Sumi** | **Liquid Glass** | **Receipt** |
| ![Sumi](site/assets/cards/sumi.webp) | ![Liquid Glass](site/assets/cards/glass.webp) | ![Receipt](site/assets/cards/receipt.webp) |

### Thread Stitching, Long-form Articles & Live Controls

| Same-Author Thread Stitching | X Long-form Article Layout | Live Customization Panel |
| :---: | :---: | :---: |
| ![Thread](site/assets/cards/thread-riso.webp) | ![Article](site/assets/cards/article-gallery.webp) | ![Controls Panel](site/assets/cards/panel-minimal.webp) |

### Granular Footer & Per-Author Privacy

| Full Footer (QR + Stats + Credit) | Clean Mode (Footer Hidden) | Author Privacy Blur |
| :---: | :---: | :---: |
| ![Full Footer](site/assets/cards/switch-full-minimal.webp) | ![Plain Footer](site/assets/cards/switch-plain-minimal.webp) | ![Author Blur](site/assets/cards/switch-blur-minimal.webp) |

---

## ✨ Key Features

#### 🎨 Publication-Grade Materials & Matting
- **12 Curated Material Themes**: Includes 11 permanent themes (*Minimal*, *Midnight*, *Liquid Glass*, *Material 3*, *Gallery*, *Darkroom*, *Riso*, *Sumi*, *Clay*, *Terminal*, *Receipt*) plus 1 experimental *Brutalist* theme. Each theme is a cohesive design system defining paper tone, border rules, typographic pairings, a single accent ink, and a custom signature mark.
- **Independent Canvas Matting (`Mat`)**: Mount your card onto an outer canvas for social-ready exports. Canvas aspect ratios (`1:1` / `4:5` / `3:4` / `16:9`) and backdrops (Follow Theme / Solid / Gradient) are controlled independently. Ratios enforce an elastic `min-height` floor so long posts never truncate; selecting a ratio alone keeps surrounding whitespace transparent for compositing.
- **14 Interface & Card Languages**: Native localization across 14 locales (EN, ZH-CN, ZH-TW, JA, KO, DE, FR, ES, IT, PT-BR, RU, TR, UK, ID). Automatically follows your browser or pins to a chosen language, localizing modal controls and card timestamps while leaving the author's original post text untouched.

#### 🔍 Dual-Channel Extraction Engine
- **Smart Thread Stitching**: Powered by a **GraphQL-first + DOM fallback** pipeline (`resolveThread`). Automatically connects consecutive posts by the same author, strips promoted ads and unrelated replies, and lets you exclude individual posts inside the live preview.
- **Long-form Articles & Rich Media**: Natively parses X Articles (extracting cover images, kickers, titles, and ledes); renders quoted posts in filled or outlined styles matching the active material; restores native Twemoji Unicode characters; upgrades photos via a `name=orig` 4K fallback chain across 1–4 image grid/stack layouts.

#### ⚡ Retina Export & Privacy Guardrails
- **3× Retina Rasterization & Gesture-Safe Copy**: Single posts export at 3× resolution by default; ultra-tall threads adapt to 2× to prevent platform downscaling artifacts (with an optional global 3× override). Clicking **Copy** claims the system clipboard immediately inside the user gesture via a Promise-backed `ClipboardItem`, ensuring long thread renders never fail due to transient activation timeouts.
- **Per-Author Privacy & Readability Warning**: Independently toggle the source QR code, engagement stats, timestamp, video play badge, and credit line. Anonymize all authors globally with one switch, or **click any individual post's avatar on the card to blur just that author**. Alerts you proactively when an ultra-tall card would scale down too small in social feeds.

---

## 🛠️ Tech Stack

- **UI & View Layer**: [Preact 10](https://preactjs.com/) + TypeScript (mounted inside an open Shadow DOM on `<post-to-card-container>` with inline `:host { all: initial }` CSS for 100% style isolation)
- **Rasterization Engine**: [modern-screenshot](https://github.com/qq15725/modern-screenshot) (paired with a Background Service Worker Base64 image proxy to eliminate HTML5 Canvas CORS tainting)
- **Offline QR & Icons**: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (pure local SVG generation) + [lucide-preact](https://lucide.dev/)
- **Build & Quality Gates**: [Vite 6](https://vite.dev/) 4-entry build pipeline + [Knip](https://knip.dev/) dead-code analysis + Node.js 24 native TypeScript E2E & adversarial verification suite (Tiers 1–5 + real-browser CDP probes)

---

## 📦 Getting Started

### Build from Source

Prerequisites: **Node.js >= 24**, **pnpm >= 10**.

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/Shirolin/post-to-card.git
cd post-to-card
pnpm install

# 2. Build the production extension into dist/
pnpm run build
```

Load unpacked into Chrome / Chromium:
1. Open `chrome://extensions/` and enable **Developer mode** in the top-right corner.
2. Click **Load unpacked** and select the generated `dist/` directory.

### Quick Workflow

| Step | Action |
| :--- | :--- |
| **1. Launch** | Click the **press icon** in any post's action bar, or hover over a post and press `Alt + C` (or trigger via the toolbar popup). |
| **2. Customize** | Switch material themes, padding, corner radius, card ratio, and outer canvas mat backdrop; toggle footer metadata as needed. |
| **3. Curate Thread** | Opening any post in a thread stitches the author's chain automatically; click the top-right chip on a post to exclude it, or click an avatar to blur that author. |
| **4. Export** | Click **Copy Image** (writes directly to the clipboard, falling back to download if focus is lost) or **Save PNG**. |

---

## 🔒 Privacy & Security

PostPress enforces **"100% local, zero external services"** as a hard architectural invariant:

- **Zero External Telemetry**: Apart from fetching post media from X's official CDN (`*.twimg.com`, strictly validated by `isAllowedHost` to prevent SSRF) via the background worker to prevent Canvas tainting, the extension makes zero network requests.
- **No Analytics or Tracking**: No telemetry, no crash reporting SDKs, and no remote configuration flags.
- **Zero Credential Access**: Requires no login or X API keys. Reads only the DOM already rendered on your screen and the page's own GraphQL response stream in memory.
- **Minimal Permissions**: Declares only `clipboardWrite`, `storage` (`chrome.storage.local` for user preferences), and `*.twimg.com` host access—no `tabs` or `<all_urls>` permissions.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy and [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## ❓ FAQ

<details>
<summary><b>Why not just take a regular screenshot?</b></summary>

OS screenshots are bound to your monitor's DPI and browser zoom, capturing cluttered UI chrome along the way. PostPress re-typesets and rasterizes the post inside an isolated Shadow DOM at 2× / 3× resolution with publication-grade typography, paper grain, and a source QR code.
</details>

<details>
<summary><b>Will ultra-long thread cards look blurry when posted to social feeds?</b></summary>

Single posts export at 3× and stay razor-sharp. When a multi-post thread grows so tall that social platforms would scale its width down to an unreadable font size, the panel displays a **Readability Warning** suggesting a split export. Long threads default to 2× to keep pixel dimensions reasonable, while lossless channels can force 3× via **Prefer highest resolution** in Export settings.
</details>

<details>
<summary><b>What happens to exported cards if the original post is deleted?</b></summary>

Exported PNGs live on your clipboard or disk and are completely unaffected. The extension never persists tweet content in background storage; closing the modal frees the in-memory session immediately.
</details>

<details>
<summary><b>What about copyright when quoting public posts?</b></summary>

Cards preserve the original author's name, handle, timestamp, and permalink QR code by default. Public visibility does not imply a commercial license—please verify rights before commercial redistribution.
</details>

---

## 🏗️ Architecture & Development

![Architecture: 4 Build Entries, 2 JS Worlds, 1 Export Pipeline](docs/images/architecture.png)

- **Isolated Dual-World Execution**: `graphql-hook.js` runs at `document_start` in the page's `MAIN` world to intercept structured GraphQL responses; `content.js` lives in the extension's `ISOLATED` world, receiving sanitized data strictly over `window.postMessage`.
- **Dual-Channel Resolution**: `resolveThread` prioritizes structured GraphQL conversation trees (natively capturing full `note_tweet` bodies and parent-child reply chains) and falls back seamlessly to Snowflake ID ordering, visual connectors, and DOM selectors when uncached.
- **Clean 4-Entry Build**: Driven by Vite across four independent entries (ESM `background` + IIFE `content` / `popup` / `hook`) with runtime dependencies capped strictly at four (`preact`, `modern-screenshot`, `qrcode-generator`, `lucide-preact`).

### Repository Quality Gates

Quality gates **must be executed in strict sequence** (`test:tier5` audits the freshly built `dist/` bundle and rejects stale builds):

```bash
pnpm run build       # 1. Typecheck (tsc + node --check) + dead-code lint (knip) + 4-entry Vite build
pnpm test            # 2. Tiers 1–4 E2E suite + i18n / GraphQL / Resolver / Article / Hygiene suites
pnpm run test:tier5  # 3. Tier 5 adversarial stress & forensic bundle audit (CORS taint, clipboard, Shadow DOM)
```

### Standalone Visual Harness

Debug card typography, materials, and modal states directly in your browser without loading the extension or visiting `x.com`:

```bash
pnpm exec vite --config dev/vite.harness.config.ts
```

Open `http://127.0.0.1:5199/preview.html` and switch states via URL parameters (e.g., `?theme=riso&ratio=3:4&bg=paper&canvas=4:5`). For real-browser verification scripts (`verify:extension`, `verify:extractor`, `verify:motion`), see [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📚 Documentation Map

| Document | Scope |
| :--- | :--- |
| [PROJECT.md](PROJECT.md) | Architectural overview, feature inventory, and data channel design |
| [GLOSSARY.md](GLOSSARY.md) | Canonical definitions for Card, Canvas, Mat, Thread Session, and preferences |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution workflow, coding conventions, and PR checklist |
| [AGENTS.md](AGENTS.md) | Gate sequence, TypeScript blind spots, and real-browser verification guides |
| [PRIVACY.md](PRIVACY.md) / [SECURITY.md](SECURITY.md) | Privacy commitments, permission justifications, and security reporting |
| [CHANGELOG.md](CHANGELOG.md) | Release history and notable changes |
| [docs/i18n.md](docs/i18n.md) | 14-locale dictionary architecture, `'auto'` resolution rules, and `_locales` pitfalls |
| [docs/loading-states.md](docs/loading-states.md) | First-frame `fit` measurement, image placeholders, FLIP motion rules, and pixel probes |
| [docs/detection-audit.md](docs/detection-audit.md) | X DOM selector reliability audit and `ownership.ts` rules |
| [docs/real-dom-sampling-checklist.md](docs/real-dom-sampling-checklist.md) | Offline real-tweet DOM sampling checklist and extractor verification |
| [docs/architecture-review-2026-10-21.md](docs/architecture-review-2026-10-21.md) | Architectural review conclusions and rejected directions |
| [docs/store-listing.md](docs/store-listing.md) | Chrome Web Store listing copy (name, short and full descriptions) and its sync rule with `_locales` |
| [docs/store-checklist.md](docs/store-checklist.md) | Submission checklist: packaging, store images, console fields, privacy answers |

---

## 🤝 Support & Contribution

If PostPress helps your workflow, consider supporting its ongoing development:

- **Afdian (爱发电)**: <https://ifdian.net/a/shirolin>
- **Ko-fi**: <https://ko-fi.com/shirolin>
- **GitHub Star**: Star [Shirolin/post-to-card](https://github.com/Shirolin/post-to-card) to help others discover it!

Pull Requests and bug reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting.

---

## 📄 License

Licensed under the **GNU General Public License v3.0 or later** (`GPL-3.0-or-later`). See [LICENSE](LICENSE) for the full text.

You are free to use, modify, and redistribute this software (including commercially), provided that **any distributed modifications or derivative works are released under the same license with full source code made available**. The source credit link in the card footer serves as the compliance outlet under GPL §6.

Third-party works embedded in the sample card images keep their own CC licenses; see [CREDITS.md](CREDITS.md) for attribution.

```text
Copyright (C) 2026 Shirolin

Post-to-Card is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.
```

<sub>X (Twitter) is a trademark of X Corp. This project is an independent open-source tool and is not affiliated with or endorsed by X Corp.</sub>
