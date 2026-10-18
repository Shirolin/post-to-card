# Domain Glossary (post-to-card)

This glossary records the project's domain concepts and their canonical names. Use these terms consistently in code, reviews, and architecture discussions.

---

## Domain Concepts

### Card
The final exportable visual artifact presenting tweet content, author information, media items, metadata, and optional signature decorations according to a curated visual theme.

### Thread
A continuous, chronological chain of consecutive tweets authored by the same user, excluding ads, unrelated replies, and retweets.

### Thread Session
The active, in-memory editing lifecycle of a specific thread inside the card preview modal. Governs which tweets within the thread are currently included or excluded from the card rendering. The lifecycle is transient; the exclusions are not — they are saved in User Preferences (below), so a tweet excluded once stays excluded in any later card that contains it.

### Thread Resolution
The multi-channel intake pipeline that produces structured `ThreadData` from a target post. Prioritizes intercepted GraphQL conversation trees and client-side translations, falling back to chronological DOM timeline extraction corroborated by snowflake ordering, visual connectors, and GraphQL reply linkage.

### User Preferences
The persistent styling and layout configuration (visual theme, padding tier, corner, aspect ratio, image fit, media layout, interface and card language, display toggles, and the thread exclusions of a Thread Session) stored in extension storage and reused across all card generations.

Interface and card language is one setting with two scopes, deliberately. It localizes the modal's own chrome and the extension popup, and it also formats the dates printed inside the card, because a card is shared with people who read the poster's language rather than the reader's. It does **not** reach the card's prose or a translated-from notice: those are reproduced verbatim from the source page, since they are the author's words and X's own attribution rather than card UI.

### Media Item
A rich media asset attached to a tweet (image, video poster, animated GIF) with normalized dimensions, high-resolution URLs, and layout hints.

### Article
The long-form document an X post can carry, rendered inside the post as a nested reading surface. On the card it contributes a cover, a kicker, a title, and — only when the post itself says nothing — its own opening line as the lead; it never contributes its body, which runs to thousands of words and would make the card a reader rather than a poster. The post around it remains an ordinary tweet, with its own body, author and stats, and the post's own words take precedence as the lead whenever they exist.

### Long-form Post
A post that carries an Article. It is still a tweet — same author, body, stats and media — and the Article is one more thing it has. The distinction matters because the two are read from the same markup and are easy to conflate: a rule about the Article (its permalink is not rendered, its prose is not printed) is not automatically a rule about the post, and vice versa.

### Truncated Post
A post X renders in the DOM as a preview with its "Show more" control beside it, because the complete body — a note tweet — lives only in X's GraphQL `note_tweet` field. The DOM channel cannot see it, so the Card marks the cut with an ellipsis and a notice instead of passing the preview off as the author's ending. Distinct from a Long-form Post: an Article is rendered in the markup and abbreviated by the Card by design, while a Truncated Post's remainder is simply absent from the DOM.

### Signature
A material-specific decorative or structural header/divider line (e.g. tick-rule, perforation, titlebar, seal, block) defined uniquely per theme tokens.
