/**
 * Lightweight in-memory DOM, Custom Elements, and Shadow DOM environment.
 * Zero external dependencies, 100% deterministic execution in pure Node.js 24.
 *
 * This is a double, not a browser, and two limits have hidden real bugs:
 *
 *   - Elements are not lib.dom types. `DomElement` models only what the
 *     extractor reads, so it is deliberately unassignable to `Element`; a test
 *     that hands a shim node to production code crosses that boundary with a
 *     cast. A type the shim accepts is not proof the browser would.
 *   - No layout engine: no `getBoundingClientRect`, no `offsetHeight`. Anything
 *     geometry-dependent is only verifiable in the browser harness
 *     (`dev/preview.ts`), never here.
 *
 * Selector behaviour is meant to match a browser: `querySelectorAll` returns
 * document order, a query never matches the node it is called on, `closest`
 * honours the descendant combinators in a list member, and a space inside a
 * quoted attribute value does not split the selector. Every one of them was
 * once wrong here and let a real bug pass, so a change to the selector engine
 * deserves a second look at whether the browser agrees.
 */

/**
 * The event-handler IDL attributes every real node carries.
 *
 * Not decoration: Preact decides whether `onClick` is a DOM property or a plain
 * attribute by asking `'onclick' in node`, and only the property branch lowers
 * the name to the `click` a dispatched event actually carries. With the check
 * failing here the shim registered `Click` — capitalised — so every handler on a
 * client-rendered element was unreachable and a click on the modal's backdrop
 * did nothing while looking, from the test, like the modal had simply stayed
 * open. The list is the standard set; a name outside it is treated as an
 * attribute, exactly as a browser would treat it.
 */
const EVENT_HANDLER_ATTRIBUTES = [
  'onabort', 'onanimationcancel', 'onanimationend', 'onanimationiteration', 'onanimationstart',
  'onauxclick', 'onbeforeinput', 'onbeforetoggle', 'onblur', 'oncancel', 'oncanplay',
  'oncanplaythrough', 'onchange', 'onclick', 'onclose', 'oncontextlost', 'oncontextmenu',
  'oncontextrestored', 'oncopy', 'oncuechange', 'oncut', 'ondblclick', 'ondrag', 'ondragend',
  'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'ondurationchange',
  'onemptied', 'onended', 'onerror', 'onfocus', 'onformdata', 'ongotpointercapture', 'oninput',
  'oninvalid', 'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onloadeddata', 'onloadedmetadata',
  'onloadstart', 'onlostpointercapture', 'onmousedown', 'onmouseenter', 'onmouseleave',
  'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onpaste', 'onpause', 'onplay',
  'onplaying', 'onpointercancel', 'onpointerdown', 'onpointerenter', 'onpointerleave',
  'onpointermove', 'onpointerout', 'onpointerover', 'onpointerup', 'onprogress', 'onratechange',
  'onreset', 'onresize', 'onscroll', 'onscrollend', 'onsecuritypolicyviolation', 'onseeked',
  'onseeking', 'onselect', 'onselectionchange', 'onselectstart', 'onslotchange', 'onstalled',
  'onsubmit', 'onsuspend', 'ontimeupdate', 'ontoggle', 'ontouchcancel', 'ontouchend',
  'ontouchmove', 'ontouchstart', 'ontransitioncancel', 'ontransitionend', 'ontransitionrun',
  'ontransitionstart', 'onvolumechange', 'onwaiting', 'onwheel',
  // Document and window level, which a real `Document` also answers for.
  'onafterprint', 'onbeforeprint', 'onbeforeunload', 'onhashchange', 'onlanguagechange',
  'onmessage', 'onmessageerror', 'onoffline', 'ononline', 'onpagehide', 'onpageshow',
  'onpopstate', 'onrejectionhandled', 'onstorage', 'onunhandledrejection', 'onunload',
];

class DomNode {
  public static readonly ELEMENT_NODE = 1;
  public static readonly TEXT_NODE = 3;
  public static readonly COMMENT_NODE = 8;
  public static readonly DOCUMENT_NODE = 9;
  public static readonly DOCUMENT_FRAGMENT_NODE = 11;

  constructor() {
    for (const name of EVENT_HANDLER_ATTRIBUTES) {
      (this as unknown as Record<string, null>)[name] = null;
    }
  }

  public nodeType: number = DomNode.ELEMENT_NODE;
  public nodeName: string = '';
  public nodeValue: string | null = null;
  public parentNode: DomNode | null = null;
  public childNodes: DomNode[] = [];

  get parentElement(): DomElement | null {
    return this.parentNode instanceof DomElement ? this.parentNode : null;
  }

  /** The document that created this node, when one did. */
  public ownerDocumentRef: DomDocument | null = null;

  /**
   * The document this node belongs to.
   *
   * A node inside a shadow root belongs to the document its *host* is in, so the
   * tree is walked rather than trusting the node's own record. Stopping at the
   * fragment reported `null` for every element the card renders, and the export
   * engine's clone then fell back to a bare tag — an `img` that was no longer an
   * image element, with no `decode` to wait for.
   *
   * A detached node still belongs to the document that made it: a browser
   * answers `document` for `document.createElement('div')`, not `null`. Falling
   * back to the record is what covers that, and it is the case `modern-screenshot`
   * hits when it builds a `<style>` of its own.
   */
  get ownerDocument(): DomDocument | null {
    let node: DomNode = this;
    while (node.parentNode) node = node.parentNode;
    if (node instanceof DomShadowRoot) return node.host.ownerDocument;
    if (node.nodeType === DomNode.DOCUMENT_NODE) return node as DomDocument;
    return this.ownerDocumentRef;
  }

  /**
   * True while this node is in a document's tree.
   *
   * A node in a shadow root is connected when its host is, which is the case
   * that matters here: the card lives in a shadow root and its elements have to
   * answer as connected.
   */
  get isConnected(): boolean {
    const root = this.getRootNode();
    if (root.nodeType === DomNode.DOCUMENT_NODE) return true;
    if (root instanceof DomShadowRoot) return root.host.isConnected;
    return false;
  }

  /** The root of this node's tree — a shadow root if it lives in one. */
  getRootNode(): DomNode {
    let node: DomNode = this;
    while (node.parentNode) node = node.parentNode;
    return node;
  }

  remove(): void {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  /**
   * A copy of this node.
   *
   * The export engine builds the off-screen card from one, and the copy is the
   * node that actually gets rasterized — the live preview never is. Without this
   * a test could only assert that the engine meant to clone, which is precisely
   * the assertion that let a shrunk export ship.
   */
  cloneNode(deep: boolean = false): DomNode {
    const copy = this.copySelf();
    if (deep) {
      for (const child of this.childNodes) {
        copy.appendChild(child.cloneNode(true));
      }
    }
    return copy;
  }

  /** The empty shell `cloneNode` fills in. Subclasses restore their own state. */
  protected copySelf(): DomNode {
    const copy = new (this.constructor as unknown as new () => DomNode)();
    copy.nodeValue = this.nodeValue;
    return copy;
  }

  get previousElementSibling(): DomElement | null {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes;
    const index = siblings.indexOf(this);
    for (let i = index - 1; i >= 0; i--) {
      if (siblings[i] instanceof DomElement) return siblings[i] as DomElement;
    }
    return null;
  }

  get textContent(): string {
    if (this.nodeType === DomNode.TEXT_NODE) {
      return this.nodeValue || '';
    }
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val: string) {
    this.childNodes = [];
    if (val) {
      const text = new DomTextNode(val);
      text.parentNode = this;
      this.childNodes.push(text);
    }
  }

  public appendChild<T extends DomNode>(child: T): T {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    notifyMutation(this, [child], []);
    return child;
  }

  public removeChild<T extends DomNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
      notifyMutation(this, [], [child]);
    }
    return child;
  }

  public insertBefore<T extends DomNode>(newNode: T, referenceNode: DomNode | null): T {
    if (!referenceNode) return this.appendChild(newNode);
    if (newNode.parentNode) {
      newNode.parentNode.removeChild(newNode);
    }
    const idx = this.childNodes.indexOf(referenceNode);
    if (idx === -1) return this.appendChild(newNode);
    newNode.parentNode = this;
    this.childNodes.splice(idx, 0, newNode);
    notifyMutation(this, [newNode], []);
    return newNode;
  }

  public contains(other: DomNode | null): boolean {
    if (!other) return false;
    let curr: DomNode | null = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }
}

class DomTextNode extends DomNode {
  constructor(text: string) {
    super();
    this.nodeType = DomNode.TEXT_NODE;
    this.nodeName = '#text';
    this.nodeValue = text;
  }

  /**
   * The characters this node holds, under the name a real `Text` exposes them.
   *
   * Preact rewrites a text vnode by assigning `dom.data`, so without this a
   * re-render set the property on the shim node and left `nodeValue` — which is
   * what `textContent` reads — holding the previous string. Every dynamic text
   * update in a re-rendered component silently showed the old value because of
   * it.
   */
  get data(): string {
    return this.nodeValue || '';
  }

  set data(val: string) {
    this.nodeValue = val;
  }
}

export class DomShadowRoot extends DomNode {
  public mode: 'open' | 'closed';
  public host: DomElement;

  constructor(host: DomElement, mode: 'open' | 'closed' = 'open') {
    super();
    this.nodeType = DomNode.DOCUMENT_FRAGMENT_NODE;
    this.nodeName = '#document-fragment';
    this.host = host;
    this.mode = mode;
  }

  querySelector(selector: string): DomElement | null {
    return querySelectorInternal(this, selector);
  }

  querySelectorAll(selector: string): DomElement[] {
    return querySelectorAllInternal(this, selector);
  }

  get innerHTML(): string {
    return serializeNodesToHtml(this.childNodes);
  }

  set innerHTML(html: string) {
    this.childNodes = [];
    parseHtmlInto(this, html);
  }
}

export class DomElement extends DomNode {
  public tagName: string;
  public attributes: Map<string, string> = new Map();
  /**
   * Answers `''` for a property that was never set, the way a real
   * `CSSStyleDeclaration` does.
   *
   * A plain object answers `undefined` instead, and code that captures a value
   * and writes it back then stores `undefined`: the scroll lock read the host
   * page's overflow, found `undefined` where the browser would have said `''`,
   * and restored `undefined` — which is not a value the browser can produce, so
   * the test was disagreeing with production about a case that cannot happen.
   */
  public style: Record<string, string> = new Proxy(
    {
      // A real CSSStyleDeclaration carries these, and Preact's DOM renderer
      // calls `setProperty` for every style it writes. Without them the only way
      // to mount a component into this shim was to hand-build the markup.
      setProperty(this: Record<string, string>, name: string, value: string) {
        this[name] = value;
      },
      getPropertyValue(this: Record<string, string>, name: string) {
        return this[name] ?? '';
      },
      removeProperty(this: Record<string, string>, name: string) {
        const previous = this[name] ?? '';
        delete this[name];
        return previous;
      },
      cssText: '',
      // The declaration is read and written as a bag of strings, but it also has
      // to carry the real methods, so the cast goes through `unknown`.
    } as unknown as Record<string, string>,
    {
      get: (target, prop) => {
        if (typeof prop !== 'string') return undefined;
        return target[prop] ?? '';
      },
      set: (target, prop, value: string) => {
        target[prop as string] = value;
        return true;
      },
    }
  );
  public dataset: Record<string, string> = {};
  public shadowRoot: DomShadowRoot | null = null;
  /**
   * Set by the test, not measured: there is no layout engine here. It exists
   * because the shipped scroll lock derives the scrollbar width from
   * `window.innerWidth - documentElement.clientWidth`, and a mock that always
   * answers 0 cannot describe a page that has a scrollbar — the compensation it
   * writes would look like a no-op.
   */
  public clientWidth: number = 0;
  private listeners: Map<string, Array<(evt: any) => void>> = new Map();

  /**
   * Moves focus here, the way the real method does.
   *
   * Components focus themselves on mount -- the modal focuses its dialog and
   * restores the trigger on close -- so without this the only way to render one
   * under this shim was to avoid it.
   */
  public focus(): void {
    const doc = this.ownerDocument;
    if (doc) doc.activeElement = this;
    this.dispatchEvent({ type: 'focus' });
  }

  /**
   * `tagName` is optional because a real custom element's constructor runs
   * `super()` with no argument -- the tag comes from the registry, not from the
   * subclass. Requiring one here made `HTMLElement` unusable as the base for a
   * production custom element under this shim.
   */
  constructor(tagName: string = '') {
    super();
    this.nodeType = DomNode.ELEMENT_NODE;
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
  }

  /**
   * Copied through the document's own factory, so an `img` stays an image
   * element with a `src` and a `decode` rather than degrading to a bare tag.
   */
  protected copySelf(): DomNode {
    const doc = this.ownerDocument;
    const copy = (doc ? doc.createElement(this.tagName) : new DomElement(this.tagName)) as DomElement;
    copy.nodeValue = this.nodeValue;
    for (const [name, value] of this.attributes) {
      copy.attributes.set(name, value);
    }
    copy.dataset = { ...this.dataset };
    // Inline styles live on the declaration object here rather than in a
    // `style` attribute, so the entries are what a copy has to carry over.
    for (const key of Object.keys(this.style)) {
      const value = (this.style as Record<string, unknown>)[key];
      if (typeof value === 'string') {
        (copy.style as Record<string, unknown>)[key] = value;
      }
    }
    return copy;
  }

  get children(): DomElement[] {
    return this.childNodes.filter((n): n is DomElement => n instanceof DomElement);
  }

  get id(): string {
    return this.getAttribute('id') || '';
  }

  set id(val: string) {
    this.setAttribute('id', val);
  }

  get className(): string {
    return this.getAttribute('class') || '';
  }

  set className(val: string) {
    this.setAttribute('class', val);
  }

  /**
   * Reflected, as the real element reflects them: the property and the attribute
   * are two views of one value.
   *
   * The radio group's keyboard handler reads both — `disabled` to skip a level
   * that cannot be selected, `tabIndex` to decide where focus goes back — so a
   * shim answering `undefined` for both made every level look selectable and
   * none look like the tab stop.
   */
  get disabled(): boolean {
    return this.attributes.has('disabled');
  }

  set disabled(val: boolean) {
    if (val) this.attributes.set('disabled', '');
    else this.attributes.delete('disabled');
  }

  get tabIndex(): number {
    const raw = this.attributes.get('tabindex');
    if (raw === undefined || raw.trim() === '') return 0;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? -1 : parsed;
  }

  set tabIndex(val: number) {
    this.attributes.set('tabindex', String(val));
  }

  get classList() {
    return {
      contains: (cls: string) => (this.className.split(/\s+/).filter(Boolean).includes(cls)),
      add: (...classes: string[]) => {
        const current = new Set(this.className.split(/\s+/).filter(Boolean));
        classes.forEach(c => current.add(c));
        this.className = Array.from(current).join(' ');
      },
      remove: (...classes: string[]) => {
        const current = new Set(this.className.split(/\s+/).filter(Boolean));
        classes.forEach(c => current.delete(c));
        this.className = Array.from(current).join(' ');
      },
    };
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name.toLowerCase()) ?? null;
  }

  public setAttribute(name: string, value: string): void {
    const key = name.toLowerCase();
    this.attributes.set(key, String(value));
    if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[dataKey] = String(value);
    }
  }

  public hasAttribute(name: string): boolean {
    return this.attributes.has(name.toLowerCase());
  }

  public removeAttribute(name: string): void {
    const key = name.toLowerCase();
    this.attributes.delete(key);
    if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[dataKey];
    }
  }

  public attachShadow(init: { mode: 'open' | 'closed' }): DomShadowRoot {
    if (this.shadowRoot) {
      throw new Error("InvalidStateError: Shadow root already exists");
    }
    this.shadowRoot = new DomShadowRoot(this, init.mode);
    return this.shadowRoot;
  }

  public closest<E extends DomElement = DomElement>(selector: string): E | null {
    let curr: DomElement | null = this;
    while (curr) {
      if (curr.matches(selector)) return curr as unknown as E;
      curr = curr.parentElement;
    }
    return null;
  }

  public matches(selector: string): boolean {
    return matchesSelector(this, selector);
  }

  public querySelector<E extends DomElement = DomElement>(selector: string): E | null {
    return querySelectorInternal(this, selector) as unknown as E | null;
  }

  public querySelectorAll<E extends DomElement = DomElement>(selector: string): E[] {
    return querySelectorAllInternal(this, selector) as unknown as E[];
  }

  public addEventListener(type: string, callback: (evt: any) => void): void {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);
  }

  public removeEventListener(type: string, callback: (evt: any) => void): void {
    const list = this.listeners.get(type);
    if (list) {
      this.listeners.set(type, list.filter(cb => cb !== callback));
    }
  }

  public dispatchEvent(event: any): boolean {
    event.target = this;
    let curr: DomNode | null = this;
    while (curr && !event._propagationStopped) {
      if (curr instanceof DomElement || curr instanceof DomDocument) {
        const list = (curr as any).listeners.get(event.type) || [];
        for (const cb of list) {
          // Called with `this` bound to the node whose listener fired, as the
          // real `addEventListener` does. Preact's own listener wrapper reads
          // `this.l` to find the vnode handler it stored there, so calling
          // through unbound made every `onClick` on a client-rendered element
          // throw instead of dispatching.
          //
          // `currentTarget` is the node whose listener is running, which is not
          // the same node as `target` once the event has bubbled. Four shipped
          // handlers read it -- the modal's backdrop test (`e.target ===
          // e.currentTarget`), the radio group's `e.currentTarget.parentElement`
          // and two in the card. Leaving it unset made the radio group throw and
          // left the backdrop test relying only on its id fallback.
          event.currentTarget = curr;
          cb.call(curr, event);
        }
      }
      curr = curr.parentNode;
    }
    // Cleared once dispatch is over, as a browser does.
    event.currentTarget = null;
    return !event.defaultPrevented;
  }

  public click(): void {
    const event = {
      type: 'click',
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      _propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this._propagationStopped = true; },
      stopImmediatePropagation() { this._propagationStopped = true; },
    };
    this.dispatchEvent(event);
  }

  get innerHTML(): string {
    return serializeNodesToHtml(this.childNodes);
  }

  set innerHTML(html: string) {
    this.childNodes = [];
    parseHtmlInto(this, html);
    notifyMutation(this, this.childNodes, []);
  }
}

export class DomImageElement extends DomElement {
  public complete: boolean = true;
  constructor() {
    super('IMG');
  }
  get src(): string { return this.getAttribute('src') || ''; }
  set src(val: string) { this.setAttribute('src', val); }
  get alt(): string { return this.getAttribute('alt') || ''; }
  set alt(val: string) { this.setAttribute('alt', val); }
  public async decode(): Promise<void> {
    return Promise.resolve();
  }
}

export class DomAnchorElement extends DomElement {
  constructor() { super('A'); }
  get href(): string { return this.getAttribute('href') || ''; }
  set href(val: string) { this.setAttribute('href', val); }
  get download(): string { return this.getAttribute('download') || ''; }
  set download(val: string) { this.setAttribute('download', val); }
}

class DomVideoElement extends DomElement {
  constructor() { super('VIDEO'); }
  get poster(): string { return this.getAttribute('poster') || ''; }
  set poster(val: string) { this.setAttribute('poster', val); }
}

class DomStyleElement extends DomElement {
  constructor() { super('STYLE'); }
}

class DomCustomElementRegistry {
  private registry = new Map<string, { new(): any }>();
  public define(name: string, constructor: { new(): any }): void {
    if (this.registry.has(name)) {
      throw new Error(`NotSupportedError: ${name} is already registered`);
    }
    this.registry.set(name.toLowerCase(), constructor);
  }
  public get(name: string): { new(): any } | undefined {
    return this.registry.get(name.toLowerCase());
  }
}

// Global active mutation observers
const activeObservers: DomMutationObserver[] = [];

interface MutationRecord {
  type: 'childList' | 'attributes';
  target: DomNode;
  addedNodes: DomNode[];
  removedNodes: DomNode[];
  attributeName?: string;
}

export class DomMutationObserver {
  private callback: (mutations: MutationRecord[], observer: DomMutationObserver) => void;
  private observedTarget: DomNode | null = null;

  constructor(cb: (mutations: MutationRecord[], observer: DomMutationObserver) => void) {
    this.callback = cb;
  }

  public observe(target: DomNode, _options?: { childList?: boolean; subtree?: boolean }): void {
    this.observedTarget = target;
    if (!activeObservers.includes(this)) {
      activeObservers.push(this);
    }
  }

  public disconnect(): void {
    const idx = activeObservers.indexOf(this);
    if (idx !== -1) {
      activeObservers.splice(idx, 1);
    }
    this.observedTarget = null;
  }

  public _notify(record: MutationRecord): void {
    if (this.observedTarget && this.observedTarget.contains(record.target)) {
      this.callback([record], this);
    }
  }
}

function notifyMutation(target: DomNode, added: DomNode[], removed: DomNode[]): void {
  const record: MutationRecord = {
    type: 'childList',
    target,
    addedNodes: added,
    removedNodes: removed,
  };
  for (const obs of [...activeObservers]) {
    obs._notify(record);
  }
}

export class DomDocument extends DomNode {
  public head: DomElement;
  public body: DomElement;
  public documentElement: DomElement;
  /**
   * Settled by default, because every caller of this shim runs after load. A
   * test that wants the pre-load path sets it to `'loading'` and fires
   * `DOMContentLoaded` itself.
   */
  public readyState: 'loading' | 'interactive' | 'complete' = 'complete';
  public customElements: DomCustomElementRegistry;
  private listeners: Map<string, Array<(evt: any) => void>> = new Map();

  /** The element holding focus, or null. Written by `DomElement.focus()`. */
  public activeElement: DomElement | null = null;

  constructor() {
    super();
    this.nodeType = DomNode.DOCUMENT_NODE;
    this.nodeName = '#document';
    this.documentElement = new DomElement('HTML');
    this.head = new DomElement('HEAD');
    this.body = new DomElement('BODY');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
    this.customElements = new DomCustomElementRegistry();
  }

  public createElement(tagName: string): DomElement {
    return this.adopt(this.createElementFor(tagName));
  }

  private createElementFor(tagName: string): DomElement {
    const tag = tagName.toLowerCase();
    const CustomCtor = this.customElements.get(tag);
    if (CustomCtor) {
      const el: DomElement = new CustomCtor();
      // A custom element's constructor runs `super()` with no tag, so the name
      // is assigned by whoever creates it -- the parser in a browser, this mock
      // here. Without it the element has no tag for a selector to match, and
      // `document.querySelector('my-element')` could never find its own node.
      if (!el.tagName) {
        el.tagName = tag.toUpperCase();
        el.nodeName = el.tagName;
      }
      return el;
    }
    if (tag === 'img') return new DomImageElement();
    if (tag === 'a') return new DomAnchorElement();
    if (tag === 'video') return new DomVideoElement();
    if (tag === 'style') return new DomStyleElement();
    return new DomElement(tagName);
  }

  /** Records `this` as the node's document, the way a real constructor would. */
  private adopt<T extends DomNode>(node: T): T {
    node.ownerDocumentRef = this;
    return node;
  }

  public createTextNode(text: string): DomTextNode {
    return this.adopt(new DomTextNode(text));
  }

  public createElementNS(_ns: string, tagName: string): DomElement {
    return this.createElement(tagName);
  }

  public getElementById(id: string): DomElement | null {
    return this.querySelector(`#${id}`);
  }

  public querySelector<E extends DomElement = DomElement>(selector: string): E | null {
    return querySelectorInternal(this, selector) as unknown as E | null;
  }

  public querySelectorAll<E extends DomElement = DomElement>(selector: string): E[] {
    return querySelectorAllInternal(this, selector) as unknown as E[];
  }

  public addEventListener(type: string, cb: (evt: any) => void): void {
    const list = this.listeners.get(type) || [];
    list.push(cb);
    this.listeners.set(type, list);
  }

  public removeEventListener(type: string, cb: (evt: any) => void): void {
    const list = this.listeners.get(type);
    if (list) {
      this.listeners.set(type, list.filter(item => item !== cb));
    }
  }

  public dispatchEvent(event: any): boolean {
    const list = this.listeners.get(event.type) || [];
    for (const cb of list) {
      cb.call(this, event);
    }
    return !event.defaultPrevented;
  }
}

// Selector matching engine

/**
 * Splits a selector list on its top-level commas.
 *
 * A comma inside a quoted attribute value separates nothing, so the split has
 * to track bracket depth and quotes rather than trusting every `,`.
 */
function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let current = '';
  let bracketDepth = 0;
  let quote = '';

  for (const ch of selector) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
    else if (ch === ',' && bracketDepth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  parts.push(current.trim());
  return parts.filter(Boolean);
}

/**
 * Splits one member of a selector list into its whitespace-separated compounds,
 * treating a space inside an attribute value as part of that value.
 *
 * `div[aria-label="Embedded video"]` is one compound. A plain `split(/\s+/)`
 * produced `['div[aria-label="Embedded', 'video"]']`, whose first half has no
 * closing `]` and therefore matched nothing — so the video-container selector
 * production hands to `querySelectorAll` was dead in this shim, and a fixture
 * marking a video with the aria-label instead of the testid extracted no video.
 */
function splitSelectorTokens(selector: string): string[] {
  return selector.match(/(?:\[[^\]]*\]|[^\s\[])+/g) ?? [];
}

function matchesSelector(el: DomElement, selector: string): boolean {
  return splitSelectorList(selector).some(member => matchesCompoundChain(el, member));
}

/**
 * Whether `el` is the subject of one member of a selector list.
 *
 * A member carrying a descendant combinator (`main article`) is matched the way
 * a browser matches it: `el` itself must be the last compound, and the part in
 * front must match one of its ancestors. Feeding the whole member to the
 * compound-only matcher instead — as this did — made `main article` and
 * `[data-testid="cellInnerDiv"] article` dead alternatives, because the matcher
 * saw the space as an unparsable tail and returned false. Production relies on
 * `closest(TWEET_ARTICLE_SELECTOR)`, so on an article that carries no
 * `data-testid="tweet"` the shim answered "no owning article" where a browser
 * answers the article, and nothing was injected.
 */
function matchesCompoundChain(el: DomElement, member: string): boolean {
  const tokens = splitSelectorTokens(member);
  if (tokens.length === 0) return false;

  let i = tokens.length - 1;
  if (!matchSingleSelector(el, tokens[i])) return false;
  i--;

  let descendant: DomElement = el;
  while (i >= 0) {
    let ancestor = descendant.parentElement;
    let matched: DomElement | null = null;
    while (ancestor) {
      if (matchSingleSelector(ancestor, tokens[i])) {
        matched = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!matched) return false;
    descendant = matched;
    i--;
  }

  return true;
}

function matchSingleSelector(el: DomElement, selector: string): boolean {
  // Handle pseudo-selectors like :not(...)
  const notMatch = selector.match(/^(.*?):not\((.*?)\)$/);
  if (notMatch) {
    const base = notMatch[1].trim();
    const negated = notMatch[2].trim();
    if (base && !matchSingleSelector(el, base)) return false;
    return !matchSingleSelector(el, negated);
  }

  // Tokenize compound selector, e.g., article[data-testid="tweet"]
  let remaining = selector;
  const tagMatch = remaining.match(/^([a-zA-Z0-9_-]+)/);
  if (tagMatch) {
    if (el.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) return false;
    remaining = remaining.slice(tagMatch[1].length);
  }

  // ID match
  const idMatch = remaining.match(/^#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    if (el.id !== idMatch[1]) return false;
    remaining = remaining.slice(idMatch[0].length);
  }

  // Class match
  while (true) {
    const classMatch = remaining.match(/^\.([a-zA-Z0-9_-]+)/);
    if (!classMatch) break;
    if (!el.classList.contains(classMatch[1])) return false;
    remaining = remaining.slice(classMatch[0].length);
  }

  // Attribute match [attr=val], [attr*="val"], [attr^="val"], [attr]
  while (true) {
    const attrMatch = remaining.match(/^\[([a-zA-Z0-9_-]+)(?:([*^$]?=)(["']?)(.*?)\3)?\]/);
    if (!attrMatch) break;
    const attrName = attrMatch[1].toLowerCase();
    const op = attrMatch[2];
    const targetVal = attrMatch[4];

    if (!el.hasAttribute(attrName)) return false;
    if (op) {
      const actualVal = el.getAttribute(attrName) || '';
      if (op === '=' && actualVal !== targetVal) return false;
      if (op === '*=' && !actualVal.includes(targetVal)) return false;
      if (op === '^=' && !actualVal.startsWith(targetVal)) return false;
      if (op === '$=' && !actualVal.endsWith(targetVal)) return false;
    }
    remaining = remaining.slice(attrMatch[0].length);
  }

  return remaining.length === 0;
}

function querySelectorInternal(root: DomNode, selector: string): DomElement | null {
  const all = querySelectorAllInternal(root, selector);
  return all.length > 0 ? all[0] : null;
}

function querySelectorAllInternal(root: DomNode, selector: string): DomElement[] {
  if (selector.includes(',')) {
    const subSelectors = splitSelectorList(selector);
    const matched = new Set<DomElement>();
    for (const sub of subSelectors) {
      for (const el of querySelectorAllInternal(root, sub)) {
        matched.add(el);
      }
    }
    // Document order, not per-selector groups. A real `querySelectorAll` returns
    // elements in tree order, so `querySelector('p, div')` answers whichever of
    // the two comes first in the document; concatenating the sub-selector
    // results answered "all p's, then all div's", which picks the wrong element
    // whenever a `div` precedes a `p` -- and quietly disagreed with the browser
    // about exactly the article-prose query this project cares about.
    const ordered: DomElement[] = [];
    walkTree(root, node => {
      if (node instanceof DomElement && matched.has(node)) ordered.push(node);
    });
    return ordered;
  }

  // Support descendant combinators (e.g. "div[role='group'] button")
  const tokens = splitSelectorTokens(selector);
  if (tokens.length === 1) {
    const results: DomElement[] = [];
    walkTree(root, node => {
      if (node instanceof DomElement && matchesSelector(node, tokens[0])) {
        results.push(node);
      }
    });
    return results;
  }

  // Multi-step selector
  let currentNodes: DomElement[] = [];
  walkTree(root, node => {
    if (node instanceof DomElement && matchesSelector(node, tokens[0])) {
      currentNodes.push(node);
    }
  });

  for (let i = 1; i < tokens.length; i++) {
    const nextToken = tokens[i];
    const nextCandidates: DomElement[] = [];
    for (const parent of currentNodes) {
      walkTree(parent, child => {
        if (child !== parent && child instanceof DomElement && matchesSelector(child, nextToken)) {
          if (!nextCandidates.includes(child)) {
            nextCandidates.push(child);
          }
        }
      });
    }
    currentNodes = nextCandidates;
  }

  return currentNodes;
}

/**
 * Visits every descendant of `node`, never `node` itself.
 *
 * A real `querySelectorAll` searches the subtree below the element it is called
 * on and never matches that element, so starting at the node made the shim
 * answer a question the browser does not. Production code was written around
 * that: `findQuoteContainer` filters the queried article out of its own results,
 * with a comment naming this shim as the reason. Fixing it here is what lets
 * that workaround go.
 */
function walkTree(node: DomNode, visitor: (node: DomNode) => void): void {
  for (const child of node.childNodes) {
    visitor(child);
    walkTree(child, visitor);
  }
}

// HTML Parser & Serializer helpers
function serializeNodesToHtml(nodes: DomNode[]): string {
  let html = '';
  for (const node of nodes) {
    if (node instanceof DomTextNode) {
      html += node.nodeValue || '';
    } else if (node instanceof DomElement) {
      const tag = node.tagName.toLowerCase();
      let attrs = '';
      node.attributes.forEach((val, key) => {
        attrs += ` ${key}="${val}"`;
      });
      html += `<${tag}${attrs}>${serializeNodesToHtml(node.childNodes)}</${tag}>`;
    }
  }
  return html;
}

function parseHtmlInto(parent: DomNode, html: string): void {
  // Simple regex-based HTML tree builder for test fixtures
  const tagRegex = /<(\/)?([a-zA-Z0-9_-]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  let current: DomNode = parent;
  const selfClosing = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);

  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];
    const rawAttrs = match[3];
    const textContent = match[4];

    if (textContent) {
      current.appendChild(new DomTextNode(textContent));
    } else if (isClosing) {
      if (current.parentNode) {
        current = current.parentNode;
      }
    } else if (tagName) {
      const tagLower = tagName.toLowerCase();
      let el: DomElement;
      if (tagLower === 'img') el = new DomImageElement();
      else if (tagLower === 'a') el = new DomAnchorElement();
      else if (tagLower === 'video') el = new DomVideoElement();
      else if (tagLower === 'style') el = new DomStyleElement();
      else el = new DomElement(tagLower);

      if (rawAttrs) {
        const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:["']([^"']*)["']|(\S+)))?/g;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
          const name = attrMatch[1];
          const val = attrMatch[2] !== undefined ? attrMatch[2] : (attrMatch[3] !== undefined ? attrMatch[3] : '');
          el.setAttribute(name, val);
        }
      }

      current.appendChild(el);
      if (!selfClosing.has(tagLower) && !rawAttrs?.endsWith('/')) {
        current = el;
      }
    }
  }
}

export function createDomElement(html: string): DomElement {
  const container = new DomElement('DIV');
  parseHtmlInto(container, html);
  return (container.children[0] as DomElement) || container;
}
