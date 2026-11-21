const test = require("node:test");
const assert = require("node:assert/strict");
const vault = require("../lib/secure-storage.js");
const sample = { transactions: [{ description: "private merchant", amount: 123 }], settings: { currency: "INR" } };
const passphrase = "correct vault passphrase";
const memoryStore = () => {
  const values = new Map();
  return { values, async get(key) { return structuredClone(values.get(key)); }, async set(key, value) { values.set(key, structuredClone(value)); } };
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
function deferNextWrite(store) {
  const entered = deferred(), release = deferred();
  const original = store.set;
  let held = false;
  store.set = async (owner, value) => {
    if (!held) { held = true; entered.resolve(); await release.promise; }
    return original(owner, value);
  };
  return { entered: entered.promise, release: release.resolve };
}

test("encrypted vault round trip, random IVs and recovery", async () => {
  const created = await vault.createEnvelope(passphrase, sample);
  assert.equal(vault.isEnvelope(created.envelope), true);
  assert.equal(JSON.stringify(created.envelope).includes("private merchant"), false);
  assert.deepEqual((await vault.unlockEnvelope(created.envelope, passphrase)).state, sample);
  assert.deepEqual((await vault.unlockEnvelope(created.envelope, created.recoveryKey, { recovery: true })).state, sample);
  const changed = await vault.seal(created.envelope, created.key, sample);
  assert.notEqual(changed.payload.iv, created.envelope.payload.iv);
  assert.equal(changed.revision, created.envelope.revision + 1);
});

test("wrong passphrase, altered data, altered identity and unsupported KDF fail closed", async () => {
  const { envelope } = await vault.createEnvelope(passphrase, sample);
  await assert.rejects(vault.unlockEnvelope(envelope, "wrong passphrase"), /Could not unlock/);
  for (const mutate of [
    (v) => { v.payload.ciphertext = (v.payload.ciphertext[0] === "A" ? "B" : "A") + v.payload.ciphertext.slice(1); },
    (v) => { v.vaultId = "00000000-0000-0000-0000-000000000000"; },
    (v) => { v.revision += 1; },
    (v) => { v.kdf.iterations = 999999999; }
  ]) {
    const altered = structuredClone(envelope); mutate(altered);
    await assert.rejects(vault.unlockEnvelope(altered, passphrase));
  }
});

test("serialized saves retain latest snapshot, lock prevents saving and namespaces isolate owners", async () => {
  const store = memoryStore();
  const manager = vault.createManager(store);
  await manager.begin("user:alice");
  await manager.create(passphrase, sample);
  await Promise.all([manager.save({ value: 1 }), manager.save({ value: 2 })]);
  manager.lock();
  await assert.rejects(manager.save({ value: 3 }), /Unlock/);
  assert.deepEqual(await manager.unlock(passphrase), { value: 2 });
  await manager.begin("user:bob");
  assert.equal(manager.getEnvelope(), null);
  await manager.create("different private phrase", { value: "bob" });
  await manager.begin("user:alice");
  await assert.rejects(manager.unlock("different private phrase"));
  assert.deepEqual(await manager.unlock(passphrase), { value: 2 });
  assert.equal(JSON.stringify([...store.values.values()]).includes("private merchant"), false);
});

test("failed durable save is reported and encrypted restore does not overwrite a vault", async () => {
  const store = memoryStore();
  const manager = vault.createManager(store);
  await manager.begin();
  const recovery = await manager.create(passphrase, sample);
  const original = manager.getEnvelope();
  store.set = async () => { throw new Error("disk full"); };
  await assert.rejects(manager.save({ changed: true }), /disk full/);
  assert.deepEqual(manager.getEnvelope(), original);
  const restored = vault.createManager(memoryStore());
  await restored.begin();
  assert.deepEqual(await restored.install(original, recovery.recoveryKey, { recovery: true }), sample);
  await assert.rejects(restored.install(original, passphrase), /already exists/);
});

test("lock during the durable create write never re-unlocks the manager", async () => {
  const store = memoryStore();
  const manager = vault.createManager(store);
  await manager.begin("user:alice");
  const gate = deferNextWrite(store);
  const creating = manager.create(passphrase, { owner: "alice" });
  const rejected = assert.rejects(creating, /session changed/);
  await gate.entered;
  manager.lock();
  gate.release();
  await rejected;
  assert.equal(manager.isUnlocked(), false);
  assert.equal(manager.namespace(), "user:alice");
  assert.deepEqual(await manager.unlock(passphrase), { owner: "alice" });
});

test("an owner switch during install cannot attach the previous owner's key or vault", async () => {
  const source = await vault.createEnvelope(passphrase, { owner: "alice" });
  const store = memoryStore();
  const manager = vault.createManager(store);
  await manager.begin("user:alice");
  const gate = deferNextWrite(store);
  const installing = manager.install(source.envelope, source.recoveryKey, { recovery: true });
  const rejected = assert.rejects(installing, /session changed/);
  await gate.entered;
  const switching = manager.begin("user:bob");
  assert.equal(manager.namespace(), "user:bob");
  assert.equal(manager.isUnlocked(), false);
  assert.equal(manager.getEnvelope(), null);
  gate.release();
  await rejected;
  await switching;
  assert.equal(manager.namespace(), "user:bob");
  assert.equal(manager.getEnvelope(), null);
  assert.equal(manager.isUnlocked(), false);
  assert.equal(store.values.has("user:bob"), false);
  assert.equal(store.values.get("user:alice").vaultId, source.envelope.vaultId);
});

test("overlapping begin reads are serialized and only the latest owner becomes active", async () => {
  const alice = await vault.createEnvelope(passphrase, { owner: "alice" });
  const bob = await vault.createEnvelope("bob's distinct vault phrase", { owner: "bob" });
  const store = memoryStore();
  store.values.set("user:alice", alice.envelope);
  store.values.set("user:bob", bob.envelope);
  const entered = deferred(), release = deferred();
  const get = store.get;
  store.get = async (owner) => {
    if (owner === "user:alice") { entered.resolve(); await release.promise; }
    return get(owner);
  };
  const manager = vault.createManager(store);
  const first = manager.begin("user:alice");
  const rejected = assert.rejects(first, /session changed/);
  await entered.promise;
  const second = manager.begin("user:bob");
  release.resolve();
  await rejected;
  await second;
  assert.equal(manager.namespace(), "user:bob");
  assert.equal(manager.getEnvelope().vaultId, bob.envelope.vaultId);
  assert.equal(manager.isUnlocked(), false);
  assert.deepEqual(await manager.unlock("bob's distinct vault phrase"), { owner: "bob" });
});

test("concurrent creates cannot overwrite the first vault and recovery key", async () => {
  const store = memoryStore();
  const manager = vault.createManager(store);
  await manager.begin();
  const outcomes = await Promise.allSettled([
    manager.create(passphrase, { value: "first" }),
    manager.create("another long vault passphrase", { value: "second" })
  ]);
  assert.equal(outcomes[0].status, "fulfilled");
  assert.equal(outcomes[1].status, "rejected");
  assert.match(outcomes[1].reason.message, /already exists/);
  const persisted = store.values.get("local");
  assert.deepEqual((await vault.unlockEnvelope(persisted, outcomes[0].value.recoveryKey, { recovery: true })).state, { value: "first" });
});

test("lock during a durable save stays locked and a later unlock reloads the latest snapshot", async () => {
  const store = memoryStore();
  const manager = vault.createManager(store);
  await manager.begin();
  await manager.create(passphrase, { value: 1 });
  const gate = deferNextWrite(store);
  const saving = manager.save({ value: 2 });
  const rejected = assert.rejects(saving, /session changed/);
  await gate.entered;
  manager.lock();
  gate.release();
  await rejected;
  assert.equal(manager.isUnlocked(), false);
  assert.deepEqual(await manager.unlock(passphrase), { value: 2 });
  await manager.save({ value: 3 });
  assert.equal(manager.getEnvelope().revision, 3);
});

test("a stale manager cannot overwrite a second tab's durable changes", async () => {
  const store = memoryStore();
  store.compareAndSet = async (owner, expected, next) => {
    const previous = store.values.get(owner) || null;
    if (JSON.stringify(previous) !== JSON.stringify(expected || null)) throw new Error("Encrypted local copy changed in another tab.");
    store.values.set(owner, structuredClone(next));
  };
  const first = vault.createManager(store), second = vault.createManager(store);
  await first.begin();
  await first.create(passphrase, { value: "original" });
  await second.begin();
  await second.unlock(passphrase);
  const outcomes = await Promise.allSettled([first.save({ value: "first" }), second.save({ value: "second" })]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const failed = outcomes.find((outcome) => outcome.status === "rejected");
  assert.match(failed.reason.message, /changed in another tab/);
  first.lock(); second.lock();
  const latest = await first.unlock(passphrase);
  assert.deepEqual(await second.unlock(passphrase), latest);
  assert.ok(["first", "second"].includes(latest.value));
  assert.equal(first.getEnvelope().revision, 2);
});

test("strict envelopes reject malformed salt, plaintext sibling fields and accessors", async () => {
  const { envelope } = await vault.createEnvelope(passphrase, sample);
  for (const mutate of [
    (v) => { v.transactions = [{ description: "plaintext" }]; },
    (v) => { v.kdf.secret = "plaintext"; },
    (v) => { v.payload.note = "plaintext"; },
    (v) => { v.wrappedKey.key = "plaintext"; },
    (v) => { v.kdf.salt = "not-a-sixteen-byte-salt"; },
    (v) => { delete v.kdf.salt; },
    (v) => { v.recoveryWrappedKey.ciphertext = v.payload.ciphertext; }
  ]) {
    const altered = structuredClone(envelope);
    mutate(altered);
    assert.equal(vault.isEnvelope(altered), false);
    await assert.rejects(vault.unlockEnvelope(altered, passphrase), /Invalid or unsupported/);
  }
  let accessed = false;
  const accessor = structuredClone(envelope);
  Object.defineProperty(accessor, "payload", { enumerable: true, get() { accessed = true; return envelope.payload; } });
  assert.equal(vault.isEnvelope(accessor), false);
  assert.equal(accessed, false);
});
