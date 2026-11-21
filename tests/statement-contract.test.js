const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const contract = require("../lib/statement-contract.js");
const examplePath = path.join(__dirname, "../docs/examples/statement-import.example.json");
const fixture = () => JSON.parse(fs.readFileSync(examplePath, "utf8"));
const validate = (change) => { const doc = fixture(); change(doc, doc.statements[0], doc.statements[0].transactions[0]); return contract.validateStatementDocument(doc); };
const codes = (result) => result.errors.map((issue) => issue.code);

test("synthetic statement validates without changing the caller's document", () => {
  const doc = fixture();
  const before = JSON.stringify(doc);
  const result = contract.validateStatementDocument(doc);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(JSON.stringify(doc), before);
  assert.equal(result.warnings.some((item) => item.code === "missing_document_fingerprint"), true);
});

test("format detection distinguishes statements, transaction lists, and app backups", () => {
  assert.equal(contract.isStatementDocument(fixture()), true);
  for (const input of [null, [], { transactions: [] }, { version: 3, accounts: [] }, { format: "other" }]) {
    assert.equal(contract.isStatementDocument(input), false);
    assert.equal(contract.validateStatementDocument(input).valid, false);
  }
  assert.ok(codes(validate((doc) => { doc.schemaVersion = "2.0"; })).includes("unsupported_version"));
  assert.ok(codes(validate((doc) => { doc.accounts = []; })).includes("unknown_field"));
});

test("dates reject calendar overflow and accept leap days", () => {
  for (const bad of ["2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "01/10/2026", "2026-10-05T00:00:00Z", null]) {
    const result = validate((doc, statement, tx) => { tx.transactionDate = bad; delete statement.observedTransactionRange; });
    assert.ok(codes(result).includes("invalid_date"), String(bad));
  }
  const valid = validate((doc, s, tx) => {
    s.period = { start: null, end: null, status: "unknown" };
    delete s.observedTransactionRange;
    delete s.balances;
    tx.transactionDate = "2024-02-29";
  });
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));
});

test("money uses safe positive minor-unit integers and a supported currency", () => {
  for (const amount of [0, -1, 0.5, "80000", Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.ok(codes(validate((doc, s, tx) => { tx.amountMinor = amount; })).includes("invalid_amount"));
  }
  assert.ok(codes(validate((doc, s, tx) => { tx.currency = "ZZZ"; })).includes("invalid_currency"));
  assert.ok(codes(validate((doc, s, tx) => { tx.currency = "USD"; })).includes("currency_mismatch"));
  assert.equal(contract.currencyExponent("INR"), 2);
  assert.equal(contract.currencyExponent("JPY"), 0);
  assert.equal(contract.currencyExponent("KWD"), 3);
  assert.throws(() => contract.currencyExponent("ZZZ"), RangeError);
  assert.throws(() => contract.currencyExponent("inr"), RangeError);
});

test("unknown metadata stays reviewable instead of inheriting transaction bounds", () => {
  const result = validate((doc, s) => {
    doc.institution = { name: null, code: null, status: "unknown" };
    s.account.kind = null;
    s.account.maskedIdentifier = null;
    s.period = { start: null, end: null, status: "unknown" };
    delete s.balances;
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((v) => v.code === "unknown_coverage"));
  assert.ok(result.warnings.some((v) => v.code === "unknown_institution"));
  assert.ok(result.warnings.some((v) => v.code === "unknown_account_identity"));
});

test("an unknown-currency failed extraction remains a review envelope without invented transactions", () => {
  const result = validate((doc, s) => {
    s.account.currency = null;
    s.transactions = [];
    delete s.observedTransactionRange;
    delete s.balances;
    s.extraction = { status: "failed", transactionRowCount: 1, excludedRows: [{ reason: "Currency absent", sourceLocation: { page: 1, row: 1 } }], issues: [] };
    doc.source.extractionMethod = "text_input";
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((v) => v.code === "unknown_currency"));
  assert.ok(result.warnings.some((v) => v.code === "incomplete_extraction"));
});

test("candidate row counts include explicit exclusions and omissions fail validation", () => {
  assert.ok(codes(validate((doc, s) => { s.extraction.transactionRowCount = 2; })).includes("row_count_mismatch"));
  const result = validate((doc, s) => {
    s.extraction.status = "partial";
    s.extraction.transactionRowCount = 2;
    s.extraction.excludedRows.push({ reason: "Unreadable date", sourceLocation: { page: 1, row: 2 } });
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((v) => v.code === "excluded_transaction_row"));
});

test("duplicate observation IDs and account sections are rejected", () => {
  const duplicateTx = validate((doc, s, tx) => { s.transactions.push(structuredClone(tx)); s.extraction.transactionRowCount = 2; delete s.balances; });
  assert.ok(codes(duplicateTx).includes("duplicate_observation_id"));
  const duplicateStatement = validate((doc, s) => { doc.statements.push(structuredClone(s)); });
  assert.ok(codes(duplicateStatement).includes("duplicate_statement_id"));
  assert.ok(codes(duplicateStatement).includes("duplicate_observation_id"));
});

test("complete evidenced balance arithmetic checks asset and liability conventions", () => {
  assert.ok(codes(validate((doc, s) => { s.balances.closing.amountMinor += 1; })).includes("balance_mismatch"));
  const liability = validate((doc, s) => {
    s.account.kind = "credit_card";
    s.balances.signConvention = "positive_liability_balance";
    s.balances.closing.amountMinor = 1080000;
  });
  assert.equal(liability.valid, true, JSON.stringify(liability.errors));
  const incomplete = validate((doc, s) => {
    s.extraction.status = "partial";
    s.balances.closing.amountMinor += 1;
  });
  assert.equal(incomplete.valid, true);
  assert.ok(incomplete.warnings.some((v) => v.code === "balance_not_verified"));
});

test("observed transaction bounds, source pages and unmasked identifiers are checked", () => {
  assert.ok(codes(validate((doc, s) => { s.observedTransactionRange.start = "2026-10-01"; })).includes("observed_range_mismatch"));
  assert.ok(codes(validate((doc, s, tx) => { tx.sourceLocation.page = 2; })).includes("page_out_of_range"));
  assert.ok(codes(validate((doc, s) => { s.account.maskedIdentifier = "123456789012"; })).includes("unmasked_identifier"));
});

test("source issues are structured review diagnostics, never executed content", () => {
  const result = validate((doc) => {
    doc.issues.push({ code: "ocr_uncertain", severity: "error", message: "<script>throw Error('never execute')</script>" });
  });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((v) => v.code === "source_issue" && v.message.startsWith("Unresolved extraction error:")));
});

test("browser global supports file-hosted scripts without a module loader", () => {
  const context = vm.createContext({ Intl });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/statement-contract.js"), "utf8"), context);
  assert.equal(context.ManimanStatement.FORMAT, "maniman.statement");
  const valid = vm.runInContext("ManimanStatement.validateStatementDocument(" + JSON.stringify(fixture()) + ")", context);
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));
});
