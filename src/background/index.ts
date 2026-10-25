import { handleFetchImageBase64 } from './proxy.ts';
import type { ExtensionMessage, ExtensionResponse } from '../types/messages.ts';

/**
 * Why a message was not answered, for the worker's own diagnostics.
 *
 * `onMessage` only reaches this worker from contexts inside this extension, so
 * these are not an attack surface -- a wrong sender here is a bug being made
 * visible, not a request to defend against. The startup line that used to sit
 * above the listener is gone: this worker is woken by every message and by
 * nothing else, so it printed once per wake for the lifetime of the browser.
 * A refusal is rare enough to be worth a line.
 */
function refuse(message: unknown, sender: chrome.runtime.MessageSender): boolean {
  if (sender?.id !== chrome.runtime.id) {
    console.warn('[Post-to-Card] Ignoring a message from another extension:', sender?.id);
    return true;
  }
  if (!message || typeof message !== 'object' || typeof (message as { type?: unknown }).type !== 'string') {
    console.warn('[Post-to-Card] Ignoring a message with no type:', message);
    return true;
  }
  return false;
}

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
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ServiceWorkerResponse) => void
  ) => {
    if (refuse(message, sender)) return false;

    if (message.type === 'PING') {
      const pingResponse: PingResponse = {
        success: true,
        pong: true,
        dataUrl: '',
        contentType: 'text/plain',
      };
      sendResponse(pingResponse);
      return false;
    }

    if (message.type === 'FETCH_IMAGE_BASE64') {
      handleFetchImageBase64(message.url).then((response: ExtensionResponse) => {
        sendResponse(response);
      });
      return true;
    }

    return false;
  }
);
