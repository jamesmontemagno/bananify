"use strict";

const vscode = require("vscode");
const { randomBytes } = require("node:crypto");
const { bananaSvg, monkeySvg } = require("./artwork");
const { isPartyMessage, monkeyNames, PartyState } = require("./core");

class BananaPartySurfaces {
  constructor(getMonkey, getReducedMotion, setDecorationsEnabled) {
    this.getMonkey = getMonkey;
    this.getReducedMotion = getReducedMotion;
    this.setDecorationsEnabled = setDecorationsEnabled;
    this.panel = undefined;
    this.explorerView = undefined;
    this.panelDisposables = [];
    this.explorerDisposables = [];
    this.state = new PartyState();
  }

  openEditor() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      this.state.setVisible(this.anySurfaceVisible());
      this.update();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "bananify.party",
      "Banana Party",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      {
        enableScripts: true,
        localResourceRoots: [],
        retainContextWhenHidden: true,
      },
    );
    this.configureWebview(this.panel.webview);
    this.panelDisposables.push(
      this.panel.onDidChangeViewState(() => {
        this.state.setVisible(this.anySurfaceVisible());
        this.update();
      }),
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        for (const disposable of this.panelDisposables.splice(0)) disposable.dispose();
        this.state.setVisible(this.anySurfaceVisible());
        if (!this.explorerView) this.state.restore();
        this.update();
      }),
    );
    this.start();
  }

  resolveExplorerView(view) {
    this.explorerView = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [] };
    this.configureWebview(view.webview);
    this.explorerDisposables.push(
      view.onDidChangeVisibility(() => {
        this.state.setVisible(this.anySurfaceVisible());
        this.update();
      }),
      view.onDidDispose(() => {
        this.explorerView = undefined;
        for (const disposable of this.explorerDisposables.splice(0)) disposable.dispose();
        this.state.setVisible(this.anySurfaceVisible());
        if (!this.panel) this.state.restore();
      }),
    );
    this.state.setVisible(this.anySurfaceVisible());
    this.update();
  }

  start() {
    if (!this.state.active) this.state.open(this.getReducedMotion());
    else {
      this.state.paused = false;
      this.state.setVisible(this.anySurfaceVisible());
      this.state.setReducedMotion(this.getReducedMotion());
    }
    this.syncDecorations(true);
    this.update();
  }

  setPaused(paused) {
    if (!this.state.active && !paused) {
      this.start();
      return;
    }
    if (this.state.active && this.state.paused !== paused) this.state.togglePaused();
    this.syncDecorations(!paused);
    this.update();
  }

  configureWebview(webview) {
    webview.html = partyHtml(webview);
    const disposables = webview === this.panel?.webview
      ? this.panelDisposables
      : this.explorerDisposables;
    disposables.push(webview.onDidReceiveMessage((message) => {
      if (!isPartyMessage(message)) return;
      if (message.command === "start") this.start();
      if (message.command === "pause") {
        this.state.togglePaused();
        this.syncDecorations(!this.state.paused);
        this.update();
      }
      if (message.command === "stop") this.stop();
    }));
  }

  anySurfaceVisible() {
    return Boolean(this.panel?.visible || this.explorerView?.visible);
  }

  syncDecorations(enabled) {
    Promise.resolve(this.setDecorationsEnabled(enabled)).catch((error) => {
      vscode.window.showErrorMessage(`Bananify could not update decorations: ${error.message}`);
    });
  }

  update() {
    this.state.setReducedMotion(this.getReducedMotion());
    this.state.setVisible(this.anySurfaceVisible());
    const monkey = this.getMonkey();
    const message = (visible) => ({
      type: "state",
      active: this.state.active,
      monkey,
      monkeyName: monkeyNames[monkey] || monkeyNames.brown,
      paused: this.state.paused,
      reducedMotion: this.state.reducedMotion,
      visible,
    });
    if (this.panel) this.panel.webview.postMessage(message(this.panel.visible));
    if (this.explorerView) {
      this.explorerView.webview.postMessage(message(this.explorerView.visible));
    }
  }

  celebrate() {
    if (!this.state.active || this.state.paused) return;
    if (this.panel?.visible) this.panel.webview.postMessage({ type: "celebrate" });
    if (this.explorerView?.visible) this.explorerView.webview.postMessage({ type: "celebrate" });
  }

  stop() {
    this.state.restore();
    this.syncDecorations(false);
    this.panel?.dispose();
    this.panel = undefined;
    this.explorerView?.webview.postMessage({
      type: "state",
      active: false,
      monkey: this.getMonkey(),
      monkeyName: monkeyNames[this.getMonkey()] || monkeyNames.brown,
      paused: false,
      reducedMotion: this.getReducedMotion(),
      visible: this.explorerView.visible,
    });
  }

  dispose() {
    this.state.restore();
    this.panel?.dispose();
    this.panel = undefined;
    for (const disposable of this.panelDisposables.splice(0)) disposable.dispose();
    for (const disposable of this.explorerDisposables.splice(0)) disposable.dispose();
    this.explorerView = undefined;
  }
}

function partyHtml(webview) {
  const nonce = randomBytes(16).toString("hex");
  const monkeys = Object.keys(monkeyNames)
    .map((monkey) => monkeySvg(monkey, "party-monkey"))
    .join("");
  const bananas = Array.from({ length: 28 }, (_, index) =>
    `<span class="banana-drop variety-${index % 3}" style="--x:${(index * 37) % 101};--delay:${-((index * 0.43) % 8).toFixed(2)}s;--duration:${(5.8 + (index % 7) * 0.47).toFixed(2)}s;--drift:${(index % 2 ? 1 : -1) * (18 + (index % 5) * 9)}px;--size:${24 + (index % 6) * 5}px">${bananaSvg("banana-art")}</span>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; overflow: hidden; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    .sky { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
    .banana-drop { position: absolute; top: -90px; left: calc(var(--x) * 1%); width: var(--size); opacity: .92; animation: fall var(--duration) linear var(--delay) infinite; will-change: transform, opacity; }
    .banana-drop.variety-1 { filter: hue-rotate(18deg) saturate(.82); }
    .banana-drop.variety-2 { transform: scaleX(-1); filter: brightness(1.08); }
    .banana-art { display: block; width: 100%; height: auto; overflow: visible; }
    @keyframes fall {
      0% { opacity: 0; transform: translate3d(0, -12vh, 0) rotate(-18deg); }
      12% { opacity: .95; }
      88% { opacity: .95; }
      100% { opacity: 0; transform: translate3d(var(--drift), 118vh, 0) rotate(342deg); }
    }
    main { position: relative; z-index: 1; min-height: 100vh; display: grid; place-items: center; padding: clamp(12px, 5vw, 32px); }
    .party-card { width: min(720px, 100%); text-align: center; padding: clamp(18px, 6vw, 56px); border: 1px solid var(--vscode-panel-border); border-radius: 24px; background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent); box-shadow: 0 16px 48px #0004; }
    .monkey-stage { width: min(330px, 92%); margin: 0 auto; padding: 8px; filter: drop-shadow(0 12px 10px #0005); overflow: visible; }
    .party-monkey { display: none; width: 100%; overflow: visible; }
    .party-monkey.selected { display: block; }
    .party-monkey .monkey-body { transform-origin: 140px 250px; animation: dance .7s ease-in-out infinite alternate; }
    .party-monkey .monkey-arm.left { transform-origin: 104px 172px; animation: wave .7s ease-in-out infinite alternate; }
    .party-monkey .monkey-arm.right { transform-origin: 177px 172px; animation: wave .7s ease-in-out infinite alternate-reverse; }
    .party-monkey .monkey-head { transform-origin: 140px 140px; animation: nod .7s ease-in-out infinite alternate; }
    @keyframes dance { to { transform: rotate(4deg) translateY(-8px); } }
    @keyframes wave { to { transform: rotate(7deg); } }
    @keyframes nod { to { transform: rotate(-3deg) translateY(2px); } }
    h1 { margin: 4px 0 8px; font-size: clamp(26px, 6vw, 52px); line-height: 1; }
    .message { min-height: 1.5em; margin: 0 auto 22px; color: var(--vscode-descriptionForeground); font-size: 16px; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    button { min-height: 40px; border: 0; border-radius: 4px; padding: 9px 16px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; font: inherit; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
    .secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    .secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .motion-note { display: none; margin: 18px auto 0; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    body:not(.active) .sky { display: none; }
    body:not(.active) .party-monkey * { animation-play-state: paused !important; }
    body:not(.active) [data-command="pause"], body.active [data-command="start"] { display: none; }
    body.reduced .motion-note { display: block; }
    body.paused .banana-drop, body.paused .party-monkey *, body.hidden .banana-drop, body.hidden .party-monkey *, body.reduced:not(.motion-override) .banana-drop, body.reduced:not(.motion-override) .party-monkey *, body.reduced:not(.motion-override) .party-card { animation-play-state: paused !important; }
    body.celebrating:not(.reduced) .party-card, body.celebrating.motion-override .party-card { animation: celebrate .7s ease-out; }
    @keyframes celebrate { 45% { transform: translateY(-8px) scale(1.015); box-shadow: 0 24px 64px #0006; } }
    @media (prefers-reduced-motion: reduce) {
      body:not(.motion-override) .banana-drop, body:not(.motion-override) .party-monkey *, body:not(.motion-override) .party-card { animation-play-state: paused !important; }
      body:not(.motion-override) .motion-note { display: block; }
    }
    @media (max-width: 320px) {
      main { padding: 8px; }
      .party-card { padding: 14px 10px; border-radius: 12px; }
      .monkey-stage { width: min(230px, 100%); }
      h1 { font-size: 26px; }
      .message { font-size: 13px; margin-bottom: 14px; }
      .actions { display: grid; }
    }
  </style>
</head>
<body class="hidden">
  <div class="sky" aria-hidden="true">${bananas}</div>
  <main>
    <section class="party-card" aria-labelledby="party-title">
      <div class="monkey-stage">${monkeys}</div>
      <h1 id="party-title">Banana Party</h1>
      <p class="message" aria-live="polite">The party is ready when you are.</p>
      <div class="actions">
        <button data-command="start">Start party</button>
        <button data-command="pause">Pause animation</button>
        <button class="secondary" data-command="stop">Stop party</button>
      </div>
      <button class="motion-note" data-motion-override>Animate anyway</button>
    </section>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const body = document.body;
    const message = document.querySelector(".message");
    const pause = document.querySelector('[data-command="pause"]');
    const motionOverride = document.querySelector("[data-motion-override]");
    const events = new AbortController();
    let celebrating = false;
    let motionOverrideEnabled = false;

    function syncMotion() {
      body.classList.toggle("motion-override", motionOverrideEnabled);
      motionOverride.textContent = motionOverrideEnabled ? "Use reduced motion" : "Animate anyway";
    }

    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (["start", "pause", "stop"].includes(button.dataset.command)) {
        vscode.postMessage({ command: button.dataset.command });
      }
      if (button.hasAttribute("data-motion-override")) {
        motionOverrideEnabled = !motionOverrideEnabled;
        syncMotion();
      }
    }, { signal: events.signal });

    window.addEventListener("message", ({ data }) => {
      if (!data || typeof data !== "object") return;
      if (data.type === "state") {
        document.querySelectorAll(".party-monkey").forEach((monkey) => {
          monkey.classList.toggle("selected", monkey.dataset.monkey === data.monkey);
        });
        body.classList.toggle("active", data.active);
        body.classList.toggle("paused", data.paused);
        body.classList.toggle("hidden", !data.visible);
        body.classList.toggle("reduced", data.reducedMotion);
        pause.textContent = data.paused ? "Resume animation" : "Pause animation";
        message.textContent = data.active
          ? data.monkeyName + (data.paused ? " is saving some energy." : " brought the whole bunch.")
          : "The party is ready when you are.";
        if (!data.reducedMotion) motionOverrideEnabled = false;
        syncMotion();
      }
      if (data.type === "celebrate" && !celebrating) {
        celebrating = true;
        body.classList.add("celebrating");
        setTimeout(() => {
          body.classList.remove("celebrating");
          celebrating = false;
        }, 700);
      }
    }, { signal: events.signal });

    window.addEventListener("pagehide", () => events.abort(), { once: true });
  </script>
</body>
</html>`;
}

module.exports = { BananaPartySurfaces };
