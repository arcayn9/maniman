(function (root) {
  "use strict";
  const STORAGE_KEY = "maniman-tab-unlock-capability";
  let current = null, timer = null;
  function capability(create = false) {
    try {
      let value = root.sessionStorage.getItem(STORAGE_KEY);
      if (!value && create) {
        value = Array.from(root.crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
        root.sessionStorage.setItem(STORAGE_KEY, value);
      }
      return /^[a-f0-9]{64}$/.test(value || "") ? value : null;
    } catch (_) { return null; }
  }
  async function send(request) {
    if (!root.navigator?.serviceWorker || !root.MessageChannel || !request.capability) return { ok: false };
    return new Promise((resolve) => {
      let finished = false, channel;
      const finish = (value) => { if (finished) return; finished = true; clearTimeout(timeout); channel?.port1.close(); resolve(value || { ok: false }); };
      const timeout = setTimeout(() => finish(), 1800);
      root.navigator.serviceWorker.ready.then((registration) => {
        if (finished) return;
        const worker = registration.active;
        if (!worker) return finish();
        channel = new MessageChannel();
        channel.port1.onmessage = (event) => finish(event.data);
        try { worker.postMessage({ type: "maniman-vault-session", ...request }, [channel.port2]); }
        catch (_) { finish(); }
      }).catch(() => finish());
    });
  }
  function heartbeat() {
    clearInterval(timer);
    timer = setInterval(() => { if (current) send({ ...current, action: "ping" }); }, 10000);
  }
  async function remember(manager, minutes = 15) {
    const envelope = manager.getEnvelope();
    if (!manager.isUnlocked() || !envelope) return false;
    const request = { capability: capability(true), namespace: manager.namespace(), vaultId: envelope.vaultId };
    const answer = await send({ ...request, action: "remember", key: manager.sessionKey(), ttl: Math.max(1, Math.min(120, Number(minutes) || 15)) * 60000 });
    if (answer.ok && manager.isUnlocked() && manager.namespace() === request.namespace && manager.getEnvelope()?.vaultId === request.vaultId && capability() === request.capability) { current = request; heartbeat(); }
    else { if (answer.ok) send({ ...request, action: "revoke" }); return false; }
    return answer.ok;
  }
  async function resume(manager) {
    const envelope = manager.getEnvelope();
    const value = capability();
    if (!value || !envelope) return null;
    const request = { capability: value, namespace: manager.namespace(), vaultId: envelope.vaultId };
    const answer = await send({ ...request, action: "resume" });
    if (!answer.ok || manager.namespace() !== request.namespace || manager.getEnvelope()?.vaultId !== request.vaultId || capability() !== request.capability) return null;
    try {
      const state = await manager.restoreSession(answer.key);
      current = request; heartbeat(); return state;
    } catch (_) { forget(); return null; }
  }
  function touch() { if (current) return send({ ...current, action: "touch" }); }
  function forget() {
    const previous = current;
    current = null; clearInterval(timer); timer = null;
    try { root.sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    if (previous) send({ ...previous, action: "revoke" });
  }
  root.ManimanVaultSession = { remember, resume, touch, forget };
})(globalThis);
