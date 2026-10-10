/**
 * A real repost notice, copied verbatim from a logged-in timeline on 2026-10-11
 * (`/ShiroLinHime` reposting `@deon_lt`), with only the tweet body shortened and
 * the media subtree trimmed. Everything that decides the extraction is as X
 * rendered it.
 *
 * It exists because the community documentation this adapter was written from
 * said the notice is `div[data-testid="socialContext"]`. It is not: the testid
 * sits on a `span`, and the reposter's handle is that span's *own* enclosing
 * link rather than a link inside it. Both halves are load-bearing and both were
 * wrong, so every repost was silently read as an original post.
 *
 * Do not "tidy" the structure. The nesting is the thing under test.
 */
export const RETWEET_HTML = `
<article role="article" tabindex="0" class="css-g5y9jx r-18u37iz" data-testid="tweet">
  <div class="css-g5y9jx r-eqz5dr r-16y2uox r-1wbh5a2">
    <div class="css-g5y9jx r-16y2uox r-1wbh5a2 r-1ny4l3l">
      <div class="css-g5y9jx">
        <div class="css-g5y9jx r-18u37iz r-136ojw6">
          <div class="css-g5y9jx r-1iusvr4 r-16y2uox r-ttdzmv">
            <div class="css-g5y9jx r-15zivkp r-q3we1">
              <div class="css-g5y9jx r-18u37iz r-136ojw6">
                <div class="css-g5y9jx r-18kxxzh r-1wron08 r-onrtq4 r-obd0qt r-1777fci">
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9"><g><path d="M4.75 3.79l4.603 4.3z"></path></g></svg>
                </div>
                <div class="css-g5y9jx r-1iusvr4 r-16y2uox">
                  <div class="css-g5y9jx r-18u37iz">
                    <div class="css-g5y9jx r-1habvwh r-1wbh5a2 r-1777fci">
                      <div class="css-g5y9jx">
                        <a href="/ShiroLinHime" dir="ltr" role="link" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span class="css-1jxf684" data-testid="socialContext" style="color: rgb(113, 118, 123);">你已转帖</span></a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="css-g5y9jx r-18u37iz r-136ojw6">
          <div class="css-g5y9jx r-18kxxzh r-1wron08 r-onrtq4 r-1awozwy">
            <div class="css-g5y9jx" data-testid="Tweet-User-Avatar">
              <div class="css-g5y9jx r-bztko3" data-testid="UserAvatar-Container-deon_lt" style="width: 40px; height: 40px;">
                <img alt="" class="css-9pa8cd" src="https://pbs.twimg.com/profile_images/1769314011617632257/URLEJTHE_normal.jpg" data-handled="true">
              </div>
            </div>
          </div>
          <div class="css-g5y9jx r-1iusvr4 r-16y2uox r-1777fci r-kzbkwu">
            <div class="css-g5y9jx r-zl2h9q">
              <div class="css-g5y9jx r-k4xj1c r-18u37iz r-1wtj0ep">
                <div class="css-g5y9jx r-1d09ksm r-18u37iz r-1wbh5a2">
                  <div class="css-g5y9jx r-1wbh5a2 r-dnmrzs r-1ny4l3l">
                    <div class="css-g5y9jx r-1awozwy r-18u37iz" data-testid="User-Name">
                      <div class="css-g5y9jx r-1awozwy r-18u37iz">
                        <div class="css-g5y9jx r-1wbh5a2 r-dnmrzs">
                          <a href="/deon_lt" role="link" class="css-g5y9jx r-1wbh5a2 r-dnmrzs r-1ny4l3l r-1loqt21">
                            <div class="css-g5y9jx r-1awozwy r-18u37iz">
                              <div dir="ltr" class="css-146c3p1" style="color: rgb(231, 233, 234);"><span class="css-1jxf684"><span class="css-1jxf684">DragoonDT</span></span></div>
                              <div dir="ltr" class="css-146c3p1" style="color: rgb(231, 233, 234);"><span class="css-1jxf684"><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><path d="M20.396 11c-.018-.646-.215-1.275z"></path></g></svg></span></div>
                            </div>
                          </a>
                        </div>
                      </div>
                      <div class="css-g5y9jx r-18u37iz r-1wbh5a2">
                        <div class="css-g5y9jx r-1d09ksm r-18u37iz r-1wbh5a2">
                          <div class="css-g5y9jx r-1wbh5a2 r-dnmrzs">
                            <a href="/deon_lt" role="link" tabindex="-1" class="css-g5y9jx r-1wbh5a2 r-dnmrzs r-1ny4l3l r-1loqt21"><div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span class="css-1jxf684">@deon_lt</span></div></a>
                          </div>
                          <div dir="ltr" aria-hidden="true" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span class="css-1jxf684">·</span></div>
                          <div class="css-g5y9jx r-18u37iz r-1q142lx">
                            <a href="/deon_lt/status/2102127634289139767" dir="ltr" aria-label="9月22日" role="link" class="css-146c3p1" style="color: rgb(113, 118, 123);"><time datetime="2026-09-21T20:07:38.000Z">9月22日</time></a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="css-g5y9jx">
                <div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);">
                  <span class="css-1jxf684"><span class="css-1jxf684">翻译自 英语</span></span>
                  <button aria-label="显示原文" role="button" class="css-g5y9jx" type="button"><span class="css-1jxf684" style="color: rgb(29, 155, 240);"><span class="css-1jxf684">显示原文</span></span></button>
                </div>
                <div dir="auto" lang="zh" data-testid="tweetText" style="color: rgb(231, 233, 234);">
                  <span class="css-1jxf684">两年零326天来不断向</span>
                  <div class="css-g5y9jx r-xoduu5"><span class="r-18u37iz"><a dir="ltr" href="/capcom_official" role="link" class="css-1jxf684" style="color: rgb(29, 155, 240);">@capcom_official</a></span></div>
                  <span class="css-1jxf684"> 请求推出《火之气息》系列游戏的合集或重制版。</span>
                  <span class="r-18u37iz"><a dir="ltr" href="/hashtag/pleasecapcom?src=hashtag_click" role="link" class="css-1jxf684" style="color: rgb(29, 155, 240);">#pleasecapcom</a></span>
                </div>
              </div>
              <div class="css-g5y9jx"><div class="css-g5y9jx">
                <div aria-label="9 回复、112 次转帖、501 喜欢" role="group" class="css-g5y9jx r-1kbdv8c">
                  <div class="css-g5y9jx r-18u37iz"><button aria-label="9 回复。回复" role="button" class="css-g5y9jx" data-testid="reply" type="button"><div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span data-testid="app-text-transition-container"><span class="css-1jxf684"><span class="css-1jxf684">9</span></span></span></div></button></div>
                  <div class="css-g5y9jx r-18u37iz"><button aria-label="112 次转帖。已转帖" role="button" class="css-g5y9jx" data-testid="unretweet" type="button"><div dir="ltr" class="css-146c3p1" style="color: rgb(0, 186, 124);"><span data-testid="app-text-transition-container"><span class="css-1jxf684"><span class="css-1jxf684">112</span></span></span></div></button></div>
                  <div class="css-g5y9jx r-18u37iz"><button aria-label="501 喜欢次数。喜欢了" role="button" class="css-g5y9jx" data-testid="unlike" type="button"><div dir="ltr" class="css-146c3p1" style="color: rgb(249, 24, 128);"><span data-testid="app-text-transition-container"><span class="css-1jxf684"><span class="css-1jxf684">501</span></span></span></div></button></div>
                  <div class="css-g5y9jx r-18u37iz"><a href="/deon_lt/status/2102127634289139767/analytics" aria-label="39882 次查看。查看帖子分析" role="link" class="css-g5y9jx"><div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span data-testid="app-text-transition-container"><span class="css-1jxf684"><span class="css-1jxf684">3.9万</span></span></span></div></a></div>
                </div>
              </div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</article>
`;
