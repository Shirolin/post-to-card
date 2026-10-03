/**
 * Verify that every card-root option class has a data-form twin in the SAME
 * declaration block. If that holds, the class cannot decide anything the
 * attribute does not: same element, same specificity, same block.
 *
 * Prints any rule where the twin is missing, which would mean the class is
 * load-bearing and must not be removed.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync('src/content/styles/card.css', 'utf-8');

// option value -> class suffix and the data attribute it mirrors
const GROUPS = [
  { attr: 'data-padding', cls: 'padding' },
  { attr: 'data-radius', cls: 'radius' },
  { attr: 'data-ratio', cls: 'ratio' },
];

// Split into rules: selector-list { body }
const rules = [];
let i = 0;
while (i < css.length) {
  const open = css.indexOf('{', i);
  if (open === -1) break;
  // find matching close, honouring nested blocks (there are none here, but be safe)
  let depth = 1;
  let j = open + 1;
  while (j < css.length && depth > 0) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') depth--;
    j++;
  }
  rules.push({ selectors: css.slice(i, open), body: css.slice(open + 1, j - 1) });
  i = j;
}

let checked = 0;
const missing = [];

for (const rule of rules) {
  for (const { attr, cls } of GROUPS) {
    // Every `.post-to-card-target.<cls>-<value>` in this rule
    const re = new RegExp(`\\.post-to-card-target\\.${cls}-([A-Za-z0-9-]+)`, 'g');
    let m;
    while ((m = re.exec(rule.selectors))) {
      const value = m[1];
      checked++;
      // The twin must name the same option value.
      const twin = new RegExp(`\\[${attr}="${value.replace(/-/g, ':')}"\\]`);
      const twinAlt = new RegExp(`\\[${attr}="${value}"\\]`);
      if (!twin.test(rule.selectors) && !twinAlt.test(rule.selectors)) {
        missing.push(`.${cls}-${value} has no [${attr}=...] twin in:\n    ${rule.selectors.trim().replace(/\s+/g, ' ').slice(0, 200)}`);
      }
    }
  }
}

console.log(`${checked} class-form selectors checked against their data-form twins`);
if (missing.length) {
  console.log(`\n${missing.length} WITHOUT A TWIN — these are load-bearing:`);
  for (const m of missing) console.log('  ' + m);
  process.exit(1);
} else {
  console.log('all have a twin in the same block: removal cannot change which declaration wins');
}