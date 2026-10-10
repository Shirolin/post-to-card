import { createServer, type ViteDevServer } from 'vite';
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
