/**
 * Chrome Extension Manifest V3 API Simulation Layer.
 * Provides faithful emulation of runtime messaging, storage, and host permissions.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
      // Chrome closes the response port when the listener returns without
      // holding it open, and a `sendResponse` after that reaches nobody. The
      // mock delivered late responses regardless, so a listener that forgot to
      // `return true` answered the caller here exactly as a correct one would —
      // the one thing the expensive tests that go through the message channel
      // could never catch.
      let portClosed = false;
      const sender = { id: 'post-to-card-extension', tab: { id: 1 } };

      const sendResponse = (res: ExtensionResponse) => {
        if (portClosed) return;
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

      // Nothing answered during the synchronous call, so no listener held the
      // port open: close it, and let the callback that arrives later be the
      // no-op Chrome makes it.
      portClosed = true;

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

/**
 * A copy, the way the real API hands one over on the way out.
 *
 * The mock used to hand the store's own object to `get` callers and to
 * listeners, which let `popup.js`'s read-modify-write change storage without
 * calling `set` at all: a test of that write passed while the write was missing
 * or aimed at the wrong key. Both exits now copy.
 *
 * The write side does not, so `set` still holds the caller's own object and a
 * caller that kept a reference could change storage by mutating it. Nothing
 * shipped does that -- the read-side copy above is what closed the one path
 * that did -- and closing it would mean deciding how a write of an identical
 * value behaves, which the storage API's own docs do not state. That would put
 * a guess into the harness, so it stays as it is until something needs it.
 */
function detached<T>(value: T): T {
  return structuredClone(value);
}

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
      changes[key] = { oldValue, newValue: detached(value) };
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

  /**
   * How long a read takes to answer, in ms. Zero answers in the same task.
   *
   * The real API answers in a later task, and that gap is load-bearing: a reader
   * registers its change listener right after it asks, so a write landing in
   * between reaches the listener *before* the read's own snapshot does -- and
   * that snapshot, taken when the read was asked for, is already stale. The
   * synchronous mock could not express the ordering at all, so the test that is
   * about it raises this.
   */
  public readDelayMs = 0;

  public get(keys: string | string[] | Record<string, any> | null, callback?: (items: Record<string, any>) => void): Promise<Record<string, any>> {
    return new Promise(resolve => {
      const result: Record<string, any> = {};
      if (keys === null) {
        this.store.forEach((v, k) => { result[k] = detached(v); });
      } else if (typeof keys === 'string') {
        if (this.store.has(keys)) result[keys] = detached(this.store.get(keys));
      } else if (Array.isArray(keys)) {
        keys.forEach(k => {
          if (this.store.has(k)) result[k] = detached(this.store.get(k));
        });
      } else if (typeof keys === 'object') {
        Object.keys(keys).forEach(k => {
          result[k] = this.store.has(k) ? detached(this.store.get(k)) : detached(keys[k]);
        });
      }
      // The snapshot is built above, before any wait, because that is what a
      // delayed read hands back: the value as it stood when it was asked for,
      // not as it stands when it answers.
      const answer = () => {
        if (callback) callback(result);
        resolve(result);
      };
      if (this.readDelayMs > 0) setTimeout(answer, this.readDelayMs);
      else answer();
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

/**
 * Whether this extension can read a tab's `url` at all.
 *
 * A tab's `url` is present only when the extension holds the "tabs" permission or
 * host permission for that page (developer.chrome.com/docs/extensions/reference/api/tabs).
 * `activeTab` counts too: it grants temporary host permission for the current tab
 * on user invocation. Read from manifest.json rather than hard-coded so the mock
 * cannot drift more permissive than the extension actually is.
 */
function manifestGrantsTabUrl(): boolean {
  const manifestPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    permissions?: string[];
    host_permissions?: string[];
  };

  const permissions = manifest.permissions || [];
  if (permissions.includes('tabs') || permissions.includes('activeTab')) return true;
  return (manifest.host_permissions || []).some((pattern) => /x\.com|twitter\.com/.test(pattern));
}

/**
 * What `chrome.tabs.sendMessage` should do when the popup calls it.
 *
 * The two are the whole distinction the popup has to draw: a tab with no
 * content script is a missing receiver, which Chrome reports by setting
 * `runtime.lastError` and handing the callback `undefined`; a tab that has one
 * but no tweet under the pointer answers `{ success: false }` with no error.
 * Only a *successful* send is the third case.
 */
export type SendOutcome =
  | { kind: 'no-receiver' }
  | { kind: 'response'; response: unknown };

class ChromeTabsMock {
  private readonly canReadUrl: boolean;
  private readonly runtime: ChromeRuntimeMock;

  /** What the next `sendMessage` does. Defaults to a receiver that answers `{success:false}`. */
  public outcome: SendOutcome = { kind: 'response', response: { success: false } };

  /** Every message the popup sent, in order. */
  public sent: Array<{ tabId: number; message: any }> = [];

  /** Whether `query` answers with no tabs at all, as it does when none qualifies. */
  public queryReturnsNone = false;

  constructor(canReadUrl: boolean, runtime: ChromeRuntimeMock) {
    this.canReadUrl = canReadUrl;
    this.runtime = runtime;
  }

  /**
   * `url` is omitted when the manifest cannot grant it, which is the shape real
   * Chrome returns. The mock used to always answer with an x.com URL, so a test
   * gating on `activeTab.url` passed here while the shipped popup rejected every
   * tab including X -- the mock was more capable than the extension.
   */
  public query(
    _queryInfo: any,
    callback?: (tabs: Array<{ id: number; url?: string }>) => void
  ): Promise<Array<{ id: number; url?: string }>> {
    const tab: { id: number; url?: string } = { id: 1 };
    if (this.canReadUrl) tab.url = 'https://x.com/jack/status/20';
    const tabs = this.queryReturnsNone ? [] : [tab];
    // The popup uses the callback form, as the real API's own docs do for a
    // fire-and-forget query. Answering only the Promise would leave the popup's
    // handler unreachable from a test.
    if (callback) callback(tabs);
    return Promise.resolve(tabs);
  }

  /**
   * Answers the callback form the popup uses.
   *
   * `runtime.lastError` is set for the duration of the callback and cleared
   * after, which is how Chrome scopes it -- a listener that reads it later sees
   * `undefined` and would mistake a missing receiver for a successful send.
   */
  public sendMessage(
    tabId: number,
    message: any,
    callback?: (response: any) => void
  ): Promise<unknown> {
    this.sent.push({ tabId, message });
    const { outcome } = this;
    if (outcome.kind === 'no-receiver') {
      this.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
      try {
        if (callback) callback(undefined);
      } finally {
        this.runtime.lastError = null;
      }
      return Promise.resolve(undefined);
    }
    if (callback) callback(outcome.response);
    return Promise.resolve(outcome.response);
  }
}

export interface ChromeMockEnv {
  runtime: ChromeRuntimeMock;
  storage: ChromeStorageMock;
  tabs: ChromeTabsMock;
}

export function createChromeMock(): ChromeMockEnv {
  const runtime = new ChromeRuntimeMock();
  return {
    runtime,
    storage: new ChromeStorageMock(),
    tabs: new ChromeTabsMock(manifestGrantsTabUrl(), runtime),
  };
}
