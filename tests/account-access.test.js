const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { createDocument } = require("./helpers/fake-dom.cjs");
function setup(auth) {
  const document = createDocument();
  const shell = document.createElement("div"); shell.className = "shell"; shell.inert = false; document.body.append(shell);
  const context = vm.createContext({ document, URL, location: { href: "https://app.example/app/?old=1#ignored" } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/account-access.js"), "utf8"), context);
  const access = context.ManimanAccountAccess;
  return { document, shell, access, client: { auth }, button: (text) => document.body.querySelectorAll("button").find((button) => button.textContent === text) };
}

test("account dialog signs in before vault access and clears its account password", async () => {
  const requests = [];
  const app = setup({ signInWithPassword: async (request) => { requests.push(request); return { data: { session: { user: { id: "account-A" } } }, error: null }; } });
  const finished = app.access.requestSession({ client: app.client });
  const form = app.document.body.querySelector("form"); const [email, password] = form.querySelectorAll("input");
  email.value = " owner@example.test "; password.value = "account secret";
  assert.equal(app.shell.inert, true);
  await form.dispatch("submit");
  assert.equal((await finished).session.user.id, "account-A");
  assert.equal(requests[0].email, "owner@example.test");
  assert.equal(password.value, ""); assert.equal(app.shell.inert, false);
  assert.equal(app.document.events.focusin.length, 0);
});

test("signup cannot send an empty/short password and provides the app-origin confirmation redirect", async () => {
  const calls = [];
  const app = setup({ signUp: async (request) => { calls.push(request); return { data: { user: { id: "new" }, session: null }, error: null }; } });
  await assert.rejects(app.access.perform(app.client, "signup", "test@example.test", ""), /at least 6/);
  await assert.rejects(app.access.perform(app.client, "signup", "test@example.test", "short"), /at least 6/);
  assert.equal(calls.length, 0);
  const finished = app.access.requestSession({ client: app.client });
  await app.button("Create a new account").dispatch("click");
  const form = app.document.body.querySelector("form"); const [email, password] = form.querySelectorAll("input");
  email.value = "test@example.test"; password.value = "a valid account password";
  await form.dispatch("submit");
  assert.equal(calls[0].options.emailRedirectTo, "https://app.example/app/");
  assert.match(app.document.body.querySelector(".account-status").textContent, /If confirmation is required/);
  assert.equal(app.document.body.querySelector(".account-status").hidden, false);
  assert.equal(password.value, ""); assert.equal(app.shell.inert, true);
  await app.button("Use local-only on this device").dispatch("click"); assert.equal((await finished).mode, "local");
});

test("confirmation resend uses its email/redirect without requiring or sending a password", async () => {
  let request;
  const app = setup({ resend: async (value) => { request = value; return { data: {}, error: null }; } });
  await app.access.perform(app.client, "resend", "person@example.test", "");
  assert.equal(request.type, "signup");
  assert.equal(request.options.emailRedirectTo, "https://app.example/app/");
  assert.equal("password" in request, false);
});

test("provider failures remain visible, recoverable and distinct from vault secrets", async () => {
  const app = setup({ signInWithPassword: async () => ({ data: {}, error: { code: "invalid_credentials", message: "Invalid login credentials" } }) });
  const done = app.access.requestSession({ client: app.client, notice: "Previous session expired." });
  const form = app.document.body.querySelector("form"); const [email, password] = form.querySelectorAll("input");
  email.value = "test@example.test"; password.value = "wrong account password";
  await form.dispatch("submit");
  assert.match(form.querySelector(".vault-error").textContent, /not your vault passphrase/);
  assert.equal(form.querySelector(".vault-error").hidden, false);
  assert.ok(form.querySelectorAll("button").every((button) => !button.disabled));
  assert.match(app.access.errorMessage({ status: 429 }), /Wait/);
  assert.match(app.access.errorMessage({ code: "unexpected_failure" }), /email provider/);
  await app.button("Use local-only on this device").dispatch("click"); await done;
});
