# TEST_INFRA: Post-to-Card E2E Test Suite Architecture & Matrix

> Author: `test_writer_1` (teamwork_preview_test_writer / E2E Testing Track)  
> Status: AUTHORITATIVE TEST INFRASTRUCTURE SPECIFICATION  
> Target: Chrome Extension Manifest V3 ("Post-to-Card")  
> Integrity Mode: Zero-Tolerance Opaque-Box Quality Assurance  

---

## 1. Test Philosophy & Engineering Principles

The **Post-to-Card** Chrome Extension operates in high-variance, unconstrained browser environments: inside Twitter/X's React-Native-for-Web dynamic DOM, across Manifest V3 worker isolation boundaries, and rendering to offline HTML5 Canvas elements with strict Same-Origin and Clipboard security policies.

To guarantee infallible quality without reliance on brittle manual testing, our test infrastructure adheres to four bedrock principles:

### 1.1 Specification-Derived Opaque-Box Testing
Tests are derived exclusively from the authoritative specifications (`ORIGINAL_REQUEST.md`, `PROJECT.md`, and technical mining surveys), never reverse-engineered from incomplete implementation quirks. Every test treats components as opaque-box units with verifiable input/output contracts.

### 1.2 Zero Facade & Zero Tautology Guarantee
No test shall ever be written as a "pass-through facade" that asserts tautologies (e.g. `assert(true)` or mocking away the exact logic under test). Every assertion must exercise actual parsing logic, DOM state transitions, styling computation, SVG generation, what the export engine hands the rasterizer, or error catch-and-fallback cascades.

### 1.3 Progressive Testability & Milestones Isolation
Tests are organized into 4 distinct progressive tiers. While Tier 1 verifies isolated atomic features, Tiers 2–4 progressively verify boundary stress, combinatorial interactions, and complete real-world user workflows.

### 1.4 High-Fidelity Environmental Emulation
The test infrastructure provides a dedicated in-memory DOM, Shadow DOM, Chrome Extension Messaging & Storage, and Asynchronous Clipboard API emulator, and substitutes the one boundary Node cannot host — the rasterizer. This ensures tests run with 100% determinism, millisecond execution speeds, and zero flaky network calls.

---

## 2. Feature Inventory Coverage Matrix

Every feature identified in `PROJECT.md` is covered with a minimum of 5 rigorous specification assertions in Tier 1. The rows are the original F1–F26 feature set: features added later have no row here, and from F27 on the test-side numbers and `PROJECT.md`'s numbers are not the same list (`PROJECT.md` F27 is the E2E suite; the tests' F27 is the image-fit/media-layout suite), so don't read one by the other's number.

| ID | Feature Name | Primary Contract / Specification | Test Suite & Target | Min Tests | Assertion Targets |
|:---|:---|:---|:---|:---:|:---|
| **F1** | Multi-Entry Build Pipeline | Output IIFE for `content.js`, ESM for `background.js`, zero top-level export in IIFE | `tier1_features.test.ts` § F1 | 5 | IIFE structure, ESM format, TS build pass, bundle independence, syntax safety |
| **F2** | Manifest V3 Packaging | Valid manifest_version 3, twimg host permissions, service worker declaration | `tier1_features.test.ts` § F2 | 5 | MV3 schema, host_permissions, service_worker type, content_scripts match, icons |
| **F3** | Minimal Dependencies | Only `preact`, `modern-screenshot`, `qrcode-generator`, `lucide-preact` runtime dependencies | `tier1_features.test.ts` § F3 | 5 | Dependency count, zero wrapper bloat, devDependencies separation, clean package.json, runtime offline |
| **F4** | Background CORS Image Proxy | Service worker `FETCH_IMAGE_BASE64` message handler returns Base64 Data URL | `tier1_features.test.ts` § F4 | 5 | Message type dispatch, Data URL encoding, content type resolution, error handling, cache replay |
| **F5** | Offline & Security Guarantee | Zero external telemetries, no third-party HTTP requests, pure offline rendering | `tier1_features.test.ts` § F5 | 5 | Zero external network calls, offline QR generation, local CSS inline, strict domain scoping, no eval |
| **F6** | Tweet Action Bar Injection | Inject "✨" button into `div[role="group"]` with `data-post-to-card-injected` flag | `tier1_features.test.ts` § F6 | 5 | Button creation, group selector matching, injection attribute tagging, deduplication, click dispatch |
| **F7** | Debounced MutationObserver | 150ms debounce window prevents UI thrashing during rapid DOM mutations | `tier1_features.test.ts` § F7 | 5 | Timer debounce, rapid bursts coalescing, disconnected cleanup, subtree observation, batch injection |
| **F8** | SPA Route Navigation Handling | Handle Twitter SPA route transitions (`/home`, `/status/:id`, `/:username`) | `tier2_boundaries.test.ts` Tier 2.87 | 1 | **F8.1–F8.5 已删除**：各自定义本地函数再断言它刚设的标志，不触及任何生产代码。导航接线改由 Tier 2.87 覆盖——它装载 `src/content/index.ts` 本体、派发真实 `popstate`，断言重扫发生且 `popstate` 是唯一接线 |
| **F9** | Native Emoji Restoration | Convert Twemoji `<img alt="🔥">` to native Unicode string in text and names | `tier1_features.test.ts` § F9 | 5 | `img[alt]` extraction, childNodes recursion, multiple emojis preservation, username emojis, zero text truncation |
| **F10** | Mention & Hashtag Preservation | Preserve `@mentions`, `#hashtags`, `$cashtags`, and URLs as styled tokens | `tier1_features.test.ts` § F10 | 5 | Mention tokenization, hashtag regex parsing, cashtag detection, t.co link rewriting, token array output |
| **F11** | High-Res Media Upgrade | Rewrite avatars to `_400x400`, photos to `name=large`, extract video posters | `tier1_features.test.ts` § F11 | 5 | `_normal` to `_400x400`, `name=small` to `name=large`, legacy `:small` format, video poster extraction, fallback thumbnail |
| **F12** | Multi-Image Grid Extraction | Extract 1 to 4 photo attachments and map layout geometry | `tier1_features.test.ts` § F12 | 5 | 1 photo full-width, 2 photos dual column, 3 photos split layout, 4 photos 2x2 grid, >4 images clamp |
| **F13** | Quote Tweet Extraction | Extract nested `quotePost` (author, text, media, time) and handle deleted posts | `tier1_features.test.ts` § F13 | 5 | Nested container selector, quote author info, quote body text, quote media extraction, deleted post detection |
| **F14** | Continuous Thread Connector | Traverse author's continuous chain, filter ads and outsider replies, add metadata | `tier1_features.test.ts` § F14 | 5 | Same-author chaining, ad interception, other-user reply cutoff, thread index ordering, connector metadata |
| **F15** | Custom Element & Shadow DOM | `<post-to-card-container>` Web Component with open ShadowRoot | `tier1_features.test.ts` § F15 | 5 | Custom element registration, open shadowRoot attachment, mount point creation, singleton guard, unmount cleanup |
| **F16** | Inline CSS Style Isolation | Compile and inject styles inline via `<style>` tag, `:host { all: initial; }` | `tier1_features.test.ts` § F16 | 5 | Style tag injection, `:host` isolation rule, zero host leakage, inline CSS string verification, font resetting |
| **F17** | Curated Themes (P0 + P2) | 12 套材质主题 token 表（11 常驻 + 1 实验性粗野派，默认不进转盘）、每套签名装饰与呼吸节奏、引号面板填充/描边分型、水印走脚注墨色、qrFill 真被消费、纯白禁令、明度阶单调性、字族（衬线/无衬/等宽）、强调色、旧 id 迁移、双语名称、4.5:1 对比度底线、垫底分离度、禁止硬编码品牌蓝、实验性主题不进默认转盘 | `tier1_features.test.ts` § F17 | 25 | 主题集合、token 完整性、签名/引号/节奏契约、无渐变面、明度阶、字族对、强调色、旧 id 迁移、i18n 名称、四色对比度、引号面板可见性、水印墨色、qrFill/圆角接线、垫底分离、无第二强调色、实验主题门控 |
| **F18** | Padding & Border Radius Options | 3 padding tiers (16/32/48px) and 4 radius tiers (follow-theme / 0/12/20px) | `tier1_features.test.ts` § F18 | 6 | Padding style mapping, explicit radius mapping, media corner rounding sync, follow-theme deferral to theme tokens, invalid option fallback |
| **F19** | Downward Expanding Poster Layouts | Auto, 3:4, and 16:9 poster ratios with `min-height` and downward fluid expansion | `tier1_features.test.ts` § F19 | 5 | Auto ratio unconstrained, 3:4 min-height application, 16:9 min-height application, zero text clipping, overflow visible |
| **F20** | Offline QR Code Generator | Generate vector SVG QR code completely client-side using `qrcode-generator` | `tier1_features.test.ts` § F20 | 5 | SVG generation, URL encoding, clean vector output, URL sanitization (strip tracking), offline execution |
| **F21** | Interactive Controls & Toggles | Independent toggles for QR code, stats, timestamp, watermark, blur author | `tier1_features.test.ts` § F21 | 5 | Toggle state updates, conditional DOM rendering, stats omission, watermark removal, state synchronization |
| **F22** | Author Privacy Blurring | Apply CSS `filter: blur(...)` to author display name, handle, and avatar | `tier1_features.test.ts` § F22 | 5 | Avatar blur class, handle blur class, name blur class, container clip bounds, blur toggle disable |
| **F23** | Modal UX & Scroll Lock | Centered modal, Esc key dismissal, backdrop click dismissal, scroll lock | `tier1_features.test.ts` § F23 | 5 | Esc key event listener, backdrop click dismiss, modal stopPropagation, scroll lock padding compensation, unlock on close |
| **F24** | Modern-Screenshot Retina Export | Export cards to PNG at scale 2 or 3 using `modern-screenshot` pipeline | `tier1_features.test.ts` § F24 | 5 | Scale factor application, PNG MIME type output, image decoding wait, export-ignore filter, transparent background |
| **F25** | Canvas CORS Taint Prevention | Pre-substitute external twimg URLs with Base64 Data URLs prior to rendering | `tier1_features.test.ts` § F25 | 5 | Image URL substitution, origin-clean preservation, SecurityError avoidance, clone immutability, complete media coverage |
| **F26** | Clipboard Copy with Fallback | Direct `clipboard.write` with automatic fallback to PNG file download | `tier1_features.test.ts` § F26 | 5 | Clipboard write success, focus lost fallback, user gesture expiration fallback, downloadBlob trigger, anchor cleanup |

---

## 3. Runner Architecture & Emulation Stack

The test runner is built entirely using Node.js 24's native TypeScript and ESM execution capabilities, guaranteeing zero external dependencies while offering total deterministic control:

```
tests/
├── runner.ts                     # Main CLI test runner orchestrator & reporter
├── env/
│   ├── browser.ts                # Lightweight DOM, Custom Elements, ShadowRoot & MutationObserver
│   ├── chrome.ts                 # Chrome Extension Manifest V3 runtime, messaging, tabs, storage mocks
│   ├── clipboard.ts              # Async Clipboard API emulator with focus & permission failure modes
│   ├── render.ts                 # Vite SSR loader, and the `modern-screenshot` alias the export engine runs against
│   └── modern-screenshot-stub.ts # The rasterizer stand-in: records what the engine asked it to draw
├── fixtures/
│   ├── single-tweet.ts           # Realistic DOM fixture for single tweet
│   ├── thread.ts                 # Multi-tweet continuous author thread DOM fixture
│   ├── quote-tweet.ts            # Nested Quote Tweet DOM fixture
│   ├── emojis.ts                 # Twemoji HTML replacement fixture
│   ├── multi-images.ts           # 1-to-4 image attachment layouts fixture
│   ├── ads-replies.ts            # Interleaved promoted posts and third-party replies fixture
│   └── rich-tokens.ts            # Rich text with mentions, hashtags, cashtags and t.co URLs
└── tiers/
    ├── tier1_features.test.ts     # Feature Coverage Suite
    ├── tier2_boundaries.test.ts   # Boundary & Corner Case Suite
    ├── tier3_interactions.test.ts # Combinatorial & Cross-Feature Interaction Suite
    ├── tier4_workloads.test.ts    # End-to-End Real-World User Workflows Suite
    ├── tier_i18n.test.ts          # Localization Suite
    ├── tier_graphql.test.ts       # Structured Response Parsing Suite
    ├── tier_resolver.test.ts      # Deep Unified Thread Resolution Suite
    ├── tier_article.test.ts       # Long-form Post Suite
    └── tier_hygiene.test.ts       # Mechanical Repository Invariants Suite
```

### 3.1 Browser & DOM Emulation Layer (`tests/env/browser.ts`)
- Implements full tree traversal (`childNodes`, `children`, `parentNode`, `parentElement`, `previousElementSibling`, `nextElementSibling`).
- Supports standard DOM query selectors: `querySelector`, `querySelectorAll`, `closest`, `matches` supporting attribute selectors (`[data-testid="..."]`, `[role="..."]`, `[alt]`, `[href*="..."]`).
- Implements Web Components standard: `customElements.define`, `customElements.get`, `Element.attachShadow({ mode: 'open' })` with encapsulated ShadowRoot.
- Implements `MutationObserver` with synchronous batched delivery and disconnect lifecycle.

### 3.2 Chrome Extension MV3 Emulation Layer (`tests/env/chrome.ts`)
- `chrome.runtime.onMessage.addListener(callback)`: Registers background service worker message dispatchers.
- `chrome.runtime.sendMessage(msg, callback)`: Simulates extension IPC between content script and background worker.
- `chrome.storage.local`: In-memory persistent key-value store for user preferences (`CardConfig`).
- `chrome.tabs`: Tab URL resolution and message forwarding simulation.

### 3.3 Rasterizer Stand-In (`tests/env/modern-screenshot-stub.ts`)
- `tests/env/render.ts` aliases the bare specifier `modern-screenshot` to this module in the SSR graph, so the shipped export engine runs unmodified and `domToBlob` is the only replaced call.
- It records `{ target, options }` for every rasterization, which is how a claim about the export is checked: an unproxied remote `src` surviving into `target` is what would taint a real canvas, and keeping it out is the export engine's job.
- It can be told to reject the next call, for the export-failure path.
- Reach it through `loadModule('/tests/env/modern-screenshot-stub.ts')`, never a relative import: the SSR module graph holds the instance the production code sees, and Node's would stay empty.
- There is deliberately no canvas emulator. One existed and re-implemented taint checking, so tests asserting "the canvas throws on a remote URL" were asserting that emulator rather than the extension; `renderCardToBlob` plus the recorder above puts the real code back on the hook.

### 3.4 Clipboard & Fallback Emulation Layer (`tests/env/clipboard.ts`)
- Simulates `navigator.clipboard.write([ClipboardItem])`.
- Configurable failure modes:
  1. `DOCUMENT_UNFOCUSED`: Throws `DOMException: Document is not focused`.
  2. `USER_GESTURE_EXPIRED`: Throws `NotAllowedError: Must be handling a user gesture to use the Clipboard API`.
  3. `PERMISSION_DENIED`: Throws `NotAllowedError: Clipboard permission denied`.
- The download side is not emulated here: a download spy used to sit alongside the clipboard mock, and the tiers that named it were asserting the spy's own bookkeeping. `exportBlobWithFallback` is production code and is driven directly instead.

### 3.5 Component Rendering Layer (`tests/env/render.ts`)
- The one layer that is not hand-rolled: it borrows Vite's SSR pipeline (already a dev dependency, and the same transform the build uses) to load a `.tsx` component in Node, then renders it to HTML with `preact-render-to-string`.
- This is what lets a claim about the UI be asserted against the markup it produces instead of against the text of the component's source. Vite externalises dependencies in SSR, so the component and the renderer share one Preact instance — without that, `Fragment` and hook identity would not match between them.
- `loadModule` exposes the same pipeline for modules that export functions rather than components, which is how `Modal.tsx`'s real `lockScroll` and the real export engine are reached. Anything from `src/` that a test drives must come through here, or the test gets Node's second copy of the module and its side effects land in the wrong registry.
- Used by Tier 1 for the card and controls: the video badge and its preference, the localized toggle labels, the QR tooltip, and the `data-html2canvas-ignore` marker the export filter keys on.

---

## 4. Tier Pass Thresholds & Quality Gates

| Tier | Name | Target Scope | Pass Threshold | Failure Policy |
|:---:|:---|:---|:---:|:---|
| **Tier 1** | Feature Coverage | >=5 checks per feature area | **100% Pass** (0 failures allowed) | Blocks Milestone progression; failure signals broken requirement contract |
| **Tier 2** | Boundaries & Corners | Empty text, 4000+ chars, emoji-only, missing avatars, CORS failures, deleted quotes, 0 vs millions stats | **100% Pass** (0 failures allowed) | Blocks Milestone progression; failure signals unhandled edge conditions |
| **Tier 3** | Cross-Feature Interactions | Combinatorial matrices (Themes x Padding x Radius x Ratios x Toggles), long thread downward expansion | **100% Pass** (0 failures allowed) | Blocks Milestone progression; failure signals CSS/state collision |
| **Tier 4** | Real-World Workflows | Full E2E user journeys from tweet observation to card generation, retina export, and fallback download | **100% Pass** (0 failures allowed) | Final Acceptance Gate for Extension Release |

---

## 5. Execution Command & Integration

The full test suite can be executed natively in one single command:

```powershell
node tests/runner.ts
```

Or individual test tiers:
```powershell
node tests/runner.ts tier1
node tests/runner.ts tier2
node tests/runner.ts tier3
node tests/runner.ts tier4
```
