/**
 * Continuous same-author thread DOM fixture.
 * Contains 3 interconnected tweets by @alice.
 *
 * Hand-built to the shape X emits rather than pasted from a capture, so the
 * structure is the claim and the strings are placeholders. There is no
 * `EXPECTED_*` companion: what the resolver makes of this markup is asserted
 * against the resolver in the tiers, not against a second copy of the answer.
 */

export const THREAD_HTML = `
<div id="timeline">
  <!-- Tweet 1 (Root) -->
  <article data-testid="tweet" class="thread-root">
    <div data-testid="Tweet-User-Avatar">
      <img alt="Alice" src="https://pbs.twimg.com/profile_images/999/alice_normal.jpg">
    </div>
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice" role="link"><span>@alice</span></a>
      <a href="/alice/status/1001" role="link">
        <time datetime="2026-04-10T10:00:00.000Z">Apr 10</time>
      </a>
    </div>
    <div data-testid="tweetText">
      <span>1/3 Card presets change how we think about layout defaults.</span>
      <img alt="🧵" src="https://abs-0.twimg.com/emoji/v2/svg/1f9f5.svg">
    </div>
    <div role="group">
      <div data-testid="like"><span>2.4K</span></div>
    </div>
  </article>

  <!-- Tweet 2 (Middle) -->
  <article data-testid="tweet" class="thread-middle">
    <div data-testid="Tweet-User-Avatar">
      <img alt="Alice" src="https://pbs.twimg.com/profile_images/999/alice_normal.jpg">
    </div>
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice" role="link"><span>@alice</span></a>
      <a href="/alice/status/1002" role="link">
        <time datetime="2026-04-10T10:05:00.000Z">Apr 10</time>
      </a>
    </div>
    <div data-testid="tweetText">
      <span>2/3 Instead of shipping every variant, a theme names its tokens once.</span>
    </div>
    <div role="group">
      <div data-testid="like"><span>1.8K</span></div>
    </div>
  </article>

  <!-- Tweet 3 (Conclusion) -->
  <article data-testid="tweet" class="thread-end">
    <div data-testid="Tweet-User-Avatar">
      <img alt="Alice" src="https://pbs.twimg.com/profile_images/999/alice_normal.jpg">
    </div>
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice" role="link"><span>@alice</span></a>
      <a href="/alice/status/1003" role="link">
        <time datetime="2026-04-10T10:10:00.000Z">Apr 10</time>
      </a>
    </div>
    <div data-testid="tweetText">
      <span>3/3 Read the full architecture notes on GitHub. End of thread.</span>
    </div>
    <div role="group">
      <div data-testid="like"><span>3.1K</span></div>
    </div>
  </article>
</div>
`;

/**
 * The same author's consecutive posts as a *list view* renders them: no
 * `thread-*` classes, no "show this thread" link and no `socialContext`, which
 * are the signals the DOM heuristics look for and which a real list view never
 * provides. This is the shape that used to lose a thread.
 *
 * A profile timeline is where this shape is common — measured on a real one:
 * 12 consecutive posts by one author, 11 adjacent same-author pairs, of which
 * only the ones the payload links are continuations. The home feed does not
 * present it at all (54 posts sampled, zero adjacent pairs), which is why a
 * single-post card there is correct rather than a miss.
 *
 * Ids line up with `HOME_TIMELINE_SELF_THREAD_JSON` (`tests/fixtures/graphql.ts`),
 * and an ad sits after the pair so the walk has to stop where the thread does.
 */
export const FEED_SELF_THREAD_HTML = `
<div id="conversation-container">
  <article data-testid="tweet" id="feed-post-1">
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice" role="link"><span>@alice</span></a>
      <a href="/alice/status/9001" role="link"><time datetime="2026-08-01T10:00:00.000Z">Aug 1</time></a>
    </div>
    <div data-testid="tweetText"><span>Part 1: The problem with state machines</span></div>
    <div role="group"></div>
  </article>

  <article data-testid="tweet" id="feed-post-2">
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice" role="link"><span>@alice</span></a>
      <a href="/alice/status/9002" role="link"><time datetime="2026-08-01T10:02:00.000Z">Aug 1</time></a>
    </div>
    <div data-testid="tweetText"><span>Part 2: Designing pure transitions</span></div>
    <div role="group"></div>
  </article>

  <!-- An ad: the thread ends here, payload or not. -->
  <article data-testid="tweet" id="feed-ad" data-testid-placement="ad">
    <div data-testid="placementTracking"><span>Promoted</span></div>
    <div data-testid="User-Name">
      <span>Cloud Sponsor</span>
      <a href="/cloudsponsor" role="link"><span>@cloudsponsor</span></a>
    </div>
    <div data-testid="tweetText"><span>Sign up today</span></div>
  </article>

  <article data-testid="tweet" id="feed-post-3">
    <div data-testid="User-Name">
      <span>Alice Dev</span>
      <a href="/alice" role="link"><span>@alice</span></a>
      <a href="/alice/status/9004" role="link"><time datetime="2026-08-01T10:04:00.000Z">Aug 1</time></a>
    </div>
    <div data-testid="tweetText"><span>Part 3: Conclusion and summary</span></div>
    <div role="group"></div>
  </article>
</div>
`;
