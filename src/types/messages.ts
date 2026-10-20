export interface FetchImageBase64Request {
  type: 'FETCH_IMAGE_BASE64';
  url: string;
}

export interface PingRequest {
  type: 'PING';
}

export type ExtensionMessage =
  | FetchImageBase64Request
  | PingRequest;

export interface FetchImageBase64SuccessResponse {
  success: true;
  dataUrl: string;
  contentType: string;
}

export interface FetchImageBase64ErrorResponse {
  success: false;
  error: string;
  /**
   * Whether the same request could plausibly succeed if it were sent again.
   *
   * Only the proxy can tell these apart: it is the one that saw the status code
   * or the abort. A 404 is X saying the picture is gone and a second ask only
   * costs a round trip; a 5xx, a 429 or a timeout is the network having a bad
   * moment. Absent means not retryable, so a caller that does not know about
   * this field behaves exactly as it did before it existed.
   */
  retryable?: boolean;
}

export type ExtensionResponse =
  | FetchImageBase64SuccessResponse
  | FetchImageBase64ErrorResponse;
