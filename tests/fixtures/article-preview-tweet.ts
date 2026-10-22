/**
 * Production-fidelity DOM fixture for a long-form post in a list view.
 *
 * A status page renders the article's reading surface inline, which is what
 * `article-tweet.ts` covers. The home and profile timelines render a preview
 * card instead, and that card has no `twitterArticleReadView` and no
 * `twitter-article-title` — the old extractor therefore found no article on a
 * real timeline post.
 *
 * Shape transcribed from a logged-in session on 2026-10-22
 * (`docs/observed-dom-2026-10-22-article-preview.md`), reduced to the parts the
 * extractor reads:
 *
 *   - the card's only article marker is the cover wrapper
 *     (`data-testid="article-cover-image"`); the localized badge ("文章") sits
 *     inside it and is deliberately kept out of every assertion;
 *   - the title and X's clamped excerpt follow the cover in one box, in that
 *     order, with no testids of their own — that order is the contract;
 *   - the body still ends with the `/i/article/` link X appends, which a card
 *     only drops when the post is known to carry an article.
 */

export const ARTICLE_PREVIEW_TWEET_HTML = `
<article data-testid="tweet" tabindex="0" role="article">
  <div>
    <div data-testid="Tweet-User-Avatar">
      <img alt="" src="https://pbs.twimg.com/profile_images/1700476606/avatar_normal.jpg" />
    </div>

    <div data-testid="User-Name">
      <div><span>peko</span><svg data-testid="icon-verified" aria-label="Verified account"></svg></div>
      <div><a href="/peko1487584"><span>@peko1487584</span></a></div>
      <div><a href="/peko1487584/status/2113233224407319018"><time datetime="2026-10-22T11:37:00.000Z">1小时</time></a></div>
    </div>

    <div data-testid="tweetText" lang="zh">
      <span>如果你正在制作游戏，或者是想进入AI开发游戏的赛道，不妨看看这篇帖子，他能帮助你了解Steam的算法机制，让你的游戏有更多的人看到 </span>
      <a href="https://t.co/SteamArticle"><span>x.com/i/article/2112…</span></a>
    </div>

    <div>
      <div data-testid="article-cover-image">
        <div>
          <div>
            <img alt="文章" width="1200" height="480" src="https://pbs.twimg.com/media/HJ2xyzABC?format=jpg&name=small" />
          </div>
        </div>
        <div aria-label="文章"><span>文章</span></div>
      </div>

      <div>
        <div><div>你的游戏，怎么才能被Steam算法看见</div></div>
        <div><span>先说结论 1. Steam 的盘子还在变大：2026 年 10 月 11 日，同时在线人数创下 4350 万的新纪录。 2. 但新游戏涨得比玩家更快：2026…</span></div>
      </div>
    </div>

    <div role="group" aria-label="Post actions">
      <div data-testid="reply"><span>3</span></div>
      <div data-testid="retweet"><span>2</span></div>
      <div data-testid="like"><span>13</span></div>
      <div data-testid="viewCount"><span>717</span></div>
    </div>
  </div>
</article>
`;
