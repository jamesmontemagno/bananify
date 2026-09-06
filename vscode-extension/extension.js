"use strict";

const vscode = require("vscode");
const { randomBytes } = require("node:crypto");
const { clampDensity, encouragement, monkeyNames, shouldDecorateLine } = require("./core");

const section = "bananify";
const enabledKey = "decorations.enabled";
const densityKey = "decorations.density";
const monkeyKey = "monkey";

class BananaDecorations {
  constructor() {
    this.decoration = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: "  🍌",
        margin: "0 0 0 0.4rem",
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }

  refresh() {
    const config = vscode.workspace.getConfiguration(section);
    if (!config.get(enabledKey, false)) {
      this.clear();
      return;
    }

    const density = clampDensity(config.get(densityKey, 2));
    for (const editor of vscode.window.visibleTextEditors) {
      const decorations = [];
      for (let lineNumber = 0; lineNumber < editor.document.lineCount; lineNumber += 1) {
        const line = editor.document.lineAt(lineNumber);
        if (!line.isEmptyOrWhitespace
          && shouldDecorateLine(editor.document.uri.toString(), lineNumber, density)) {
          decorations.push({ range: line.range });
        }
      }
      editor.setDecorations(this.decoration, decorations);
    }
  }

  clear() {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.decoration, []);
    }
  }

  dispose() {
    this.clear();
    this.decoration.dispose();
  }
}

class MonkeyViewProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
    this.view = undefined;
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message.command !== "string") return;
      if (message.command === "toggle") await vscode.commands.executeCommand("bananify.toggle");
      if (message.command === "more") await vscode.commands.executeCommand("bananify.moreBananas");
      if (message.command === "theme") await vscode.commands.executeCommand("bananify.selectTheme");
      if (message.command === "cheer") await vscode.commands.executeCommand("bananify.cheer");
      if (message.command === "monkey" && Object.hasOwn(monkeyNames, message.monkey)) {
        await vscode.workspace.getConfiguration(section).update(
          monkeyKey,
          message.monkey,
          vscode.ConfigurationTarget.Global,
        );
      }
    });
    this.update();
  }

  update() {
    if (!this.view) return;
    const config = vscode.workspace.getConfiguration(section);
    this.view.webview.postMessage({
      type: "state",
      enabled: config.get(enabledKey, false),
      density: clampDensity(config.get(densityKey, 2)),
      monkey: config.get(monkeyKey, "brown"),
    });
  }

  html(webview) {
    const nonce = randomNonce();
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
    .monkey { --fur: #765039; --face: #f6dab0; width: min(190px, 90%); filter: drop-shadow(0 8px 8px #0004); }
    .monkey.black-and-white { --fur: #303334; --face: #faf8ed; }
    .monkey.golden { --fur: #c39137; --face: #fff0cb; }
    .monkey.party { animation: dance .65s ease-in-out infinite alternate; }
    @keyframes dance { to { transform: rotate(5deg) translateY(-8px); } }
    @media (prefers-reduced-motion: reduce) { .monkey.party { animation: none; } }
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
  <div class="stage">
    <svg class="monkey brown" viewBox="0 0 220 210" role="img" aria-label="Brown capuchin">
      <path fill="none" stroke="var(--fur)" stroke-width="15" stroke-linecap="round" d="M155 153c58 31 70-29 44-36"/>
      <ellipse cx="110" cy="145" rx="50" ry="48" fill="var(--fur)"/>
      <circle cx="67" cy="76" r="21" fill="var(--fur)"/><circle cx="153" cy="76" r="21" fill="var(--fur)"/>
      <circle cx="110" cy="78" r="58" fill="var(--fur)"/>
      <ellipse cx="110" cy="89" rx="42" ry="38" fill="var(--face)"/>
      <circle cx="95" cy="79" r="5"/><circle cx="125" cy="79" r="5"/>
      <path d="M96 105q14 18 28 0" fill="none" stroke="#482b21" stroke-width="5" stroke-linecap="round"/>
      <path d="M62 134Q32 117 31 86M158 134q30-12 40-42" fill="none" stroke="var(--fur)" stroke-width="18" stroke-linecap="round"/>
      <text x="174" y="83" font-size="37">🍌</text>
    </svg>
  </div>
  <p class="status" aria-live="polite"></p>
  <div class="troop" aria-label="Choose a monkey">
    <button class="monkey-choice" data-monkey="brown">Mochi</button>
    <button class="monkey-choice" data-monkey="black-and-white">Pepper</button>
    <button class="monkey-choice" data-monkey="golden">Sunny</button>
  </div>
  <div class="actions">
    <button data-command="toggle">Start banana party</button>
    <button data-command="more">More bananas</button>
    <button data-command="cheer">Encourage me</button>
    <button data-command="theme">Try Banana Grove theme</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const monkey = document.querySelector(".monkey");
    const status = document.querySelector(".status");
    const toggle = document.querySelector('[data-command="toggle"]');
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.command) vscode.postMessage({ command: button.dataset.command });
      if (button.dataset.monkey) vscode.postMessage({ command: "monkey", monkey: button.dataset.monkey });
    });
    window.addEventListener("message", ({ data }) => {
      if (data.type !== "state") return;
      monkey.setAttribute("class", "monkey " + data.monkey + (data.enabled ? " party" : ""));
      toggle.textContent = data.enabled ? "Restore editor" : "Start banana party";
      status.textContent = data.enabled ? "Banana party level " + data.density + " of 5" : "The troop is ready.";
      document.querySelectorAll("[data-monkey]").forEach((button) => button.classList.toggle("selected", button.dataset.monkey === data.monkey));
    });
  </script>
</body>
</html>`;
  }
}

function randomNonce() {
  return randomBytes(16).toString("hex");
}

function activate(context) {
  const decorations = new BananaDecorations();
  const monkeys = new MonkeyViewProvider(context.extensionUri);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  status.name = "Bananify";
  status.command = "bananify.toggle";

  const refresh = () => {
    const config = vscode.workspace.getConfiguration(section);
    const enabled = config.get(enabledKey, false);
    decorations.refresh();
    monkeys.update();
    status.text = enabled ? "$(sparkle) $(symbol-color) Bananas!" : "$(symbol-color) Bananify";
    status.tooltip = enabled ? "Restore the editor" : "Start a banana party";
    status.show();
  };

  context.subscriptions.push(
    decorations,
    status,
    vscode.window.registerWebviewViewProvider("bananify.monkeys", monkeys),
    vscode.commands.registerCommand("bananify.toggle", async () => {
      const config = vscode.workspace.getConfiguration(section);
      const enabled = !config.get(enabledKey, false);
      await config.update(enabledKey, enabled, vscode.ConfigurationTarget.Global);
      if (enabled) {
        const choice = await vscode.window.showInformationMessage(
          "Your editor is officially bananas! 🍌",
          "Use Banana Grove",
          "Meet the monkeys",
        );
        if (choice === "Use Banana Grove") await vscode.commands.executeCommand("bananify.selectTheme");
        if (choice === "Meet the monkeys") await vscode.commands.executeCommand("bananify.monkeys.focus");
      }
    }),
    vscode.commands.registerCommand("bananify.moreBananas", async () => {
      const config = vscode.workspace.getConfiguration(section);
      const current = clampDensity(config.get(densityKey, 2));
      await config.update(enabledKey, true, vscode.ConfigurationTarget.Global);
      await config.update(densityKey, current === 5 ? 1 : current + 1, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand("bananify.restore", async () => {
      await vscode.workspace.getConfiguration(section).update(
        enabledKey,
        false,
        vscode.ConfigurationTarget.Global,
      );
    }),
    vscode.commands.registerCommand("bananify.selectTheme", () =>
      vscode.commands.executeCommand("workbench.action.selectTheme", "Banana Grove")),
    vscode.commands.registerCommand("bananify.cheer", () => {
      const monkey = vscode.workspace.getConfiguration(section).get(monkeyKey, "brown");
      vscode.window.showInformationMessage(`🐒 ${encouragement(monkey)}`);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(section)) refresh();
    }),
    vscode.window.onDidChangeVisibleTextEditors(refresh),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (vscode.window.visibleTextEditors.some((editor) => editor.document === event.document)) refresh();
    }),
  );

  refresh();
}

function deactivate() {}

module.exports = { activate, deactivate };
