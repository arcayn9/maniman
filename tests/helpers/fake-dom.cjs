class Element {
  constructor(tag, document) { this.tag = tag; this.ownerDocument = document; this.children = []; this.events = {}; this.attributes = {}; this.value = ""; this.textContent = ""; this.disabled = false; this.hidden = false; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes[name] = value; this[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  contains(target) { return this === target || this.children.some((child) => child.contains(target)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
  focus() { if (!this.disabled) { this.ownerDocument.activeElement = this; this.ownerDocument.emit("focusin", { target: this }); } }
  addEventListener(name, handler) { (this.events[name] ||= []).push(handler); }
  async dispatch(name, details = {}) { const event = { target: this, preventDefault() {}, ...details }; for (const handler of this.events[name] || []) await handler(event); }
  querySelectorAll(selector) {
    const matches = (child) => selector.split(",").some((part) => part.startsWith(".") ? (child.className || "").split(" ").includes(part.slice(1)) : part === child.tag);
    return this.children.flatMap((child) => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function createDocument() {
  const document = { events: {}, createElement(tag) { return new Element(tag, this); }, querySelectorAll(selector) { return this.body.querySelectorAll(selector); }, addEventListener(name, handler) { (this.events[name] ||= []).push(handler); }, removeEventListener(name, handler) { this.events[name] = (this.events[name] || []).filter((candidate) => candidate !== handler); }, emit(name, event) { for (const handler of this.events[name] || []) handler(event); } };
  document.body = document.createElement("body"); document.activeElement = document.body;
  return document;
}
module.exports = { createDocument };
