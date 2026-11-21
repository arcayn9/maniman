const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const vault = require("../lib/secure-storage.js");

// A small DOM event model exercises the create->recovery form transition without
// accessing a user's browser, credentials or financial data.
class Element {
  constructor(tag, document = null) { this.tag = tag; this.ownerDocument = document; this.children = []; this.style = {}; this.events = {}; this.attributes = {}; this.value = ""; this.disabled = false; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parent = null; this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = value; this[name] = name === "inert" ? true : value; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  removeAttribute(name) { delete this.attributes[name]; if (name === "inert") this.inert = false; else delete this[name]; }
  focus() { this.ownerDocument.activeElement = this; this.ownerDocument.emit("focusin", { target: this }); }
  contains(target) { return this === target || this.children.some((child) => child.contains(target)); }
  get isConnected() { return this.ownerDocument.body.contains(this); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this); this.parent = null; }
  addEventListener(type, handler) { (this.events[type] ||= []).push(handler); }
  async dispatch(type, details = {}) {
    const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const handler of this.events[type] || []) await handler(event);
    return event;
  }
  querySelectorAll(selector) {
    const tags = selector.split(",");
    const matches = (child) => tags.some((tag) => tag.startsWith(".") ? (child.className || "").split(" ").includes(tag.slice(1)) : tag === child.tag);
    return this.children.flatMap((child) => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  get previousSibling() { const index = this.parent.children.indexOf(this); return this.parent.children[index - 1] || null; }
}
function setup(manager) {
  const document = {
    events: {}, activeElement: null,
    createElement(tag) { return new Element(tag, this); },
    querySelectorAll(selector) { return this.body.querySelectorAll(selector); },
    addEventListener(type, handler) { (this.events[type] ||= []).push(handler); },
    removeEventListener(type, handler) { this.events[type] = (this.events[type] || []).filter((item) => item !== handler); },
    emit(type, event) { for (const handler of this.events[type] || []) handler(event); }
  };
  const body = new Element("body", document); document.body = body; document.activeElement = body;
  // The browser loads access/storage in one realm; share JSON here so restored
  // plain records have the same prototype as the real storage module expects.
  const context = vm.createContext({ document, JSON, ManimanSecureStorage: manager, ManimanVault: vault });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/vault-access.js"), "utf8"), context);
  return { body, document, access: context.ManimanVaultAccess };
}
function manager() {
  const data = new Map();
  return vault.createManager({ async get(key) { return data.get(key); }, async set(key, value) { data.set(key, structuredClone(value)); } });
}

test("creating a vault verifies recovery through Enter without rerunning the create handler", async () => {
  const storage = manager(); await storage.begin();
  let creates = 0;
  const create = storage.create.bind(storage);
  storage.create = (...args) => { creates += 1; return create(...args); };
  const { body, access } = setup(storage);
  const finished = access.requestAccess({ initialState: { transactions: [], settings: { currency: "INR" } } });
  const form = body.querySelector("form");
  const fields = form.querySelectorAll("input").filter((input) => input.type === "password");
  fields[0].value = fields[1].value = "synthetic recovery passphrase";
  await form.dispatch("submit");
  assert.equal(creates, 1);
  const recovery = form.querySelector("textarea").value;
  const verification = form.querySelector("input");
  verification.value = "wrong recovery key";
  await form.dispatch("submit");
  assert.equal(body.children.length, 1);
  assert.equal(creates, 1);
  verification.value = recovery;
  await form.dispatch("submit");
  assert.equal((await finished).settings.currency, "INR");
  assert.equal(creates, 1);
  assert.equal(body.children.length, 0);
});

test("unlock form reports failure and supports recovery-key mode", async () => {
  const storage = manager(); await storage.begin();
  const created = await storage.create("synthetic unlock passphrase", { transactions: [] });
  storage.lock();
  const { body, access } = setup(storage);
  const finished = access.requestAccess();
  const form = body.querySelector("form");
  const input = form.querySelector("input");
  input.value = "incorrect password";
  await form.dispatch("submit");
  assert.equal(storage.isUnlocked(), false);
  assert.equal(input["aria-invalid"], "true");
  assert.equal(form.querySelector(".vault-error").role, "alert");
  assert.equal(form.querySelector(".vault-error").hidden, false);
  assert.equal(form.querySelectorAll("button").every((button) => !button.disabled), true);
  const recoveryToggle = form.querySelectorAll("button").find((button) => button.textContent === "Use recovery key");
  await recoveryToggle.dispatch("click");
  input.value = created.recoveryKey;
  await form.dispatch("submit");
  assert.equal((await finished).transactions.length, 0);
  assert.equal(storage.isUnlocked(), true);
});

test("vault dialog makes the workspace inert and contains keyboard and programmatic focus", async () => {
  const storage = manager(); await storage.begin();
  await storage.create("synthetic focused passphrase", { transactions: [] }); storage.lock();
  const { body, document, access } = setup(storage);
  const shell = document.createElement("div"); shell.className = "shell";
  const trigger = document.createElement("button"); shell.append(trigger); body.append(shell); trigger.focus();
  const finished = access.requestAccess();
  const backdrop = body.querySelector(".vault-backdrop");
  const panel = body.querySelector(".vault-panel");
  const form = panel.querySelector("form");
  const secret = form.querySelector("input");
  const last = form.querySelectorAll("button").at(-1);
  assert.equal(shell.inert, true);
  assert.equal(shell.hasAttribute("inert"), true);
  assert.equal(panel.role, "dialog");
  assert.equal(panel["aria-modal"], "true");
  assert.equal(panel["aria-labelledby"], panel.querySelector("h1").id);
  assert.equal(document.activeElement, secret);
  assert.equal(secret.autocomplete, "current-password");
  assert.equal(Object.keys(secret.events).includes("paste"), false);
  const backward = await backdrop.dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.equal(backward.defaultPrevented, true);
  assert.equal(document.activeElement, last);
  const forward = await backdrop.dispatch("keydown", { key: "Tab", shiftKey: false });
  assert.equal(forward.defaultPrevented, true);
  assert.equal(document.activeElement, secret);
  panel.focus();
  await backdrop.dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.equal(document.activeElement, last);
  trigger.focus();
  assert.equal(document.activeElement, secret);
  secret.value = "synthetic focused passphrase";
  await form.dispatch("submit"); await finished;
  assert.equal(shell.inert, false);
  assert.equal(shell.hasAttribute("inert"), false);
  assert.equal(body.querySelector(".vault-backdrop"), null);
  assert.equal(document.events.focusin.length, 0);
  assert.equal(document.activeElement, trigger);
});

test("focus containment follows the new recovery controls and prior inert state is preserved", async () => {
  const storage = manager(); await storage.begin();
  const { body, document, access } = setup(storage);
  const shell = document.createElement("div"); shell.className = "shell"; shell.inert = true; shell.setAttribute("inert", ""); body.append(shell);
  const finished = access.requestAccess({ initialState: { transactions: [] } });
  const form = body.querySelector("form");
  const fields = form.querySelectorAll("input").filter((input) => input.type === "password");
  fields[0].value = fields[1].value = "synthetic focused create passphrase";
  await form.dispatch("submit");
  const keyDisplay = form.querySelector("textarea");
  const verify = form.querySelector("input");
  const done = form.querySelectorAll("button").at(-1);
  assert.equal(keyDisplay.readOnly, true);
  assert.equal(keyDisplay.parent.tag, "label");
  assert.equal(document.activeElement, keyDisplay);
  done.focus();
  await body.querySelector(".vault-backdrop").dispatch("keydown", { key: "Tab", shiftKey: false });
  assert.equal(document.activeElement, keyDisplay);
  verify.value = keyDisplay.value;
  await form.dispatch("submit"); await finished;
  assert.equal(keyDisplay.value, "");
  assert.equal(verify.value, "");
  assert.equal(shell.inert, true);
  assert.equal(shell.hasAttribute("inert"), true);
});

test("restoring a backup keeps the replacement unlock dialog protected and releases inert after success", { timeout: 5000 }, async () => {
  const source = manager(); await source.begin();
  await source.create("synthetic restored passphrase", { transactions: [{ id: "synthetic-transaction" }] });
  const envelope = source.getEnvelope();
  const storage = manager(); await storage.begin();
  const { body, document, access } = setup(storage);
  const shell = document.createElement("div"); shell.className = "shell"; body.append(shell);
  const finished = access.requestAccess({ initialState: { transactions: [] } });
  const fileInput = body.querySelectorAll("input").find((input) => input.type === "file");
  const text = JSON.stringify(envelope); fileInput.files = [{ size: text.length, async text() { return text; } }];
  const restoring = fileInput.dispatch("change");
  await new Promise(setImmediate);
  const form = body.querySelector("form");
  assert.equal(body.querySelectorAll(".vault-panel").length, 1);
  assert.equal(shell.inert, true);
  assert.equal(document.events.focusin.length, 1);
  form.querySelector("input").value = "synthetic restored passphrase";
  await form.dispatch("submit");
  const opened = await finished; await restoring;
  assert.equal(opened.transactions[0].id, "synthetic-transaction");
  assert.equal(shell.inert, false);
  assert.equal(document.events.focusin.length, 0);
});

test("explicit local-vault adoption keeps its passphrase and recovery key for the cloud account", async () => {
  const storage = manager(); await storage.begin();
  const original = { transactions: [{ id: "local-record" }] };
  const created = await storage.create("synthetic shared passphrase", original);
  const local = storage.getEnvelope();
  await storage.begin("user:account-A");
  const { body, access } = setup(storage);
  const finished = access.requestAccess({ initialState: { transactions: [] }, localCandidate: local });
  const reuse = body.querySelectorAll("button").find((button) => /existing local vault/.test(button.textContent));
  const adopting = reuse.dispatch("click");
  await new Promise(setImmediate);
  const form = body.querySelector("form");
  form.querySelector("input").value = "synthetic shared passphrase";
  await form.dispatch("submit"); await adopting;
  assert.deepEqual(await finished, original);
  assert.equal(storage.getEnvelope().vaultId, local.vaultId);
  storage.lock();
  assert.deepEqual(await storage.unlock(created.recoveryKey, { recovery: true }), original);
  await storage.begin("local");
  assert.deepEqual(storage.getEnvelope(), local);
});

test("legacy cloud migration reuses a local key atomically without copying the wrong dataset", async () => {
  const storage = manager(); await storage.begin();
  const created = await storage.create("synthetic migration passphrase", { transactions: [{ id: "local-only" }] });
  const local = storage.getEnvelope();
  await storage.begin("user:account-A");
  const cloudState = { transactions: [{ id: "cloud-only" }] };
  const { body, access } = setup(storage);
  const finished = access.requestAccess({ initialState: cloudState, localCandidate: local, migration: true });
  const adopting = body.querySelectorAll("button").find((button) => /key for cloud/.test(button.textContent)).dispatch("click");
  await new Promise(setImmediate);
  const form = body.querySelector("form");
  form.querySelector("input").value = "wrong secret";
  await form.dispatch("submit");
  assert.equal(storage.getEnvelope(), null);
  assert.equal(form.querySelector(".vault-error").hidden, false);
  form.querySelector("input").value = "synthetic migration passphrase";
  await form.dispatch("submit"); await adopting;
  assert.deepEqual(await finished, cloudState);
  assert.equal(storage.getEnvelope().vaultId, local.vaultId);
  storage.lock();
  assert.deepEqual(await storage.unlock(created.recoveryKey, { recovery: true }), cloudState);
  await storage.begin("local");
  assert.deepEqual(storage.getEnvelope(), local);
});
