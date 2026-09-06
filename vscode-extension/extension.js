"use strict";

const vscode = require("vscode");
const { randomBytes } = require("node:crypto");
const { monkeySvg } = require("./artwork");
const {
  bananaThemes,
  CelebrationGate,
  clampDensity,
  decorationVariant,
  encouragement,
  isMonkeyViewMessage,
  monkeyNames,
  selectDecoratedLines,
} = require("./core");
const { BananaPartySurfaces } = require("./party-panel");

const section = "bananify";
const enabledKey = "decorations.enabled";
const densityKey = "decorations.density";
const fileBadgesKey = "fileBadges.enabled";
const monkeyKey = "monkey";
const reducedMotionKey = "reducedMotion";
const saveCelebrationKey = "celebrations.onSave";
const taskCelebrationKey = "celebrations.onSuccessfulTask";

class BananaDecorations {
  constructor(extensionUri) {
    this.lineDecorations = ["  🍌", "  🍌 🍌", "  🐒 🍌", "  🍌 🐒 🍌"].map((contentText) =>
      vscode.window.createTextEditorDecorationType({
        after: {
          contentText,
          margin: "0 0 0 0.4rem",
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      }));
    this.gutterDecorations = Object.fromEntries(
      [
        ["brown", "mooch.svg"],
        ["black-and-white", "sebastian.svg"],
        ["golden", "henry.svg"],
        ["banana", "banana-gutter.svg"],
        ["bunch", "banana-bunch.svg"],
        ["green", "banana-green.svg"],
      ].map(([monkey, file]) => [
        monkey,
        vscode.window.createTextEditorDecorationType({
          gutterIconPath: vscode.Uri.joinPath(extensionUri, "media", file),
          gutterIconSize: "contain",
          rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        }),
      ]),
    );
  }

  refresh(editors = vscode.window.visibleTextEditors) {
    const config = vscode.workspace.getConfiguration(section);
    if (!config.get(enabledKey, false)) {
      this.clear(editors);
      return;
    }

    const density = clampDensity(config.get(densityKey, 5));
    const monkey = config.get(monkeyKey, "brown");
    const gutterLimit = Math.min(density + 1, 6);
    for (const editor of editors) {
      const visibleLines = new Set();
      for (const range of editor.visibleRanges) {
        for (let lineNumber = range.start.line; lineNumber <= range.end.line; lineNumber += 1) {
          visibleLines.add(lineNumber);
        }
      }
      const selected = selectDecoratedLines(
        editor.document.uri.toString(),
        visibleLines,
        (lineNumber) => !editor.document.lineAt(lineNumber).isEmptyOrWhitespace,
        density,
        gutterLimit,
      );
      const decorateLine = (lineNumber) => ({
        range: editor.document.lineAt(lineNumber).range,
        hoverMessage: new vscode.MarkdownString().appendText(encouragement(monkey, lineNumber)),
      });
      const decorations = selected.bananas.map(decorateLine);
      const lineGroups = this.lineDecorations.map(() => []);
      for (const decoration of decorations) {
        const line = decoration.range.start.line;
        lineGroups[decorationVariant(editor.document.uri.toString(), line, lineGroups.length)]
          .push(decoration);
      }
      this.lineDecorations.forEach((decoration, index) =>
        editor.setDecorations(decoration, lineGroups[index]));

      const gutterGroups = Object.fromEntries(
        Object.keys(this.gutterDecorations).map((key) => [key, []]),
      );
      const gutterKinds = [monkey, "banana", "bunch", "green"];
      for (const lineNumber of selected.gutters) {
        const kind = gutterKinds[
          decorationVariant(editor.document.uri.toString(), lineNumber, gutterKinds.length)
        ];
        gutterGroups[kind].push(decorateLine(lineNumber));
      }
      for (const [variant, decoration] of Object.entries(this.gutterDecorations)) {
        editor.setDecorations(decoration, gutterGroups[variant]);
      }
    }
  }

  clear(editors = vscode.window.visibleTextEditors) {
    for (const editor of editors) {
      for (const decoration of this.lineDecorations) editor.setDecorations(decoration, []);
      for (const decoration of Object.values(this.gutterDecorations)) {
        editor.setDecorations(decoration, []);
      }
    }
  }

  dispose() {
    this.clear();
    for (const decoration of this.lineDecorations) decoration.dispose();
    for (const decoration of Object.values(this.gutterDecorations)) decoration.dispose();
  }
}

class BananaFileBadges {
  constructor() {
    this.files = new Map();
    this.changed = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this.changed.event;
  }

  refresh() {
    const config = vscode.workspace.getConfiguration(section);
    const next = new Map();
    if (config.get(enabledKey, false) && config.get(fileBadgesKey, false)) {
      for (const { document } of vscode.window.visibleTextEditors) {
        if (!document.isUntitled && vscode.workspace.getWorkspaceFolder(document.uri)) {
          next.set(document.uri.toString(), document.uri);
        }
      }
    }
    const affected = new Map([...this.files, ...next]);
    this.files = next;
    if (affected.size) this.changed.fire([...affected.values()]);
  }

  provideFileDecoration(uri) {
    if (!this.files.has(uri.toString())) return undefined;
    const monkey = vscode.workspace.getConfiguration(section).get(monkeyKey, "brown");
    const badge = new vscode.FileDecoration("🍌", `Bananify: ${encouragement(monkey, 0)}`);
    badge.propagate = false;
    return badge;
  }

  dispose() {
    this.files.clear();
    this.changed.dispose();
  }
}

class MonkeyViewProvider {
  constructor(extensionUri, openParty, showPartyExplorer) {
    this.extensionUri = extensionUri;
    this.openParty = openParty;
    this.showPartyExplorer = showPartyExplorer;
    this.view = undefined;
    this.disposables = [];
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [] };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage(async (message) => {
      if (!isMonkeyViewMessage(message)) return;
      if (message.command === "toggle") await vscode.commands.executeCommand("bananify.toggle");
      if (message.command === "more") await vscode.commands.executeCommand("bananify.moreBananas");
      if (message.command === "theme") await vscode.commands.executeCommand("bananify.selectTheme");
      if (message.command === "cheer") await vscode.commands.executeCommand("bananify.cheer");
      if (message.command === "party") this.openParty();
      if (message.command === "partyExplorer") this.showPartyExplorer();
      if (message.command === "monkey") {
        await vscode.workspace.getConfiguration(section).update(
          monkeyKey,
          message.monkey,
          vscode.ConfigurationTarget.Global,
        );
      }
    }, undefined, this.disposables);
    this.disposables.push(
      view.onDidChangeVisibility(() => this.update()),
      view.onDidDispose(() => {
        this.view = undefined;
        for (const disposable of this.disposables.splice(0)) disposable.dispose();
      }),
    );
    this.update();
  }

  update() {
    if (!this.view) return;
    const config = vscode.workspace.getConfiguration(section);
    this.view.webview.postMessage({
      type: "state",
      enabled: config.get(enabledKey, false),
      density: clampDensity(config.get(densityKey, 5)),
      monkey: config.get(monkeyKey, "brown"),
      reducedMotion: config.get(reducedMotionKey, false),
      visible: this.view.visible,
    });
  }

  celebrate() {
    if (this.view?.visible) this.view.webview.postMessage({ type: "celebrate" });
  }

  dispose() {
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
    this.view = undefined;
  }

  html(webview) {
    const nonce = randomNonce();
    const monkeys = Object.keys(monkeyNames)
      .map((monkey) => monkeySvg(monkey, "monkey"))
      .join("");
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body { padding: 14px; color: var(--vscode-foreground); text-align: center; }
    h2 { margin: 4px 0; }
    .subtitle { color: var(--vscode-descriptionForeground); margin-top: 4px; }
    .stage { min-height: 180px; display: grid; place-items: center; overflow: hidden; }
    .monkey { display: none; width: min(220px, 94%); filter: drop-shadow(0 8px 8px #0004); }
    .monkey.selected { display: block; }
    .monkey.party .monkey-body { transform-origin: 140px 250px; animation: dance .65s ease-in-out infinite alternate; }
    .monkey.party .monkey-arm.left { transform-origin: 104px 172px; animation: wave .65s ease-in-out infinite alternate; }
    .monkey.party .monkey-arm.right { transform-origin: 177px 172px; animation: wave .65s ease-in-out infinite alternate-reverse; }
    @keyframes dance { to { transform: rotate(4deg) translateY(-7px); } }
    @keyframes wave { to { transform: rotate(7deg); } }
    body.motion-paused .monkey *, body.motion-paused .stage, body.hidden .monkey *, body.hidden .stage { animation-play-state: paused !important; }
    body.celebrating .stage { animation: celebrate .65s ease-out; }
    @keyframes celebrate { 45% { transform: translateY(-6px) scale(1.03); } }
    @media (prefers-reduced-motion: reduce) { .monkey *, .stage { animation-play-state: paused !important; } }
    .actions, .troop { display: grid; gap: 8px; margin-top: 12px; }
    .troop { grid-template-columns: repeat(3, 1fr); }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 8px; cursor: pointer; border-radius: 3px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .monkey-choice { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .monkey-choice.selected { outline: 2px solid var(--vscode-focusBorder); }
    .status { color: var(--vscode-descriptionForeground); min-height: 1.4em; }
  </style>
</head>
<body>
  <h2>Monkey Business</h2>
  <p class="subtitle">Pick a pal and make the editor bananas.</p>
  <div class="stage">${monkeys}</div>
  <p class="status" aria-live="polite"></p>
  <div class="troop" aria-label="Choose a monkey">
    <button class="monkey-choice" data-monkey="brown">Mooch</button>
    <button class="monkey-choice" data-monkey="black-and-white">Sebastian</button>
    <button class="monkey-choice" data-monkey="golden">Henry</button>
  </div>
  <div class="actions">
    <button data-command="toggle">Start banana party</button>
    <button data-command="party">Open Party tab</button>
    <button data-command="partyExplorer">Show Explorer Party</button>
    <button data-command="more">More bananas</button>
    <button data-command="cheer">Encourage me</button>
    <button data-command="theme">Choose a banana theme</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const status = document.querySelector(".status");
    const toggle = document.querySelector('[data-command="toggle"]');
    const events = new AbortController();
    let celebrationTimer;
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (["toggle", "party", "partyExplorer", "more", "cheer", "theme"].includes(button.dataset.command)) {
        vscode.postMessage({ command: button.dataset.command });
      }
      if (["brown", "black-and-white", "golden"].includes(button.dataset.monkey)) {
        vscode.postMessage({ command: "monkey", monkey: button.dataset.monkey });
      }
    }, { signal: events.signal });
    window.addEventListener("message", ({ data }) => {
      if (!data || typeof data !== "object") return;
      if (data.type === "state") {
        document.querySelectorAll(".monkey").forEach((monkey) => {
          monkey.classList.toggle("selected", monkey.dataset.monkey === data.monkey);
          monkey.classList.toggle("party", data.enabled);
        });
        document.body.classList.toggle("motion-paused", data.reducedMotion);
        document.body.classList.toggle("hidden", !data.visible);
        toggle.textContent = data.enabled ? "Restore editor" : "Start banana party";
        status.textContent = data.enabled ? "Banana party level " + data.density + " of 5" : "The troop is ready.";
        document.querySelectorAll("[data-monkey]").forEach((button) => button.classList.toggle("selected", button.dataset.monkey === data.monkey));
      }
      if (data.type === "celebrate") {
        clearTimeout(celebrationTimer);
        document.body.classList.remove("celebrating");
        requestAnimationFrame(() => document.body.classList.add("celebrating"));
        celebrationTimer = setTimeout(() => document.body.classList.remove("celebrating"), 650);
      }
    }, { signal: events.signal });
    window.addEventListener("pagehide", () => {
      clearTimeout(celebrationTimer);
      events.abort();
    }, { once: true });
  </script>
</body>
</html>`;
  }
}

function randomNonce() {
  return randomBytes(16).toString("hex");
}

function activate(context) {
  const decorations = new BananaDecorations(context.extensionUri);
  const fileBadges = new BananaFileBadges();
  const celebrationGate = new CelebrationGate();
  const partySurfaces = new BananaPartySurfaces(
    () => vscode.workspace.getConfiguration(section).get(monkeyKey, "brown"),
    () => vscode.workspace.getConfiguration(section).get(reducedMotionKey, false),
    (enabled) => vscode.workspace.getConfiguration(section).update(
      enabledKey,
      enabled,
      vscode.ConfigurationTarget.Global,
    ),
    vscode.Uri.joinPath(context.extensionUri, "media", "banana-128.png"),
  );
  const monkeyViewProvider = new MonkeyViewProvider(
    context.extensionUri,
    () => partySurfaces.openEditor(),
    () => vscode.commands.executeCommand("bananify.showPartyExplorer"),
  );
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  status.name = "Bananify";
  status.command = "bananify.pause";
  let statusTimer;
  let statusFrame = 0;
  let celebrationTimer;

  const stopStatusAnimation = () => {
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = undefined;
    statusFrame = 0;
  };

  const syncStatusAnimation = () => {
    stopStatusAnimation();
    const config = vscode.workspace.getConfiguration(section);
    const enabled = config.get(enabledKey, false);
    const reducedMotion = config.get(reducedMotionKey, false);
    if (!enabled || reducedMotion || celebrationTimer) return;
    statusTimer = setInterval(() => {
      statusFrame = (statusFrame + 1) % 3;
      status.text = ["$(symbol-color) Bananify", "$(sparkle) Bananify", "$(symbol-color) Bananas!"][statusFrame];
    }, 900);
  };

  const refresh = () => {
    const config = vscode.workspace.getConfiguration(section);
    const enabled = config.get(enabledKey, false);
    decorations.refresh();
    fileBadges.refresh();
    monkeyViewProvider.update();
    partySurfaces.update();
    status.text = enabled ? "$(sparkle) $(symbol-color) Bananas!" : "$(symbol-color) Bananify";
    status.tooltip = enabled
      ? "Banana party is active. Click to pause or resume decorations; use Restore Editor to stop everything."
      : "Bananify is ready. Run Toggle Banana Party to start.";
    status.show();
    syncStatusAnimation();
  };

  const restore = async () => {
    await vscode.workspace.getConfiguration(section).update(
      enabledKey,
      false,
      vscode.ConfigurationTarget.Global,
    );
    partySurfaces.stop();
    celebrationGate.reset();
    if (celebrationTimer) clearTimeout(celebrationTimer);
    celebrationTimer = undefined;
    stopStatusAnimation();
    decorations.clear();
    fileBadges.refresh();
    monkeyViewProvider.update();
    status.text = "$(symbol-color) Bananify";
  };

  const celebrate = () => {
    const config = vscode.workspace.getConfiguration(section);
    const reducedMotion = config.get(reducedMotionKey, false);
    stopStatusAnimation();
    monkeyViewProvider.celebrate();
    partySurfaces.celebrate();
    if (celebrationTimer) clearTimeout(celebrationTimer);
    status.text = reducedMotion ? "$(check) Banana cheer!" : "$(sparkle) 🍌 Banana cheer!";
    status.tooltip = "A small Bananify celebration. No files were changed.";
    celebrationTimer = setTimeout(() => {
      celebrationTimer = undefined;
      refresh();
    }, reducedMotion ? 700 : 1600);
  };

  context.subscriptions.push(
    decorations,
    fileBadges,
    vscode.window.registerFileDecorationProvider(fileBadges),
    partySurfaces,
    monkeyViewProvider,
    status,
    vscode.window.registerWebviewViewProvider("bananify.monkeys", monkeyViewProvider),
    vscode.window.registerWebviewViewProvider("bananify.partyExplorer", {
      resolveWebviewView(view) {
        partySurfaces.resolveExplorerView(view);
      },
    }),
    vscode.commands.registerCommand("bananify.toggle", async () => {
      const config = vscode.workspace.getConfiguration(section);
      const enabled = !config.get(enabledKey, false);
      if (!enabled) {
        await restore();
      } else {
        await config.update(enabledKey, true, vscode.ConfigurationTarget.Global);
        partySurfaces.start();
        const choice = await vscode.window.showInformationMessage(
          "Your editor is officially bananas! 🍌",
          "Choose a theme",
          "Open Party tab",
          "Meet the monkeys",
        );
        if (choice === "Choose a theme") await vscode.commands.executeCommand("bananify.selectTheme");
        if (choice === "Open Party tab") partySurfaces.openEditor();
        if (choice === "Meet the monkeys") await vscode.commands.executeCommand("bananify.monkeys.focus");
      }
    }),
    vscode.commands.registerCommand("bananify.openParty", () => partySurfaces.openEditor()),
    vscode.commands.registerCommand("bananify.showPartyExplorer", async () => {
      await vscode.commands.executeCommand("workbench.view.explorer");
      await vscode.commands.executeCommand("bananify.partyExplorer.focus");
    }),
    vscode.commands.registerCommand("bananify.pause", async () => {
      const config = vscode.workspace.getConfiguration(section);
      const enabled = config.get(enabledKey, false);
      partySurfaces.setPaused(enabled);
      if (!partySurfaces.state.active) {
        await config.update(enabledKey, !enabled, vscode.ConfigurationTarget.Global);
      }
    }),
    vscode.commands.registerCommand("bananify.moreBananas", async () => {
      const config = vscode.workspace.getConfiguration(section);
      const current = clampDensity(config.get(densityKey, 5));
      await config.update(enabledKey, true, vscode.ConfigurationTarget.Global);
      await config.update(densityKey, current === 5 ? 1 : current + 1, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand("bananify.restore", restore),
    vscode.commands.registerCommand("bananify.selectTheme", async () => {
      const choice = await vscode.window.showQuickPick(bananaThemes, {
        placeHolder: "Preview a Bananify theme. Press Escape to keep your current theme.",
        matchOnDescription: true,
      });
      if (choice) {
        const workbench = vscode.workspace.getConfiguration("workbench");
        const inspected = workbench.inspect("colorTheme");
        const target = inspected?.workspaceFolderValue !== undefined
          ? vscode.ConfigurationTarget.WorkspaceFolder
          : inspected?.workspaceValue !== undefined
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;
        await workbench.update(
          "colorTheme",
          choice.label,
          target,
        );
      }
    }),
    vscode.commands.registerCommand("bananify.cheer", () => {
      const monkey = vscode.workspace.getConfiguration(section).get(monkeyKey, "brown");
      vscode.window.showInformationMessage(`🐒 ${encouragement(monkey)}`);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(section)) refresh();
    }),
    vscode.window.onDidChangeVisibleTextEditors(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(() => fileBadges.refresh()),
    vscode.window.onDidChangeTextEditorVisibleRanges(({ textEditor }) => {
      if (vscode.window.visibleTextEditors.includes(textEditor)) decorations.refresh([textEditor]);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const lineCountChanged = event.contentChanges.some((change) =>
        change.text.includes("\n") || change.range.start.line !== change.range.end.line);
      if (lineCountChanged
        && vscode.window.visibleTextEditors.some((editor) => editor.document === event.document)) {
        refresh();
      }
    }),
    vscode.workspace.onDidSaveTextDocument(() => {
      const config = vscode.workspace.getConfiguration(section);
      if (celebrationGate.trySave(config.get(saveCelebrationKey, false))) celebrate();
    }),
    vscode.tasks.onDidEndTaskProcess(({ exitCode }) => {
      const config = vscode.workspace.getConfiguration(section);
      if (celebrationGate.tryTask(config.get(taskCelebrationKey, false), exitCode)) celebrate();
    }),
    {
      dispose() {
        stopStatusAnimation();
        if (celebrationTimer) clearTimeout(celebrationTimer);
      },
    },
  );

  refresh();
}

function deactivate() {}

module.exports = { activate, deactivate };
