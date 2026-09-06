"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { access, readFile } = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("manifest contributes commands, a monkey view, and an optional theme", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const commandIds = manifest.contributes.commands.map(({ command }) => command);
  assert.deepEqual(commandIds, [
    "bananify.toggle",
    "bananify.moreBananas",
    "bananify.restore",
    "bananify.selectTheme",
    "bananify.cheer",
  ]);
  assert.equal(manifest.contributes.views.bananify[0].type, "webview");
  assert.equal(manifest.contributes.themes[0].label, "Banana Grove");
  assert.equal(manifest.publisher, "vs-publisher-473885");
  await Promise.all([
    access(path.join(root, manifest.main)),
    access(path.join(root, manifest.icon)),
    access(path.join(root, manifest.contributes.viewsContainers.activitybar[0].icon)),
    access(path.join(root, manifest.contributes.themes[0].path)),
  ]);
});

test("theme declares readable editor and workbench colors", async () => {
  const theme = JSON.parse(await readFile(
    path.join(root, "themes/banana-grove-color-theme.json"),
    "utf8",
  ));
  assert.equal(theme.type, "dark");
  for (const color of [
    "activityBar.background",
    "editor.background",
    "editor.foreground",
    "editorCursor.foreground",
    "statusBar.background",
  ]) {
    assert.match(theme.colors[color], /^#[0-9A-F]{6}$/i);
  }
  assert.ok(theme.tokenColors.length >= 5);
});
