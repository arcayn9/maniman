(function (root) {
  "use strict";
  const text = (tag, value, className = "") => { const node = document.createElement(tag); node.textContent = value; node.className = className; return node; };
  function redirectUrl() {
    try { const url = new URL("./", root.location.href); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; }
    catch (_) { return undefined; }
  }
  function errorMessage(error) {
    const code = error?.code || "";
    if (code === "email_not_confirmed") return "Confirm your email before signing in. You can resend the confirmation below.";
    if (code === "invalid_credentials" || error?.status === 400 && /invalid login/i.test(error?.message || "")) return "Email or account password was not accepted. Use your account password here, not your vault passphrase.";
    if (error?.status === 429 || /rate_limit/.test(code)) return "Too many authentication or email requests. Wait before retrying; repeated clicks can extend the limit.";
    if (/signup_disabled|email_provider_disabled/.test(code)) return "Email registration is disabled on the hosted service. The host must enable it before you can register.";
    if (/unexpected_failure|email_send/.test(code) || /sending.*email/i.test(error?.message || "")) return "The account service could not send the confirmation email. Retry later; the host may need to repair its email provider.";
    if (/fetch|network/i.test(error?.message || "")) return "The account service could not be reached. Check your connection and retry.";
    return error?.message || "The account request failed. Please retry.";
  }
  async function perform(client, action, email, password) {
    email = String(email || "").trim(); password = String(password || "");
    if (!email || !/^\S+@\S+$/.test(email)) throw new Error("Enter a valid account email address.");
    if (action === "signup" && password.length < 6) throw new Error("Enter an account password of at least 6 characters before registering. This is separate from your vault passphrase.");
    if (action === "signin" && !password) throw new Error("Enter your account password, not your vault passphrase.");
    const target = redirectUrl();
    const options = target ? { emailRedirectTo: target } : {};
    let response;
    if (action === "signup") response = await client.auth.signUp({ email: email.trim(), password, options });
    else if (action === "resend") response = await client.auth.resend({ type: "signup", email: email.trim(), options });
    else response = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (response.error) throw response.error;
    return response.data || {};
  }
  async function requestSession({ client, notice = "" }) {
    return new Promise((resolve) => {
      const shells = Array.from(document.querySelectorAll(".shell")).map((shell) => ({ shell, inert: shell.inert }));
      shells.forEach(({ shell }) => { shell.inert = true; });
      const backdrop = text("div", "", "vault-backdrop");
      const panel = text("section", "", "vault-panel account-panel");
      panel.tabIndex = -1; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "accountAccessTitle");
      const brand = text("div", "Maniman", "vault-brand");
      const title = text("h1", "Sign in to your account"); title.id = "accountAccessTitle";
      const intro = text("p", "Sign in first to find your existing encrypted vault. Use the same account and vault passphrase on your phone and laptop.", "vault-intro");
      const form = text("form", "", "vault-form");
      function field(label, type, auto) {
        const wrapper = text("label", "", "field"); wrapper.append(text("span", label, "field-label"));
        const input = document.createElement("input"); input.className = "control"; input.type = type; input.autocomplete = auto; input.required = true;
        wrapper.append(input); form.append(wrapper); return input;
      }
      const email = field("Email", "email", "email");
      const password = field("Account password", "password", "current-password"); password.minLength = 1;
      const status = text("p", "", "account-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.hidden = true;
      const error = text("p", "", "vault-error"); error.setAttribute("role", "alert"); error.hidden = true; error.id = "accountAccessError";
      email.setAttribute("aria-describedby", error.id); password.setAttribute("aria-describedby", error.id);
      const submit = text("button", "Sign in", "button"); submit.type = "submit";
      const toggle = text("button", "Create a new account", "button ghost"); toggle.type = "button";
      const resend = text("button", "Resend confirmation email", "button ghost"); resend.type = "button";
      const local = text("button", "Use local-only on this device", "button ghost"); local.type = "button";
      form.append(error, status, submit, toggle, resend, local);
      panel.append(brand, title, intro, form, text("p", "Your account password signs you in. Your separate vault passphrase decrypts records and is never sent to the account service.", "vault-footer"));
      backdrop.append(panel); document.body.append(backdrop);
      let signup = false, busy = false, disposed = false;
      const controls = () => [email, password, submit, toggle, resend, local].filter((node) => !node.disabled);
      const focus = (event) => { if (!panel.contains(event.target)) email.focus(); };
      document.addEventListener("focusin", focus);
      backdrop.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const items = controls(); const first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      const finish = (value) => {
        if (disposed) return; disposed = true; password.value = "";
        document.removeEventListener("focusin", focus); backdrop.remove();
        shells.forEach(({ shell, inert }) => { shell.inert = inert; }); resolve(value);
      };
      const run = async (action) => {
        if (busy) return;
        if (!email.value.trim()) { error.textContent = "Enter your email address first."; error.hidden = false; email.focus(); return; }
        busy = true; error.hidden = true; status.hidden = true; form.setAttribute("aria-busy", "true");
        controls().forEach((node) => { node.disabled = true; });
        submit.textContent = "Please wait…";
        try {
          const data = await perform(client, action, email.value, password.value);
          password.value = "";
          if (data.session?.user) { finish({ mode: "cloud", session: data.session }); return; }
          if (action === "signin") throw new Error("The account service returned no signed-in session. Retry signing in.");
          status.textContent = action === "resend" ? "Confirmation requested. If your account needs confirmation, check your inbox and spam folder." : "Registration accepted. If confirmation is required, check your inbox and spam folder, then return here to sign in. Existing accounts can sign in instead.";
          status.hidden = false;
        } catch (issue) { error.textContent = errorMessage(issue); error.hidden = false; }
        finally {
          busy = false; form.setAttribute("aria-busy", "false");
          [email, password, submit, toggle, resend, local].forEach((node) => { node.disabled = false; });
          submit.textContent = signup ? "Create account" : "Sign in";
          if (!disposed) (error.hidden || action === "resend" ? email : password).focus();
        }
      };
      form.addEventListener("submit", (event) => { event.preventDefault(); return run(signup ? "signup" : "signin"); });
      toggle.addEventListener("click", () => {
        signup = !signup; error.hidden = true; status.hidden = true;
        title.textContent = signup ? "Create your account" : "Sign in to your account";
        submit.textContent = signup ? "Create account" : "Sign in";
        toggle.textContent = signup ? "Use an existing account" : "Create a new account";
        password.minLength = signup ? 6 : 1;
        password.autocomplete = signup ? "new-password" : "current-password"; password.value = ""; email.focus();
      });
      resend.addEventListener("click", () => run("resend"));
      local.addEventListener("click", () => finish({ mode: "local", session: null }));
      if (notice) { status.textContent = notice; status.hidden = false; }
      email.focus();
    });
  }
  root.ManimanAccountAccess = { requestSession, perform, errorMessage, redirectUrl };
})(globalThis);
