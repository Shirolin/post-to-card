import assert from 'node:assert/strict';

/**
 * The same markup with every `data-testid` attribute removed -- what a logged-out
 * visitor gets, where X's test hooks are gone and only the structural signals
 * (`a[href*="/status/"]`, `time[datetime]`, `lang`) remain.
 *
 * Throws when there is nothing to strip, so a fixture that never carried a
 * testid cannot be passed off as this case and quietly test nothing.
 */
export function withoutTestIds(html: string): string {
  const stripped = html.replace(/\s+data-testid="[^"]*"/g, '');
  assert.notEqual(stripped, html, 'this fixture carries no data-testid to strip');
  assert.ok(!/\sdata-testid=/.test(stripped), 'a data-testid survived the strip');
  return stripped;
}
