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
- **F8 (SPA Navigation)**: *removed* — its five tests each defined a local function, called it, and asserted the result. The navigation wiring is covered by tier2 Tier 2.87, which calls the shipped `initTwitterInjection` and dispatches a real `popstate`; the entry module's own wiring is F31.1–F31.5.
- **F9 (Emoji Restoration)**: Twemoji img[alt] restoration, display name emoji support, BR tag to newline, pure emoji tweets, textContent loss proof.
- **F10 (Rich Tokens)**: @mention links, #hashtag search, $cashtags, t.co display text, trailing pic.twitter.com link stripping.
- **F11 (Media Upgrades)**: Avatar _400x400 upgrade, photo name=orig upgrade (4096px, `name=large` stops at 2048px), WebP rewritten to JPEG, legacy :small to :orig, video poster extraction, empty media resilience.
- **F12 (Multi-Image Grid)**: 1 photo full width, 2 photos dual column, 3 photos split layout, 4 photos 2x2 grid, max 4 photos clamp.
- **F13 (Quote Tweets)**: Nested quoteTweet container, independent quote author, quote text, quote media extraction, deleted quote post tombstone.
- **F14 (Thread Connector)**: 3-tweet same-author chaining, sponsored ad interception, third-party reply exclusion, thread index/total calculation, single tweet flag.
- **F15 (Shadow DOM Container)**: Custom element registration, open shadowRoot attachment, InvalidStateError on double attach, singleton guard, unmount cleanup.
- **F16 (Inline Style Isolation)**: ShadowRoot style tag, :host all: initial, zero host CSS leakage, font stack fallbacks, textContent injection.
- **F17 (Curated Themes, P0 + P2)**: 12 套材质主题 token 表（11 常驻 + 1 实验性粗野派，默认不进转盘），每套带签名装饰线与呼吸节奏；引号推文按材质分填充/描边两种呈现。纯白禁令、无渐变面、明度阶单调性、衬线/无衬/等宽字族、强调色、退役主题 id 迁移（linear-dark / oled-black→darkroom、notion-white / parchment→gallery）、双语主题名、正文/副文/脚注/链接 4.5:1 对比度底线、引号面板可见性、水印走脚注墨色、qrFill 与引号圆角接线、垫底与卡面分离度、禁止硬编码品牌蓝、实验性主题不进默认转盘。
- **F18 (Padding & Radius)**: 16px/32px/48px padding, follow-theme plus 0px/12px/20px radius, padding fallback, radius fallback, media corner synchronization, per-theme corner deferral.
- **F19 (Fluid Expansion)**: Auto ratio unconstrained, 3:4 ratio 853px min-height, 16:9 ratio 360px min-height, downward expansion without clipping, overflow: visible.
- **F20 (Offline QR Code)**: Vector SVG generation, UTM/tracking parameter stripping, crispEdges shape rendering, long URL support, 100% offline.
- **F21 (Controls & Toggles)**: showQrCode toggle, showStats toggle, showTimestamp toggle, showWatermark toggle, reactive state updates.
- **F22 (Author Privacy Blur)**: CSS filter blur(6px), blurred display name class, blurred handle class, avatar overflow clipping, clean toggle removal.
- **F23 (Modal UX & Scroll Lock)**: Esc key dismissal, backdrop click dismiss, dialog click stopPropagation, body overflow scroll lock, scrollbar width compensation.
- **F24 (Retina Export)**: scale: 2 Retina export, scale: 3 Ultra-HD export, image decoding wait, data-export-ignore filter, transparent background.
- **F25 (Canvas CORS Taint)**: Every image the rasterizer is handed is a Base64 data URL (avatar, media, quoted media), the live card is restored afterwards, and a proxy that cannot fetch falls back to an origin-clean placeholder.
- **F26 (Clipboard & Fallback)**: Direct clipboard copy, unfocused document download fallback, gesture expired download fallback, permission denied fallback, anchor download tracking.

### Tier 2: Boundary & Corner Cases (84 tests)
- Empty / whitespace-only / 4500-character bodies, and line breaks inside a text node
- ZWJ emoji restoration and 50 consecutive Twemojis
- Missing avatar fallback to the inline placeholder
- Quote extraction: author identity, rich tokens, media isolation, permalinks, nested
  and previewed quotes, an unavailable quote rendered as a tombstone
- External link cards, in their div and non-div wrapper shapes
- Social context: repost / reply / pinned read structurally, in any language
- Media URL resolution and the picture fallback chain, one step per error
- Extraction with no `data-testid` present, and the article selector's fallback
- Translated-post notice present and absent; pic.x.com permalinks kept or stripped
- Media-grid planning thresholds and idempotence
- Thread-scope exclusion accounting
- Trigger injection: one per tweet, hidden-not-removed, preference and locale changes
  reaching triggers that already exist
- The Alt+C shortcut, and the popstate rescan
- Radiogroup keyboard navigation: disabled levels skipped, Home/End, deferred focus
- Control-character removal asked of the rasterizer, RTL text left alone

### Tier 3: Cross-Feature Interactions (10 tests)
- Every material renders its own `data-theme` and injects that material's accent
- Every padding option reaches the root as both attribute and inline padding
- Every radius option lands on the card and the media, through `resolveRadius`
- The full material x padding x radius matrix renders every combination
- A thread carrying a quote, a four-photo grid and emoji renders every part at once
- The privacy blur lands on the author block only, never on the QR code
- 3:4 and 16:9 each set a min-height floor and stay free to grow past it
- Every image the card paints is one the background proxy is allowed to fetch
- Preferences saved through the store come back sanitized on the next launch

### Tier 4: Real-World Scenarios (4 End-to-End Workflows)
- **Workflow 1**: A four-photo tweet extracts, renders, rasterizes clean, and reaches the clipboard.
- **Workflow 2**: A three-post thread resolves, blurs its author, and falls back to a download.
- **Workflow 3**: A quote tweet extracts its quote, renders it, and downloads on request.
- **Workflow 4**: The scroll lock is reentrant, restores what it found, and a closed modal renders nothing.

---

## 5. Guidance for Downstream Milestones

- **M1 (Vite Packaging)**: Run `node tests/runner.ts tier1` to verify F1, F2, and F3.
- **M2 (Background Proxy)**: Run `node tests/runner.ts tier1` to verify F4, F5.
- **M3 (Platform Adapter)**: Run `node tests/runner.ts tier1` to verify F6 through F14.
- **M4 (Shadow DOM & Modal)**: Run `node tests/runner.ts tier1` to verify F15 through F23.
- **M5 (Export Engine)**: Run `node tests/runner.ts` (all tiers) to verify F24 through F26, Tiers 2, 3, and 4.
- **M6 (Adversarial Hardening)**: The test suite provides a hardened baseline for final forensic auditor gates.
