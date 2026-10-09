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
    return new Promise((resolve, _reject) => {
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

type StorageChange = { oldValue?: any; newValue?: any };
type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string
) => void;

class ChromeStorageAreaMock {
  private store = new Map<string, any>();
  private readonly areaName: string;
  private readonly owner: ChromeStorageMock;

  /**
   * The owning mock, so a write can announce itself the way Chrome does. Kept as
   * a constructor argument rather than a global because `local` and `sync` are
   * separate areas and the listener is told which one changed.
   *
   * Fields are declared rather than written as constructor parameter properties:
   * Node strips the types off this file to run it, and it cannot strip that form.
   */
  constructor(areaName: string, owner: ChromeStorageMock) {
    this.areaName = areaName;
    this.owner = owner;
  }

  /** Applies a batch and reports only the keys whose value actually moved. */
  private commit(entries: Record<string, any>, removals: string[] = []): void {
    const changes: Record<string, StorageChange> = {};

    for (const [key, value] of Object.entries(entries)) {
      const oldValue = this.store.get(key);
      if (oldValue === value) continue;
      this.store.set(key, value);
      changes[key] = { oldValue, newValue: value };
    }

    for (const key of removals) {
      if (!this.store.has(key)) continue;
      const oldValue = this.store.get(key);
      this.store.delete(key);
      changes[key] = { oldValue, newValue: undefined };
    }

    if (Object.keys(changes).length > 0) {
      this.owner.dispatch(this.areaName, changes);
    }
  }

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
      this.commit(items);
      if (callback) callback();
      resolve();
    });
  }

  public remove(keys: string | string[], callback?: () => void): Promise<void> {
    return new Promise(resolve => {
      this.commit({}, Array.isArray(keys) ? keys : [keys]);
      if (callback) callback();
      resolve();
    });
  }

  public clear(callback?: () => void): Promise<void> {
    return new Promise(resolve => {
      this.commit({}, Array.from(this.store.keys()));
      if (callback) callback();
      resolve();
    });
  }
}

class ChromeStorageMock {
  public local: ChromeStorageAreaMock;
  public sync: ChromeStorageAreaMock;

  private listeners: StorageChangeListener[] = [];

  public onChanged = {
    addListener: (cb: StorageChangeListener) => {
      if (!this.listeners.includes(cb)) this.listeners.push(cb);
    },
    removeListener: (cb: StorageChangeListener) => {
      this.listeners = this.listeners.filter(l => l !== cb);
    },
    hasListener: (cb: StorageChangeListener) => this.listeners.includes(cb),
  };

  constructor() {
    this.local = new ChromeStorageAreaMock('local', this);
    this.sync = new ChromeStorageAreaMock('sync', this);
  }

  /**
   * Notifies listeners the way Chrome does: per area, with only the moved keys,
   * and never letting a listener's own failure break the write that triggered it.
   */
  dispatch(areaName: string, changes: Record<string, StorageChange>): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(changes, areaName);
      } catch (err) {
        console.error('[chrome mock] storage.onChanged listener threw:', err);
      }
    }
  }
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
