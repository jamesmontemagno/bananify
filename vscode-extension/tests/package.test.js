"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { access, readFile } = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function contrast(first, second) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/.{2}/g).map((value) => {
      const normalized = Number.parseInt(value, 16) / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

test("manifest contributes commands, a monkey view, and optional themes", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const commandIds = manifest.contributes.commands.map(({ command }) => command);
  assert.deepEqual(commandIds, [
    "bananify.toggle",
    "bananify.moreBananas",
    "bananify.openParty",
    "bananify.showPartyExplorer",
    "bananify.pause",
    "bananify.restore",
    "bananify.selectTheme",
    "bananify.cheer",
  ]);
  assert.equal(manifest.contributes.views.bananify[0].type, "webview");
  assert.equal(manifest.contributes.views.explorer[0].id, "bananify.partyExplorer");
  assert.deepEqual(
    manifest.contributes.themes.map(({ label }) => label),
    ["Banana Grove", "Banana Cream", "Midnight Banana", "Monkey Jungle"],
  );
  assert.equal(manifest.contributes.configuration.properties["bananify.decorations.density"].default, 5);
  assert.equal(manifest.contributes.configuration.properties["bananify.fileBadges.enabled"].default, false);
  assert.equal(manifest.contributes.configuration.properties["bananify.celebrations.onSave"].default, false);
  assert.equal(
    manifest.contributes.configuration.properties["bananify.celebrations.onSuccessfulTask"].default,
    false,
  );
  assert.equal(manifest.publisher, "vs-publisher-473885");
  await Promise.all([
    access(path.join(root, manifest.main)),
    access(path.join(root, manifest.icon)),
    access(path.join(root, "media", "bananify-vscode-screenshot.png")),
    access(path.join(root, manifest.contributes.viewsContainers.activitybar[0].icon)),
    ...manifest.contributes.themes.map(({ path: themePath }) =>
      access(path.join(root, themePath))),
    ...[
      "mooch.svg",
      "sebastian.svg",
      "henry.svg",
      "banana-gutter.svg",
      "banana-bunch.svg",
      "banana-green.svg",
    ].map((file) =>
      access(path.join(root, "media", file))),
  ]);
});

test("themes declare readable editor and workbench colors", async () => {
  const themeFiles = [
    ["banana-grove-color-theme.json", "dark"],
    ["banana-cream-color-theme.json", "light"],
    ["midnight-banana-color-theme.json", "dark"],
    ["monkey-jungle-color-theme.json", "dark"],
  ];
  for (const [file, type] of themeFiles) {
    const theme = JSON.parse(await readFile(path.join(root, "themes", file), "utf8"));
    assert.equal(theme.type, type);
    for (const color of [
      "activityBar.background",
      "editor.background",
      "editor.foreground",
      "editorCursor.foreground",
      "statusBar.background",
    ]) {
      assert.match(theme.colors[color], /^#[0-9A-F]{6}$/i);
    }
    assert.ok(contrast(theme.colors["editor.foreground"], theme.colors["editor.background"]) >= 4.5);
    assert.ok(contrast(theme.colors["activityBar.foreground"], theme.colors["activityBar.background"]) >= 4.5);
    assert.ok(contrast(theme.colors["statusBar.foreground"], theme.colors["statusBar.background"]) >= 4.5);
    assert.ok(theme.tokenColors.length >= 5);
  }
});

test("Marketplace screenshot resolves inside the extension subfolder", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  const image = readme.match(/!\[[^\]]+\]\((https:[^)]+)\)/);
  assert.ok(image, "README must include an absolute screenshot URL");
  const url = new URL(image[1]);
  assert.equal(url.origin, "https://raw.githubusercontent.com");
  assert.equal(url.pathname, "/jamesmontemagno/bananify/main/vscode-extension/media/bananify-vscode-screenshot.png");
  await access(path.join(root, "media", path.basename(url.pathname)));
  assert.doesNotMatch(readme, /## Publishing|### Create a release|VSCE_PAT|VSCE_TOKEN|OVSX_PAT|vsce publish|ovsx publish/);
});

test("Party surfaces keep Explorer compact and click bursts bounded", async () => {
  const source = await readFile(path.join(root, "party-panel.js"), "utf8");
  assert.match(source, /body\.explorer \.monkey-stage/);
  assert.match(source, /body\.explorer \.party-monkey \{ display: block/);
  assert.match(source, /const MAX_BURSTS = 30;/);
  assert.match(source, /while \(bursts\.childElementCount >= MAX_BURSTS\)/);
  assert.match(source, /event\.target\.closest\("button"\)/);
});
