/**
 * Nested quote whose deepest post's media is a *video*, not a photo.
 *
 * Collected 2026-10-29 from a logged-in detail page. CSS classes, generated ids
 * and tooltip rows are stripped; every testid, role, href shape, src shape and
 * the nesting itself is verbatim. Identities, status ids and sentences are
 * synthetic, so the repository carries no third-party post.
 *
 * Why this exists beside `nested-quote-preview.ts`: there the previewed media is
 * a photo, so the video pass had nothing to find. Here it is an
 * `amplify_video_thumb` poster, which carries a video's traits — and the card
 * mounted that one asset three times: once in the outer quote, which attached no
 * media at all, and twice in the inner. Note the media link points at `/video/1`
 * rather than `/photo/1`.
 *
 * The outer quote is X's unmarked preview shape (`role="link"`, no testid); the
 * inner is `nestedQuotePreview`. Neither carries a `<video>` element, a
 * `tweetPhoto` wrapper or a `quoteTweet` testid, so the whole media read comes
 * from the one thumbnail below.
 */
export const NESTED_QUOTE_VIDEO_HTML = `
<article data-testid="tweet">
  <div data-testid="Tweet-User-Avatar">
    <div data-testid="UserAvatar-Container-postpress_demo">
      <img alt="" src="https://pbs.twimg.com/profile_images/1000000000000000101/demo_normal.jpg">
    </div>
  </div>
  <div data-testid="User-Name">
    <div><a href="/postpress_demo" role="link"><span>印推演示</span></a></div>
    <div><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><path d="M20.396 11"></path></g></svg></div>
    <div><div><div><a href="/postpress_demo" role="link" tabindex="-1"><span>@postpress_demo</span></a></div></div></div>
  </div>
  <div dir="auto" lang="zh" data-testid="tweetText"><span><a dir="ltr" href="/hashtag/Release?src=hashtag_click" role="link">#Release</a> 重置预告，预计下午三点完成重置</span></div>

  <div aria-labelledby="id__quote-label">
    <div><div><span>引用</span></div>
      <div tabindex="0" role="link">
        <div data-testid="Tweet-User-Avatar">
          <div data-testid="UserAvatar-Container-devindevelopers">
            <img alt="" src="https://pbs.twimg.com/profile_images/1000000000000000102/devin_mini.jpg">
          </div>
        </div>
        <div data-testid="User-Name">
          <div><a href="/devindevelopers" role="link"><span>Devin Developers</span></a></div>
          <div><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><path d="M20.396 11"></path></g></svg></div>
          <div><div><div><span>@devindevelopers</span></div></div></div>
          <div>·</div>
          <div aria-label="10月28日"><div><time datetime="2026-10-28T02:42:53.000Z">10月28日</time></div></div>
        </div>
        <div dir="auto" lang="zh" data-testid="tweetText"><span>第 23 天 / 备受期待的导出插件和排版插件。开个玩笑，今天是重置日。不过还是备受期待！</span></div>

        <div data-testid="nestedQuotePreview" role="link">
          <div data-testid="Tweet-User-Avatar">
            <div data-testid="UserAvatar-Container-cognition">
              <img alt="方形资料图片" src="https://pbs.twimg.com/profile_images/1000000000000000103/cognition_mini.jpg">
            </div>
          </div>
          <div data-testid="User-Name">
            <div><a href="/cognition" role="link"><span>Cognition</span></a></div>
            <div><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><path d="M20.396 11"></path></g></svg></div>
            <div><div><div><span>@cognition</span></div></div></div>
            <div>·</div>
            <div aria-label="10月28日"><div><time datetime="2026-10-27T17:51:08.000Z">10月28日</time></div></div>
          </div>
          <a href="/cognition/status/900000000000000007/video/1" role="link" data-testid="nestedQuotePreviewMedia">
            <div><div><div style="background-image: url('https://pbs.twimg.com/amplify_video_thumb/1000000000000000104/img/video_poster.jpg?format=jpg&amp;name=120x120');"></div><img alt="" src="https://pbs.twimg.com/amplify_video_thumb/1000000000000000104/img/video_poster.jpg?format=jpg&amp;name=120x120"></div></div>
          </a>
          <div dir="auto" lang="en" data-testid="tweetText"><span>Much requested, and now yours to connect: mail and calendar plugins are available in the app.</span></div>
        </div>
      </div>
    </div>
  </div>

  <div><div><a href="/postpress_demo/status/900000000000000008" role="link" aria-label="上午10:52 · 2026年10月28日"><time datetime="2026-10-28T02:52:01.000Z">上午10:52 · 2026年10月28日</time></a></div></div>
  <div role="group" aria-label="1 回复、9 喜欢、1 书签、1844 次观看">
    <div><button data-testid="reply" aria-label="1 回复。回复" role="button"><span>1</span></button></div>
    <div><button data-testid="like" aria-label="9 喜欢次数。喜欢" role="button"><span>9</span></button></div>
    <div><button data-testid="bookmark" aria-label="1 书签。加入书签" role="button"><span>1</span></button></div>
    <div><a href="/postpress_demo/status/900000000000000008/analytics" role="link"><span>1,844</span> <span>查看</span></a></div>
  </div>
</article>
`;
