const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createServer } = require("../server.js");
const vault = require("../lib/secure-storage.js");

test("HTTP server excludes private files, rejects plaintext/foreign origins, and enforces revision CAS", async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "maniman-server-test-"));
  const dataFile = path.join(temporary, "test.vault.json");
  const server = createServer({ dataFile, token: "" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(`${base}/api/state`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.equal((await fetch(base)).status, 200);
  const guideResponse = await fetch(`${base}/lib/user-guide.js`);
  assert.equal(guideResponse.status, 200);
  assert.match(guideResponse.headers.get("content-type"), /javascript/);
  for (const relative of ["data/maniman-state.json", ".git/config", "config.example.js", "docs/examples/statement-import.example.json", "requirements-converter.txt"]) assert.equal((await fetch(`${base}/${relative}`)).status, 404);
  assert.equal((await post({ state: { transactions: [{ description: "private data" }] }, expectedRevision: 0 })).status, 422);
  const created = await vault.createEnvelope("server test passphrase", { transactions: [] });
  assert.equal((await post({ state: created.envelope, expectedRevision: 0 }, { origin: "https://untrusted.invalid" })).status, 403);
  assert.equal((await post({ state: created.envelope, expectedRevision: 0 })).status, 200);
  const next = await vault.seal(created.envelope, created.key, { transactions: [{ id: "new" }] });
  assert.equal((await post({ state: next, expectedRevision: created.envelope.revision })).status, 200);
  const staleWithMoreSaves = { ...next, revision: next.revision + 5 };
  assert.equal((await post({ state: staleWithMoreSaves, expectedRevision: created.envelope.revision })).status, 409);
  const response = await fetch(`${base}/api/state`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual((await response.json()).state, next);
  assert.equal(fs.readFileSync(dataFile, "utf8").includes('"transactions"'), false);
});

test("local API bearer authentication is required when configured", async (t) => {
  const server = createServer({ token: "synthetic-test-token" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/status`)).status, 401);
  assert.equal((await fetch(`${base}/api/status`, { headers: { authorization: "Bearer synthetic-test-token" } })).status, 200);
});
