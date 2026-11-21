const fs = require("node:fs");
const path = require("node:path");
const { PUBLIC_FILES } = require("../server.js");

function browserConfig(env) {
  const urlValue = String(env.SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
  if (!urlValue && !key) return { supabaseUrl: "", supabaseAnonKey: "" };
  if (!urlValue || !key) throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) together.");
  let url;
  try { url = new URL(urlValue); } catch (_) { throw new Error("SUPABASE_URL must be an HTTPS project URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("SUPABASE_URL must be an HTTPS project URL without credentials, a path, query or fragment.");
  }
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    try { publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "anon"; }
    catch (_) { /* Malformed or privileged JWTs must not be published. */ }
  }
  if (!publicKey) throw new Error("Use a browser-safe Supabase publishable key or legacy anon key; secret and service-role keys must never be published.");
  return { supabaseUrl: url.origin, supabaseAnonKey: key };
}

function buildStaticSite({ rootDir = path.resolve(__dirname, ".."), env = process.env } = {}) {
  const root = fs.realpathSync(rootDir);
  const out = path.join(root, "dist");
  const config = browserConfig(env);
  const sources = [...PUBLIC_FILES].filter((file) => file !== "config.js");
  // Validate every input before replacing an existing generated artifact.
  for (const file of sources) {
    const source = path.join(root, file);
    if (!fs.existsSync(source)) throw new Error(`Missing public asset: ${file}`);
    if (!fs.lstatSync(source).isFile() || fs.realpathSync(source) !== source) throw new Error(`Public asset must be a regular file inside the project: ${file}`);
  }
  const existingOutput = fs.lstatSync(out, { throwIfNoEntry: false });
  if (existingOutput && (!existingOutput.isDirectory() || existingOutput.isSymbolicLink())) {
    throw new Error("dist must be a generated directory, not a file or symbolic link.");
  }
  const staging = fs.mkdtempSync(path.join(root, ".maniman-build-"));
  try {
    for (const file of sources) {
      const destination = path.join(staging, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, file), destination);
    }
    const serialized = JSON.stringify(config, null, 2).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    fs.writeFileSync(path.join(staging, "config.js"), `window.MANIMAN_CONFIG = ${serialized};\n`);
    fs.writeFileSync(path.join(staging, "_headers"), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n/config.js\n  Cache-Control: no-store\n/sw.js\n  Cache-Control: no-cache\n");
    fs.rmSync(out, { recursive: true, force: true });
    fs.renameSync(staging, out);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return { directory: out, files: [...PUBLIC_FILES, "_headers"].sort(), cloudEnabled: !!config.supabaseUrl };
}

if (require.main === module) {
  try {
    const result = buildStaticSite();
    console.log(`Built ${result.files.length} public files in dist. Cloud sync ${result.cloudEnabled ? "configured" : "disabled (local-only)"}.`);
  } catch (error) {
    console.error(`Static build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { buildStaticSite, browserConfig };
