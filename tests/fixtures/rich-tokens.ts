/**
 * Rich tokens DOM fixtures.
 * Covers @mentions, #hashtags, $cashtags, external t.co links, and trailing attachment links.
 */

/**
 * A post whose body carries every token kind X marks up, plus the media
 * permalink X appends to the end.
 *
 * Written on one line on purpose: the body renders as `pre-wrap`, so the
 * indentation a pretty-printed fixture would add becomes paragraph breaks in the
 * extracted text. The anchors wrap their label in a `<span>` because that is the
 * shape X emits, and the external link carries its resolved URL in `title` while
 * the visible label stays in t.co display form.
 */
export const RICH_TOKENS_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name"><a href="/dev/status/7001"><time datetime="2026-08-01T00:00:00.000Z">Aug 1</time></a></div>
  <div data-testid="tweetText" lang="en">Shoutout to <a href="/typescript"><span>@typescript</span></a> and <a href="/preactjs"><span>@preactjs</span></a>! Loving <a href="/hashtag/WebDev"><span>#WebDev</span></a> trends in 2026. Bullish on <a href="/search?q=%24NVDA"><span>$NVDA</span></a> and <a href="/search?q=%24BTC"><span>$BTC</span></a>. Read more: <a href="https://t.co/AbCdEf123" title="https://github.com/post-to-card"><span>github.com/post-to-card</span></a><a href="https://pic.twitter.com/hiddenpic"><span>pic.twitter.com/hiddenpic</span></a></div>
  <div role="group" aria-label="1 回复、2 次转帖、3 喜欢"><div><button data-testid="reply"></button></div><div><button data-testid="like"></button></div></div>
</article>
`.trim();

export const EXPECTED_TOKENS = [
  { type: 'text', value: 'Shoutout to ' },
  { type: 'mention', value: '@typescript', href: '/typescript' },
  { type: 'text', value: ' and ' },
  { type: 'mention', value: '@preactjs', href: '/preactjs' },
  { type: 'text', value: '! Loving ' },
  { type: 'hashtag', value: '#WebDev', href: '/hashtag/WebDev' },
  { type: 'text', value: ' trends in 2026. Bullish on ' },
  { type: 'cashtag', value: '$NVDA', href: '/search?q=%24NVDA' },
  { type: 'text', value: ' and ' },
  { type: 'cashtag', value: '$BTC', href: '/search?q=%24BTC' },
  { type: 'text', value: '. Read more: ' },
  { type: 'link', value: 'github.com/post-to-card', href: 'https://github.com/post-to-card' },
];
