import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { h, type ComponentType } from 'preact';
import { render } from 'preact-render-to-string';

import { readFileSync } from 'node:fs';
import type { TweetData, ThreadData } from '../../src/types/tweet.ts';
import type { CardConfig } from '../../src/types/card.ts';
import type { RasterizerCall } from './modern-screenshot-stub.ts';

/**
 * Renders a `.tsx` component to HTML, in Node.
 *
 * Node cannot load JSX, and the components pull their styles in through
 * `?inline`, so they have to come through the same transform the build uses.
 * Vite's SSR pipeline is borrowed for that. It externalises dependencies, which
 * is what makes the result usable here: the component and the renderer below end
 * up sharing one Preact instance, so `Fragment` and hook identity match between
 * them instead of being two copies that look alike.
 *
 * The dev server is kept for the run and never closed. Both entry points end in
 * `process.exit`, so an abandoned watcher cannot keep the suite alive.
 *
 * It watches the repository, and the repository holds things that are being
 * written while it watches. A probe under `.tmp/` that drops a Chrome profile
 * there (a `Cookies` file held open by the browser) takes the whole suite down
 * with `EBUSY` on the watcher -- a failure that says nothing about the code
 * under test. `dist/` is build output nobody reads through the dev server.
 */
let server: Promise<ViteDevServer> | null = null;

function serverFor(): Promise<ViteDevServer> {
  if (!server) {
    server = createServer({
      configFile: false,
      logLevel: 'silent',
      server: {
        middlewareMode: true,
        watch: { ignored: ['**/.tmp/**', '**/dist/**'] },
      },
      appType: 'custom',
      resolve: {
        alias: {
          // The rasterizer is the one boundary that genuinely cannot exist in
          // Node, so it is the one thing replaced — everything above it, the
          // export engine included, runs for real.
          'modern-screenshot': fileURLToPath(new URL('./modern-screenshot-stub.ts', import.meta.url)),
        },
      },
    });
  }
  return server;
}

export async function renderComponent(
  modulePath: string,
  exportName: string,
  props: Record<string, unknown>
): Promise<string> {
  const mod = await (await serverFor()).ssrLoadModule(modulePath);
  const component = mod[exportName] as ComponentType<Record<string, unknown>> | undefined;
  if (typeof component !== 'function') {
    throw new Error(`${modulePath} does not export a component called ${exportName}`);
  }
  return render(h(component, props));
}

export interface CardRenderArgs {
  data?: ThreadData | TweetData;
  config?: Partial<CardConfig>;
}

/**
 * Binds the card to one tier's base config and default data.
 *
 * Every tier used to keep its own `renderCard`, and the four had drifted into
 * three different signatures -- `(data)`, `(data, config)`, and one that took
 * `(config, data)` with the pair reversed. Tier 1-4 are in no tsconfig, so a
 * copy whose arguments were swapped compiled to nothing and bound a tweet to
 * `config` in silence. One factory, one argument shape, and a tier that wants
 * the card only names its base config. `defaultData` is for a tier that renders
 * one fixture by default; a tier that always names its data binds without one,
 * and a call that then passes no `data` is an error rather than a card built
 * from `undefined`.
 */
export function cardRenderer(
  baseConfig: CardConfig,
  defaultData?: ThreadData | TweetData
): (args?: CardRenderArgs) => Promise<string> {
  return (args = {}) => {
    const data = args.data ?? defaultData;
    if (!data) {
      throw new Error('renderCard(): no data argument and this renderer was bound without a default');
    }
    return renderComponent('/src/content/ui/Card.tsx', 'Card', {
      data,
      config: { ...baseConfig, ...args.config },
      onExcludeTweet: () => {},
    });
  };
}

/**
 * Loads a `.tsx` module through the same pipeline, so its exported *functions*
 * can be called rather than only its components rendered.
 *
 * Node cannot import a `.tsx` at all (`ERR_UNKNOWN_FILE_EXTENSION`), which is how
 * `Modal.tsx`'s `lockScroll` came to have a hand-written copy inside the tier that
 * claims to test it. The module still runs in Node, so it reads the same
 * `globalThis.document` and `globalThis.window` the caller installed.
 */
export async function loadModule(modulePath: string): Promise<Record<string, unknown>> {
  return (await serverFor()).ssrLoadModule(modulePath) as unknown as Record<string, unknown>;
}

/**
 * The export engine as the SSR pipeline loads it.
 *
 * That is the copy wired to the rasterizer stand-in. A plain import would be
 * Node's second copy of the module, talking to the real `modern-screenshot` and
 * failing for want of a canvas.
 */
export async function exportEngine(): Promise<Record<string, any>> {
  return loadModule('/src/content/engine/export.ts');
}

export interface RasterizerStub {
  /** Every call the export engine made, in order. */
  rasterizerCalls: RasterizerCall[];
  /** Makes the next rasterization reject, the way a browser failure would. */
  failNextRasterization: (message: string) => void;
  /** Makes the next rasterization return a zero-byte Blob. */
  failNextRasterizationWithEmptyBlob: () => void;
  /** Overrides the next successful Blob's size, in bytes. */
  setNextBlobSize: (size: number) => void;
  resetRasterizer: () => void;
}

/**
 * The `modern-screenshot` stand-in the export engine is talking to.
 *
 * Fetched through the SSR pipeline rather than imported: a relative import
 * would be Node's second copy of the module, and its call log would stay empty
 * while the engine wrote to the other one.
 */
export async function rasterizer(): Promise<RasterizerStub> {
  return (await loadModule('/tests/env/modern-screenshot-stub.ts')) as unknown as RasterizerStub;
}

/**
 * A stylesheet read as rules, so a test can ask which rule answers a question.
 *
 * Offline there is no CSS engine, so the behavioural answer ("what applies to
 * this element") cannot be computed here. What *can* be done is the part that
 * matters: read the file the way the engine reads it — comments removed, rules
 * cut into selector and declarations, and the `@media` conditions they sit under
 * carried on the rule — instead of searching its raw text. A substring search
 * over the source finds a declaration in a comment, in an unrelated rule, or in
 * the explanation of the bug the test guards against, and reports it as the rule
 * under test.
 *
 * Not a CSS parser: `@supports` / `@layer` / `@import` are skipped, nesting is
 * read one level of at-rule deep (which is all either stylesheet uses), and
 * `var()` is taken as written — `base.css` composes the sheet, so there are no
 * cross-file properties to resolve. It answers "does this selector carry this
 * declaration, and under what condition", which is what these tests ask.
 */
export interface CssRule {
  /** The selector list, whitespace collapsed: `.a, .b` reads `.a, .b`. */
  selector: string;
  /** The selector list split on commas, each part trimmed. */
  selectors: string[];
  /** Declarations as written, `prop: value` without the trailing semicolon. */
  declarations: string[];
  /**
   * The at-rule conditions guarding this rule, outermost first: a rule inside
   * `@media (max-width: 900px)` carries `['(max-width: 900px)']`, and a rule
   * outside every at-rule carries `[]`.
   */
  media: string[];
  /** Whether a declaration whose property is `property` contains `text`. */
  declares: (property: string, text: string) => boolean;
}

/** Index of the `}` that closes the block opened at `open`, or -1. */
function matchingBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** The rules in `src`, with `media` as the conditions they inherit. */
function readRules(src: string, media: string[], rules: CssRule[]): void {
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const header = src.slice(i, open).replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s+/g, ' ');
    const close = matchingBrace(src, open);
    if (close < 0) break;
    const body = src.slice(open + 1, close);

    // An at-rule wraps rules rather than declaring anything. `@media` conditions
    // are carried down, because a rule inside one is only a rule when its
    // condition holds; the others are skipped whole, headers and all.
    const at = header.match(/^@(media|supports|layer|container)\b\s*(.*)$/i);
    if (at) {
      if (at[1].toLowerCase() === 'media') {
        readRules(body, [...media, ...splitConditions(at[2])], rules);
      }
      i = close + 1;
      continue;
    }

    const selector = header;
    const declarations = body
      .split(';')
      .map((d) => d.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    const selectors = selector.split(',').map((s) => s.trim()).filter(Boolean);
    rules.push({
      selector,
      selectors,
      declarations,
      media,
      declares: (property, text) =>
        declarations.some((d) => {
          const colon = d.indexOf(':');
          if (colon < 0 || d.slice(0, colon).trim() !== property) return false;
          return d.slice(colon + 1).includes(text);
        }),
    });
    i = close + 1;
  }
}

/**
 * `(max-width: 900px)` is one condition; a list joined by `,` is several, and a
 * rule under any of them applies when that one does.
 */
function splitConditions(condition: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < condition.length; i++) {
    if (condition[i] === '(') depth++;
    else if (condition[i] === ')') depth--;
    else if (condition[i] === ',' && depth === 0) {
      parts.push(condition.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(condition.slice(start).trim());
  return parts.filter(Boolean);
}

export function cssSheet(file: string): CssRule[] {
  const rules: CssRule[] = [];
  readRules(readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, ''), [], rules);
  return rules;
}
