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
 * document order, and a query never matches the node it is called on. Both were
 * once wrong here and let a real bug pass, so a change to the selector engine
 * deserves a second look at whether the browser agrees.
 */

export class DomNode {
  public static readonly ELEMENT_NODE = 1;
  public static readonly TEXT_NODE = 3;
  public static readonly COMMENT_NODE = 8;
  public static readonly DOCUMENT_NODE = 9;
  public static readonly DOCUMENT_FRAGMENT_NODE = 11;

  public nodeType: number = DomNode.ELEMENT_NODE;
  public nodeName: string = '';
  public nodeValue: string | null = null;
  public parentNode: DomNode | null = null;
  public childNodes: DomNode[] = [];

  get parentElement(): DomElement | null {
    return this.parentNode instanceof DomElement ? this.parentNode : null;
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

  get nextElementSibling(): DomElement | null {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes;
    const index = siblings.indexOf(this);
    for (let i = index + 1; i < siblings.length; i++) {
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

  public replaceChild<T extends DomNode>(newChild: T, oldChild: DomNode): T {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      this.removeChild(oldChild);
      if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
      newChild.parentNode = this;
      this.childNodes.splice(idx, 0, newChild);
      notifyMutation(this, [newChild], [oldChild]);
    }
    return newChild;
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

export class DomTextNode extends DomNode {
  constructor(text: string) {
    super();
    this.nodeType = DomNode.TEXT_NODE;
    this.nodeName = '#text';
    this.nodeValue = text;
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
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public shadowRoot: DomShadowRoot | null = null;
  private listeners: Map<string, Array<(evt: any) => void>> = new Map();

  constructor(tagName: string) {
    super();
    this.nodeType = DomNode.ELEMENT_NODE;
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
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
      toggle: (cls: string, force?: boolean) => {
        const current = new Set(this.className.split(/\s+/).filter(Boolean));
        const shouldAdd = force !== undefined ? force : !current.has(cls);
        if (shouldAdd) current.add(cls);
        else current.delete(cls);
        this.className = Array.from(current).join(' ');
        return shouldAdd;
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
          cb(event);
        }
      }
      curr = curr.parentNode;
    }
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

export class DomVideoElement extends DomElement {
  constructor() { super('VIDEO'); }
  get poster(): string { return this.getAttribute('poster') || ''; }
  set poster(val: string) { this.setAttribute('poster', val); }
}

export class DomStyleElement extends DomElement {
  constructor() { super('STYLE'); }
}

export class DomCustomElementRegistry {
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
  public clear(): void {
    this.registry.clear();
  }
}

// Global active mutation observers
const activeObservers: DomMutationObserver[] = [];

export interface MutationRecord {
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
  public customElements: DomCustomElementRegistry;
  private _focused: boolean = true;
  private listeners: Map<string, Array<(evt: any) => void>> = new Map();

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
    const tag = tagName.toLowerCase();
    const CustomCtor = this.customElements.get(tag);
    if (CustomCtor) {
      return new CustomCtor();
    }
    if (tag === 'img') return new DomImageElement();
    if (tag === 'a') return new DomAnchorElement();
    if (tag === 'video') return new DomVideoElement();
    if (tag === 'style') return new DomStyleElement();
    return new DomElement(tagName);
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

  public hasFocus(): boolean {
    return this._focused;
  }

  public setFocus(focused: boolean): void {
    this._focused = focused;
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
      cb(event);
    }
    return !event.defaultPrevented;
  }
}

// Selector matching engine
function matchesSelector(el: DomElement, selector: string): boolean {
  // Support comma-separated selectors
  const parts = selector.split(',').map(s => s.trim());
  for (const part of parts) {
    if (matchSingleSelector(el, part)) return true;
  }
  return false;
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
    const subSelectors = selector.split(',').map(s => s.trim()).filter(Boolean);
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
  const tokens = selector.split(/\s+/).filter(Boolean);
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

export function parseHtmlInto(parent: DomNode, html: string): void {
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
