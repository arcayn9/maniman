const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const vault = require("../lib/secure-storage.js");
const { createBroker } = require("../lib/session-broker.js");
const passphrase = "synthetic shared vault passphrase";
function store() { const data = new Map(); return { data, get: async (id) => data.get(id), set: async (id, value) => data.set(id, structuredClone(value)) }; }
function browser(broker, backing = new Map()) {
  class Channel {
    constructor() { this.port1 = { onmessage: null, close() {} }; this.port2 = { postMessage: (data) => this.port1.onmessage?.({ data }) }; }
  }
  const context = vm.createContext({
    crypto: globalThis.crypto, MessageChannel: Channel, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {},
    navigator: { serviceWorker: { ready: Promise.resolve({ active: { postMessage(request, ports) { ports[0].postMessage(broker().handle(request)); } } }) } },
    sessionStorage: { getItem: (name) => backing.get(name) || null, setItem: (name, value) => backing.set(name, value), removeItem: (name) => backing.delete(name) }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../lib/vault-session.js"), "utf8"), context);
  return { api: context.ManimanVaultSession, backing };
}

test("an ordinary tab reload resumes a nonextractable key held only in worker RAM", async () => {
  const disk = store(); const a = vault.createManager(disk); await a.begin("user:owner-A");
  await a.create(passphrase, { transactions: [{ description: "synthetic private entry" }] });
  const broker = createBroker(); const first = browser(() => broker);
  assert.equal(await first.api.remember(a), true);
  a.lock();
  const b = vault.createManager(disk); await b.begin("user:owner-A");
  const reload = browser(() => broker, first.backing);
  assert.equal((await reload.api.resume(b)).transactions[0].description, "synthetic private entry");
  assert.equal(b.isUnlocked(), true);
  assert.equal(b.sessionKey().extractable, false);
  assert.match([...reload.backing.values()][0], /^[a-f0-9]{64}$/);
  const persisted = JSON.stringify([...disk.data.values()]);
  assert.ok(!persisted.includes(passphrase) && !persisted.includes("synthetic private entry"));
  reload.api.forget(); first.api.forget();
});

test("lock revokes resume; worker reclamation and expiry require unlocking without damaging the vault", async () => {
  const disk = store(); const a = vault.createManager(disk); await a.begin(); await a.create(passphrase, { accounts: [] });
  let time = 0, broker = createBroker({ now: () => time });
  const client = browser(() => broker); await client.api.remember(a, 1);
  const encrypted = JSON.stringify(a.getEnvelope());
  a.lock(); time = 60001;
  const b = vault.createManager(disk); await b.begin();
  assert.equal(await client.api.resume(b), null);
  assert.equal(JSON.stringify(b.getEnvelope()), encrypted);
  await b.unlock(passphrase); await client.api.remember(b);
  broker = createBroker(); b.lock();
  assert.equal(await client.api.resume(b), null);
  await b.unlock(passphrase); await client.api.remember(b);
  client.api.forget(); b.lock();
  assert.equal(client.backing.size, 0);
  assert.equal(await client.api.resume(b), null);
});

test("capability, owner, vault, expiration and key properties constrain broker requests", async () => {
  let time = 0; const broker = createBroker({ now: () => time });
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const request = { capability: "a".repeat(64), namespace: "user:owner-A", vaultId: "synthetic-vault-id-12345", key, ttl: 1000 };
  assert.equal(broker.handle({ ...request, action: "remember" }).ok, true);
  for (const override of [{ capability: "b".repeat(64) }, { namespace: "user:owner-B" }, { vaultId: "another-vault-id-54321" }]) assert.equal(broker.handle({ ...request, ...override, action: "resume" }).ok, false);
  time = 500; broker.handle({ ...request, action: "ping" }); time = 1001;
  assert.equal(broker.handle({ ...request, action: "resume" }).ok, false, "heartbeat cannot extend inactivity");
  const extractable = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  assert.equal(broker.handle({ ...request, key: extractable, action: "remember" }).ok, false);
  assert.equal(broker.handle({ ...request, ttl: 121 * 60000, action: "remember" }).ok, false);
});

test("a phone and laptop unlock the same encrypted vault with one passphrase and clean replicas can advance", async () => {
  const laptop = vault.createManager(store()), phone = vault.createManager(store());
  await laptop.begin("user:owner-A"); await laptop.create(passphrase, { value: 1 });
  const cloud = laptop.getEnvelope(); await laptop.acknowledge(cloud);
  await phone.begin("user:owner-A"); assert.equal((await phone.install(cloud, passphrase)).value, 1); await phone.acknowledge(cloud);
  await laptop.save({ value: 2 }); const next = laptop.getEnvelope(); await laptop.acknowledge(next);
  assert.equal(await phone.isAcknowledged(), true);
  assert.equal((await phone.adoptRemote(next)).value, 2);
  assert.equal(phone.getEnvelope().vaultId, laptop.getEnvelope().vaultId);
  phone.lock(); assert.equal((await phone.unlock(passphrase)).value, 2);
  await assert.rejects(phone.adoptRemote(cloud), /advance the local revision/);
});

test("unsynced edits cannot be overwritten and an unchanged server acknowledgement remains recognizable", async () => {
  const local = vault.createManager(store()); await local.begin(); await local.create(passphrase, { value: 1 });
  const base = local.getEnvelope(); await local.acknowledge(base); await local.save({ value: "local edit" });
  assert.equal(await local.isAcknowledged(), false);
  assert.equal(await local.isAcknowledged(base), true);
  const remote = await vault.unlockEnvelope(base, passphrase);
  const next = await vault.seal(base, remote.key, { value: "remote edit" });
  const later = await vault.seal(next, remote.key, { value: "new remote edit" });
  await assert.rejects(local.adoptRemote(later), /not acknowledged/);
  assert.equal((await local.unlock(passphrase)).value, "local edit");
});

test("a previously local vault can be explicitly installed for an account without deleting the original", async () => {
  const disk = store(); const local = vault.createManager(disk); await local.begin(); await local.create(passphrase, { value: 7 });
  local.lock(); await local.begin("user:owner-A");
  const candidate = await local.localCandidate();
  assert.equal((await local.install(candidate, passphrase)).value, 7);
  assert.equal(disk.data.get("local").vaultId, local.getEnvelope().vaultId);
  assert.ok(disk.data.has("user:owner-A"));
});

test("preserving a legacy-cloud conflict writes ciphertext without replacing the device vault", async () => {
  const disk = store(), manager = vault.createManager(disk);
  await manager.begin("user:owner-A"); await manager.create(passphrase, { transactions: [{ description: "device-only" }] });
  const before = JSON.stringify(manager.getEnvelope());
  const conflict = await manager.preserveStateConflict({ transactions: [{ description: "legacy-cloud-only" }] });
  assert.equal(JSON.stringify(manager.getEnvelope()), before);
  assert.equal((await vault.unlockEnvelope(conflict, passphrase)).state.transactions[0].description, "legacy-cloud-only");
  assert.ok(!JSON.stringify([...disk.data.values()]).includes("legacy-cloud-only"));
});
