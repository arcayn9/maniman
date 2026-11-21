(function (root, factory) {
  const guide = factory();
  if (typeof module === "object" && module.exports) module.exports = guide;
  else root.ManimanGuide = guide;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const categories = ["Start here", "Track activity", "Manage money", "Privacy & recovery", "Troubleshooting"];
  const topics = [
    {
      id: "first-session", category: "Start here", title: "Set up your first vault", view: "accounts",
      summary: "Create a private workspace and add the accounts you use.",
      steps: [
        "Open Maniman using HTTPS or localhost. Choose a vault passphrase of at least 12 characters and repeat it.",
        "Select Create encrypted vault. Save the recovery key somewhere separate from your encrypted backup, then paste it into the verification field and continue.",
        "Open Accounts. Add your real bank, card, cash and wallet accounts with their opening balances and dates. The initial Main account is a placeholder you can use or replace after adding another account.",
        "Open Transactions to add a payment, or Imports & review to bring in statements. New vaults use Indian rupees (INR, ₹).",
        "Open Settings → Export encrypted backup and keep the downloaded file. Repeat after important imports or changes."
      ],
      notes: ["A vault passphrase unlocks financial records; a cloud login password signs into the hosting account. They serve different purposes. Neither support nor a cloud password reset can recreate a lost vault passphrase and recovery key."]
    },
    {
      id: "navigation", category: "Start here", title: "Navigate, choose a period and read action icons", view: "dashboard",
      summary: "Find screens on desktop and mobile without changing stored history.",
      steps: [
        "On desktop, use the sidebar. On a phone, use Overview, Transactions, Imports and Accounts in the bottom navigation; open the three-line App menu for the other screens and this guide.",
        "Choose a month in the Period field. Overview, Insights, Budgets and Bills use the selected month; the transaction ledger retains all dates and has its own search and filters.",
        "Use the pencil to edit, trash to delete, plus to add, disk to save, cross to cancel, check to mark a bill paid, and curved arrow to undo or mark unpaid. Hover an icon for its action title; screen readers announce a descriptive label.",
        "Read the storage status near the desktop sidebar footer or in Settings. Saved in this browser and Synced to cloud describe different storage locations.",
        "Use the guide search to find a topic, or choose a topic group. Open any numbered walkthrough to see its steps."
      ],
      notes: ["Changing the period does not delete history. System light/dark appearance is followed automatically. Deleting a row acts immediately; export a backup first if you may need to restore it."]
    },
    {
      id: "currency", category: "Start here", title: "Set the currency and auto-lock time", view: "settings",
      summary: "Choose preferences before recording financial data.",
      steps: [
        "Open Settings → Preferences. New vaults default to INR and show ₹ with Indian digit grouping, for example ₹1,23,456.78.",
        "If you need another supported currency, choose it before adding transactions, nonzero balances, checkpoints, budgets, goals, bills or statement evidence.",
        "Choose Default month to set the reporting period; the topbar Period field changes the same preference.",
        "Set Auto-lock after inactivity to a value from 1 to 120 minutes. The default is 15 minutes; changes save automatically."
      ],
      notes: ["One vault uses one currency. Changing a label is not currency conversion, so currency changes are blocked once financial data exists. Existing and restored records keep their saved currency, including older USD records."]
    },
    {
      id: "install-offline", category: "Start here", title: "Install the app and use it offline", view: "settings",
      summary: "Keep a convenient shortcut while understanding where data lives.",
      steps: [
        "Open the regular Maniman HTTPS address or localhost address in a supported browser and allow the app to finish loading online.",
        "If offered by your browser, choose Install app or Add to home screen. Open that shortcut to use Maniman in its own window.",
        "Unlock the same browser or installed-app vault with its passphrase. Browser storage belongs to this browser profile and site address.",
        "When offline, use an already cached app shell and local vault. Reconnect and check sync status before assuming another device has your latest work.",
        "Export an encrypted backup before clearing site data, changing browser profiles or moving to another address."
      ],
      notes: ["Installing the PWA does not itself enable cloud sync. Private browsing, storage cleanup or changing the app origin can make the current local vault unavailable. The separate local PDF converter still runs on your computer."]
    },
    {
      id: "manual-entry", category: "Track activity", title: "Add an expense, income or transfer", view: "transactions",
      summary: "Record one transaction with an explicit type, account and category.",
      steps: [
        "Open Transactions and expand Add transaction.",
        "Choose Expense, Income or Transfer. Enter a positive amount and the actual transaction date.",
        "Choose the account. For a transfer, choose different From and To accounts; otherwise choose the transaction category.",
        "Enter a description. Optionally add comma-separated tags and a note. Blank tags allow keyword-based automatic tags.",
        "Select the plus icon to add the transaction. Check the ledger and the relevant month's Overview."
      ],
      notes: ["Use Transfer for movement between your own accounts, including card repayments and transfers into an investment account you track. A third-party refund or borrowed money is not automatically the same economic event as salary; review its type and category yourself."]
    },
    {
      id: "quick-entry", category: "Track activity", title: "Log payments with Quick entry", view: "dashboard",
      summary: "Preview plain-language entries before adding them.",
      steps: [
        "Open Overview and expand Quick entry.",
        "Enter one payment per line with an amount, description and account name. You can include yesterday or an explicit ISO date. Use the exact account names from Accounts.",
        "Read the live preview. Check type, amount, date, category and accounts; the parser uses deterministic words and keywords rather than a language model.",
        "Select Log entries when the preview is correct, or the eraser icon to clear the text.",
        "Open Transactions to correct any saved entry with the pencil icon. Use the manual form for entries the text parser cannot express reliably."
      ],
      example: "coffee 120 Cash yesterday\nsalary 85000 Main account 2026-11-01\ntransfer 5000 Main account to Cash 2026-11-03",
      notes: ["Create the example accounts first or substitute your own names. Quick entry may fall back to the first account when it cannot recognize one; always check the preview. A transfer needs two recognized, different owned accounts."]
    },
    {
      id: "ledger", category: "Track activity", title: "Find, edit and delete transactions", view: "transactions",
      summary: "Search all recorded dates and combine account/type filters.",
      steps: [
        "Open Transactions. Search by description, category, note or tag.",
        "Combine All types and All accounts filters as needed. Selecting an account includes both incoming and outgoing sides of its transfers.",
        "Select the pencil beside an entry. The editor opens with its current values; change the fields and select the disk to save, or the cross to cancel editing.",
        "Select trash only when you intend to remove an entry. The deletion is immediate, and there is no general undo bin.",
        "Check the balance and reports after changing a date, account, type or amount. Use the contextual action titles to distinguish repeated icons."
      ],
      notes: ["Deleting a transaction does not erase its original external PDF/JSON file. Statement batch undo has separate evidence-aware behavior. Removing the final entry from a legacy checkpoint-backed import can also remove that linked checkpoint."]
    },
    {
      id: "local-converter", category: "Track activity", title: "Convert a PDF statement locally", view: "imports",
      summary: "Keep PDF passwords, extraction and OCR on your computer.",
      steps: [
        "On the computer holding the Maniman checkout, install Python 3.10 or later and run the setup commands below from the project folder. Put the PDF in private-statements.",
        "Run the converter command to write a new JSON file. It refuses to overwrite an existing output; choose a different output name for another attempt.",
        "For a protected PDF, add --ask-password and enter the password at the local prompt. For scanned pages, add --ocr after installing local Tesseract.",
        "Read the converter result. Unknown layouts and incomplete/OCR extraction remain review documents; correct or re-extract them locally before commitment.",
        "Open Imports & review in Maniman and choose the resulting JSON. The app accepts the converted JSON rather than uploading the PDF."
      ],
      example: "python3 -m venv .venv-converter\n.venv-converter/bin/python -m pip install -r requirements-converter.lock\nmkdir -p private-statements\n.venv-converter/bin/python -m tools.statement_converter private-statements/statement.pdf -o private-statements/statement.json",
      notes: ["Current support is a generic explicit-column layout, not every bank's PDF. PDFs with several accounts may need splitting locally. No remote OCR or model fallback is used. Converter JSON is ordinary sensitive plaintext until imported; manage its storage and retention separately from the encrypted vault."]
    },
    {
      id: "statement-accounts", category: "Track activity", title: "Review a statement's institution, account and dates", view: "imports",
      summary: "Confirm what the extracted document actually covers before saving.",
      steps: [
        "Open Imports & review and choose a converted statement JSON file. Read any validation errors or extraction warnings in the preview.",
        "Confirm the institution name. For each statement section, explicitly choose the existing owned account or select the new-account option and enter its name and kind.",
        "Confirm the declared statement start and end dates from the source statement. Do not substitute the first and last payment dates for missing statement coverage.",
        "Check currency and account identity, including any masked identifier. A previous confirmed source mapping can preselect an account on future imports; correct it if it identifies the wrong account.",
        "Continue to transaction treatment in the preview. Nothing from a versioned statement is committed merely by choosing the file."
      ],
      notes: ["Unknown account or period information can be confirmed by you. Failed or partial extraction, invalid dates, identity conflicts and mixed currencies can block saving and need correction first. The Overview coverage panel shows confirmed statement periods, not inferred completeness of all your accounts."]
    },
    {
      id: "statement-rows", category: "Track activity", title: "Review overlaps, transfers and statement rows", view: "imports",
      summary: "Count a financial event once while retaining its source evidence.",
      steps: [
        "For each preview row, choose its confirmed treatment: a new expense, new income, transfer to another owned account, or a link to an existing transaction.",
        "For a suspected duplicate, inspect the offered existing-transaction candidates and choose a link only when it is the same event. Equal date and amount alone do not prove a duplicate.",
        "For an owned-account transfer, select the other account and verify direction. Review credit-card repayments, refunds, lending and split recoveries individually rather than treating all credits as income.",
        "Use the debit/credit bulk actions only after checking exceptions. Move through every page with the arrow icons. Inspect warnings and decide whether known-sign statement closing balances should become checkpoints.",
        "Tick the completed-review checkbox and select Save reviewed statement to encrypted vault. Check the saved/linked/skipped counts, then use Transactions to refine categories, tags and notes."
      ],
      notes: ["Reimporting the same source observations does not create another copy of those rows. Cross-source matching remains user reviewed; automatic fuzzy reconciliation and richer refund/loan purposes are not yet implemented. New statement income is not assumed to be Salary."]
    },
    {
      id: "statement-undo", category: "Track activity", title: "Undo a statement import", view: "imports",
      summary: "Remove one batch's evidence without discarding independently supported edits.",
      steps: [
        "Export an encrypted backup if you may need this batch again.",
        "Open Imports & review and find the batch in Recent statement imports. The latest five batches are shown.",
        "Select the curved-arrow Undo statement import action only when you intend to remove that batch. It acts immediately.",
        "Review Transactions, Accounts and Statement coverage after the operation."
      ],
      notes: ["Undo removes that batch's evidence and its exclusively supported untouched transactions/checkpoints. Manually edited transactions or transactions supported by other evidence are retained. The source file on your computer is unchanged; this is not a general transaction-deletion undo."]
    },
    {
      id: "legacy-import", category: "Track activity", title: "Import text, CSV or a transaction-list JSON file", view: "imports",
      summary: "Use the direct-import path when you do not have versioned statement JSON.",
      steps: [
        "Open Imports & review. Choose the Default account and the Statement balance behavior before selecting a file.",
        "For running-balance bank CSV, choose Use latest balance as checkpoint only if that is the balance anchor you intend. Choose Only import transactions when a newer trusted checkpoint already anchors the account.",
        "Choose a .txt, .csv or transaction-list .json file, or expand Paste entries or see supported formats and paste its contents.",
        "For pasted content, select Import pasted entries. Read the imported/duplicate/checkpoint notification and inspect Transactions immediately.",
        "Use the pencil to correct misclassified credits, transfers, account names or categories. Export a backup before retrying unfamiliar formats."
      ],
      example: "date,description,amount,type,account,category\n2026-11-01,Salary,85000,income,Main account,Salary\n2026-11-02,Coffee,-120,expense,Main account,Food",
      notes: ["This path imports directly without the staged statement review. Ambiguous bank-CSV dates are day/month/year; debit/credit columns become expense/income and need manual exceptions. Basic duplicate detection may skip identical entries; use reviewed statement JSON when equal-looking genuine payments need distinct evidence. Files are limited to 20 MB. Whole-vault backup files belong in Settings → Import JSON."]
    },
    {
      id: "accounts", category: "Manage money", title: "Add bank, card, cash, wallet and asset accounts", view: "accounts",
      summary: "Set the opening balance at the right date for each account you track.",
      steps: [
        "Open Accounts → Add account and enter a recognizable name such as ICICI Savings, HDFC Card, Cash or Pluxee.",
        "Choose the matching account category. Savings, card, cash and wallet categories are payment accounts; investment categories are assets.",
        "Enter the Opening balance and Balance from date. This creates a start-of-day checkpoint, so entries on that date are counted after the opening balance.",
        "Choose a color and select the plus icon. Use Account activity to inspect that account's movements and Balances to check its total.",
        "To remove an unused account, select its trash icon. At least one account must remain; accounts referenced by transactions or bills cannot be deleted until those references are moved or removed."
      ],
      notes: ["Use a negative opening balance for an amount you owe on a credit card; purchases make it more negative and repayments increase it toward zero. Imported account metadata can be reviewed during statement import. An alias/funding-relationship management screen is a future feature, so use recognizable names today."]
    },
    {
      id: "account-categories", category: "Manage money", title: "Create an account category", view: "accounts",
      summary: "Group additional account types as payment accounts or assets.",
      steps: [
        "Open Accounts → Add account category.",
        "Enter a unique category name, such as PPF or an additional wallet type.",
        "Choose Payment or Asset and a color.",
        "Select the plus icon, then choose the new category when adding an account."
      ],
      notes: ["An account category groups balances. A transaction category describes what a payment was for; create those separately in Settings."]
    },
    {
      id: "transfers", category: "Manage money", title: "Move money between owned accounts", view: "accounts",
      summary: "Keep self-transfers and credit-card repayments out of income/spending totals.",
      steps: [
        "Create both owned accounts in Accounts before recording the transfer.",
        "Open Transfer funds, choose different From and To accounts, and enter a positive amount and the actual date.",
        "Enter a description and select Record transfer. For a credit-card repayment, From is the bank account and To is the credit-card account.",
        "Check Account activity on both accounts. The source decreases and the destination increases, while income and spending exclude the transfer.",
        "If both sides appear in statements, link their evidence to the same transfer during reviewed import instead of creating a separate expense and income."
      ],
      notes: ["An ATM withdrawal into a Cash account and movement into your tracked investment account can be transfers. Transfers do not represent investment performance. Money sent to another person is not automatically an owned-account transfer."]
    },
    {
      id: "checkpoints", category: "Manage money", title: "Reconcile an account with a balance checkpoint", view: "accounts",
      summary: "Anchor balances without letting older history change a newer known balance.",
      steps: [
        "Compare the account's activity against a balance you trust, such as a statement closing balance. Check for missing transactions or duplicates first.",
        "Open Accounts → Balance checkpoint and choose the account, balance and date.",
        "Choose Before this date for a start-of-day balance or After this date for an end-of-day balance. Add a note explaining the source.",
        "Select the disk icon. The latest checkpoint anchors the balance; later relevant transactions are applied after that anchor.",
        "To remove the latest removable checkpoint, use the minus-circle action beside the account. Account-creation starting checkpoints do not show that removal action."
      ],
      notes: ["A checkpoint sets a balance anchor; it does not create income or spending. Imported historical transactions can still appear in reports without changing a balance already anchored by a newer checkpoint. Confirm credit-card sign conventions before using statement checkpoints."]
    },
    {
      id: "overview-insights", category: "Manage money", title: "Read Overview and Insights", view: "stats",
      summary: "Understand recorded activity and recognize incomplete coverage.",
      steps: [
        "Choose a reporting month in Period and open Overview. Read recorded spending, recorded income and their difference, Net cash flow; own-account transfers are excluded.",
        "Inspect Spending by category, Trend and Recent activity. The trend spans six months; recent activity can include dates outside the selected reporting month.",
        "Read Statement coverage for confirmed statement periods intersecting this month. No coverage entry is a prompt to check missing statements, not proof of zero spending.",
        "Open Insights for average monthly income/spending over the displayed six-month trend, top tags, account mix, transfer volume and trend notes.",
        "Use Transactions and Accounts to inspect the underlying entries before drawing conclusions from a chart."
      ],
      notes: ["A partial month or missing statement can change the interpretation of totals. The six-month averages include empty months in that window. Baseline, purpose-priority reports and subjective credit-card influence analysis remain future features; current charts do not estimate them."]
    },
    {
      id: "budgets", category: "Manage money", title: "Set and update monthly budgets", view: "budgets",
      summary: "Compare category spending with limits you choose.",
      steps: [
        "Open Budgets and select the reporting month.",
        "Enter Monthly limit for each expense category you want to budget. Blank or nonpositive limits leave the category without an active budget.",
        "Select the disk icon to save all limits.",
        "Read the used percentage and status against the selected month's spending. Adjust the limits and save again when your plan changes."
      ],
      notes: ["Limits are reusable category limits, not separately saved plans for each month. Changing Period changes the spending comparison. A budget does not create a transaction or reserve money, and it is not the planned recurring-expense baseline feature."]
    },
    {
      id: "goals", category: "Manage money", title: "Track a savings goal", view: "goals",
      summary: "Maintain a target and manually update progress.",
      steps: [
        "Open Goals → Add goal. Enter a name, target, amount already saved and optional due date.",
        "Select the plus icon to create it.",
        "As progress changes, edit the saved amount beside the goal and select that goal's disk icon.",
        "Read the funded percentage and due date. Use the goal's trash icon to remove it if no longer needed."
      ],
      notes: ["Goal progress is manually tracked. Updating it does not transfer money, change an account balance or create a transaction; record actual movements separately."]
    },
    {
      id: "bills", category: "Manage money", title: "Track bills and mark them paid or unpaid", view: "bills",
      summary: "Use a monthly bill template and its linked expense.",
      steps: [
        "Open Bills → Add bill. Enter its name, amount, day of month, expense category and payment account, then select plus.",
        "Choose the month in Period. Review each bill's due date and paid/unpaid status.",
        "When recording payment through this screen, select its check icon. Maniman marks that month paid and adds a linked expense on the template's due date.",
        "To reverse that action, select the curved arrow. It marks that month unpaid and removes the linked bill expense for that month.",
        "Use trash to delete the template when it is no longer needed. Inspect Transactions afterward; deleting a bill template also removes expenses linked to that template."
      ],
      notes: ["This is a manually configured bill schedule, not automatic recurrence detection or automatic bank payment. If an imported payment is already in the ledger, reconcile it before marking paid to avoid an extra expense. Edit the resulting transaction if the actual payment date differs from the due date."]
    },
    {
      id: "categories-tags", category: "Manage money", title: "Create transaction categories and automatic tags", view: "settings",
      summary: "Customize payment grouping and reusable keyword tags.",
      steps: [
        "Open Settings → Transaction categories. Choose Expense or Income, enter a unique category name, optional comma-separated keywords and a color, then select plus.",
        "Choose your category when adding or editing a transaction. Quick text entry can suggest categories from recognized keywords.",
        "Open Settings → Tags. Enter a tag name, comma-separated automatic keywords and a color, then select plus.",
        "Leave a manual entry's Tags field blank for automatic keyword tags, or enter an explicit comma-separated list. Edit existing transactions to apply any desired changes.",
        "Use ledger search and Insights → Top tags to inspect the resulting groups."
      ],
      notes: ["Adding keywords does not retroactively relabel all history. These categories and tags do not yet implement the requested reusable purpose/priority combination rules, long descriptions or transaction-couple labels."]
    },
    {
      id: "backup", category: "Privacy & recovery", title: "Export and restore an encrypted backup", view: "settings",
      summary: "Keep a recoverable copy independent of browser storage.",
      steps: [
        "While unlocked, choose Export encrypted backup in Settings or the desktop Vault/mobile App menu. Keep the downloaded JSON file and its date.",
        "Store the passphrase or recovery key separately from the encrypted backup. The backup contains an encrypted vault envelope, not a readable transaction list.",
        "To restore, open Maniman in a separate empty browser profile or site vault and choose the setup screen's Restore option.",
        "Select the encrypted backup and unlock it using its passphrase or recovery key. Verify accounts and recent transactions before relying on the restored copy.",
        "Keep the previous copy until the restored vault and a fresh export are verified."
      ],
      notes: ["Encrypted restore over an existing vault is blocked; it is not a merge. Clearing site data can remove the browser vault. Export does not include your external PDF files or converter JSON; those remain separate local documents."]
    },
    {
      id: "unlock-recovery", category: "Privacy & recovery", title: "Lock, unlock or recover your vault", view: "settings",
      summary: "Protect the active session and recover with your saved key.",
      steps: [
        "To leave the app safely, use Lock vault in the desktop Vault or mobile App menu. Inactivity also locks after your configured timeout.",
        "To return, enter the vault passphrase and select Unlock workspace. Password-manager use and paste are supported.",
        "If you cannot use the passphrase, select Use recovery key on the unlock screen and paste the recovery key you saved during setup.",
        "After unlocking, export an encrypted backup and keep the recovery key secure."
      ],
      notes: ["There is no implemented in-app passphrase-change or recovery-key-rotation screen. If both the passphrase and recovery key are lost, cloud password reset cannot decrypt the records. Locking clears active access; it does not erase the encrypted vault."]
    },
    {
      id: "legacy-restore", category: "Privacy & recovery", title: "Import an older whole-app JSON backup", view: "settings",
      summary: "Migrate a supported legacy backup into encrypted storage.",
      steps: [
        "Export an encrypted backup of your current vault first.",
        "Open Settings → Import JSON, or Restore backup / import JSON in the Vault/App menu, and choose the older app-state JSON file.",
        "Read the replacement confirmation. A whole-app backup replaces current state; it is different from adding statement rows.",
        "Confirm only when you intend that replacement. Unsupported or inconsistent single-currency backups are rejected before replacement.",
        "Verify balances, categories and recent entries, then export a new encrypted backup. Retain the old file until verification is complete."
      ],
      notes: ["Selecting versioned statement JSON here routes to statement review instead. Older plaintext files and historical copies are not automatically erased by migration. Do not share them or commit real financial files to source control."]
    },
    {
      id: "cloud-sync", category: "Privacy & recovery", title: "Use optional cloud login and sync", view: "settings",
      summary: "Use configured hosting while keeping vault credentials separate.",
      steps: [
        "Open Settings → Cloud sync. If it says cloud sync is disabled, continue local use; a maintainer must configure and validate the hosted service first.",
        "When configured, enter your cloud email and password and choose Sign in, or Create account. Follow email confirmation if the host requires it.",
        "Unlock the active account's vault when prompted. Cloud accounts and the local-only vault use separate storage namespaces; signing in is not an automatic migration of your local-only records.",
        "Use Sync now when available and check the reported status. If a conflict is shown, export both encrypted copies before attempting recovery; do not overwrite either one.",
        "Before switching devices or signing out, export an encrypted backup and verify the latest sync status. Use Sign out to leave the cloud account."
      ],
      notes: ["Encrypted sync code exists, but live two-device enrollment, merge/conflict recovery and hosted owner-isolation validation remain release work. Do not assume a fresh second-device vault will merge automatically. PDF conversion remains local; cloud login information and sync metadata are separate from encrypted financial contents."]
    },
    {
      id: "reset", category: "Privacy & recovery", title: "Start fresh or load starter data", view: "settings",
      summary: "Understand these replacement actions before confirming.",
      steps: [
        "Export and verify an encrypted backup of any records you want to keep.",
        "Open Settings → Data. Choose Start fresh for blank transactions, budgets, bills and goals, or Restore starter data for synthetic example records.",
        "Read the replacement confirmation and continue only if this is the intended vault.",
        "Check Overview and Accounts afterward. If sync is active, the replacement is an ordinary state change and can be sent to the active server/cloud account."
      ],
      notes: ["These actions replace financial state; they are not a new independent vault or an undo command. Start fresh retains the current currency and starter account structure. There is no general undo: recovery relies on a separate verified backup and restore into an empty vault."]
    },
    {
      id: "wrong-totals", category: "Troubleshooting", title: "A total, balance or payment looks wrong", view: "transactions",
      summary: "Check coverage, classification, duplicates and checkpoints in order.",
      steps: [
        "Confirm Period and the active vault/account. Search Transactions across all dates; changing the month does not filter the entire ledger.",
        "Look for missing statements and overlapping app/bank sources. Use reviewed linking when two sources describe the same payment; do not remove one merely because date and amount match.",
        "Check whether own-account movements were recorded as transfers, and whether credits such as refunds or split recoveries received the intended treatment.",
        "For an account balance, inspect its latest checkpoint and whether it applies before or after its date. Check credit-card signs and transaction direction.",
        "Correct the source entry with the pencil, or add a justified checkpoint. Export a backup before making broad corrections."
      ],
      notes: ["Income/spending and account balances answer different questions. A known balance checkpoint does not prove historical statement coverage. Goal progress is independent of cash movements, and bill payment can create an extra expense if the same payment was already imported."]
    },
    {
      id: "import-blocked", category: "Troubleshooting", title: "A statement or upload will not import", view: "imports",
      summary: "Fix the source or configuration without bypassing review.",
      steps: [
        "Confirm the file kind. Convert PDFs locally; use versioned statement JSON for reviewed import, transaction-list JSON/CSV/text for direct import, and Settings for whole-app backups.",
        "Read the preview's validation errors and extraction warnings. Confirm institution, account, full statement dates and each row's treatment.",
        "For incomplete OCR, excluded candidate rows, unknown layouts or mixed currencies, correct or split/re-extract the local document. Do not remove warnings just to make an incomplete file appear complete.",
        "For No valid entries found, check supported column names, dates, amounts and duplicate notices. Use Supported formats in the paste section as a template.",
        "If saving fails, check that the vault is unlocked and browser storage is available. Preserve the source file and current encrypted backup, then retry after the storage issue is resolved."
      ]
    },
    {
      id: "storage-conflict", category: "Troubleshooting", title: "Storage is unavailable, locked or in conflict", view: "settings",
      summary: "Preserve copies before resolving browser/server differences.",
      steps: [
        "Use HTTPS or localhost in a browser that supports Web Crypto and IndexedDB. If private browsing or storage restrictions interfere, use a normal profile without deleting the existing vault.",
        "If the app reports unreadable remote storage, stop replacement attempts and preserve that server copy. A read error does not mean an empty vault.",
        "For concurrent-tab or cloud conflicts, stop making edits in multiple tabs. Export the available local encrypted copy and the remote encrypted copy when that action is offered.",
        "Keep both copies and recover the intended one in a separate empty browser profile. Automatic merging and overwrite resolution are not implemented.",
        "When the maintainer publishes an update, reconnect and reload the app. If the new UI does not appear, close and reopen the app; back up before clearing any site storage."
      ],
      notes: ["Browser-only saving is not the same as a verified server/cloud save. An interrupted sync can leave devices at different revisions. Do not delete site data or a server file to make a conflict disappear before preserving recoverable copies."]
    }
  ];
  const viewLabels = { dashboard: "Overview", transactions: "Transactions", imports: "Imports & review", accounts: "Accounts", stats: "Insights", budgets: "Budgets", goals: "Goals", bills: "Bills", settings: "Settings" };
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const normalize = (value) => String(value || "").normalize("NFKC").toLocaleLowerCase().trim();
  function matchingTopicIds(query = "", category = "") {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return topics.filter((topic) => (!category || topic.category === category) && words.every((word) => normalize([topic.title, topic.category, topic.summary, ...topic.steps, ...(topic.notes || []), topic.example || ""].join(" ")).includes(word))).map((topic) => topic.id);
  }
  function render() {
    return `<div class="guide-intro card"><h2 class="card-title">Start with one task</h2><p>Search for a feature or choose a topic group. Each walkthrough describes the app you can use today.</p><div class="guide-controls"><label class="field"><span class="field-label">Search the guide</span><input id="guideSearch" class="control" type="search" placeholder="Try: refund, checkpoint, recovery" autocomplete="off"></label><label class="field"><span class="field-label">Topic group</span><select id="guideCategory" class="control"><option value="">All topics</option>${categories.map((category) => `<option value="${escape(category)}">${escape(category)}</option>`).join("")}</select></label></div><p id="guideResults" class="muted" role="status" aria-live="polite">${topics.length} topics shown</p></div>
      <details class="card guide-index"><summary>Browse all topics</summary><nav aria-label="User guide topics">${topics.map((topic) => `<a href="#guide-${topic.id}" data-guide-link="${topic.id}">${escape(topic.title)}</a>`).join("")}</nav></details>
      <p id="guideEmpty" class="empty" hidden>No matching topics. Try fewer words or select All topics.</p>
      <div class="guide-topics">${topics.map((topic, index) => `<details class="card guide-topic" id="guide-${topic.id}" data-guide-topic="${topic.id}" ${index === 0 ? "open" : ""}><summary><span class="guide-category">${escape(topic.category)}</span><h2>${escape(topic.title)}</h2><span class="guide-summary">${escape(topic.summary)}</span></summary><ol class="guide-steps">${topic.steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol>${topic.example ? `<pre class="guide-example"><code>${escape(topic.example)}</code></pre>` : ""}${(topic.notes || []).map((note) => `<p class="guide-note">${escape(note)}</p>`).join("")}${topic.view ? `<button type="button" class="button ghost" data-jump-view="${topic.view}">Open ${escape(viewLabels[topic.view])}</button>` : ""}</details>`).join("")}</div>`;
  }
  function bind(root) {
    const search = root.querySelector("#guideSearch");
    const category = root.querySelector("#guideCategory");
    if (!search || !category) return;
    const sections = Array.from(root.querySelectorAll("[data-guide-topic]"));
    const links = Array.from(root.querySelectorAll("[data-guide-link]"));
    const update = () => {
      const matches = new Set(matchingTopicIds(search.value, category.value));
      for (const section of sections) {
        section.hidden = !matches.has(section.dataset.guideTopic);
        if (normalize(search.value)) section.open = !section.hidden;
      }
      for (const link of links) link.hidden = !matches.has(link.dataset.guideLink);
      root.querySelector("#guideResults").textContent = `${matches.size} topic${matches.size === 1 ? "" : "s"} shown`;
      root.querySelector("#guideEmpty").hidden = matches.size > 0;
    };
    search.addEventListener("input", update);
    category.addEventListener("change", update);
    for (const link of links) link.addEventListener("click", () => {
      const section = sections.find((item) => item.dataset.guideTopic === link.dataset.guideLink);
      if (section) section.open = true;
    });
  }
  function toMarkdown() {
    return "# Maniman User’s Guide\n\nOpen **User’s Guide** in the desktop sidebar or the mobile three-line App menu for searchable walkthroughs. This document describes implemented features; limitations are stated in each topic.\n\n" + topics.map((topic) => `## ${topic.title}\n\n${topic.summary}\n\n${topic.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n${topic.example ? `\n\`\`\`text\n${topic.example}\n\`\`\`\n` : ""}${(topic.notes || []).map((note) => `\n${note}\n`).join("")}`).join("\n");
  }
  return { categories, topics, matchingTopicIds, render, bind, toMarkdown };
});
