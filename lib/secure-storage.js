(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.ManimanVault = api;
    root.ManimanSecureStorage = api.createManager(api.indexedDBStore());
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const FORMAT = "maniman.vault";
  const ITERATIONS = 600000;
  const MAX_BYTES = 32 * 1024 * 1024;
  const encode = (value) => new TextEncoder().encode(value);
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function exactRecord(value, expectedKeys) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const names = Object.getOwnPropertyNames(value);
    return names.length === expectedKeys.length && names.every((name) => expectedKeys.includes(name)
      && Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, name), "value"));
  }
  function cryptoAPI() {
    if (!root.crypto?.subtle) throw new Error("Vault encryption requires HTTPS or localhost with Web Crypto support.");
    return root.crypto;
  }
  function random(size) { return cryptoAPI().getRandomValues(new Uint8Array(size)); }
  function base64(bytes) {
    let result = "";
    for (const byte of new Uint8Array(bytes)) result += String.fromCharCode(byte);
    return btoa(result).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function unbase64(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > MAX_BYTES * 2) throw new Error("Invalid encrypted vault encoding.");
    try { return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)); }
    catch (_) { throw new Error("Invalid encrypted vault encoding."); }
  }
  function context(envelope, purpose) {
    return encode(`${FORMAT}|1|${envelope.vaultId}|${purpose}`);
  }
  async function importKey(bytes, extractable = false) {
    return cryptoAPI().subtle.importKey("raw", bytes, "AES-GCM", extractable, ["encrypt", "decrypt"]);
  }
  async function deriveKey(passphrase, kdf) {
    if (typeof passphrase !== "string" || passphrase.length > 4096) throw new Error("Invalid vault passphrase.");
    if (kdf?.name !== "PBKDF2" || kdf.hash !== "SHA-256" || kdf.iterations !== ITERATIONS || unbase64(kdf.salt).length !== 16) throw new Error("Unsupported vault key derivation.");
    const material = await cryptoAPI().subtle.importKey("raw", encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return cryptoAPI().subtle.deriveKey({ name: "PBKDF2", salt: unbase64(kdf.salt), iterations: ITERATIONS, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptBytes(key, bytes, aad) {
    const iv = random(12);
    const encrypted = await cryptoAPI().subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad, tagLength: 128 }, key, bytes);
    return { iv: base64(iv), ciphertext: base64(encrypted) };
  }
  async function decryptBytes(key, sealed, aad) {
    return cryptoAPI().subtle.decrypt({ name: "AES-GCM", iv: unbase64(sealed.iv), additionalData: aad, tagLength: 128 }, key, unbase64(sealed.ciphertext));
  }
  function validSealed(value, expectedBytes) {
    try {
      if (!exactRecord(value, ["iv", "ciphertext"]) || typeof value.iv !== "string" || value.iv.length !== 16
        || typeof value.ciphertext !== "string" || value.ciphertext.length > Math.ceil((MAX_BYTES + 16) * 4 / 3)) return false;
      const size = unbase64(value.ciphertext).length;
      return unbase64(value.iv).length === 12 && (expectedBytes ? size === expectedBytes : size >= 16 && size <= MAX_BYTES + 16);
    }
    catch (_) { return false; }
  }
  function isEnvelope(value) {
    try {
      if (!exactRecord(value, ["format", "version", "vaultId", "cipher", "revision", "kdf", "wrappedKey", "recoveryWrappedKey", "payload"])
        || value.format !== FORMAT || value.version !== 1 || typeof value.vaultId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(value.vaultId)
        || value.cipher !== "AES-256-GCM" || !Number.isSafeInteger(value.revision) || value.revision < 1
        || !exactRecord(value.kdf, ["name", "hash", "iterations", "salt"]) || value.kdf.name !== "PBKDF2"
        || value.kdf.hash !== "SHA-256" || value.kdf.iterations !== ITERATIONS || typeof value.kdf.salt !== "string" || value.kdf.salt.length !== 22) return false;
      const salt = unbase64(value.kdf.salt);
      return salt.length === 16 && base64(salt) === value.kdf.salt
        && validSealed(value.wrappedKey, 48) && validSealed(value.recoveryWrappedKey, 48) && validSealed(value.payload);
    } catch (_) { return false; }
  }
  function assertEnvelope(value) {
    if (!isEnvelope(value)) throw new Error("Invalid or unsupported encrypted vault.");
  }
  async function seal(envelope, key, state) {
    const serialized = JSON.stringify(state);
    if (typeof serialized !== "string") throw new Error("Vault data must be JSON.");
    const bytes = encode(serialized);
    if (bytes.length > MAX_BYTES) throw new Error("Vault exceeds the current 32 MB snapshot limit. Export and retain your existing vault.");
    const next = { ...copy(envelope), revision: (envelope.revision || 0) + 1 };
    next.payload = await encryptBytes(key, bytes, context(next, `data:${next.revision}`));
    return next;
  }
  async function createEnvelope(passphrase, state) {
    if (typeof passphrase !== "string" || passphrase.length < 12) throw new Error("Use a vault passphrase of at least 12 characters.");
    const envelope = {
      format: FORMAT, version: 1, vaultId: cryptoAPI().randomUUID(), cipher: "AES-256-GCM", revision: 0,
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt: base64(random(16)) }
    };
    const raw = random(32);
    const recoveryBytes = random(32);
    try {
      const passwordKey = await deriveKey(passphrase, envelope.kdf);
      envelope.wrappedKey = await encryptBytes(passwordKey, raw, context(envelope, "passphrase-key"));
      envelope.recoveryWrappedKey = await encryptBytes(await importKey(recoveryBytes), raw, context(envelope, "recovery-key"));
      const key = await importKey(raw);
      return { envelope: await seal(envelope, key, state), key, recoveryKey: base64(recoveryBytes) };
    } finally { raw.fill(0); recoveryBytes.fill(0); }
  }
  async function unlockEnvelope(envelope, secret, options = {}) {
    assertEnvelope(envelope);
    let raw;
    try {
      const recovery = options.recovery === true;
      const kek = recovery ? await importKey(unbase64(secret.trim())) : await deriveKey(secret, envelope.kdf);
      raw = new Uint8Array(await decryptBytes(kek, recovery ? envelope.recoveryWrappedKey : envelope.wrappedKey, context(envelope, recovery ? "recovery-key" : "passphrase-key")));
      const key = await importKey(raw);
      const decrypted = await decryptBytes(key, envelope.payload, context(envelope, `data:${envelope.revision}`));
      const state = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decrypted));
      if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Invalid vault contents.");
      return { key, state };
    } catch (_) { throw new Error("Could not unlock vault. Check the passphrase/recovery key and file integrity."); }
    finally { if (raw) raw.fill(0); }
  }
  function indexedDBStore() {
    let dbPromise;
    function db() {
      if (!root.indexedDB) return Promise.reject(new Error("IndexedDB is required for encrypted storage. Use a supported browser over HTTPS or localhost."));
      if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
        const request = root.indexedDB.open("maniman-encrypted-vaults", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("vaults");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error("Could not open encrypted storage."));
        request.onblocked = () => reject(new Error("Close other Maniman tabs to update encrypted storage."));
      });
      return dbPromise;
    }
    async function run(mode, key, value) {
      const database = await db();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction("vaults", mode);
        const store = transaction.objectStore("vaults");
        const request = mode === "readonly" ? store.get(key) : store.put(value, key);
        let result;
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = transaction.onabort = () => reject(new Error("Encrypted storage operation failed. Local changes have not been confirmed saved."));
      });
    }
    async function compareAndSet(key, expected, value) {
      const database = await db();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction("vaults", "readwrite");
        const objectStore = transaction.objectStore("vaults");
        const read = objectStore.get(key);
        let conflict = false;
        read.onsuccess = () => {
          if (JSON.stringify(read.result || null) !== JSON.stringify(expected || null)) {
            conflict = true; transaction.abort(); return;
          }
          objectStore.put(value, key);
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = transaction.onabort = () => reject(new Error(conflict
          ? "Encrypted local copy changed in another tab. Local changes are preserved in memory; unlock again before retrying."
          : "Encrypted storage operation failed. Local changes have not been confirmed saved."));
      });
    }
    return { get: (key) => run("readonly", key), set: (key, value) => run("readwrite", key, value), compareAndSet };
  }
  async function fingerprint(envelope) {
    assertEnvelope(envelope);
    return base64(await cryptoAPI().subtle.digest("SHA-256", encode(JSON.stringify([envelope.vaultId, envelope.revision, envelope.payload.iv, envelope.payload.ciphertext]))));
  }
  function createManager(store) {
    let namespace = "local", envelope = null, key = null, session = 0, queue = Promise.resolve();
    function requireUnlocked() { if (!key || !envelope) throw new Error("Unlock the encrypted vault before saving transactions."); }
    function current(expected, owner) {
      if (expected !== session || owner !== namespace) throw new Error("Vault session changed. Unlock the active vault before retrying.");
    }
    function enqueue(operation) {
      const result = queue.catch(() => {}).then(operation);
      queue = result;
      return result;
    }
    async function write(owner, next, previous, expected) {
      current(expected, owner);
      if (typeof store.compareAndSet === "function") await store.compareAndSet(owner, previous, next);
      else {
        const persisted = (await store.get(owner)) || null;
        current(expected, owner);
        if (JSON.stringify(persisted) !== JSON.stringify(previous || null)) throw new Error("Encrypted local copy changed. Unlock again before retrying.");
        await store.set(owner, next);
      }
      current(expected, owner);
    }
    return {
      async begin(owner = "local") {
        if (typeof owner !== "string" || !/^(local|user:[A-Za-z0-9-]{1,128})$/.test(owner)) throw new Error("Invalid vault owner.");
        const expected = ++session;
        key = null; envelope = null; namespace = owner;
        return enqueue(async () => {
          current(expected, owner);
          const loaded = (await store.get(owner)) || null;
          current(expected, owner);
          if (loaded) assertEnvelope(loaded);
          envelope = loaded ? copy(loaded) : null;
          return { exists: !!envelope, namespace: owner };
        });
      },
      async localCandidate() {
        const expected = session, owner = namespace;
        const candidate = (await store.get("local")) || null;
        current(expected, owner);
        if (candidate) assertEnvelope(candidate);
        return candidate ? copy(candidate) : null;
      },
      async isAcknowledged(value = envelope) {
        const expected = session, owner = namespace;
        const candidate = value ? copy(value) : null;
        if (!candidate) return false;
        const record = await store.get(`${owner}:sync`);
        const hash = await fingerprint(candidate);
        current(expected, owner);
        return record?.vaultId === candidate.vaultId && record.fingerprint === hash;
      },
      acknowledge(candidate) {
        const expected = session, owner = namespace, snapshot = copy(candidate);
        return enqueue(async () => {
          current(expected, owner); requireUnlocked(); assertEnvelope(snapshot);
          if (envelope.vaultId !== snapshot.vaultId) throw new Error("Vault identity changed before sync acknowledgement.");
          const hash = await fingerprint(snapshot);
          current(expected, owner);
          await store.set(`${owner}:sync`, { vaultId: snapshot.vaultId, fingerprint: hash });
          current(expected, owner);
        });
      },
      adoptRemote(candidate) {
        const expected = session, owner = namespace, snapshot = copy(candidate);
        return enqueue(async () => {
          current(expected, owner); requireUnlocked(); assertEnvelope(snapshot);
          if (envelope.vaultId !== snapshot.vaultId) throw new Error("Cloud and local copies belong to different vaults.");
          if (snapshot.revision <= envelope.revision) throw new Error("Cloud revision must advance the local revision.");
          const record = await store.get(`${owner}:sync`);
          const hash = await fingerprint(envelope);
          current(expected, owner);
          if (record?.vaultId !== envelope.vaultId || record.fingerprint !== hash) throw new Error("Local changes are not acknowledged; keep both copies before resolving.");
          const bytes = await decryptBytes(key, snapshot.payload, context(snapshot, `data:${snapshot.revision}`));
          const state = JSON.parse(new TextDecoder().decode(bytes));
          if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Invalid vault contents.");
          await write(owner, snapshot, envelope, expected);
          envelope = snapshot;
          await store.set(`${owner}:sync`, { vaultId: snapshot.vaultId, fingerprint: await fingerprint(snapshot) });
          current(expected, owner); return state;
        });
      },
      sessionKey() { requireUnlocked(); return key; },
      async restoreSession(candidateKey) {
        const expected = session, owner = namespace;
        return enqueue(async () => {
          current(expected, owner);
          if (!(candidateKey instanceof root.CryptoKey) || candidateKey.extractable || candidateKey.algorithm?.name !== "AES-GCM") throw new Error("Invalid unlock session.");
          const persisted = (await store.get(owner)) || null;
          current(expected, owner); assertEnvelope(persisted);
          const plain = await decryptBytes(candidateKey, persisted.payload, context(persisted, `data:${persisted.revision}`));
          const state = JSON.parse(new TextDecoder().decode(plain));
          if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Invalid vault contents.");
          current(expected, owner); envelope = copy(persisted); key = candidateKey; return state;
        });
      },
      isUnlocked: () => !!key,
      namespace: () => namespace,
      getEnvelope: () => envelope ? copy(envelope) : null,
      async create(passphrase, state) {
        const expected = session;
        const owner = namespace;
        const snapshot = copy(state);
        return enqueue(async () => {
          current(expected, owner);
          if (envelope) throw new Error("An encrypted vault already exists. Unlock it instead.");
          const persisted = await store.get(owner);
          current(expected, owner);
          if (persisted) throw new Error("An encrypted vault already exists. Unlock it instead.");
          const created = await createEnvelope(passphrase, snapshot);
          current(expected, owner);
          await write(owner, created.envelope, null, expected);
          envelope = created.envelope; key = created.key;
          return { recoveryKey: created.recoveryKey, state: copy(snapshot) };
        });
      },
      async unlock(secret, options = {}) {
        const expected = session;
        const owner = namespace;
        return enqueue(async () => {
          current(expected, owner);
          const persisted = (await store.get(owner)) || null;
          current(expected, owner);
          if (!persisted) throw new Error("No encrypted vault exists for this user.");
          assertEnvelope(persisted);
          const opened = await unlockEnvelope(persisted, secret, options);
          current(expected, owner);
          envelope = copy(persisted); key = opened.key;
          return opened.state;
        });
      },
      save(state) {
        const snapshot = copy(state);
        const expected = session;
        const owner = namespace;
        return enqueue(async () => {
          current(expected, owner);
          requireUnlocked();
          const next = await seal(envelope, key, snapshot);
          current(expected, owner);
          await write(owner, next, envelope, expected);
          envelope = next;
          return copy(next);
        });
      },
      async install(remoteEnvelope, secret, options = {}) {
        assertEnvelope(remoteEnvelope);
        const expected = session;
        const owner = namespace;
        const candidate = copy(remoteEnvelope);
        const replacement = Object.hasOwn(options, "replacementState") ? copy(options.replacementState) : undefined;
        return enqueue(async () => {
          current(expected, owner);
          const persisted = (await store.get(owner)) || null;
          current(expected, owner);
          const existing = persisted || envelope;
          if (existing && existing.vaultId !== candidate.vaultId) throw new Error("This file belongs to another vault. Keep the local vault and use an empty browser profile for recovery.");
          if (existing) throw new Error("An encrypted vault already exists. Replacement requires explicit conflict resolution.");
          const opened = await unlockEnvelope(candidate, secret, options);
          current(expected, owner);
          const installed = replacement === undefined ? candidate : await seal(candidate, opened.key, replacement);
          current(expected, owner);
          await write(owner, installed, null, expected);
          envelope = installed; key = opened.key;
          return replacement === undefined ? opened.state : copy(replacement);
        });
      },
      preserveStateConflict(state) {
        const expected = session, owner = namespace, snapshot = copy(state);
        return enqueue(async () => {
          current(expected, owner); requireUnlocked();
          const candidate = await seal(envelope, key, snapshot);
          current(expected, owner);
          await store.set(`${owner}:conflict:${cryptoAPI().randomUUID()}`, candidate);
          current(expected, owner); return copy(candidate);
        });
      },
      async preserveConflict(remoteEnvelope) {
        assertEnvelope(remoteEnvelope);
        const expected = session;
        const owner = namespace;
        const candidate = copy(remoteEnvelope);
        return enqueue(async () => {
          current(expected, owner);
          await store.set(`${owner}:conflict:${cryptoAPI().randomUUID()}`, candidate);
          current(expected, owner);
        });
      },
      lock() { key = null; session += 1; },
      async flush() { await queue; }
    };
  }
  return { FORMAT, ITERATIONS, isEnvelope, createEnvelope, unlockEnvelope, seal, indexedDBStore, createManager };
});
