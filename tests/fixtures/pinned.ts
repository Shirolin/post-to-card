/**
 * A real pinned-post notice, copied from a logged-in profile on 2026-10-11
 * (`/op7418`), with the body shortened and the media subtree trimmed.
 *
 * Kept beside `retweet.ts` because the two notices are the same testid rendered
 * two different ways, and the pair is what makes the point:
 *
 *   repost: <a href="/user"><span data-testid="socialContext">你已转帖</span></a>
 *   pinned: <div data-testid="socialContext">已置顶</div>
 *
 * A `span` in one and a `div` in the other, which is why the lookup matches the
 * testid and never the tag. A pinned notice also carries no link at all, so the
 * handle readers must return nothing rather than reaching for the author.
 *
 * The wording is localized ("已置顶" here, "Pinned" in English), and only the
 * Chinese, English and Japanese forms are recognised -- see `PINNED_NOTICE`.
 * Do not "tidy" the structure; the nesting is the thing under test.
 */
export const PINNED_HTML = `
<article role="article" tabindex="0" class="css-g5y9jx r-18u37iz" data-testid="tweet">
  <div class="css-g5y9jx r-eqz5dr r-16y2uox r-1wbh5a2">
    <div class="css-g5y9jx r-16y2uox r-1wbh5a2 r-1ny4l3l">
      <div class="css-g5y9jx">
        <div class="css-g5y9jx r-18u37iz r-136ojw6">
          <div class="css-g5y9jx r-1iusvr4 r-16y2uox r-ttdzmv">
            <div class="css-g5y9jx r-15zivkp r-q3we1">
              <div class="css-g5y9jx r-18u37iz r-136ojw6">
                <div class="css-g5y9jx r-18kxxzh r-1wron08 r-onrtq4 r-obd0qt r-1777fci">
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9"><g><path d="M13 21l-1 2-1-2v-5H4.5v-2.287z"></path></g></svg>
                </div>
                <div class="css-g5y9jx r-1iusvr4 r-16y2uox">
                  <div class="css-g5y9jx r-18u37iz">
                    <div class="css-g5y9jx r-1habvwh r-1wbh5a2 r-1777fci">
                      <div dir="ltr" class="css-146c3p1" id="id__a2z1rnsj4l4" data-testid="socialContext" style="-webkit-line-clamp: 2; color: rgb(113, 118, 123);">已置顶</div>
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
              <div class="css-g5y9jx r-bztko3" data-testid="UserAvatar-Container-op7418" style="width: 40px; height: 40px;">
                <img alt="" class="css-9pa8cd" src="https://pbs.twimg.com/profile_images/1636981205504786434/xDl77JIw_normal.jpg" data-handled="true">
              </div>
            </div>
          </div>
          <div class="css-g5y9jx r-1iusvr4 r-16y2uox r-1777fci r-kzbkwu">
            <div class="css-g5y9jx r-zl2h9q">
              <div class="css-g5y9jx r-k4xj1c r-18u37iz r-1wtj0ep">
                <div class="css-g5y9jx r-1d09ksm r-18u37iz r-1wbh5a2">
                  <div class="css-g5y9jx r-1wbh5a2 r-dnmrzs r-1ny4l3l">
                    <div class="css-g5y9jx r-1awozwy r-18u37iz" id="id__7t0szk0xc04" data-testid="User-Name">
                      <div class="css-g5y9jx r-1awozwy r-18u37iz">
                        <div class="css-g5y9jx r-1wbh5a2 r-dnmrzs">
                          <a href="/op7418" role="link" class="css-g5y9jx r-1wbh5a2 r-dnmrzs r-1ny4l3l r-1loqt21">
                            <div class="css-g5y9jx r-1awozwy r-18u37iz">
                              <div dir="ltr" class="css-146c3p1" style="color: rgb(231, 233, 234);"><span class="css-1jxf684"><span class="css-1jxf684">歸藏(guizang.ai)</span></span></div>
                              <div dir="ltr" class="css-146c3p1" style="color: rgb(231, 233, 234);"><span class="css-1jxf684"><svg viewBox="0 0 22 22" aria-label="认证账号" role="img" data-testid="icon-verified"><g><path d="M20.396 11c-.018-.646-.215-1.275z"></path></g></svg></span></div>
                            </div>
                          </a>
                        </div>
                      </div>
                      <div class="css-g5y9jx r-18u37iz r-1wbh5a2">
                        <div class="css-g5y9jx r-1d09ksm r-18u37iz r-1wbh5a2">
                          <div class="css-g5y9jx r-1wbh5a2 r-dnmrzs">
                            <a href="/op7418" role="link" tabindex="-1" class="css-g5y9jx r-1wbh5a2 r-dnmrzs r-1ny4l3l r-1loqt21"><div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span class="css-1jxf684">@op7418</span></div></a>
                          </div>
                          <div dir="ltr" aria-hidden="true" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span class="css-1jxf684">·</span></div>
                          <div class="css-g5y9jx r-18u37iz r-1q142lx">
                            <a href="/op7418/status/2108148604447883464" dir="ltr" aria-label="10月8日" role="link" class="css-146c3p1" style="color: rgb(113, 118, 123);"><time datetime="2026-10-08T10:52:49.000Z">10月8日</time></a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="css-g5y9jx">
                <div dir="auto" lang="zh" class="css-146c3p1" data-testid="tweetText" style="color: rgb(231, 233, 234);"><span class="css-1jxf684">让 Grok bot 每天早上定时出一个 AI 早报的视频，没想到效果还真挺不错的！</span></div>
              </div>
              <div class="css-g5y9jx"><div class="css-g5y9jx">
                <div aria-label="103 回复、66 次转帖、360 喜欢" role="group" class="css-g5y9jx r-1kbdv8c">
                  <div class="css-g5y9jx r-18u37iz"><button aria-label="103 回复。回复" role="button" class="css-g5y9jx" data-testid="reply" type="button"><div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span data-testid="app-text-transition-container"><span class="css-1jxf684"><span class="css-1jxf684">103</span></span></span></div></button></div>
                  <div class="css-g5y9jx r-18u37iz"><button aria-label="66 次转帖。转帖" role="button" class="css-g5y9jx" data-testid="retweet" type="button"><div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span data-testid="app-text-transition-container"><span class="css-1jxf684"><span class="css-1jxf684">66</span></span></span></div></button></div>
                  <div class="css-g5y9jx r-18u37iz"><button aria-label="360 喜欢次数。喜欢" role="button" class="css-g5y9jx" data-testid="like" type="button"><div dir="ltr" class="css-146c3p1" style="color: rgb(113, 118, 123);"><span data-testid="app-text-transition-container"><span class="css-1jxf684"><span class="css-1jxf684">360</span></span></span></div></button></div>
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
