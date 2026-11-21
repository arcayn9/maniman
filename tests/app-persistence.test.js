const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const example = JSON.parse(fs.readFileSync(path.join(root, "docs/examples/statement-import.example.json"), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
function baseState() {
  return {
    version: 4, settings: { currency: "INR", selectedMonth: "2026-10", lastView: "transactions" },
    accounts: [{ id: "main", name: "Main", currency: "INR", openingBalance: 0, balanceCheckpoints: [] }],
    transactions: [], tags: [], accountCategories: [], transactionCategories: [], budgets: [], goals: [], bills: [],
    statementObservations: [], importBatches: [], statementMappings: []
  };
}
function harness() {
  const elements = new Map(), events = new Map(), readers = [], timers = [], messages = [];
  let unlocked = true, namespace = "local", envelope = { format: "test-vault", revision: 1 }, saves = 0, accessRequests = 0;
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { value: "", handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; }, replaceChildren() { this.cleared = true; }, setAttribute() {}, querySelectorAll() { return []; } });
    return elements.get(selector);
  };
  const secure = {
    isUnlocked: () => unlocked, namespace: () => namespace,
    begin: async (owner) => { namespace = owner; return { exists: false }; },
    getEnvelope: () => envelope, preserveConflict: async () => {},
    flush: async () => {}, save: async () => { saves += 1; },
    lock: () => { unlocked = false; }
  };
  const context = vm.createContext({
    console, Event: class Event { constructor(type) { this.type = type; } },
    document: { addEventListener() {}, querySelector: element, querySelectorAll: () => [] },
    location: { protocol: "http:", reload() {} },
    localStorage: { getItem: () => null, removeItem() {} },
    fetch: async () => ({ ok: false, status: 404 }),
    setTimeout: (handler) => { timers.push(handler); return timers.length; }, clearTimeout() {},
    FileReader: class FileReader { constructor() { readers.push(this); } readAsText(file) { this.result = file.contents; } }
  });
  context.window = context;
  context.addEventListener = (name, callback) => { events.set(name, callback); };
  context.dispatchEvent = (event) => events.get(event.type)?.(event);
  context.confirm = () => true;
  context.ManimanSecureStorage = secure;
  context.ManimanVault = { isEnvelope: (value) => value?.format === "test-vault" };
  context.ManimanVaultAccess = { requestAccess: async ({ initialState }) => { accessRequests += 1; return initialState; }, downloadEnvelope() {} };
  vm.runInContext(fs.readFileSync(path.join(root, "lib/statement-contract.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);
  context.note = (message) => messages.push(message);
  vm.runInContext("showToast = note; updateStorageBadge = () => {}; render = () => {};", context);
  const app = {
    context, secure, elements, element, readers, timers, messages,
    evaluate: (expression) => vm.runInContext(expression, context),
    call(name, ...args) { context.__args = JSON.stringify(args); return vm.runInContext(`${name}(...JSON.parse(__args))`, context); },
    setState(value) { context.__value = JSON.stringify(value); vm.runInContext("state = JSON.parse(__value)", context); },
    getState: () => vm.runInContext("state", context),
    owner(value) { namespace = value; },
    envelope(value) { envelope = value; },
    unlocked(value) { unlocked = value; },
    get saves() { return saves; }, get accessRequests() { return accessRequests; }
  };
  app.setState(baseState());
  return app;
}

test("all three currency controls refuse relabeling existing money; empty vault currency remains configurable", async () => {
  const app = harness();
  app.evaluate("initCloudClient = async () => {}; loadState = async () => state; bindVaultControls = () => {}; registerServiceWorker = () => {};");
  await app.call("init");
  app.call("bindSettingsEvents");
  const populated = baseState(); populated.transactions = [{ id: "tx1", type: "expense", amount: 800, currency: "INR", date: "2026-10-05", accountId: "main" }]; app.setState(populated);
  for (const selector of ["#currencySelect", "#mobileCurrencySelect", "#settingsCurrency"]) {
    app.element(selector).value = "USD";
    app.element(selector).handlers.change({ target: app.element(selector) });
    assert.equal(app.getState().settings.currency, "INR");
    assert.equal(app.element(selector).value, "INR");
  }
  assert.equal(app.saves, 0);
  app.setState(baseState());
  assert.equal(app.call("setDisplayCurrency", "USD"), true);
  assert.equal(app.getState().accounts[0].currency, "USD");
});

test("legacy backup validation rejects mixed currencies, unsafe IDs/colors/views and malformed batch metadata", () => {
  const app = harness();
  for (const change of [
    (value) => { value.accounts[0].currency = "USD"; },
    (value) => { value.accounts[0].id = 'bad" autofocus onfocus="alert(1)'; },
    (value) => { value.accounts[0].color = 'red" onmouseover="alert(1)'; },
    (value) => { value.settings.lastView = "unsupported-view"; },
    (value) => { value.importBatches = [{ kind: "statement", createdAt: 123 }]; }
  ]) {
    const value = baseState(); change(value);
    assert.equal(app.call("validateBackupState", value).valid, false);
    assert.throws(() => app.call("prepareBackupState", value), /Backup rejected before saving/);
  }
});

test("invalid legacy backup is rejected before encrypted save or ledger replacement", async () => {
  const app = harness();
  const malformed = baseState(); malformed.importBatches = [{ kind: "statement", createdAt: 123 }];
  app.call("importData", { target: { files: [{ size: 1000, contents: JSON.stringify(malformed) }], value: "selected" } });
  await app.readers[0].onload();
  assert.equal(app.saves, 0);
  assert.equal(app.getState().importBatches.length, 0);
  assert.ok(app.messages.some((message) => message.includes("Import rejected")));
});

test("valid statement-backed vault still passes restore validation after normalization", () => {
  const app = harness();
  const configuration = { reviewed: true, institutionName: example.institution.name, options: {}, sections: [{ accountId: "main", periodStart: "2026-10-01", periodEnd: "2026-10-31", rows: [{ type: "expense" }] }] };
  const plan = app.call("buildStatementImportPlan", example, baseState(), configuration);
  assert.equal(plan.valid, true);
  const normalized = app.call("normalizeState", JSON.parse(JSON.stringify(plan.nextState)));
  assert.equal(app.call("validateBackupState", normalized).valid, true);
});

test("unreadable server422 and unsupported non-null remote vault never offer empty-vault creation", async () => {
  const server = harness(); server.envelope(null);
  server.context.fetch = async () => ({ ok: false, status: 422 });
  await assert.rejects(server.call("loadState"), /local-server file is unreadable/);
  assert.equal(server.accessRequests, 0);
  const cloud = harness(); cloud.envelope(null);
  cloud.context.fakeClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { state: { format: "maniman.vault", version: 999 }, revision: 5 }, error: null }) }) }) }) };
  cloud.evaluate('cloud.user = {id:"owner-A"}; cloud.client = fakeClient;');
  await assert.rejects(cloud.call("loadState"), /remote vault is unreadable or uses an unsupported format/);
  assert.equal(cloud.accessRequests, 0);
});

test("JSONB key reordering does not create an encrypted-snapshot conflict", async () => {
  const app = harness();
  app.envelope({ format: "test-vault", revision: 3, payload: { iv: "abc", ciphertext: "def" } });
  app.context.fetch = async () => ({ ok: true, status: 200, json: async () => ({ state: { payload: { ciphertext: "def", iv: "abc" }, revision: 3, format: "test-vault" } }) });
  await app.call("loadState");
  assert.equal(app.evaluate("secureRemoteConflict"), false);
});

test("an existing cloud row with a missing JSON payload is not an empty new vault", async () => {
  for (const state of [null, undefined]) {
    const app = harness(); app.envelope(null);
    app.context.fakeClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { state, revision: 2 }, error: null }) }) }) }) };
    app.evaluate('cloud.user = {id:"owner-A"}; cloud.client = fakeClient;');
    await assert.rejects(app.call("loadState"), /existing cloud row has no readable vault/);
    assert.equal(app.accessRequests, 0);
  }
});

test("cloud owner change during flush cannot send the former vault under the new user", async () => {
  const app = harness(); const waiting = deferred(); const sent = [];
  app.owner("user:owner-A"); app.secure.flush = () => waiting.promise;
  app.context.fakeClient = { from: () => ({ insert: (payload) => { sent.push(payload); return { select: () => ({ maybeSingle: async () => ({ data: { revision: 1 }, error: null }) }) }; } }) };
  app.evaluate('cloud.user = {id:"owner-A"}; cloud.client = fakeClient;');
  const saving = app.call("saveStateToCloud");
  app.evaluate('cloud.user = {id:"owner-B"}'); waiting.resolve();
  await saving;
  assert.equal(sent.length, 0);
});

test("cloud owner change while a request is in flight cannot update the new owner's sync revision", async () => {
  const app = harness(); const started = deferred(), reply = deferred();
  app.owner("user:owner-A");
  app.context.fakeClient = { from: () => ({ update: () => ({ eq() { return this; }, select: () => ({ maybeSingle: () => { started.resolve(); return reply.promise; } }) }) }) };
  app.evaluate('cloud.user = {id:"owner-A"}; cloud.client = fakeClient; cloud.revision = 4;');
  const saving = app.call("saveStateToCloud"); await started.promise;
  app.evaluate('cloud.user = {id:"owner-B"}'); app.owner("user:owner-B");
  reply.resolve({ data: { revision: 5 }, error: null }); await saving;
  assert.equal(app.evaluate("cloud.revision"), 4);
});

test("auth changes synchronously clear decrypted state and invalidate the key without waiting for queued saves", async () => {
  const app = harness(); let authCallback; let flushes = 0;
  app.owner("user:owner-A"); app.secure.flush = () => { flushes += 1; return new Promise(() => {}); };
  app.context.MANIMAN_CONFIG = { supabaseUrl: "https://example.invalid", supabaseAnonKey: "synthetic" };
  app.context.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: "owner-A" } } } }), onAuthStateChange: (callback) => { authCallback = callback; } } }) };
  await app.call("initCloudClient");
  authCallback("SIGNED_IN", { user: { id: "owner-B" } });
  assert.equal(app.secure.isUnlocked(), false);
  assert.equal(app.getState(), null);
  assert.equal(flushes, 0);
  assert.equal(app.element("#viewRoot").cleared, true);
});

test("local server sync serializes revision CAS and never overlaps its POST requests", async () => {
  const app = harness(); const firstStarted = deferred(), firstReply = deferred(); const requests = []; let active = 0, peak = 0;
  app.evaluate('storageMode = "server";');
  app.context.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body)); active += 1; peak = Math.max(peak, active);
    if (requests.length === 1) { firstStarted.resolve(); await firstReply.promise; }
    active -= 1; return { ok: true, status: 200 };
  };
  const first = app.call("syncEncryptedState"); await firstStarted.promise;
  app.envelope({ format: "test-vault", revision: 2 });
  const second = app.call("syncEncryptedState");
  await Promise.resolve(); assert.equal(requests.length, 1);
  firstReply.resolve(); await Promise.all([first, second]);
  assert.equal(peak, 1);
  assert.deepEqual(requests.map((request) => request.expectedRevision), [0, 1]);
  assert.deepEqual(requests.map((request) => request.state.revision), [1, 2]);
  assert.equal(app.evaluate("secureRemoteConflict"), false);
});

test("transient cloud errors preserve retry, while a failed revision CAS is a conflict", async () => {
  const app = harness(); let attempts = 0;
  app.owner("user:owner-A");
  app.context.fakeClient = { from: () => ({ insert: () => ({ select: () => ({ maybeSingle: async () => ++attempts === 1 ? { data: null, error: { code: "FETCH_ERROR" } } : { data: { revision: 1 }, error: null } }) }) }) };
  app.evaluate('cloud.user = {id:"owner-A"}; cloud.client = fakeClient;');
  await app.call("saveStateToCloud");
  assert.equal(app.evaluate("secureRemoteConflict"), false);
  assert.equal(app.evaluate("syncStatus"), "unsynced");
  await app.call("saveStateToCloud");
  assert.equal(attempts, 2);
  assert.equal(app.evaluate("syncStatus"), "synced");
  app.context.fakeClient = { from: () => ({ update: () => ({ eq() { return this; }, select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
  app.evaluate("cloud.client = fakeClient"); await app.call("saveStateToCloud");
  assert.equal(app.evaluate("secureRemoteConflict"), true);
});
