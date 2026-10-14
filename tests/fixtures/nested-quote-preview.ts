/**
 * Nested quote fixture in the shape X actually renders.
 *
 * Collected 2026-10-14 from a timeline entry where a post quoted a post that
 * itself quoted a third — `@GKev1n → @devindevelopers → @cognition`. CSS class
 * soup and the `id__*` generated ids are stripped; every marker, attribute and
 * nesting this file keeps is verbatim.
 *
 * Two details here are why this fixture exists alongside the older one:
 *
 *   1. There is no `quoteTweet` testid anywhere. Both quote levels are
 *      `role="link"` containers, and the deepest is marked
 *      `data-testid="nestedQuotePreview"`. The earlier fixtures used the
 *      `quoteTweet` shape, which was never what X rendered for a quote inside a
 *      quote — it is what X renders for the outermost one, and it is absent
 *      here. `docs/observed-dom-*.md` recorded that absence and nothing did
 *      with it.
 *   2. The deepest post's media is `data-testid="nestedQuotePreviewMedia"`,
 *      not `tweetPhoto`. It is a 120px thumbnail X clips beside the clamped
 *      body, and the photo pass — which scans `tweetPhoto` — does not see it.
 *      Its only link is `…/status/<id>/photo/1`, so the status segment has to
 *      be taken from the href rather than using the href whole.
 *
 * The outer levels keep their own `<time datetime>` and verified badge; only
 * the deepest is a preview.
 */
export const NESTED_QUOTE_PREVIEW_HTML = `
<article data-testid="tweet">
  <div data-testid="Tweet-User-Avatar">
    <div><img alt="" src="https://pbs.twimg.com/profile_images/2100717851745394688/wg1dGu-F_normal.jpg"></div>
  </div>
  <div data-testid="User-Name">
    <div><a href="/GKev1n" role="link"><div><span>gKev1n</span></div></a></div>
    <div><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><path d="M20.396 11c-.018-.646"></path></g></svg></div>
    <div><div><div><a href="/GKev1n" role="link" tabindex="-1"><span>@GKev1n</span></a></div></div></div>
  </div>

  <div dir="auto" lang="zh" data-testid="tweetText"><span>这把赚大发了，开通 Devin 的有福了！Gemini 4 Argon 目前多了一种访问方式，
第一种，开通 Google AI Ultra，99$。
第二种，开通 Devin ，20$。
还好这几天用 Devin 调用 Opus 5.5 省着点用了，哈哈哈，剩下的可以试试 Gemini  Argon 了！</span></div>

  <div>
    <div><span>引用</span></div>
    <div tabindex="0" role="link">
      <div>
        <div data-testid="Tweet-User-Avatar">
          <div><div data-testid="UserAvatar-Container-devindevelopers">
            <div><div><div><img alt="方形资料图片" src="https://pbs.twimg.com/profile_images/2107600208888532992/Kn5vLn6T_normal.jpg"></div></div></div></div>
          </div></div>
        </div>
      </div>
      <div data-testid="User-Name">
        <div><div><a href="/devindevelopers" role="link"><span>Devin Developers</span></a></div></div>
        <div><span><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><linearGradient id="g-devin"><stop offset="0" stop-color="#f4e72a"></stop></linearGradient><path d="M13.324 3.848L11 1.6" fill="url(#g-devin)"></path></g></svg></span></div>
        <div><div><div><span>@devindevelopers</span></div></div></div>
        <div>·</div>
        <div><div><time datetime="2026-10-13T16:24:04.000Z">14小时</time></div></div>
      </div>
      <div>
        <div><svg viewBox="0 0 33 32" aria-hidden="true"><g><path d="M12.745 20.54"></path></g></svg><span>翻译自 英语</span></div>
        <div dir="auto" lang="zh" data-testid="tweetText" style="-webkit-line-clamp: 5"><span>Gemini 4 Argon 现已在 Devin Desktop 和 Devin CLI 中提供。</span></div>
      </div>

      <div data-testid="nestedQuotePreview">
        <div></div>
        <div>
          <div data-testid="Tweet-User-Avatar">
            <div data-testid="UserAvatar-Container-cognition"><div><div><div><img alt="方形资料图片" src="https://pbs.twimg.com/profile_images/1765909640364068865/MvH-m0gd_mini.jpg"></div></div></div></div>
          </div>
          <div data-testid="User-Name">
            <div><div><a href="/cognition" role="link"><span>Cognition</span></a></div></div>
            <div><span><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><path d="M13.324 3.848"></path></g></svg></span></div>
            <div><div><div><span>@cognition</span></div></div></div>
            <div>·</div>
            <div><div><time datetime="2026-10-13T16:22:52.000Z">14小时</time></div></div>
          </div>
        <div>
          <a href="/cognition/status/2110043605528408110/photo/1" role="link" data-testid="nestedQuotePreviewMedia">
            <div><div><div style="background-image: url('https://pbs.twimg.com/media/HUhftVoasAAzqss?format=jpg&amp;name=120x120');"></div><img alt="" src="https://pbs.twimg.com/media/HUhftVoasAAzqss?format=jpg&amp;name=120x120"></div></div>
          </a>
          <div>
            <div dir="auto" lang="en" data-testid="tweetText" style="-webkit-line-clamp: 2"><span>Gemini 4 Argon is now available in Devin Desktop and CLI.

On&nbsp;FrontierCode 1.1, Gemini 4 Argon scores 60.5%, making it the highest performing Gemini model on the leaderboard.

Through October 27th it is available at 75% off for Devin users.</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div role="group" aria-label="4 回复、1 次转帖、16 喜欢、3 书签、6638 次观看">
    <div><button data-testid="reply" aria-label="4 回复。回复"><span>4</span></button></div>
    <div><button data-testid="retweet" aria-label="1 次转帖。转帖"><span>1</span></button></div>
    <div><button data-testid="like" aria-label="16 喜欢次数。喜欢"><span>16</span></button></div>
    <div><button data-testid="bookmark" aria-label="3 书签。加入书签"><span>3</span></button></div>
    <div><a href="/GKev1n/status/2110105649778700290/analytics" role="link"><span>6,638</span> <span>查看</span></a></div>
  </div>
  <div><div><a href="/GKev1n/status/2110105649778700290" role="link"><time datetime="2026-10-13T20:29:25.000Z">上午4:29 · 2026年10月14日</time></a></div></div>
</article>
`;