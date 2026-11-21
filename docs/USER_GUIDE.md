# Maniman User’s Guide

Open **User’s Guide** in the desktop sidebar or the mobile three-line App menu for searchable walkthroughs. This document describes implemented features; limitations are stated in each topic.

## Set up your first vault

Create a private workspace and add the accounts you use.

1. Open Maniman using HTTPS or localhost. If cloud login is configured, sign in or create your account first, or explicitly choose local-only use. Unlock an existing account vault with its existing passphrase; create a passphrase of at least 12 characters only when setting up a new vault.
2. For a new vault, select Create encrypted vault. Save the recovery key somewhere separate from your encrypted backup, then paste it into the verification field and continue. An existing local-only vault can be explicitly adopted for an empty cloud account without deleting its original copy.
3. Open Accounts. Add your real bank, card, cash and wallet accounts with their opening balances and dates. The initial Main account is a placeholder you can use or replace after adding another account.
4. Open Transactions to add a payment, or Imports & review to bring in statements. New vaults use Indian rupees (INR, ₹).
5. Open Settings → Export encrypted backup and keep the downloaded file. Repeat after important imports or changes.

A vault passphrase unlocks financial records; a cloud login password signs into the hosting account. They serve different purposes. Neither support nor a cloud password reset can recreate a lost vault passphrase and recovery key.

## Navigate, choose a period and read action icons

Find screens on desktop and mobile without changing stored history.

1. On desktop, use the sidebar. On a phone, use Overview, Transactions, Imports and Accounts in the bottom navigation; open the three-line App menu for the other screens and this guide.
2. Choose a month in the Period field. Overview, Insights, Budgets and Bills use the selected month; the transaction ledger retains all dates and has its own search and filters.
3. Use the pencil to edit, trash to delete, plus to add, disk to save, cross to cancel, check to mark a bill paid, and curved arrow to undo or mark unpaid. Hover an icon for its action title; screen readers announce a descriptive label.
4. Read the storage status near the desktop sidebar footer or in Settings. Saved in this browser and Synced to cloud describe different storage locations.
5. Use the guide search to find a topic, or choose a topic group. Open any numbered walkthrough to see its steps.

Changing the period does not delete history. System light/dark appearance is followed automatically. Deleting a row acts immediately; export a backup first if you may need to restore it.

## Set the currency and auto-lock time

Choose preferences before recording financial data.

1. Open Settings → Preferences. New vaults default to INR and show ₹ with Indian digit grouping, for example ₹1,23,456.78.
2. If you need another supported currency, choose it before adding transactions, nonzero balances, checkpoints, budgets, goals, bills or statement evidence.
3. Choose Default month to set the reporting period; the topbar Period field changes the same preference.
4. Set Auto-lock after inactivity to a value from 1 to 120 minutes. The default is 15 minutes; changes save automatically.

One vault uses one currency. Changing a label is not currency conversion, so currency changes are blocked once financial data exists. Existing and restored records keep their saved currency, including older USD records.

## Install the app and use it offline

Keep a convenient shortcut while understanding where data lives.

1. Open the regular Maniman HTTPS address or localhost address in a supported browser and allow the app to finish loading online.
2. If offered by your browser, choose Install app or Add to home screen. Open that shortcut to use Maniman in its own window.
3. Unlock the same browser or installed-app vault with its passphrase. Browser storage belongs to this browser profile and site address.
4. When offline, use an already cached app shell and local vault. Reconnect and check sync status before assuming another device has your latest work.
5. Export an encrypted backup before clearing site data, changing browser profiles or moving to another address.

Installing the PWA does not itself enable cloud sync. Private browsing, storage cleanup or changing the app origin can make the current local vault unavailable. The separate local PDF converter still runs on your computer.

## Add an expense, income or transfer

Record one transaction with an explicit type, account and category.

1. Open Transactions and expand Add transaction.
2. Choose Expense, Income or Transfer. Enter a positive amount and the actual transaction date.
3. Choose the account. For a transfer, choose different From and To accounts; otherwise choose the transaction category.
4. Enter a description. Optionally add comma-separated tags and a note. Blank tags allow keyword-based automatic tags.
5. Select the plus icon to add the transaction. Check the ledger and the relevant month's Overview.

Use Transfer for movement between your own accounts, including card repayments and transfers into an investment account you track. A third-party refund or borrowed money is not automatically the same economic event as salary; review its type and category yourself.

## Log payments with Quick entry

Preview plain-language entries before adding them.

1. Open Overview and expand Quick entry.
2. Enter one payment per line with an amount, description and account name. You can include yesterday or an explicit ISO date. Use the exact account names from Accounts.
3. Read the live preview. Check type, amount, date, category and accounts; the parser uses deterministic words and keywords rather than a language model.
4. Select Log entries when the preview is correct, or the eraser icon to clear the text.
5. Open Transactions to correct any saved entry with the pencil icon. Use the manual form for entries the text parser cannot express reliably.

```text
coffee 120 Cash yesterday
salary 85000 Main account 2026-11-01
transfer 5000 Main account to Cash 2026-11-03
```

Create the example accounts first or substitute your own names. Quick entry may fall back to the first account when it cannot recognize one; always check the preview. A transfer needs two recognized, different owned accounts.

## Find, edit and delete transactions

Search all recorded dates and combine account/type filters.

1. Open Transactions. Search by description, category, note or tag.
2. Combine All types and All accounts filters as needed. Selecting an account includes both incoming and outgoing sides of its transfers.
3. Select the pencil beside an entry. The editor opens with its current values; change the fields and select the disk to save, or the cross to cancel editing.
4. Select trash only when you intend to remove an entry. The deletion is immediate, and there is no general undo bin.
5. Check the balance and reports after changing a date, account, type or amount. Use the contextual action titles to distinguish repeated icons.

Deleting a transaction does not erase its original external PDF/JSON file. Statement batch undo has separate evidence-aware behavior. Removing the final entry from a legacy checkpoint-backed import can also remove that linked checkpoint.

## Convert a PDF statement locally

Keep PDF passwords, extraction and OCR on your computer.

1. On the computer holding the Maniman checkout, install Python 3.10 or later and run the setup commands below from the project folder. Put the PDF in private-statements.
2. Run the converter command to write a new JSON file. It refuses to overwrite an existing output; choose a different output name for another attempt.
3. For a protected PDF, add --ask-password and enter the password at the local prompt. For scanned pages, add --ocr after installing local Tesseract.
4. Read the converter result. Unknown layouts and incomplete/OCR extraction remain review documents; correct or re-extract them locally before commitment.
5. Open Imports & review in Maniman and choose the resulting JSON. The app accepts the converted JSON rather than uploading the PDF.

```text
python3 -m venv .venv-converter
.venv-converter/bin/python -m pip install -r requirements-converter.lock
mkdir -p private-statements
.venv-converter/bin/python -m tools.statement_converter private-statements/statement.pdf -o private-statements/statement.json
```

Current converter support includes generic explicit columns and ruled Value Date/Post Date grids with wrapped cells. Post Date supplies the ledger date while both source dates are retained. This does not cover every bank PDF or borderless/scanned variation. PDFs with several accounts may need splitting locally. No remote OCR or model fallback is used. Converter JSON is ordinary sensitive plaintext until imported; manage its storage and retention separately from the encrypted vault.

## Review a statement's institution, account and dates

Confirm what the extracted document actually covers before saving.

1. Open Imports & review and choose a converted statement JSON file. Read any validation errors or extraction warnings in the preview.
2. Confirm the institution name. For each statement section, explicitly choose the existing owned account or select the new-account option and enter its name and kind.
3. Confirm the declared statement start and end dates from the source statement. Do not substitute the first and last payment dates for missing statement coverage.
4. Check currency and account identity, including any masked identifier. A previous confirmed source mapping can preselect an account on future imports; correct it if it identifies the wrong account.
5. Continue to transaction treatment in the preview. Nothing from a versioned statement is committed merely by choosing the file.

Unknown account or period information can be confirmed by you. Failed or partial extraction, invalid dates, identity conflicts and mixed currencies can block saving and need correction first. The Overview coverage panel shows confirmed statement periods, not inferred completeness of all your accounts.

## Review overlaps, transfers and statement rows

Count a financial event once while retaining its source evidence.

1. For each preview row, choose its confirmed treatment: a new expense, new income, transfer to another owned account, or a link to an existing transaction.
2. For a suspected duplicate, inspect the offered existing-transaction candidates and choose a link only when it is the same event. Equal date and amount alone do not prove a duplicate.
3. For an owned-account transfer, select the other account and verify direction. Review credit-card repayments, refunds, lending and split recoveries individually rather than treating all credits as income.
4. Use the debit/credit bulk actions only after checking exceptions. Move through every page with the arrow icons. Inspect warnings and decide whether known-sign statement closing balances should become checkpoints.
5. Tick the completed-review checkbox and select Save reviewed statement to encrypted vault. Check the saved/linked/skipped counts, then use Transactions to refine categories, tags and notes.

Reimporting the same source observations does not create another copy of those rows. Cross-source matching remains user reviewed; automatic fuzzy reconciliation and richer refund/loan purposes are not yet implemented. New statement income is not assumed to be Salary.

## Undo a statement import

Remove one batch's evidence without discarding independently supported edits.

1. Export an encrypted backup if you may need this batch again.
2. Open Imports & review and find the batch in Recent statement imports. The latest five batches are shown.
3. Select the curved-arrow Undo statement import action only when you intend to remove that batch. It acts immediately.
4. Review Transactions, Accounts and Statement coverage after the operation.

Undo removes that batch's evidence and its exclusively supported untouched transactions/checkpoints. Manually edited transactions or transactions supported by other evidence are retained. The source file on your computer is unchanged; this is not a general transaction-deletion undo.

## Import text, CSV or a transaction-list JSON file

Use the direct-import path when you do not have versioned statement JSON.

1. Open Imports & review. Choose the Default account and the Statement balance behavior before selecting a file.
2. For running-balance bank CSV, choose Use latest balance as checkpoint only if that is the balance anchor you intend. Choose Only import transactions when a newer trusted checkpoint already anchors the account.
3. Choose a .txt, .csv or transaction-list .json file, or expand Paste entries or see supported formats and paste its contents.
4. For pasted content, select Import pasted entries. Read the imported/duplicate/checkpoint notification and inspect Transactions immediately.
5. Use the pencil to correct misclassified credits, transfers, account names or categories. Export a backup before retrying unfamiliar formats.

```text
date,description,amount,type,account,category
2026-11-01,Salary,85000,income,Main account,Salary
2026-11-02,Coffee,-120,expense,Main account,Food
```

This path imports directly without the staged statement review. Ambiguous bank-CSV dates are day/month/year; debit/credit columns become expense/income and need manual exceptions. Basic duplicate detection may skip identical entries; use reviewed statement JSON when equal-looking genuine payments need distinct evidence. Files are limited to 20 MB. Whole-vault backup files belong in Settings → Import JSON.

## Add bank, card, cash, wallet and asset accounts

Set the opening balance at the right date for each account you track.

1. Open Accounts → Add account and enter a recognizable name such as ICICI Savings, HDFC Card, Cash or Pluxee.
2. Choose the matching account category. Savings, card, cash and wallet categories are payment accounts; investment categories are assets.
3. Enter the Opening balance and Balance from date. This creates a start-of-day checkpoint, so entries on that date are counted after the opening balance.
4. Choose a color and select the plus icon. Use Account activity to inspect that account's movements and Balances to check its total.
5. To remove an unused account, select its trash icon. At least one account must remain; accounts referenced by transactions or bills cannot be deleted until those references are moved or removed.

Use a negative opening balance for an amount you owe on a credit card; purchases make it more negative and repayments increase it toward zero. Imported account metadata can be reviewed during statement import. An alias/funding-relationship management screen is a future feature, so use recognizable names today.

## Create an account category

Group additional account types as payment accounts or assets.

1. Open Accounts → Add account category.
2. Enter a unique category name, such as PPF or an additional wallet type.
3. Choose Payment or Asset and a color.
4. Select the plus icon, then choose the new category when adding an account.

An account category groups balances. A transaction category describes what a payment was for; create those separately in Settings.

## Move money between owned accounts

Keep self-transfers and credit-card repayments out of income/spending totals.

1. Create both owned accounts in Accounts before recording the transfer.
2. Open Transfer funds, choose different From and To accounts, and enter a positive amount and the actual date.
3. Enter a description and select Record transfer. For a credit-card repayment, From is the bank account and To is the credit-card account.
4. Check Account activity on both accounts. The source decreases and the destination increases, while income and spending exclude the transfer.
5. If both sides appear in statements, link their evidence to the same transfer during reviewed import instead of creating a separate expense and income.

An ATM withdrawal into a Cash account and movement into your tracked investment account can be transfers. Transfers do not represent investment performance. Money sent to another person is not automatically an owned-account transfer.

## Reconcile an account with a balance checkpoint

Anchor balances without letting older history change a newer known balance.

1. Compare the account's activity against a balance you trust, such as a statement closing balance. Check for missing transactions or duplicates first.
2. Open Accounts → Balance checkpoint and choose the account, balance and date.
3. Choose Before this date for a start-of-day balance or After this date for an end-of-day balance. Add a note explaining the source.
4. Select the disk icon. The latest checkpoint anchors the balance; later relevant transactions are applied after that anchor.
5. To remove the latest removable checkpoint, use the minus-circle action beside the account. Account-creation starting checkpoints do not show that removal action.

A checkpoint sets a balance anchor; it does not create income or spending. Imported historical transactions can still appear in reports without changing a balance already anchored by a newer checkpoint. Confirm credit-card sign conventions before using statement checkpoints.

## Read Overview and Insights

Understand recorded activity and recognize incomplete coverage.

1. Choose a reporting month in Period and open Overview. Read recorded spending, recorded income and their difference, Net cash flow; own-account transfers are excluded.
2. Inspect Spending by category, Trend and Recent activity. The trend spans six months; recent activity can include dates outside the selected reporting month.
3. Read Statement coverage for confirmed statement periods intersecting this month. No coverage entry is a prompt to check missing statements, not proof of zero spending.
4. Open Insights for average monthly income/spending over the displayed six-month trend, top tags, account mix, transfer volume and trend notes.
5. Use Transactions and Accounts to inspect the underlying entries before drawing conclusions from a chart.

A partial month or missing statement can change the interpretation of totals. The six-month averages include empty months in that window. Baseline, purpose-priority reports and subjective credit-card influence analysis remain future features; current charts do not estimate them.

## Set and update monthly budgets

Compare category spending with limits you choose.

1. Open Budgets and select the reporting month.
2. Enter Monthly limit for each expense category you want to budget. Blank or nonpositive limits leave the category without an active budget.
3. Select the disk icon to save all limits.
4. Read the used percentage and status against the selected month's spending. Adjust the limits and save again when your plan changes.

Limits are reusable category limits, not separately saved plans for each month. Changing Period changes the spending comparison. A budget does not create a transaction or reserve money, and it is not the planned recurring-expense baseline feature.

## Track a savings goal

Maintain a target and manually update progress.

1. Open Goals → Add goal. Enter a name, target, amount already saved and optional due date.
2. Select the plus icon to create it.
3. As progress changes, edit the saved amount beside the goal and select that goal's disk icon.
4. Read the funded percentage and due date. Use the goal's trash icon to remove it if no longer needed.

Goal progress is manually tracked. Updating it does not transfer money, change an account balance or create a transaction; record actual movements separately.

## Track bills and mark them paid or unpaid

Use a monthly bill template and its linked expense.

1. Open Bills → Add bill. Enter its name, amount, day of month, expense category and payment account, then select plus.
2. Choose the month in Period. Review each bill's due date and paid/unpaid status.
3. When recording payment through this screen, select its check icon. Maniman marks that month paid and adds a linked expense on the template's due date.
4. To reverse that action, select the curved arrow. It marks that month unpaid and removes the linked bill expense for that month.
5. Use trash to delete the template when it is no longer needed. Inspect Transactions afterward; deleting a bill template also removes expenses linked to that template.

This is a manually configured bill schedule, not automatic recurrence detection or automatic bank payment. If an imported payment is already in the ledger, reconcile it before marking paid to avoid an extra expense. Edit the resulting transaction if the actual payment date differs from the due date.

## Create transaction categories and automatic tags

Customize payment grouping and reusable keyword tags.

1. Open Settings → Transaction categories. Choose Expense or Income, enter a unique category name, optional comma-separated keywords and a color, then select plus.
2. Choose your category when adding or editing a transaction. Quick text entry can suggest categories from recognized keywords.
3. Open Settings → Tags. Enter a tag name, comma-separated automatic keywords and a color, then select plus.
4. Leave a manual entry's Tags field blank for automatic keyword tags, or enter an explicit comma-separated list. Edit existing transactions to apply any desired changes.
5. Use ledger search and Insights → Top tags to inspect the resulting groups.

Adding keywords does not retroactively relabel all history. These categories and tags do not yet implement the requested reusable purpose/priority combination rules, long descriptions or transaction-couple labels.

## Export and restore an encrypted backup

Keep a recoverable copy independent of browser storage.

1. While unlocked, choose Export encrypted backup in Settings or the desktop Vault/mobile App menu. Keep the downloaded JSON file and its date.
2. Store the passphrase or recovery key separately from the encrypted backup. The backup contains an encrypted vault envelope, not a readable transaction list.
3. To restore, open Maniman in a separate empty browser profile or site vault and choose the setup screen's Restore option.
4. Select the encrypted backup and unlock it using its passphrase or recovery key. Verify accounts and recent transactions before relying on the restored copy.
5. Keep the previous copy until the restored vault and a fresh export are verified.

Encrypted restore over an existing vault is blocked; it is not a merge. Clearing site data can remove the browser vault. Export does not include your external PDF files or converter JSON; those remain separate local documents.

## Lock, unlock or recover your vault

Protect the active session and recover with your saved key.

1. To leave the app safely, use Lock vault in the desktop Vault or mobile App menu. Inactivity also locks after your configured timeout.
2. To return, enter the vault passphrase and select Unlock workspace. Password-manager use and paste are supported.
3. If you cannot use the passphrase, select Use recovery key on the unlock screen and paste the recovery key you saved during setup.
4. An active tab can normally reload without another unlock until it locks. A browser restart, suspended or reclaimed worker, or unsupported browser may require your passphrase again; this does not erase records.
5. After unlocking, export an encrypted backup and keep the recovery key secure.

There is no implemented in-app passphrase-change or recovery-key-rotation screen. If both the passphrase and recovery key are lost, cloud password reset cannot decrypt the records. Locking clears active access; it does not erase the encrypted vault. Reload convenience uses a nonextractable key held only in service-worker RAM and a random per-tab capability in sessionStorage. No vault passphrase, recovery key or decryption key is persisted for it.

## Import an older whole-app JSON backup

Migrate a supported legacy backup into encrypted storage.

1. Export an encrypted backup of your current vault first.
2. Open Settings → Import JSON, or Restore backup / import JSON in the Vault/App menu, and choose the older app-state JSON file.
3. Read the replacement confirmation. A whole-app backup replaces current state; it is different from adding statement rows.
4. Confirm only when you intend that replacement. Unsupported or inconsistent single-currency backups are rejected before replacement.
5. Verify balances, categories and recent entries, then export a new encrypted backup. Retain the old file until verification is complete.

Selecting versioned statement JSON here routes to statement review instead. Older plaintext files and historical copies are not automatically erased by migration. Do not share them or commit real financial files to source control.

## Use optional cloud login and sync

Use configured hosting while keeping vault credentials separate.

1. On a configured host, sign in before vault unlock, or choose Create a new account. Enter an account password of at least 6 characters for registration. Follow confirmation if required; Resend confirmation email is available on the sign-in screen and in Settings → Cloud sync.
2. Unlock the account vault with its vault passphrase or recovery key. On your phone and laptop, use the same account and the same vault secret. Account password and vault passphrase serve different purposes.
3. If your account has no encrypted vault yet, create one or explicitly choose the existing local-only vault on this browser. For older cloud records, the local vault’s key can protect those records without merging the two datasets. The original local copy is retained.
4. Use Settings → Cloud sync → Sync now and check the reported status before changing devices. A clean device can receive a newer cloud snapshot; conflicting edits are preserved and must be exported before recovery.
5. Local-only use remains available without an account. Choose Change account on the vault screen to return to cloud sign-in, or sign in through Settings after unlocking. Use Sign out to leave the cloud account.

Registration acceptance is not proof of email delivery. If account credentials are rejected, use the account password, not the vault passphrase. A stale session returns to sign-in without deleting encrypted data. If cloud reads fail on a new device, reconnect and use Retry opening workspace rather than creating a competing vault.

Only encrypted financial snapshots sync. Account identity, authentication tokens and sync metadata are separate. Live email delivery and physical phone/laptop checks remain release validation; automatic merge and overwrite resolution are not implemented.

## Start fresh or load starter data

Understand these replacement actions before confirming.

1. Export and verify an encrypted backup of any records you want to keep.
2. Open Settings → Data. Choose Start fresh for blank transactions, budgets, bills and goals, or Restore starter data for synthetic example records.
3. Read the replacement confirmation and continue only if this is the intended vault.
4. Check Overview and Accounts afterward. If sync is active, the replacement is an ordinary state change and can be sent to the active server/cloud account.

These actions replace financial state; they are not a new independent vault or an undo command. Start fresh retains the current currency and starter account structure. There is no general undo: recovery relies on a separate verified backup and restore into an empty vault.

## A total, balance or payment looks wrong

Check coverage, classification, duplicates and checkpoints in order.

1. Confirm Period and the active vault/account. Search Transactions across all dates; changing the month does not filter the entire ledger.
2. Look for missing statements and overlapping app/bank sources. Use reviewed linking when two sources describe the same payment; do not remove one merely because date and amount match.
3. Check whether own-account movements were recorded as transfers, and whether credits such as refunds or split recoveries received the intended treatment.
4. For an account balance, inspect its latest checkpoint and whether it applies before or after its date. Check credit-card signs and transaction direction.
5. Correct the source entry with the pencil, or add a justified checkpoint. Export a backup before making broad corrections.

Income/spending and account balances answer different questions. A known balance checkpoint does not prove historical statement coverage. Goal progress is independent of cash movements, and bill payment can create an extra expense if the same payment was already imported.

## A statement or upload will not import

Fix the source or configuration without bypassing review.

1. Confirm the file kind. Convert PDFs locally; use versioned statement JSON for reviewed import, transaction-list JSON/CSV/text for direct import, and Settings for whole-app backups.
2. Read the preview's validation errors and extraction warnings. Confirm institution, account, full statement dates and each row's treatment.
3. For incomplete OCR, excluded candidate rows, unknown layouts or mixed currencies, correct or split/re-extract the local document. Do not remove warnings just to make an incomplete file appear complete.
4. For No valid entries found, check supported column names, dates, amounts and duplicate notices. Use Supported formats in the paste section as a template.
5. If saving fails, check that the vault is unlocked and browser storage is available. Preserve the source file and current encrypted backup, then retry after the storage issue is resolved.

## Storage is unavailable, locked or in conflict

Preserve copies before resolving browser/server differences.

1. Use HTTPS or localhost in a browser that supports Web Crypto and IndexedDB. If private browsing or storage restrictions interfere, use a normal profile without deleting the existing vault.
2. If the app reports unreadable remote storage, stop replacement attempts and preserve that server copy. A read error does not mean an empty vault.
3. For concurrent-tab or cloud conflicts, stop making edits in multiple tabs. Export the available local encrypted copy and the remote encrypted copy when that action is offered.
4. Keep both copies and recover the intended one in a separate empty browser profile. Automatic merging and overwrite resolution are not implemented.
5. When the maintainer publishes an update, reconnect and reload the app. If the new UI does not appear, close and reopen the app; back up before clearing any site storage.

Browser-only saving is not the same as a verified server/cloud save. An interrupted sync can leave devices at different revisions. Do not delete site data or a server file to make a conflict disappear before preserving recoverable copies.
