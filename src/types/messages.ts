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
   * Whether sending the same request again could plausibly succeed.
   *
   * Required, because every error exit has to answer it and the two answers
   * want opposite handling: a 404 is X saying the picture is gone, while a 5xx
   * or a reset connection never got an answer about it. Only the proxy saw the
   * status code or the abort, so it is the only layer that can draw the line.
   */
  retryable: boolean;
}

export type ExtensionResponse =
  | FetchImageBase64SuccessResponse
  | FetchImageBase64ErrorResponse;
