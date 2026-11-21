(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ManimanStatement = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT = "maniman.statement";
  const VERSION = "1.0";
  const MAX_TRANSACTIONS = 100000;
  const supportedCurrencies = typeof Intl.supportedValuesOf === "function"
    ? new Set(Intl.supportedValuesOf("currency")) : null;
  const fallbackCurrencies = new Set(["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "CHF", "CNY", "HKD", "NZD", "AED", "SAR", "KRW", "BHD", "KWD", "OMR"]);
  const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
  const nonempty = (v, max = 512) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  const integer = (v) => Number.isSafeInteger(v);
  const own = (v, key) => Object.prototype.hasOwnProperty.call(v, key);

  function currencyExponent(currency) {
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)
      || !(supportedCurrencies || fallbackCurrencies).has(currency)) {
      throw new RangeError("Unsupported currency code");
    }
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
    const date = new Date(value + "T00:00:00.000Z");
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function isStatementDocument(value) {
    return record(value) && value.format === FORMAT;
  }

  function validateStatementDocument(value) {
    const errors = [];
    const warnings = [];
    const error = (path, code, message) => errors.push({ path, code, message });
    const warn = (path, code, message) => warnings.push({ path, code, message });
    const enumeration = (v, choices, path) => {
      if (!choices.includes(v)) error(path, "invalid_value", "Expected one of: " + choices.join(", "));
    };
    const string = (v, path, max = 512) => {
      if (!nonempty(v, max)) error(path, "invalid_string", "Expected a non-empty string of at most " + max + " characters");
    };
    const optionalString = (v, path, max = 512) => {
      if (v !== null && v !== undefined) string(v, path, max);
    };
    const date = (v, path, optional = false) => {
      if (optional && (v === null || v === undefined)) return;
      if (!validDate(v)) error(path, "invalid_date", "Expected a valid calendar date in YYYY-MM-DD format");
    };
    const money = (v, path, positive = false) => {
      if (!integer(v) || (positive && v <= 0)) error(path, "invalid_amount", "Expected " + (positive ? "a positive " : "a ") + "safe integer in minor currency units");
    };
    const currency = (v, path) => {
      try { currencyExponent(v); } catch (_) { error(path, "invalid_currency", "Expected a supported uppercase ISO currency code"); }
    };
    const location = (v, path, required) => {
      if (v === null || v === undefined) {
        if (required) error(path, "missing_source_location", "A source page/row location is required");
        return;
      }
      if (!record(v)) return error(path, "invalid_object", "Expected a source-location object");
      if (!integer(v.page) || v.page < 1) error(path + ".page", "invalid_page", "Expected a positive page number");
      if (own(v, "row") && (!integer(v.row) || v.row < 1)) error(path + ".row", "invalid_row", "Expected a positive row number");
      if (record(value.source) && integer(value.source.pageCount) && integer(v.page) && v.page > value.source.pageCount) {
        error(path + ".page", "page_out_of_range", "Source page exceeds the document page count");
      }
      if (own(v, "text")) string(v.text, path + ".text", 16000);
    };
    const issues = (v, path) => {
      if (!Array.isArray(v)) return error(path, "invalid_array", "Expected an issues array");
      if (v.length > 10000) return error(path, "too_many_issues", "Too many extraction issues");
      v.forEach((issue, i) => {
        const p = path + "[" + i + "]";
        if (!record(issue)) return error(p, "invalid_object", "Expected an issue object");
        string(issue.code, p + ".code", 128);
        string(issue.message, p + ".message", 4000);
        if (issue.severity !== undefined) enumeration(issue.severity, ["info", "warning", "error"], p + ".severity");
        if (issue.path !== undefined) string(issue.path, p + ".path", 1024);
        warn(p, "source_issue", (issue.severity === "error" ? "Unresolved extraction error: " : "Source issue: ") + (typeof issue.message === "string" ? issue.message.slice(0, 4000) : "review required"));
      });
    };

    if (!record(value)) {
      error("$", "invalid_document", "Expected a statement JSON object");
      return { valid: false, errors, warnings };
    }
    if (value.format !== FORMAT) error("$.format", "wrong_format", "Expected maniman.statement; this importer does not restore application backups");
    if (value.schemaVersion !== VERSION) error("$.schemaVersion", "unsupported_version", "Only statement schema 1.0 is supported");
    const rootKeys = new Set(["format", "schemaVersion", "source", "institution", "statements", "issues"]);
    Object.keys(value).forEach((key) => { if (!rootKeys.has(key)) error("$." + key, "unknown_field", "Unexpected statement-envelope field"); });

    if (!record(value.source)) error("$.source", "invalid_object", "Expected source metadata");
    else {
      const s = value.source;
      ["documentId", "converter", "converterVersion", "profile"].forEach((key) => string(s[key], "$.source." + key));
      optionalString(s.documentFingerprint, "$.source.documentFingerprint", 256);
      if (!s.documentFingerprint) warn("$.source.documentFingerprint", "missing_document_fingerprint", "Document fingerprint is unavailable; import identity needs review");
      enumeration(s.extractionMethod, ["pdf_text", "local_ocr", "ocr", "mixed", "text_input", "manual", "structured_data", "unknown"], "$.source.extractionMethod");
      if (!integer(s.pageCount) || s.pageCount < 1 || s.pageCount > 10000) error("$.source.pageCount", "invalid_page_count", "Expected 1–10000 source pages");
      if (s.synthetic !== undefined && typeof s.synthetic !== "boolean") error("$.source.synthetic", "invalid_boolean", "Expected a boolean");
    }

    if (!record(value.institution)) error("$.institution", "invalid_object", "Expected institution metadata; use null fields for unknown details");
    else {
      const bank = value.institution;
      optionalString(bank.name, "$.institution.name", 200);
      optionalString(bank.code, "$.institution.code", 128);
      if (!bank.name && !bank.code) warn("$.institution", "unknown_institution", "Select or confirm the institution during import");
      if (bank.country !== null && bank.country !== undefined && (typeof bank.country !== "string" || !/^[A-Z]{2}$/.test(bank.country))) error("$.institution.country", "invalid_country", "Expected an uppercase two-letter country code or null");
      enumeration(bank.status, ["extracted", "unknown", "user_confirmed"], "$.institution.status");
      location(bank.evidence, "$.institution.evidence", false);
      if (bank.status === "extracted" && !bank.evidence) warn("$.institution.evidence", "missing_institution_evidence", "Extracted institution metadata has no source evidence");
    }
    issues(value.issues, "$.issues");
    if (!Array.isArray(value.statements) || value.statements.length === 0 || value.statements.length > 1000) {
      error("$.statements", "invalid_statements", "Expected 1–1000 account statement sections");
      return { valid: false, errors, warnings };
    }
    const statementIds = new Set();
    const observationIds = new Set();
    let totalTransactions = 0;
    value.statements.forEach((statement, index) => {
      const p = "$.statements[" + index + "]";
      if (!record(statement)) return error(p, "invalid_object", "Expected an account statement section");
      string(statement.statementId, p + ".statementId");
      if (nonempty(statement.statementId)) {
        if (statementIds.has(statement.statementId)) error(p + ".statementId", "duplicate_statement_id", "Statement IDs must be unique within a document");
        statementIds.add(statement.statementId);
      }
      enumeration(statement.sourceKind, ["bank_statement", "card_statement", "wallet_statement", "payment_app_statement", "other", "unknown"], p + ".sourceKind");
      const account = statement.account;
      if (!record(account)) error(p + ".account", "invalid_object", "Expected account metadata");
      else {
        optionalString(account.kind, p + ".account.kind", 80);
        optionalString(account.maskedIdentifier, p + ".account.maskedIdentifier", 128);
        if (account.currency === null || account.currency === undefined) warn(p + ".account.currency", "unknown_currency", "Account currency was not identified; confirm it before importing transactions");
        else currency(account.currency, p + ".account.currency");
        if (!account.kind || account.kind === "unknown") warn(p + ".account.kind", "unknown_account_kind", "Confirm the account kind during import");
        if (!account.maskedIdentifier) warn(p + ".account.maskedIdentifier", "unknown_account_identity", "Select an account during import; no account identifier was extracted");
        if (account.maskedIdentifier && /^\d[\d\s-]{6,}$/.test(account.maskedIdentifier)) error(p + ".account.maskedIdentifier", "unmasked_identifier", "Mask account/card identifiers before exporting");
      }

      const period = statement.period;
      if (!record(period)) error(p + ".period", "invalid_object", "Expected declared statement-period metadata");
      else {
        enumeration(period.status, ["extracted", "unknown", "user_confirmed"], p + ".period.status");
        date(period.start, p + ".period.start", true);
        date(period.end, p + ".period.end", true);
        if (validDate(period.start) && validDate(period.end) && period.start > period.end) error(p + ".period", "reversed_period", "Statement start cannot be after statement end");
        if (!period.start || !period.end || period.status === "unknown") warn(p + ".period", "unknown_coverage", "Statement coverage is unconfirmed; transaction dates do not prove coverage");
        if ((period.start === null) !== (period.end === null)) warn(p + ".period", "partial_period", "Only one statement boundary is available");
        location(period.evidence, p + ".period.evidence", false);
        if (period.status === "extracted" && !period.evidence) warn(p + ".period.evidence", "missing_period_evidence", "Extracted coverage has no source evidence and must be confirmed");
      }
      if (statement.observedTransactionRange !== undefined && statement.observedTransactionRange !== null) {
        const range = statement.observedTransactionRange;
        if (!record(range)) error(p + ".observedTransactionRange", "invalid_object", "Expected observed-date boundaries");
        else {
          date(range.start, p + ".observedTransactionRange.start", true);
          date(range.end, p + ".observedTransactionRange.end", true);
        }
      }

      const extraction = statement.extraction;
      if (!record(extraction)) error(p + ".extraction", "invalid_object", "Expected extraction status and row accounting");
      else {
        enumeration(extraction.status, ["complete", "partial", "failed"], p + ".extraction.status");
        if (extraction.status !== "complete") warn(p + ".extraction.status", "incomplete_extraction", "Extraction is incomplete; do not certify complete coverage");
        if (!integer(extraction.transactionRowCount) || extraction.transactionRowCount < 0) error(p + ".extraction.transactionRowCount", "invalid_row_count", "Expected a non-negative safe integer");
        if (!Array.isArray(extraction.excludedRows)) error(p + ".extraction.excludedRows", "invalid_array", "Expected excluded transaction rows with reasons");
        else extraction.excludedRows.forEach((row, i) => {
          const ep = p + ".extraction.excludedRows[" + i + "]";
          if (!record(row)) return error(ep, "invalid_object", "Expected an excluded-row object");
          string(row.reason, ep + ".reason", 4000);
          if (row.sourceLocation !== undefined) location(row.sourceLocation, ep + ".sourceLocation", true);
          warn(ep, "excluded_transaction_row", "A candidate transaction row was excluded and requires review");
        });
        if (extraction.status === "complete" && Array.isArray(extraction.excludedRows) && extraction.excludedRows.length) {
          error(p + ".extraction.status", "inconsistent_extraction_status", "An extraction with excluded candidate transaction rows cannot be complete");
        }
        issues(extraction.issues, p + ".extraction.issues");
      }
      if (!Array.isArray(statement.transactions) || statement.transactions.length > MAX_TRANSACTIONS) {
        error(p + ".transactions", "invalid_transactions", "Expected an array of at most " + MAX_TRANSACTIONS + " transaction observations");
        return;
      }
      totalTransactions += statement.transactions.length;
      if (totalTransactions > MAX_TRANSACTIONS) { error(p + ".transactions", "too_many_transactions", "Document exceeds the transaction limit"); return; }
      if (record(extraction) && Array.isArray(extraction.excludedRows)
        && extraction.transactionRowCount !== statement.transactions.length + extraction.excludedRows.length) {
        error(p + ".extraction.transactionRowCount", "row_count_mismatch", "Candidate row count must equal transactions plus explicitly excluded rows");
      }
      const transactionDates = [];
      const sourceTransactionIds = new Set();
      statement.transactions.forEach((tx, ti) => {
        const tp = p + ".transactions[" + ti + "]";
        if (!record(tx)) return error(tp, "invalid_object", "Expected a transaction observation");
        string(tx.observationId, tp + ".observationId");
        if (nonempty(tx.observationId)) {
          if (observationIds.has(tx.observationId)) error(tp + ".observationId", "duplicate_observation_id", "Observation IDs must be unique within the document");
          observationIds.add(tx.observationId);
        }
        optionalString(tx.sourceTransactionId, tp + ".sourceTransactionId");
        if (nonempty(tx.sourceTransactionId)) {
          if (sourceTransactionIds.has(tx.sourceTransactionId)) warn(tp + ".sourceTransactionId", "repeated_source_transaction_id", "Source transaction ID repeats; reference namespaces may require review");
          sourceTransactionIds.add(tx.sourceTransactionId);
        }
        date(tx.transactionDate, tp + ".transactionDate");
        date(tx.postingDate, tp + ".postingDate", true);
        date(tx.valueDate, tp + ".valueDate", true);
        if (validDate(tx.transactionDate)) transactionDates.push(tx.transactionDate);
        string(tx.description, tp + ".description", 16000);
        enumeration(tx.direction, ["debit", "credit"], tp + ".direction");
        money(tx.amountMinor, tp + ".amountMinor", true);
        currency(tx.currency, tp + ".currency");
        if (record(account) && account.currency && tx.currency !== account.currency) error(tp + ".currency", "currency_mismatch", "Posting currency must match the statement account; preserve foreign purchase details separately");
        if (tx.runningBalanceMinor !== null && tx.runningBalanceMinor !== undefined) money(tx.runningBalanceMinor, tp + ".runningBalanceMinor");
        if (!Array.isArray(tx.references)) error(tp + ".references", "invalid_array", "Expected a references array");
        else tx.references.forEach((ref, ri) => {
          const rp = tp + ".references[" + ri + "]";
          if (!record(ref)) return error(rp, "invalid_object", "Expected a reference object");
          string(ref.type, rp + ".type", 80);
          string(ref.value, rp + ".value", 512);
        });
        if (tx.hints !== undefined && !record(tx.hints)) error(tp + ".hints", "invalid_object", "Expected optional extraction hints");
        else if (record(tx.hints)) ["paymentRail", "transactionApp", "counterparty"].forEach((key) => optionalString(tx.hints[key], tp + ".hints." + key, 512));
        location(tx.sourceLocation, tp + ".sourceLocation", true);
        issues(tx.issues, tp + ".issues");
        if (record(period) && validDate(period.start) && validDate(period.end)) {
          const effectiveDate = validDate(tx.postingDate) ? tx.postingDate : tx.transactionDate;
          if (validDate(effectiveDate) && (effectiveDate < period.start || effectiveDate > period.end)) warn(tp, "outside_statement_period", "Observation posting/transaction date is outside declared coverage; review boundary handling");
        }
      });

      if (record(statement.observedTransactionRange) && transactionDates.length) {
        const start = transactionDates.reduce((a, b) => a < b ? a : b);
        const end = transactionDates.reduce((a, b) => a > b ? a : b);
        if (statement.observedTransactionRange.start !== start || statement.observedTransactionRange.end !== end) {
          error(p + ".observedTransactionRange", "observed_range_mismatch", "Observed bounds must match extracted transaction dates and are separate from declared coverage");
        }
      }
      const balances = statement.balances;
      if (balances !== undefined && balances !== null) {
        if (!record(balances)) error(p + ".balances", "invalid_object", "Expected optional balance metadata");
        else {
          enumeration(balances.signConvention, ["positive_asset_balance", "positive_liability_balance", "signed_balance", "unknown"], p + ".balances.signConvention");
          ["opening", "closing"].forEach((key) => {
            const balance = balances[key];
            if (balance === null || balance === undefined) return;
            const bp = p + ".balances." + key;
            if (!record(balance)) return error(bp, "invalid_object", "Expected a dated balance checkpoint");
            date(balance.date, bp + ".date");
            money(balance.amountMinor, bp + ".amountMinor");
            enumeration(balance.position, ["start", "end"], bp + ".position");
          });
          const opening = balances.opening;
          const closing = balances.closing;
          const eligible = record(extraction) && extraction.status === "complete" && Array.isArray(extraction.excludedRows) && extraction.excludedRows.length === 0
            && record(period) && period.status !== "unknown" && validDate(period.start) && validDate(period.end)
            && record(opening) && record(closing) && integer(opening.amountMinor) && integer(closing.amountMinor)
            && opening.date === period.start && opening.position === "start" && closing.date === period.end && closing.position === "end"
            && ["positive_asset_balance", "positive_liability_balance", "signed_balance"].includes(balances.signConvention)
            && statement.transactions.every((tx) => {
              if (!record(tx) || !integer(tx.amountMinor) || tx.amountMinor <= 0 || !["credit", "debit"].includes(tx.direction)) return false;
              const effectiveDate = validDate(tx.postingDate) ? tx.postingDate : tx.transactionDate;
              return validDate(effectiveDate) && effectiveDate >= period.start && effectiveDate <= period.end;
            });
          if (eligible) {
            const polarity = balances.signConvention === "positive_liability_balance" ? -1n : 1n;
            const movement = statement.transactions.reduce((sum, tx) => sum + BigInt(tx.amountMinor) * (tx.direction === "credit" ? 1n : -1n) * polarity, 0n);
            if (BigInt(opening.amountMinor) + movement !== BigInt(closing.amountMinor)) error(p + ".balances", "balance_mismatch", "Opening balance plus extracted movements does not equal closing balance");
          } else if (record(opening) && record(closing)) warn(p + ".balances", "balance_not_verified", "Balance arithmetic cannot certify an incomplete or differently bounded extraction");
        }
      }
    });
    return { valid: errors.length === 0, errors, warnings };
  }

  return Object.freeze({ FORMAT, VERSION, isStatementDocument, validateStatementDocument, currencyExponent });
});
