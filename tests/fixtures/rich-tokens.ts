/**
 * Rich tokens DOM fixtures.
 * Covers @mentions, #hashtags, $cashtags, external t.co links, and trailing attachment links.
 */

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
