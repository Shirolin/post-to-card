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

export const LEGACY_PHOTO_URL_HTML = `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/user/status/8005"><time datetime="2026-07-01T00:00:00.000Z"></time></a>
  </div>
  <div data-testid="tweetPhoto">
    <img src="https://pbs.twimg.com/media/legacy_photo.jpg:small" alt="Legacy Small">
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
