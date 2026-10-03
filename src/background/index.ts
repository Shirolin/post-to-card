import { handleFetchImageBase64 } from './proxy.ts';
import type { ExtensionMessage, ExtensionResponse } from '../types/messages.ts';

console.log('[Post-to-Card] Background Service Worker initialized.');

export interface PingResponse {
  success: true;
  pong: true;
  dataUrl: string;
  contentType: string;
}

export type ServiceWorkerResponse = ExtensionResponse | PingResponse;

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ServiceWorkerResponse) => void
  ) => {
    if (message?.type === 'PING') {
      const pingResponse: PingResponse = {
        success: true,
        pong: true,
        dataUrl: '',
        contentType: 'text/plain',
      };
      sendResponse(pingResponse);
      return false;
    }

    if (message?.type === 'FETCH_IMAGE_BASE64') {
      handleFetchImageBase64(message.url).then((response: ExtensionResponse) => {
        sendResponse(response);
      });
      return true;
    }

    return false;
  }
);
