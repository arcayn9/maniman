const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("service worker never intercepts sensitive GETs or arbitrary files", () => {
  const handlers = {};
  const context = vm.createContext({ URL, self: { location: { origin: "https://example.invalid" }, registration: { scope: "https://example.invalid/maniman/" }, addEventListener(name, fn) { handlers[name] = fn; } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8"), context);
  for (const url of ["https://example.invalid/api/state", "https://example.invalid/maniman/api/state", "https://example.invalid/maniman/config.js", "https://example.invalid/maniman/data/maniman-state.json", "https://example.invalid/maniman/app.js?private=1"]) {
    let intercepted = false;
    handlers.fetch({ request: { method: "GET", url }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});
