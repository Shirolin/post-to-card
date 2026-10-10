/**
 * GraphQL payload fixtures.
 *
 * Shapes are taken from the current TweetDetail response structure, with the
 * identifiers shortened. They exist to pin the parser's field mapping, not to
 * simulate X's full response.
 */

/** A conversation module holding three tweets from one author. */
export const TWEET_DETAIL_THREAD_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-1003',
              sortIndex: '3',
              content: {
                itemContent: {
                  __typename: 'TimelineTweet',
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '1003',
                      core: {
                        user_results: {
                          result: {
                            legacy: { screen_name: 'ada_builds', name: 'Ada Nakamura' },
                            profile_image_url_https: 'https://pbs.twimg.com/profile_images/1/ada.jpg',
                            is_blue_verified: true
                          }
                        }
                      },
                      note_tweet: {
                        note_tweet_results: { result: { text: 'Third post, long form body.' } }
                      },
                      legacy: {
                        full_text: 'Third post…',
                        created_at: 'Mon Dec 22 19:38:26 +0000 2025',
                        conversation_id_str: '1000',
                        reply_count: 31,
                        retweet_count: 1100,
                        favorite_count: 9400,
                        bookmark_count: 203,
                        extended_entities: {
                          media: [
                            {
                              type: 'photo',
                              media_url_https: 'https://pbs.twimg.com/media/one.jpg',
                              original_info: { width: 800, height: 500 },
                              ext_alt_text: 'a chart'
                            }
                          ]
                        }
                      },
                      views: { count: '377000' }
                    }
                  }
                }
              }
            },
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'conversationthread-1000',
              sortIndex: '2',
              content: {
                items: [
                  {
                    entryType: 'TimelineTimelineItem',
                    entryId: 'tweet-1002',
                    content: {
                      itemContent: {
                        tweet_results: {
                          result: {
                            __typename: 'Tweet',
                            rest_id: '1002',
                            core: {
                              user_results: {
                                result: {
                                  legacy: { screen_name: 'ada_builds', name: 'Ada Nakamura' },
                                  profile_image_url_https: 'https://pbs.twimg.com/profile_images/1/ada.jpg'
                                }
                              }
                            },
                            legacy: {
                              full_text: 'Second post',
                              created_at: 'Mon Dec 22 19:30:00 +0000 2025',
                              conversation_id_str: '1000'
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            },
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-1001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '1001',
                      core: {
                        user_results: {
                          result: {
                            legacy: { screen_name: 'ada_builds', name: 'Ada Nakamura' },
                            profile_image_url_https: 'https://pbs.twimg.com/profile_images/1/ada.jpg'
                          }
                        }
                      },
                      legacy: {
                        full_text: 'First post',
                        created_at: 'Mon Dec 22 19:20:00 +0000 2025',
                        conversation_id_str: '1000'
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/** A single tweet carrying a quoted post. */
export const TWEET_DETAIL_QUOTE_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-2001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '2001',
                      core: {
                        user_results: {
                          result: {
                            legacy: { screen_name: 'erin', name: 'Erin' },
                            profile_image_url_https: 'https://pbs.twimg.com/profile_images/2/erin.jpg'
                          }
                        }
                      },
                      legacy: {
                        full_text: 'look at this',
                        created_at: 'Mon Dec 22 19:00:00 +0000 2025',
                        is_quote_status: true
                      },
                      quoted_status_result: {
                        result: {
                          __typename: 'Tweet',
                          rest_id: '1999',
                          core: {
                            user_results: {
                              result: {
                                legacy: { screen_name: 'grace', name: 'Grace' },
                                profile_image_url_https: 'https://pbs.twimg.com/profile_images/3/grace.jpg'
                              }
                            }
                          },
                          legacy: {
                            full_text: 'The most damaging phrase...',
                            created_at: 'Mon Dec 22 18:00:00 +0000 2025'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/** A retweet: the visible body belongs to the nested original. */
export const TWEET_DETAIL_RETWEET_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-3001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '3001',
                      core: {
                        user_results: {
                          result: {
                            legacy: { screen_name: 'alice', name: 'Alice' },
                            profile_image_url_https: 'https://pbs.twimg.com/profile_images/4/alice.jpg'
                          }
                        }
                      },
                      legacy: {
                        full_text: 'RT @bob: original words',
                        created_at: 'Mon Dec 22 19:00:00 +0000 2025',
                        retweeted_status_result: {
                          result: {
                            __typename: 'Tweet',
                            rest_id: '2999',
                            core: {
                              user_results: {
                                result: {
                                  legacy: { screen_name: 'bob', name: 'Bob' },
                                  profile_image_url_https: 'https://pbs.twimg.com/profile_images/5/bob.jpg'
                                }
                              }
                            },
                            legacy: {
                              full_text: 'original words',
                              created_at: 'Mon Dec 22 18:00:00 +0000 2025',
                              extended_entities: {
                                media: [
                                  {
                                    type: 'animated_gif',
                                    media_url_https: 'https://pbs.twimg.com/tweet_video_thumb/gif.jpg',
                                    original_info: { width: 600, height: 400 },
                                    video_info: {
                                      duration_millis: 4000,
                                      variants: [
                                        { content_type: 'video/mp4', bitrate: 832000, url: 'https://video.twimg.com/gif.mp4' }
                                      ]
                                    }
                                  }
                                ]
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/** A tweet that was deleted. */
export const TWEET_DETAIL_TOMBSTONE_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-4001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'TweetTombstone',
                      tombstone: { text: { text: 'This Post was deleted.' } }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/**
 * A tweet whose author uses the newer user shape.
 *
 * X moved the user object's profile fields out of `legacy`: the avatar now
 * lives at `avatar.image_url` while `name`/`screen_name` live in `core`. The
 * older `profile_image_url_https` field is absent here on purpose, so a parser
 * that only reads the legacy path drops the avatar to a placeholder.
 */
export const TWEET_DETAIL_NEW_USER_SHAPE_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-7001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '7001',
                      core: {
                        user_results: {
                          result: {
                            core: { screen_name: 'mkdir700', name: 'Mark' },
                            avatar: {
                              image_url: 'https://pbs.twimg.com/profile_images/7001/mark_normal.jpg'
                            },
                            is_blue_verified: true
                          }
                        }
                      },
                      legacy: {
                        full_text: 'new shape',
                        created_at: 'Wed Oct 01 14:24:00 +0000 2026'
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/**
 * A long-form post carrying an X article.
 *
 * Transcribed from a real `TweetResultByRestId` response captured on 2026-10-09
 * (`docs/observed-dom-2026-10-09.md`). Three details are load-bearing:
 *
 *   - `title` carries a trailing space (`"Anime Harry Potter "`), which X really
 *     sends and which would otherwise print as a phantom gap on the card;
 *   - the cover's dimensions are the only source of its ratio, since the article
 *     entity carries no aspect ratio of its own;
 *   - the body's last entity expands to `/i/article/<id>`, a link X does not
 *     render, so a card built from this payload used to grow an `x.com/i/article`
 *     tail the DOM channel never showed.
 */
export const TWEET_DETAIL_ARTICLE_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-2108306407921443081',
              sortIndex: '1',
              content: {
                itemContent: {
                  __typename: 'TimelineTweet',
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '2108306407921443081',
                      core: {
                        user_results: {
                          result: {
                            core: { screen_name: 'kevinleguillou', name: 'Kevin Le Guillou' },
                            avatar: { image_url: 'https://pbs.twimg.com/profile_images/1700476606/avatar_normal.jpg' },
                            is_blue_verified: true
                          }
                        }
                      },
                      article: {
                        article_results: {
                          id: 'QXJ0aWNsZUVudGl0eVJlc3VsdHM6MjEwODMwMTUwNDU2MjI2MjAxNg==',
                          result: {
                            __typename: 'ArticleEntity',
                            id: 'QXJ0aWNsZUVudGl0eToyMTA4MzAxNTA0NTYyMjYyMDE2',
                            rest_id: '2108301504562262016',
                            title: 'Anime Harry Potter ',
                            preview_text: 'This is a writeup for those that wanted to know how I made the videos that got popular during the Malfoid craze.\n \nThe core concept to make the videos is simple. Use a Video Generation model, locally',
                            cover_media_results: {
                              id: 'QXBpTWVkaWFSZXN1bHRzOgwABQoAAR1CMYAp1hABCgACAAAAABcfxyYAAA==',
                              result: {
                                __typename: 'ApiMedia',
                                media_info: {
                                  __typename: 'ApiImage',
                                  original_img_url: 'https://pbs.twimg.com/media/HUIxgCnWEAEUKgI.jpg',
                                  original_img_width: 1344,
                                  original_img_height: 538
                                }
                              }
                            }
                          }
                        }
                      },
                      legacy: {
                        full_text: 'Here is the promised write up, it explains how I made the recent videos, how to structure your work, and good ideas I picked up along the way. https://t.co/MXcei1QhVg',
                        created_at: 'Thu Oct 08 21:19:52 +0000 2026',
                        entities: {
                          urls: [
                            {
                              url: 'https://t.co/MXcei1QhVg',
                              expanded_url: 'https://x.com/i/article/2108301504562262016',
                              display_url: 'x.com/i/article/2108…',
                              indices: [143, 166]
                            }
                          ]
                        }
                      },
                      views: { count: '15947' }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/** A cursor entry that must not be mistaken for a tweet. */
export const TWEET_DETAIL_CURSOR_ONLY_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            { entryType: 'TimelineTimelineCursor', entryId: 'conversationthread-1000-cursor-showmore-1000' }
          ]
        }
      ]
    }
  }
});

/** A visibility-restricted tweet wrapped in TweetWithVisibilityResults. */
export const TWEET_DETAIL_VISIBILITY_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-5001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'TweetWithVisibilityResults',
                      tweet: {
                        __typename: 'Tweet',
                        rest_id: '5001',
                        core: {
                          user_results: {
                            result: {
                              legacy: { screen_name: 'hidden', name: 'Hidden' },
                              profile_image_url_https: 'https://pbs.twimg.com/profile_images/6/h.jpg'
                            }
                          }
                        },
                        legacy: { full_text: 'limited', created_at: 'Mon Dec 22 19:00:00 +0000 2025' }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/**
 * A post whose body carries entities. The offsets are real, so the parser's
 * index walking and URL display rewriting can be pinned.
 *
 * body: "See https://t.co/abc123 and #build by @ada_builds ($NVDA)"
 *         0123456789...           ^4..23  ^28..34   ^38..49    ^51..56
 */
export const TWEET_DETAIL_ENTITIES_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-9001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '9001',
                      core: {
                        user_results: {
                          result: {
                            legacy: { screen_name: 'ada_builds', name: 'Ada Nakamura' },
                            profile_image_url_https: 'https://pbs.twimg.com/profile_images/1/ada.jpg'
                          }
                        }
                      },
                      legacy: {
                        full_text: 'See https://t.co/abc123 and #build by @ada_builds ($NVDA)',
                        created_at: 'Mon Dec 22 19:00:00 +0000 2025',
                        entities: {
                          hashtags: [{ text: 'build', indices: [28, 34] }],
                          symbols: [{ text: 'NVDA', indices: [51, 56] }],
                          user_mentions: [{ screen_name: 'ada_builds', indices: [38, 49] }],
                          urls: [
                            {
                              url: 'https://t.co/abc123',
                              expanded_url: 'https://github.com/post-to-card',
                              display_url: 'github.com/post-to-card',
                              indices: [4, 23]
                            }
                          ]
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/**
 * A post with media, where X appends the media permalink to the body.
 *
 * `legacy.full_text` ends with the permalink's `t.co` URL and
 * `display_text_range` states where the author's text actually stops. The URL is
 * not listed in `entities.urls`, so the range is the only signal that it is not
 * the author's words; the DOM channel instead renders the tail as a bare
 * `pic.twitter.com` link and already drops it.
 */
export const TWEET_DETAIL_MEDIA_PERMALINK_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-8001',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '8001',
                      core: {
                        user_results: {
                          result: {
                            legacy: { screen_name: 'YLDLZN', name: '伊利丹' },
                            profile_image_url_https: 'https://pbs.twimg.com/profile_images/9/yldlzn.jpg'
                          }
                        }
                      },
                      legacy: {
                        full_text: '怪不得1600N的力能踩断尊界的踏板...... https://t.co/PFUKksZ8YL',
                        display_text_range: [0, 24],
                        created_at: 'Fri Oct 09 07:27:00 +0000 2026',
                        entities: {},
                        extended_entities: {
                          media: [
                            {
                              type: 'photo',
                              media_url_https: 'https://pbs.twimg.com/media/chat.jpg',
                              original_info: { width: 1200, height: 900 },
                              ext_alt_text: '聊天记录'
                            }
                          ]
                        },
                        favorite_count: 152
                      },
                      views: { count: '81200' }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/**
 * A media post that also carries an author link inside the display range.
 *
 * The tail strip is per `display_text_range`, not "drop the last URL": the
 * author's own `t.co` (indices inside the range, expanded to a live site) must
 * survive while the appended media permalink after the range is dropped. This is
 * the boundary the plain media fixture cannot state, since its `entities` is
 * empty.
 */
export const TWEET_DETAIL_MEDIA_WITH_LINK_JSON = JSON.stringify({
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryType: 'TimelineTimelineItem',
              entryId: 'tweet-8002',
              sortIndex: '1',
              content: {
                itemContent: {
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '8002',
                      core: {
                        user_results: {
                          result: {
                            legacy: { screen_name: 'ada_builds', name: 'Ada Nakamura' },
                            profile_image_url_https: 'https://pbs.twimg.com/profile_images/1/ada.jpg'
                          }
                        }
                      },
                      legacy: {
                        full_text: 'See https://t.co/abc123 https://t.co/MEDIAPERM',
                        display_text_range: [0, 23],
                        created_at: 'Fri Oct 09 07:27:00 +0000 2026',
                        entities: {
                          urls: [
                            {
                              url: 'https://t.co/abc123',
                              expanded_url: 'https://example.com/post',
                              display_url: 'example.com/post',
                              indices: [4, 23]
                            }
                          ]
                        },
                        extended_entities: {
                          media: [
                            {
                              type: 'photo',
                              media_url_https: 'https://pbs.twimg.com/media/chat.jpg',
                              original_info: { width: 1200, height: 900 },
                              ext_alt_text: '聊天记录'
                            }
                          ]
                        },
                        favorite_count: 9
                      },
                      views: { count: '1000' }
                    }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
});

/**
 * One home-timeline page holding three posts by one author, the second and third
 * of which answer the one before them.
 *
 * The nesting follows the timeline's own shape (`data.home.home_timeline_urt`),
 * which is deliberately not the `TweetDetail` shape above: the reply linkage is
 * read by shape, not by path, and this fixture is what holds that promise.
 *
 * The reply fields are the ones `docs/detection-audit.md` measured X threading
 * by — `in_reply_to_status_id_str` naming the previous post, with
 * `in_reply_to_screen_name` naming its author. Only the fields under test are
 * present. The ids line up with `MIXED_FEED_WITH_ADS_AND_REPLIES_HTML`
 * (`tests/fixtures/ads-replies.ts`), so a click in that feed resolves against
 * this payload.
 */
export const HOME_TIMELINE_SELF_THREAD_JSON = JSON.stringify({
  data: {
    home: {
      home_timeline_urt: {
        instructions: [
          {
            type: 'TimelineAddEntries',
            entries: [
              timelineTweet('tweet-9001', '3', {
                id: '9001',
                text: 'Part 1: The problem with state machines',
              }),
              timelineTweet('tweet-9002', '2', {
                id: '9002',
                text: 'Part 2: Designing pure transitions',
                repliesTo: { id: '9001', handle: 'alice' },
              }),
              timelineTweet('tweet-9004', '1', {
                id: '9004',
                text: 'Part 3: Conclusion & summary',
                repliesTo: { id: '9002', handle: 'alice' },
              }),
            ],
          },
        ],
      },
    },
  },
});

/** One timeline entry, in the shape a list view returns it. */
function timelineTweet(
  entryId: string,
  sortIndex: string,
  post: { id: string; text: string; repliesTo?: { id: string; handle: string } }
) {
  return {
    entryType: 'TimelineTimelineItem',
    entryId,
    sortIndex,
    content: {
      itemContent: {
        __typename: 'TimelineTweet',
        tweet_results: {
          result: {
            __typename: 'Tweet',
            rest_id: post.id,
            legacy: {
              id_str: post.id,
              full_text: post.text,
              created_at: 'Sat Aug 01 10:00:00 +0000 2026',
              conversation_id_str: '9001',
              ...(post.repliesTo
                ? {
                    in_reply_to_status_id_str: post.repliesTo.id,
                    in_reply_to_screen_name: post.repliesTo.handle,
                  }
                : {}),
            },
          },
        },
      },
    },
  };
}
