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
import { createSuite } from '../env/harness.ts';
import { resolveThread } from '../../src/content/adapter/resolver.ts';
import { initGraphQLBridge } from '../../src/content/graphql/bridge.ts';
import { lookupReplyLink } from '../../src/content/graphql/bridge.ts';
import { TWEET_DETAIL_THREAD_JSON, TWEET_DETAIL_SHALLOW_QUOTE_JSON, HOME_TIMELINE_SELF_THREAD_JSON, HOME_TIMELINE_UNLINKED_PAIR_JSON, TWEET_DETAIL_ARTICLE_JSON } from '../fixtures/graphql.ts';
import { ARTICLE_TWEET_HTML } from '../fixtures/article-tweet.ts';
import { NESTED_QUOTE_PREVIEW_HTML } from '../fixtures/nested-quote-preview.ts';
import { FEED_SELF_THREAD_HTML } from '../fixtures/thread.ts';

const { test, run } = createSuite();

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
    data: {
      source: 'post-to-card-graphql',
      type: 'post-to-card:graphql-payload',
      operationName,
      queryId,
      status: 200,
      body,
    },
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

test('res.6: a click in a feed proves its thread from the captured timeline payload', () => {
  mockWindow.location.pathname = '/home';
  const feed = createDomElement(FEED_SELF_THREAD_HTML);
  const target = feed.querySelector('#feed-post-2')!;

  // A list view renders a thread's sections as plainly adjacent posts, so this
  // is the case that used to lose the thread: no marker, no payload, one post.
  const alone = resolveThread(target);
  assert.equal(alone.tweets.length, 1, 'no marker and no payload means no thread');
  assert.equal(alone.tweets[0].id, '9002');

  // The page's own timeline response says 9002 answers 9001, which is exactly
  // the condition X threads by.
  seedGraphQLCache(HOME_TIMELINE_SELF_THREAD_JSON, 'HomeTimeline', 'q_feed');
  const thread = resolveThread(target);

  assert.equal(thread.isSingle, false, 'the payload names 9002 as answering 9001');
  assert.deepEqual(thread.tweets.map((t) => t.id), ['9001', '9002']);
  assert.equal(thread.targetTweetIndex, 1, 'the clicked post is still the target');
  assert.ok(
    thread.tweets.every((t) => t.diagnostics?.source === 'dom'),
    'the payload proves the boundary; the content is still the page markup'
  );

  // The payload is not a veto, it is one more signal: a post that answers
  // someone else falls through to the DOM checks, so a profile's plain
  // consecutive posts stay separate. On a real profile page 10 of 11 adjacent
  // same-author pairs are exactly this, which is why the negative half matters
  // as much as the merge above.
  seedGraphQLCache(HOME_TIMELINE_UNLINKED_PAIR_JSON, 'HomeTimeline', 'q_feed_unlinked');
  const unlinked = resolveThread(target);

  assert.equal(unlinked.isSingle, true, 'the payload names someone else, so adjacency proves nothing');
  assert.equal(unlinked.tweets.length, 1);
  assert.equal(unlinked.tweets[0].id, '9002');
});

test('res.7: a conversation payload feeds the linkage index too', () => {
  // The index is built from every captured payload, not only from the list
  // views: the parser is shape-agnostic, and a status page visited before an SPA
  // navigation is the only payload a later list-view click may have. A
  // `TweetDetail` body is therefore a source as well, and this pins the wiring
  // rather than the parser.
  const body = JSON.stringify({
    data: {
      threaded_conversation_with_injections_v2: {
        instructions: [
          {
            entries: [
              {
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: '6002',
                        legacy: {
                          id_str: '6002',
                          full_text: 'the continuation',
                          in_reply_to_status_id_str: '6001',
                          in_reply_to_screen_name: 'alice',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    },
  });
  seedGraphQLCache(body, 'TweetDetail', 'q_detail_link');

  assert.equal(lookupReplyLink('6002')?.inReplyToId, '6001', 'the conversation states the same fact');
});

const DETAIL_REPLY_THREAD_HTML = `
<div id="conversation-container">
  <article data-testid="tweet" id="root-post">
    <div data-testid="User-Name">
      <a href="/bob"><span>Bob</span></a>
      <span>@bob</span>
    </div>
    <div data-testid="tweetText"><span>Original funny meme</span></div>
    <a href="/bob/status/7001"><time datetime="2026-10-12T10:00:00.000Z">10:00 AM</time></a>
  </article>
  <article data-testid="tweet" id="reply-post">
    <div data-testid="socialContext">
      <span>Replying to </span><a href="/bob">@bob</a>
    </div>
    <div data-testid="User-Name">
      <a href="/lauren"><span>Lauren</span></a>
      <span>@lauren</span>
    </div>
    <div data-testid="tweetText"><span>tibo is pretty funny sometimes</span></div>
    <a href="/lauren/status/7002"><time datetime="2026-10-12T10:05:00.000Z">10:05 AM</time></a>
  </article>
</div>
`;

test('res.8: on a status detail page, clicking a reply extracts its ancestor thread context', () => {
  mockWindow.location.pathname = '/bob/status/7001';
  const container = createDomElement(DETAIL_REPLY_THREAD_HTML);
  const replyPost = container.querySelector('#reply-post')!;

  const thread = resolveThread(replyPost);
  assert.equal(thread.isSingle, false, 'reply must form a thread with its ancestor root post');
  assert.equal(thread.tweets.length, 2, 'thread should contain [root, reply]');
  assert.equal(thread.tweets[0].id, '7001');
  assert.equal(thread.tweets[0].author.handle, '@bob');
  assert.equal(thread.tweets[1].id, '7002');
  assert.equal(thread.tweets[1].author.handle, '@lauren');
  assert.equal(thread.targetTweetIndex, 1, 'targetTweetIndex must point to the clicked reply');
  assert.equal(thread.author.handle, '@lauren', 'thread author should be the target reply author');
});

test('res.9: outside a status detail page (feed/profile), verified reply extracts immediate ancestor context', () => {
  mockWindow.location.pathname = '/home';
  const container = createDomElement(DETAIL_REPLY_THREAD_HTML);
  const replyPost = container.querySelector('#reply-post')!;

  const thread = resolveThread(replyPost);
  assert.equal(thread.isSingle, false, 'feed reply with verified ancestor context must form a thread');
  assert.equal(thread.tweets.length, 2, 'thread should contain [root, reply]');
  assert.equal(thread.tweets[0].id, '7001');
  assert.equal(thread.tweets[0].author.handle, '@bob');
  assert.equal(thread.tweets[1].id, '7002');
  assert.equal(thread.tweets[1].author.handle, '@lauren');
  assert.equal(thread.targetTweetIndex, 1);
});

test('res.9b: outside a status detail page (feed/profile), reply without matching predecessor stays single', () => {
  mockWindow.location.pathname = '/home';
  const html = `
    <div id="timeline">
      <article data-testid="tweet" id="unrelated-post">
        <div data-testid="User-Name"><a href="/charlie"><span>@charlie</span></a></div>
        <div data-testid="tweetText"><span>Unrelated timeline post</span></div>
        <a href="/charlie/status/8001"><time datetime="2026-10-12T10:00:00.000Z">10:00 AM</time></a>
      </article>
      <article data-testid="tweet" id="reply-post">
        <div data-testid="socialContext">
          <span>Replying to </span><a href="/bob">@bob</a>
        </div>
        <div data-testid="User-Name"><a href="/lauren"><span>@lauren</span></a></div>
        <div data-testid="tweetText"><span>Replying to someone not here</span></div>
        <a href="/lauren/status/8002"><time datetime="2026-10-12T10:05:00.000Z">10:05 AM</time></a>
      </article>
    </div>
  `;
  const container = createDomElement(html);
  const replyPost = container.querySelector('#reply-post')!;

  const thread = resolveThread(replyPost);
  assert.equal(thread.isSingle, true, 'unmatched feed reply must stay single');
  assert.equal(thread.tweets.length, 1);
  assert.equal(thread.tweets[0].id, '8002');
});

test('res.9c: in feed, GraphQL replyLink accurately connects predecessor even across DOM differences', () => {
  mockWindow.location.pathname = '/home';
  const html = `
    <div id="timeline">
      <article data-testid="tweet" id="post-a">
        <div data-testid="User-Name"><a href="/alice"><span>@alice</span></a></div>
        <div data-testid="tweetText"><span>Alice question</span></div>
        <a href="/alice/status/8101"><time datetime="2026-10-12T10:00:00.000Z">10:00 AM</time></a>
      </article>
      <article data-testid="tweet" id="post-b">
        <div data-testid="User-Name"><a href="/bob"><span>@bob</span></a></div>
        <div data-testid="tweetText"><span>Bob reply to Alice</span></div>
        <a href="/bob/status/8102"><time datetime="2026-10-12T10:05:00.000Z">10:05 AM</time></a>
      </article>
    </div>
  `;
  const feedPayload = JSON.stringify({
    data: {
      home: {
        home_timeline_urt: {
          instructions: [
            {
              entries: [
                {
                  entryId: 'tweet-8101',
                  content: { itemContent: { tweet_results: { result: { rest_id: '8101', legacy: { id_str: '8101', full_text: 'Alice question' } } } } },
                },
                {
                  entryId: 'tweet-8102',
                  content: { itemContent: { tweet_results: { result: { rest_id: '8102', legacy: { id_str: '8102', full_text: 'Bob reply to Alice', in_reply_to_status_id_str: '8101' } } } } },
                },
              ],
            },
          ],
        },
      },
    },
  });
  seedGraphQLCache(feedPayload, 'HomeTimeline', 'q_feed_reply_link');

  const container = createDomElement(html);
  const postB = container.querySelector('#post-b')!;

  const thread = resolveThread(postB);
  assert.equal(thread.isSingle, false, 'GraphQL linkage in feed must connect parent post');
  assert.equal(thread.tweets.length, 2);
  assert.equal(thread.tweets[0].id, '8101');
  assert.equal(thread.tweets[1].id, '8102');
});

test('res.10: on a status detail page, clicking the root post does not merge replies downwards', () => {
  mockWindow.location.pathname = '/bob/status/7001';
  const container = createDomElement(DETAIL_REPLY_THREAD_HTML);
  const rootPost = container.querySelector('#root-post')!;

  const thread = resolveThread(rootPost);
  assert.equal(thread.isSingle, true, 'clicking root post must not merge replies downwards');
  assert.equal(thread.tweets.length, 1);
  assert.equal(thread.tweets[0].id, '7001');
  assert.equal(thread.tweets[0].author.handle, '@bob');
});

test('res.11: on a status detail page, clicking reply B preserves all 4 GIFs on root post A', () => {
  mockWindow.location.pathname = '/alice/status/9001';
  const html = `
    <div id="conversation-container">
      <article data-testid="tweet" id="root-post">
        <div data-testid="User-Name"><a href="/alice"><span>@alice</span></a></div>
        <div data-testid="tweetText"><span>Root post with 4 GIFs</span></div>
        <a href="/alice/status/9001"><time datetime="2026-10-10T00:00:00.000Z"></time></a>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/tweet_video_thumb/g1.jpg" alt="GIF 1">
          <div><span>GIF</span></div>
        </div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/tweet_video_thumb/g2.jpg" alt="GIF 2">
          <div><span>GIF</span></div>
        </div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/tweet_video_thumb/g3.jpg" alt="GIF 3">
          <div><span>GIF</span></div>
        </div>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/tweet_video_thumb/g4.jpg" alt="GIF 4">
          <div><span>GIF</span></div>
        </div>
      </article>
      <article data-testid="tweet" id="reply-post">
        <div data-testid="User-Name"><a href="/bob"><span>@bob</span></a></div>
        <div data-testid="tweetText"><span>Reply with 1 photo</span></div>
        <a href="/bob/status/9002"><time datetime="2026-10-10T00:05:00.000Z"></time></a>
        <div data-testid="tweetPhoto">
          <img src="https://pbs.twimg.com/media/bob_photo.jpg" alt="Bob Photo">
        </div>
      </article>
    </div>
  `;

  const container = createDomElement(html);
  const replyPost = container.querySelector('#reply-post')!;

  const thread = resolveThread(replyPost);
  assert.equal(thread.isSingle, false, 'reply must form a conversation thread with root post');
  assert.equal(thread.tweets.length, 2, 'thread must contain [root, reply]');
  assert.equal(thread.targetTweetIndex, 1, 'target tweet must point to reply');

  // Verify Root Post A has all 4 GIFs intact
  const rootTweet = thread.tweets[0];
  assert.equal(rootTweet.id, '9001');
  assert.ok(rootTweet.media && rootTweet.media.length === 4, 'Root post must preserve all 4 GIFs without loss');
  assert.ok(rootTweet.media.every((m) => m.type === 'gif'), 'All root media must be of type gif');

  // Verify Reply Post B has its 1 photo intact
  const replyTweet = thread.tweets[1];
  assert.equal(replyTweet.id, '9002');
  assert.ok(replyTweet.media && replyTweet.media.length === 1, 'Reply post must retain its own media');
  assert.equal(replyTweet.media[0].type, 'image');
});

test('res.12: a GraphQL quote truncated at depth 1 is backfilled from the DOM', () => {
  // Real `TweetDetail` shape for a quote of a quote: the outer
  // `quoted_status_result` carries no deeper `quoted_status_result`, so the
  // parser can only produce one level. The DOM still renders both
  // (`nestedQuotePreview` + `nestedQuotePreviewMedia`), and the resolver must
  // adopt the DOM's deeper levels instead of dropping the innermost post.
  seedGraphQLCache(TWEET_DETAIL_SHALLOW_QUOTE_JSON, 'TweetDetail', 'q_shallow_quote');

  const article = createDomElement(NESTED_QUOTE_PREVIEW_HTML);
  const thread = resolveThread(article);
  const target = thread.tweets[thread.targetTweetIndex ?? 0];

  assert.equal(target.id, '2110105649778700290');
  assert.equal(target.diagnostics?.source, 'graphql', 'GraphQL stays authoritative where it answered');
  assert.equal(target.quotePost?.author.handle, '@devindevelopers');

  const inner = target.quotePost?.quotePost;
  assert.ok(inner, 'the DOM’s deeper level must survive the GraphQL hit');
  assert.equal(inner!.author.handle, '@cognition');
  assert.ok(inner!.text.includes('FrontierCode'), 'the innermost body comes along');
  assert.ok(inner!.media && inner!.media.length === 1, 'and so does its picture');
  assert.match(inner!.media![0].originalUrl || '', /HUhftVoasAAzqss/);

  // The backfill only fills what GraphQL left absent: the outer level keeps
  // the payload's own words even though the DOM renders a translation.
  assert.equal(
    target.quotePost?.text,
    'Gemini 4 Argon is now available in Devin Desktop and CLI.',
    'GraphQL stays authoritative for the levels it answered'
  );
});

test('res.13: a DOM answer says why the GraphQL channel was not the answer', () => {
  // X swallows a failed request silently, so a channel that has stopped
  // working is indistinguishable from one that never fired — unless somebody
  // says so. The resolver is the only place that knows both happened, so the
  // reason the channel missed is recorded on the records that did answer.
  //
  // This is what makes a rotated endpoint visible: an endpoint that answers
  // with nothing but a 200 is the `no-tweets` case, and a rise in it is the
  // early warning that the query ids moved.
  const article = createDomElement(`
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/dom_author"><span>@dom_author</span></a></div>
      <div data-testid="tweetText"><span>Timeline post only</span></div>
      <a href="/dom_author/status/88888">timestamp</a>
    </article>
  `);

  // A captured payload that parses but carries no tweets.
  seedGraphQLCache('{"data":{}}', 'TweetDetail', 'q_empty');
  const empty = resolveThread(article);
  assert.equal(empty.tweets[0].diagnostics?.source, 'dom');
  assert.equal(
    empty.tweets[0].diagnostics?.graphqlMiss,
    'no-tweets',
    'an empty payload must be reported as the empty response it is'
  );

  // A captured payload whose shape this parser does not know — what X
  // changing the payload looks like from here. The `data` member itself is
  // not an object, so the parser cannot even tell where the tweets would be.
  seedGraphQLCache('{"data":"a string where an object belongs"}', 'TweetDetail', 'q_shape');
  const changed = resolveThread(article);
  assert.equal(
    changed.tweets[0].diagnostics?.graphqlMiss,
    'unexpected-shape',
    'a shape this build does not know must be told apart from an empty one'
  );

  // And a payload that carried tweets this build could not read.
  seedGraphQLCache('{"data":{"threaded_conversation_with_injections_v2":{"instructions":[]}}}', 'TweetDetail', 'q_none');
  const parsed = resolveThread(article);
  assert.equal(
    parsed.tweets[0].diagnostics?.graphqlMiss,
    'no-tweets',
    'a payload with no instructions is still an empty payload'
  );
});

test('res.14: a DOM answer that never asked GraphQL records no miss', () => {
  // The channel is only asked when there is an id to ask about, and an id
  // comes either from the post's own permalink or from the page's URL. A
  // timeline post on a feed has neither — the feed URL names no post — so the
  // channel is never asked, and "the channel was not asked" and "the channel
  // was asked and failed" are different facts, of which only the second is a
  // warning.
  mockWindow.location.pathname = '/home';
  try {
    const article = createDomElement(`
      <article data-testid="tweet">
        <div data-testid="User-Name"><a href="/dom_author"><span>@dom_author</span></a></div>
        <div data-testid="tweetText"><span>Timeline post only</span></div>
      </article>
    `);

    const thread = resolveThread(article);
    assert.equal(thread.tweets[0].diagnostics?.source, 'dom');
    assert.equal(
      thread.tweets[0].diagnostics?.graphqlMiss,
      undefined,
      'the channel was never asked, so nothing was missed'
    );
  } finally {
    mockWindow.location.pathname = '/ada_builds/status/1001';
  }
});

test('res.15: an article the detail payload omits is backfilled from the DOM', () => {
  // `TweetDetail` answers with the post's body but not its article, and it is
  // tried before `TweetResultByRestId`. The payload then won the merge, so the
  // card lost the cover and title and kept the `/i/article/` tail: the parser
  // only drops that link when the payload carried the article itself.
  const payload = JSON.parse(TWEET_DETAIL_ARTICLE_JSON);
  const result =
    payload.data.threaded_conversation_with_injections_v2.instructions[0]
      .entries[0].content.itemContent.tweet_results.result;
  delete result.article;
  seedGraphQLCache(JSON.stringify(payload), 'TweetDetail', 'q_no_article');

  const thread = resolveThread(createDomElement(ARTICLE_TWEET_HTML));
  const target = thread.tweets[thread.targetTweetIndex ?? 0];

  assert.equal(target.diagnostics?.source, 'graphql', 'the payload still answered');
  assert.equal(target.article?.title, 'Anime Harry Potter', 'the article comes from the DOM');
  const tokenText = (target.richTokens || []).map((token) => token.value).join('');
  assert.doesNotMatch(tokenText, /i\/article/, 'the payload\'s tail is dropped from the tokens');
  assert.doesNotMatch(target.text, /t\.co/, 'and from the text fallback');
  assert.match(target.text, /promised write up/, 'the author\'s own body survives');
});

export function runTierResolver() {
  return run();
}
