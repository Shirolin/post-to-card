/**
 * Tier Resolver: Deep Unified Thread Resolution Test Suite.
 *
 * Verifies the contract of `resolveThread`:
 * 1. Prioritizes authoritative intercepted GraphQL data (source: 'graphql').
 * 2. Short-circuits full-timeline DOM traversal on GraphQL hit while folding in client-side translations.
 * 3. Falls back seamlessly to continuous DOM extraction on GraphQL miss (source: 'dom').
 * 4. Resolves targets across DOM elements, status URLs, and tweet ID strings.
 * 5. Provides safe non-throwing fallbacks for unresolvable targets.
 */

import assert from 'node:assert/strict';
import { createDomElement, DomDocument } from '../env/browser.ts';
import { resolveThread } from '../../src/content/adapter/resolver.ts';
import { initGraphQLBridge } from '../../src/content/graphql/bridge.ts';
import { TWEET_DETAIL_THREAD_JSON } from '../fixtures/graphql.ts';
import { THREAD_HTML } from '../fixtures/thread.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

type TestFn = () => void | Promise<void>;

const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

// Global window mock for GraphQL bridge dispatch in Node.js
type Listener = (e: any) => void;
const listeners = new Map<string, Set<Listener>>();

const mockWindow = {
  location: {
    origin: 'https://x.com',
    pathname: '/ada_builds/status/1001',
  },
  addEventListener: (type: string, cb: Listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(cb);
  },
  removeEventListener: (type: string, cb: Listener) => {
    listeners.get(type)?.delete(cb);
  },
  dispatchEvent: (event: any) => {
    for (const cb of listeners.get(event.type) || []) {
      cb(event);
    }
  },
};

(globalThis as any).window = mockWindow;
(globalThis as any).document = new DomDocument();

// Initialize bridge listener
initGraphQLBridge();

function seedGraphQLCache(body: string, operationName = 'TweetDetail', queryId = 'q_test_1'): void {
  mockWindow.dispatchEvent({
    type: 'message',
    origin: 'https://x.com',
    data: JSON.stringify({
      source: 'post-to-card-graphql',
      type: 'post-to-card:graphql-payload',
      operationName,
      queryId,
      status: 200,
      body,
    }),
  });
}

test('res.1: resolveThread prioritizes GraphQL data and marks diagnostics as source: graphql', () => {
  seedGraphQLCache(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q_resolved');

  // Request thread by tweet ID
  const thread = resolveThread('1001');

  assert.equal(thread.isSingle, false);
  assert.equal(thread.tweets.length, 3);
  assert.equal(thread.targetTweetIndex, 2);
  assert.equal(thread.author.handle, '@ada_builds');

  const targetTweet = thread.tweets[thread.targetTweetIndex];
  assert.equal(targetTweet.id, '1001');
  assert.equal(targetTweet.diagnostics?.source, 'graphql');
  assert.equal(targetTweet.diagnostics?.operationName, 'TweetDetail');
  assert.equal(targetTweet.diagnostics?.queryId, 'q_resolved');
});

test('res.2: resolveThread folds client-side DOM translation into GraphQL result', () => {
  seedGraphQLCache(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q_trans');

  // Create an article with translation notice matching tweet 1001
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/ada_builds"><span>@ada_builds</span></a></div>
      <div>
        <span>Translated from English</span>
        <button aria-label="Show original"><span>Show original</span></button>
      </div>
      <div data-testid="tweetText" lang="zh"><span>第一条推文（已翻译）</span></div>
      <a href="/ada_builds/status/1001">timestamp</a>
    </article>
  `);

  const thread = resolveThread(article);
  const targetTweet = thread.tweets[thread.targetTweetIndex];

  assert.equal(targetTweet.id, '1001');
  assert.equal(targetTweet.diagnostics?.source, 'graphql');
  assert.equal(targetTweet.translatedFrom, 'Translated from English');
  assert.equal(targetTweet.text, '第一条推文（已翻译）');
  // Author information remains authoritative from GraphQL
  assert.equal(thread.author.handle, '@ada_builds');
  assert.equal(thread.author.name, 'Ada Nakamura');
});

test('res.3: resolveThread falls back to DOM timeline extraction on GraphQL miss with source: dom', () => {
  mockWindow.location.pathname = '/home';

  // Query for a tweet ID not present in GraphQL cache
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/dom_author"><span>@dom_author</span></a></div>
      <div data-testid="tweetText"><span>Timeline post only</span></div>
      <a href="/dom_author/status/77777">timestamp</a>
    </article>
  `);

  const thread = resolveThread(article);

  assert.equal(thread.tweets.length, 1);
  assert.equal(thread.tweets[0].id, '77777');
  assert.equal(thread.tweets[0].diagnostics?.source, 'dom');
});

test('res.4: resolveThread handles status URL and child DOM element targets', () => {
  seedGraphQLCache(TWEET_DETAIL_THREAD_JSON, 'TweetDetail', 'q_target');

  // URL resolution
  const threadFromUrl = resolveThread('https://x.com/ada_builds/status/1002');
  assert.equal(threadFromUrl.targetTweetIndex, 1);
  assert.equal(threadFromUrl.tweets[1].id, '1002');
  assert.equal(threadFromUrl.tweets[1].diagnostics?.source, 'graphql');

  // Child element resolution
  const article = createDomElement(`
    <article data-testid="tweet">
      <a href="/ada_builds/status/1001"><span>time</span></a>
      <div class="actions">
        <button id="post-to-card-btn">Generate</button>
      </div>
    </article>
  `);
  const button = article.querySelector('#post-to-card-btn')!;
  const threadFromChild = resolveThread(button);
  const targetTweet = threadFromChild.tweets[threadFromChild.targetTweetIndex];
  assert.equal(targetTweet.id, '1001');
  assert.equal(targetTweet.diagnostics?.source, 'graphql');
});

test('res.5: resolveThread safely produces fallback thread for empty or unresolvable targets', () => {
  const emptyNull = resolveThread(null);
  assert.equal(emptyNull.tweets.length, 1);
  assert.equal(emptyNull.isSingle, true);
  assert.equal(emptyNull.author.name, 'Unknown');
  assert.equal(emptyNull.tweets[0].diagnostics?.source, 'dom');

  const emptyString = resolveThread('');
  assert.equal(emptyString.tweets.length, 1);
  assert.equal(emptyString.author.handle, '@unknown');
  assert.equal(emptyString.tweets[0].diagnostics?.source, 'dom');
});

export async function runTierResolver(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      results.push({ name: t.name, passed: true, durationMs: Date.now() - start });
      passed++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      results.push({ name: t.name, passed: false, error: errorMsg, durationMs: Date.now() - start });
      failed++;
    }
  }

  return { total: tests.length, passed, failed, results };
}
