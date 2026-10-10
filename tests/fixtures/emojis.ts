/**
 * Twemoji restoration DOM fixtures.
 * Verifies that Twitter's image-based Twemoji tags are accurately converted back
 * to standard Unicode emojis without text loss or empty spacing.
 */

export const EMOJI_TWEET_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <span>Alex</span>
    <img alt="🚀" src="https://abs-0.twimg.com/emoji/v2/svg/1f680.svg" class="emoji">
    <a href="/alex"><span>@alex</span></a>
    <a href="/alex/status/7001">
      <time datetime="2026-06-15T08:00:00.000Z">Jun 15</time>
    </a>
  </div>
  <div data-testid="tweetText">
    <span>Big release today!</span>
    <img alt="🔥" src="https://abs-0.twimg.com/emoji/v2/svg/1f525.svg" class="emoji">
    <span>Post to Card is live</span>
    <img alt="✨" src="https://abs-0.twimg.com/emoji/v2/svg/2728.svg" class="emoji">
    <img alt="🎉" src="https://abs-0.twimg.com/emoji/v2/svg/1f389.svg" class="emoji">
    <br>
    <span>Try it offline now</span>
    <img alt="💻" src="https://abs-0.twimg.com/emoji/v2/svg/1f4bb.svg" class="emoji">
  </div>
</article>
`;

export const PURE_EMOJI_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <span>Emoji Master</span>
    <a href="/emojilover"><span>@emojilover</span></a>
    <a href="/emojilover/status/7002">
      <time datetime="2026-06-15T09:00:00.000Z">Jun 15</time>
    </a>
  </div>
  <div data-testid="tweetText">
    <img alt="😀" src="https://abs-0.twimg.com/emoji/v2/svg/1f600.svg">
    <img alt="😃" src="https://abs-0.twimg.com/emoji/v2/svg/1f603.svg">
    <img alt="😄" src="https://abs-0.twimg.com/emoji/v2/svg/1f604.svg">
    <img alt="😁" src="https://abs-0.twimg.com/emoji/v2/svg/1f601.svg">
  </div>
</article>
`;
