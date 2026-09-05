import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const background = await readFile(new URL("background.js", root), "utf8");

function worker(executeScript = async () => {}) {
  const calls = [];
  const listeners = {};
  const chrome = {
    scripting: { executeScript: async (options) => { calls.push(["execute", options]); return executeScript(options); } },
    action: {
      onClicked: { addListener: (callback) => { listeners.click = callback; } },
      setBadgeText: async (options) => { calls.push(["badge", options]); },
      setBadgeBackgroundColor: async (options) => { calls.push(["color", options]); },
      setTitle: async (options) => { calls.push(["title", options]); },
    },
    tabs: { onUpdated: { addListener: (callback) => { listeners.update = callback; } } },
  };
  vm.runInNewContext(background, { chrome, console: { warn: (...args) => calls.push(["warning", args]) } });
  return { calls, listeners };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("manifest grants only click-scoped scripting permissions and ships every asset", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.action.default_popup, undefined);
  for (const file of [manifest.background.service_worker, ...Object.values(manifest.icons), "artwork.js", "party.js", "toggle.js"]) {
    await access(new URL(file, root));
  }
});

test("toolbar injects the real party only into the clicked tab", async () => {
  const { calls, listeners } = worker();
  listeners.click({ id: 17 });
  await settle();
  const options = calls.find(([kind]) => kind === "execute")[1];
  assert.equal(options.target.tabId, 17);
  assert.deepEqual(Array.from(options.files), ["artwork.js", "party.js", "toggle.js"]);
  assert.ok(calls.some(([kind, options]) => kind === "badge" && options.text === ""));
});

test("protected pages produce a visible error badge and actionable tooltip", async () => {
  const { calls, listeners } = worker(async () => { throw new Error("Cannot access chrome:// URL"); });
  listeners.click({ id: 2 });
  await settle();
  assert.ok(calls.some(([kind, options]) => kind === "badge" && options.text === "!"));
  assert.ok(calls.some(([kind, options]) => kind === "title" && options.title.includes("Open a regular website")));
});

test("rapid clicks are serialized per tab, not across different tabs", async () => {
  const releases = [];
  const { calls, listeners } = worker(() => new Promise((resolve) => releases.push(resolve)));
  listeners.click({ id: 1 });
  listeners.click({ id: 1 });
  listeners.click({ id: 2 });
  await settle();
  assert.equal(calls.filter(([kind]) => kind === "execute").length, 2);
  releases[0]();
  await settle();
  assert.equal(calls.filter(([kind]) => kind === "execute").length, 3);
  releases[1]();
  releases[2]();
  await settle();
});

test("navigation clears old errors and missing tabs do not inject", async () => {
  const { calls, listeners } = worker();
  listeners.click({});
  listeners.update(3, { status: "loading" });
  await settle();
  assert.equal(calls.filter(([kind]) => kind === "execute").length, 0);
  assert.ok(calls.some(([kind, options]) => kind === "badge" && options.tabId === 3 && options.text === ""));
});

test("PNG icons have the dimensions declared in the manifest", async () => {
  for (const size of [16, 32, 48, 128]) {
    const png = await readFile(new URL(`icons/banana-${size}.png`, root));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
