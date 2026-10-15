import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { h, type ComponentType } from 'preact';
import { render } from 'preact-render-to-string';

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
 */
let server: Promise<ViteDevServer> | null = null;

function serverFor(): Promise<ViteDevServer> {
  if (!server) {
    server = createServer({
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
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
