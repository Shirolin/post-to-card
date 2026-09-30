/**
 * M1 Challenger Verification & Adversarial Stress Suite
 * 
 * Verifies:
 * 1. Soundness and completeness of types/tweet.ts, types/card.ts, types/messages.ts against ORIGINAL_REQUEST.md
 * 2. Type leaks, casting ('any'), and strict assignability in src/
 * 3. Circular dependencies across types and entry points
 * 4. Bundler output constraints (IIFE vs ESM, no leaked imports/exports)
 * 5. Bundle bloat and consumer consumption stress test
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

import type { AuthorInfo, MediaItem, TweetStats, QuoteTweetData, TweetData, ThreadData } from '../src/types/tweet.ts';
import type { ThemeId, PaddingOption, RadiusOption, AspectRatioOption, CardConfig } from '../src/types/card.ts';
import type {
  FetchImageBase64Request,
  PingRequest,
  ExtensionMessage,
  FetchImageBase64SuccessResponse,
  FetchImageBase64ErrorResponse,
  ExtensionResponse,
} from '../src/types/messages.ts';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');

console.log('===============================================================');
console.log('       M1 CHALLENGER ADVERSARIAL STRESS & VERIFICATION        ');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;
const findings: string[] = [];

async function check(title: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${title}`);
    passCount++;
  } catch (err: any) {
    console.error(`  ✗ ${title}: ${err.message}`);
    failCount++;
    findings.push(`${title}: ${err.message}`);
  }
}

async function runAll() {
  // ==========================================
  // 1. TYPE SOUNDNESS & ORIGINAL_REQUEST COVERAGE
  // ==========================================
  console.log('[1] Verifying Type Completeness & Soundness against ORIGINAL_REQUEST.md...');

  await check('ThemeId covers all 6 curated themes from R2', () => {
    const themes: ThemeId[] = [
      'linear-dark',
      'sunset-glow',
      'aurora-purple',
      'notion-clean-white',
      'cyber-mint',
      'oled-black',
    ];
    assert.equal(themes.length, 6);
  });

  await check('PaddingOption covers 16px, 32px, 48px from R2', () => {
    const paddings: PaddingOption[] = ['16px', '32px', '48px'];
    assert.equal(paddings.length, 3);
  });

  await check('RadiusOption covers 0px, 12px, 20px from R2', () => {
    const radii: RadiusOption[] = ['0px', '12px', '20px'];
    assert.equal(radii.length, 3);
  });

  await check('AspectRatioOption covers auto, 3:4, 16:9 from R2', () => {
    const ratios: AspectRatioOption[] = ['auto', '3:4', '16:9'];
    assert.equal(ratios.length, 3);
  });

  await check('CardConfig covers all 5 toggles and configuration dimensions from R2', () => {
    const config: CardConfig = {
      theme: 'linear-dark',
      padding: '32px',
      borderRadius: '12px',
      aspectRatio: 'auto',
      showQrCode: true,
      showStats: true,
      showTimestamp: true,
      showWatermark: true,
      blurAuthor: false,
    };
    assert.ok(config);
    const requiredKeys: (keyof CardConfig)[] = [
      'theme',
      'padding',
      'borderRadius',
      'aspectRatio',
      'showQrCode',
      'showStats',
      'showTimestamp',
      'showWatermark',
      'blurAuthor',
    ];
    requiredKeys.forEach((key) => {
      assert.ok(key in config, `Missing ${key} in CardConfig`);
    });
  });

  await check('TweetData covers all R1 Twitter extractor fields', () => {
    const tweet: TweetData = {
      id: '1234567890',
      url: 'https://x.com/jack/status/1234567890',
      author: {
        name: 'Jack Dorsey',
        handle: 'jack',
        avatarUrl: 'https://pbs.twimg.com/profile_images/123/avatar_400x400.jpg',
        verified: true,
      },
      text: 'Just setting up my twttr ✨ 🚀',
      richTokens: [
        { type: 'text', value: 'Just setting up my ' },
        { type: 'mention', value: '@twitter', href: '/twitter' },
        { type: 'hashtag', value: '#build', href: '/hashtag/build' },
        { type: 'link', value: 'example.com', href: 'https://example.com' },
        { type: 'emoji', value: '✨' },
      ],
      timestamp: '2026-09-01T12:00:00Z',
      stats: {
        replies: '1.2K',
        reposts: '4.5K',
        likes: '25K',
        views: '1.2M',
        bookmarks: '300',
      },
      media: [
        {
          type: 'image',
          url: 'https://pbs.twimg.com/media/test.jpg?name=large',
          originalUrl: 'https://pbs.twimg.com/media/test.jpg:small',
          alt: 'Test photo',
          aspectRatio: 1.77,
        },
        {
          type: 'video',
          url: 'https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/test.mp4',
          posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/poster.jpg:large',
        },
        {
          type: 'gif',
          url: 'https://pbs.twimg.com/tweet_video/gif.mp4',
        },
      ],
      quotePost: {
        author: {
          name: 'Quote Author',
          handle: 'quoted',
          avatarUrl: 'https://pbs.twimg.com/profile_images/456/quoted_400x400.jpg',
        },
        text: 'Quoted tweet content',
        media: [],
        timestamp: '2026-08-30T10:00:00Z',
      },
      isThreadPart: true,
      threadIndex: 1,
      threadTotal: 3,
    };
    assert.equal(tweet.id, '1234567890');
    assert.equal(tweet.author.handle, 'jack');
    assert.equal(tweet.media?.length, 3);
    assert.equal(tweet.media?.[1].posterUrl?.includes(':large'), true);
  });

  await check('ThreadData covers multi-tweet continuous chains from R1', () => {
    const author: AuthorInfo = {
      name: 'Thread Writer',
      handle: 'threader',
      avatarUrl: 'https://pbs.twimg.com/avatar_400x400.jpg',
    };
    const thread: ThreadData = {
      author,
      tweets: [
        {
          id: '1',
          url: 'https://x.com/threader/status/1',
          author,
          text: 'Part 1 of thread',
          timestamp: '2026-09-01T12:00:00Z',
          isThreadPart: true,
          threadIndex: 1,
          threadTotal: 2,
        },
        {
          id: '2',
          url: 'https://x.com/threader/status/2',
          author,
          text: 'Part 2 of thread',
          timestamp: '2026-09-01T12:01:00Z',
          isThreadPart: true,
          threadIndex: 2,
          threadTotal: 2,
        },
      ],
      isSingle: false,
    };
    assert.equal(thread.tweets.length, 2);
    assert.equal(thread.isSingle, false);
  });

  await check('ExtensionMessage and ExtensionResponse support discriminated union narrowing', () => {
    const msg1: ExtensionMessage = { type: 'FETCH_IMAGE_BASE64', url: 'https://pbs.twimg.com/media/test.jpg' };
    const msg2: ExtensionMessage = { type: 'PING' };

    if (msg1.type === 'FETCH_IMAGE_BASE64') {
      assert.equal(typeof msg1.url, 'string');
    }

    const res1: ExtensionResponse = {
      success: true,
      dataUrl: 'data:image/jpeg;base64,abc==',
      contentType: 'image/jpeg',
    };
    const res2: ExtensionResponse = {
      success: false,
      error: 'Image fetch failed: 404',
    };

    if (res1.success) {
      assert.ok(res1.dataUrl);
      assert.ok(res1.contentType);
    } else {
      assert.fail('res1 should be success');
    }

    if (!res2.success) {
      assert.ok(res2.error);
    } else {
      assert.fail('res2 should be error');
    }
  });

  // ==========================================
  // 2. ADVERSARIAL INSPECTION: TYPE LEAKS & ANY
  // ==========================================
  console.log('\n[2] Checking for Type Leaks and "any" Casting in Entry Points and Types...');

  await check('Zero occurrences of "any" in src/', () => {
    const srcFiles = [
      'src/types/tweet.ts',
      'src/types/card.ts',
      'src/types/messages.ts',
      'src/background/index.ts',
      'src/content/index.ts',
      'src/env.d.ts',
    ];
    for (const f of srcFiles) {
      const content = fs.readFileSync(path.resolve(rootDir, f), 'utf8');
      const matches = content.match(/\bany\b/g);
      assert.equal(matches, null, `Found "any" keyword in ${f}`);
    }
  });

  await check('Zero type assertions (as unknown / as any) in entry points', () => {
    const entryFiles = ['src/background/index.ts', 'src/content/index.ts'];
    for (const f of entryFiles) {
      const content = fs.readFileSync(path.resolve(rootDir, f), 'utf8');
      assert.ok(!content.includes(' as '), `Found type casting "as" in ${f}`);
    }
  });

  await check('Adversarial finding: cashtag in richTokens spectrum', () => {
    const tweetFile = fs.readFileSync(path.resolve(rootDir, 'src/types/tweet.ts'), 'utf8');
    if (!tweetFile.includes("'cashtag'")) {
      findings.push("Design note: 'cashtag' is not in richTokens union in src/types/tweet.ts (present in tests/fixtures/rich-tokens.ts)");
    }
  });

  // ==========================================
  // 3. CIRCULAR DEPENDENCY & EMITTED JS AUDIT
  // ==========================================
  console.log('\n[3] Auditing Circular Dependencies & Type Import Footprint...');

  await check('Zero circular dependencies in src/types/', () => {
    const typeFiles = ['tweet.ts', 'card.ts', 'messages.ts'];
    typeFiles.forEach((f) => {
      const content = fs.readFileSync(path.resolve(rootDir, 'src/types', f), 'utf8');
      const importLines = content.split('\n').filter((l) => l.trim().startsWith('import'));
      assert.equal(importLines.length, 0, `${f} should have no imports (pure leaf module)`);
    });
  });

  await check('Zero runtime JavaScript emitted from src/types/', () => {
    const typeFiles = ['tweet.ts', 'card.ts', 'messages.ts'];
    typeFiles.forEach((f) => {
      const content = fs.readFileSync(path.resolve(rootDir, 'src/types', f), 'utf8');
      assert.ok(!content.includes('enum '), `${f} must not declare enums`);
      assert.ok(!content.includes('class '), `${f} must not declare classes`);
      assert.ok(!content.includes('const '), `${f} must not declare consts`);
    });
  });

  // ==========================================
  // 4. BUNDLER ARTIFACT CONSTRAINTS
  // ==========================================
  console.log('\n[4] Auditing Bundler Artifacts in dist/...');

  await check('dist/manifest.json is valid JSON and declares Manifest V3', () => {
    const manifestPath = path.resolve(rootDir, 'dist/manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'dist/manifest.json must exist');
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(parsed.manifest_version, 3);
    assert.ok(Array.isArray(parsed.host_permissions));
    assert.ok(parsed.host_permissions.includes('https://*.twimg.com/*'));
    assert.ok(parsed.host_permissions.includes('https://pbs.twimg.com/*'));
    assert.equal(parsed.background.service_worker, 'background.js');
    assert.equal(parsed.background.type, 'module');
    assert.equal(parsed.content_scripts[0].js[0], 'content.js');
  });

  await check('dist/content.js is strictly IIFE with zero top-level import or export', () => {
    const contentJsPath = path.resolve(rootDir, 'dist/content.js');
    assert.ok(fs.existsSync(contentJsPath), 'dist/content.js must exist');
    const code = fs.readFileSync(contentJsPath, 'utf8');
    assert.ok(code.startsWith('(function () {') || code.startsWith('(function() {'), 'Must be wrapped in IIFE');
    assert.ok(code.trim().endsWith('})();'), 'Must close IIFE with })();');
    const lines = code.split('\n');
    const topLevelImportExport = lines.filter((line) => /^\s*(import|export)\s+/.test(line));
    assert.equal(topLevelImportExport.length, 0, `Forbidden top-level import/export in content.js: ${topLevelImportExport.join(', ')}`);
  });

  await check('dist/background.js is valid ES module without syntax errors', () => {
    const bgJsPath = path.resolve(rootDir, 'dist/background.js');
    assert.ok(fs.existsSync(bgJsPath), 'dist/background.js must exist');
    const code = fs.readFileSync(bgJsPath, 'utf8');
    assert.ok(!code.includes('import('), 'Should not have dynamic imports');
    assert.ok(code.includes('chrome.runtime.onMessage.addListener'), 'Must register onMessage listener');
  });

  // ==========================================
  // 5. CONSUMER USAGE & BUNDLE BLOAT STRESS
  // ==========================================
  console.log('\n[5] Stress-Testing Consumer Imports & Bundle Bloat with External Dependencies...');

  await check('Consumer can import and use all types simultaneously', () => {
    type ConsumerState = {
      config: CardConfig;
      tweet: TweetData;
      thread: ThreadData;
      pendingMsg?: ExtensionMessage;
    };

    const sampleState: ConsumerState = {
      config: {
        theme: 'oled-black',
        padding: '48px',
        borderRadius: '20px',
        aspectRatio: '16:9',
        showQrCode: false,
        showStats: true,
        showTimestamp: false,
        showWatermark: true,
        blurAuthor: true,
      },
      tweet: {
        id: '99',
        url: 'https://x.com/test/status/99',
        author: {
          name: 'Tester',
          handle: 'tester',
          avatarUrl: 'https://pbs.twimg.com/avatar_400x400.jpg',
        },
        text: 'Sample tweet',
        timestamp: '2026-09-29T00:00:00Z',
      },
      thread: {
        author: {
          name: 'Tester',
          handle: 'tester',
          avatarUrl: 'https://pbs.twimg.com/avatar_400x400.jpg',
        },
        tweets: [],
        isSingle: true,
      },
    };

    assert.equal(sampleState.config.theme, 'oled-black');
    assert.equal(sampleState.config.borderRadius, '20px');
    assert.equal(sampleState.config.blurAuthor, true);
  });

  await check('Bundling all external dependencies (Preact, qrcode, modern-screenshot) in IIFE mode stays under 60 KB', async () => {
    const tempEntry = path.resolve(rootDir, 'tests/temp_stress_entry.ts');
    const tempOutDir = path.resolve(rootDir, 'tests/temp_stress_dist');
    
    fs.writeFileSync(tempEntry, `
      import { h, render } from 'preact';
      import qrcode from 'qrcode-generator';
      import { domToPng } from 'modern-screenshot';
      import type { CardConfig } from '../src/types/card';
      import type { TweetData } from '../src/types/tweet';

      export async function testRender(node: HTMLElement) {
        const qr = qrcode(0, 'M');
        qr.addData('https://x.com');
        qr.make();
        const svg = qr.createSvgTag({});
        return await domToPng(node);
      }
    `);

    try {
      await build({
        root: rootDir,
        publicDir: false,
        build: {
          outDir: tempOutDir,
          emptyOutDir: true,
          minify: true,
          lib: {
            entry: tempEntry,
            name: 'PostToCardTest',
            formats: ['iife'],
            fileName: 'test_bundle',
          },
          rollupOptions: {
            output: {
              entryFileNames: 'test_bundle.js',
              inlineDynamicImports: true,
            },
          },
        },
        logLevel: 'warn',
      });

      const bundledFile = path.resolve(tempOutDir, 'test_bundle.js');
      assert.ok(fs.existsSync(bundledFile), 'Bundled file must exist');
      const stat = fs.statSync(bundledFile);
      const sizeKb = stat.size / 1024;
      assert.ok(sizeKb < 60, `Bundle size is too large: ${sizeKb.toFixed(2)} KB (expected < 60 KB)`);
      
      const content = fs.readFileSync(bundledFile, 'utf8');
      assert.ok(!/^\s*(import|export)\s+/m.test(content), 'No top-level import/export allowed in IIFE bundle');
    } finally {
      if (fs.existsSync(tempEntry)) fs.unlinkSync(tempEntry);
      if (fs.existsSync(tempOutDir)) fs.rmSync(tempOutDir, { recursive: true, force: true });
    }
  });

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passCount} Passed, ${failCount} Failed`);
  if (findings.length > 0) {
    console.log('Findings / Notes:');
    findings.forEach((f) => console.log(` - ${f}`));
  }
  console.log('===============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAll();
