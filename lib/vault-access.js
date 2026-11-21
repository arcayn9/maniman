(function (root) {
  "use strict";
  let accessSequence = 0;
  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (text) item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function field(form, label, type = "password") {
    const wrapper = element("label", "", "field");
    wrapper.append(element("span", label, "field-label"));
    const input = element("input", "", "control");
    input.type = type; input.required = true;
    input.autocomplete = type === "password" ? "current-password" : "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "none");
    wrapper.append(input); form.append(wrapper);
    return input;
  }
  function downloadEnvelope(envelope) {
    if (!root.ManimanVault.isEnvelope(envelope)) throw new Error("No encrypted vault is available to export.");
    const url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" }));
    const link = element("a");
    link.href = url; link.download = `maniman-vault-${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function requestAccess({ initialState, remoteEnvelope = null, migration = false, localCandidate = null, accountLabel = "", onChangeAccount = null, replacementState } = {}) {
    const manager = root.ManimanSecureStorage;
    if (!manager) throw new Error("Encrypted storage could not be loaded.");
    const localEnvelope = manager.getEnvelope();
    const existing = localEnvelope || remoteEnvelope;
    const id = `maniman-vault-access-${++accessSequence}`;
    const previousFocus = document.activeElement;
    const shells = Array.from(document.querySelectorAll(".shell")).map((shell) => ({ shell, wasInert: shell.inert === true || shell.hasAttribute("inert") }));
    for (const { shell } of shells) { shell.inert = true; shell.setAttribute("inert", ""); }
    const backdrop = element("div", "", "vault-backdrop");
    const panel = element("section", "", "vault-panel");
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.tabIndex = -1;
    panel.setAttribute("aria-labelledby", `${id}-title`); panel.setAttribute("aria-describedby", `${id}-intro`);
    const title = element("h1", existing ? "Unlock your vault" : "Protect your financial records"); title.id = `${id}-title`;
    const intro = element("p", existing ? "Enter your vault passphrase to unlock this session. Your financial records are decrypted on this device." : "Create a vault passphrase of at least 12 characters. You will save a recovery key before opening your workspace.", "vault-intro"); intro.id = `${id}-intro`;
    const brand = element("div", "", "vault-brand");
    const mark = element("img"); mark.src = "icons/maniman-icon.svg"; mark.alt = ""; mark.width = 44; mark.height = 44;
    brand.append(mark, element("span", "Maniman"));
    panel.append(brand, title, intro);
    if (accountLabel) panel.append(element("p", accountLabel, "vault-help"));
    if (onChangeAccount) {
      const change = element("button", "Change account", "button ghost"); change.type = "button";
      change.addEventListener("click", async () => {
        change.disabled = true;
        try { await onChangeAccount(); }
        catch (issue) { error.textContent = issue.message; error.hidden = false; }
        finally { change.disabled = false; }
      }); panel.append(change);
    }
    if (migration && !existing) panel.append(element("p", "Existing data will be copied into encrypted storage. Legacy files and historical backups remain unchanged; verify your encrypted backup before cleaning them up.", "vault-help"));
    const form = element("form", "", "vault-form");
    const secret = field(form, existing ? "Vault passphrase" : "New vault passphrase");
    secret.minLength = existing ? 1 : 12;
    if (!existing) secret.autocomplete = "new-password";
    const repeat = existing ? null : field(form, "Repeat vault passphrase");
    if (repeat) repeat.autocomplete = "new-password";
    const help = element("p", "Your vault passphrase is separate from cloud login. You can paste it or use your password manager.", "vault-help"); help.id = `${id}-help`;
    const error = element("p", "", "vault-error"); error.id = `${id}-error`; error.hidden = true;
    error.setAttribute("role", "alert"); error.setAttribute("aria-atomic", "true");
    secret.setAttribute("aria-describedby", `${help.id} ${error.id}`);
    if (repeat) repeat.setAttribute("aria-describedby", `${help.id} ${error.id}`);
    const submit = element("button", existing ? "Unlock workspace" : "Create encrypted vault", "button"); submit.type = "submit";
    form.append(help, error, submit);
    panel.append(form, element("p", "Encrypted working copy on this browser. An active tab can resume across reloads until it locks; no passphrase or decryption key is saved to browser storage.", "vault-footer"));
    const focusable = () => Array.from(panel.querySelectorAll("input,button,textarea,a,select")).filter((control) => !control.disabled && !control.hidden && control.type !== "hidden" && control.tabIndex !== -1);
    const keepFocus = (event) => {
      if (!panel.contains(event.target)) (focusable()[0] || panel).focus();
    };
    backdrop.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    });
    let disposed = false;
    const close = (restoreFocus = true) => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("focusin", keepFocus);
      backdrop.remove();
      for (const { shell, wasInert } of shells) {
        shell.inert = wasInert;
        if (!wasInert) shell.removeAttribute("inert");
      }
      if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
    };
    let busy = false;
    let recoveryMode = false;
    let recoverySubmit = null;
    if (existing) {
      const toggle = element("button", "Use recovery key", "button ghost"); toggle.type = "button";
      toggle.addEventListener("click", () => {
        recoveryMode = !recoveryMode;
        secret.value = "";
        error.textContent = ""; error.hidden = true; secret.removeAttribute("aria-invalid");
        secret.previousSibling.textContent = recoveryMode ? "Recovery key" : "Vault passphrase";
        secret.autocomplete = recoveryMode ? "off" : "current-password";
        help.textContent = recoveryMode ? "Use the recovery key you saved when creating this vault. Cloud password reset cannot unlock encrypted records." : "Your vault passphrase is separate from cloud login. You can paste it or use your password manager.";
        toggle.textContent = recoveryMode ? "Use passphrase" : "Use recovery key";
        secret.focus();
      });
      form.append(toggle);
    } else {
      if (localCandidate) {
        const reuse = element("button", migration ? "Use my local vault’s key for cloud records" : "Use this browser’s existing local vault for my account", "button ghost"); reuse.type = "button";
        const note = element("p", migration ? "Your account has older records to encrypt. Use the existing local vault’s passphrase and recovery key to protect those cloud records; the original local copy is retained. This does not merge the two datasets." : "No cloud vault was found for this account. This browser has a local-only encrypted vault. Choosing it copies that vault without deleting the original; unlock it with its existing passphrase.", "vault-help");
        reuse.addEventListener("click", async () => {
          if (busy) return; busy = true;
          close(false);
          try {
            resolveAccess(await requestAccess({ initialState, remoteEnvelope: localCandidate, accountLabel, onChangeAccount, replacementState: migration ? initialState : undefined }));
          } catch (issue) { rejectAccess(issue); }
        });
        form.append(note, reuse);
      }
      const restoreLabel = element("label", "Restore an encrypted Maniman backup", "vault-restore field");
      const restore = element("input"); restore.type = "file"; restore.accept = ".json,application/json";
      restore.addEventListener("change", async () => {
        if (busy) return;
        try {
          const file = restore.files?.[0];
          if (!file) return;
          busy = true;
          for (const control of form.querySelectorAll("input,button")) control.disabled = true;
          if (file.size > 48 * 1024 * 1024) throw new Error("Encrypted backup is too large.");
          const candidate = JSON.parse(await file.text());
          if (!root.ManimanVault.isEnvelope(candidate)) throw new Error("Choose an encrypted Maniman vault backup.");
          close(false);
          resolveAccess(await requestAccess({ initialState, remoteEnvelope: candidate, accountLabel, onChangeAccount }));
        } catch (issue) {
          if (disposed) { rejectAccess(issue); return; }
          error.textContent = issue.message; error.hidden = false;
          for (const control of form.querySelectorAll("input,button")) control.disabled = false;
          secret.focus();
        } finally { busy = false; }
      });
      restoreLabel.append(restore); form.append(restoreLabel);
    }
    backdrop.append(panel); document.body.append(backdrop);
    document.addEventListener("focusin", keepFocus);
    secret.focus();
    let resolveAccess, rejectAccess;
    const result = new Promise((resolve, reject) => { resolveAccess = resolve; rejectAccess = reject; });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (recoverySubmit) { await recoverySubmit(); return; }
      if (busy) return;
      busy = true;
      error.textContent = ""; error.hidden = true;
      secret.removeAttribute("aria-invalid"); if (repeat) repeat.removeAttribute("aria-invalid");
      form.setAttribute("aria-busy", "true");
      submit.textContent = existing ? "Unlocking vault…" : "Creating vault…";
      for (const control of form.querySelectorAll("input,button")) control.disabled = true;
      try {
        if (repeat && secret.value !== repeat.value) throw new Error("Passphrases do not match.");
        if (existing) {
          const opened = localEnvelope
            ? await manager.unlock(secret.value, { recovery: recoveryMode })
            : await manager.install(existing, secret.value, { recovery: recoveryMode, ...(replacementState === undefined ? {} : { replacementState }) });
          secret.value = ""; close(); resolveAccess(opened); return;
        }
        const created = await manager.create(secret.value, initialState);
        secret.value = ""; if (repeat) repeat.value = "";
        form.replaceChildren();
        title.textContent = "Save your recovery key";
        intro.textContent = "Keep this key separately from your encrypted backup. Cloud password reset cannot recover your vault. Paste the saved key below to verify it.";
        const keyLabel = element("label", "", "field");
        const keyDisplay = element("textarea", "", "control vault-recovery-key"); keyDisplay.value = created.recoveryKey; keyDisplay.readOnly = true; keyDisplay.rows = 3;
        keyDisplay.spellcheck = false;
        keyLabel.append(element("span", "Your recovery key", "field-label"), keyDisplay); form.append(keyLabel);
        const backup = element("button", "Download encrypted backup", "button ghost"); backup.type = "button";
        backup.addEventListener("click", () => downloadEnvelope(manager.getEnvelope())); form.append(backup);
        const verify = field(form, "Paste the recovery key to verify it"); verify.autocomplete = "off";
        const done = element("button", "Verify recovery and continue", "button"); done.type = "button";
        const recoveryError = element("p", "", "vault-error"); recoveryError.id = `${id}-recovery-error`; recoveryError.hidden = true;
        recoveryError.setAttribute("role", "alert"); recoveryError.setAttribute("aria-atomic", "true");
        verify.setAttribute("aria-describedby", recoveryError.id);
        form.append(recoveryError, done);
        recoverySubmit = async () => {
          if (done.disabled) return;
          recoveryError.textContent = ""; recoveryError.hidden = true; verify.removeAttribute("aria-invalid");
          done.disabled = true;
          form.setAttribute("aria-busy", "true");
          try {
            if (verify.value.trim() !== created.recoveryKey) throw new Error("The recovery key does not match.");
            await root.ManimanVault.unlockEnvelope(manager.getEnvelope(), verify.value.trim(), { recovery: true });
            keyDisplay.value = ""; verify.value = ""; close(); resolveAccess(created.state);
          } catch (issue) {
            recoveryError.textContent = issue.message; recoveryError.hidden = false;
            verify.setAttribute("aria-invalid", "true"); done.disabled = false; verify.focus();
          } finally { form.setAttribute("aria-busy", "false"); }
        };
        done.addEventListener("click", recoverySubmit);
        keyDisplay.focus();
      } catch (issue) {
        error.textContent = issue.message; error.hidden = false;
        const invalidField = repeat && secret.value !== repeat.value ? repeat : secret;
        invalidField.setAttribute("aria-invalid", "true");
        for (const control of form.querySelectorAll("input,button")) control.disabled = false;
        invalidField.focus();
      } finally { busy = false; form.setAttribute("aria-busy", "false"); submit.textContent = existing ? "Unlock workspace" : "Create encrypted vault"; }
    });
    return result;
  }
  root.ManimanVaultAccess = { requestAccess, downloadEnvelope };
})(globalThis);
