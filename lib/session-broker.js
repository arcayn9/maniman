(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ManimanSessionBroker = api;
})(globalThis, function (root) {
  "use strict";
  function createBroker({ now = Date.now } = {}) {
    // Deliberately volatile: no IndexedDB, Cache API or other persistence here.
    const grants = new Map();
    const valid = (request) => /^[a-f0-9]{64}$/.test(request?.capability || "") && /^(local|user:[A-Za-z0-9-]{1,128})$/.test(request.namespace || "") && /^[A-Za-z0-9-]{16,80}$/.test(request.vaultId || "");
    const prune = () => { for (const [id, grant] of grants) if (grant.expiresAt <= now()) grants.delete(id); };
    function handle(request) {
      prune();
      if (!valid(request)) return { ok: false };
      const old = grants.get(request.capability);
      const matches = old && old.namespace === request.namespace && old.vaultId === request.vaultId;
      if (request.action === "revoke") {
        if (matches) grants.delete(request.capability);
        return { ok: true };
      }
      if (request.action === "remember") {
        const key = request.key;
        if (!(key instanceof root.CryptoKey) || key.type !== "secret" || key.extractable || key.algorithm?.name !== "AES-GCM" || key.algorithm.length !== 256) return { ok: false };
        if (!Number.isFinite(request.ttl) || request.ttl <= 0 || request.ttl > 120 * 60000) return { ok: false };
        if (!old && grants.size >= 64) return { ok: false };
        grants.set(request.capability, { namespace: request.namespace, vaultId: request.vaultId, key, ttl: request.ttl, expiresAt: now() + request.ttl });
        return { ok: true };
      }
      if (!matches) return { ok: false };
      if (request.action === "touch") { old.expiresAt = now() + old.ttl; return { ok: true }; }
      if (request.action === "ping") return { ok: true };
      if (request.action === "resume") return { ok: true, key: old.key, expiresAt: old.expiresAt };
      return { ok: false };
    }
    return { handle };
  }
  return { createBroker };
});
