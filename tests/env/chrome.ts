/**
 * Chrome Extension Manifest V3 API Simulation Layer.
 * Provides faithful emulation of runtime messaging, storage, and host permissions.
 */

import type { ExtensionMessage, ExtensionResponse } from '../../src/types/messages.ts';

type MessageListener = (
  message: any,
  sender: { id?: string; tab?: { id?: number } },
  sendResponse: (response: any) => void
) => boolean | void | Promise<any>;

class ChromeRuntimeMock {
  public listeners: MessageListener[] = [];
  public lastError: { message: string } | null = null;

  public onMessage = {
    addListener: (cb: MessageListener) => {
      if (!this.listeners.includes(cb)) {
        this.listeners.push(cb);
      }
    },
    removeListener: (cb: MessageListener) => {
      this.listeners = this.listeners.filter(l => l !== cb);
    },
    hasListener: (cb: MessageListener) => this.listeners.includes(cb),
  };

  public sendMessage(
    message: ExtensionMessage,
    callback?: (response: ExtensionResponse) => void
  ): Promise<ExtensionResponse> {
    return new Promise((resolve, reject) => {
      let responded = false;
      const sender = { id: 'post-to-card-extension', tab: { id: 1 } };

      const sendResponse = (res: ExtensionResponse) => {
        if (!responded) {
          responded = true;
          if (callback) callback(res);
          resolve(res);
        }
      };

      for (const listener of this.listeners) {
        try {
          const result = listener(message, sender, sendResponse);
          if (result === true) {
            // Asynchronous response expected
            return;
          }
          if (result instanceof Promise) {
            result.then(sendResponse).catch(err => {
              sendResponse({ success: false, error: err.message });
            });
            return;
          }
        } catch (err: any) {
          sendResponse({ success: false, error: err.message });
          return;
        }
      }

      // If no listeners handled synchronously or returned true
      if (!responded) {
        setTimeout(() => {
          if (!responded) {
            const errResponse = { success: false, error: 'No response from background listener' } as const;
            if (callback) callback(errResponse);
            resolve(errResponse);
          }
        }, 10);
      }
    });
  }
}

class ChromeStorageAreaMock {
  private store = new Map<string, any>();

  public get(keys: string | string[] | Record<string, any> | null, callback?: (items: Record<string, any>) => void): Promise<Record<string, any>> {
    return new Promise(resolve => {
      const result: Record<string, any> = {};
      if (keys === null) {
        this.store.forEach((v, k) => { result[k] = v; });
      } else if (typeof keys === 'string') {
        if (this.store.has(keys)) result[keys] = this.store.get(keys);
      } else if (Array.isArray(keys)) {
        keys.forEach(k => {
          if (this.store.has(k)) result[k] = this.store.get(k);
        });
      } else if (typeof keys === 'object') {
        Object.keys(keys).forEach(k => {
          result[k] = this.store.has(k) ? this.store.get(k) : keys[k];
        });
      }
      if (callback) callback(result);
      resolve(result);
    });
  }

  public set(items: Record<string, any>, callback?: () => void): Promise<void> {
    return new Promise(resolve => {
      Object.entries(items).forEach(([k, v]) => {
        this.store.set(k, v);
      });
      if (callback) callback();
      resolve();
    });
  }

  public clear(callback?: () => void): Promise<void> {
    return new Promise(resolve => {
      this.store.clear();
      if (callback) callback();
      resolve();
    });
  }
}

class ChromeStorageMock {
  public local = new ChromeStorageAreaMock();
  public sync = new ChromeStorageAreaMock();
}

class ChromeTabsMock {
  public async query(_queryInfo: any): Promise<Array<{ id: number; url: string }>> {
    return [{ id: 1, url: 'https://x.com/jack/status/20' }];
  }
}

export interface ChromeMockEnv {
  runtime: ChromeRuntimeMock;
  storage: ChromeStorageMock;
  tabs: ChromeTabsMock;
}

export function createChromeMock(): ChromeMockEnv {
  return {
    runtime: new ChromeRuntimeMock(),
    storage: new ChromeStorageMock(),
    tabs: new ChromeTabsMock(),
  };
}
