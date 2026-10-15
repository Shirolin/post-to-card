import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { h, type ComponentType } from 'preact';
import { render } from 'preact-render-to-string';

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
  rasterizerCalls: Array<{ target: unknown; options: Record<string, any> }>;
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
