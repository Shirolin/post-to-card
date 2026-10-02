/**
 * GraphQL response interceptor, injected into the MAIN world.
 *
 * X's web client fetches tweet data from its own GraphQL endpoints. Observing
 * those responses yields structured data (thread membership, reply targets,
 * retweet relationships, media manifest) without inferring anything from the
 * rendered DOM.
 *
 * Only the `operationName` segment of the URL is matched. The `queryId` segment
 * is read for diagnostics only and never used to identify a request, because X
 * rotates it regularly (TweetDetail has had at least five distinct values) and
 * pinning it would make the extension break on a schedule.
 */

const GRAPHQL_URL_PATTERN = /\/i\/api\/graphql\/[^/]+\/([A-Za-z0-9_]+)/;

/** Operations worth parsing. Everything else is ignored to keep the hook cheap. */
const WATCHED_OPERATIONS = new Set(['TweetDetail', 'TweetResultByRestId']);

/** Namespace for messages crossing from the MAIN world into the content script. */
const MESSAGE_SOURCE = 'post-to-card-graphql';
const MESSAGE_TYPE = 'post-to-card:graphql-payload';

interface GraphQLPayload {
  source: typeof MESSAGE_SOURCE;
  type: typeof MESSAGE_TYPE;
  operationName: string;
  queryId: string;
  /** Serialized response body. Kept as text so it crosses the world boundary safely. */
  body: string;
  status: number;
  observedAt: number;
}

function extractRequestInfo(url: string): { operationName: string; queryId: string } | null {
  if (typeof url !== 'string' || !url.includes('/i/api/graphql/')) return null;

  const pathMatch = GRAPHQL_URL_PATTERN.exec(url);
  if (!pathMatch) return null;

  const operationName = pathMatch[1];
  if (!WATCHED_OPERATIONS.has(operationName)) return null;

  // Recover the rotated segment purely so the diagnostics can report a change.
  const queryIdMatch = /\/i\/api\/graphql\/([^/]+)\//.exec(url);
  return { operationName, queryId: queryIdMatch ? queryIdMatch[1] : '' };
}

function post(payload: GraphQLPayload): void {
  try {
    // Structured clone cannot cross the world boundary safely, so the body
    // travels as a JSON string.
    window.postMessage(JSON.stringify(payload), window.location.origin);
  } catch {
    // A response that cannot be serialized is simply not usable; the DOM
    // channel remains available.
  }
}

function installXhrHook(): void {
  const proto = XMLHttpRequest.prototype;
  if ((proto as unknown as { __ptcHooked?: boolean }).__ptcHooked) return;

  const originalOpen = proto.open;
  proto.open = function patchedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    const info = extractRequestInfo(typeof url === 'string' ? url : url.toString());
    if (info) {
      this.addEventListener('load', () => {
        const status = this.status;
        const body = status === 200 ? this.responseText : '';
        post({
          source: MESSAGE_SOURCE,
          type: MESSAGE_TYPE,
          operationName: info.operationName,
          queryId: info.queryId,
          body,
          status,
          observedAt: Date.now(),
        });
      });
    }
    return originalOpen.call(
      this,
      method,
      url as string,
      // `open` accepts these as optional; forwarding undefined keeps the
      // browser's own default resolution intact.
      rest[0] as boolean,
      rest[1] as string,
      rest[2] as string
    );
  } as typeof proto.open;

  (proto as unknown as { __ptcHooked?: boolean }).__ptcHooked = true;
}

function installFetchHook(): void {
  if ((window.fetch as unknown as { __ptcHooked?: boolean }).__ptcHooked) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const info = extractRequestInfo(url);
    if (!info) return originalFetch(input, init);

    const response = await originalFetch(input, init);
    try {
      // Clone so the page can still consume the body.
      const body = response.status === 200 ? await response.clone().text() : '';
      post({
        source: MESSAGE_SOURCE,
        type: MESSAGE_TYPE,
        operationName: info.operationName,
        queryId: info.queryId,
        body,
        status: response.status,
        observedAt: Date.now(),
      });
    } catch {
      // An unreadable body is not an error worth surfacing; the DOM channel
      // covers the gap.
    }
    return response;
  } as typeof window.fetch;

  (window.fetch as unknown as { __ptcHooked?: boolean }).__ptcHooked = true;
}

try {
  installXhrHook();
  installFetchHook();
} catch (error) {
  console.warn('[Post-to-Card] GraphQL hook could not be installed:', error);
}
