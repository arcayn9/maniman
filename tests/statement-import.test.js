const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const example = JSON.parse(fs.readFileSync(path.join(root, "docs/examples/statement-import.example.json"), "utf8"));

function harness() {
  const events = {};
  const context = vm.createContext({
    console,
    document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
    setTimeout() {},
    clearTimeout() {}
  });
  context.window = context;
  context.addEventListener = (event, handler) => { events[event] = handler; };
  vm.runInContext(fs.readFileSync(path.join(root, "lib/statement-contract.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);
  return {
    context,
    events,
    call(name, ...args) {
      context.__args = JSON.stringify(args);
      return JSON.parse(vm.runInContext(`JSON.stringify(${name}(...JSON.parse(__args)))`, context));
    }
  };
}

function state() {
  return {
    version: 4,
    settings: { currency: "INR", selectedMonth: "2026-10" },
    accounts: [
      { id: "icici", name: "Main account", currency: "INR", categoryId: "acctcat_savings", openingBalance: 0, balanceCheckpoints: [] },
      { id: "hdfc", name: "Other account", currency: "INR", categoryId: "acctcat_savings", openingBalance: 0, balanceCheckpoints: [] }
    ],
    accountCategories: [{ id: "acctcat_savings", name: "Savings Account", kind: "payment" }],
    transactions: [], transactionCategories: [], tags: [], budgets: [], bills: [], goals: [],
    statementObservations: [], importBatches: [], statementMappings: []
  };
}

function config(document = example) {
  return {
    institutionName: document.institution.name,
    reviewed: true,
    options: { createCheckpoint: true },
    sections: document.statements.map((section) => ({
      accountId: "icici",
      periodStart: section.period.start,
      periodEnd: section.period.end,
      rows: section.transactions.map(() => ({ type: "expense", toAccountId: "", linkTransactionId: "" }))
    }))
  };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

test("statement import preserves source evidence, coverage and exact minor units without mutating input", () => {
  const app = harness();
  const before = state();
  const result = app.call("buildStatementImportPlan", example, before, config());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.nextState.transactions[0].amount, 800);
  assert.equal(result.nextState.transactions[0].amountMinor, 80000);
  assert.equal(result.nextState.statementObservations[0].data.references[0].value, "SYNTHETIC-REF-001");
  assert.equal(result.batch.statements[0].period.start, "2026-10-01");
  assert.equal(result.nextState.accounts[0].balanceCheckpoints[0].balance, 9200);
  assert.equal(before.transactions.length, 0);
});

test("repeat import is idempotent even when source JSON object key order changes", () => {
  const app = harness();
  const first = app.call("buildStatementImportPlan", example, state(), config());
  const reordered = clone(example);
  reordered.statements[0].transactions[0] = Object.fromEntries(Object.entries(reordered.statements[0].transactions[0]).reverse());
  const second = app.call("buildStatementImportPlan", reordered, first.nextState, config(reordered));
  assert.equal(second.valid, true);
  assert.equal(second.noChanges, true);
  assert.equal(second.nextState.transactions.length, 1);
  assert.equal(second.nextState.importBatches.length, 1);
});

test("same-day equal-amount genuine purchases remain separate observations and transactions", () => {
  const app = harness();
  const input = clone(example);
  const section = input.statements[0];
  section.transactions.push({ ...clone(section.transactions[0]), observationId: "second-purchase", sourceLocation: { page: 1, row: 2 }, runningBalanceMinor: 840000 });
  section.extraction.transactionRowCount = 2;
  section.balances.closing.amountMinor = 840000;
  const result = app.call("buildStatementImportPlan", input, state(), config(input));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.nextState.transactions.length, 2);
});

test("account selection and all row treatments require explicit confirmation", () => {
  const app = harness();
  const choice = config();
  choice.sections[0].accountId = "";
  assert.equal(app.call("buildStatementImportPlan", example, state(), choice).valid, false);
  choice.sections[0].accountId = "icici";
  choice.sections[0].rows[0].type = "";
  assert.equal(app.call("buildStatementImportPlan", example, state(), choice).valid, false);
  choice.sections[0].rows[0].type = "expense";
  choice.reviewed = false;
  assert.equal(app.call("buildStatementImportPlan", example, state(), choice).valid, false);
});

test("unknown period and institution can be corrected by user, but invalid calendar dates cannot", () => {
  const app = harness();
  const input = clone(example);
  input.institution = { name: null, code: null, country: "IN", status: "unknown", evidence: null };
  input.statements[0].period = { start: null, end: null, status: "unknown", evidence: null };
  const choice = config(example);
  assert.equal(app.call("buildStatementImportPlan", input, state(), choice).valid, true);
  choice.sections[0].periodStart = "2026-02-30";
  assert.equal(app.call("buildStatementImportPlan", input, state(), choice).valid, false);
});

test("incomplete extraction, source errors, identity conflicts and mixed currencies block commit", () => {
  const app = harness();
  const failed = clone(example);
  failed.issues = [{ code: "unparsed_row", message: "A row was not parsed.", severity: "error" }];
  assert.equal(app.call("buildStatementImportPlan", failed, state(), config()).valid, false);
  const partial = clone(example);
  partial.statements[0].extraction.status = "partial";
  assert.equal(app.call("buildStatementImportPlan", partial, state(), config()).valid, false);
  const usdState = state();
  usdState.settings.currency = "USD";
  assert.equal(app.call("buildStatementImportPlan", example, usdState, config()).valid, false);
  const first = app.call("buildStatementImportPlan", example, state(), config());
  const wrongAccount = config();
  wrongAccount.sections[0].accountId = "hdfc";
  assert.equal(app.call("buildStatementImportPlan", example, first.nextState, wrongAccount).valid, false);
});

test("own-account transfers preserve debit/credit direction and stay neutral to income/expense", () => {
  const app = harness();
  const choice = config();
  choice.sections[0].rows[0] = { type: "transfer", toAccountId: "hdfc" };
  const result = app.call("buildStatementImportPlan", example, state(), choice);
  assert.equal(result.valid, true);
  assert.equal(result.nextState.transactions[0].type, "transfer");
  assert.equal(result.nextState.transactions[0].accountId, "icici");
  assert.equal(result.nextState.transactions[0].toAccountId, "hdfc");
  choice.sections[0].rows[0].toAccountId = "icici";
  assert.equal(app.call("buildStatementImportPlan", example, state(), choice).valid, false);
});

test("explicit linking preserves existing manual transaction labels and undo never deletes that transaction", () => {
  const app = harness();
  const before = state();
  before.transactions.push({ id: "manual", accountId: "icici", date: "2026-10-05", amount: 800, currency: "INR", type: "expense", category: "Groceries", description: "My groceries", note: "Keep this note", tags: ["household"] });
  const choice = config();
  choice.sections[0].rows[0].linkTransactionId = "manual";
  const result = app.call("buildStatementImportPlan", example, before, choice);
  assert.equal(result.valid, true);
  assert.equal(result.nextState.transactions.length, 1);
  assert.equal(result.nextState.transactions[0].note, "Keep this note");
  const undone = app.call("undoStatementImportBatch", result.nextState, result.batch.id);
  assert.equal(undone.transactions.length, 1);
  assert.equal(undone.transactions[0].statementEvidence.length, 0);
});

test("undo preserves cross-document evidence and removes untouched import transaction only after last support is undone", () => {
  const app = harness();
  const first = app.call("buildStatementImportPlan", example, state(), config());
  const other = clone(example);
  other.source.documentId = "second-document";
  const choice = config(other);
  choice.sections[0].rows[0].linkTransactionId = first.nextState.transactions[0].id;
  const second = app.call("buildStatementImportPlan", other, first.nextState, choice);
  assert.equal(second.valid, true, JSON.stringify(second.errors));
  const afterFirstUndo = app.call("undoStatementImportBatch", second.nextState, first.batch.id);
  assert.equal(afterFirstUndo.transactions.length, 1);
  assert.equal(afterFirstUndo.transactions[0].statementEvidence.length, 1);
  assert.equal(afterFirstUndo.accounts[0].balanceCheckpoints.length, 1);
  const afterSecondUndo = app.call("undoStatementImportBatch", afterFirstUndo, second.batch.id);
  assert.equal(afterSecondUndo.transactions.length, 0);
  assert.equal(afterSecondUndo.accounts[0].balanceCheckpoints.length, 0);
});

test("undo after save/reload preserves user edits but removes untouched imported rows", () => {
  const app = harness();
  const first = app.call("buildStatementImportPlan", example, state(), config());
  const normalized = app.call("normalizeState", first.nextState);
  assert.equal(app.call("undoStatementImportBatch", normalized, first.batch.id).transactions.length, 0);
  normalized.transactions[0].note = "User correction";
  const kept = app.call("undoStatementImportBatch", normalized, first.batch.id);
  assert.equal(kept.transactions.length, 1);
  assert.equal(kept.transactions[0].note, "User correction");
  assert.equal(kept.transactions[0].importBatchId, "");
});

test("closed empty statement retains explicit period coverage and repeat import remains stable", () => {
  const app = harness();
  const input = clone(example);
  const section = input.statements[0];
  section.transactions = [];
  section.observedTransactionRange = { start: null, end: null };
  section.extraction.transactionRowCount = 0;
  section.balances.closing.amountMinor = section.balances.opening.amountMinor;
  const first = app.call("buildStatementImportPlan", input, state(), config(input));
  assert.equal(first.valid, true, JSON.stringify(first.errors));
  assert.equal(first.noChanges, false);
  assert.equal(first.nextState.transactions.length, 0);
  assert.equal(first.nextState.importBatches[0].statements[0].period.end, "2026-10-31");
  assert.equal(app.call("buildStatementImportPlan", input, first.nextState, config(input)).noChanges, true);
});

test("account metadata and evidence survive normalization, unknown state field is not used as ownership", () => {
  const app = harness();
  const choice = config();
  choice.sections[0].accountId = "__new__";
  choice.sections[0].newAccountName = "Example savings";
  choice.sections[0].newAccountKind = "savings";
  const first = app.call("buildStatementImportPlan", example, state(), choice);
  assert.equal(first.valid, true);
  const normalized = app.call("normalizeState", first.nextState);
  const account = normalized.accounts.find((item) => item.name === "Example savings");
  assert.equal(account.institution, "Example Bank");
  assert.equal(account.maskedIdentifier, "XXXX1234");
  assert.equal(normalized.transactions[0].statementEvidence.length, 1);
  assert.equal(normalized.statementObservations.length, 1);
  assert.equal(normalized.importBatches.length, 1);
});

test("statement envelope routing never treats a statement as a whole-state backup", () => {
  const app = harness();
  assert.equal(app.call("isStatementEnvelope", example), true);
  assert.equal(app.call("isStatementEnvelope", { accounts: [], transactions: [] }), false);
});

test("commit refuses plaintext fallback while the vault is locked", async () => {
  const app = harness();
  let saves = 0;
  app.context.ManimanSecureStorage = { isUnlocked: () => false, save: async () => { saves += 1; } };
  vm.runInContext("showToast = () => {}; pendingStatementImport = {};", app.context);
  await vm.runInContext("commitPendingStatementImport()", app.context);
  assert.equal(saves, 0);
});

test("colliding masked source identifiers can map to multiple explicitly confirmed accounts", () => {
  const app = harness();
  const first = app.call("buildStatementImportPlan", example, state(), config());
  const secondDocument = clone(example);
  secondDocument.source.documentId = "second-owned-account-document";
  const secondChoice = config(secondDocument);
  secondChoice.sections[0].accountId = "hdfc";
  const second = app.call("buildStatementImportPlan", secondDocument, first.nextState, secondChoice);
  assert.equal(second.valid, true, JSON.stringify(second.errors));
  assert.equal(second.nextState.statementMappings.length, 2);
  const key = second.nextState.statementMappings[0].key;
  assert.equal(app.call("confirmedStatementMappingAccount", first.nextState, key), "icici");
  assert.equal(app.call("confirmedStatementMappingAccount", second.nextState, key), "");
});

test("new statement credits have unassigned purpose rather than an invented Salary classification", () => {
  const app = harness();
  const input = clone(example);
  input.statements[0].transactions[0].direction = "credit";
  input.statements[0].transactions[0].runningBalanceMinor = 1080000;
  input.statements[0].balances.closing.amountMinor = 1080000;
  const choice = config(input);
  choice.sections[0].rows[0].type = "income";
  const result = app.call("buildStatementImportPlan", input, state(), choice);
  assert.equal(result.valid, true);
  assert.equal(result.nextState.transactions[0].category, "Other");
  assert.equal(result.nextState.transactions[0].classificationStatus, "purpose_unassigned");
});
