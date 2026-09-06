import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import { chromium } from "playwright";

const sourceURL = new URL("../../vscode-extension/party-panel.js", import.meta.url);
const require = createRequire(sourceURL);
const module = { exports: {} };
vm.runInNewContext(await readFile(sourceURL, "utf8"), {
  module,
  require: (name) => name === "vscode" ? {} : require(name),
});
const { BananaPartySurfaces } = module.exports;
let browser;

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
  await mkdir("test-results", { recursive: true });
});
after(async () => browser?.close());

async function sendState(page, overrides = {}) {
  await page.evaluate((state) => {
    window.dispatchEvent(new MessageEvent("message", { data: {
      type: "state", active: true, paused: false, visible: true,
      reducedMotion: false, monkey: "brown", monkeyName: "Mooch", ...state,
    } }));
  }, overrides);
}

async function openParty(surface, viewport, reducedMotion = "no-preference") {
  const page = await browser.newPage({ viewport, reducedMotion, hasTouch: true });
  const surfaces = new BananaPartySurfaces(() => "brown", () => false, () => {});
  const webview = { cspSource: "'self'", onDidReceiveMessage: () => ({ dispose() {} }) };
  surfaces.configureWebview(webview, surface);
  await page.evaluate(() => {
    window.messages = [];
    window.acquireVsCodeApi = () => ({ postMessage: (message) => window.messages.push(message) });
  });
  await page.setContent(webview.html);
  await page.addStyleTag({ content: `:root {
    --vscode-foreground: #fff8d9; --vscode-descriptionForeground: #e3d5aa;
    --vscode-editor-background: #273b2b; --vscode-font-family: system-ui;
    --vscode-panel-border: #718768; --vscode-focusBorder: #ffda35;
    --vscode-button-background: #ffda35; --vscode-button-foreground: #273b2b;
    --vscode-button-hoverBackground: #ffe777; --vscode-button-secondaryBackground: #425638;
    --vscode-button-secondaryForeground: #fff8d9; --vscode-button-secondaryHoverBackground: #526648;
  }` });
  await sendState(page);
  return page;
}

for (const width of [220, 320]) {
  test(`Explorer party is compact and supports bounded mouse, touch, and keyboard bursts at ${width}px`, async () => {
    const page = await openParty("explorer", { width, height: 180 });
    try {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const main = await page.locator("main").boundingBox();
      assert.ok(main.height <= 140, `Compact party was ${main.height}px tall`);
      assert.equal(await page.locator(".party-monkey:visible").count(), 3);
      assert.ok(await page.locator(".party-monkey").first().evaluate((node) =>
        node.getBoundingClientRect().height <= 62));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.ok(await page.locator(".banana-drop").first().evaluate((node) =>
        parseFloat(getComputedStyle(node).width) < 24));
      await page.screenshot({ path: `test-results/explorer-party-${width}.png` });

      await page.mouse.click(width / 2, 40);
      assert.equal(await page.locator(".burst").count(), 6);
      assert.equal(await page.locator(".bursts").evaluate((node) => getComputedStyle(node).zIndex), "2");
      assert.equal(await page.locator(".bursts").evaluate((node) => getComputedStyle(node).pointerEvents), "none");
      await page.touchscreen.tap(width / 2, 40);
      assert.equal(await page.locator(".burst").count(), 12);
      await page.getByRole("button", { name: "More bananas" }).focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(".burst").count(), 18);
      assert.deepEqual(await page.evaluate(() => window.messages), []);
      await page.evaluate(() => {
        for (let index = 0; index < 100; index++) {
          document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 110, clientY: 40, button: 0 }));
        }
      });
      assert.equal(await page.locator(".burst").count(), 30);
      assert.equal(await page.evaluate("burstTimers.size"), 30);
      await page.waitForFunction(() => document.querySelector(".bursts").childElementCount === 0);
      assert.equal(await page.evaluate("burstTimers.size"), 0);

      await page.getByRole("button", { name: "Pause", exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.messages), [{ command: "pause" }]);
      assert.equal(await page.locator(".burst").count(), 0);
      for (const state of [{ paused: true }, { active: false }, { visible: false }]) {
        await sendState(page);
        await page.mouse.click(width / 2, 40);
        assert.equal(await page.locator(".burst").count(), 6);
        await sendState(page, state);
        assert.equal(await page.locator(".burst").count(), 0);
        assert.equal(await page.evaluate("burstTimers.size"), 0);
        await page.mouse.click(width / 2, 40);
        assert.equal(await page.locator(".burst").count(), 0);
      }
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
}

test("reduced-motion bursts stay at the tap position and clean up on pagehide", async () => {
  const page = await openParty("explorer", { width: 320, height: 180 }, "reduce");
  try {
    await sendState(page, { reducedMotion: true });
    await page.touchscreen.tap(160, 40);
    const burst = page.locator(".burst").first();
    assert.equal(await burst.evaluate((node) => getComputedStyle(node).animationName), "none");
    const bounds = await burst.boundingBox();
    assert.ok(bounds.x > 140 && bounds.x < 160);
    assert.ok(bounds.y > 20 && bounds.y < 40);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    assert.equal(await page.locator(".burst").count(), 0);
    assert.equal(await page.evaluate("burstTimers.size"), 0);
  } finally {
    await page.close();
  }
});

test("editor Party tab keeps its full-size layout and ten-banana bursts", async () => {
  const page = await openParty("editor", { width: 900, height: 800 });
  try {
    assert.equal(await page.locator(".party-monkey:visible").count(), 1);
    assert.ok((await page.locator(".monkey-stage").boundingBox()).width >= 300);
    await page.getByRole("heading", { name: "Banana Party" }).waitFor();
    await page.getByRole("button", { name: "Pause animation" }).waitFor();
    await page.mouse.click(450, 200);
    assert.equal(await page.locator(".burst").count(), 10);
    await page.screenshot({ path: "test-results/editor-party.png" });
  } finally {
    await page.close();
  }
});
