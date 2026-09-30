/**
 * Rich tokens DOM fixtures.
 * Covers @mentions, #hashtags, $cashtags, external t.co links, and trailing attachment links.
 */

export const RICH_TOKENS_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <span>FinTech Coder</span>
    <a href="/fintech"><span>@fintech</span></a>
    <a href="/fintech/status/9900"><time datetime="2026-09-01T15:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetText">
    <span>Shoutout to </span>
    <a href="/typescript" role="link">@typescript</a>
    <span> and </span>
    <a href="/preactjs" role="link">@preactjs</a>
    <span>! Loving </span>
    <a href="/hashtag/WebDev" role="link">#WebDev</a>
    <span> trends in 2026. Bullish on </span>
    <a href="/search?q=%24NVDA" role="link">$NVDA</a>
    <span> and </span>
    <a href="/search?q=%24BTC" role="link">$BTC</a>
    <span>. Read more: </span>
    <a href="https://t.co/xyz123" title="https://github.com/post-to-card" role="link">github.com/post-to-card</a>
    <a href="https://pic.twitter.com/hiddenpic" role="link">pic.twitter.com/hiddenpic</a>
  </div>
</article>
`;

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
