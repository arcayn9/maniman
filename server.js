const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { isEnvelope } = require("./lib/secure-storage.js");

const ROOT = __dirname;
const PUBLIC_FILES = new Set(["index.html", "app.js", "styles.css", "sw.js", "config.js", "manifest.webmanifest", "icons/maniman-icon.svg", "lib/statement-contract.js", "lib/secure-storage.js", "lib/vault-access.js", "lib/user-guide.js", "lib/account-access.js", "lib/vault-session.js", "lib/session-broker.js", "vendor/supabase-2.119.0.js"]);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}
function createServer({ rootDir = ROOT, dataFile = path.join(ROOT, "data", "maniman.vault.json"), token = process.env.MANIMAN_LOCAL_TOKEN || "" } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const host = request.headers.host || "localhost";
      const url = new URL(request.url, `http://${host}`);
      const api = url.pathname.startsWith("/api/");
      if (api) {
        const hostname = new URL(`http://${host}`).hostname;
        if ((!LOOPBACK.has(hostname) && !token) || (token && request.headers.authorization !== `Bearer ${token}`)) return json(response, 401, { error: "Local API authentication required." });
        if (request.headers.origin && request.headers.origin !== `http://${host}` && request.headers.origin !== `https://${host}`) return json(response, 403, { error: "Foreign origins are not allowed." });
        if (url.pathname === "/api/status" && request.method === "GET") return json(response, 200, { ok: true, storage: "encrypted-vault", legacyFilesPreserved: true });
        if (url.pathname === "/api/state" && request.method === "GET") {
          const state = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, "utf8")) : null;
          if (state && !isEnvelope(state)) return json(response, 422, { error: "Stored file is not a supported encrypted vault." });
          return json(response, 200, { state });
        }
        if (url.pathname === "/api/state" && request.method === "POST") {
          if (!request.headers["content-type"]?.startsWith("application/json")) return json(response, 415, { error: "Expected application/json." });
          const body = await readBody(request);
          let payload;
          try { payload = JSON.parse(body); } catch (_) { return json(response, 400, { error: "Invalid JSON." }); }
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(response, 400, { error: "Expected an encrypted-state request object." });
          const candidate = payload.state;
          if (!isEnvelope(candidate)) return json(response, 422, { error: "Only encrypted Maniman vaults can be saved." });
          const envelope = Object.fromEntries(["format", "version", "vaultId", "cipher", "revision", "kdf", "wrappedKey", "recoveryWrappedKey", "payload"].map((key) => [key, candidate[key]]));
          for (const key of ["wrappedKey", "recoveryWrappedKey", "payload"]) envelope[key] = { iv: candidate[key].iv, ciphertext: candidate[key].ciphertext };
          envelope.kdf = { name: candidate.kdf.name, hash: candidate.kdf.hash, iterations: candidate.kdf.iterations, salt: candidate.kdf.salt };
          if (fs.existsSync(dataFile)) {
            const previous = JSON.parse(fs.readFileSync(dataFile, "utf8"));
            if (JSON.stringify(previous) === JSON.stringify(envelope)) return json(response, 200, { ok: true });
            if (previous.vaultId !== envelope.vaultId || payload.expectedRevision !== previous.revision || previous.revision >= envelope.revision) {
              return json(response, 409, { error: "Encrypted server copy changed. Local vault preserved; resolve the conflict before replacing it." });
            }
          } else if (payload.expectedRevision !== 0) return json(response, 409, { error: "Server copy is absent; explicitly reconcile before writing." });
          fs.mkdirSync(path.dirname(dataFile), { recursive: true });
          const temporary = `${dataFile}.tmp`;
          fs.writeFileSync(temporary, JSON.stringify(envelope), { mode: 0o600 });
          fs.renameSync(temporary, dataFile);
          return json(response, 200, { ok: true });
        }
        return json(response, 404, { error: "API route not found." });
      }
      if (request.method !== "GET" && request.method !== "HEAD") return json(response, 405, { error: "Method not allowed." });
      let relative;
      try { relative = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html"; }
      catch (_) { return json(response, 400, { error: "Invalid path." }); }
      if (!PUBLIC_FILES.has(relative)) return json(response, 404, { error: "Not found." });
      const file = path.join(rootDir, relative);
      if (!fs.existsSync(file)) return json(response, 404, { error: "Not found." });
      response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(file).pipe(response);
    } catch (error) {
      if (!response.headersSent) json(response, error.code === "BODY_LIMIT" ? 413 : 500, { error: error.code === "BODY_LIMIT" ? "Encrypted vault exceeds server body limit." : "Local server operation failed." });
      else response.end();
    }
  });
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []; let exceeded = false;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 48 * 1024 * 1024) { exceeded = true; chunks.length = 0; }
      else if (!exceeded) chunks.push(chunk);
    });
    request.on("end", () => exceeded ? reject(Object.assign(new Error("Body limit"), { code: "BODY_LIMIT" })) : resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}
if (require.main === module) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 4173);
  if (!LOOPBACK.has(host) && !process.env.MANIMAN_LOCAL_TOKEN) throw new Error("Non-loopback hosting requires MANIMAN_LOCAL_TOKEN. Use HTTPS for browser encryption on other devices.");
  createServer().listen(port, host, () => console.log(`Maniman: http://${host}:${port}/ (encrypted local storage; legacy files preserved)`));
}
module.exports = { createServer, PUBLIC_FILES };
