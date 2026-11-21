const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("service worker never intercepts sensitive GETs or arbitrary files", () => {
  const handlers = {};
  const context = vm.createContext({ URL, self: { location: { origin: "https://example.invalid" }, registration: { scope: "https://example.invalid/maniman/" }, addEventListener(name, fn) { handlers[name] = fn; } } });
  context.importScripts = () => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/session-broker.js"), "utf8"), context);
    context.self.ManimanSessionBroker = context.ManimanSessionBroker;
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8"), context);
  for (const url of ["https://example.invalid/api/state", "https://example.invalid/maniman/api/state", "https://example.invalid/maniman/config.js", "https://example.invalid/maniman/data/maniman-state.json", "https://example.invalid/maniman/app.js?private=1"]) {
    let intercepted = false;
    handlers.fetch({ request: { method: "GET", url }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});

test("RAM unlock messages reject unrelated origins, scopes and non-window clients", () => {
  const handlers = {}, accepted = [];
  const context = vm.createContext({ URL, self: {
    location: { origin: "https://example.invalid" }, registration: { scope: "https://example.invalid/maniman/" },
    addEventListener(name, fn) { handlers[name] = fn; },
    ManimanSessionBroker: { createBroker: () => ({ handle: (request) => { accepted.push(request); return { ok: true }; } }) }
  }, importScripts() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8"), context);
  for (const source of [
    { type: "window", url: "https://attacker.invalid/maniman/" },
    { type: "window", url: "https://example.invalid/another-app/" },
    { type: "window", url: "https://example.invalid/maniman-other/" },
    { type: "worker", url: "https://example.invalid/maniman/" }, null
  ]) {
    let answer;
    handlers.message({ source, data: { type: "maniman-vault-session" }, ports: [{ postMessage(value) { answer = value; } }] });
    assert.equal(answer.ok, false);
  }
  assert.equal(accepted.length, 0);
  let answer;
  handlers.message({ source: { type: "window", url: "https://example.invalid/maniman/?ignored=1" }, data: { type: "maniman-vault-session", action: "ping" }, ports: [{ postMessage(value) { answer = value; } }] });
  assert.equal(answer.ok, true); assert.equal(accepted.length, 1);
});
