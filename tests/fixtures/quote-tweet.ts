/**
 * Quote Tweet nested DOM fixture.
 * Contains main tweet referencing an earlier quote post.
 */

import type { TweetData } from '../../src/types/tweet.ts';

export const QUOTE_TWEET_HTML = `
<article data-testid="tweet" class="main-quote-tweet">
  <div data-testid="Tweet-User-Avatar">
    <img alt="Satya" src="https://pbs.twimg.com/profile_images/888/satya_normal.jpg">
  </div>
  <div data-testid="User-Name">
    <span>Satya Nadella</span>
    <a href="/satyanadella" role="link"><span>@satyanadella</span></a>
    <a href="/satyanadella/status/5001" role="link">
      <time datetime="2026-05-01T12:00:00.000Z">May 1</time>
    </a>
  </div>
  <div data-testid="tweetText">
    <span>Excited to welcome the new Copilot features!</span>
  </div>

  <!-- Nested Quote Tweet Box -->
  <div role="link" tabindex="0" class="quote-box" data-testid="quoteTweet">
    <div data-testid="User-Name">
      <span>Sam Altman</span>
      <a href="/sama" role="link"><span>@sama</span></a>
      <a href="/sama/status/4999" role="link">
        <time datetime="2026-05-01T11:30:00.000Z">May 1</time>
      </a>
    </div>
    <div data-testid="tweetText">
      <span>GPT-5.5 is now rolling out to all users. Enjoy!</span>
    </div>
    <div data-testid="tweetPhoto">
      <img src="https://pbs.twimg.com/media/gpt_launch.png?format=png&name=small" alt="GPT Launch">
    </div>
  </div>

  <div role="group">
    <div data-testid="like"><span>12.5K</span></div>
  </div>
</article>
`;

export const EXPECTED_QUOTE_TWEET_DATA: TweetData = {
  id: '5001',
  url: 'https://x.com/satyanadella/status/5001',
  author: {
    name: 'Satya Nadella',
    handle: '@satyanadella',
    avatarUrl: 'https://pbs.twimg.com/profile_images/888/satya_400x400.jpg',
  },
  text: 'Excited to welcome the new Copilot features!',
  timestamp: '2026-05-01T12:00:00.000Z',
  quotePost: {
    author: {
      name: 'Sam Altman',
      handle: '@sama',
      avatarUrl: '',
    },
    text: 'GPT-5.5 is now rolling out to all users. Enjoy!',
    timestamp: '2026-05-01T11:30:00.000Z',
    media: [
      {
        type: 'image',
        url: 'https://pbs.twimg.com/media/gpt_launch.png?format=png&name=large',
        originalUrl: 'https://pbs.twimg.com/media/gpt_launch.png?format=png&name=small',
        alt: 'GPT Launch',
      }
    ],
  },
};
