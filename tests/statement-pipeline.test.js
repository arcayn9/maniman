const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const vault = require("../lib/secure-storage.js");

for (const scenario of [
  { fixture: "synthetic-bank.txt", amounts: [80000, 2000000] },
  { fixture: "synthetic-value-post.txt", amounts: [12345, 50000] }
]) test(`local converter ${scenario.fixture} flows through reviewed import, encrypted persistence, reload and undo`, async () => {
  const root = path.resolve(__dirname, "..");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "maniman-pipeline-"));
  const output = path.join(temp, "statement.json");
  const process = spawnSync("python3", ["-m", "tools.statement_converter", `tests/fixtures/converter/${scenario.fixture}`, "--text-input", "-o", output], { cwd: root, encoding: "utf8" });
  assert.equal(process.status, 0, process.stderr);
  const source = JSON.parse(fs.readFileSync(output, "utf8"));
  const context = vm.createContext({ console, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }, setTimeout() {}, clearTimeout() {} });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(root, "lib/statement-contract.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);
  context.input = JSON.stringify(source);
  const initial = JSON.parse(vm.runInContext('JSON.stringify(emptyVaultState())', context));
  context.initial = JSON.stringify(initial);
  const plan = JSON.parse(vm.runInContext(`(() => {
    const document = JSON.parse(input), before = JSON.parse(initial);
    const configuration = { reviewed: true, institutionName: document.institution.name, options: { createCheckpoint: false }, sections: document.statements.map(section => ({ accountId: before.accounts[0].id, periodStart: section.period.start, periodEnd: section.period.end, rows: section.transactions.map(row => ({ type: row.direction === "debit" ? "expense" : "income", toAccountId: "", linkTransactionId: "" })) })) };
    return JSON.stringify(buildStatementImportPlan(document, before, configuration));
  })()`, context));
  assert.equal(plan.valid, true, JSON.stringify(plan.errors));
  assert.equal(plan.nextState.transactions.length, 2);
  assert.deepEqual(plan.nextState.transactions.map((tx) => tx.amountMinor), scenario.amounts);
  if (scenario.fixture === "synthetic-value-post.txt") {
    assert.equal(plan.nextState.transactions[0].date, "2026-02-03");
    assert.equal(source.statements[0].transactions[0].valueDate, "2026-02-02");
  }
  const values = new Map();
  const manager = vault.createManager({ async get(key) { return values.get(key); }, async set(key, value) { values.set(key, structuredClone(value)); } });
  await manager.begin();
  await manager.create("synthetic pipeline passphrase", initial);
  await manager.save(plan.nextState);
  assert.equal(JSON.stringify([...values.values()]).includes("EXAMPLE GROCER"), false);
  manager.lock();
  const restored = await manager.unlock("synthetic pipeline passphrase");
  assert.equal(restored.statementObservations.length, 2);
  context.restored = JSON.stringify(restored);
  context.batchId = plan.batch.id;
  const undone = JSON.parse(vm.runInContext('JSON.stringify(undoStatementImportBatch(JSON.parse(restored), batchId))', context));
  assert.equal(undone.transactions.length, 0);
  assert.equal(undone.statementObservations.length, 0);
});

test("ordinary app saves have no localStorage/plaintext fallback after statement import", async () => {
  const context = vm.createContext({ console, document: { addEventListener() {}, querySelector() { return null; } }, setTimeout() {}, clearTimeout() {} });
  context.window = context;
  context.localStorage = { setItem() { throw new Error("plaintext persistence invoked"); } };
  let snapshot;
  context.ManimanSecureStorage = { isUnlocked: () => true, save: async (value) => { snapshot = value; }, flush: async () => {} };
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../app.js"), "utf8"), context);
  assert.equal(await vm.runInContext('state = { transactions: [{ description: "private merchant" }] }; saveState()', context), true);
  assert.equal(snapshot.transactions[0].description, "private merchant");
});
