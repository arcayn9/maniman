const APP_NAME = "Maniman";
const STORAGE_KEY = "maniman-local-v2";
const LEGACY_STORAGE_KEYS = ["pocket-pilot-local-v2", "pocket-pilot-local-v1"];
const API_STATE_URL = "/api/state";
const SUPABASE_TABLE = "app_states";

const DEFAULT_ACCOUNT_CATEGORIES = [
  { id: "acctcat_savings", name: "Savings Account", kind: "payment", color: "#0f766e" },
  { id: "acctcat_credit", name: "Credit Card", kind: "payment", color: "#b63a2d" },
  { id: "acctcat_wallet", name: "Wallet/Top Up", kind: "payment", color: "#cc8b13" },
  { id: "acctcat_cash", name: "Cash", kind: "payment", color: "#5c7d2b" },
  { id: "acctcat_fd", name: "FD", kind: "asset", color: "#4d69c8" },
  { id: "acctcat_rd", name: "RD", kind: "asset", color: "#7a5ab7" },
  { id: "acctcat_stocks", name: "Stocks", kind: "asset", color: "#c05c91" },
  { id: "acctcat_mutual_funds", name: "Mutual Funds", kind: "asset", color: "#0e8a9a" }
];

const DEFAULT_TRANSACTION_CATEGORIES = [
  { id: "cat_food", type: "expense", name: "Food", color: "#d45f4c", keywords: ["coffee", "lunch", "dinner", "food", "restaurant", "snack", "cafe"] },
  { id: "cat_groceries", type: "expense", name: "Groceries", color: "#239a6b", keywords: ["grocery", "groceries", "market", "milk", "vegetables", "fruit"] },
  { id: "cat_transport", type: "expense", name: "Transport", color: "#4d69c8", keywords: ["uber", "taxi", "fuel", "gas", "metro", "bus", "train", "parking"] },
  { id: "cat_home", type: "expense", name: "Home", color: "#7a5ab7", keywords: ["rent", "repair", "home", "furniture", "cleaning"] },
  { id: "cat_bills", type: "expense", name: "Bills", color: "#cc8b13", keywords: ["bill", "electric", "water", "internet", "phone", "subscription", "netflix"] },
  { id: "cat_shopping", type: "expense", name: "Shopping", color: "#c05c91", keywords: ["shopping", "clothes", "amazon", "store", "shoes"] },
  { id: "cat_health", type: "expense", name: "Health", color: "#0e8a9a", keywords: ["doctor", "medicine", "pharmacy", "health", "gym"] },
  { id: "cat_travel", type: "expense", name: "Travel", color: "#d17431", keywords: ["flight", "hotel", "trip", "travel"] },
  { id: "cat_entertainment", type: "expense", name: "Entertainment", color: "#5c7d2b", keywords: ["movie", "game", "concert", "music", "book"] },
  { id: "cat_other_expense", type: "expense", name: "Other", color: "#6b7280", keywords: [] },
  { id: "cat_salary", type: "income", name: "Salary", color: "#239a6b", keywords: ["salary", "paycheck", "payroll", "wage"] },
  { id: "cat_freelance", type: "income", name: "Freelance", color: "#0f766e", keywords: ["client", "freelance", "invoice", "project"] },
  { id: "cat_gift", type: "income", name: "Gift", color: "#7a5ab7", keywords: ["gift", "bonus"] },
  { id: "cat_refund", type: "income", name: "Refund", color: "#4d69c8", keywords: ["refund", "reimburse", "cashback"] },
  { id: "cat_interest", type: "income", name: "Interest", color: "#cc8b13", keywords: ["interest", "dividend"] },
  { id: "cat_other_income", type: "income", name: "Other", color: "#6b7280", keywords: [] }
];

const DEFAULT_TAGS = [
  { id: "tag_food", name: "food", color: "#d45f4c", keywords: ["coffee", "lunch", "dinner", "restaurant", "cafe", "snack"] },
  { id: "tag_commute", name: "commute", color: "#4d69c8", keywords: ["uber", "taxi", "metro", "bus", "train", "fuel", "parking"] },
  { id: "tag_household", name: "household", color: "#7a5ab7", keywords: ["rent", "grocery", "home", "cleaning", "electric", "water"] },
  { id: "tag_subscription", name: "subscription", color: "#cc8b13", keywords: ["subscription", "netflix", "spotify", "prime", "internet", "phone"] },
  { id: "tag_health", name: "health", color: "#0e8a9a", keywords: ["doctor", "medicine", "pharmacy", "gym", "health"] },
  { id: "tag_investment", name: "investment", color: "#239a6b", keywords: ["fd", "rd", "stocks", "mutual", "sip", "fund", "investment"] },
  { id: "tag_travel", name: "travel", color: "#d17431", keywords: ["flight", "hotel", "trip", "travel"] }
];

const STATEMENT_FIELD_ALIASES = {
  date: ["date", "transactionDate", "txnDate", "valueDate", "posted", "postingDate", "transaction date", "txn date"],
  description: ["description", "name", "memo", "narration", "remarks", "particulars", "details", "transaction details"],
  amount: ["amount", "value", "transactionAmount", "transaction amount"],
  debit: ["debit", "withdrawal", "withdrawals", "debitAmount", "withdrawalAmount", "dr", "paidOut", "debit amt"],
  credit: ["credit", "deposit", "deposits", "creditAmount", "depositAmount", "cr", "paidIn", "credit amt"],
  balance: ["balance", "closingBalance", "runningBalance", "availableBalance", "ledgerBalance", "closing balance"],
  type: ["type", "transactionType", "drCr", "debitCredit", "crdr", "transaction type"],
  account: ["account", "accountId", "walletId", "fromAccount", "from_account", "from"],
  toAccount: ["toAccount", "toAccountId", "to_account", "to"],
  category: ["category"],
  tags: ["tags", "tag"],
  note: ["note", "notes"]
};

let state;
let activeView = "dashboard";
let editingTransactionId = null;
let selectedActivityAccountId = "";
let storageMode = "local";
let syncStatus = "browser-only";
let secureServerRevision = 0;
let secureRemoteConflict = false;
let secureInactivityTimer = null;
let pendingStatementImport = null;
let secureAuthEpoch = 0;
let secureServerSyncQueue = Promise.resolve();
let vaultOperationDepth = 0;

const cloud = {
  configured: false,
  client: null,
  user: null,
  revision: null,
  saving: false,
  pendingSave: false,
  lastError: ""
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => init().catch((error) => {
  const root = document.querySelector("#viewRoot");
  if (root) root.textContent = `${error?.message || "Maniman could not open encrypted storage. Use HTTPS or localhost with Web Crypto and IndexedDB support."} Existing data has not been replaced.`;
}));

async function init() {
  dom.viewRoot = document.querySelector("#viewRoot");
  dom.monthPicker = document.querySelector("#monthPicker");
  dom.currencySelect = document.querySelector("#currencySelect");
  dom.mobileCurrencySelect = document.querySelector("#mobileCurrencySelect");
  dom.exportBtn = document.querySelector("#exportBtn");
  dom.mobileExportBtn = document.querySelector("#mobileExportBtn");
  dom.importFile = document.querySelector("#importFile");
  dom.mobileImportFile = document.querySelector("#mobileImportFile");
  dom.toast = document.querySelector("#toast");
  dom.navItems = Array.from(document.querySelectorAll(".nav-item"));
  dom.localBadge = document.querySelector(".local-badge");

  await initCloudClient();
  state = await loadState();
  bindVaultControls();
  activeView = state.settings.lastView === "wallets" ? "accounts" : state.settings.lastView || "dashboard";
  selectedActivityAccountId = state.accounts[0]?.id || "";

  dom.navItems.forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      state.settings.lastView = activeView;
      editingTransactionId = null;
      saveState();
      render();
    });
  });

  document.querySelectorAll(".topbar [data-jump-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.jumpView;
      state.settings.lastView = activeView;
      saveState();
      render();
    });
  });

  dom.monthPicker.addEventListener("change", (event) => {
    state.settings.selectedMonth = event.target.value || getCurrentMonth();
    saveState();
    render();
  });

  dom.currencySelect.addEventListener("change", (event) => {
    setDisplayCurrency(event.target.value);
  });
  dom.mobileCurrencySelect.addEventListener("change", (event) => {
    setDisplayCurrency(event.target.value);
  });

  dom.exportBtn.addEventListener("click", exportData);
  dom.mobileExportBtn.addEventListener("click", exportData);
  dom.importFile.addEventListener("change", importData);
  dom.mobileImportFile.addEventListener("change", importData);

  registerServiceWorker();
  render();
}

function emptyVaultState() {
  const blank = createStarterState();
  blank.settings.currency = "INR";
  blank.accounts = [{ id: uid("account"), name: "Main account", categoryId: "acctcat_savings", openingBalance: 0, openingBalanceDate: "", balanceCheckpoints: [], color: "#0f766e", currency: "INR" }];
  for (const collection of ["transactions", "budgets", "goals", "bills"]) blank[collection] = [];
  return normalizeState(blank);
}

function currencyPolicyErrors(value) {
  const currency = value.settings?.currency || "USD";
  const errors = [];
  try { window.ManimanStatement.currencyExponent(currency); }
  catch (_) { return ["The vault currency is unsupported."]; }
  if ((value.transactions || []).some((tx) => tx.currency && tx.currency !== currency)) errors.push("Transaction currencies must match the vault currency. This release does not convert or aggregate multiple currencies.");
  if ((value.accounts || value.wallets || []).some((account) => account.currency && account.currency !== currency)) errors.push("Account currencies must match the vault currency. Use a separate vault for another currency in this release.");
  if ((value.statementObservations || []).some((observation) => observation.data?.currency && observation.data.currency !== currency)) errors.push("Statement evidence contains a different currency from this vault.");
  return errors;
}

function setDisplayCurrency(currency) {
  if (!state || !window.ManimanSecureStorage?.isUnlocked()) return false;
  try { window.ManimanStatement.currencyExponent(currency); }
  catch (_) { showToast("Choose a supported vault currency."); return false; }
  const previous = state.settings.currency;
  const hasMoney = state.transactions.length || state.accounts.some((account) => Number(account.openingBalance || 0) !== 0 || (account.balanceCheckpoints || []).length)
    || state.budgets.length || state.goals.length || state.bills.length || (state.statementObservations || []).length || (state.importBatches || []).length;
  if (currency !== previous && hasMoney) {
    showToast("Vault currency is fixed once financial data exists. Currency conversion is not available; use a separate vault for another currency.");
    if (dom.currencySelect) dom.currencySelect.value = previous;
    if (dom.mobileCurrencySelect) dom.mobileCurrencySelect.value = previous;
    const settings = document.querySelector("#settingsCurrency");
    if (settings) settings.value = previous;
    return false;
  }
  state.settings.currency = currency;
  state.accounts.forEach((account) => { account.currency = currency; });
  saveState();
  render();
  return true;
}

function captureVaultContext() {
  return { ownerId: cloud.user?.id || null, namespace: window.ManimanSecureStorage.namespace(), epoch: secureAuthEpoch };
}

function vaultContextMatches(context, unlocked = true) {
  return context.epoch === secureAuthEpoch && context.ownerId === (cloud.user?.id || null)
    && context.namespace === window.ManimanSecureStorage.namespace()
    && (!unlocked || window.ManimanSecureStorage.isUnlocked());
}

function validateBackupState(value) {
  const errors = [];
  const record = (item) => item !== null && typeof item === "object" && !Array.isArray(item);
  const string = (item) => typeof item === "string" && item.length <= 16000;
  const id = (item) => typeof item === "string" && item.length > 0 && item.length <= 4096 && !["__proto__", "prototype", "constructor"].includes(item);
  const token = (item) => typeof item === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(item) && !["__proto__", "prototype", "constructor"].includes(item);
  const date = (item) => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item) && !item.startsWith("0000") && Number.isFinite(Date.parse(`${item}T00:00:00Z`)) && new Date(`${item}T00:00:00Z`).toISOString().slice(0, 10) === item;
  const month = (item) => typeof item === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(item);
  const numeric = (item) => (typeof item === "number" || typeof item === "string" && item.trim() !== "") && Number.isFinite(Number(item));
  const fail = (path) => errors.push(`${path}: unsupported backup value`);
  const list = (item, path, visit, optional = true) => {
    if (item === undefined && optional) return;
    if (!Array.isArray(item) || item.length > 100000) { fail(path); return; }
    item.forEach((entry, index) => visit(entry, `${path}[${index}]`));
  };
  const ids = (item, path, check = id) => list(item, path, (entry, at) => { if (!check(entry)) fail(at); }, false);
  const optionalFields = (item, path, fields, check) => fields.forEach((field) => { if (item[field] !== undefined && item[field] !== null && !check(item[field])) fail(`${path}.${field}`); });
  const colors = (item, path) => optionalFields(item, path, ["color"], (color) => typeof color === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color));
  const issue = (item, path) => {
    if (!record(item) || !id(item.code) || !string(item.message)) return fail(path);
    if (item.severity !== undefined && !["info", "warning", "error"].includes(item.severity)) fail(`${path}.severity`);
  };
  const checkpoint = (item, path) => {
    if (!record(item) || !date(item.date) || !numeric(item.balance)) return fail(path);
    optionalFields(item, path, ["id", "importBatchId"], (entry) => entry === "" || token(entry));
    optionalFields(item, path, ["note", "source"], string);
    if (item.position !== undefined && !["start", "end"].includes(item.position)) fail(`${path}.position`);
    if (item.statementOwned !== undefined && typeof item.statementOwned !== "boolean") fail(`${path}.statementOwned`);
    if (item.statementBatchIds !== undefined) ids(item.statementBatchIds, `${path}.statementBatchIds`, token);
  };
  const period = (item, path) => {
    if (!record(item) || !date(item.start) || !date(item.end) || item.start > item.end) fail(path);
  };
  if (!record(value) || value.format !== undefined || !Array.isArray(value.transactions) || !Array.isArray(value.accounts || value.wallets)) {
    return { valid: false, errors: ["Choose a supported Maniman application backup."] };
  }
  if (value.version !== undefined && ![1, 2, 3, 4].includes(value.version)) fail("version");
  if (value.settings !== undefined && !record(value.settings)) fail("settings");
  if (record(value.settings)) {
    optionalFields(value.settings, "settings", ["currency", "lastView"], string);
    if (value.settings.lastView !== undefined && !["dashboard", "transactions", "imports", "budgets", "accounts", "stats", "goals", "bills", "settings", "guide", "wallets"].includes(value.settings.lastView)) fail("settings.lastView");
    if (value.settings.selectedMonth !== undefined && !month(value.settings.selectedMonth)) fail("settings.selectedMonth");
    optionalFields(value.settings, "settings", ["vaultAutoLockMinutes"], numeric);
  }
  const accountIds = new Set();
  list(value.accounts || value.wallets, "accounts", (account, path) => {
    if (!record(account)) return fail(path);
    optionalFields(account, path, ["id"], token);
    if (account.id && accountIds.has(account.id)) fail(`${path}.id`);
    if (account.id) accountIds.add(account.id);
    optionalFields(account, path, ["name", "categoryId", "institution", "kind", "maskedIdentifier", "currency", "type"], string);
    optionalFields(account, path, ["categoryId"], token);
    optionalFields(account, path, ["openingBalance"], numeric);
    if (account.openingBalanceDate && !date(account.openingBalanceDate)) fail(`${path}.openingBalanceDate`);
    colors(account, path);
    list(account.balanceCheckpoints, `${path}.balanceCheckpoints`, checkpoint);
  }, false);
  const transactionIds = new Set();
  list(value.transactions, "transactions", (tx, path) => {
    if (!record(tx) || !numeric(tx.amount) || Math.abs(Number(tx.amount)) <= 0) return fail(path);
    optionalFields(tx, path, ["id"], token);
    if (tx.id && transactionIds.has(tx.id)) fail(`${path}.id`);
    if (tx.id) transactionIds.add(tx.id);
    optionalFields(tx, path, ["description", "category", "accountId", "walletId", "toAccountId", "note", "currency", "classificationStatus", "paymentRail", "importBatchId"], string);
    optionalFields(tx, path, ["accountId", "walletId", "toAccountId", "billId", "importBatchId"], (entry) => entry === "" || token(entry));
    if (tx.date !== undefined && !date(tx.date)) fail(`${path}.date`);
    if (tx.type !== undefined && !["income", "expense", "transfer"].includes(tx.type)) fail(`${path}.type`);
    if (tx.amountMinor !== undefined && tx.amountMinor !== null && !Number.isSafeInteger(tx.amountMinor)) fail(`${path}.amountMinor`);
    if (tx.tags !== undefined && !(typeof tx.tags === "string" || Array.isArray(tx.tags) && tx.tags.every(string))) fail(`${path}.tags`);
    if (tx.statementEvidence !== undefined) ids(tx.statementEvidence, `${path}.statementEvidence`);
    if (tx.statementOrigin !== undefined && tx.statementOrigin !== null && (!record(tx.statementOrigin) || !token(tx.statementOrigin.importBatchId) || typeof tx.statementOrigin.snapshot !== "string" || tx.statementOrigin.snapshot.length > 128000)) fail(`${path}.statementOrigin`);
  }, false);
  for (const collection of ["accountCategories", "transactionCategories", "budgets", "goals", "bills"]) {
    list(value[collection], collection, (item, path) => {
      if (!record(item)) return fail(path);
      optionalFields(item, path, ["id", "name", "category", "categoryId", "accountId", "walletId", "type", "kind"], string);
      optionalFields(item, path, ["id", "categoryId", "accountId", "walletId"], token);
      optionalFields(item, path, ["limit", "target", "saved", "amount", "dueDay"], numeric);
      colors(item, path);
      if (item.dueDate && !date(item.dueDate)) fail(`${path}.dueDate`);
      if (item.keywords !== undefined && !(typeof item.keywords === "string" || Array.isArray(item.keywords) && item.keywords.every(string))) fail(`${path}.keywords`);
      if (item.paidMonths !== undefined) list(item.paidMonths, `${path}.paidMonths`, (entry, at) => { if (!month(entry)) fail(at); }, false);
    });
  }
  list(value.tags, "tags", (tag, path) => {
    if (typeof tag === "string") return;
    if (!record(tag)) return fail(path);
    optionalFields(tag, path, ["id", "name"], string); optionalFields(tag, path, ["id"], token); colors(tag, path);
    if (tag.keywords !== undefined && !(typeof tag.keywords === "string" || Array.isArray(tag.keywords) && tag.keywords.every(string))) fail(`${path}.keywords`);
  });
  list(value.statementMappings, "statementMappings", (mapping, path) => {
    if (!record(mapping) || !id(mapping.key) || !token(mapping.accountId)) return fail(path);
    optionalFields(mapping, path, ["confirmedAt"], string);
    optionalFields(mapping, path, ["importBatchId"], token);
  });
  list(value.statementObservations, "statementObservations", (observation, path) => {
    if (!record(observation)) return fail(path);
    for (const field of ["id", "documentId", "statementId", "accountId", "transactionId", "importBatchId"]) if (!id(observation[field])) fail(`${path}.${field}`);
    for (const field of ["accountId", "transactionId", "importBatchId"]) if (!token(observation[field])) fail(`${path}.${field}`);
    const row = observation.data;
    if (!record(row) || !id(row.observationId) || !date(row.transactionDate) || !string(row.description) || !Number.isSafeInteger(row.amountMinor) || row.amountMinor <= 0 || !["credit", "debit"].includes(row.direction)) return fail(`${path}.data`);
    optionalFields(row, `${path}.data`, ["postingDate", "valueDate"], date);
    try { window.ManimanStatement.currencyExponent(row.currency); } catch (_) { fail(`${path}.data.currency`); }
    if (!record(row.sourceLocation) || !Number.isInteger(row.sourceLocation.page) || row.sourceLocation.page < 1) fail(`${path}.data.sourceLocation`);
    list(row.references, `${path}.data.references`, (reference, at) => { if (!record(reference) || !id(reference.type) || !id(reference.value)) fail(at); }, false);
    list(row.issues, `${path}.data.issues`, issue, false);
  });
  list(value.importBatches, "importBatches", (batch, path) => {
    if (!record(batch) || !token(batch.id) || batch.kind !== "statement" || !string(batch.institution) || !string(batch.createdAt) || !Number.isFinite(Date.parse(batch.createdAt))) return fail(path);
    optionalFields(batch, path, ["documentId"], id);
    ids(batch.observationIds, `${path}.observationIds`);
    for (const field of ["createdTransactionIds", "createdAccountIds", "checkpointIds"]) ids(batch[field], `${path}.${field}`, token);
    if (!record(batch.transactionSnapshots) || !Object.values(batch.transactionSnapshots).every((snapshot) => typeof snapshot === "string" && snapshot.length <= 128000)) fail(`${path}.transactionSnapshots`);
    list(batch.statements, `${path}.statements`, (section, at) => {
      if (!record(section) || !id(section.statementId) || !token(section.accountId)) return fail(at);
      period(section.period, `${at}.period`);
      if (!record(section.account) || !record(section.extraction)) fail(at);
    }, false);
  });
  if (!errors.length) errors.push(...currencyPolicyErrors(value));
  return { valid: errors.length === 0, errors };
}

function prepareBackupState(value) {
  const validation = validateBackupState(value);
  if (!validation.valid) throw new Error(`Backup rejected before saving. ${validation.errors.slice(0, 3).join(" ")}`);
  return normalizeState(value);
}

async function loadState() {
  const secure = window.ManimanSecureStorage;
  if (!secure || !window.ManimanVaultAccess) throw new Error("Encrypted storage is unavailable.");
  const ownerId = cloud.user?.id || null;
  const epoch = secureAuthEpoch;
  const namespace = ownerId ? `user:${ownerId}` : "local";
  await secure.begin(namespace);
  const owner = { ownerId, epoch, namespace };
  if (!vaultContextMatches(owner, false)) throw new Error("Vault owner changed while opening storage. Reload to unlock the active account.");
  secureRemoteConflict = false;
  const remote = ownerId ? await loadStateFromCloud() : await loadStateFromApi();
  if (!vaultContextMatches(owner, false)) throw new Error("Vault owner changed while reading storage. Reload to unlock the active account.");
  const encryptedRemote = window.ManimanVault.isEnvelope(remote) ? remote : null;
  const recognizedLegacy = remote !== null && remote !== undefined && !remote.format && Array.isArray(remote.accounts || remote.wallets) && Array.isArray(remote.transactions);
  if (remote !== null && remote !== undefined && !encryptedRemote && !recognizedLegacy) {
    throw new Error("The existing remote vault is unreadable or uses an unsupported format. Preserve that copy and recover it before creating or syncing another vault.");
  }
  const localEnvelope = secure.getEnvelope();
  if (localEnvelope && encryptedRemote && stableStatementStringify(localEnvelope) !== stableStatementStringify(encryptedRemote)) {
    await secure.preserveConflict(encryptedRemote);
    secureRemoteConflict = true;
    syncStatus = "cloud-conflict";
    cloud.lastError = "Another encrypted snapshot exists. Your local vault is preserved. Export both copies before resolving this conflict.";
    cloud.conflictEnvelope = encryptedRemote;
  }
  const legacy = !localEnvelope && !encryptedRemote
    ? (recognizedLegacy ? remote : (!ownerId ? loadCachedState() : null))
    : null;
  const initialState = legacy ? prepareBackupState(legacy) : emptyVaultState();
  const opened = await window.ManimanVaultAccess.requestAccess({ initialState, remoteEnvelope: encryptedRemote, migration: !!legacy });
  if (!vaultContextMatches(owner)) throw new Error("Vault owner changed while unlocking. Reload to open the active account.");
  // Only remove browser plaintext after the encrypted copy and recovery exercise succeed.
  if (legacy && !ownerId) {
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) localStorage.removeItem(key);
  }
  return prepareBackupState(opened);
}

async function loadStateFromApi() {
  if (location.protocol === "file:") return null;
  let response;
  try {
    response = await fetch(`${API_STATE_URL}?ts=${Date.now()}`, { cache: "no-store" });
  } catch (_) { return null; }
  if (response.status === 422) throw new Error("The encrypted local-server file is unreadable or unsupported. Preserve it and recover it before creating another vault.");
  if (response.status >= 500) throw new Error("The local server could not read its storage. Do not assume the vault is empty; recover or reconnect before creating another copy.");
  if (!response.ok) return null;
  let payload;
  try { payload = await response.json(); }
  catch (_) { throw new Error("The local server returned unreadable storage data. No empty vault will replace it."); }
  if (!payload || typeof payload !== "object" || !Object.prototype.hasOwnProperty.call(payload, "state")) throw new Error("The local server returned an unsupported storage response.");
  storageMode = "server";
  syncStatus = "encrypted-local";
  secureServerRevision = window.ManimanVault.isEnvelope(payload.state) ? payload.state.revision : 0;
  return payload.state;
}

async function syncEncryptedState() {
  if (!window.ManimanSecureStorage?.isUnlocked() || secureRemoteConflict) return;
  if (storageMode === "cloud" && cloud.user) return saveStateToCloud();
  if (storageMode !== "server") return;
  const owner = captureVaultContext();
  const operation = secureServerSyncQueue.catch(() => {}).then(async () => {
    if (!vaultContextMatches(owner) || secureRemoteConflict || storageMode !== "server") return;
    try {
      await window.ManimanSecureStorage.flush();
      if (!vaultContextMatches(owner) || secureRemoteConflict || storageMode !== "server") return;
      const envelope = window.ManimanSecureStorage.getEnvelope();
      const response = await fetch(API_STATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: envelope, expectedRevision: secureServerRevision }) });
      if (!vaultContextMatches(owner)) return;
      if (!response.ok) {
        if (response.status === 409) { secureRemoteConflict = true; syncStatus = "cloud-conflict"; }
        else syncStatus = "unsynced";
        throw new Error("Encrypted server save failed. The browser vault remains available.");
      }
      secureServerRevision = envelope.revision;
      syncStatus = "encrypted-local";
    } catch (_) {
      if (vaultContextMatches(owner)) showToast("Encrypted server copy was not saved. Your encrypted browser vault is preserved; retry after reconnecting.");
    }
    if (vaultContextMatches(owner)) updateStorageBadge();
  });
  secureServerSyncQueue = operation;
  return operation;
}

function saveState() {
  if (!state || !window.ManimanSecureStorage?.isUnlocked()) {
    showToast("Unlock your vault before saving changes.");
    return Promise.resolve(false);
  }
  return window.ManimanSecureStorage.save(state).then(async () => {
    await syncEncryptedState();
    return true;
  }).catch(() => {
    syncStatus = "unsynced";
    showToast("Encrypted save failed. Keep this tab open and retry; no plaintext fallback was written.");
    updateStorageBadge();
    return false;
  });
}

function bindVaultControls() {
  const lock = async () => {
    try { await window.ManimanSecureStorage.flush(); }
    catch (_) { showToast("Save failed. Keep this tab open and retry before locking."); return; }
    window.ManimanSecureStorage.lock();
    window.dispatchEvent(new Event("maniman-vault-locked"));
    state = null;
    document.querySelector("#viewRoot")?.replaceChildren();
    location.reload();
  };
  document.querySelector("#vaultLockBtn")?.addEventListener("click", lock);
  document.querySelector("#mobileVaultLockBtn")?.addEventListener("click", lock);
  const resetTimer = () => {
    clearTimeout(secureInactivityTimer);
    const minutes = Number(state?.settings?.vaultAutoLockMinutes || 15);
    secureInactivityTimer = setTimeout(lock, Math.max(1, Math.min(120, minutes)) * 60000);
  };
  for (const event of ["pointerdown", "keydown"]) document.addEventListener(event, resetTimer, { passive: true });
  resetTimer();
}

async function initCloudClient() {
  const config = window.MANIMAN_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").trim();
  const supabaseAnonKey = String(config.supabaseAnonKey || "").trim();
  if (!supabaseUrl || !supabaseAnonKey || !window.supabase?.createClient) return;

  cloud.configured = true;
  cloud.client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  const { data } = await cloud.client.auth.getSession();
  cloud.user = data?.session?.user || null;

  cloud.client.auth.onAuthStateChange((_event, session) => {
    const previousUser = cloud.user?.id || null;
    cloud.user = session?.user || null;
    if (previousUser === (cloud.user?.id || null)) return;
    // Invalidate decrypted state immediately; queued work must never cross owners.
    secureAuthEpoch += 1;
    clearTimeout(secureInactivityTimer);
    window.ManimanSecureStorage?.lock();
    window.dispatchEvent(new Event("maniman-vault-locked"));
    clearStatementImport();
    state = null;
    cloud.pendingSave = false;
    document.querySelector("#viewRoot")?.replaceChildren();
    const shell = document.querySelector(".shell");
    if (shell) shell.inert = true;
    // Auth callbacks must not await calls back into the auth client.
    setTimeout(() => location.reload(), 0);
  });
}

async function loadStateFromCloud() {
  if (!cloud.client || !cloud.user) return null;
  const ownerId = cloud.user.id;
  const epoch = secureAuthEpoch;
  storageMode = "cloud";
  try {
    const { data, error } = await cloud.client.from(SUPABASE_TABLE).select("state, revision").eq("user_id", ownerId).maybeSingle();
    if (epoch !== secureAuthEpoch || ownerId !== cloud.user?.id) throw new Error("Vault owner changed.");
    if (error) throw error;
    if (data && (data.state === null || data.state === undefined)) {
      throw Object.assign(new Error("The existing cloud row has no readable vault. Preserve that row and recover it before creating another copy."), { preserveVault: true });
    }
    syncStatus = "synced";
    cloud.revision = Number(data?.revision || 0);
    return data?.state ?? null;
  } catch (error) {
    if (epoch !== secureAuthEpoch || ownerId !== cloud.user?.id) throw new Error("Vault owner changed while reading cloud storage.");
    if (error.preserveVault) throw error;
    cloud.lastError = "Cloud is unavailable. The encrypted browser vault remains available; reconnect before syncing.";
    syncStatus = "cloud-unavailable";
    return null;
  }
}

function loadCachedState() {
  const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (_) { throw new Error("Existing browser data is unreadable. Preserve that copy before creating a new vault."); }
}

async function saveStateToCloud() {
  if (!cloud.client || !cloud.user || secureRemoteConflict || !window.ManimanSecureStorage?.isUnlocked()) return;
  const owner = captureVaultContext();
  const client = cloud.client;
  if (owner.namespace !== `user:${owner.ownerId}`) return;
  if (cloud.saving) { cloud.pendingSave = true; return; }
  cloud.saving = true;
  cloud.pendingSave = false;
  syncStatus = "syncing";
  updateStorageBadge();
  try {
    await window.ManimanSecureStorage.flush();
    if (!vaultContextMatches(owner)) return;
    const currentRevision = Number(cloud.revision || 0);
    const payload = { user_id: owner.ownerId, state: window.ManimanSecureStorage.getEnvelope(), revision: currentRevision + 1, updated_at: new Date().toISOString() };
    const query = currentRevision === 0
      ? client.from(SUPABASE_TABLE).insert(payload)
      : client.from(SUPABASE_TABLE).update(payload).eq("user_id", owner.ownerId).eq("revision", currentRevision);
    const { data, error } = await query.select("revision").maybeSingle();
    if (!vaultContextMatches(owner)) return;
    if (error && error.code !== "23505") throw new Error("Encrypted cloud save failed.");
    if (error?.code === "23505" || !data) {
      secureRemoteConflict = true;
      syncStatus = "cloud-conflict";
      cloud.lastError = "Cloud save was rejected or another device changed the vault. Local work is preserved; export it before resolving.";
      showToast(cloud.lastError);
      return;
    }
    cloud.revision = Number(data.revision);
    syncStatus = "synced";
    cloud.lastError = "";
  } catch (_) {
    if (!vaultContextMatches(owner)) return;
    cloud.lastError = "Encrypted cloud save failed. Local encrypted changes are preserved.";
    syncStatus = "unsynced";
    showToast(cloud.lastError);
  } finally {
    cloud.saving = false;
    if (vaultContextMatches(owner)) {
      updateStorageBadge();
      if (cloud.pendingSave && !secureRemoteConflict && syncStatus === "synced") { cloud.pendingSave = false; saveStateToCloud(); }
    }
  }
}

async function signInToCloud(email, password) {
  if (!cloud.client) {
    showToast("Add Supabase config before using cloud sync.");
    return;
  }
  const { error } = await cloud.client.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message || "Could not sign in.");
    return;
  }
  showToast("Signed in. Cloud sync is ready.");
}

async function signUpForCloud(email, password) {
  if (!cloud.client) {
    showToast("Add Supabase config before using cloud sync.");
    return;
  }
  const { error } = await cloud.client.auth.signUp({ email, password });
  if (error) {
    showToast(error.message || "Could not create account.");
    return;
  }
  showToast("Account created. Check email if confirmation is enabled.");
}

async function signOutOfCloud() {
  if (!cloud.client) return;
  await window.ManimanSecureStorage.flush();
  const { error } = await cloud.client.auth.signOut();
  if (error) showToast("Could not sign out. Your encrypted local vault is preserved.");
}

function normalizeState(value = {}) {
  const starter = createStarterState();
  const accountCategories = normalizeAccountCategories(value.accountCategories || starter.accountCategories);
  const legacyWallets = Array.isArray(value.wallets) ? value.wallets : null;
  const accounts = normalizeAccounts(value.accounts || legacyWallets || starter.accounts, accountCategories);
  const transactions = normalizeTransactions(value.transactions || starter.transactions, accounts);

  const next = {
    version: 4,
    settings: { ...starter.settings, ...(value.settings || {}) },
    accountCategories,
    accounts,
    transactions,
    transactionCategories: normalizeTransactionCategories(value.transactionCategories || starter.transactionCategories),
    tags: normalizeTags(value.tags || starter.tags),
    budgets: Array.isArray(value.budgets) ? value.budgets : starter.budgets,
    goals: Array.isArray(value.goals) ? value.goals : starter.goals,
    bills: Array.isArray(value.bills) ? value.bills : starter.bills,
    statementObservations: Array.isArray(value.statementObservations) ? value.statementObservations : [],
    importBatches: Array.isArray(value.importBatches) ? value.importBatches : [],
    statementMappings: Array.isArray(value.statementMappings) ? value.statementMappings : []
  };

  // Older saved records without currency used USD. New-state defaults must not
  // silently relabel those amounts when the starter currency changes.
  if (!value.settings?.currency && Object.keys(value).length) next.settings.currency = "USD";
  if (!next.settings.selectedMonth) next.settings.selectedMonth = getCurrentMonth();
  if (!next.settings.currency) next.settings.currency = "USD";
  if (next.settings.lastView === "wallets") next.settings.lastView = "accounts";

  next.budgets = next.budgets.map((budget) => ({
    id: budget.id || uid("budget"),
    category: budget.category || "Other",
    limit: Number(budget.limit || 0)
  }));

  next.goals = next.goals.map((goal) => ({
    id: goal.id || uid("goal"),
    name: goal.name || "Goal",
    target: Number(goal.target || 0),
    saved: Number(goal.saved || 0),
    dueDate: goal.dueDate || "",
    color: goal.color || "#4d69c8"
  })).filter((goal) => goal.target > 0);

  next.bills = next.bills.map((bill) => ({
    id: bill.id || uid("bill"),
    name: bill.name || "Bill",
    amount: Number(bill.amount || 0),
    dueDay: clamp(Number(bill.dueDay || 1), 1, 31),
    category: bill.category || "Bills",
    accountId: bill.accountId || bill.walletId || next.accounts[0]?.id || "",
    paidMonths: Array.isArray(bill.paidMonths) ? bill.paidMonths : []
  })).filter((bill) => bill.amount > 0);

  return next;
}

function normalizeAccountCategories(categories) {
  const byName = new Map();
  [...DEFAULT_ACCOUNT_CATEGORIES, ...categories].forEach((category) => {
    const name = category.name || "Account Category";
    byName.set(name.toLowerCase(), {
      id: category.id || uid("acctcat"),
      name,
      kind: category.kind === "asset" ? "asset" : "payment",
      color: category.color || "#0f766e"
    });
  });
  return Array.from(byName.values());
}

function normalizeAccounts(accounts, accountCategories) {
  const defaultCategoryId = accountCategories[0]?.id || "acctcat_savings";
  const normalized = (Array.isArray(accounts) ? accounts : []).map((account) => {
    const openingBalance = Number(account.openingBalance || 0);
    const openingBalanceDate = normalizeOptionalDate(account.openingBalanceDate || "");
    return {
      id: account.id || uid("account"),
      name: account.name || "Account",
      institution: typeof account.institution === "string" ? account.institution : "",
      kind: typeof account.kind === "string" ? account.kind : "",
      maskedIdentifier: typeof account.maskedIdentifier === "string" ? account.maskedIdentifier : "",
      currency: typeof account.currency === "string" ? account.currency : "",
      categoryId: account.categoryId || inferAccountCategoryId(account.type || account.name, accountCategories) || defaultCategoryId,
      openingBalance,
      openingBalanceDate,
      balanceCheckpoints: normalizeBalanceCheckpoints(account.balanceCheckpoints || []),
      color: account.color || findAccountCategory(account.categoryId, accountCategories)?.color || "#0f766e"
    };
  });

  if (normalized.length) return normalized;

  return [
    { id: uid("account"), name: "Savings", categoryId: defaultCategoryId, openingBalance: 0, openingBalanceDate: "", balanceCheckpoints: [], color: "#0f766e" }
  ];
}

function normalizeBalanceCheckpoints(checkpoints) {
  const byKey = new Map();
  (Array.isArray(checkpoints) ? checkpoints : []).forEach((checkpoint) => {
    const date = normalizeOptionalDate(checkpoint.date);
    const balance = Number(checkpoint.balance);
    if (!date || !Number.isFinite(balance)) return;
    const position = checkpoint.position === "start" ? "start" : "end";
    const source = checkpoint.source === "bank_statement" || checkpoint.source === "account_created" ? checkpoint.source : "manual";
    const key = `${date}|${position}|${source}|${balance}`;
    byKey.set(key, {
      id: checkpoint.id || uid("checkpoint"),
      date,
      balance,
      position,
      source,
      note: checkpoint.note || "",
      importBatchId: checkpoint.importBatchId || "",
      statementOwned: Boolean(checkpoint.statementOwned),
      statementBatchIds: Array.isArray(checkpoint.statementBatchIds) ? checkpoint.statementBatchIds : []
    });
  });
  return Array.from(byKey.values()).sort(compareCheckpointsAsc);
}

function normalizeTransactions(transactions, accounts) {
  const defaultAccountId = accounts[0]?.id || "";
  return (Array.isArray(transactions) ? transactions : []).map((tx) => {
    const type = tx.type === "income" || tx.type === "transfer" ? tx.type : "expense";
    return {
      id: tx.id || uid("tx"),
      type,
      amount: Math.abs(Number(tx.amount || 0)),
      description: tx.description || (type === "transfer" ? "Transfer" : "Transaction"),
      category: type === "transfer" ? "Transfer" : tx.category || defaultCategory(type),
      accountId: tx.accountId || tx.walletId || defaultAccountId,
      toAccountId: type === "transfer" ? tx.toAccountId || "" : "",
      date: tx.date || todayIso(),
      note: tx.note || "",
      tags: Array.isArray(tx.tags) ? tx.tags : normalizeTagInput(tx.tags || ""),
      billId: tx.billId || null,
      importBatchId: tx.importBatchId || "",
      currency: typeof tx.currency === "string" ? tx.currency : "",
      amountMinor: Number.isSafeInteger(tx.amountMinor) ? tx.amountMinor : null,
      statementEvidence: Array.isArray(tx.statementEvidence) ? tx.statementEvidence : [],
      statementOrigin: tx.statementOrigin && typeof tx.statementOrigin === "object" ? tx.statementOrigin : null,
      classificationStatus: tx.classificationStatus || "",
      paymentRail: typeof tx.paymentRail === "string" ? tx.paymentRail : ""
    };
  }).filter((tx) => tx.amount > 0 && tx.accountId);
}

function normalizeTransactionCategories(categories) {
  const byKey = new Map();
  [...DEFAULT_TRANSACTION_CATEGORIES, ...categories].forEach((category) => {
    const type = category.type === "income" ? "income" : "expense";
    const name = category.name || "Other";
    byKey.set(`${type}:${name.toLowerCase()}`, {
      id: category.id || uid("cat"),
      type,
      name,
      color: category.color || "#6b7280",
      keywords: Array.isArray(category.keywords) ? category.keywords : normalizeKeywordInput(category.keywords || "")
    });
  });
  return Array.from(byKey.values());
}

function normalizeTags(tags) {
  const byName = new Map();
  [...DEFAULT_TAGS, ...tags].forEach((tag) => {
    const name = cleanTagName(tag.name || tag);
    if (!name) return;
    byName.set(name, {
      id: tag.id || uid("tag"),
      name,
      color: tag.color || "#6b7280",
      keywords: Array.isArray(tag.keywords) ? tag.keywords : normalizeKeywordInput(tag.keywords || "")
    });
  });
  return Array.from(byName.values());
}

function createStarterState() {
  const month = getCurrentMonth();
  const firstDay = `${month}-01`;
  const day10 = `${month}-10`;
  const day13 = `${month}-13`;
  const day16 = `${month}-16`;
  const day20 = `${month}-20`;
  const day22 = `${month}-22`;

  const savingsId = "acct_savings_main";
  const creditId = "acct_credit_visa";
  const cashId = "acct_cash";
  const mfId = "acct_mf_portfolio";

  return {
    version: 3,
    settings: {
      currency: "INR",
      selectedMonth: month,
      lastView: "dashboard"
    },
    accountCategories: DEFAULT_ACCOUNT_CATEGORIES.map((category) => ({ ...category })),
    accounts: [
      { id: savingsId, name: "Main Savings", categoryId: "acctcat_savings", openingBalance: 2400, openingBalanceDate: "", balanceCheckpoints: [], color: "#0f766e" },
      { id: creditId, name: "Visa Card", categoryId: "acctcat_credit", openingBalance: 0, openingBalanceDate: "", balanceCheckpoints: [], color: "#b63a2d" },
      { id: cashId, name: "Cash", categoryId: "acctcat_cash", openingBalance: 120, openingBalanceDate: "", balanceCheckpoints: [], color: "#5c7d2b" },
      { id: mfId, name: "Index Fund", categoryId: "acctcat_mutual_funds", openingBalance: 1650, openingBalanceDate: "", balanceCheckpoints: [], color: "#0e8a9a" }
    ],
    transactions: [
      { id: uid("tx"), type: "income", amount: 4200, description: "Salary", category: "Salary", accountId: savingsId, toAccountId: "", date: firstDay, note: "", tags: [], billId: null },
      { id: uid("tx"), type: "expense", amount: 72.4, description: "Groceries", category: "Groceries", accountId: savingsId, toAccountId: "", date: day10, note: "", tags: ["household"], billId: null },
      { id: uid("tx"), type: "expense", amount: 18.75, description: "Lunch", category: "Food", accountId: cashId, toAccountId: "", date: day13, note: "", tags: ["food"], billId: null },
      { id: uid("tx"), type: "expense", amount: 34.2, description: "Taxi", category: "Transport", accountId: creditId, toAccountId: "", date: day16, note: "", tags: ["commute"], billId: null },
      { id: uid("tx"), type: "expense", amount: 14.99, description: "Streaming", category: "Bills", accountId: creditId, toAccountId: "", date: day20, note: "", tags: ["subscription"], billId: null },
      { id: uid("tx"), type: "transfer", amount: 250, description: "Monthly SIP", category: "Transfer", accountId: savingsId, toAccountId: mfId, date: day22, note: "Investment transfer", tags: ["investment"], billId: null }
    ],
    transactionCategories: DEFAULT_TRANSACTION_CATEGORIES.map((category) => ({ ...category })),
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag })),
    budgets: [
      { id: uid("budget"), category: "Food", limit: 320 },
      { id: uid("budget"), category: "Groceries", limit: 450 },
      { id: uid("budget"), category: "Transport", limit: 180 },
      { id: uid("budget"), category: "Bills", limit: 260 }
    ],
    goals: [
      { id: uid("goal"), name: "Emergency fund", target: 5000, saved: 1650, dueDate: "", color: "#4d69c8" }
    ],
    bills: [
      { id: uid("bill"), name: "Internet", amount: 55, dueDay: 7, category: "Bills", accountId: savingsId, paidMonths: [] },
      { id: uid("bill"), name: "Rent", amount: 1450, dueDay: 1, category: "Home", accountId: savingsId, paidMonths: [] }
    ]
  };
}

function createBlankState() {
  const starter = createStarterState();
  return {
    ...starter,
    settings: {
      currency: state?.settings?.currency || "INR",
      selectedMonth: getCurrentMonth(),
      lastView: "dashboard"
    },
    accounts: starter.accounts.map((account) => ({ ...account, openingBalance: 0, openingBalanceDate: "", balanceCheckpoints: [] })),
    transactions: [],
    budgets: [],
    goals: [],
    bills: []
  };
}

function render() {
  dom.monthPicker.value = state.settings.selectedMonth;
  dom.currencySelect.value = state.settings.currency;
  dom.mobileCurrencySelect.value = state.settings.currency;
  dom.navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === activeView);
    if (item.dataset.view === activeView) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  const screenTitle = document.querySelector("#screenTitle");
  if (screenTitle) screenTitle.textContent = ({ dashboard: "Overview", transactions: "Transactions", imports: "Imports & review", accounts: "Accounts", budgets: "Budgets", stats: "Insights", goals: "Goals", bills: "Bills", settings: "Settings", guide: "User’s Guide" })[activeView] || "Overview";
  document.querySelectorAll(".mobile-more-nav[open], .topbar-menu[open]").forEach((menu) => menu.removeAttribute("open"));
  updateStorageBadge();

  const renderer = {
    dashboard: renderDashboard,
    transactions: renderTransactions,
    imports: renderImports,
    budgets: renderBudgets,
    accounts: renderAccounts,
    stats: renderStats,
    goals: renderGoals,
    bills: renderBills,
    guide: renderGuide,
    settings: renderSettings
  }[activeView] || renderDashboard;

  dom.viewRoot.innerHTML = renderer();
  bindViewEvents();
}

function updateStorageBadge() {
  if (!dom.localBadge) return;
  const labels = {
    synced: "Synced to cloud",
    syncing: "Syncing",
    unsynced: "Unsynced local cache",
    "cloud-unavailable": "Cloud unavailable",
    "cloud-conflict": "Cloud refresh needed",
    "local-server": "Saved to local server",
    "browser-only": "Saved in this browser"
  };
  const label = labels[syncStatus] || (storageMode === "server" ? "Saved to local server" : "Saved in this browser");
  dom.localBadge.dataset.status = syncStatus;
  dom.localBadge.innerHTML = `<span class="status-dot" aria-hidden="true"></span>${label}`;
}

function renderDashboard() {
  const month = state.settings.selectedMonth;
  const txs = cashflowTransactions(monthlyTransactions(month));
  const income = total(txs.filter((tx) => tx.type === "income"));
  const expense = total(txs.filter((tx) => tx.type === "expense"));
  const transfers = monthlyTransactions(month).filter((tx) => tx.type === "transfer");
  const net = income - expense;
  const categoryRows = categoryTotals(month);
  const recent = sortedTransactions(state.transactions).slice(0, 6);
  const billsDue = upcomingBills(month).slice(0, 4);
  const insights = getInsights(month);

  return `
    ${pageHeader("Your money, at a glance", `Recorded activity · ${monthLabel(month)}`, "")}
    <section class="workspace-summary" aria-label="Monthly summary">
      ${metricCard("Recorded spending", formatMoney(expense), "Transfers excluded")}
      ${metricCard("Recorded income", formatMoney(income), "Transfers excluded")}
      ${metricCard("Net cash flow", formatMoney(net), "Income minus spending")}
    </section>
    <div class="workspace-review-banner">
      <div><strong>${pendingStatementImport ? "Statement ready for review" : "Keep your picture up to date"}</strong><p>${pendingStatementImport ? "Confirm account, period and transaction treatment before saving." : "Import statements, check overlaps and confirm how each payment is recorded."}</p></div>
      <button class="button ghost" type="button" data-jump-view="imports">${pendingStatementImport ? "Continue review" : "Open imports"}</button>
    </div>
    <details class="workspace-quick-entry card">
      <summary>Quick entry <span class="muted">Log a payment in your own words</span></summary>
      <div>
        <div class="card-header">
          <h2 class="card-title">Quick add</h2>
          <span class="chip">Auto tags</span>
        </div>
        <form id="quickAddForm" class="quick-entry">
          <textarea id="quickText" class="control" aria-label="Quick transaction entries" placeholder="coffee 4.50 cash yesterday&#10;salary 3000 main savings&#10;transfer 250 main savings to index fund"></textarea>
          <div id="quickPreview" class="preview-list"></div>
          <div class="quick-actions">
            <button class="button" type="submit">Log entries</button>
            <button id="quickClearBtn" class="button ghost icon" type="button" aria-label="Clear quick entries" title="Clear quick entries">${actionIcon("eraser")}</button>
          </div>
        </form>
      </div>
    </details>

    <section class="workspace-grid">
      <div class="stack">
        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Spending by category</h2>
            <span class="chip">${txs.filter((tx) => tx.type === "expense").length} expenses</span>
          </div>
          ${renderCategoryChart(categoryRows)}
        </article>

        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Trend</h2>
            <button class="button ghost small" type="button" data-jump-view="stats">Open insights</button>
          </div>
          ${renderTrendChart(monthlyTrend())}
        </article>

        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Recent activity</h2>
            <button class="button ghost small" type="button" data-jump-view="transactions">View all</button>
          </div>
          ${recent.length ? `<div class="transaction-list">${recent.map((tx) => renderTransactionRow(tx)).join("")}</div>` : emptyState("No transactions yet.")}
        </article>
      </div>

      <div class="stack">
        ${renderStatementCoverage(month)}
        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Accounts</h2>
            <button class="button ghost small" type="button" data-jump-view="accounts">Manage</button>
          </div>
          <div class="wallet-list">
            ${state.accounts.slice(0, 6).map(renderAccountMini).join("")}
          </div>
        </article>

        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Transfers</h2>
            <span class="chip">${transfers.length} this month</span>
          </div>
          ${transfers.length ? `<div class="transaction-list">${transfers.slice(0, 4).map((tx) => renderTransactionRow(tx)).join("")}</div>` : emptyState("No transfers this month.")}
        </article>

        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Upcoming bills</h2>
            <button class="button ghost small" type="button" data-jump-view="bills">Bills</button>
          </div>
          ${billsDue.length ? `<div class="bill-list">${billsDue.map(renderBillMini).join("")}</div>` : emptyState("No bills for this month.")}
        </article>

        <article class="card">
          <div class="card-header">
            <h2 class="card-title">Insights</h2>
          </div>
          <div class="stack compact-stack">
            ${insights.map((insight) => `<div class="insight"><strong>${escapeHtml(insight.title)}</strong><span>${escapeHtml(insight.body)}</span></div>`).join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderTransactions() {
  const editing = state.transactions.find((tx) => tx.id === editingTransactionId) || null;
  const selectedType = editing?.type || "expense";
  const category = editing?.category || defaultCategory(selectedType);
  const txs = sortedTransactions(state.transactions);

  return `
    ${pageHeader("Transactions", `${state.transactions.length} total entries`, "")}
    <div class="stack">
      <details class="card transaction-compose" ${editing ? "open" : ""}><summary>${editing ? "Edit transaction" : "+ Add transaction"}</summary><div>
        <div class="card-header">
          <h2 class="card-title">${editing ? "Edit transaction" : "New transaction"}</h2>
          ${editing ? `<button id="cancelEditBtn" class="button ghost small icon" type="button" aria-label="Cancel editing" title="Cancel editing">${actionIcon("x")}</button>` : ""}
        </div>
        <form id="transactionForm" class="form-grid">
          <label class="field span-2">
            <span class="field-label">Type</span>
            <select id="txType" class="control" required>
              <option value="expense" ${selectedType === "expense" ? "selected" : ""}>Expense</option>
              <option value="income" ${selectedType === "income" ? "selected" : ""}>Income</option>
              <option value="transfer" ${selectedType === "transfer" ? "selected" : ""}>Transfer</option>
            </select>
          </label>
          <label class="field span-3">
            <span class="field-label">Amount</span>
            <input id="txAmount" class="control" type="number" min="0.01" step="0.01" value="${editing ? editing.amount : ""}" required>
          </label>
          <label class="field span-3">
            <span class="field-label">Date</span>
            <input id="txDate" class="control" type="date" value="${editing ? escapeHtml(editing.date) : todayIso()}" required>
          </label>
          <label class="field span-4">
            <span id="txAccountLabel" class="field-label">${selectedType === "transfer" ? "From account" : "Account"}</span>
            <select id="txAccount" class="control" required>
              ${accountOptions(editing?.accountId)}
            </select>
          </label>
          <label id="txToAccountField" class="field span-4 transfer-only" ${selectedType === "transfer" ? "" : "hidden"}>
            <span class="field-label">To account</span>
            <select id="txToAccount" class="control">
              ${accountOptions(editing?.toAccountId)}
            </select>
          </label>
          <label id="txCategoryField" class="field span-4" ${selectedType === "transfer" ? "hidden" : ""}>
            <span class="field-label">Category</span>
            <select id="txCategory" class="control">
              ${categoryOptions(selectedType, category)}
            </select>
          </label>
          <label class="field span-8">
            <span class="field-label">Description</span>
            <input id="txDescription" class="control" type="text" value="${editing ? escapeHtml(editing.description) : ""}" placeholder="Coffee, rent, salary, SIP" required>
          </label>
          <label class="field span-4">
            <span class="field-label">Tags</span>
            <input id="txTags" class="control" type="text" value="${editing ? escapeHtml((editing.tags || []).join(", ")) : ""}" placeholder="auto if empty">
          </label>
          <label class="field span-12">
            <span class="field-label">Note</span>
            <input id="txNote" class="control" type="text" value="${editing ? escapeHtml(editing.note) : ""}" placeholder="Optional">
          </label>
          <div class="span-12 row-actions">
            <button class="button icon" type="submit" aria-label="${editing ? "Save changes" : "Add transaction"}" title="${editing ? "Save changes" : "Add transaction"}">${actionIcon(editing ? "save" : "plus")}</button>
          </div>
        </form>
      </div></details>

      <article class="card">
        <div class="toolbar">
          <h2 class="card-title">Ledger</h2>
          <div class="filter-row">
            <input id="txSearch" class="control" type="search" placeholder="Search transactions" aria-label="Search transactions">
            <select id="txFilterType" class="control" aria-label="Filter type">
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
            </select>
            <select id="txFilterAccount" class="control" aria-label="Filter account">
              <option value="all">All accounts</option>
              ${accountOptions()}
            </select>
          </div>
        </div>
        <div id="transactionList" class="ledger-table-wrap">
          ${renderLedgerTable(txs)}
        </div>
      </article>
    </div>
  `;
}

function renderImports() {
  return `
    ${pageHeader("Imports & review", "Bring your statements together, one confirmed transaction at a time.", "")}
    <div class="imports-intro card"><ol class="import-steps"><li><strong>1. Convert locally</strong><span>PDF → statement JSON</span></li><li><strong>2. Review</strong><span>Accounts, dates and overlaps</span></li><li><strong>3. Save</strong><span>Into your encrypted ledger</span></li></ol><p class="muted">Statement JSON opens a review before saving. Legacy CSV and text imports use the selected default account and import directly.</p></div>
    <div class="stack">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Upload statement JSON</h2>
          <span class="chip">Local processing</span>
        </div>
        <div class="form-grid">
          <label class="field span-4">
            <span class="field-label">Default account</span>
            <select id="bulkAccount" class="control">
              ${accountOptions()}
            </select>
          </label>
          <label class="field span-4">
            <span class="field-label">Statement balance</span>
            <select id="bulkBalanceMode" class="control">
              <option value="checkpoint">Use latest balance as checkpoint</option>
              <option value="transactions">Only import transactions</option>
            </select>
          </label>
          <div class="import-dropzone span-12">
            <strong>Choose a converted statement</strong>
            <p class="muted">PDFs stay on your device. Convert them with the local tool, then upload the JSON here.</p>
            <label class="button file-button" for="bulkFile">Choose JSON, CSV or text file</label>
            <input id="bulkFile" class="sr-only" type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json">
          </div>
          <details class="span-12 format-help"><summary>Paste entries or see supported formats</summary>
            <label class="field"><span class="field-label">Paste entries</span><textarea id="bulkText" class="control" placeholder="Quick text, CSV, bank CSV or JSON"></textarea></label>
            <button id="bulkTextBtn" class="button" type="button">Import pasted entries</button>
            ${renderBulkImportExamples()}
          </details>
        </div>
      </article>

      ${renderStatementImportPreview()}
      ${renderStatementImportHistory()}

    </div>`;
}

function renderStatementCoverage(month) {
  const start = `${month}-01`;
  const end = `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
  const sections = (state.importBatches || []).filter((batch) => batch.kind === "statement").flatMap((batch) => batch.statements || []).filter((section) => section.period?.status === "user_confirmed" && section.period.start <= end && section.period.end >= start);
  const byAccount = new Map();
  sections.forEach((section) => {
    if (!byAccount.has(section.accountId)) byAccount.set(section.accountId, []);
    byAccount.get(section.accountId).push(section.period);
  });
  const rows = [...byAccount].map(([id, periods]) => `<div class="statement-batch"><div><strong>${escapeHtml(findAccount(id)?.name || "Account")}</strong><p class="muted">${periods.map((period) => `${escapeHtml(period.start)} – ${escapeHtml(period.end)}`).join("<br>")}</p></div></div>`).join("");
  return `<article class="card workspace-coverage"><div class="card-header"><h2 class="card-title">Statement coverage</h2><button class="button ghost small" data-jump-view="imports" type="button">Manage</button></div>${rows || emptyState("No confirmed statement coverage for this month.")}<p class="muted">Confirmed statement periods only. Recorded activity alone does not prove complete coverage.</p></article>`;
}

function renderLedgerTable(txs, accountContextId = "") {
  if (!txs.length) return emptyState("No matching transactions. Add one or import a statement to begin.");
  return `<table class="ledger-table" role="table"><caption class="sr-only">Recorded transactions</caption><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Date</th><th scope="col" role="columnheader">Transaction</th><th scope="col" role="columnheader">Account</th><th scope="col" role="columnheader">Amount</th><th scope="col" role="columnheader">Actions</th></tr></thead><tbody role="rowgroup">${txs.map((tx) => {
    const from = findAccount(tx.accountId);
    const to = findAccount(tx.toAccountId);
    const display = transactionAmountDisplay(tx, accountContextId);
    return `<tr role="row"><td role="cell" data-label="Date">${formatDate(tx.date)}</td><td role="cell" data-label="Transaction"><p class="transaction-title">${escapeHtml(tx.description)}</p><div class="transaction-meta"><span>${escapeHtml(tx.type === "transfer" ? "Transfer" : tx.category)}</span>${(tx.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}${tx.note ? `<span>${escapeHtml(tx.note)}</span>` : ""}</div></td><td role="cell" data-label="Account">${escapeHtml(from?.name || "Account")}${tx.type === "transfer" ? ` → ${escapeHtml(to?.name || "Account")}` : ""}</td><td role="cell" data-label="Amount"><span class="amount ${display.amountClass}">${display.sign}${formatMoney(tx.amount)}</span></td><td role="cell" data-label="Actions"><div class="row-actions"><button class="button ghost small icon" type="button" data-edit-transaction="${escapeHtml(tx.id)}" aria-label="Edit ${escapeHtml(tx.description)}" title="Edit ${escapeHtml(tx.description)}">${actionIcon("pencil")}</button><button class="button ghost small icon is-danger" type="button" data-delete-transaction="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(tx.description)}" title="Delete ${escapeHtml(tx.description)}">${actionIcon("trash")}</button></div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function renderBulkImportExamples() {
  return `
    <details class="format-help span-12">
      <summary>
        <span>Supported formats</span>
        <span class="format-pills">
          <span class="chip">Text</span>
          <span class="chip">CSV</span>
          <span class="chip">Bank CSV</span>
          <span class="chip">JSON</span>
        </span>
      </summary>
      <div class="format-grid">
        <section class="format-example">
          <h3>Quick text</h3>
          <pre><code>coffee 120 cash yesterday
salary 85000 HDFC Savings 2026-06-01
transfer 5000 HDFC Savings to Cash 2026-06-03</code></pre>
        </section>
        <section class="format-example">
          <h3>Standard CSV</h3>
          <pre><code>date,description,amount,type,account,category,tags
2026-06-01,Salary,85000,income,HDFC Savings,Salary,
2026-06-02,Coffee,-120,expense,HDFC Savings,Food,food</code></pre>
        </section>
        <section class="format-example">
          <h3>Bank CSV</h3>
          <pre><code>Txn Date,Narration,Debit,Credit,Balance
09/06/2026,UPI COFFEE SHOP,120,,49880
10/06/2026,SALARY CREDIT,,85000,134880</code></pre>
        </section>
        <section class="format-example">
          <h3>JSON</h3>
          <pre><code>{
  "transactions": [
    {
      "date": "2026-06-01",
      "description": "Salary",
      "amount": 85000,
      "type": "income",
      "account": "HDFC Savings"
    }
  ]
}</code></pre>
        </section>
      </div>
    </details>
  `;
}

function renderBudgets() {
  const month = state.settings.selectedMonth;
  const rows = transactionCategories("expense").map((category) => {
    const existing = state.budgets.find((budget) => budget.category === category.name);
    const spent = monthlyCategorySpend(month, category.name);
    const limit = existing?.limit || 0;
    const progress = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const statusClass = limit > 0 && spent > limit ? "red" : progress > 75 ? "amber" : "green";

    return `
      <div class="budget-row">
        <div>
          <p class="row-title">
            <span class="wallet-swatch" style="--swatch:${category.color}"></span>
            ${escapeHtml(category.name)}
          </p>
          <div class="row-meta"><span>${formatMoney(spent)} spent</span></div>
        </div>
        <div class="progress">
          <div class="progress-track">
            <div class="progress-fill" style="--progress:${progress}%; --progress-color:${category.color}"></div>
          </div>
          <div class="progress-label">
            <span>${progress}% used</span>
            <span>${limit ? formatMoney(limit) : "No limit"}</span>
          </div>
        </div>
        <label class="field">
          <span class="field-label">Monthly limit</span>
          <input class="control budget-limit" data-category="${escapeHtml(category.name)}" type="number" min="0" step="0.01" value="${limit || ""}">
        </label>
        <span class="chip ${statusClass}">${budgetStatus(spent, limit)}</span>
      </div>
    `;
  }).join("");

  return `
    ${pageHeader("Budgets", monthLabel(month), "")}
    <article class="card">
      <div class="card-header">
        <h2 class="card-title">Monthly category limits</h2>
        <button id="saveBudgetsBtn" class="button icon" type="button" aria-label="Save budget limits" title="Save budget limits">${actionIcon("save")}</button>
      </div>
      <div class="budget-list">${rows}</div>
    </article>
  `;
}

function renderAccounts() {
  const paymentTotal = totalAccountsByKind("payment");
  const assetTotal = totalAccountsByKind("asset");

  return `
    ${pageHeader("Accounts", `${formatMoney(totalBalance())} net worth`, "")}
    <section class="metric-grid">
      ${metricCard("Payment Accounts", formatMoney(paymentTotal), "Savings, card, cash, wallets")}
      ${metricCard("Assets", formatMoney(assetTotal), "FD, RD, stocks, funds")}
      ${metricCard("Categories", String(state.accountCategories.length), "Configurable")}
      ${metricCard("Transfers", String(state.transactions.filter((tx) => tx.type === "transfer").length), "Neutral to cashflow")}
    </section>

    <div class="split">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Add account</h2>
        </div>
        <form id="accountForm" class="form-grid">
          <label class="field span-6">
            <span class="field-label">Name</span>
            <input id="accountName" class="control" type="text" placeholder="HDFC Savings" required>
          </label>
          <label class="field span-6">
            <span class="field-label">Category</span>
            <select id="accountCategory" class="control" required>
              ${accountCategoryOptions()}
            </select>
          </label>
          <label class="field span-6">
            <span class="field-label">Opening balance</span>
            <input id="accountOpening" class="control" type="number" step="0.01" value="0" required>
          </label>
          <label class="field span-6">
            <span class="field-label">Balance from date</span>
            <input id="accountOpeningDate" class="control" type="date" value="${todayIso()}" required>
          </label>
          <label class="field span-6">
            <span class="field-label">Color</span>
            <input id="accountColor" class="control" type="color" value="#0f766e">
          </label>
          <div class="span-12 row-actions">
            <button class="button icon" type="submit" aria-label="Add account" title="Add account">${actionIcon("plus")}</button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Add account category</h2>
        </div>
        <form id="accountCategoryForm" class="form-grid">
          <label class="field span-5">
            <span class="field-label">Name</span>
            <input id="newAccountCategoryName" class="control" type="text" placeholder="PPF, NPS, Crypto" required>
          </label>
          <label class="field span-4">
            <span class="field-label">Kind</span>
            <select id="newAccountCategoryKind" class="control">
              <option value="payment">Payment</option>
              <option value="asset">Asset</option>
            </select>
          </label>
          <label class="field span-3">
            <span class="field-label">Color</span>
            <input id="newAccountCategoryColor" class="control" type="color" value="#4d69c8">
          </label>
          <div class="span-12 row-actions">
            <button class="button icon" type="submit" aria-label="Add category" title="Add category">${actionIcon("plus")}</button>
          </div>
        </form>
      </article>
    </div>

    <article class="card section-gap">
      <div class="card-header">
        <h2 class="card-title">Balance checkpoint</h2>
        <span class="chip">Trusted balance</span>
      </div>
      <form id="checkpointForm" class="form-grid">
        <label class="field span-3">
          <span class="field-label">Account</span>
          <select id="checkpointAccount" class="control">${accountOptions(selectedActivityAccountId)}</select>
        </label>
        <label class="field span-3">
          <span class="field-label">Balance</span>
          <input id="checkpointBalance" class="control" type="number" step="0.01" required>
        </label>
        <label class="field span-3">
          <span class="field-label">Date</span>
          <input id="checkpointDate" class="control" type="date" value="${todayIso()}" required>
        </label>
        <label class="field span-3">
          <span class="field-label">Applies</span>
          <select id="checkpointPosition" class="control">
            <option value="end">After this date</option>
            <option value="start">From start of this date</option>
          </select>
        </label>
        <label class="field span-12">
          <span class="field-label">Note</span>
          <input id="checkpointNote" class="control" type="text" placeholder="Statement closing balance, manual reconciliation">
        </label>
        <div class="span-12 row-actions">
          <button class="button icon" type="submit" aria-label="Save balance checkpoint" title="Save balance checkpoint">${actionIcon("save")}</button>
        </div>
      </form>
    </article>

    <div class="split section-gap">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Transfer funds</h2>
          <span class="chip">Neutral cashflow</span>
        </div>
        <form id="transferForm" class="form-grid">
          <label class="field span-6">
            <span class="field-label">From</span>
            <select id="transferFrom" class="control">${accountOptions()}</select>
          </label>
          <label class="field span-6">
            <span class="field-label">To</span>
            <select id="transferTo" class="control">${accountOptions(state.accounts[1]?.id)}</select>
          </label>
          <label class="field span-4">
            <span class="field-label">Amount</span>
            <input id="transferAmount" class="control" type="number" min="0.01" step="0.01" required>
          </label>
          <label class="field span-4">
            <span class="field-label">Date</span>
            <input id="transferDate" class="control" type="date" value="${todayIso()}" required>
          </label>
          <label class="field span-4">
            <span class="field-label">Description</span>
            <input id="transferDescription" class="control" type="text" value="Transfer">
          </label>
          <div class="span-12 row-actions">
            <button class="button" type="submit">Record transfer</button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Account activity</h2>
          <select id="activityAccount" class="control compact" aria-label="Activity account">
            ${accountOptions(selectedActivityAccountId)}
          </select>
        </div>
        <div id="accountActivityList" class="transaction-list">
          ${renderAccountActivity(selectedActivityAccountId)}
        </div>
      </article>
    </div>

    <article class="card section-gap">
      <div class="card-header">
        <h2 class="card-title">Balances</h2>
      </div>
      <div class="account-groups">
        ${state.accountCategories.map(renderAccountGroup).join("")}
      </div>
    </article>
  `;
}

function renderStats() {
  const month = state.settings.selectedMonth;
  const trend = monthlyTrend();
  const topTags = tagTotals(month);
  const accountRows = accountCategoryTotals();

  return `
    ${pageHeader("Insights", monthLabel(month), "")}
    <section class="metric-grid">
      ${metricCard("Avg Monthly Spend", formatMoney(averageTrendValue(trend, "expense")), "Last 6 months")}
      ${metricCard("Avg Monthly Income", formatMoney(averageTrendValue(trend, "income")), "Last 6 months")}
      ${metricCard("Top Tag", topTags[0]?.tag || "None", topTags[0] ? formatMoney(topTags[0].amount) : "No tagged spend")}
      ${metricCard("Transfer Volume", formatMoney(total(monthlyTransactions(month).filter((tx) => tx.type === "transfer"))), "Excluded from cashflow")}
    </section>

    <div class="split">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Income vs spending</h2>
        </div>
        ${renderTrendChart(trend)}
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Top tags</h2>
        </div>
        ${topTags.length ? `<div class="bar-list">${topTags.map(renderTagTotalRow).join("")}</div>` : emptyState("No tagged expenses this month.")}
      </article>
    </div>

    <div class="split section-gap">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Account mix</h2>
        </div>
        <div class="bar-list">
          ${accountRows.map(renderAccountMixRow).join("")}
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Trend notes</h2>
        </div>
        <div class="stack compact-stack">
          ${getInsights(month).map((insight) => `<div class="insight"><strong>${escapeHtml(insight.title)}</strong><span>${escapeHtml(insight.body)}</span></div>`).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderGoals() {
  return `
    ${pageHeader("Goals", `${state.goals.length} active goals`, "")}
    <div class="split">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Add goal</h2>
        </div>
        <form id="goalForm" class="form-grid">
          <label class="field span-6">
            <span class="field-label">Name</span>
            <input id="goalName" class="control" type="text" placeholder="Trip, emergency fund" required>
          </label>
          <label class="field span-6">
            <span class="field-label">Target</span>
            <input id="goalTarget" class="control" type="number" min="0.01" step="0.01" required>
          </label>
          <label class="field span-6">
            <span class="field-label">Saved</span>
            <input id="goalSaved" class="control" type="number" min="0" step="0.01" value="0">
          </label>
          <label class="field span-6">
            <span class="field-label">Due date</span>
            <input id="goalDue" class="control" type="date">
          </label>
          <div class="span-12 row-actions">
            <button class="button icon" type="submit" aria-label="Add goal" title="Add goal">${actionIcon("plus")}</button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Progress</h2>
        </div>
        ${state.goals.length ? `<div class="goal-list">${state.goals.map(renderGoalRow).join("")}</div>` : emptyState("No goals yet.")}
      </article>
    </div>
  `;
}

function renderBills() {
  return `
    ${pageHeader("Bills", monthLabel(state.settings.selectedMonth), "")}
    <div class="split">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Add bill</h2>
        </div>
        <form id="billForm" class="form-grid">
          <label class="field span-6">
            <span class="field-label">Name</span>
            <input id="billName" class="control" type="text" placeholder="Internet" required>
          </label>
          <label class="field span-6">
            <span class="field-label">Amount</span>
            <input id="billAmount" class="control" type="number" min="0.01" step="0.01" required>
          </label>
          <label class="field span-4">
            <span class="field-label">Due day</span>
            <input id="billDueDay" class="control" type="number" min="1" max="31" value="1" required>
          </label>
          <label class="field span-4">
            <span class="field-label">Category</span>
            <select id="billCategory" class="control">
              ${transactionCategories("expense").map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join("")}
            </select>
          </label>
          <label class="field span-4">
            <span class="field-label">Account</span>
            <select id="billAccount" class="control">
              ${accountOptions()}
            </select>
          </label>
          <div class="span-12 row-actions">
            <button class="button icon" type="submit" aria-label="Add bill" title="Add bill">${actionIcon("plus")}</button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">This month</h2>
          <span class="chip">${formatMoney(total(state.bills))}</span>
        </div>
        ${state.bills.length ? `<div class="bill-list">${state.bills.map(renderBillRow).join("")}</div>` : emptyState("No bills yet.")}
      </article>
    </div>
  `;
}

function renderGuide() {
  return `${pageHeader("User’s Guide", "Step-by-step help for every available feature.", "")}${window.ManimanGuide.render()}`;
}

function renderSettings() {
  const dataCount = state.transactions.length + state.accounts.length + state.budgets.length + state.goals.length + state.bills.length;
  const serverLabel = storageModeLabel();
  return `
    ${pageHeader("Settings", "Local data controls", "")}
    <section class="settings-grid">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Preferences</h2>
        </div>
        <div class="form-grid">
          <label class="field span-6">
            <span class="field-label">Currency</span>
            <select id="settingsCurrency" class="control">
              ${["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD"].map((code) => `<option value="${code}" ${state.settings.currency === code ? "selected" : ""}>${code}</option>`).join("")}
            </select>
          </label>
          <label class="field span-6">
            <span class="field-label">Default month</span>
            <input id="settingsMonth" class="control" type="month" value="${state.settings.selectedMonth}">
          </label>
          <label class="field span-6">
            <span class="field-label">Auto-lock after inactivity (minutes)</span>
            <input id="settingsAutoLock" class="control" type="number" min="1" max="120" value="${Math.max(1, Math.min(120, Number(state.settings.vaultAutoLockMinutes || 15)))}">
          </label>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Data</h2>
          <span class="chip">${dataCount} records</span>
        </div>
        <div class="stack">
          <span class="chip">${serverLabel}</span>
          <button id="settingsExportBtn" class="button" type="button">Export encrypted backup</button>
          <label class="button ghost file-button" for="settingsImportFile">Import JSON</label>
          <input id="settingsImportFile" class="sr-only" type="file" accept="application/json,.json">
          <button id="freshStartBtn" class="button ghost" type="button">Start fresh</button>
          <button id="demoResetBtn" class="button ghost" type="button">Restore starter data</button>
        </div>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Cloud sync</h2>
          <span class="chip ${syncStatus === "synced" ? "green" : syncStatus === "unsynced" || syncStatus === "cloud-unavailable" ? "amber" : ""}">${escapeHtml(serverLabel)}</span>
        </div>
        ${renderCloudSyncSettings()}
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Transaction categories</h2>
        </div>
        <form id="transactionCategoryForm" class="form-grid">
          <label class="field span-3">
            <span class="field-label">Type</span>
            <select id="newTxCategoryType" class="control">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label class="field span-4">
            <span class="field-label">Name</span>
            <input id="newTxCategoryName" class="control" type="text" required>
          </label>
          <label class="field span-3">
            <span class="field-label">Keywords</span>
            <input id="newTxCategoryKeywords" class="control" type="text" placeholder="comma list">
          </label>
          <label class="field span-2">
            <span class="field-label">Color</span>
            <input id="newTxCategoryColor" class="control" type="color" value="#6b7280">
          </label>
          <div class="span-12 row-actions">
            <button class="button icon" type="submit" aria-label="Add category" title="Add category">${actionIcon("plus")}</button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Tags</h2>
        </div>
        <form id="tagForm" class="form-grid">
          <label class="field span-4">
            <span class="field-label">Tag</span>
            <input id="newTagName" class="control" type="text" placeholder="kids, tax, business" required>
          </label>
          <label class="field span-5">
            <span class="field-label">Auto keywords</span>
            <input id="newTagKeywords" class="control" type="text" placeholder="comma list">
          </label>
          <label class="field span-3">
            <span class="field-label">Color</span>
            <input id="newTagColor" class="control" type="color" value="#0f766e">
          </label>
          <div class="span-12 row-actions">
            <button class="button icon" type="submit" aria-label="Add tag" title="Add tag">${actionIcon("plus")}</button>
          </div>
        </form>
        <div class="tag-list section-gap-small">
          ${state.tags.map(renderTagChip).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderCloudSyncSettings() {
  if (!cloud.configured) {
    return `
      <div class="stack compact-stack">
        <p class="muted-text">Cloud sync is disabled until Supabase URL and anon key are added to <code>config.js</code>.</p>
        <span class="chip">Browser/local modes remain active</span>
      </div>
    `;
  }

  if (cloud.user) {
    return `
      <div class="stack compact-stack">
        <p class="muted-text">Signed in as ${escapeHtml(cloud.user.email || "Supabase user")}.</p>
        <span class="chip">Revision ${Number(cloud.revision || 0)}</span>
        ${cloud.lastError ? `<p class="muted-text">${escapeHtml(cloud.lastError)}</p>` : ""}
        <div class="row-actions">
          <button id="cloudSaveNowBtn" class="button" type="button">Sync now</button>
          <button id="cloudSignOutBtn" class="button ghost" type="button">Sign out</button>
          ${cloud.conflictEnvelope ? `<button id="cloudConflictExportBtn" class="button ghost" type="button">Export remote encrypted copy</button>` : ""}
        </div>
      </div>
    `;
  }

  return `
    <form id="cloudAuthForm" class="form-grid">
      <label class="field span-6">
        <span class="field-label">Email</span>
        <input id="cloudEmail" class="control" type="email" autocomplete="email" required>
      </label>
      <label class="field span-6">
        <span class="field-label">Password</span>
        <input id="cloudPassword" class="control" type="password" autocomplete="current-password" minlength="6" required>
      </label>
      <div class="span-12 row-actions">
        <button class="button" type="submit">Sign in</button>
        <button id="cloudSignUpBtn" class="button ghost" type="button">Create account</button>
      </div>
    </form>
  `;
}

function bindViewEvents() {
  dom.viewRoot.querySelectorAll("[data-jump-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.jumpView;
      state.settings.lastView = activeView;
      saveState();
      render();
    });
  });

  if (activeView === "dashboard") bindDashboardEvents();
  if (activeView === "transactions") bindTransactionEvents();
  if (activeView === "imports") bindImportEvents();
  if (activeView === "budgets") bindBudgetEvents();
  if (activeView === "accounts") bindAccountEvents();
  if (activeView === "goals") bindGoalEvents();
  if (activeView === "bills") bindBillEvents();
  if (activeView === "settings") bindSettingsEvents();
  if (activeView === "guide") window.ManimanGuide.bind(dom.viewRoot);

  bindTransactionRowActions();
}

function bindTransactionRowActions(root = document) {
  root.querySelectorAll("[data-edit-transaction]").forEach((button) => {
    button.addEventListener("click", () => {
      editingTransactionId = button.dataset.editTransaction;
      activeView = "transactions";
      render();
    });
  });

  root.querySelectorAll("[data-delete-transaction]").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.deleteTransaction));
  });
}

function bindDashboardEvents() {
  const form = document.querySelector("#quickAddForm");
  const text = document.querySelector("#quickText");
  const preview = document.querySelector("#quickPreview");
  const clear = document.querySelector("#quickClearBtn");

  const updatePreview = () => {
    const parsed = parseQuickEntries(text.value);
    preview.innerHTML = parsed.length ? parsed.map(renderPreviewItem).join("") : "";
  };

  text.addEventListener("input", updatePreview);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const parsed = parseQuickEntries(text.value);
    if (!parsed.length) {
      showToast("Add an amount to log an entry.");
      return;
    }
    addTransactions(parsed);
    showToast(`${parsed.length} entr${parsed.length === 1 ? "y" : "ies"} logged.`);
    render();
  });

  clear.addEventListener("click", () => {
    text.value = "";
    updatePreview();
  });
}

function bindTransactionEvents() {
  const form = document.querySelector("#transactionForm");
  const type = document.querySelector("#txType");
  const category = document.querySelector("#txCategory");
  const search = document.querySelector("#txSearch");
  const filterType = document.querySelector("#txFilterType");
  const filterAccount = document.querySelector("#txFilterAccount");
  const cancel = document.querySelector("#cancelEditBtn");
  const updateTypeFields = () => {
    const isTransfer = type.value === "transfer";
    document.querySelector("#txToAccountField").hidden = !isTransfer;
    document.querySelector("#txCategoryField").hidden = isTransfer;
    document.querySelector("#txAccountLabel").textContent = isTransfer ? "From account" : "Account";
    if (!isTransfer) category.innerHTML = categoryOptions(type.value, defaultCategory(type.value));
  };

  type.addEventListener("change", updateTypeFields);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const tx = transactionFromForm();
    if (!tx) return;

    if (editingTransactionId) {
      const index = state.transactions.findIndex((item) => item.id === editingTransactionId);
      if (index >= 0) state.transactions[index] = { ...state.transactions[index], ...tx };
      editingTransactionId = null;
      showToast("Entry updated.");
    } else {
      addTransactions([tx]);
      showToast("Entry added.");
    }

    saveState();
    render();
  });

  if (cancel) {
    cancel.addEventListener("click", () => {
      editingTransactionId = null;
      render();
    });
  }

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    const typeValue = filterType.value;
    const accountValue = filterAccount.value;
    const filtered = sortedTransactions(state.transactions).filter((tx) => {
      const tagText = (tx.tags || []).join(" ");
      const matchesQuery = !query || `${tx.description} ${tx.category} ${tx.note} ${tagText}`.toLowerCase().includes(query);
      const matchesType = typeValue === "all" || tx.type === typeValue;
      const matchesAccount = accountValue === "all" || tx.accountId === accountValue || tx.toAccountId === accountValue;
      return matchesQuery && matchesType && matchesAccount;
    });
    const list = document.querySelector("#transactionList");
    list.innerHTML = renderLedgerTable(filtered, accountValue === "all" ? "" : accountValue);
    bindTransactionRowActions(list);
  };

  search.addEventListener("input", filter);
  filterType.addEventListener("change", filter);
  filterAccount.addEventListener("change", filter);

}

function bindImportEvents() {
  const bulkText = document.querySelector("#bulkText");
  const bulkTextBtn = document.querySelector("#bulkTextBtn");
  const bulkFile = document.querySelector("#bulkFile");
  const bulkImportOptions = () => ({
    defaultAccountId: document.querySelector("#bulkAccount").value,
    createCheckpoint: document.querySelector("#bulkBalanceMode").value === "checkpoint"
  });

  bulkTextBtn.addEventListener("click", () => {
    importTransactionText(bulkText.value, "", bulkImportOptions());
  });

  bulkFile.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast("Import files must be 20 MB or smaller.");
      event.target.value = "";
      return;
    }
    const options = bulkImportOptions();
    const owner = captureVaultContext();
    const reader = new FileReader();
    reader.onload = () => {
      if (!vaultContextMatches(owner)) { event.target.value = ""; return; }
      importTransactionText(String(reader.result || ""), file.name, options);
      event.target.value = "";
    };
    reader.readAsText(file);
  });

  bindStatementImportEvents();
}

function transactionFromForm() {
  const type = document.querySelector("#txType").value;
  const amount = Number(document.querySelector("#txAmount").value);
  const description = document.querySelector("#txDescription").value.trim();
  const accountId = document.querySelector("#txAccount").value;
  const toAccountId = type === "transfer" ? document.querySelector("#txToAccount").value : "";
  const category = type === "transfer" ? "Transfer" : document.querySelector("#txCategory").value;
  const date = document.querySelector("#txDate").value;
  const note = document.querySelector("#txNote").value.trim();
  const explicitTags = normalizeTagInput(document.querySelector("#txTags").value);
  const tags = explicitTags.length ? explicitTags : detectTags(`${description} ${category}`);

  if (!amount || amount <= 0 || !description || !date || !accountId) {
    showToast("Fill the required entry fields.");
    return null;
  }
  if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
    showToast("Choose two different accounts for a transfer.");
    return null;
  }

  ensureTags(tags);
  return {
    id: editingTransactionId || uid("tx"),
    type,
    amount,
    description,
    category,
    accountId,
    toAccountId,
    date,
    note,
    tags,
    billId: null,
    importBatchId: ""
  };
}

function bindBudgetEvents() {
  document.querySelector("#saveBudgetsBtn").addEventListener("click", () => {
    const nextBudgets = [];
    document.querySelectorAll(".budget-limit").forEach((input) => {
      const amount = Number(input.value);
      if (amount > 0) {
        const existing = state.budgets.find((budget) => budget.category === input.dataset.category);
        nextBudgets.push({
          id: existing?.id || uid("budget"),
          category: input.dataset.category,
          limit: amount
        });
      }
    });
    state.budgets = nextBudgets;
    saveState();
    showToast("Budgets saved.");
    render();
  });
}

function bindAccountEvents() {
  document.querySelector("#accountForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const category = findAccountCategory(document.querySelector("#accountCategory").value);
    const openingBalance = Number(document.querySelector("#accountOpening").value || 0);
    const openingBalanceDate = document.querySelector("#accountOpeningDate").value || todayIso();
    state.accounts.push({
      id: uid("account"),
      name: document.querySelector("#accountName").value.trim(),
      categoryId: category?.id || state.accountCategories[0]?.id || "",
      openingBalance,
      openingBalanceDate,
      balanceCheckpoints: [{
        id: uid("checkpoint"),
        date: openingBalanceDate,
        balance: openingBalance,
        position: "start",
        source: "account_created",
        note: "Account starting balance"
      }],
      color: document.querySelector("#accountColor").value || category?.color || "#0f766e"
    });
    saveState();
    showToast("Account added.");
    render();
  });

  document.querySelector("#checkpointForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const accountId = document.querySelector("#checkpointAccount").value;
    const balance = Number(document.querySelector("#checkpointBalance").value);
    const date = document.querySelector("#checkpointDate").value || todayIso();
    if (!accountId || !Number.isFinite(balance)) {
      showToast("Choose an account and balance.");
      return;
    }
    const added = addBalanceCheckpoint(accountId, {
      id: uid("checkpoint"),
      date,
      balance,
      position: document.querySelector("#checkpointPosition").value === "start" ? "start" : "end",
      source: "manual",
      note: document.querySelector("#checkpointNote").value.trim()
    });
    showToast(added ? "Balance checkpoint saved." : "That checkpoint already exists.");
    saveState();
    render();
  });

  document.querySelector("#accountCategoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#newAccountCategoryName").value.trim();
    if (!name) return;
    if (state.accountCategories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      showToast("That account category already exists.");
      return;
    }
    state.accountCategories.push({
      id: uid("acctcat"),
      name,
      kind: document.querySelector("#newAccountCategoryKind").value,
      color: document.querySelector("#newAccountCategoryColor").value || "#4d69c8"
    });
    saveState();
    showToast("Account category added.");
    render();
  });

  document.querySelector("#transferForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const from = document.querySelector("#transferFrom").value;
    const to = document.querySelector("#transferTo").value;
    const amount = Number(document.querySelector("#transferAmount").value || 0);
    if (!amount || amount <= 0 || from === to) {
      showToast("Choose two accounts and a positive transfer amount.");
      return;
    }
    addTransactions([{
      id: uid("tx"),
      type: "transfer",
      amount,
      description: document.querySelector("#transferDescription").value.trim() || "Transfer",
      category: "Transfer",
      accountId: from,
      toAccountId: to,
      date: document.querySelector("#transferDate").value || todayIso(),
      note: "",
      tags: detectTags(document.querySelector("#transferDescription").value),
      billId: null
    }]);
    saveState();
    showToast("Transfer recorded.");
    render();
  });

  document.querySelector("#activityAccount").addEventListener("change", (event) => {
    selectedActivityAccountId = event.target.value;
    document.querySelector("#accountActivityList").innerHTML = renderAccountActivity(selectedActivityAccountId);
  });

  document.querySelectorAll("[data-delete-account]").forEach((button) => {
    button.addEventListener("click", () => {
      const accountId = button.dataset.deleteAccount;
      if (state.transactions.some((tx) => tx.accountId === accountId || tx.toAccountId === accountId) || state.bills.some((bill) => bill.accountId === accountId)) {
        showToast("Move linked entries or bills before deleting this account.");
        return;
      }
      if (state.accounts.length <= 1) {
        showToast("Keep at least one account.");
        return;
      }
      state.accounts = state.accounts.filter((account) => account.id !== accountId);
      selectedActivityAccountId = state.accounts[0]?.id || "";
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete-checkpoint]").forEach((button) => {
    button.addEventListener("click", () => {
      const removed = removeBalanceCheckpoint(button.dataset.checkpointAccount, button.dataset.deleteCheckpoint);
      if (!removed) {
        showToast("Checkpoint was not found.");
        return;
      }
      saveState();
      showToast("Balance checkpoint removed.");
      render();
    });
  });
}

function bindGoalEvents() {
  document.querySelector("#goalForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.goals.push({
      id: uid("goal"),
      name: document.querySelector("#goalName").value.trim(),
      target: Number(document.querySelector("#goalTarget").value || 0),
      saved: Number(document.querySelector("#goalSaved").value || 0),
      dueDate: document.querySelector("#goalDue").value,
      color: "#4d69c8"
    });
    saveState();
    showToast("Goal added.");
    render();
  });

  document.querySelectorAll("[data-save-goal]").forEach((button) => {
    button.addEventListener("click", () => {
      const goal = state.goals.find((item) => item.id === button.dataset.saveGoal);
      const input = document.querySelector(`[data-goal-saved="${button.dataset.saveGoal}"]`);
      if (!goal || !input) return;
      goal.saved = Math.max(0, Number(input.value || 0));
      saveState();
      showToast("Goal updated.");
      render();
    });
  });

  document.querySelectorAll("[data-delete-goal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.goals = state.goals.filter((goal) => goal.id !== button.dataset.deleteGoal);
      saveState();
      render();
    });
  });
}

function bindBillEvents() {
  document.querySelector("#billForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.bills.push({
      id: uid("bill"),
      name: document.querySelector("#billName").value.trim(),
      amount: Number(document.querySelector("#billAmount").value || 0),
      dueDay: clamp(Number(document.querySelector("#billDueDay").value || 1), 1, 31),
      category: document.querySelector("#billCategory").value,
      accountId: document.querySelector("#billAccount").value,
      paidMonths: []
    });
    saveState();
    showToast("Bill added.");
    render();
  });

  document.querySelectorAll("[data-toggle-bill]").forEach((button) => {
    button.addEventListener("click", () => toggleBillPaid(button.dataset.toggleBill));
  });

  document.querySelectorAll("[data-delete-bill]").forEach((button) => {
    button.addEventListener("click", () => {
      const billId = button.dataset.deleteBill;
      state.bills = state.bills.filter((bill) => bill.id !== billId);
      state.transactions = state.transactions.filter((tx) => tx.billId !== billId);
      saveState();
      render();
    });
  });
}

function bindSettingsEvents() {
  document.querySelector("#settingsAutoLock")?.addEventListener("change", (event) => {
    state.settings.vaultAutoLockMinutes = Math.max(1, Math.min(120, Number(event.target.value) || 15));
    saveState();
    document.dispatchEvent(new Event("pointerdown"));
  });
  document.querySelector("#settingsCurrency").addEventListener("change", (event) => {
    setDisplayCurrency(event.target.value);
  });

  document.querySelector("#settingsMonth").addEventListener("change", (event) => {
    state.settings.selectedMonth = event.target.value || getCurrentMonth();
    saveState();
    render();
  });

  document.querySelector("#settingsExportBtn").addEventListener("click", exportData);
  document.querySelector("#settingsImportFile").addEventListener("change", importData);
  bindCloudSettingsEvents();

  document.querySelector("#freshStartBtn").addEventListener("click", () => {
    if (!window.confirm("Start fresh and replace the current local data?")) return;
    state = createBlankState();
    activeView = "dashboard";
    selectedActivityAccountId = state.accounts[0]?.id || "";
    saveState();
    render();
  });

  document.querySelector("#demoResetBtn").addEventListener("click", () => {
    if (!window.confirm("Restore starter data and replace the current local data?")) return;
    state = createStarterState();
    activeView = "dashboard";
    selectedActivityAccountId = state.accounts[0]?.id || "";
    saveState();
    render();
  });

  document.querySelector("#transactionCategoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const type = document.querySelector("#newTxCategoryType").value;
    const name = document.querySelector("#newTxCategoryName").value.trim();
    if (!name) return;
    if (state.transactionCategories.some((category) => category.type === type && category.name.toLowerCase() === name.toLowerCase())) {
      showToast("That transaction category already exists.");
      return;
    }
    state.transactionCategories.push({
      id: uid("cat"),
      type,
      name,
      color: document.querySelector("#newTxCategoryColor").value || "#6b7280",
      keywords: normalizeKeywordInput(document.querySelector("#newTxCategoryKeywords").value)
    });
    saveState();
    showToast("Transaction category added.");
    render();
  });

  document.querySelector("#tagForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = cleanTagName(document.querySelector("#newTagName").value);
    if (!name) return;
    const existing = state.tags.find((tag) => tag.name === name);
    if (existing) {
      existing.keywords = normalizeKeywordInput(document.querySelector("#newTagKeywords").value);
      existing.color = document.querySelector("#newTagColor").value || existing.color;
    } else {
      state.tags.push({
        id: uid("tag"),
        name,
        color: document.querySelector("#newTagColor").value || "#0f766e",
        keywords: normalizeKeywordInput(document.querySelector("#newTagKeywords").value)
      });
    }
    saveState();
    showToast("Tag saved.");
    render();
  });
}

function bindCloudSettingsEvents() {
  const authForm = document.querySelector("#cloudAuthForm");
  const signUpButton = document.querySelector("#cloudSignUpBtn");
  const signOutButton = document.querySelector("#cloudSignOutBtn");
  const saveNowButton = document.querySelector("#cloudSaveNowBtn");
  document.querySelector("#cloudConflictExportBtn")?.addEventListener("click", () => window.ManimanVaultAccess.downloadEnvelope(cloud.conflictEnvelope));

  if (authForm) {
    authForm.addEventListener("submit", (event) => {
      event.preventDefault();
      signInToCloud(
        document.querySelector("#cloudEmail").value.trim(),
        document.querySelector("#cloudPassword").value
      );
    });
  }

  if (signUpButton) {
    signUpButton.addEventListener("click", () => {
      signUpForCloud(
        document.querySelector("#cloudEmail").value.trim(),
        document.querySelector("#cloudPassword").value
      );
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", signOutOfCloud);
  }

  if (saveNowButton) {
    saveNowButton.addEventListener("click", () => {
      saveStateToCloud();
      showToast("Sync started.");
    });
  }
}

const ACTION_ICON_SHAPES = {
    "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /><path d=\"m15 5 4 4\" />",
    "trash": "<path d=\"M10 11v6\" /><path d=\"M14 11v6\" /><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" /><path d=\"M3 6h18\" /><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" />",
    "save": "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" /><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" /><path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />",
    "x": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
    "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" />",
    "chevron-left": "<path d=\"m15 18-6-6 6-6\" />",
    "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
    "check": "<path d=\"M20 6 9 17l-5-5\" />",
    "eraser": "<path d=\"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21\" /><path d=\"m5.082 11.09 8.828 8.828\" />",
    "plus": "<path d=\"M5 12h14\" /><path d=\"M12 5v14\" />",
    "circle-minus": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M8 12h8\" />"
};
function actionIcon(name) {
  return `<svg class="ui-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ACTION_ICON_SHAPES[name] || ACTION_ICON_SHAPES.plus}</svg>`;
}

function pageHeader(title, subtitle, action) {
  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">${escapeHtml(title)}</h1>
        <p class="view-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      ${action || ""}
    </div>
  `;
}

function storageModeLabel() {
  if (storageMode === "cloud") {
    if (syncStatus === "synced") return "Cloud synced";
    if (syncStatus === "syncing") return "Cloud syncing";
    if (syncStatus === "unsynced") return "Unsynced";
    if (syncStatus === "cloud-unavailable") return "Cloud unavailable";
    if (syncStatus === "cloud-conflict") return "Cloud conflict";
    return "Cloud";
  }
  if (syncStatus === "cloud-conflict") return "Encrypted copy conflict";
  if (storageMode === "server") return "Encrypted browser + local server";
  return "Encrypted browser vault";
}

function metricCard(label, value, note) {
  return `
    <article class="metric-card">
      <p class="metric-label">${escapeHtml(label)}</p>
      <p class="metric-value">${escapeHtml(value)}</p>
      <p class="metric-note">${escapeHtml(note)}</p>
    </article>
  `;
}

function renderCategoryChart(rows) {
  if (!rows.length) return emptyState("No spending this month.");

  const sum = total(rows);
  let cursor = 0;
  const segments = rows.map((row) => {
    const size = sum > 0 ? (row.amount / sum) * 100 : 0;
    const start = cursor;
    cursor += size;
    return `${row.color} ${start}% ${cursor}%`;
  });

  return `
    <div class="chart-wrap">
      <div class="donut" style="background: conic-gradient(${segments.join(", ")})" aria-hidden="true"></div>
      <div class="bar-list">
        ${rows.map((row) => {
          const percent = sum > 0 ? Math.round((row.amount / sum) * 100) : 0;
          return `
            <div class="bar-row">
              <div class="bar-top">
                <strong>${escapeHtml(row.category)}</strong>
                <span>${formatMoney(row.amount)} (${percent}%)</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${percent}%; background:${row.color}"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTrendChart(rows) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.income, row.expense)));
  return `
    <div class="trend-list">
      ${rows.map((row) => `
        <div class="trend-row">
          <div class="trend-label">${escapeHtml(row.label)}</div>
          <div class="trend-bars">
            <div class="trend-track"><div class="trend-fill income" style="width:${Math.round((row.income / max) * 100)}%"></div></div>
            <div class="trend-track"><div class="trend-fill expense" style="width:${Math.round((row.expense / max) * 100)}%"></div></div>
          </div>
          <div class="trend-values">
            <span class="amount income">${formatMoney(row.income)}</span>
            <span class="amount expense">${formatMoney(row.expense)}</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTransactionRow(tx, accountContextId = "") {
  const from = findAccount(tx.accountId);
  const to = findAccount(tx.toAccountId);
  const display = transactionAmountDisplay(tx, accountContextId);
  const accountText = tx.type === "transfer" ? `${from?.name || "Account"} -> ${to?.name || "Account"}` : from?.name || "Account";

  return `
    <div class="transaction-row">
      <div class="transaction-main">
        <p class="transaction-title">
          ${escapeHtml(tx.description)}
          ${tx.type === "transfer" ? `<span class="chip">Transfer</span>` : ""}
        </p>
        <div class="transaction-meta">
          <span>${formatDate(tx.date)}</span>
          <span>${escapeHtml(tx.category)}</span>
          <span>${escapeHtml(accountText)}</span>
          ${(tx.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}
          ${tx.note ? `<span>${escapeHtml(tx.note)}</span>` : ""}
        </div>
      </div>
      <div class="row-actions">
        <span class="amount ${display.amountClass}">${display.sign}${formatMoney(tx.amount)}</span>
        <button class="button ghost small icon" type="button" data-edit-transaction="${escapeHtml(tx.id)}" aria-label="Edit transaction: ${escapeHtml(tx.description)}" title="Edit transaction: ${escapeHtml(tx.description)}">${actionIcon("pencil")}</button>
        <button class="button ghost small icon is-danger" type="button" data-delete-transaction="${escapeHtml(tx.id)}" aria-label="Delete transaction: ${escapeHtml(tx.description)}" title="Delete transaction: ${escapeHtml(tx.description)}">${actionIcon("trash")}</button>
      </div>
    </div>
  `;
}

function transactionAmountDisplay(tx, accountContextId = "") {
  if (tx.type === "transfer") {
    if (accountContextId && tx.toAccountId === accountContextId) return { sign: "+", amountClass: "income" };
    if (accountContextId && tx.accountId === accountContextId) return { sign: "-", amountClass: "expense" };
    return { sign: "", amountClass: "" };
  }
  return {
    sign: tx.type === "income" ? "+" : "-",
    amountClass: tx.type === "income" ? "income" : "expense"
  };
}

function renderPreviewItem(tx) {
  const from = findAccount(tx.accountId);
  const to = findAccount(tx.toAccountId);
  const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
  const accountText = tx.type === "transfer" ? `${from?.name || "Account"} -> ${to?.name || "Account"}` : from?.name || "Account";
  return `
    <div class="preview-item">
      <p class="transaction-title">${escapeHtml(tx.description)} <span class="amount ${tx.type === "transfer" ? "" : tx.type}">${sign}${formatMoney(tx.amount)}</span></p>
      <div class="transaction-meta">
        <span>${escapeHtml(tx.category)}</span>
        <span>${escapeHtml(accountText)}</span>
        <span>${formatDate(tx.date)}</span>
        ${(tx.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderAccountMini(account) {
  const category = findAccountCategory(account.categoryId);
  return `
    <div class="wallet-row">
      <div>
        <p class="row-title">
          <span class="wallet-swatch" style="--swatch:${account.color || category?.color}"></span>
          ${escapeHtml(account.name)}
        </p>
        <div class="row-meta"><span>${escapeHtml(category?.name || "Account")}</span></div>
      </div>
      <span class="amount">${formatMoney(accountBalance(account.id))}</span>
    </div>
  `;
}

function renderAccountGroup(category) {
  const accounts = state.accounts.filter((account) => account.categoryId === category.id);
  if (!accounts.length) return "";
  return `
    <section class="category-group">
      <div class="category-group-header">
        <h3 class="card-title">
          <span class="wallet-swatch" style="--swatch:${category.color}"></span>
          ${escapeHtml(category.name)}
        </h3>
        <span class="chip">${escapeHtml(category.kind)}</span>
      </div>
      <div class="wallet-list">
        ${accounts.map(renderAccountRow).join("")}
      </div>
    </section>
  `;
}

function renderAccountRow(account) {
  const category = findAccountCategory(account.categoryId);
  const checkpoint = latestBalanceCheckpoint(account.id);
  const canDeleteCheckpoint = checkpoint && checkpoint.source !== "account_created";
  return `
    <div class="account-row">
      <div>
        <p class="row-title">
          <span class="wallet-swatch" style="--swatch:${account.color || category?.color}"></span>
          ${escapeHtml(account.name)}
        </p>
        <div class="row-meta">
          <span>${escapeHtml(category?.name || "Account")}</span>
          ${checkpoint ? `<span>${checkpointLabel(checkpoint)}</span>` : `<span>Opening ${formatMoney(account.openingBalance)}</span>`}
        </div>
      </div>
      <div class="row-actions">
        <span class="amount">${formatMoney(accountBalance(account.id))}</span>
        ${canDeleteCheckpoint ? `<button class="button ghost small icon" type="button" data-delete-checkpoint="${checkpoint.id}" data-checkpoint-account="${account.id}" aria-label="Remove balance checkpoint: ${escapeHtml(account.name)}" title="Remove balance checkpoint: ${escapeHtml(account.name)}">${actionIcon("circle-minus")}</button>` : ""}
        <button class="button ghost small icon is-danger" type="button" data-delete-account="${account.id}" aria-label="Delete account: ${escapeHtml(account.name)}" title="Delete account: ${escapeHtml(account.name)}">${actionIcon("trash")}</button>
      </div>
    </div>
  `;
}

function renderAccountActivity(accountId) {
  const account = findAccount(accountId) || state.accounts[0];
  if (!account) return emptyState("No account selected.");
  const movements = sortedTransactions(state.transactions)
    .map((tx) => movementForAccount(tx, account.id))
    .filter(Boolean)
    .slice(0, 12);

  if (!movements.length) return emptyState("No activity for this account.");
  return movements.map((movement) => `
    <div class="transaction-row">
      <div>
        <p class="transaction-title">${escapeHtml(movement.description)}</p>
        <div class="transaction-meta">
          <span>${formatDate(movement.date)}</span>
          <span>${escapeHtml(movement.kind)}</span>
          ${(movement.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <span class="amount ${movement.amount >= 0 ? "income" : "expense"}">${movement.amount >= 0 ? "+" : "-"}${formatMoney(Math.abs(movement.amount))}</span>
    </div>
  `).join("");
}

function movementForAccount(tx, accountId) {
  if (tx.type === "transfer") {
    if (tx.accountId === accountId) return { ...tx, amount: -tx.amount, kind: "Transfer debit" };
    if (tx.toAccountId === accountId) return { ...tx, amount: tx.amount, kind: "Transfer credit" };
    return null;
  }
  if (tx.accountId !== accountId) return null;
  return { ...tx, amount: tx.type === "income" ? tx.amount : -tx.amount, kind: tx.type === "income" ? "Credit" : "Debit" };
}

function renderGoalRow(goal) {
  const progress = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
  return `
    <div class="goal-row">
      <div>
        <p class="row-title">${escapeHtml(goal.name)}</p>
        <div class="progress">
          <div class="progress-track">
            <div class="progress-fill" style="--progress:${progress}%; --progress-color:${goal.color}"></div>
          </div>
          <div class="progress-label">
            <span>${formatMoney(goal.saved)} saved</span>
            <span>${formatMoney(goal.target)} target</span>
          </div>
        </div>
        <div class="row-meta">
          <span>${progress}% funded</span>
          ${goal.dueDate ? `<span>Due ${formatDate(goal.dueDate)}</span>` : ""}
        </div>
      </div>
      <div class="row-actions">
        <input class="control compact" data-goal-saved="${goal.id}" type="number" min="0" step="0.01" value="${goal.saved}">
        <button class="button small icon" type="button" data-save-goal="${goal.id}" aria-label="Save goal progress: ${escapeHtml(goal.name)}" title="Save goal progress: ${escapeHtml(goal.name)}">${actionIcon("save")}</button>
        <button class="button ghost small icon is-danger" type="button" data-delete-goal="${goal.id}" aria-label="Delete goal: ${escapeHtml(goal.name)}" title="Delete goal: ${escapeHtml(goal.name)}">${actionIcon("trash")}</button>
      </div>
    </div>
  `;
}

function renderBillMini(bill) {
  const month = state.settings.selectedMonth;
  const paid = isBillPaid(bill, month);
  return `
    <div class="bill-row">
      <div>
        <p class="row-title">${escapeHtml(bill.name)}</p>
        <div class="row-meta">
          <span>Due ${formatDate(billDateForMonth(bill, month))}</span>
          <span>${escapeHtml(bill.category)}</span>
        </div>
      </div>
      <span class="chip ${paid ? "green" : "amber"}">${paid ? "Paid" : formatMoney(bill.amount)}</span>
    </div>
  `;
}

function renderBillRow(bill) {
  const month = state.settings.selectedMonth;
  const paid = isBillPaid(bill, month);
  const dueDate = billDateForMonth(bill, month);
  const account = findAccount(bill.accountId);
  return `
    <div class="bill-row">
      <div>
        <p class="row-title">${escapeHtml(bill.name)}</p>
        <div class="row-meta">
          <span>${formatMoney(bill.amount)}</span>
          <span>Due ${formatDate(dueDate)}</span>
          <span>${escapeHtml(account?.name || "Account")}</span>
          <span>${escapeHtml(bill.category)}</span>
        </div>
      </div>
      <div class="row-actions">
        <span class="chip ${paid ? "green" : "amber"}">${paid ? "Paid" : "Due"}</span>
        <button class="button small icon" type="button" data-toggle-bill="${escapeHtml(bill.id)}" aria-label="${paid ? "Mark unpaid" : "Mark paid"}: ${escapeHtml(bill.name)}" title="${paid ? "Mark unpaid" : "Mark paid"}: ${escapeHtml(bill.name)}">${actionIcon(paid ? "rotate-ccw" : "check")}</button>
        <button class="button ghost small icon is-danger" type="button" data-delete-bill="${bill.id}" aria-label="Delete bill: ${escapeHtml(bill.name)}" title="Delete bill: ${escapeHtml(bill.name)}">${actionIcon("trash")}</button>
      </div>
    </div>
  `;
}

function renderTagTotalRow(row) {
  const percent = Math.max(2, Math.round((row.amount / row.max) * 100));
  return `
    <div class="bar-row">
      <div class="bar-top">
        <strong>${escapeHtml(row.tag)}</strong>
        <span>${formatMoney(row.amount)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${percent}%; background:${row.color}"></div></div>
    </div>
  `;
}

function renderAccountMixRow(row) {
  const percent = Math.max(2, Math.round(row.percent));
  return `
    <div class="bar-row">
      <div class="bar-top">
        <strong>${escapeHtml(row.name)}</strong>
        <span>${formatMoney(row.amount)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${percent}%; background:${row.color}"></div></div>
    </div>
  `;
}

function renderTagChip(tag) {
  const value = typeof tag === "string" ? { name: tag, color: "#6b7280" } : tag;
  return `<span class="tag-chip" style="--tag-color:${value.color || "#6b7280"}">${escapeHtml(value.name)}</span>`;
}

function accountOptions(selectedId) {
  return state.accounts.map((account) => {
    const category = findAccountCategory(account.categoryId);
    return `<option value="${account.id}" ${account.id === selectedId ? "selected" : ""}>${escapeHtml(account.name)} - ${escapeHtml(category?.name || "Account")}</option>`;
  }).join("");
}

function accountCategoryOptions(selectedId) {
  return state.accountCategories.map((category) => `
    <option value="${category.id}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(category.name)} (${escapeHtml(category.kind)})</option>
  `).join("");
}

function categoryOptions(type, selected) {
  if (type === "transfer") return "";
  return transactionCategories(type).map((category) => `
    <option value="${escapeHtml(category.name)}" ${category.name === selected ? "selected" : ""}>${escapeHtml(category.name)}</option>
  `).join("");
}

function parseQuickEntries(input, options = {}) {
  return splitQuickText(input).map((part) => parseQuickEntry(part, options)).filter(Boolean);
}

function splitQuickText(input) {
  return input
    .split(/\n|;/)
    .flatMap((part) => {
      const pieces = part.split(/,(?!\d{3}\b)/).map((piece) => piece.trim()).filter(Boolean);
      if (pieces.length > 1 && pieces.every(hasNumber)) return pieces;
      return [part.trim()];
    })
    .filter(Boolean);
}

function parseQuickEntry(part, options = {}) {
  const amount = extractAmount(part);
  if (!amount || amount <= 0) return null;

  const type = detectType(part);
  const transferAccounts = type === "transfer" ? detectTransferAccounts(part) : null;
  const category = type === "transfer" ? "Transfer" : detectCategory(part, type);
  const account = transferAccounts?.from || detectAccount(part) || findAccount(options.defaultAccountId) || state.accounts[0];
  const toAccount = transferAccounts?.to || null;
  const date = detectDate(part);
  const description = cleanDescription(part, amount, account, category) || category;
  const tags = detectTags(`${description} ${category} ${part}`);
  ensureTags(tags);

  if (type === "transfer" && (!account || !toAccount || account.id === toAccount.id)) return null;

  return {
    id: uid("tx"),
    type,
    amount,
    description,
    category,
    accountId: account?.id || state.accounts[0]?.id || "",
    toAccountId: type === "transfer" ? toAccount?.id || "" : "",
    date,
    note: "",
    tags,
    billId: null,
    importBatchId: ""
  };
}

function isStatementEnvelope(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.format === "maniman.statement");
}

function statementDocumentIdentity(value) {
  return value.source.documentFingerprint || value.source.documentId;
}

function statementObservationIdentity(documentValue, section, row) {
  return JSON.stringify([statementDocumentIdentity(documentValue), section.statementId, row.observationId]);
}

function statementSourceMappingKey(institution, account) {
  if (!institution || !account.maskedIdentifier) return "";
  return JSON.stringify([institution.trim().toLowerCase(), account.kind || "unknown", account.maskedIdentifier.trim().toUpperCase(), account.currency || ""]);
}

function statementIssueErrors(value) {
  const issues = [...(value.issues || [])];
  (value.statements || []).forEach((section) => {
    issues.push(...(section.extraction?.issues || []));
    (section.transactions || []).forEach((row) => issues.push(...(row.issues || [])));
  });
  const errors = issues.filter((issue) => issue.severity === "error").map(() => "Resolve converter errors before importing this statement.");
  (value.statements || []).forEach((section) => {
    if (section.extraction?.status !== "complete" || section.extraction?.excludedRows?.length) {
      errors.push("This extraction is incomplete. Resolve excluded or missing rows in the local converter first.");
    }
  });
  return [...new Set(errors)];
}

function stageStatementImport(value, options = {}) {
  if (!state || !window.ManimanSecureStorage?.isUnlocked()) return showToast("Unlock the vault before reviewing statement files.");
  if (!window.ManimanStatement) {
    showToast("The statement validator is unavailable. Reload the app before importing.");
    return;
  }
  const validation = window.ManimanStatement.validateStatementDocument(value);
  pendingStatementImport = {
    document: value,
    validation,
    options,
    institutionName: value.institution?.name || "",
    sections: validation.valid ? value.statements.map((section) => {
      const mappingKey = statementSourceMappingKey(value.institution?.name, section.account);
      const accountId = confirmedStatementMappingAccount(state, mappingKey);
      return {
        accountId,
        newAccountName: "",
        newAccountKind: section.account.kind || "savings",
        periodStart: section.period?.start || "",
        periodEnd: section.period?.end || "",
        rows: section.transactions.map(() => ({ type: "", toAccountId: "", linkTransactionId: "" }))
      };
    }) : [],
    page: 0,
    reviewed: false,
    error: ""
  };
  activeView = "imports";
  render();
  document.querySelector("#statementImportPreview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearStatementImport() {
  pendingStatementImport = null;
}

function confirmedStatementMappingAccount(currentState, key) {
  if (!key) return "";
  const candidates = new Set((currentState.statementMappings || []).filter((mapping) => mapping.key === key && currentState.accounts.some((account) => account.id === mapping.accountId)).map((mapping) => mapping.accountId));
  return candidates.size === 1 ? [...candidates][0] : "";
}

if (typeof window.addEventListener === "function") {
  window.addEventListener("maniman-vault-locked", clearStatementImport);
}

function statementMatchCandidates(row, accountId, currentState) {
  const exponent = window.ManimanStatement.currencyExponent(row.currency);
  return currentState.transactions.filter((tx) =>
    (tx.accountId === accountId || tx.toAccountId === accountId)
    && tx.date === row.transactionDate
    && Math.round(tx.amount * (10 ** exponent)) === row.amountMinor
    && (!tx.currency || tx.currency === row.currency)
  );
}

function renderStatementImportPreview() {
  const pending = pendingStatementImport;
  if (!pending) return "";
  const { document: input, validation } = pending;
  const warnings = validation.warnings || [];
  const errors = [...(validation.errors || []).map((item) => `${item.path}: ${item.message}`), ...(validation.valid ? statementIssueErrors(input) : [])];
  const locked = !window.ManimanSecureStorage?.isUnlocked();
  const sections = validation.valid ? input.statements.map((section, sectionIndex) => {
    const config = pending.sections[sectionIndex];
    return `<fieldset class="statement-section"><legend>Account ${sectionIndex + 1}: ${escapeHtml(section.account.maskedIdentifier || "identifier unavailable")}</legend>
      <p class="muted">Source account type: ${escapeHtml(section.account.kind || "unknown")} · Currency: ${escapeHtml(section.account.currency || "unknown")}</p>
      <div class="form-grid">
        <label class="field span-6"><span class="field-label">Use account</span><select class="control" data-statement-account="${sectionIndex}">
          <option value="">Choose an account explicitly</option>${state.accounts.map((account) => `<option value="${escapeHtml(account.id)}" ${config.accountId === account.id ? "selected" : ""}>${escapeHtml(account.name)}</option>`).join("")}
          <option value="__new__" ${config.accountId === "__new__" ? "selected" : ""}>Create an account</option></select></label>
        ${config.accountId === "__new__" ? `<label class="field span-6"><span class="field-label">New account alias</span><input class="control" data-statement-section="${sectionIndex}" data-statement-property="newAccountName" value="${escapeHtml(config.newAccountName)}" placeholder="Choose a memorable account name"></label>
          <label class="field span-6"><span class="field-label">New account type</span><select class="control" data-statement-section="${sectionIndex}" data-statement-property="newAccountKind">${["savings", "current", "credit_card", "wallet", "cash", "investment"].map((kind) => `<option value="${kind}" ${config.newAccountKind === kind ? "selected" : ""}>${kind.replace(/_/g, " ")}</option>`).join("")}</select></label>` : ""}
        <label class="field span-3"><span class="field-label">Confirm statement start</span><input class="control" type="date" data-statement-section="${sectionIndex}" data-statement-property="periodStart" value="${escapeHtml(config.periodStart)}"></label>
        <label class="field span-3"><span class="field-label">Confirm statement end</span><input class="control" type="date" data-statement-section="${sectionIndex}" data-statement-property="periodEnd" value="${escapeHtml(config.periodEnd)}"></label>
      </div>
      <p class="muted">Observed transaction dates: ${escapeHtml(section.observedTransactionRange?.start || "none")} – ${escapeHtml(section.observedTransactionRange?.end || "none")}. This is separate from statement coverage.</p>
    </fieldset>`;
  }).join("") : "";
  const flattened = validation.valid ? input.statements.flatMap((section, sectionIndex) => section.transactions.map((row, rowIndex) => ({ row, rowIndex, sectionIndex }))) : [];
  const pageSize = 30;
  const pageRows = flattened.slice(pending.page * pageSize, (pending.page + 1) * pageSize);
  const rows = pageRows.map(({ row, rowIndex, sectionIndex }) => {
    const config = pending.sections[sectionIndex];
    const choice = config.rows[rowIndex];
    const existingObservation = (state.statementObservations || []).find((item) => item.id === statementObservationIdentity(input, input.statements[sectionIndex], row));
    const candidates = config.accountId && config.accountId !== "__new__" ? statementMatchCandidates(row, config.accountId, state) : [];
    const rowKey = `${sectionIndex}:${rowIndex}`;
    return `<tr><td>${escapeHtml(row.transactionDate)}<br><span class="muted">Account ${sectionIndex + 1}</span></td><td class="statement-description">${escapeHtml(row.description)}<br><span class="muted">PDF page ${row.sourceLocation?.page || "?"}, row ${row.sourceLocation?.row || "?"}</span></td>
      <td>${escapeHtml(row.currency)} ${(row.amountMinor / (10 ** window.ManimanStatement.currencyExponent(row.currency))).toLocaleString(undefined, { minimumFractionDigits: window.ManimanStatement.currencyExponent(row.currency) })}<br>${escapeHtml(row.direction)}</td>
      <td>${existingObservation ? `<span class="chip">Already imported</span>` : `<select class="control" aria-label="Transaction treatment" data-statement-row="${rowKey}" data-statement-field="type"><option value="">Choose treatment</option>${["expense", "income", "transfer"].map((type) => `<option value="${type}" ${choice.type === type ? "selected" : ""}>${titleCase(type)}</option>`).join("")}</select>
        ${choice.type === "transfer" ? `<select class="control" aria-label="Other owned account" data-statement-row="${rowKey}" data-statement-field="toAccountId"><option value="">Other owned account</option>${state.accounts.filter((account) => account.id !== config.accountId).map((account) => `<option value="${escapeHtml(account.id)}" ${choice.toAccountId === account.id ? "selected" : ""}>${escapeHtml(account.name)}</option>`).join("")}</select>` : ""}
        ${candidates.length ? `<select class="control" aria-label="Link existing transaction" data-statement-row="${rowKey}" data-statement-field="linkTransactionId"><option value="">Create a new transaction</option>${candidates.map((tx) => `<option value="${escapeHtml(tx.id)}" ${choice.linkTransactionId === tx.id ? "selected" : ""}>Link: ${escapeHtml(tx.description)}</option>`).join("")}</select>` : ""}`}</td></tr>`;
  }).join("");
  return `<article id="statementImportPreview" class="card statement-preview">
    <div class="card-header"><h2 class="card-title">Review statement JSON</h2><button id="statementCancelBtn" type="button" class="button ghost small icon" aria-label="Discard statement preview" title="Discard statement preview">${actionIcon("x")}</button></div>
    <p>Review account identity, coverage and transaction treatment before saving. Equal amounts and dates are suggestions for linking, not proof of a duplicate.</p>
    ${locked ? `<p class="statement-warning">Unlock the encrypted local vault before committing statement data. <button class="button ghost small" data-jump-view="settings" type="button">Open Settings</button></p>` : ""}
    ${errors.length ? `<div class="statement-error" role="alert"><strong>Import blocked</strong><ul>${errors.slice(0, 10).map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : ""}
    ${warnings.length ? `<details class="statement-warning"><summary>${warnings.length} extraction/metadata warnings</summary><ul>${warnings.slice(0, 30).map((item) => `<li>${escapeHtml(`${item.path}: ${item.message}`)}</li>`).join("")}</ul></details>` : ""}
    ${pending.error ? `<p class="statement-error" role="alert">${escapeHtml(pending.error)}</p>` : ""}
    ${validation.valid ? `<label class="field"><span class="field-label">Confirm institution name</span><input id="statementInstitution" class="control" value="${escapeHtml(pending.institutionName)}" placeholder="Bank, card issuer or wallet"></label>${sections}
      <div class="row-actions"><button id="statementMarkDebits" class="button ghost small" type="button">Mark debit rows as expenses</button><button id="statementMarkCredits" class="button ghost small" type="button">Mark credit rows as income</button></div>
      <p class="muted">Use these bulk actions only after reviewing transfers, refunds, lending and repayments. Linking an existing transaction preserves its classification.</p>
      <div class="statement-table-scroll"><table class="statement-table"><thead><tr><th>Date</th><th>Source narration</th><th>Movement</th><th>Confirmed treatment</th></tr></thead><tbody>${rows || `<tr><td colspan="4">No transaction rows.</td></tr>`}</tbody></table></div>
      <div class="row-actions"><button id="statementPrevPage" class="button ghost small icon" aria-label="Previous page" title="Previous page" type="button" ${pending.page === 0 ? "disabled" : ""}>${actionIcon("chevron-left")}</button><span>Rows ${flattened.length ? pending.page * pageSize + 1 : 0}–${Math.min((pending.page + 1) * pageSize, flattened.length)} of ${flattened.length}</span><button id="statementNextPage" class="button ghost small icon" aria-label="Next page" title="Next page" type="button" ${(pending.page + 1) * pageSize >= flattened.length ? "disabled" : ""}>${actionIcon("chevron-right")}</button></div>
      <label class="statement-review-check"><input id="statementUseCheckpoints" type="checkbox" ${pending.options.createCheckpoint !== false ? "checked" : ""}> Use statement closing balances as checkpoints when their sign convention is known.</label>
      <label class="statement-review-check"><input id="statementReviewed" type="checkbox" ${pending.reviewed ? "checked" : ""}> I reviewed all transaction treatments, account mappings, dates and extraction warnings.</label>
      <button id="statementCommitBtn" class="button" type="button" ${locked || errors.length ? "disabled" : ""}>Save reviewed statement to encrypted vault</button>` : ""}
  </article>`;
}

function renderStatementImportHistory() {
  const batches = (state.importBatches || []).filter((batch) => batch.kind === "statement").slice(-5).reverse();
  if (!batches.length) return "";
  return `<article class="card"><h2 class="card-title">Recent statement imports</h2><p class="muted">Undo removes this batch's evidence. Transactions with other evidence or later edits are retained.</p>${batches.map((batch) => `<div class="statement-batch"><div><strong>${escapeHtml(batch.institution)}</strong><br><span class="muted">${escapeHtml(batch.createdAt.slice(0, 10))} · ${batch.observationIds.length} source rows</span></div><button type="button" class="button ghost small icon" data-undo-statement="${escapeHtml(batch.id)}" aria-label="Undo statement import" title="Undo statement import">${actionIcon("rotate-ccw")}</button></div>`).join("")}</article>`;
}

function bindStatementImportEvents() {
  const pending = pendingStatementImport;
  document.querySelector("#statementCancelBtn")?.addEventListener("click", () => { clearStatementImport(); render(); });
  document.querySelector("#statementInstitution")?.addEventListener("input", (event) => { if (pending) pending.institutionName = event.target.value; });
  document.querySelectorAll("[data-statement-account]").forEach((input) => input.addEventListener("change", (event) => {
    pending.sections[Number(input.dataset.statementAccount)].accountId = event.target.value;
    pending.reviewed = false;
    render();
  }));
  document.querySelectorAll("[data-statement-section]").forEach((input) => input.addEventListener("change", (event) => {
    pending.sections[Number(input.dataset.statementSection)][input.dataset.statementProperty] = event.target.value;
    pending.reviewed = false;
  }));
  document.querySelectorAll("[data-statement-row]").forEach((input) => input.addEventListener("change", (event) => {
    const [sectionIndex, rowIndex] = input.dataset.statementRow.split(":").map(Number);
    pending.sections[sectionIndex].rows[rowIndex][input.dataset.statementField] = event.target.value;
    pending.reviewed = false;
    render();
  }));
  [["#statementMarkDebits", "debit", "expense"], ["#statementMarkCredits", "credit", "income"]].forEach(([selector, direction, type]) => {
    document.querySelector(selector)?.addEventListener("click", () => {
      pending.document.statements.forEach((section, index) => section.transactions.forEach((row, rowIndex) => {
        if (row.direction === direction && !pending.sections[index].rows[rowIndex].type) pending.sections[index].rows[rowIndex].type = type;
      }));
      pending.reviewed = false;
      render();
    });
  });
  document.querySelector("#statementPrevPage")?.addEventListener("click", () => { pending.page -= 1; render(); });
  document.querySelector("#statementNextPage")?.addEventListener("click", () => { pending.page += 1; render(); });
  document.querySelector("#statementReviewed")?.addEventListener("change", (event) => { pending.reviewed = event.target.checked; });
  document.querySelector("#statementUseCheckpoints")?.addEventListener("change", (event) => { pending.options.createCheckpoint = event.target.checked; pending.reviewed = false; document.querySelector("#statementReviewed").checked = false; });
  document.querySelector("#statementCommitBtn")?.addEventListener("click", commitPendingStatementImport);
  document.querySelectorAll("[data-undo-statement]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.ManimanSecureStorage?.isUnlocked()) return showToast("Unlock the encrypted vault before undoing an import.");
    const next = undoStatementImportBatch(state, button.dataset.undoStatement);
    const owner = window.ManimanSecureStorage.namespace();
    setVaultOperationBusy(true);
    try {
      await window.ManimanSecureStorage.save(next);
      if (!window.ManimanSecureStorage.isUnlocked() || owner !== window.ManimanSecureStorage.namespace()) return;
      state = next;
      render();
      syncEncryptedState();
      showToast("Import evidence removed. Other evidence and edited transactions were retained.");
    } catch (error) {
      showToast("Could not save the undo. The current ledger is unchanged.");
    } finally { setVaultOperationBusy(false); }
  }));
}

function statementCategoryForKind(kind, categories) {
  const id = /credit/.test(kind) ? "acctcat_credit" : kind === "wallet" ? "acctcat_wallet" : kind === "cash" ? "acctcat_cash" : kind === "investment" ? "acctcat_mutual_funds" : "acctcat_savings";
  return categories.some((item) => item.id === id) ? id : categories[0]?.id || "";
}

function buildStatementImportPlan(input, currentState, configuration) {
  const validation = window.ManimanStatement.validateStatementDocument(input);
  if (!validation.valid) return { valid: false, errors: validation.errors.map((item) => `${item.path}: ${item.message}`) };
  const errors = statementIssueErrors(input);
  if (!configuration.reviewed) errors.push("Confirm that you reviewed every row, mapping and warning.");
  const institution = String(configuration.institutionName || "").trim();
  if (!institution) errors.push("Confirm the institution name.");
  const next = JSON.parse(JSON.stringify(currentState));
  next.statementObservations ||= [];
  next.importBatches ||= [];
  next.statementMappings ||= [];
  const batch = { id: uid("import"), kind: "statement", documentId: statementDocumentIdentity(input), createdAt: new Date().toISOString(), institution, source: input.source, statements: [], observationIds: [], createdTransactionIds: [], createdAccountIds: [], checkpointIds: [], transactionSnapshots: {}, skippedCount: 0, linkedCount: 0 };
  let addedCoverage = 0;
  const currentCurrency = currentState.settings.currency;
  input.statements.forEach((section, sectionIndex) => {
    const config = configuration.sections?.[sectionIndex];
    if (!config) return errors.push(`Account ${sectionIndex + 1}: confirm the account mapping.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(config.periodStart || "") || !isValidDateParts(...String(config.periodStart).split("-").map(Number)) || !/^\d{4}-\d{2}-\d{2}$/.test(config.periodEnd || "") || !isValidDateParts(...String(config.periodEnd).split("-").map(Number)) || config.periodStart > config.periodEnd) {
      errors.push(`Account ${sectionIndex + 1}: confirm a valid statement start and end date.`);
    }
    const currency = section.account.currency || section.transactions[0]?.currency;
    if (currency !== currentCurrency || section.transactions.some((row) => row.currency !== currentCurrency)) {
      errors.push(`Account ${sectionIndex + 1}: this release requires statement currency to match the app currency (${currentCurrency}). Change the app currency or import into a matching vault.`);
    }
    let account = next.accounts.find((item) => item.id === config.accountId);
    if (config.accountId === "__new__") {
      const name = String(config.newAccountName || "").trim();
      if (!name || next.accounts.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        errors.push(`Account ${sectionIndex + 1}: choose a unique new account alias.`);
      } else {
        account = { id: uid("account"), name, institution, kind: config.newAccountKind || section.account.kind || "savings", maskedIdentifier: section.account.maskedIdentifier || "", currency, categoryId: statementCategoryForKind(config.newAccountKind || section.account.kind || "savings", next.accountCategories), openingBalance: 0, openingBalanceDate: "", balanceCheckpoints: [], color: "#0f766e" };
        next.accounts.push(account);
        batch.createdAccountIds.push(account.id);
      }
    }
    if (!account) return errors.push(`Account ${sectionIndex + 1}: select or create an account.`);
    if (account.currency && account.currency !== currency) errors.push(`Account ${sectionIndex + 1}: the selected account has a different currency.`);
    const sectionObservationStart = batch.observationIds.length;
    const alreadyCovered = (currentState.importBatches || []).some((item) => item.kind === "statement" && item.documentId === batch.documentId && item.statements.some((previous) => previous.statementId === section.statementId && previous.accountId === account.id && previous.period.start === config.periodStart && previous.period.end === config.periodEnd));
    if (!alreadyCovered) addedCoverage += 1;
    const coverage = { statementId: section.statementId, accountId: account.id, account: section.account, period: { start: config.periodStart, end: config.periodEnd, status: "user_confirmed" }, originalPeriod: section.period, observedTransactionRange: section.observedTransactionRange, extraction: section.extraction };
    batch.statements.push(coverage);
    const mappingKey = statementSourceMappingKey(institution, section.account);
    if (mappingKey) {
      const known = next.statementMappings.some((item) => item.key === mappingKey && item.accountId === account.id);
      if (!known) next.statementMappings.push({ key: mappingKey, accountId: account.id, confirmedAt: batch.createdAt, importBatchId: batch.id });
    }
    section.transactions.forEach((row, rowIndex) => {
      const identity = statementObservationIdentity(input, section, row);
      const prior = next.statementObservations.find((item) => item.id === identity);
      if (prior) {
        if (prior.accountId !== account.id || stableStatementStringify(prior.data) !== stableStatementStringify(row) || !next.transactions.some((tx) => tx.id === prior.transactionId)) errors.push(`Account ${sectionIndex + 1}, row ${rowIndex + 1}: source identity conflicts with an existing observation or its transaction is missing. Reconcile the changed evidence before import.`);
        else batch.skippedCount += 1;
        return;
      }
      const choice = config.rows?.[rowIndex] || {};
      const factor = 10 ** window.ManimanStatement.currencyExponent(row.currency);
      let transaction;
      if (choice.linkTransactionId) {
        transaction = statementMatchCandidates(row, account.id, next).find((item) => item.id === choice.linkTransactionId);
        if (!transaction) return errors.push(`Account ${sectionIndex + 1}, row ${rowIndex + 1}: the selected existing transaction does not match this movement.`);
        const existingLeg = next.statementObservations.filter((item) => item.transactionId === transaction.id && item.accountId === account.id && item.documentId === statementDocumentIdentity(input));
        if (existingLeg.length) return errors.push(`Account ${sectionIndex + 1}, row ${rowIndex + 1}: two rows in the same document cannot be linked to the same account movement.`);
        const movement = transaction.type === "transfer" ? transaction.toAccountId === account.id ? "credit" : "debit" : transaction.type === "income" ? "credit" : "debit";
        if (movement !== row.direction) return errors.push(`Account ${sectionIndex + 1}, row ${rowIndex + 1}: debit/credit direction conflicts with the selected transaction.`);
        batch.linkedCount += 1;
      } else {
        if (!["expense", "income", "transfer"].includes(choice.type)) return errors.push(`Account ${sectionIndex + 1}, row ${rowIndex + 1}: choose a transaction treatment or explicitly link an existing transaction.`);
        if (choice.type === "expense" && row.direction !== "debit" || choice.type === "income" && row.direction !== "credit") return errors.push(`Account ${sectionIndex + 1}, row ${rowIndex + 1}: treatment conflicts with the statement direction.`);
        let fromAccountId = account.id;
        let toAccountId = "";
        if (choice.type === "transfer") {
          const other = next.accounts.find((item) => item.id === choice.toAccountId);
          if (!other || other.id === account.id || other.currency && other.currency !== row.currency) return errors.push(`Account ${sectionIndex + 1}, row ${rowIndex + 1}: choose a different owned account with the same currency for this transfer.`);
          fromAccountId = row.direction === "debit" ? account.id : other.id;
          toAccountId = row.direction === "debit" ? other.id : account.id;
        }
        transaction = { id: uid("tx"), type: choice.type, amount: row.amountMinor / factor, amountMinor: row.amountMinor, currency: row.currency, date: row.transactionDate, description: row.description, category: choice.type === "transfer" ? "Transfer" : "Other", accountId: fromAccountId, toAccountId, note: "", tags: [], billId: null, importBatchId: batch.id, classificationStatus: "purpose_unassigned", paymentRail: row.hints?.paymentRail || "", statementEvidence: [] };
        next.transactions.push(transaction);
        batch.createdTransactionIds.push(transaction.id);
      }
      transaction.statementEvidence ||= [];
      transaction.statementEvidence.push(identity);
      next.statementObservations.push({ id: identity, documentId: statementDocumentIdentity(input), statementId: section.statementId, accountId: account.id, transactionId: transaction.id, importBatchId: batch.id, data: row });
      batch.observationIds.push(identity);
    });
    if (configuration.options?.createCheckpoint !== false && section.balances?.closing && (!alreadyCovered || batch.observationIds.length > sectionObservationStart)) {
      if (!["positive_asset_balance", "positive_liability_balance", "signed_balance"].includes(section.balances.signConvention)) {
        errors.push(`Account ${sectionIndex + 1}: closing-balance sign is unknown. Disable balance checkpoints or correct the converter output.`);
        return;
      }
      const closing = section.balances.closing;
      const factor = 10 ** window.ManimanStatement.currencyExponent(currency);
      const balance = section.balances.signConvention === "positive_liability_balance" ? -closing.amountMinor / factor : closing.amountMinor / factor;
      account.balanceCheckpoints ||= [];
      const existingCheckpoint = account.balanceCheckpoints.find((item) => item.date === closing.date && item.position === "end" && item.balance === balance);
      if (!existingCheckpoint) {
        const checkpoint = { id: uid("checkpoint"), date: closing.date, balance, position: closing.position === "start" ? "start" : "end", source: "bank_statement", note: "Reviewed statement closing balance", importBatchId: batch.id, statementOwned: true, statementBatchIds: [batch.id] };
        account.balanceCheckpoints.push(checkpoint);
        batch.checkpointIds.push(checkpoint.id);
      } else {
        existingCheckpoint.statementBatchIds ||= [];
        existingCheckpoint.statementBatchIds.push(batch.id);
        batch.checkpointIds.push(existingCheckpoint.id);
      }
    }
  });
  if (errors.length) return { valid: false, errors: [...new Set(errors)] };
  batch.createdTransactionIds.forEach((id) => {
    const transaction = next.transactions.find((item) => item.id === id);
    batch.transactionSnapshots[id] = statementTransactionSnapshot(transaction);
    transaction.statementOrigin = { importBatchId: batch.id, snapshot: batch.transactionSnapshots[id] };
  });
  const noChanges = batch.observationIds.length === 0 && addedCoverage === 0;
  if (!noChanges) next.importBatches.push(batch);
  return { valid: true, nextState: noChanges ? currentState : next, batch, noChanges, errors: [] };
}

function statementTransactionSnapshot(transaction) {
  const { statementEvidence, statementOrigin, ...rest } = transaction;
  return stableStatementStringify(rest);
}

function stableStatementStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStatementStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStatementStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function undoStatementImportBatch(currentState, batchId) {
  const next = JSON.parse(JSON.stringify(currentState));
  const batch = (next.importBatches || []).find((item) => item.id === batchId && item.kind === "statement");
  if (!batch) return next;
  const observationsToRemove = new Set(batch.observationIds);
  next.statementObservations = (next.statementObservations || []).filter((item) => !observationsToRemove.has(item.id));
  next.transactions = next.transactions.filter((transaction) => {
    transaction.statementEvidence = (transaction.statementEvidence || []).filter((id) => !observationsToRemove.has(id));
    const createdByStatement = transaction.statementOrigin || batch.createdTransactionIds.includes(transaction.id);
    if (!createdByStatement || transaction.statementEvidence.length) return true;
    const snapshot = transaction.statementOrigin?.snapshot || batch.transactionSnapshots?.[transaction.id];
    const unedited = snapshot === statementTransactionSnapshot(transaction);
    if (!unedited) { transaction.importBatchId = ""; transaction.statementOrigin = null; }
    return !unedited;
  });
  next.accounts.forEach((account) => {
    account.balanceCheckpoints = (account.balanceCheckpoints || []).filter((item) => {
      if (!batch.checkpointIds.includes(item.id)) return true;
      item.statementBatchIds = (item.statementBatchIds || []).filter((id) => id !== batchId);
      return !item.statementOwned || item.statementBatchIds.length > 0;
    });
  });
  next.statementMappings = (next.statementMappings || []).filter((item) => item.importBatchId !== batchId || next.statementObservations.some((observation) => observation.accountId === item.accountId));
  next.importBatches = next.importBatches.filter((item) => item.id !== batchId);
  return next;
}

function setVaultOperationBusy(busy) {
  vaultOperationDepth = Math.max(0, vaultOperationDepth + (busy ? 1 : -1));
  const shell = document.querySelector(".shell");
  if (shell) { shell.inert = vaultOperationDepth > 0 || !window.ManimanSecureStorage?.isUnlocked(); shell.setAttribute("aria-busy", String(vaultOperationDepth > 0)); }
}

async function commitPendingStatementImport() {
  const pending = pendingStatementImport;
  if (!pending || !window.ManimanSecureStorage?.isUnlocked()) return showToast("Unlock the encrypted vault before importing statements.");
  const plan = buildStatementImportPlan(pending.document, state, pending);
  if (!plan.valid) { pending.error = plan.errors.slice(0, 8).join(" "); render(); return; }
  if (plan.noChanges) { clearStatementImport(); render(); showToast("Every source row was already imported. The ledger is unchanged."); return; }
  const button = document.querySelector("#statementCommitBtn");
  if (button) button.disabled = true;
  setVaultOperationBusy(true);
  try {
    await window.ManimanSecureStorage.save(plan.nextState);
    if (pendingStatementImport !== pending || !window.ManimanSecureStorage.isUnlocked()) return;
    state = plan.nextState;
    clearStatementImport();
    render();
    syncEncryptedState();
    showToast(`${plan.batch.createdTransactionIds.length} transactions saved; ${plan.batch.linkedCount} existing transactions linked; ${plan.batch.skippedCount} source rows already present.`);
  } catch (error) {
    if (pendingStatementImport === pending) { pending.error = "Encrypted save failed. The current ledger is unchanged; retry after checking vault storage."; render(); }
  } finally { setVaultOperationBusy(false); }
}

function importTransactionText(text, fileName = "", options = {}) {
  if (vaultOperationDepth > 0) return showToast("Wait for the current vault operation to finish before importing another file.");
  if (text.length > 20 * 1024 * 1024) return showToast("Import content must be 20 MB or smaller.");
  try {
    const value = JSON.parse(text);
    if (isStatementEnvelope(value)) { stageStatementImport(value, options); return; }
    if (value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.accounts)) return showToast("This is an app backup. Use Settings → Import backup instead of transaction upload.");
  } catch (error) {
    // Plain text and CSV are handled by the existing transaction parser below.
  }
  const result = parseTransactionUpload(text, fileName, options);
  const { unique, skipped } = uniqueTransactions(result.transactions);
  const importBatchId = result.checkpoint && unique.length ? uid("import") : "";
  if (importBatchId) {
    unique.forEach((tx) => {
      tx.importBatchId = importBatchId;
    });
    result.checkpoint.importBatchId = importBatchId;
  }
  const checkpointAdded = result.checkpoint && options.createCheckpoint !== false
    ? addBalanceCheckpoint(result.checkpoint.accountId, result.checkpoint)
    : false;

  if (!unique.length && !checkpointAdded) {
    showToast("No valid entries found.");
    return;
  }

  if (unique.length) addTransactions(unique);
  saveState();
  const parts = [];
  if (unique.length) parts.push(`${unique.length} entr${unique.length === 1 ? "y" : "ies"} imported`);
  if (skipped) parts.push(`${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`);
  if (checkpointAdded) parts.push("balance checkpoint saved");
  showToast(`${parts.join(", ")}.`);
  render();
}

function parseTransactionUpload(text, fileName = "", options = {}) {
  const trimmed = text.trim();
  if (!trimmed) return { transactions: [], checkpoint: null };

  if (fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.transactions) ? parsed.transactions : [];
      return importResultFromRows(rows, { ...options, preferDayFirst: false });
    } catch (error) {
      return { transactions: [], checkpoint: null };
    }
  }

  const firstLine = trimmed.split(/\r?\n/)[0] || "";
  if (firstLine.includes(",") && looksLikeCsvHeader(firstLine)) {
    return importResultFromRows(parseCsvRows(trimmed), { ...options, preferDayFirst: true, fileName });
  }

  return { transactions: parseQuickEntries(trimmed, options), checkpoint: null };
}

function importResultFromRows(rows, options = {}) {
  const transactions = rows.map((row) => transactionFromObject(row, options)).filter(Boolean);
  return {
    transactions,
    checkpoint: statementCheckpointFromRows(rows, options)
  };
}

function looksLikeCsvHeader(line) {
  const headers = parseCsvLine(line).map((header) => comparableFieldName(header));
  const amountHeaders = new Set([
    ...STATEMENT_FIELD_ALIASES.amount,
    ...STATEMENT_FIELD_ALIASES.debit,
    ...STATEMENT_FIELD_ALIASES.credit
  ].map(comparableFieldName));
  const detailHeaders = new Set([
    ...STATEMENT_FIELD_ALIASES.date,
    ...STATEMENT_FIELD_ALIASES.description
  ].map(comparableFieldName));
  return headers.some((header) => amountHeaders.has(header))
    && headers.some((header) => detailHeaders.has(header));
}

function parseCsvRows(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const headers = rows.shift().map((header) => normalizeFieldName(header));
  return rows.map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index] || "";
    });
    return object;
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function valueFromRow(row, aliases) {
  if (!row) return "";
  const wanted = new Set(aliases.map(comparableFieldName));
  const key = Object.keys(row).find((item) => wanted.has(comparableFieldName(item)));
  return key ? row[key] : "";
}

function numberFromRow(row, aliases) {
  const value = valueFromRow(row, aliases);
  return parseMoneyValue(value);
}

function parseMoneyValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return null;
  const negative = /^\s*-/.test(raw) || /\(.+\)/.test(raw) || /\bdr\b/i.test(raw);
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "").replace(/(?!^)-/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative && parsed > 0 ? -parsed : parsed;
}

function transactionFromObject(row, options = {}) {
  const explicitType = String(valueFromRow(row, STATEMENT_FIELD_ALIASES.type) || "").toLowerCase();
  const debit = Math.abs(numberFromRow(row, STATEMENT_FIELD_ALIASES.debit) || 0);
  const credit = Math.abs(numberFromRow(row, STATEMENT_FIELD_ALIASES.credit) || 0);
  const rawAmount = numberFromRow(row, STATEMENT_FIELD_ALIASES.amount);
  const amount = debit || credit || Math.abs(rawAmount || 0);
  if (!amount) return null;

  const description = String(valueFromRow(row, STATEMENT_FIELD_ALIASES.description) || "Transaction").trim();
  const toAccount = findAccountByNameOrId(valueFromRow(row, STATEMENT_FIELD_ALIASES.toAccount) || "");
  const isCredit = credit > 0 || /\b(income|credit|cr|deposit|received|receipt)\b/.test(explicitType);
  const isDebit = debit > 0 || /\b(expense|debit|dr|withdrawal|paid|payment)\b/.test(explicitType);
  const type = explicitType === "transfer" || toAccount ? "transfer" : isCredit || (!isDebit && Number(rawAmount) > 0) ? "income" : "expense";
  const account = findAccountByNameOrId(valueFromRow(row, STATEMENT_FIELD_ALIASES.account) || "")
    || findAccount(options.defaultAccountId)
    || detectAccount(description)
    || state.accounts[0];
  const category = type === "transfer" ? "Transfer" : valueFromRow(row, STATEMENT_FIELD_ALIASES.category) || detectCategory(description, type);
  const explicitTags = normalizeTagInput(valueFromRow(row, STATEMENT_FIELD_ALIASES.tags) || "");
  const tags = explicitTags.length ? explicitTags : detectTags(`${description} ${category}`);
  ensureTags(tags);

  if (type === "transfer" && (!account || !toAccount || account.id === toAccount.id)) return null;

  return {
    id: valueFromRow(row, ["id"]) || uid("tx"),
    type,
    amount,
    description,
    category,
    accountId: account?.id || state.accounts[0]?.id || "",
    toAccountId: type === "transfer" ? toAccount?.id || "" : "",
    date: normalizeDate(valueFromRow(row, STATEMENT_FIELD_ALIASES.date) || todayIso(), { dayFirst: options.preferDayFirst }),
    note: valueFromRow(row, STATEMENT_FIELD_ALIASES.note) || "",
    tags,
    billId: null,
    importBatchId: valueFromRow(row, ["importBatchId", "import_batch_id"]) || ""
  };
}

function statementCheckpointFromRows(rows, options = {}) {
  if (options.createCheckpoint === false) return null;
  const account = findAccount(options.defaultAccountId) || state.accounts[0];
  if (!account) return null;

  return rows.reduce((latest, row) => {
    const balance = numberFromRow(row, STATEMENT_FIELD_ALIASES.balance);
    const dateValue = valueFromRow(row, STATEMENT_FIELD_ALIASES.date);
    if (!Number.isFinite(balance) || !dateValue) return latest;
    const date = normalizeDate(dateValue, { dayFirst: options.preferDayFirst });
    if (!date) return latest;
    if (latest && date < latest.date) return latest;
    return {
      id: uid("checkpoint"),
      accountId: account.id,
      date,
      balance,
      position: "end",
      source: "bank_statement",
      note: options.fileName ? `Imported from ${options.fileName}` : "Imported statement balance",
      importBatchId: options.importBatchId || ""
    };
  }, null);
}

function addTransactions(transactions) {
  transactions.forEach((tx) => ensureTags(tx.tags || []));
  state.transactions.push(...transactions);
  saveState();
}

function uniqueTransactions(transactions) {
  const seen = new Set(state.transactions.map(transactionFingerprint));
  const unique = [];
  let skipped = 0;

  transactions.forEach((tx) => {
    const fingerprint = transactionFingerprint(tx);
    if (seen.has(fingerprint)) {
      skipped += 1;
      return;
    }
    seen.add(fingerprint);
    unique.push(tx);
  });

  return { unique, skipped };
}

function transactionFingerprint(tx) {
  return [
    tx.date,
    tx.type,
    Number(tx.amount || 0).toFixed(2),
    tx.accountId || "",
    tx.toAccountId || "",
    String(tx.description || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  ].join("|");
}

function addBalanceCheckpoint(accountId, checkpoint) {
  const account = findAccount(accountId);
  const date = normalizeOptionalDate(checkpoint?.date);
  const balance = Number(checkpoint?.balance);
  if (!account || !date || !Number.isFinite(balance)) return false;

  const nextCheckpoint = {
    id: checkpoint.id || uid("checkpoint"),
    date,
    balance,
    position: checkpoint.position === "start" ? "start" : "end",
    source: checkpoint.source === "bank_statement" || checkpoint.source === "account_created" ? checkpoint.source : "manual",
    note: checkpoint.note || "",
    importBatchId: checkpoint.importBatchId || ""
  };
  const exists = (account.balanceCheckpoints || []).some((item) => (
    item.date === nextCheckpoint.date
    && item.position === nextCheckpoint.position
    && item.source === nextCheckpoint.source
    && Number(item.balance) === nextCheckpoint.balance
  ));
  if (exists) return false;

  account.balanceCheckpoints = normalizeBalanceCheckpoints([...(account.balanceCheckpoints || []), nextCheckpoint]);
  return true;
}

function removeBalanceCheckpoint(accountId, checkpointId) {
  const account = findAccount(accountId);
  if (!account?.balanceCheckpoints?.length || !checkpointId) return false;
  const before = account.balanceCheckpoints.length;
  account.balanceCheckpoints = account.balanceCheckpoints.filter((checkpoint) => checkpoint.id !== checkpointId);
  return account.balanceCheckpoints.length !== before;
}

function removeBalanceCheckpoints(predicate) {
  let removed = 0;
  state.accounts.forEach((account) => {
    const checkpoints = account.balanceCheckpoints || [];
    const kept = checkpoints.filter((checkpoint) => {
      if (!predicate(checkpoint, account)) return true;
      removed += 1;
      return false;
    });
    account.balanceCheckpoints = kept;
  });
  return removed;
}

function extractAmount(text) {
  const withoutDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ");
  const matches = withoutDates.match(/-?\d[\d,]*(?:\.\d+)?/g) || [];
  if (!matches.length) return 0;
  return Math.abs(matches
    .map((match) => Number(match.replace(/,/g, "")))
    .filter((number) => Number.isFinite(number))
    .sort((a, b) => Math.abs(b) - Math.abs(a))[0] || 0);
}

function hasNumber(text) {
  return /-?\d[\d,]*(?:\.\d+)?/.test(text);
}

function detectType(text) {
  const lower = text.toLowerCase();
  if (/\btransfer\b/.test(lower) || /\bto\b/.test(lower) && detectTransferAccounts(text)) return "transfer";
  const incomeWords = ["salary", "income", "received", "refund", "reimburse", "paid me", "bonus", "freelance", "invoice", "interest", "dividend"];
  return incomeWords.some((word) => lower.includes(word)) ? "income" : "expense";
}

function detectCategory(text, type) {
  const lower = text.toLowerCase();
  const match = transactionCategories(type).find((category) => category.keywords.some((keyword) => lower.includes(keyword.toLowerCase())));
  return match?.name || defaultCategory(type);
}

function detectAccount(text) {
  const lower = text.toLowerCase();
  return [...state.accounts]
    .sort((a, b) => b.name.length - a.name.length)
    .find((account) => lower.includes(account.name.toLowerCase()));
}

function detectTransferAccounts(text) {
  const lower = text.toLowerCase();
  const parts = lower.split(/\bto\b/);
  if (parts.length < 2) return null;
  const from = state.accounts.find((account) => parts[0].includes(account.name.toLowerCase())) || detectAccount(text);
  const to = state.accounts.find((account) => parts.slice(1).join(" to ").includes(account.name.toLowerCase()));
  if (!from || !to) return null;
  return { from, to };
}

function detectTags(text) {
  const lower = String(text || "").toLowerCase();
  return state.tags
    .filter((tag) => tag.keywords.some((keyword) => lower.includes(keyword.toLowerCase())) || lower.includes(tag.name.toLowerCase()))
    .map((tag) => tag.name)
    .slice(0, 5);
}

function detectDate(text) {
  const lower = text.toLowerCase();
  const today = new Date();
  if (lower.includes("yesterday")) return shiftDate(today, -1);
  if (lower.includes("tomorrow")) return shiftDate(today, 1);

  const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = slashMatch[3] ? normalizeYear(Number(slashMatch[3])) : today.getFullYear();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  return todayIso();
}

function cleanDescription(text, amount, account, category) {
  let output = text;
  output = output.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  output = output.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ");
  output = output.replace(/\b-?\d[\d,]*(?:\.\d+)?\b/g, " ");
  output = output.replace(/\b(usd|inr|eur|gbp|aud|cad|sgd|dollar|dollars|bucks|rupees|rs|today|yesterday|tomorrow|from|using|with|on|at|to|transfer)\b/gi, " ");
  state.accounts.forEach((item) => {
    output = output.replace(new RegExp(escapeRegExp(item.name), "gi"), " ");
  });
  if (account) output = output.replace(new RegExp(escapeRegExp(account.name), "gi"), " ");
  output = output.replace(/\s+/g, " ").trim();
  return titleCase(output || category);
}

function deleteTransaction(id) {
  const removed = state.transactions.find((tx) => tx.id === id);
  state.transactions = state.transactions.filter((tx) => tx.id !== id);
  const removedCheckpoints = cleanupImportCheckpointsAfterDelete(removed);
  saveState();
  showToast(removedCheckpoints ? "Entry and linked checkpoint deleted." : "Entry deleted.");
  render();
}

function cleanupImportCheckpointsAfterDelete(tx) {
  if (!tx?.importBatchId) return 0;
  if (state.transactions.some((item) => item.importBatchId === tx.importBatchId)) return 0;
  return removeBalanceCheckpoints((checkpoint) => checkpoint.importBatchId === tx.importBatchId);
}

function toggleBillPaid(id) {
  const bill = state.bills.find((item) => item.id === id);
  if (!bill) return;

  const month = state.settings.selectedMonth;
  if (isBillPaid(bill, month)) {
    bill.paidMonths = bill.paidMonths.filter((paidMonth) => paidMonth !== month);
    state.transactions = state.transactions.filter((tx) => !(tx.billId === bill.id && tx.date.startsWith(month)));
    showToast("Bill marked unpaid.");
  } else {
    bill.paidMonths.push(month);
    addTransactions([{
      id: uid("tx"),
      type: "expense",
      amount: bill.amount,
      description: bill.name,
      category: bill.category,
      accountId: bill.accountId,
      toAccountId: "",
      date: billDateForMonth(bill, month),
      note: "Recurring bill",
      tags: detectTags(`${bill.name} ${bill.category}`),
      billId: bill.id
    }]);
    showToast("Bill paid and logged.");
  }

  saveState();
  render();
}

function monthlyTransactions(month) {
  return state.transactions.filter((tx) => tx.date.startsWith(month));
}

function cashflowTransactions(transactions) {
  return transactions.filter((tx) => tx.type !== "transfer");
}

function sortedTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const dateSort = b.date.localeCompare(a.date);
    if (dateSort !== 0) return dateSort;
    return b.id.localeCompare(a.id);
  });
}

function total(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function totalBalance() {
  return state.accounts.reduce((sum, account) => sum + accountBalance(account.id), 0);
}

function totalAccountsByKind(kind) {
  return state.accounts
    .filter((account) => findAccountCategory(account.categoryId)?.kind === kind)
    .reduce((sum, account) => sum + accountBalance(account.id), 0);
}

function accountBalance(accountId) {
  const account = findAccount(accountId);
  const checkpoint = latestBalanceCheckpoint(accountId);
  const opening = checkpoint ? Number(checkpoint.balance || 0) : Number(account?.openingBalance || 0);
  return state.transactions.reduce((sum, tx) => {
    if (checkpoint && !transactionAppliesAfterCheckpoint(tx, checkpoint)) return sum;
    if (tx.type === "transfer") {
      if (tx.accountId === accountId) return sum - tx.amount;
      if (tx.toAccountId === accountId) return sum + tx.amount;
      return sum;
    }
    if (tx.accountId !== accountId) return sum;
    return sum + (tx.type === "income" ? tx.amount : -tx.amount);
  }, opening);
}

function latestBalanceCheckpoint(accountId) {
  const account = findAccount(accountId);
  if (!account?.balanceCheckpoints?.length) return null;
  return [...account.balanceCheckpoints].sort(compareCheckpointsDesc)[0] || null;
}

function transactionAppliesAfterCheckpoint(tx, checkpoint) {
  return checkpoint.position === "start" ? tx.date >= checkpoint.date : tx.date > checkpoint.date;
}

function categoryTotals(month) {
  const totals = new Map();
  monthlyTransactions(month)
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      totals.set(tx.category, (totals.get(tx.category) || 0) + tx.amount);
    });

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      color: transactionCategories("expense").find((item) => item.name === category)?.color || "#6b7280"
    }))
    .sort((a, b) => b.amount - a.amount);
}

function monthlyCategorySpend(month, category) {
  return total(monthlyTransactions(month).filter((tx) => tx.type === "expense" && tx.category === category));
}

function monthlyTrend() {
  return monthSequence(state.settings.selectedMonth, 6).map((month) => {
    const txs = cashflowTransactions(monthlyTransactions(month));
    return {
      month,
      label: shortMonthLabel(month),
      income: total(txs.filter((tx) => tx.type === "income")),
      expense: total(txs.filter((tx) => tx.type === "expense"))
    };
  });
}

function averageTrendValue(rows, key) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
}

function tagTotals(month) {
  const map = new Map();
  monthlyTransactions(month)
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      (tx.tags || []).forEach((tag) => map.set(tag, (map.get(tag) || 0) + tx.amount));
    });
  const rows = Array.from(map.entries()).map(([tag, amount]) => ({
    tag,
    amount,
    color: state.tags.find((item) => item.name === tag)?.color || "#6b7280"
  })).sort((a, b) => b.amount - a.amount);
  const max = rows[0]?.amount || 1;
  return rows.map((row) => ({ ...row, max }));
}

function accountCategoryTotals() {
  const rows = state.accountCategories.map((category) => {
    const amount = state.accounts
      .filter((account) => account.categoryId === category.id)
      .reduce((sum, account) => sum + Math.abs(accountBalance(account.id)), 0);
    return { name: category.name, amount, color: category.color };
  }).filter((row) => row.amount > 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0) || 1;
  return rows.map((row) => ({ ...row, percent: (row.amount / totalAmount) * 100 }));
}

function upcomingBills(month) {
  return [...state.bills].sort((a, b) => billDateForMonth(a, month).localeCompare(billDateForMonth(b, month)));
}

function budgetStatus(spent, limit) {
  if (!limit) return "Unset";
  if (spent > limit) return "Over";
  if (spent / limit > 0.75) return "Watch";
  return "OK";
}

function getInsights(month) {
  const current = cashflowTransactions(monthlyTransactions(month));
  const priorMonth = shiftMonth(month, -1);
  const prior = cashflowTransactions(monthlyTransactions(priorMonth));
  const currentExpense = total(current.filter((tx) => tx.type === "expense"));
  const priorExpense = total(prior.filter((tx) => tx.type === "expense"));
  const currentIncome = total(current.filter((tx) => tx.type === "income"));
  const transfers = monthlyTransactions(month).filter((tx) => tx.type === "transfer");
  const topCategory = categoryTotals(month)[0];
  const overBudget = state.budgets
    .map((budget) => ({ ...budget, spent: monthlyCategorySpend(month, budget.category) }))
    .filter((budget) => budget.limit > 0 && budget.spent > budget.limit)
    .sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit))[0];

  const insights = [];
  if (priorExpense > 0) {
    const delta = currentExpense - priorExpense;
    insights.push({
      title: delta <= 0 ? "Spending is down" : "Spending is up",
      body: `${formatMoney(Math.abs(delta))} ${delta <= 0 ? "less" : "more"} than ${monthLabel(priorMonth)}.`
    });
  }
  if (topCategory) {
    insights.push({
      title: `${topCategory.category} leads spending`,
      body: `${formatMoney(topCategory.amount)} logged this month.`
    });
  }
  if (overBudget) {
    insights.push({
      title: `${overBudget.category} is over budget`,
      body: `${formatMoney(overBudget.spent - overBudget.limit)} above the monthly limit.`
    });
  }
  if (transfers.length) {
    insights.push({
      title: "Transfers are neutral",
      body: `${formatMoney(total(transfers))} moved between accounts without changing cashflow.`
    });
  }
  if (!insights.length) {
    insights.push({
      title: currentIncome > currentExpense ? "Month is positive" : "Month is quiet",
      body: currentIncome > currentExpense ? `${formatMoney(currentIncome - currentExpense)} left after spending.` : "Add entries to unlock richer trend insights."
    });
  }
  return insights.slice(0, 4);
}

function transactionCategories(type) {
  return state.transactionCategories.filter((category) => category.type === type);
}

function findAccount(accountId) {
  return state.accounts.find((account) => account.id === accountId);
}

function findAccountByName(name) {
  const value = String(name || "").trim().toLowerCase();
  if (!value) return null;
  return state.accounts.find((account) => account.name.toLowerCase() === value)
    || state.accounts.find((account) => account.name.toLowerCase().includes(value) || value.includes(account.name.toLowerCase()));
}

function findAccountByNameOrId(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return findAccount(text) || findAccountByName(text);
}

function findAccountCategory(categoryId, categories = state.accountCategories) {
  return categories.find((category) => category.id === categoryId);
}

function inferAccountCategoryId(text, categories) {
  const lower = String(text || "").toLowerCase();
  const match = categories.find((category) => lower.includes(category.name.toLowerCase()));
  if (match) return match.id;
  if (lower.includes("card")) return categories.find((category) => category.name === "Credit Card")?.id;
  if (lower.includes("cash")) return categories.find((category) => category.name === "Cash")?.id;
  if (lower.includes("wallet")) return categories.find((category) => category.name === "Wallet/Top Up")?.id;
  return categories.find((category) => category.name === "Savings Account")?.id;
}

function defaultCategory(type) {
  if (type === "transfer") return "Transfer";
  return type === "income" ? "Salary" : "Other";
}

function isBillPaid(bill, month) {
  return bill.paidMonths.includes(month);
}

function billDateForMonth(bill, month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return `${month}-${pad(Math.min(bill.dueDay, lastDay))}`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js").catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}

async function exportData() {
  if (!window.ManimanSecureStorage?.isUnlocked()) return showToast("Unlock the vault before exporting its backup.");
  const owner = captureVaultContext();
  try {
    await window.ManimanSecureStorage.flush();
    if (!vaultContextMatches(owner)) return;
    window.ManimanVaultAccess.downloadEnvelope(window.ManimanSecureStorage.getEnvelope());
    showToast("Encrypted vault backup ready. Keep your passphrase or recovery key separately.");
  } catch (_) { showToast("Encrypted export failed. Retry without closing this tab."); }
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.ManimanSecureStorage?.isUnlocked()) {
    event.target.value = "";
    return showToast("Unlock the vault before importing a file.");
  }
  const owner = captureVaultContext();
  if (file.size > 20 * 1024 * 1024) {
    showToast("Import files must be 20 MB or smaller.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    let operationStarted = false;
    try {
      if (!vaultContextMatches(owner)) return;
      if (vaultOperationDepth > 0) return showToast("Wait for the current vault operation to finish before importing another file.");
      const parsed = JSON.parse(String(reader.result));
      if (window.ManimanVault?.isEnvelope(parsed)) {
        showToast("To recover an encrypted backup, use Restore on an empty vault's unlock screen. The current vault is unchanged.");
        return;
      }
      if (isStatementEnvelope(parsed)) {
        stageStatementImport(parsed, { createCheckpoint: true });
        return;
      }
      const next = prepareBackupState(parsed);
      if (!window.confirm(`Replace this vault's ledger with ${parsed.transactions.length} transactions from the selected legacy backup? Export an encrypted backup first if you need to preserve current data.`)) return;
      setVaultOperationBusy(true);
      operationStarted = true;
      await window.ManimanSecureStorage.save(next);
      if (!vaultContextMatches(owner)) return;
      state = next;
      activeView = state.settings.lastView || "dashboard";
      selectedActivityAccountId = state.accounts[0]?.id || "";
      syncEncryptedState();
      showToast("Legacy backup copied into encrypted storage.");
      render();
    } catch (error) {
      if (vaultContextMatches(owner)) showToast("Import rejected before replacement. Choose a supported single-currency Maniman backup with valid metadata.");
    } finally {
      event.target.value = "";
      if (operationStarted) setVaultOperationBusy(false);
    }
  };
  reader.readAsText(file);
}

function ensureTags(tags) {
  normalizeTagInput(tags).forEach((name) => {
    if (!state.tags.some((tag) => tag.name === name)) {
      state.tags.push({ id: uid("tag"), name, color: "#6b7280", keywords: [name] });
    }
  });
}

function normalizeTagInput(value) {
  if (Array.isArray(value)) return value.map(cleanTagName).filter(Boolean);
  return String(value || "")
    .split(/[,#]/)
    .map(cleanTagName)
    .filter(Boolean);
}

function cleanTagName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
}

function normalizeKeywordInput(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function normalizeFieldName(value) {
  return String(value || "").trim().replace(/\s+/g, "").replace(/[-_](.)/g, (_, char) => char.toUpperCase());
}

function comparableFieldName(value) {
  return normalizeFieldName(value).toLowerCase();
}

function normalizeDate(value, options = {}) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const numericMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const year = normalizeYear(Number(numericMatch[3]));
    const dayFirst = options.dayFirst || first > 12;
    const day = dayFirst ? first : second;
    const month = dayFirst ? second : first;
    if (isValidDateParts(year, month, day)) return `${year}-${pad(month)}-${pad(day)}`;
  }

  const parsed = Date.parse(text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1"));
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  return detectDate(text);
}

function normalizeOptionalDate(value) {
  const text = String(value || "").trim();
  return text ? normalizeDate(text, { dayFirst: true }) : "";
}

function isValidDateParts(year, month, day) {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function compareCheckpointsAsc(a, b) {
  const dateSort = a.date.localeCompare(b.date);
  if (dateSort !== 0) return dateSort;
  return checkpointPositionRank(a) - checkpointPositionRank(b);
}

function compareCheckpointsDesc(a, b) {
  return compareCheckpointsAsc(b, a);
}

function checkpointPositionRank(checkpoint) {
  return checkpoint.position === "end" ? 2 : 1;
}

function checkpointLabel(checkpoint) {
  const prefix = checkpoint.position === "start" ? "Trusted from" : "Trusted after";
  return `${prefix} ${formatDate(checkpoint.date)}: ${formatMoney(checkpoint.balance)}`;
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    dom.toast.hidden = true;
  }, 2600);
}

function emptyState(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function formatMoney(value) {
  return new Intl.NumberFormat(state.settings.currency === "INR" ? "en-IN" : undefined, {
    style: "currency",
    currency: state.settings.currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${iso}T00:00:00`));
}

function monthLabel(month) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T00:00:00`));
}

function shortMonthLabel(month) {
  return new Intl.DateTimeFormat(undefined, { month: "short" })
    .format(new Date(`${month}-01T00:00:00`));
}

function monthSequence(endMonth, count) {
  return Array.from({ length: count }, (_, index) => shiftMonth(endMonth, index - count + 1));
}

function shiftMonth(month, delta) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function getCurrentMonth() {
  return todayIso().slice(0, 7);
}

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDate(date, delta) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function normalizeYear(year) {
  return year < 100 ? 2000 + year : year;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
