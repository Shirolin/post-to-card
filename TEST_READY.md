# TEST_READY: Post-to-Card E2E Test Suite Publication

> Published by: `test_writer_1` (E2E Testing Track)  
> Date: 2026-09-29  
> Status: **TEST SUITE READY & 100% PASSING**（发布当日快照：下面的用例数与 tier 名是 2026-09-29 那次运行的，现行数字以 `npm test` 输出为准）  
> Test Runner: `tests/runner.ts` (Node.js 24 Native ESM/TS Runner)  

---

## 1. Executive Summary

The complete opaque-box E2E test suite for **Post-to-Card** (Chrome Extension Manifest V3) is fully implemented, verified, and passing with a **100% success rate**.

The suite exercises all requirements from `ORIGINAL_REQUEST.md` and `PROJECT.md` across 4 progressive tiers, with zero external network calls, zero fragile wrapper dependencies, and complete deterministic mock isolation.

### Overall Results
```
===============================================================
       POST-TO-CARD OPAQUE-BOX E2E TEST SUITE RUNNER            
===============================================================
▶ Tier 1: Feature Coverage                  :  130 / 130 PASSED (100%)
▶ Tier 2: Boundary & Corner Cases           :   18 /  18 PASSED (100%)
▶ Tier 3: Cross-Feature Interactions        :   10 /  10 PASSED (100%)
▶ Tier 4: Real-World Scenarios & Workflows  :    4 /   4 PASSED (100%)
===============================================================
  TOTAL TESTS RUN : 162
  PASSED          : 162
  FAILED          : 0
  SUCCESS RATE    : 100%
  EXECUTION TIME  : ~280ms
===============================================================
```

---

## 2. Test Execution Commands

### Run Full Test Suite (all tiers)
```powershell
node tests/runner.ts
```

### Run Individual Test Tiers
```powershell
# Tier 1: Feature Coverage
node tests/runner.ts tier1

# Tier 2: Boundary & Corner Cases
node tests/runner.ts tier2

# Tier 3: Cross-Feature Interactions
node tests/runner.ts tier3

# Tier 4: Real-World End-to-End Scenarios
node tests/runner.ts tier4
```

---

## 3. Test Architecture & Directory Layout

```
d:/Project/post-to-card/
├── TEST_INFRA.md                    # Testing philosophy, architecture & F1-F26 coverage matrix
├── TEST_READY.md                    # Publication report & execution guide (this file)
└── tests/
    ├── runner.ts                    # High-precision CLI runner & reporter
    ├── env/                         # Environmental emulation & isolation mocks
    │   ├── browser.ts               # DOM, Custom Elements, Shadow DOM, MutationObserver
    │   ├── chrome.ts                # Chrome Extension MV3 messaging, tabs, storage mocks
    │   ├── render.ts                # Vite SSR loader, and the modern-screenshot alias the export engine runs against
    │   ├── clipboard.ts             # Async Clipboard API with fault injection & download fallback
    │   └── modern-screenshot-stub.ts # The rasterizer stand-in: records what the engine asked it to draw
    ├── fixtures/                    # Production-fidelity Twitter/X DOM fixtures
    │   ├── single-tweet.ts          # Single tweet DOM & expected TweetData
    │   ├── thread.ts                # 3-tweet continuous author thread DOM & ThreadData
    │   ├── quote-tweet.ts           # Nested Quote Tweet DOM & quotePost model
    │   ├── emojis.ts                # Twemoji restoration & pure emoji fixtures
    │   ├── multi-images.ts          # 1, 2, 3, 4 photos & video poster fixtures
    │   ├── ads-replies.ts           # Interleaved ads & outsider replies filtering fixture
    │   └── rich-tokens.ts           # @mentions, #hashtags, $cashtags, t.co URLs fixture
    ├── tier5_adversarial.ts         # Adversarial stress & forensic suite (separate gate: npm run test:tier5)
    └── tiers/                       # 4 progressive tiers plus 5 focused ones
        ├── tier1_features.test.ts   # Feature coverage, >=5 checks per feature area
        ├── tier2_boundaries.test.ts # Stress, boundaries, fault injection
        ├── tier3_interactions.test.ts# Combinatorial cross-feature interactions
        ├── tier4_workloads.test.ts  # Full end-to-end real-world user workflows
        ├── tier_i18n.test.ts        # Localization
        ├── tier_graphql.test.ts     # Structured response parsing
        ├── tier_resolver.test.ts    # Deep unified thread resolution
        ├── tier_article.test.ts     # Long-form posts
        └── tier_hygiene.test.ts     # Mechanical repository invariants
```

---

## 4. Coverage Breakdown by Tier

### Tier 1: Feature Coverage (F1 – F32; F8 was removed with its tautological tests)
Every single feature defined in `PROJECT.md` has a minimum of 5 rigorous specification tests:
- **F1 (Build Pipeline)**: IIFE content bundle, ESM background bundle, isolatedModules, lib DOM, wrapper-free.
- **F2 (Manifest V3)**: MV3 schema, twimg host permissions, service worker module, content_scripts matches, document_idle.
- **F3 (Minimal Dependencies)**: Strictly 4 dependencies (preact, modern-screenshot, qrcode-generator, lucide-preact), zero react bloat, devDeps separation, semver integrity.
- **F4 (CORS Proxy)**: FETCH_IMAGE_BASE64 message handling, PING healthcheck, error handling, memory caching, twimg domain constraint.
- **F5 (Offline & Security)**: Zero telemetry, offline vector QR, script tag safety, local storage isolation, zero remote CSS.
- **F6 (Button Injection)**: Role button & ✨ icon, group selector matching, data-post-to-card-injected flag, deduplication guard, click dispatch.
- **F7 (MutationObserver)**: ChildList mutations, 150ms debounce coalescing, layout thrashing prevention, disconnect cleanup, virtual scroll subtree.
- **F8 (SPA Navigation)**: *removed* — its five tests each defined a local function, called it, and asserted the result. The wiring itself is covered by tier2 Tier 2.87, which loads `src/content/index.ts` and dispatches a real `popstate`.
- **F9 (Emoji Restoration)**: Twemoji img[alt] restoration, display name emoji support, BR tag to newline, pure emoji tweets, textContent loss proof.
- **F10 (Rich Tokens)**: @mention links, #hashtag search, $cashtags, t.co display text, trailing pic.twitter.com link stripping.
- **F11 (Media Upgrades)**: Avatar _400x400 upgrade, photo name=large upgrade, legacy :small to :large, video poster extraction, empty media resilience.
- **F12 (Multi-Image Grid)**: 1 photo full width, 2 photos dual column, 3 photos split layout, 4 photos 2x2 grid, max 4 photos clamp.
- **F13 (Quote Tweets)**: Nested quoteTweet container, independent quote author, quote text, quote media extraction, deleted quote post tombstone.
- **F14 (Thread Connector)**: 3-tweet same-author chaining, sponsored ad interception, third-party reply exclusion, thread index/total calculation, single tweet flag.
- **F15 (Shadow DOM Container)**: Custom element registration, open shadowRoot attachment, InvalidStateError on double attach, singleton guard, unmount cleanup.
- **F16 (Inline Style Isolation)**: ShadowRoot style tag, :host all: initial, zero host CSS leakage, font stack fallbacks, textContent injection.
- **F17 (Curated Themes, P0 + P2)**: 8 套材质主题 token 表（羊皮纸 / 暗刊 / 细线 + 牛皮纸 / 蓝晒图 / 终端 + 报纸栏 / 粗野派），每套带签名装饰线与呼吸节奏；引号推文按材质分填充/描边两种呈现。纯白禁令、无渐变面、明度阶单调性、衬线/无衬/等宽字族、强调色、退役主题 id 迁移（Linear 暗黑→暗刊、极致纯黑→蓝晒图、Notion 纯白→羊皮纸）、双语主题名、正文/副文/脚注/链接 4.5:1 对比度底线、引号面板可见性、水印走脚注墨色、qrFill 与引号圆角接线、垫底与卡面分离度、禁止硬编码品牌蓝、实验性主题不进默认转盘。
- **F18 (Padding & Radius)**: 16px/32px/48px padding, follow-theme plus 0px/12px/20px radius, padding fallback, radius fallback, media corner synchronization, per-theme corner deferral.
- **F19 (Fluid Expansion)**: Auto ratio unconstrained, 3:4 ratio 853px min-height, 16:9 ratio 360px min-height, downward expansion without clipping, overflow: visible.
- **F20 (Offline QR Code)**: Vector SVG generation, UTM/tracking parameter stripping, crispEdges shape rendering, long URL support, 100% offline.
- **F21 (Controls & Toggles)**: showQrCode toggle, showStats toggle, showTimestamp toggle, showWatermark toggle, reactive state updates.
- **F22 (Author Privacy Blur)**: CSS filter blur(6px), blurred display name class, blurred handle class, avatar overflow clipping, clean toggle removal.
- **F23 (Modal UX & Scroll Lock)**: Esc key dismissal, backdrop click dismiss, dialog click stopPropagation, body overflow scroll lock, scrollbar width compensation.
- **F24 (Retina Export)**: scale: 2 Retina export, scale: 3 Ultra-HD export, image decoding wait, data-export-ignore filter, transparent background.
- **F25 (Canvas CORS Taint)**: Every image the rasterizer is handed is a Base64 data URL (avatar, media, quoted media), the live card is restored afterwards, and a proxy that cannot fetch falls back to an origin-clean placeholder.
- **F26 (Clipboard & Fallback)**: Direct clipboard copy, unfocused document download fallback, gesture expired download fallback, permission denied fallback, anchor download tracking.

### Tier 2: Boundary & Corner Cases
- Empty text tweet (media-only)
- Whitespace-only text collapsing
- Extreme 4500+ character post downward expansion
- Deep thread of 25 continuous tweets
- Multi-codepoint ZWJ emojis (👨‍👩‍👧‍👦, 🏳️‍🌈, 🧑🏽‍💻, 🦸🏻‍♀️)
- 50 consecutive Twemojis
- Missing avatar fallback to default SVG
- Corrupted image decode catch-and-continue
- Background proxy 504 network error fallback
- Clipboard unfocused fallback
- Clipboard gesture expiration fallback
- Deleted quote tweet placeholder
- Zero stats (0 likes/replies) vs viral stats (2.4M, 84.1M)
- Brutalist 0px radius + 48px padding
- Soft 20px radius + 16px padding
- XSS tag injection and escaping in author name
- Control character sanitization (\x00, \x08) and RTL text

### Tier 3: Cross-Feature Interactions (10 tests)
- 6 Themes root CSS class mapping
- 3 Padding pixel options without style collapse
- 3 Radius options with media corner synchronization
- 54-state combinatorial configuration matrix (6 Themes x 3 Paddings x 3 Radii)
- Composite mega-card: Thread + Quote Tweet + 4-image grid + Twemojis
- Author privacy blur active concurrently with sharp QR code
- 3:4 Aspect ratio fluid downward expansion past 853px min-height
- 16:9 Banner ratio fluid downward expansion past 360px min-height
- Full Background Proxy -> Base64 Replacement -> Clean Canvas Export Pipeline
- Chrome storage preference saving and modal rehydration

### Tier 4: Real-World Scenarios (4 End-to-End Workflows)
- **Workflow 1**: Single Viral Tweet with 4 photos converted to Nocturne card and copied to clipboard.
- **Workflow 2**: 3-Tweet thread with author blur fails clipboard (unfocused) and gracefully downloads PNG.
- **Workflow 3**: Quote tweet rendered in Parchment at Ultra-HD (scale: 3, 288 DPI).
- **Workflow 4**: SPA navigation clears modal, Esc dismisses modal, and body scroll unlocks.

---

## 5. Guidance for Downstream Milestones

- **M1 (Vite Packaging)**: Run `node tests/runner.ts tier1` to verify F1, F2, and F3.
- **M2 (Background Proxy)**: Run `node tests/runner.ts tier1` to verify F4, F5.
- **M3 (Platform Adapter)**: Run `node tests/runner.ts tier1` to verify F6 through F14.
- **M4 (Shadow DOM & Modal)**: Run `node tests/runner.ts tier1` to verify F15 through F23.
- **M5 (Export Engine)**: Run `node tests/runner.ts` (all tiers) to verify F24 through F26, Tiers 2, 3, and 4.
- **M6 (Adversarial Hardening)**: The test suite provides a hardened baseline for final forensic auditor gates.
