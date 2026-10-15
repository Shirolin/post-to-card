/**
 * Quote Tweet nested DOM fixture.
 * Contains main tweet referencing an earlier quote post.
 *
 * Hand-built to the shape X emits rather than pasted from a capture, so treat
 * the structure as the claim and the strings as placeholders. The one detail
 * that is load-bearing: the display-name link and the handle link share an
 * href, which is why the handle has to be derived from the href.
 */

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

  <!-- Nested Quote Tweet Box: display-name link shares href with the handle link,
       mirroring current Twitter/X so handle must be derived from href, not text -->
  <div role="link" tabindex="0" class="quote-box" data-testid="quoteTweet">
    <div data-testid="Tweet-User-Avatar">
      <img alt="Sam" src="https://pbs.twimg.com/profile_images/999/sama_normal.jpg">
    </div>
    <div data-testid="User-Name">
      <a href="/sama" role="link"><span>Sam Altman</span></a>
      <div><svg data-testid="icon-verified" aria-label="Verified account"></svg></div>
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

/**
 * The same post with a quoted post that has been deleted.
 *
 * X leaves the quote box in place with a permalink and a notice, and no
 * identity or body. The extractor keys on that structure rather than on the
 * notice text, so the strings here are deliberately not the ones a test could
 * accidentally match on.
 */
export const QUOTE_TWEET_UNAVAILABLE_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <span>Satya Nadella</span>
    <a href="/satyanadella" role="link"><span>@satyanadella</span></a>
    <a href="/satyanadella/status/5001" role="link"><time datetime="2026-05-01T12:00:00.000Z">May 1</time></a>
  </div>
  <div data-testid="tweetText"><span>This one is gone now.</span></div>
  <div role="link" tabindex="0" class="quote-box" data-testid="quoteTweet">
    <a href="/ghost/status/4999" role="link"><span>View post</span></a>
  </div>
  <div role="group"><div data-testid="like"><span>3</span></div></div>
</article>
`;

