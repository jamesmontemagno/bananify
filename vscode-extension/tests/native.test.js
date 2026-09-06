"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const vm = require("node:vm");
const { encouragement } = require("../core");

const disposable = () => ({ dispose() {} });
const uri = (value) => ({ toString: () => value });

function load(file, vscode, expose = "") {
  const filename = path.resolve(__dirname, "..", file);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(filename, "utf8") + expose, {
    module,
    require(name) {
      if (name === "vscode") return vscode;
      if (name === "./party-panel") return {};
      return localRequire(name);
    },
  });
  return module.exports;
}

function nativeHarness() {
  const settings = {
    "decorations.enabled": true,
    "decorations.density": 5,
    monkey: "brown",
  };
  const changes = [];
  const vscode = {
    workspace: {
      getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback }),
      getWorkspaceFolder: (file) => file.toString().startsWith("file:///workspace/") ? {} : undefined,
    },
    window: {
      visibleTextEditors: [],
      createTextEditorDecorationType: (options) => ({ options, ...disposable() }),
    },
    Uri: { joinPath: (base, ...parts) => uri(`${base}/${parts.join("/")}`) },
    DecorationRangeBehavior: { ClosedClosed: 1 },
    MarkdownString: class {
      constructor() { this.value = ""; this.isTrusted = false; }
      appendText(text) { this.value += text; return this; }
    },
    FileDecoration: class {
      constructor(badge, tooltip) { this.badge = badge; this.tooltip = tooltip; }
    },
    EventEmitter: class {
      event = () => disposable();
      fire(files) { changes.push(Array.from(files, (file) => file.toString())); }
      dispose() { this.disposed = true; }
    },
  };
  const classes = load("extension.js", vscode,
    "\nmodule.exports = { BananaDecorations, BananaFileBadges };");
  return { ...classes, vscode, settings, changes };
}

function editor(file, isUntitled = false) {
  const applied = new Map();
  return {
    applied,
    document: {
      uri: uri(file),
      isUntitled,
      lineAt: (line) => ({
        isEmptyOrWhitespace: false,
        range: { start: { line }, end: { line } },
      }),
    },
    visibleRanges: [{ start: { line: 0 }, end: { line: 100 } }],
    setDecorations: (type, decorations) => applied.set(type, decorations),
  };
}

test("line and gutter hovers use stable, untrusted encouragement from the selected monkey", () => {
  const { BananaDecorations, vscode, settings } = nativeHarness();
  const view = editor("file:///workspace/bananas.js");
  vscode.window.visibleTextEditors = [view];
  const decorations = new BananaDecorations(uri("file:///extension"));
  for (const monkey of ["brown", "black-and-white", "golden"]) {
    settings.monkey = monkey;
    decorations.refresh();
    for (const types of [decorations.lineDecorations, Object.values(decorations.gutterDecorations)]) {
      const items = types.flatMap((type) => view.applied.get(type));
      assert.ok(items.length > 0);
      for (const item of items) {
        assert.equal(item.hoverMessage.value, encouragement(monkey, item.range.start.line));
        assert.equal(item.hoverMessage.isTrusted, false);
      }
    }
    const before = [...view.applied.values()].flat().map((item) => item.hoverMessage.value);
    decorations.refresh();
    assert.deepEqual([...view.applied.values()].flat().map((item) => item.hoverMessage.value), before);
  }
  settings["decorations.enabled"] = false;
  decorations.refresh();
  assert.ok([...view.applied.values()].every((items) => items.length === 0));
  decorations.dispose();
});

test("Explorer badges are opt-in, limited to visible workspace files, and never color or propagate", () => {
  const { BananaFileBadges, vscode, settings, changes } = nativeHarness();
  const first = editor("file:///workspace/first.js");
  const second = editor("file:///workspace/second.js");
  const outside = editor("file:///outside/example.js");
  const unsaved = editor("untitled:Untitled-1", true);
  vscode.window.visibleTextEditors = [first, first, outside, unsaved];
  const provider = new BananaFileBadges();
  provider.refresh();
  assert.equal(provider.provideFileDecoration(first.document.uri), undefined);
  assert.equal(changes.length, 0);

  settings["fileBadges.enabled"] = true;
  provider.refresh();
  assert.deepEqual(changes.at(-1), [first.document.uri.toString()]);
  const badge = provider.provideFileDecoration(first.document.uri);
  assert.equal(badge.badge, "\u{1F34C}");
  assert.match(badge.tooltip, /Bananify: Mooch says:/);
  assert.equal(badge.color, undefined);
  assert.equal(badge.propagate, false);
  for (const file of [outside.document.uri, unsaved.document.uri, uri("file:///workspace/")]) {
    assert.equal(provider.provideFileDecoration(file), undefined);
  }

  settings.monkey = "golden";
  provider.refresh();
  assert.match(provider.provideFileDecoration(first.document.uri).tooltip, /Henry says:/);
  vscode.window.visibleTextEditors = [second];
  provider.refresh();
  assert.deepEqual(changes.at(-1), [first.document.uri.toString(), second.document.uri.toString()]);
  assert.equal(provider.provideFileDecoration(first.document.uri), undefined);
  assert.ok(provider.provideFileDecoration(second.document.uri));

  for (const key of ["decorations.enabled", "fileBadges.enabled"]) {
    settings[key] = false;
    provider.refresh();
    assert.equal(provider.provideFileDecoration(second.document.uri), undefined);
    assert.deepEqual(changes.at(-1), [second.document.uri.toString()]);
    settings[key] = true;
    provider.refresh();
  }
  vscode.window.visibleTextEditors = [];
  provider.refresh();
  assert.equal(provider.provideFileDecoration(second.document.uri), undefined);
  assert.deepEqual(changes.at(-1), [second.document.uri.toString()]);
  provider.dispose();
  assert.equal(provider.changed.disposed, true);
});

test("Party editor receives the packaged banana icon and retains it when revealed again", () => {
  let panelsCreated = 0;
  const panel = {
    visible: true,
    webview: { cspSource: "'self'", onDidReceiveMessage: disposable, postMessage() {} },
    onDidChangeViewState: disposable,
    onDidDispose: disposable,
    reveal() {},
    dispose() {},
  };
  const { BananaPartySurfaces } = load("party-panel.js", {
    ViewColumn: { Beside: 2 },
    window: { createWebviewPanel: () => { panelsCreated += 1; return panel; } },
  });
  const icon = uri("file:///extension/media/banana-128.png");
  const surfaces = new BananaPartySurfaces(() => "brown", () => false, () => {}, icon);
  surfaces.openEditor();
  assert.equal(panel.iconPath, icon);
  surfaces.openEditor();
  assert.equal(panelsCreated, 1);
  assert.equal(panel.iconPath, icon);
  surfaces.dispose();
});
