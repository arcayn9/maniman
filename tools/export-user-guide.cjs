const fs = require("node:fs");
const path = require("node:path");
const guide = require("../lib/user-guide.js");
const destination = path.join(__dirname, "..", "docs", "USER_GUIDE.md");
fs.writeFileSync(destination, guide.toMarkdown(), "utf8");
console.log("Updated docs/USER_GUIDE.md from the in-app guide.");
