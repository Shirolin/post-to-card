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
