# Domain Glossary (post-to-card)

This glossary records the project's domain concepts and their canonical names. Use these terms consistently in code, reviews, and architecture discussions.

---

## Domain Concepts

### Card
The final exportable visual artifact presenting tweet content, author information, media items, metadata, and optional signature decorations according to a curated visual theme.

### Canvas
The exported picture: the mat the Card is mounted on. A Canvas is not the Card — the Card is the sheet, and the Canvas is the surface it sits on. Canvas Shape (`canvasRatio`) and Canvas Background (`canvasBackground`) are independent, and both default to off, in which case the Canvas *is* the Card's own box. Distinct from a theme's `canvas` token, which is the colour the preview stage is painted with and one of the backgrounds a Canvas can take.

### Mat
The element that carries the Canvas, styled `.ptc-mat`. The word is deliberately shared with a material's `mediaFrame: 'mat'` — both are the passe-partout a sheet is mounted on — so read the qualifier: *the* mat is the Canvas element, a *media* mat is the mount inside a picture cell.

### Thread
A continuous, chronological chain of consecutive tweets authored by the same user, excluding ads, unrelated replies, and retweets.

### Thread Session
The active, in-memory editing lifecycle of a specific thread inside the card preview modal. Governs which tweets within the thread are currently included or excluded from the card rendering. The lifecycle is transient; the exclusions are not — they are saved in User Preferences (below), so a tweet excluded once stays excluded in any later card that contains it.

One session answers every surface's question about the thread: which posts the Card is showing, which one the thread is about, how many are excluded, and whether one more may be dropped. The Card, the controls panel, the preview summary and the export handler all read that one answer, so they cannot disagree about which posts those are.

Two facts are reported side by side, because they are about two different surfaces: the *showing* set is never empty — a Card with nothing on it is not a Card, so the thread's target post stands in when everything is excluded — while the *raw count* still reports the exclusion as it is, which is what the panel quotes. The target post is the one that was opened; it is not the first post that happens to be showing, and the exclusions do not move it.

### Thread Resolution
The multi-channel intake pipeline that produces structured `ThreadData` from a target post. Prioritizes intercepted GraphQL conversation trees and client-side translations, falling back to chronological DOM timeline extraction corroborated by snowflake ordering, visual connectors, and GraphQL reply linkage.

### Author Privacy
One post's answer to "is this author hidden". Three states: follow the global switch (the default and the absence of an override), hidden, and shown. A post is named by the same key a Thread Session gives it, so the Card and the panel cannot disagree about which author an override is about; a post without an id is offered no switch at all. The quoted author at the first panel answers for itself, and its override lives only as long as the dialog is open -- a quoted post carries no id, so a saved key would land on a different post next time. The export draws the same decision the preview shows: a hidden author is a blurred face, never a removed one.

### User Preferences
The persistent styling and layout configuration (visual theme, padding tier, corner, aspect ratio, Canvas shape and background, image fit, media layout, interface and card language, display toggles, the high-resolution export preference, the thread exclusions of a Thread Session, and the per-post author-privacy overrides with the flag saying the preview hint was dismissed) stored in extension storage and reused across all card generations.

Most of these change what the Card looks like. The high-resolution preference does not: it changes how many pixels the exported file is made of, which is why its size is quoted beside the export buttons rather than on the Card. It is still one preference with one current value -- the dialog's own config -- and the size under the buttons and the pixels in the file are that same reading. A copy taken when the dialog opens is a second answer to a question that has one: turn the switch on afterwards and the readout names a file the export does not write.

Interface and card language is one setting with two scopes, deliberately. It localizes the modal's own chrome and the extension popup, and it also formats the dates printed inside the card, because a card is shared with people who read the poster's language rather than the reader's. It does **not** reach the card's prose or a translated-from notice: those are reproduced verbatim from the source page, since they are the author's words and X's own attribution rather than card UI.

The setting is a *preference*, not a language: **Auto** (the shipped default) means follow the browser's own language, while naming a language pins it and stops the following. Fourteen languages are supported — English, Simplified and Traditional Chinese, Japanese, Korean, German, French, Spanish, Italian, Brazilian Portuguese, Russian, Turkish, Ukrainian and Indonesian — and a stored value that names none of them is treated as Auto rather than as English, because it was following the browser before it went unreadable. The extension's own name and description in `chrome://extensions` and the store are a separate surface: Chrome picks those from the browser's language through the manifest's `default_locale`, and the in-card setting does not reach them.

A stored preference that names nothing the card can show is treated exactly like one that was never stored: both fall back to the option's shipped default. A value that cannot be read is not a choice, and the card does not make one on the user's behalf — the corner goes back to the material's own rather than to a fixed roundness.

### Media Item
A rich media asset attached to a tweet (image, video poster, animated GIF) with normalized dimensions, high-resolution URLs, and layout hints.

### Article
The long-form document an X post can carry. X renders it in one of two shapes: a status page inlines it as a nested reading surface, while a list view (home, profile, search) shows a preview card holding the cover, the title and a clamped excerpt. The card reads the title and the cover from whichever shape is present. On the card the Article contributes a cover, a kicker, a title, and — only when the post itself says nothing — its own opening line as the lead; it never contributes its body, which runs to thousands of words and would make the card a reader rather than a poster. The post around it remains an ordinary tweet, with its own body, author and stats, and the post's own words take precedence as the lead whenever they exist.

### Long-form Post
A post that carries an Article. It is still a tweet — same author, body, stats and media — and the Article is one more thing it has. The distinction matters because the two are read from the same markup and are easy to conflate: a rule about the Article (its permalink is not rendered, its prose is not printed) is not automatically a rule about the post, and vice versa.

### Truncated Post
A post X renders in the DOM as a preview with its "Show more" control beside it, because the complete body — a note tweet — lives only in X's GraphQL `note_tweet` field. The DOM channel cannot see it, so the Card marks the cut with an ellipsis and a notice instead of passing the preview off as the author's ending. Distinct from a Long-form Post: an Article is rendered in the markup and abbreviated by the Card by design, while a Truncated Post's remainder is simply absent from the DOM.

### Signature
A material-specific decorative or structural header/divider line (e.g. tick-rule, perforation, titlebar, seal, block) defined uniquely per theme tokens.
