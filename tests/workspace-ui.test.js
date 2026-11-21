const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const statement = JSON.parse(fs.readFileSync(path.join(root, "docs/examples/statement-import.example.json"), "utf8"));

function harness() {
  const nodes = new Map(), groups = new Map(), readers = [];
  const element = (selector, properties = {}) => {
    const node = {
      value: "", innerHTML: "", textContent: "", hidden: false,
      dataset: {}, attributes: {}, handlers: {},
      classList: { toggle() {} },
      addEventListener(event, handler) { this.handlers[event] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      querySelectorAll() { return []; }, scrollIntoView() {},
      ...properties
    };
    nodes.set(selector, node);
    return node;
  };
  const context = vm.createContext({
    console, document: { addEventListener() {}, querySelector: (selector) => nodes.get(selector) || null, querySelectorAll: (selector) => groups.get(selector) || [] },
    setTimeout() {}, clearTimeout() {},
    FileReader: class FileReader { constructor() { readers.push(this); } readAsText(file) { this.result = file.contents; } }
  });
  context.window = context;
  context.addEventListener = () => {};
  context.ManimanSecureStorage = { isUnlocked: () => true, namespace: () => "local" };
  vm.runInContext(fs.readFileSync(path.join(root, "lib/statement-contract.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);
  vm.runInContext("showToast = () => {}; saveState = () => Promise.resolve(true);", context);
  const call = (name, ...args) => {
    context.__args = JSON.stringify(args);
    return vm.runInContext(`${name}(...JSON.parse(__args))`, context);
  };
  const setState = (value) => {
    context.__state = JSON.stringify(value);
    vm.runInContext("state = normalizeState(JSON.parse(__state))", context);
  };
  setState({
    version: 4, settings: { currency: "INR", selectedMonth: "2026-10", lastView: "dashboard" },
    accounts: [{ id: "main", name: "Main account", currency: "INR", openingBalance: 0, balanceCheckpoints: [] }, { id: "other", name: "Other account", currency: "INR", openingBalance: 0, balanceCheckpoints: [] }],
    transactions: [], budgets: [], bills: [], goals: [], importBatches: [], statementObservations: [], statementMappings: []
  });
  return { context, nodes, groups, readers, element, call, setState, evaluate: (source) => vm.runInContext(source, context), getState: () => vm.runInContext("state", context) };
}

function prepareImportsDOM(app) {
  for (const selector of ["#bulkText", "#bulkTextBtn", "#bulkFile"]) app.element(selector);
  app.element("#bulkAccount", { value: "main" });
  app.element("#bulkBalanceMode", { value: "checkpoint" });
}

function transaction(id, overrides = {}) {
  return { id, accountId: "main", toAccountId: "", date: "2026-10-05", type: "expense", amount: 800, description: "Groceries", category: "Groceries", note: "", tags: [], ...overrides };
}

test("statement JSON stages in the dedicated Imports route without saving or altering the ledger", () => {
  const app = harness();
  app.evaluate("render = () => {};");
  app.call("stageStatementImport", statement, { createCheckpoint: false });
  assert.equal(app.evaluate("activeView"), "imports");
  assert.equal(app.evaluate("pendingStatementImport.document.format"), "maniman.statement");
  assert.equal(app.getState().transactions.length, 0);
  assert.equal(app.getState().importBatches.length, 0);
});

test("the Imports route renders and binds upload controls independently of transaction entry controls", () => {
  const app = harness();
  prepareImportsDOM(app);
  const view = app.element("#viewRoot");
  for (const selector of ["#monthPicker", "#currencySelect", "#mobileCurrencySelect", "#screenTitle"]) app.element(selector);
  app.evaluate("dom.viewRoot = document.querySelector('#viewRoot'); dom.monthPicker = document.querySelector('#monthPicker'); dom.currencySelect = document.querySelector('#currencySelect'); dom.mobileCurrencySelect = document.querySelector('#mobileCurrencySelect'); dom.navItems = []; activeView = 'imports';");
  assert.doesNotThrow(() => app.call("render"));
  assert.match(view.innerHTML, /Upload statement JSON/);
  assert.doesNotMatch(view.innerHTML, /id="transactionForm"/);
  assert.equal(typeof app.nodes.get("#bulkFile").handlers.change, "function");
  assert.equal(app.nodes.get("#screenTitle").textContent, "Imports & review");
});

test("Imports is a valid persisted route and survives backup normalization", () => {
  const app = harness();
  const value = JSON.parse(JSON.stringify(app.getState()));
  value.settings.lastView = "imports";
  const restored = app.call("prepareBackupState", value);
  assert.equal(restored.settings.lastView, "imports");
});

test("a pending upload keeps its selected account and checkpoint settings when the user navigates away", () => {
  const app = harness(); prepareImportsDOM(app);
  let uploaded;
  app.context.captureUpload = (...args) => { uploaded = args; };
  app.evaluate("importTransactionText = captureUpload");
  app.call("bindImportEvents");
  const input = app.nodes.get("#bulkFile");
  input.handlers.change({ target: { files: [{ size: 20, name: "statement.json", contents: "{}" }], value: "selected" } });
  app.nodes.delete("#bulkAccount"); app.nodes.delete("#bulkBalanceMode");
  assert.doesNotThrow(() => app.readers[0].onload());
  assert.equal(uploaded[2].defaultAccountId, "main");
  assert.equal(uploaded[2].createCheckpoint, true);
});

test("a pending file read is discarded when the vault owner changes before it completes", () => {
  const app = harness(); prepareImportsDOM(app);
  let uploads = 0;
  app.context.captureUpload = () => { uploads += 1; };
  app.evaluate("importTransactionText = captureUpload");
  app.call("bindImportEvents");
  app.nodes.get("#bulkFile").handlers.change({ target: { files: [{ size: 20, name: "statement.json", contents: "{}" }], value: "selected" } });
  app.evaluate("secureAuthEpoch += 1");
  app.readers[0].onload();
  assert.equal(uploads, 0);
  assert.equal(app.getState().transactions.length, 0);
});

test("coverage uses the confirmed statement period rather than observed transaction bounds", () => {
  const app = harness();
  const value = JSON.parse(JSON.stringify(app.getState()));
  value.importBatches = [{ kind: "statement", statements: [{ accountId: "main", period: { start: "2026-09-20", end: "2026-10-19", status: "user_confirmed" }, observedTransactionRange: { start: "2026-10-05", end: "2026-10-05" } }] }];
  app.setState(value);
  const html = app.call("renderStatementCoverage", "2026-10");
  assert.match(html, /2026-09-20 – 2026-10-19/);
  assert.doesNotMatch(html, /2026-10-05/);
  assert.match(html, /Recorded activity alone does not prove complete coverage/);
});

test("recorded activity and unconfirmed date metadata never count as confirmed coverage", () => {
  const app = harness();
  const value = JSON.parse(JSON.stringify(app.getState()));
  value.transactions = [transaction("activity")];
  value.importBatches = [{ kind: "statement", statements: [{ accountId: "main", period: { start: "2026-10-01", end: "2026-10-31", status: "unknown" }, observedTransactionRange: { start: "2026-10-05", end: "2026-10-05" } }] }];
  app.setState(value);
  const html = app.call("renderStatementCoverage", "2026-10");
  assert.match(html, /No confirmed statement coverage/);
  assert.doesNotMatch(html, /2026-10-01 – 2026-10-31/);
});

test("coverage filters by declared period, includes leap-month boundaries and escapes account labels", () => {
  const app = harness();
  const value = JSON.parse(JSON.stringify(app.getState()));
  value.accounts[0].name = '<img src=x onerror="bad()">';
  value.importBatches = [{ kind: "statement", statements: [
    { accountId: "main", period: { start: "2024-02-29", end: "2024-03-15", status: "user_confirmed" } },
    { accountId: "other", period: { start: "2024-03-01", end: "2024-03-31", status: "user_confirmed" }, observedTransactionRange: { start: "2024-02-03", end: "2024-02-03" } }
  ] }];
  app.setState(value);
  const html = app.call("renderStatementCoverage", "2024-02");
  assert.match(html, /2024-02-29 – 2024-03-15/);
  assert.doesNotMatch(html, /2024-03-01 – 2024-03-31/);
  assert.match(html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/);
  assert.doesNotMatch(html, /<img/);
});

test("ledger rendering escapes financial text and IDs while keeping contextual transfer direction", () => {
  const app = harness();
  const value = JSON.parse(JSON.stringify(app.getState()));
  value.accounts[0].name = "Main <script>bad()</script>";
  app.setState(value);
  const row = transaction('tx" autofocus="bad', { type: "transfer", toAccountId: "other", description: "Dinner <img src=x>", note: '<svg onload="bad()">', tags: ["<unsafe>"] });
  const html = app.call("renderLedgerTable", [row], "other");
  assert.doesNotMatch(html, /<img|<script|<svg(?! class="ui-icon")/);
  assert.equal((html.match(/<svg class="ui-icon"[^>]+aria-hidden="true">/g) || []).length, 2);
  assert.match(html, /Dinner &lt;img src=x&gt;/);
  assert.match(html, /data-edit-transaction="tx&quot; autofocus=&quot;bad"/);
  assert.match(html, /class="amount income">\+/);
  assert.match(html, /Main &lt;script&gt;bad\(\)&lt;\/script&gt; → Other account/);
});

test("ledger search, type and account filters compose and include a transfer's destination account", () => {
  const app = harness();
  const value = JSON.parse(JSON.stringify(app.getState()));
  value.transactions = [transaction("food"), transaction("transfer", { type: "transfer", description: "Internal movement", toAccountId: "other", tags: ["banking"] }), transaction("salary", { type: "income", description: "Salary", note: "PAYROLL", amount: 5000 })];
  app.setState(value);
  for (const selector of ["#transactionForm", "#txType", "#txCategory", "#txSearch", "#txFilterType", "#txFilterAccount", "#transactionList"]) app.element(selector);
  app.nodes.get("#txFilterType").value = "all";
  app.nodes.get("#txFilterAccount").value = "other";
  app.nodes.get("#txSearch").value = "BANKING";
  app.call("bindTransactionEvents");
  app.nodes.get("#txSearch").handlers.input();
  const list = app.nodes.get("#transactionList");
  assert.match(list.innerHTML, /Internal movement/);
  assert.doesNotMatch(list.innerHTML, /Groceries|Salary/);
  assert.match(list.innerHTML, /class="amount income">\+/);
  app.nodes.get("#txFilterType").value = "expense";
  app.nodes.get("#txFilterType").handlers.change();
  assert.match(list.innerHTML, /No matching transactions/);
  app.nodes.get("#txFilterType").value = "income";
  app.nodes.get("#txFilterAccount").value = "all";
  app.nodes.get("#txSearch").value = "payroll";
  app.nodes.get("#txSearch").handlers.input();
  assert.match(list.innerHTML, /Salary/);
  assert.doesNotMatch(list.innerHTML, /Internal movement/);
});

test("new vaults default to INR while saved and legacy USD records retain their currency", () => {
  const app = harness();
  assert.equal(app.call("emptyVaultState").settings.currency, "INR");
  assert.equal(app.call("createStarterState").settings.currency, "INR");
  assert.equal(app.call("createBlankState").settings.currency, "INR");
  assert.match(app.call("formatMoney", 123456.78), /₹1,23,456\.78/);
  const saved = JSON.parse(JSON.stringify(app.getState()));
  saved.settings.currency = "USD";
  saved.accounts.forEach((account) => { account.currency = "USD"; });
  saved.transactions = [transaction("usd-record", { amount: 120, currency: "USD" })];
  assert.equal(app.call("normalizeState", saved).settings.currency, "USD");
  assert.equal(app.call("normalizeState", saved).transactions[0].amount, 120);
  const legacy = JSON.parse(JSON.stringify(saved));
  delete legacy.settings.currency;
  assert.equal(app.call("prepareBackupState", legacy).settings.currency, "USD");
});

test("row actions expose contextual accessible names and titles while retaining their action bindings", () => {
  const app = harness();
  const tx = transaction("safe-id", { description: 'Coffee "break" <script>' });
  const row = app.call("renderTransactionRow", tx);
  assert.match(row, /data-edit-transaction="safe-id"/);
  assert.match(row, /data-delete-transaction="safe-id"/);
  assert.match(row, /aria-label="Edit transaction: Coffee &quot;break&quot; &lt;script&gt;"/);
  assert.match(row, /title="Delete transaction: Coffee &quot;break&quot; &lt;script&gt;"/);
  assert.match(row, /<svg[^>]+aria-hidden="true"/);
  assert.doesNotMatch(row, />Edit<|>Delete<|<script>/);
  const goal = app.call("renderGoalRow", { id: "goal-test", name: "Emergency fund", target: 1000, saved: 100, color: "#244fb4", dueDate: "" });
  assert.match(goal, /data-save-goal="goal-test"/);
  assert.match(goal, /aria-label="Save goal progress: Emergency fund"/);
  assert.match(goal, /aria-label="Delete goal: Emergency fund"/);
  assert.doesNotMatch(goal, />Save<|>Delete</);
});
