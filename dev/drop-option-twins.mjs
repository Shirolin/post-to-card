/**
 * One-off: drop the `.post-to-card-target.<option>-<value>` twin from card.css.
 *
 * Verified first by dev/check-twin-coverage.mjs: every one of these has an
 * equivalent `[data-<option>=...]` selector in the same declaration block, so
 * the class cannot decide anything the attribute does not. Same element, same
 * specificity, same block.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'src/content/styles/card.css';
const text = readFileSync(PATH, 'utf-8');

const TWIN = /^\s*\.post-to-card-target\.(padding|radius|ratio)-[A-Za-z0-9-]+(\s|,|$)/;
const isSelectorLine = (line) => {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/')) return false;
  if (t.startsWith('}') || t.startsWith('{')) return false;
  if (t.endsWith('{')) return true;
  if (t.endsWith(',')) return true;
  return false;
};

const out = [];
let buffer = null;
let dropped = 0;

const flush = () => {
  let opensBlock = false;
  const entries = buffer.map((l) => {
    if (!l.trimEnd().endsWith('{')) return l;
    opensBlock = true;
    return l.replace(/\{\s*$/, '').replace(/,\s*$/, '').replace(/\s+$/, '');
  });

  const kept = entries.filter((l) => (TWIN.test(l) ? (dropped++, false) : true));
  if (kept.length === 0) {
    console.error('REFUSING: a rule would have no selectors left:');
    console.error(buffer.join('\n'));
    process.exit(1);
  }
  for (let i = kept.length - 1; i >= 0; i--) {
    if (!kept[i].trim()) continue;
    kept[i] = kept[i].replace(/,\s*$/, '') + (opensBlock ? ' {' : '');
    break;
  }
  const cleaned = [];
  for (const line of kept) {
    if (!line.trim() && (!cleaned.length || !cleaned[cleaned.length - 1].trim())) continue;
    cleaned.push(line);
  }
  out.push(...cleaned);
  buffer = null;
};

for (const line of text.split('\n')) {
  if (buffer) {
    buffer.push(line);
    if (line.trimEnd().endsWith('{')) flush();
    continue;
  }
  if (isSelectorLine(line)) {
    buffer = [line];
    if (line.trimEnd().endsWith('{')) flush();
    continue;
  }
  out.push(line);
}
if (buffer) flush();

writeFileSync(PATH, out.join('\n'), 'utf-8');
console.log(`${dropped} option class selectors dropped`);