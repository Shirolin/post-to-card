/**
 * Author Privacy: one post's tri-state against the global switch.
 *
 * `blurAuthor` is a default, not a verdict. Each post may override it either
 * way, and the card, the panel, the on-avatar button and the hint bar all have
 * to agree about what that means for a given post. They agree by asking here.
 *
 * This module answers only that question. Which posts the card shows, and what
 * they are keyed by, is `threadSession.ts`'s; this file takes a key and returns
 * a decision about the author it names.
 *
 * Two rules look alike and are deliberately not:
 *
 *   - Clicking an avatar writes the opposite of what is on screen. Turning the
 *     global switch off while overrides exist therefore *visually* clears them,
 *     and that is safe: every override already reads as visible.
 *   - "Follow global" in the hint bar makes every override agree with the switch
 *     again. It is computed from the switch's own value, not from what was on
 *     screen, so pressing it with the switch on leaves blurred authors blurred.
 *     Computing it off the visible state instead made the hint bar sharpen a
 *     card the user had just blurred.
 */

import type { AvatarPrivacyMode, BlurOverrides } from '../types/card.ts';

/** Whether a post's author is hidden, given its mode and the global switch. */
export function resolveAuthorBlur(
  mode: AvatarPrivacyMode | undefined,
  globalOn: boolean
): boolean {
  return mode === 'blur' ? true : mode === 'clear' ? false : globalOn;
}

/**
 * What an override should be after a click that flips the visible state.
 *
 * Always a real mode, never `'follow'`: one click states what this post's
 * author should look like, and the way back to the default is the panel's own
 * control.
 */
export function flipHidden(
  mode: AvatarPrivacyMode | undefined,
  globalOn: boolean
): AvatarPrivacyMode {
  return resolveAuthorBlur(mode, globalOn) ? 'clear' : 'blur';
}

/**
 * The hint bar's "follow global": every override whose visible state already
 * agrees with the switch is dropped, the rest is written as a mode that agrees.
 *
 * The result holds every post at `visible === globalOn`.
 */
export function followAll(
  overrides: BlurOverrides | undefined,
  globalOn: boolean
): BlurOverrides {
  const clean = normalizeOverrides(overrides);
  const next: BlurOverrides = {};
  for (const key of Object.keys(clean)) {
    if (resolveAuthorBlur(clean[key], globalOn) !== globalOn) {
      next[key] = globalOn ? 'blur' : 'clear';
    }
  }
  return next;
}

/**
 * What storage is allowed to mean.
 *
 * `saved` has been through a JSON round trip at least once, so anything can be
 * in it: a retired spelling, a number, `null`, or a key named `constructor`.
 * Only own, string keys with one of the two real modes survive, and the copy is
 * a plain object, so a prototype key can never be read back as a mode.
 */
export function normalizeOverrides(raw: unknown): BlurOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const next: BlurOverrides = {};
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === 'blur' || value === 'clear') next[key] = value;
  }
  return next;
}

/** The overrides with `key` set to `mode`; `'follow'` removes the entry. */
export function setOverride(
  overrides: BlurOverrides | undefined,
  key: string,
  mode: AvatarPrivacyMode
): BlurOverrides {
  const next = normalizeOverrides(overrides);
  if (mode === 'follow') delete next[key];
  else next[key] = mode;
  return next;
}
