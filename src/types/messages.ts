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
}

export type ExtensionResponse =
  | FetchImageBase64SuccessResponse
  | FetchImageBase64ErrorResponse;
