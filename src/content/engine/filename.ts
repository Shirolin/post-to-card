/**
 * Filename construction for exported cards.
 *
 * The downloads folder used to receive `post-to-card-<epoch>.png`, which is
 * unique and unreadable: a day of exports is a column of identical-looking
 * numbers. The pieces needed to name a file after what it contains -- handle,
 * date, opening line -- are already in `TweetData`, so the engine is handed a
 * name instead of a timestamp.
 *
 * Kept pure and DOM-free: every rule below is a string rule that can be tested
 * without a browser, including the Windows ones, which are the reason this is
 * not a one-line template.
 */

export interface ExportFilenameInput {
  /** Author handle, with or without a leading `@`. */
  handle?: string;
  /** Tweet text; only its first line is used. */
  text?: string;
  /** ISO or otherwise parseable timestamp of the tweet. */
  timestamp?: string;
  /** Fallback date when `timestamp` is missing or unparseable. */
  now?: Date;
}

export interface ExportFilenameOptions {
  /** Total code points allowed, extension included. */
  maxLength?: number;
  /** Extension without the dot. */
  extension?: string;
}

const DEFAULT_MAX_LENGTH = 120;

/** Characters Windows refuses in a filename, plus control characters. */
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
/** Invisible characters that would make two visibly identical names differ. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\uFEFF]/g;
/** Windows also refuses a segment that ends in a dot or a space. */
const TRAILING_DOTS_OR_SPACES = /[. ]+$/;
/** Reserved device names, case-insensitive, with or without an extension. */
const RESERVED_DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function cleanHandle(handle: string | undefined): string {
  const raw = (handle ?? '').trim().replace(/^@+/, '');
  const ascii = raw.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
  return ascii || 'x';
}

/** `YYYY-MM-DD` in UTC, so the same tweet names its file the same way everywhere. */
function datePart(input: ExportFilenameInput): string {
  const candidate = input.timestamp ? new Date(input.timestamp) : null;
  const source =
    candidate && !Number.isNaN(candidate.getTime())
      ? candidate
      : input.now && !Number.isNaN(input.now.getTime())
        ? input.now
        : new Date();

  const year = source.getUTCFullYear();
  const month = String(source.getUTCMonth() + 1).padStart(2, '0');
  const day = String(source.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** A half of a surrogate pair with its other half missing. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function slugify(text: string | undefined): string {
  if (!text) return '';

  // NFC first, so a filename does not depend on whether the tweet's text
  // arrived composed (`é`) or decomposed (`e` + U+0301). Without this the
  // combining mark is dropped by the whitelist below and two visually
  // identical posts get two different names.
  const firstLine = text.normalize('NFC').split(/\r?\n/)[0];
  const withoutUrls = firstLine.replace(/https?:\/\/\S+|www\.\S+/gi, ' ');

  return withoutUrls
    .replace(ILLEGAL_FILENAME_CHARS, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(/[\s_]+/g, '-')
    // Keep letters (any script, CJK included), digits and the separator.
    // `\p{M}` matters as much as `\p{L}`: Devanagari, Thai and other scripts
    // spell with combining marks, and dropping them leaves an unreadable
    // consonant skeleton rather than a shortened word.
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .replace(LONE_SURROGATE, '');
}

/**
 * Truncates by code point, never by UTF-16 unit: a slice through a surrogate
 * pair produces a lone half that some tools render as a replacement character
 * and some reject outright.
 */
function truncateCodePoints(value: string, max: number): string {
  if (max <= 0) return '';
  const points = Array.from(value);
  return points.length <= max ? value : points.slice(0, max).join('');
}

/**
 * Builds `post-to-card_<handle>_<date>[_<slug>].png`.
 *
 * Every segment is sanitised independently and the result is then checked as a
 * whole, because length is a property of the joined name. Returns a usable name
 * for every input -- the handle falls back to `x`, the slug is optional, the
 * date always exists -- so callers never need a second guess, and the returned
 * name never exceeds `maxLength`: the slug gives way first, then the handle,
 * then the stem, each on the same code-point measure.
 */
export function buildExportFilename(
  input: ExportFilenameInput,
  options: ExportFilenameOptions = {}
): string {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  // The extension is part of the name the caller is promised, so it is cleaned
  // like every other segment: an extension carrying a separator or a trailing
  // dot is stripped from the *returned* name after the fact otherwise, which
  // desynchronises the length arithmetic from the result.
  const extension =
    truncateCodePoints(
      (options.extension ?? 'png')
        .replace(/^\./, '')
        .replace(ILLEGAL_FILENAME_CHARS, '')
        .replace(INVISIBLE_CHARS, '')
        .replace(LONE_SURROGATE, '')
        .replace(TRAILING_DOTS_OR_SPACES, ''),
      // Keeps `suffix` short enough that the stem always has room for a handle.
      16
    ) || 'png';

  const handle = cleanHandle(input.handle);
  const date = datePart(input);
  const slug = slugify(input.text);

  const suffix = `.${extension}`;
  const prefix = 'post-to-card';

  const assemble = (handlePart: string, slugPart: string): string =>
    [prefix, handlePart, date, slugPart].filter(Boolean).join('_') + suffix;

  // Code points, not UTF-16 units, for the same reason as `truncateCodePoints`.
  const lengthOf = (value: string): number => Array.from(value).length;

  let name = assemble(handle, slug);

  if (lengthOf(name) > maxLength) {
    // Trim the slug first: the handle and date are the parts a person scans for.
    const available = maxLength - lengthOf(assemble(handle, '')) - 1;
    const trimmedSlug = truncateCodePoints(slug, available).replace(/-+$/g, '');
    name = assemble(handle, trimmedSlug);
  }

  if (lengthOf(name) > maxLength) {
    // The fixed segments alone overflow -- an absurdly long handle from a
    // hostile payload. The handle is the only one that may shrink; the date is
    // what makes two exports tell themselves apart.
    const available = maxLength - lengthOf(assemble('', '')) - 1;
    const shortHandle = truncateCodePoints(handle, Math.max(1, available)) || 'x';
    name = assemble(shortHandle, '');
  }

  if (lengthOf(name) > maxLength) {
    // Last resort, reachable only when `maxLength` is smaller than the fixed
    // prefix and suffix. Truncating the stem keeps the extension intact.
    const stem = truncateCodePoints(name, maxLength - lengthOf(suffix));
    name = stem.replace(TRAILING_DOTS_OR_SPACES, '') + suffix;
  }

  // Last line of defence: whatever the segments were, the joined name is clean.
  name = name.replace(ILLEGAL_FILENAME_CHARS, '').replace(INVISIBLE_CHARS, '');

  const stem = name.slice(0, name.length - suffix.length);
  const safeStem = (RESERVED_DEVICE_NAMES.test(stem) ? `_${stem}` : stem)
    .replace(TRAILING_DOTS_OR_SPACES, '');
  const fallbackStem = safeStem || `${prefix}_${handle}_${date}`;

  return fallbackStem + suffix;
}
