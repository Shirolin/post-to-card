# Domain Glossary (post-to-card)

This glossary records the project's domain concepts and their canonical names. Use these terms consistently in code, reviews, and architecture discussions.

---

## Domain Concepts

### Card
The final exportable visual artifact presenting tweet content, author information, media items, metadata, and optional signature decorations according to a curated visual theme.

### Thread
A continuous, chronological chain of consecutive tweets authored by the same user, excluding ads, unrelated replies, and retweets.

### Thread Session
The active, in-memory editing lifecycle of a specific thread inside the card preview modal. Governs which tweets within the thread are currently included or excluded from the card rendering. It is transient and distinct from user preferences.

### User Preferences
The persistent styling and layout configuration (visual theme, padding tier, border radius, aspect ratio, image fit, media layout, interface and card language, and display toggles) stored in extension storage and reused across all card generations.

Interface and card language is one setting with two scopes, deliberately. It localizes the modal's own chrome and the extension popup, and it also formats the dates printed inside the card, because a card is shared with people who read the poster's language rather than the reader's. It does **not** reach the card's prose or a translated-from notice: those are reproduced verbatim from the source page, since they are the author's words and X's own attribution rather than card UI.

### Media Item
A rich media asset attached to a tweet (image, video poster, animated GIF) with normalized dimensions, high-resolution URLs, and layout hints.

### Signature
A material-specific decorative or structural header/divider line (e.g. tick-rule, perforation, titlebar, seal, block) defined uniquely per theme tokens.
