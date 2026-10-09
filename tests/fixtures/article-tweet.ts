/**
 * Production-fidelity DOM fixture for a long-form post: an X article.
 *
 * The shape is transcribed from a logged-in session on 2026-10-09
 * (`docs/observed-dom-2026-10-09.md`), reduced to the markers the extractor
 * reads. Three properties of the real markup matter and are preserved here:
 *
 *   - the article is a nested `<article data-testid="twitterArticleReadView">`,
 *     which is what made the old extractor treat it as a quoted post;
 *   - the cover is a `tweetPhoto` inside the read view but outside the prose, so
 *     it is the article's own picture rather than the tweet's;
 *   - the prose embeds another post (`simpleTweet`) with its own author, body
 *     and video, which must not be adopted as this tweet's content.
 *
 * The cover's `alt` is deliberately left as X's localized text ("图像" in a
 * Chinese session) rather than an English marker, so a test built on wording
 * fails here instead of in the field.
 */

export const ARTICLE_TWEET_HTML = `
<article data-testid="tweet" tabindex="0" role="article">
  <div>
    <div data-testid="Tweet-User-Avatar">
      <img alt="" src="https://pbs.twimg.com/profile_images/1700476606/avatar_normal.jpg" />
    </div>

    <div data-testid="User-Name">
      <div><span>Kevin Le Guillou</span><svg data-testid="icon-verified" aria-label="Verified account"></svg></div>
      <div><a href="/kevinleguillou"><span>@kevinleguillou</span></a></div>
      <div><a href="/kevinleguillou/status/2108306407921443081"><time datetime="2026-10-08T21:19:52.000Z">Oct 8</time></a></div>
    </div>

    <div data-testid="tweetText" lang="en">
      <span>Here is the promised write up, it explains how I made the recent videos, and good ideas I picked up along the way. </span>
      <a href="https://t.co/MXcei1QhVg"><span>x.com/i/article/2108…</span></a>
    </div>

    <article data-testid="twitterArticleReadView">
      <div data-testid="tweetPhoto">
        <img alt="图像" src="https://pbs.twimg.com/media/HUIxgCnWEAEUKgI?format=jpg&name=small" />
      </div>

      <div data-testid="twitter-article-title">Anime Harry Potter</div>

      <div data-testid="twitterArticleRichTextView">
        <div data-testid="longformRichTextComponent">
          <p>This is a writeup for those that wanted to know how I made the videos.</p>

          <div data-testid="simpleTweet">
            <div data-testid="User-Name">
              <div><span>moonlightbro</span></div>
              <div><a href="/moonlightbro"><span>@moonlightbro</span></a></div>
            </div>
            <div data-testid="tweetText" lang="en"><span>"A love potion." Snape repeated flatly.</span></div>
            <div data-testid="tweetPhoto">
              <img alt="嵌入式视频" src="https://pbs.twimg.com/amplify_video_thumb/2106405387821805568/img/L8DuB_U2vtyd.jpg" />
            </div>
            <div role="group" aria-label="Post actions">
              <div data-testid="reply"><span>4</span></div>
              <div data-testid="retweet"><span>18</span></div>
              <div data-testid="like"><span>4.3K</span></div>
            </div>
          </div>

          <h2>Ref2Video models</h2>
          <p>Minimax H3 Max with FAL is relatively cheap.</p>
        </div>
      </div>
    </article>

    <div role="group" aria-label="Post actions">
      <div data-testid="reply"><span>2</span></div>
      <div data-testid="retweet"><span>14</span></div>
      <div data-testid="like"><span>153</span></div>
      <div data-testid="bookmark"><span>105</span></div>
      <div data-testid="viewCount"><span>15947</span></div>
    </div>
  </div>
</article>
`;
