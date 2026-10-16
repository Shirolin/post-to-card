/**
 * A single-tweet DOM fixture.
 *
 * Hand-built to the shape X emits rather than pasted from a capture, so the
 * structure is the claim and the strings are placeholders. There is no
 * `EXPECTED_*` companion: what the extractor makes of this markup is asserted
 * against the extractor in the tiers, not against a second copy of the answer.
 */

export const SINGLE_TWEET_HTML = `
<article data-testid="tweet" tabindex="0" role="article" class="css-175oi2r r-18u37iz">
  <div class="css-175oi2r r-1iusvr4">
    <!-- User Avatar -->
    <div data-testid="Tweet-User-Avatar">
      <img alt="Jack Dorsey" src="https://pbs.twimg.com/profile_images/1115644071988/jack_normal.jpg" class="css-901oao">
    </div>

    <!-- User Information -->
    <div data-testid="User-Name">
      <div class="css-175oi2r r-1awozwy">
        <span class="css-901oao">Jack Dorsey</span>
        <svg data-testid="icon-verified" aria-label="Verified account" class="r-1cvl2hr"></svg>
      </div>
      <div>
        <a href="/jack" role="link">
          <span class="css-901oao">@jack</span>
        </a>
      </div>
      <div>
        <a href="/jack/status/20" role="link">
          <time datetime="2006-03-21T20:50:14.000Z">Mar 22, 2006</time>
        </a>
      </div>
    </div>

    <!-- Tweet Body -->
    <div data-testid="tweetText" lang="en">
      <span>just setting up my twttr</span>
      <img alt="✨" src="https://abs-0.twimg.com/emoji/v2/svg/2728.svg" class="r-4qtqp9">
    </div>

    <!-- Photo Media -->
    <div data-testid="tweetPhoto">
      <img src="https://pbs.twimg.com/media/first_tweet_photo.jpg?format=jpg&name=small" alt="Image">
    </div>

    <!-- Action Bar & Stats -->
    <div role="group" aria-label="Post actions">
      <div data-testid="reply">
        <span>48.5K</span>
      </div>
      <div data-testid="retweet">
        <span>120.2K</span>
      </div>
      <div data-testid="like">
        <span>1.5M</span>
      </div>
      <div data-testid="bookmark">
        <span>32.1K</span>
      </div>
      <div data-testid="viewCount">
        <span>18.4M</span>
      </div>
    </div>
  </div>
</article>
`;

