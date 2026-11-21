const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { PUBLIC_FILES } = require("../server.js");
const { buildStaticSite, browserConfig } = require("../tools/build-static.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "maniman-static-build-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of PUBLIC_FILES) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), file === "config.js" ? 'throw new Error("Do not evaluate local config");' : `public asset: ${file}`);
  }
  for (const file of ["data/maniman-state.json", "data/maniman.vault.json", "private-statements/bank.json", ".env", "docs/private-note.md", "server.js"]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "synthetic private sentinel");
  }
  return root;
}
function files(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => item.isDirectory() ? files(path.join(dir, item.name), `${prefix}${item.name}/`) : [`${prefix}${item.name}`]).sort();
}
const publicEnv = { SUPABASE_URL: "https://example.supabase.co/", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_build_test" };
const jwt = (role) => [Buffer.from('{"alg":"HS256"}').toString("base64url"), Buffer.from(JSON.stringify({ role })).toString("base64url"), "synthetic_signature"].join(".");

test("static artifact contains only allowlisted public files and generated browser config", (t) => {
  const rootDir = fixture(t);
  const result = buildStaticSite({ rootDir, env: publicEnv });
  assert.deepEqual(files(result.directory), [...PUBLIC_FILES, "_headers"].sort());
  assert.equal(result.cloudEnabled, true);
  assert.equal(fs.readFileSync(path.join(result.directory, "lib/user-guide.js"), "utf8"), "public asset: lib/user-guide.js");
  assert.equal(fs.existsSync(path.join(result.directory, "data")), false);
  assert.equal(fs.existsSync(path.join(result.directory, "server.js")), false);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(result.directory, "config.js"), "utf8"), context);
  assert.equal(context.window.MANIMAN_CONFIG.supabaseUrl, "https://example.supabase.co");
  assert.equal(context.window.MANIMAN_CONFIG.supabaseAnonKey, publicEnv.SUPABASE_PUBLISHABLE_KEY);
  assert.match(fs.readFileSync(path.join(rootDir, "config.js"), "utf8"), /Do not evaluate/);
  assert.match(fs.readFileSync(path.join(result.directory, "_headers"), "utf8"), /\/config\.js\n  Cache-Control: no-store/);
});

test("rebuilding drops stale output files without changing private source files", (t) => {
  const rootDir = fixture(t);
  const first = buildStaticSite({ rootDir, env: publicEnv });
  fs.writeFileSync(path.join(first.directory, "stale-financial.json"), "must not ship");
  const next = buildStaticSite({ rootDir, env: {} });
  assert.equal(next.cloudEnabled, false);
  assert.equal(fs.existsSync(path.join(next.directory, "stale-financial.json")), false);
  assert.match(fs.readFileSync(path.join(next.directory, "config.js"), "utf8"), /"supabaseUrl": ""/);
  assert.equal(fs.readFileSync(path.join(rootDir, "data/maniman-state.json"), "utf8"), "synthetic private sentinel");
  assert.deepEqual(fs.readdirSync(rootDir).filter((name) => name.startsWith(".maniman-build-")), []);
});

test("public config accepts publishable and legacy anon keys but rejects privileged or malformed keys without leaking them", () => {
  assert.equal(browserConfig({ SUPABASE_URL: publicEnv.SUPABASE_URL, SUPABASE_ANON_KEY: jwt("anon") }).supabaseAnonKey, jwt("anon"));
  assert.equal(browserConfig({ ...publicEnv, SUPABASE_ANON_KEY: jwt("service_role") }).supabaseAnonKey, publicEnv.SUPABASE_PUBLISHABLE_KEY);
  for (const key of [jwt("service_role"), "sb_secret_" + "synthetic_forbidden_value", "not-a-public-key", 'sb_publishable_quote";throw new Error()']) {
    assert.throws(() => browserConfig({ SUPABASE_URL: publicEnv.SUPABASE_URL, SUPABASE_ANON_KEY: key }), (error) => /browser-safe/.test(error.message) && !error.message.includes(key));
  }
  for (const url of ["http://example.supabase.co", "https://user:password@example.supabase.co", "https://example.supabase.co/rest/v1", "https://example.supabase.co/?token=private", "not a URL"]) {
    assert.throws(() => browserConfig({ ...publicEnv, SUPABASE_URL: url }), /HTTPS project URL/);
  }
});

test("invalid build variables and missing inputs preserve the previous artifact", (t) => {
  const rootDir = fixture(t);
  const result = buildStaticSite({ rootDir, env: publicEnv });
  const original = fs.readFileSync(path.join(result.directory, "config.js"), "utf8");
  assert.throws(() => buildStaticSite({ rootDir, env: { SUPABASE_URL: publicEnv.SUPABASE_URL } }), /together/);
  fs.unlinkSync(path.join(rootDir, "lib/user-guide.js"));
  assert.throws(() => buildStaticSite({ rootDir, env: publicEnv }), /Missing public asset/);
  assert.equal(fs.readFileSync(path.join(result.directory, "config.js"), "utf8"), original);
});

test("static packaging refuses symlinked inputs and output directories", (t) => {
  const rootDir = fixture(t);
  const original = path.join(rootDir, "app.js");
  fs.unlinkSync(original);
  fs.symlinkSync(path.join(rootDir, "data/maniman-state.json"), original);
  assert.throws(() => buildStaticSite({ rootDir, env: {} }), /regular file inside the project/);
  fs.unlinkSync(original); fs.writeFileSync(original, "public JS");
  fs.symlinkSync(path.join(rootDir, "private-statements"), path.join(rootDir, "dist"), "dir");
  assert.throws(() => buildStaticSite({ rootDir, env: {} }), /not a file or symbolic link/);
  assert.equal(fs.readFileSync(path.join(rootDir, "private-statements/bank.json"), "utf8"), "synthetic private sentinel");
});

test("Wrangler points at generated assets and builds them before version uploads", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../wrangler.jsonc"), "utf8"));
  assert.equal(config.assets.directory, "./dist");
  assert.equal(config.assets.not_found_handling, "none");
  assert.equal(config.build.command, "npm run build");
  assert.equal(config.main, undefined);
  assert.equal(config.keep_vars, true);
});
