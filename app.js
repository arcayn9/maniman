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

document.addEventListener("DOMContentLoaded", init);

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

  dom.monthPicker.addEventListener("change", (event) => {
    state.settings.selectedMonth = event.target.value || getCurrentMonth();
    saveState();
    render();
  });

  dom.currencySelect.addEventListener("change", (event) => {
    state.settings.currency = event.target.value;
    saveState();
    render();
  });
  dom.mobileCurrencySelect.addEventListener("change", (event) => {
    state.settings.currency = event.target.value;
    saveState();
    render();
  });

  dom.exportBtn.addEventListener("click", exportData);
  dom.mobileExportBtn.addEventListener("click", exportData);
  dom.importFile.addEventListener("change", importData);
  dom.mobileImportFile.addEventListener("change", importData);

  registerServiceWorker();
  render();
}

async function loadState() {
  const cloudState = await loadStateFromCloud();
  if (cloudState) return cloudState;

  const apiState = await loadStateFromApi();
  if (apiState) return apiState;

  storageMode = "local";
  syncStatus = "browser-only";
  const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!raw) return createStarterState();

  try {
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Could not load saved state", error);
    return createStarterState();
  }
}

async function loadStateFromApi() {
  if (location.protocol === "file:") return null;

  try {
    const response = await fetch(`${API_STATE_URL}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    storageMode = "server";
    syncStatus = "local-server";
    return normalizeState(payload.state || payload || {});
  } catch (error) {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (storageMode === "cloud" && cloud.user) {
    saveStateToCloud();
    return;
  }

  if (storageMode !== "server") {
    syncStatus = "browser-only";
    updateStorageBadge();
    return;
  }

  fetch(API_STATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state })
  }).catch((error) => {
    console.warn("Server save failed", error);
    storageMode = "local";
    syncStatus = "browser-only";
    updateStorageBadge();
    showToast("Server save failed. Saved in this browser instead.");
  });
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

  cloud.client.auth.onAuthStateChange(async (_event, session) => {
    cloud.user = session?.user || null;
    cloud.revision = null;
    cloud.lastError = "";
    if (!state) return;
    if (cloud.user) {
      const cloudState = await loadStateFromCloud();
      if (cloudState) {
        state = cloudState;
        activeView = state.settings.lastView || "dashboard";
        selectedActivityAccountId = state.accounts[0]?.id || "";
      }
    } else {
      storageMode = "local";
      syncStatus = "browser-only";
    }
    render();
  });
}

async function loadStateFromCloud() {
  if (!cloud.client || !cloud.user) return null;

  try {
    const { data, error } = await cloud.client
      .from(SUPABASE_TABLE)
      .select("state, revision")
      .eq("user_id", cloud.user.id)
      .maybeSingle();

    if (error) throw error;

    storageMode = "cloud";
    syncStatus = "synced";
    cloud.lastError = "";

    if (!data) {
      cloud.revision = 0;
      const localState = loadCachedState() || createStarterState();
      state = normalizeState(localState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      await saveStateToCloud(true);
      return state;
    }

    cloud.revision = Number(data.revision || 0);
    const nextState = normalizeState(data.state || {});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  } catch (error) {
    console.warn("Cloud load failed", error);
    cloud.lastError = error.message || "Cloud load failed";
    syncStatus = "cloud-unavailable";
    return null;
  }
}

function loadCachedState() {
  const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function saveStateToCloud(initialSave = false) {
  if (!cloud.client || !cloud.user) return;
  if (cloud.saving) {
    cloud.pendingSave = true;
    return;
  }

  cloud.saving = true;
  syncStatus = "syncing";
  updateStorageBadge();

  try {
    const currentRevision = Number(cloud.revision || 0);
    const nextRevision = currentRevision + 1;
    const payload = {
      user_id: cloud.user.id,
      state,
      revision: nextRevision,
      updated_at: new Date().toISOString()
    };

    if (initialSave || currentRevision === 0) {
      const { data, error } = await cloud.client
        .from(SUPABASE_TABLE)
        .upsert(payload)
        .select("revision")
        .single();
      if (error) throw error;
      cloud.revision = Number(data.revision || nextRevision);
    } else {
      const { data, error } = await cloud.client
        .from(SUPABASE_TABLE)
        .update(payload)
        .eq("user_id", cloud.user.id)
        .eq("revision", currentRevision)
        .select("revision")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        syncStatus = "cloud-conflict";
        showToast("Cloud copy changed elsewhere. Refreshing before the next save.");
        const refreshed = await loadStateFromCloud();
        if (refreshed) {
          state = refreshed;
          render();
        }
        return;
      }
      cloud.revision = Number(data.revision || nextRevision);
    }

    storageMode = "cloud";
    syncStatus = "synced";
    cloud.lastError = "";
  } catch (error) {
    console.warn("Cloud save failed", error);
    cloud.lastError = error.message || "Cloud save failed";
    syncStatus = "unsynced";
    showToast("Cloud save failed. A local cache is still available.");
  } finally {
    cloud.saving = false;
    updateStorageBadge();
    if (cloud.pendingSave) {
      cloud.pendingSave = false;
      saveStateToCloud();
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
  await cloud.client.auth.signOut();
  storageMode = "local";
  syncStatus = "browser-only";
  showToast("Signed out. Saved in this browser.");
  render();
}

function normalizeState(value = {}) {
  const starter = createStarterState();
  const accountCategories = normalizeAccountCategories(value.accountCategories || starter.accountCategories);
  const legacyWallets = Array.isArray(value.wallets) ? value.wallets : null;
  const accounts = normalizeAccounts(value.accounts || legacyWallets || starter.accounts, accountCategories);
  const transactions = normalizeTransactions(value.transactions || starter.transactions, accounts);

  const next = {
    version: 3,
    settings: { ...starter.settings, ...(value.settings || {}) },
    accountCategories,
    accounts,
    transactions,
    transactionCategories: normalizeTransactionCategories(value.transactionCategories || starter.transactionCategories),
    tags: normalizeTags(value.tags || starter.tags),
    budgets: Array.isArray(value.budgets) ? value.budgets : starter.budgets,
    goals: Array.isArray(value.goals) ? value.goals : starter.goals,
    bills: Array.isArray(value.bills) ? value.bills : starter.bills
  };

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
      importBatchId: checkpoint.importBatchId || ""
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
      importBatchId: tx.importBatchId || ""
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
      currency: "USD",
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
      currency: state?.settings?.currency || "USD",
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
  dom.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === activeView));
  updateStorageBadge();

  const renderer = {
    dashboard: renderDashboard,
    transactions: renderTransactions,
    budgets: renderBudgets,
    accounts: renderAccounts,
    stats: renderStats,
    goals: renderGoals,
    bills: renderBills,
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
    ${pageHeader("Dashboard", monthLabel(month), "")}
    <section class="quick-add-section">
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Quick add</h2>
          <span class="chip">Auto tags</span>
        </div>
        <form id="quickAddForm" class="quick-entry">
          <textarea id="quickText" class="control" placeholder="coffee 4.50 cash yesterday&#10;salary 3000 main savings&#10;transfer 250 main savings to index fund"></textarea>
          <div id="quickPreview" class="preview-list"></div>
          <div class="quick-actions">
            <button class="button" type="submit">Log entries</button>
            <button id="quickClearBtn" class="button ghost" type="button">Clear</button>
          </div>
        </form>
      </article>
    </section>

    <section class="metric-grid" aria-label="Monthly summary">
      ${metricCard("Income", formatMoney(income), "Excludes transfers")}
      ${metricCard("Spending", formatMoney(expense), "Excludes transfers")}
      ${metricCard("Net Cashflow", formatMoney(net), `${income > 0 ? Math.round((net / income) * 100) : 0}% savings rate`)}
      ${metricCard("Net Worth", formatMoney(totalBalance()), `${state.accounts.length} accounts`)}
    </section>

    <section class="dashboard-grid">
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
          ${recent.length ? `<div class="transaction-list">${recent.map(renderTransactionRow).join("")}</div>` : emptyState("No transactions yet.")}
        </article>
      </div>

      <div class="stack">
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
          ${transfers.length ? `<div class="transaction-list">${transfers.slice(0, 4).map(renderTransactionRow).join("")}</div>` : emptyState("No transfers this month.")}
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
      <article class="card">
        <div class="card-header">
          <h2 class="card-title">${editing ? "Edit transaction" : "New transaction"}</h2>
          ${editing ? `<button id="cancelEditBtn" class="button ghost small" type="button">Cancel</button>` : ""}
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
            <button class="button" type="submit">${editing ? "Save changes" : "Add transaction"}</button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card-header">
          <h2 class="card-title">Bulk upload</h2>
          <span class="chip">Text, bank CSV, JSON</span>
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
          ${renderBulkImportExamples()}
          <label class="field span-12">
            <span class="field-label">Paste entries</span>
            <textarea id="bulkText" class="control" placeholder="Paste quick text, CSV, bank CSV, or JSON here"></textarea>
          </label>
          <div class="span-12 quick-actions">
            <button id="bulkTextBtn" class="button" type="button">Import pasted entries</button>
            <label class="button ghost file-button" for="bulkFile">Upload file</label>
            <input id="bulkFile" class="sr-only" type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json">
          </div>
        </div>
      </article>

      <article class="card">
        <div class="toolbar">
          <h2 class="card-title">Ledger</h2>
          <div class="filter-row">
            <input id="txSearch" class="control" type="search" placeholder="Search">
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
        <div id="transactionList" class="transaction-list">
          ${txs.length ? txs.map(renderTransactionRow).join("") : emptyState("No transactions yet.")}
        </div>
      </article>
    </div>
  `;
}

function renderBulkImportExamples() {
  return `
    <details class="format-help span-12" open>
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
        <button id="saveBudgetsBtn" class="button" type="button">Save limits</button>
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
            <button class="button" type="submit">Add account</button>
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
            <button class="button" type="submit">Add category</button>
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
          <button class="button" type="submit">Save checkpoint</button>
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
            <button class="button" type="submit">Add goal</button>
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
            <button class="button" type="submit">Add bill</button>
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
              ${["USD", "INR", "EUR", "GBP", "AUD", "CAD", "SGD"].map((code) => `<option value="${code}" ${state.settings.currency === code ? "selected" : ""}>${code}</option>`).join("")}
            </select>
          </label>
          <label class="field span-6">
            <span class="field-label">Default month</span>
            <input id="settingsMonth" class="control" type="month" value="${state.settings.selectedMonth}">
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
          <button id="settingsExportBtn" class="button" type="button">Export JSON</button>
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
            <button class="button" type="submit">Add category</button>
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
            <button class="button" type="submit">Add tag</button>
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
  document.querySelectorAll("[data-jump-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.jumpView;
      state.settings.lastView = activeView;
      saveState();
      render();
    });
  });

  if (activeView === "dashboard") bindDashboardEvents();
  if (activeView === "transactions") bindTransactionEvents();
  if (activeView === "budgets") bindBudgetEvents();
  if (activeView === "accounts") bindAccountEvents();
  if (activeView === "goals") bindGoalEvents();
  if (activeView === "bills") bindBillEvents();
  if (activeView === "settings") bindSettingsEvents();

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
  const bulkText = document.querySelector("#bulkText");
  const bulkTextBtn = document.querySelector("#bulkTextBtn");
  const bulkFile = document.querySelector("#bulkFile");
  const bulkImportOptions = () => ({
    defaultAccountId: document.querySelector("#bulkAccount").value,
    createCheckpoint: document.querySelector("#bulkBalanceMode").value === "checkpoint"
  });

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
    list.innerHTML = filtered.length ? filtered.map((tx) => renderTransactionRow(tx, accountValue === "all" ? "" : accountValue)).join("") : emptyState("No matching entries.");
    bindTransactionRowActions(list);
  };

  search.addEventListener("input", filter);
  filterType.addEventListener("change", filter);
  filterAccount.addEventListener("change", filter);

  bulkTextBtn.addEventListener("click", () => {
    importTransactionText(bulkText.value, "", bulkImportOptions());
  });

  bulkFile.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importTransactionText(String(reader.result || ""), file.name, bulkImportOptions());
      event.target.value = "";
    };
    reader.readAsText(file);
  });
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
  document.querySelector("#settingsCurrency").addEventListener("change", (event) => {
    state.settings.currency = event.target.value;
    saveState();
    render();
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
  if (storageMode === "server") return "Local server";
  return "Browser storage";
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
        <button class="button ghost small" type="button" data-edit-transaction="${tx.id}">Edit</button>
        <button class="button ghost small" type="button" data-delete-transaction="${tx.id}">Delete</button>
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
        ${canDeleteCheckpoint ? `<button class="button ghost small" type="button" data-delete-checkpoint="${checkpoint.id}" data-checkpoint-account="${account.id}">Remove checkpoint</button>` : ""}
        <button class="button ghost small" type="button" data-delete-account="${account.id}">Delete</button>
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
        <button class="button small" type="button" data-save-goal="${goal.id}">Save</button>
        <button class="button ghost small" type="button" data-delete-goal="${goal.id}">Delete</button>
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
        <button class="button small" type="button" data-toggle-bill="${bill.id}">${paid ? "Undo" : "Mark paid"}</button>
        <button class="button ghost small" type="button" data-delete-bill="${bill.id}">Delete</button>
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

function importTransactionText(text, fileName = "", options = {}) {
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

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `maniman-${state.settings.selectedMonth}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Export ready.");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeState(JSON.parse(String(reader.result)));
      activeView = state.settings.lastView || "dashboard";
      selectedActivityAccountId = state.accounts[0]?.id || "";
      saveState();
      showToast("Import complete.");
      render();
    } catch (error) {
      console.error(error);
      showToast("Import failed. Choose a valid JSON export.");
    } finally {
      event.target.value = "";
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
  return new Intl.NumberFormat(undefined, {
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
