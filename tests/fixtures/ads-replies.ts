/**
 * Interspersed ads and third-party replies DOM fixture.
 * Used to verify strict filtering in continuous thread reconstruction.
 */

export const MIXED_FEED_WITH_ADS_AND_REPLIES_HTML = `
<div id="conversation-container">
  <!-- 1. Original Author Tweet 1 -->
  <article data-testid="tweet" id="tweet-1">
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice"><span>@alice</span></a>
      <a href="/alice/status/9001"><time datetime="2026-08-01T10:00:00.000Z"></time></a>
    </div>
    <div data-testid="tweetText"><span>Part 1: The problem with state machines</span></div>
    <div role="group"></div>
  </article>

  <!-- 2. Sponsored Ad (must be filtered out) -->
  <article data-testid="tweet" data-testid-placement="ad" id="ad-1">
    <div data-testid="placementTracking">
      <span>Promoted</span>
    </div>
    <div data-testid="User-Name">
      <span>Cloud Sponsor</span>
      <a href="/cloudsponsor"><span>@cloudsponsor</span></a>
    </div>
    <div data-testid="tweetText"><span>Sign up today for 50% off cloud credits!</span></div>
  </article>

  <!-- 3. Original Author Tweet 2 -->
  <article data-testid="tweet" id="tweet-2">
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice"><span>@alice</span></a>
      <a href="/alice/status/9002"><time datetime="2026-08-01T10:02:00.000Z"></time></a>
    </div>
    <div data-testid="tweetText"><span>Part 2: Designing pure transitions</span></div>
    <div role="group"></div>
  </article>

  <!-- 4. Third-party Troll / Reply (must NOT be included in author thread) -->
  <article data-testid="tweet" id="reply-other">
    <div data-testid="User-Name">
      <span>Bob Troll</span>
      <a href="/bob_troll"><span>@bob_troll</span></a>
      <a href="/bob_troll/status/9003"><time datetime="2026-08-01T10:03:00.000Z"></time></a>
    </div>
    <div data-testid="tweetText"><span>Nobody cares, use Redux instead</span></div>
    <div role="group"></div>
  </article>

  <!-- 5. Original Author Tweet 3 (connected after reply) -->
  <article data-testid="tweet" id="tweet-3">
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice"><span>@alice</span></a>
      <a href="/alice/status/9004"><time datetime="2026-08-01T10:04:00.000Z"></time></a>
    </div>
    <div data-testid="tweetText"><span>Part 3: Conclusion & summary</span></div>
    <div role="group"></div>
  </article>
</div>
`;
