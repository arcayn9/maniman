const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const dataFile = path.join(dataDir, "maniman-state.json");
const legacyDataFile = path.join(dataDir, "pocket-pilot-state.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/api/state" && request.method === "GET") {
      return sendJson(response, { state: readState() });
    }

    if (url.pathname === "/api/state" && request.method === "POST") {
      const body = await readBody(request);
      const payload = JSON.parse(body || "{}");
      writeState(payload.state || payload);
      return sendJson(response, { ok: true });
    }

    if (url.pathname === "/api/status" && request.method === "GET") {
      return sendJson(response, { ok: true, storage: dataFile });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    const safePath = safeStaticPath(url.pathname);
    if (!safePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const filePath = fs.existsSync(safePath) && fs.statSync(safePath).isDirectory()
      ? path.join(safePath, "index.html")
      : safePath;

    if (!fs.existsSync(filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, host, () => {
  const urls = localUrls(port);
  console.log(`Maniman is running at http://127.0.0.1:${port}/`);
  urls.forEach((url) => console.log(`LAN: ${url}`));
  console.log(`Data file: ${dataFile}`);
});

function readState() {
  const sourceFile = fs.existsSync(dataFile) ? dataFile : legacyDataFile;
  if (!fs.existsSync(sourceFile)) return null;
  return JSON.parse(fs.readFileSync(sourceFile, "utf8"));
}

function writeState(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response, payload) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function safeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(rootDir, normalized === "/" ? "index.html" : normalized);
  return filePath.startsWith(rootDir) ? filePath : null;
}

function localUrls(serverPort) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${serverPort}/`);
}
