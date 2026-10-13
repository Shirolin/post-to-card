/**
 * Multi-image grid and media upgrade DOM fixtures.
 * Covers 1, 2, 3, and 4 photo grids, legacy query params, and video poster frames.
 */

export const ONE_PHOTO_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8001"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/photo_single.jpg?format=jpg&name=small" alt="Single View">
  </div>
</article>
`;

export const TWO_PHOTOS_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8002"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/photo_left.jpg?format=jpg&name=small" alt="Left">
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/photo_right.png?format=png&name=medium" alt="Right">
  </div>
</article>
`;

export const THREE_PHOTOS_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8003"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/photo_p1.jpg?format=jpg&name=small" alt="P1">
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/photo_p2.jpg?format=jpg&name=small" alt="P2">
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/photo_p3.jpg?format=jpg&name=small" alt="P3">
  </div>
</article>
`;

export const FOUR_PHOTOS_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8004"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/grid_1.jpg?format=jpg&name=small" alt="G1">
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/grid_2.jpg?format=jpg&name=small" alt="G2">
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/grid_3.jpg?format=jpg&name=small" alt="G3">
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/grid_4.jpg?format=jpg&name=small" alt="G4">
  </div>
</article>
`;

/**
 * A media-rich tweet. Observed on a live two-image post: the media block also
 * carries a role="group", so a bare group match attaches the trigger to the
 * photo area instead of the action row.
 */
export const MEDIA_WITH_INNER_GROUP_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name"><a href="/user/status/8010"><time datetime="2026-07-01T00:00:00.000Z"></time></a></div>
  <div data-testid="tweetPhoto">
    <div role="group" aria-label="图片 1 / 2">
      <img src="https://pbs.twimg.com/media/left.jpg?format=jpg&name=small" alt="Left">
    </div>
    <div role="group" aria-label="图片 2 / 2">
      <img src="https://pbs.twimg.com/media/right.jpg?format=jpg&name=small" alt="Right">
    </div>
  </div>
  <div role="group" aria-label="8 回复、6 次转帖、68 喜欢、4637 次观看">
    <div><button data-testid="reply" aria-label="8 回复。回复"></button></div>
    <div><button data-testid="retweet" aria-label="6 次转帖。转帖"></button></div>
    <div><button data-testid="like" aria-label="68 喜欢次数。喜欢"></button></div>
  </div>
</article>
`;

export const VIDEO_POSTER_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8006"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="videoPlayer">
    <video poster="https://pbs.twimg.com/media/awesome_video_poster.jpg"></video>
  </div>
</article>
`;

/**
 * A GIF post as actually rendered: the videoPlayer/videoComponent testids are
 * gone, the play button is the only stable marker, and the poster frame lives
 * inside the tweetPhoto wrapper as a hidden image layered behind the <video>.
 * Without the hidden-image filter this yields the same asset twice.
 */
export const GIF_POSTER_LAYER_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8009"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/tweet_video_thumb/gif_hidden_poster.jpg" style="opacity: 0; z-index: -1" alt="">
    <video poster="https://pbs.twimg.com/tweet_video_thumb/gif_visible_poster.jpg"></video>
    <button data-testid="playButton" aria-label="播放这个 GIF"></button>
  </div>
</article>
`;

/**
 * A regular video post whose poster frame is *visible* (no `opacity: 0`), as
 * opposed to the hidden GIF layer above.
 *
 * The poster is a plain `<img>` inside the tweetPhoto wrapper with the `<video>`
 * beside it, so the photo pass collects the frame and the video pass collects it
 * again as the poster. The card then showed the same frame twice: once plain and
 * once with the duration badge.
 */
export const VIDEO_VISIBLE_POSTER_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8011"><time datetime="2026-10-02T01:43:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/tweet_video_thumb/video_frame.jpg" alt="">
    <video poster="https://pbs.twimg.com/tweet_video_thumb/video_frame.jpg"></video>
    <button data-testid="playButton" aria-label="播放"></button>
  </div>
</article>
`;

/**
 * A tweet that pairs a photo with a GIF side by side, the layout that previously
 * rendered as the GIF only because video detection short-circuited the photos.
 */
export const PHOTO_AND_GIF_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8007"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/screenshot_table.jpg?format=jpg&name=small" alt="Screenshot">
  </div>
  <div data-testid="videoPlayer">
    <video poster="https://pbs.twimg.com/tweet_video_thumb/gif_reaction.jpg"></video>
  </div>
</article>
`;

/** Photo + video variant, to keep the merge behaviour independent of GIF detection. */
export const PHOTO_AND_VIDEO_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8008"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/photo_beside_video.jpg?format=jpg&name=small" alt="Beside Video">
  </div>
  <div data-testid="videoPlayer">
    <video poster="https://pbs.twimg.com/media/clip_poster.jpg"></video>
  </div>
</article>
`;

/**
 * The first of the two shapes `isGifMedia` reads a GIF badge from: the video
 * player's own `aria-label`. The `GIF` token is a technical abbreviation, so it
 * survives a localized label -- this one is the untranslated variant.
 *
 * Which of the two shapes X actually renders is still open (see the sampling
 * checklist); each of them is a branch the extractor claims to handle.
 */
export const GIF_ARIA_LABELED_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8101"><time datetime="2026-07-02T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="videoPlayer" aria-label="Embedded GIF">
    <video poster="https://pbs.twimg.com/tweet_video_thumb/gif_aria_poster.jpg"></video>
  </div>
</article>
`;

/**
 * The other shape `isGifMedia` reads: the badge text inside the player. There is
 * no `gifBadge` testid behind it, and a fixture that invents one proves only
 * that the invention can be found.
 */
export const GIF_BADGE_TEXT_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8102"><time datetime="2026-07-02T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="videoPlayer">
    <video poster="https://pbs.twimg.com/tweet_video_thumb/gif_text_poster.jpg"></video>
    <span>GIF</span>
  </div>
</article>
`;

/** A video post whose controls carry a duration, which a GIF never gets. */
export const VIDEO_WITH_DURATION_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8103"><time datetime="2026-07-02T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="videoPlayer">
    <video poster="https://pbs.twimg.com/media/duration_poster.jpg"></video>
    <div><span>1:42</span></div>
  </div>
</article>
`;

/**
 * A GIF in the state a feed actually shows with autoplay off: a poster `img`
 * plus the interstitial overlay that stands in for the player, and no `<video>`
 * anywhere. Captured from a live logged-in feed on 2026-10-10
 * (`docs/observed-dom-2026-10-10.md`); the class names are the obfuscated ones
 * X shipped that day, kept because nothing in this state is a stable hook
 * except the badge text and the poster URL.
 */
export const GIF_POSTER_ONLY_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8110"><time datetime="2026-10-10T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <div>
      <div class="r-1adg3ll r-1udh08x r-pm9dpa">
        <div class="r-1adg3ll r-13qz1uu" style="padding-bottom: 56.3953%;"></div>
        <div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu">
          <div aria-label="嵌入式视频" data-testid="previewInterstitial">
            <div aria-label="嵌入式视频">
              <img alt="嵌入式视频" src="https://pbs.twimg.com/tweet_video_thumb/HUPRvp-a4AAE2fG?format=jpg&name=small">
            </div>
          </div>
        </div>
      </div>
    </div>
    <div><span class="css-1jxf684 r-poiln3">GIF</span></div>
    <button data-testid="playButton" aria-label="播放这个 GIF" role="button"></button>
  </div>
</article>
`;

export const VIDEO_POSTER_ONLY_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8111"><time datetime="2026-10-10T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <div>
      <div class="r-1adg3ll r-1udh08x r-pm9dpa">
        <div class="r-1adg3ll r-13qz1uu" style="padding-bottom: 56.3953%;"></div>
        <div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu">
          <div aria-label="嵌入式视频" data-testid="previewInterstitial">
            <div aria-label="嵌入式视频">
              <img alt="嵌入式视频" src="https://pbs.twimg.com/amplify_video_thumb/2108784749850255360/img/x.jpg">
            </div>
          </div>
        </div>
      </div>
    </div>
    <button data-testid="playButton" aria-label="播放" role="button"></button>
  </div>
</article>
`;

/** A post containing four distinct animated GIFs. */
export const FOUR_GIFS_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8112"><time datetime="2026-10-10T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/tweet_video_thumb/gif1.jpg" alt="GIF 1">
    <div><span>GIF</span></div>
    <button data-testid="playButton" aria-label="播放这个 GIF"></button>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/tweet_video_thumb/gif2.jpg" alt="GIF 2">
    <div><span>GIF</span></div>
    <button data-testid="playButton" aria-label="播放这个 GIF"></button>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/tweet_video_thumb/gif3.jpg" alt="GIF 3">
    <div><span>GIF</span></div>
    <button data-testid="playButton" aria-label="播放这个 GIF"></button>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/tweet_video_thumb/gif4.jpg" alt="GIF 4">
    <div><span>GIF</span></div>
    <button data-testid="playButton" aria-label="播放这个 GIF"></button>
  </div>
</article>
`;
