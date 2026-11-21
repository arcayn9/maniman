const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const guide = require("../lib/user-guide.js");
const root = path.resolve(__dirname, "..");

test("the guide covers every app view with unique bounded step-by-step topics", () => {
  assert.equal(new Set(guide.topics.map((topic) => topic.id)).size, guide.topics.length);
  for (const view of ["dashboard", "transactions", "imports", "accounts", "stats", "budgets", "goals", "bills", "settings"]) {
    assert.ok(guide.topics.some((topic) => topic.view === view), `Missing ${view}`);
  }
  for (const topic of guide.topics) {
    assert.match(topic.id, /^[a-z0-9-]+$/);
    assert.ok(guide.categories.includes(topic.category));
    assert.ok(topic.steps.length >= 3 && topic.steps.length <= 5);
    assert.ok(topic.steps.every((step) => typeof step === "string" && step.length > 20));
  }
});

test("guide search matches all query words across steps/examples and combines category filters", () => {
  assert.ok(guide.matchingTopicIds("PDF password").includes("local-converter"));
  assert.ok(guide.matchingTopicIds("RECovERy key", "Privacy & recovery").includes("unlock-recovery"));
  assert.equal(guide.matchingTopicIds("recovery", "Manage money").length, 0);
  assert.equal(guide.matchingTopicIds("this-term-does-not-exist").length, 0);
  assert.equal(guide.matchingTopicIds(" ").length, guide.topics.length);
  assert.equal(guide.matchingTopicIds('<img src=x onerror="alert(1)">').length, 0);
});

test("guide search updates the existing DOM without interpolating user input as HTML", () => {
  const node = (properties = {}) => ({ value: "", hidden: false, open: false, dataset: {}, events: {}, addEventListener(name, handler) { this.events[name] = handler; }, ...properties });
  const search = node(), category = node(), result = node(), empty = node();
  const sections = guide.topics.map((topic) => node({ dataset: { guideTopic: topic.id } }));
  const links = guide.topics.map((topic) => node({ dataset: { guideLink: topic.id } }));
  const elements = { "#guideSearch": search, "#guideCategory": category, "#guideResults": result, "#guideEmpty": empty };
  const dom = { querySelector: (selector) => elements[selector], querySelectorAll: (selector) => selector === "[data-guide-topic]" ? sections : links };
  guide.bind(dom);
  search.value = "checkpoint"; search.events.input();
  assert.ok(sections.find((section) => section.dataset.guideTopic === "checkpoints").open);
  assert.ok(sections.some((section) => section.hidden));
  assert.equal(empty.hidden, true);
  category.value = "Privacy & recovery"; category.events.change();
  assert.ok(sections.every((section) => section.hidden || guide.topics.find((topic) => topic.id === section.dataset.guideTopic).category === category.value));
  search.value = "zzzz-unmatched"; search.events.input();
  assert.equal(result.textContent, "0 topics shown"); assert.equal(empty.hidden, false);
  search.value = ""; category.value = ""; category.events.change();
  assert.equal(sections.filter((section) => !section.hidden).length, guide.topics.length);
  const first = sections[0]; first.open = false; links[0].events.click(); assert.equal(first.open, true);
});

test("guide examples render as text and the printable guide stays in sync with app instructions", () => {
  const markup = guide.render();
  assert.match(markup, /id="guideSearch"/);
  assert.match(markup, /role="status" aria-live="polite"/);
  assert.match(markup, /No matching topics/);
  assert.match(markup, /Privacy &amp; recovery/);
  assert.doesNotMatch(markup, /<script/);
  assert.equal(fs.readFileSync(path.join(root, "docs/USER_GUIDE.md"), "utf8"), guide.toMarkdown());
});

test("guide script is public/offline-cacheable and app navigation has desktop/mobile entry points", () => {
  const { PUBLIC_FILES } = require("../server.js");
  assert.ok(PUBLIC_FILES.has("lib/user-guide.js"));
  assert.ok(!PUBLIC_FILES.has("docs/USER_GUIDE.md"));
  assert.match(fs.readFileSync(path.join(root, "sw.js"), "utf8"), /"\.\/lib\/user-guide\.js"/);
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(index, /data-view="guide"/);
  assert.match(index, /data-jump-view="guide"/);
  const context = vm.createContext({ document: { addEventListener() {} } });
  context.window = context; context.addEventListener = () => {};
  vm.runInContext(fs.readFileSync(path.join(root, "lib/statement-contract.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "lib/user-guide.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);
  const valid = vm.runInContext("(() => { const sample = createStarterState(); sample.settings.lastView = 'guide'; return validateBackupState(sample).valid && prepareBackupState(sample).settings.lastView === 'guide'; })()", context);
  assert.equal(valid, true);
  assert.match(vm.runInContext("renderGuide()", context), /Step-by-step help for every available feature/);
});
