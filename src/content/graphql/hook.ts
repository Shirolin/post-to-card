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

import { WATCHED_OPERATIONS } from './operations.ts';

const GRAPHQL_URL_PATTERN = /\/i\/api\/graphql\/[^/]+\/([A-Za-z0-9_]+)/;

/** Namespace for messages crossing from the MAIN world into the content script. */
const MESSAGE_SOURCE = 'post-to-card-graphql';
const MESSAGE_TYPE = 'post-to-card:graphql-payload';

interface GraphQLPayload {
  source: typeof MESSAGE_SOURCE;
  type: typeof MESSAGE_TYPE;
  operationName: string;
  queryId: string;
  /** The response body, as text -- this is what X itself received. */
  body: string;
  status: number;
  observedAt: number;
}

function extractRequestInfo(url: string): { operationName: string; queryId: string } | null {
  if (typeof url !== 'string' || !url.includes('/i/api/graphql/')) return null;

  const pathMatch = GRAPHQL_URL_PATTERN.exec(url);
  if (!pathMatch) return null;

  const operationName = pathMatch[1];
  if (WATCHED_OPERATIONS[operationName] !== true) return null;

  // Recover the rotated segment purely so the diagnostics can report a change.
  const queryIdMatch = /\/i\/api\/graphql\/([^/]+)\//.exec(url);
  return { operationName, queryId: queryIdMatch ? queryIdMatch[1] : '' };
}

function post(payload: GraphQLPayload): void {
  try {
    // The payload is all primitives, so the structured clone `postMessage`
    // performs crosses the world boundary as it is. It used to be
    // `JSON.stringify`d first, which walked the whole response body twice --
    // once to escape it into a string, once in the receiver to parse it back --
    // for a body that is already a string.
    window.postMessage(payload, window.location.origin);
  } catch {
    // A response that cannot be cloned is simply not usable; the DOM channel
    // remains available.
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
    // Forward only the arguments the caller actually supplied. Passing an
    // explicit `undefined` for the optional `async` parameter is coerced to
    // false, which silently turns the page's requests synchronous and makes X
    // throw when it later sets `xhr.timeout`.
    return originalOpen.apply(this, [method, url, ...rest] as Parameters<typeof originalOpen>);
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
    // Call through with exactly the arguments received, so an absent init
    // stays absent rather than becoming an explicit undefined.
    const callThrough = () => (init === undefined
      ? originalFetch(input)
      : originalFetch(input, init));

    if (!info) return callThrough();

    const response = await callThrough();

    // The page is awaiting this call, so nothing here may sit between the
    // response arriving and it being handed back. Reading the body used to be
    // awaited before the return, which made X wait for this hook to finish
    // parsing a multi-megabyte timeline payload before its own promise resolved.
    //
    // The clone is taken synchronously -- it has to be, since the page starts
    // consuming the body the moment it has the response -- and only then is the
    // response returned. The read itself continues on its own afterwards; the
    // bridge keeps only the newest body per operation, so a read that finishes
    // late is still the one that matters.
    const clone = response.status === 200 ? response.clone() : null;
    if (clone) {
      void clone
        .text()
        .then((body) => {
          post({
            source: MESSAGE_SOURCE,
            type: MESSAGE_TYPE,
            operationName: info.operationName,
            queryId: info.queryId,
            body,
            status: response.status,
            observedAt: Date.now(),
          });
        })
        .catch(() => {
          // An unreadable body is not an error worth surfacing; the DOM channel
          // covers the gap.
        });
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
