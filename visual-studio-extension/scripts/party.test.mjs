import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

let browser;
const origin = "https://bananify.invalid";
const root = new URL("../src/Bananify/Web/", import.meta.url);
before(async () => {
  // Keep the persistent browser profile inside the repository, not a temp folder.
  await mkdir("visual-studio-extension/scripts/.inspection/profile", { recursive: true });
  browser = await chromium.launchPersistentContext("visual-studio-extension/scripts/.inspection/profile", {
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
});
after(async () => browser?.close());
async function open(width, compact, reducedMotion = "no-preference") {
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: compact ? 260 : 820 });
  await page.emulateMedia({ reducedMotion });
  await page.route(`${origin}/**`, async (route) => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!["party.html", "party.js", "party.css"].includes(filename)) return route.abort();
    const contentType = filename.endsWith("js") ? "text/javascript" : filename.endsWith("css") ? "text/css" : "text/html";
    await route.fulfill({ body: await readFile(new URL(filename, root)), contentType });
  });
  await page.addInitScript(() => {
    const bridge = new EventTarget();
    bridge.messages = [];
    bridge.postMessage = (message) => bridge.messages.push(message);
    window.chrome = window.chrome || {};
    window.chrome.webview = bridge;
  });
  await page.goto(`${origin}/party.html`);
  await page.waitForFunction(() => window.chrome.webview.messages.some((message) => message.command === "ready"));
  await send(page, { compact });
  return page;
}
async function send(page, overrides = {}) {
  await page.evaluate((values) => {
    window.chrome.webview.dispatchEvent(new MessageEvent("message", { data: {
      type: "snapshot", active: true, paused: false, visible: true, reducedMotion: false,
      compact: true, density: 5, monkey: "brown", ...values,
    } }));
  }, overrides);
}
for (const [width, compact] of [[220, true], [320, true], [1100, false]]) {
  test(`party ${width}px preserves local CSP, keyboard controls and bounded animation`, async () => {
    const page = await open(width, compact);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      assert.equal(await page.locator(".party-monkey:visible").count(), 3);
      assert.equal(await page.locator(".banana-drop").count(), 28);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole("button", { name: "Choose Henry" }).focus();
      await page.keyboard.press("Enter");
      assert.deepEqual((await page.evaluate(() => window.chrome.webview.messages)).at(-1), { command: "monkey", monkey: "golden" });
      await page.getByRole("button", { name: "More bananas" }).focus();
      await page.keyboard.press("Space");
      assert.deepEqual((await page.evaluate(() => window.chrome.webview.messages)).at(-1), { command: "more" });
      await page.evaluate(() => {
        for (let i = 0; i < 100; i++) document.body.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 100, bubbles: true }));
      });
      assert.equal(await page.locator(".burst").count(), 30);
      await send(page, { visible: false, compact });
      assert.equal(await page.locator(".burst").count(), 0);
      assert.equal(await page.locator(".banana-drop").count(), 0);
      await send(page, { paused: true, compact });
      assert.equal(await page.getByRole("button", { name: "More bananas" }).isDisabled(), true);
      await send(page, { active: false, compact });
      assert.equal(await page.getByRole("button", { name: "Start party" }).isVisible(), true);
      await send(page, { compact, monkey: "golden" });
      await page.screenshot({ path: `visual-studio-extension/scripts/.inspection/party-${width}.png` });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
test("OS reduced motion cannot be overridden by a state snapshot", async () => {
  const page = await open(320, true, "reduce");
  try {
    assert.equal(await page.locator(".banana-drop").count(), 0);
    await page.evaluate(() => window.chrome.webview.dispatchEvent(new MessageEvent("message", { data: { type: "celebrate" } })));
    assert.equal(await page.locator(".burst").count(), 0);
    assert.match(await page.locator(".message").textContent(), /thanks/);
    assert.equal(await page.locator(".monkey-body").first().evaluate((node) => getComputedStyle(node).animationName), "none");
  } finally { await page.close(); }
});
test("one hidden surface does not pause another", async () => {
  const compact = await open(320, true);
  const large = await open(1100, false);
  try {
    await send(compact, { visible: false });
    assert.equal(await compact.locator(".banana-drop").count(), 0);
    assert.equal(await large.locator(".banana-drop").count(), 28);
  } finally { await compact.close(); await large.close(); }
});

test("invalid native density snapshots leave the previous state untouched", async () => {
  const page = await open(320, true);
  try {
    await send(page, { density: 1 });
    assert.equal(await page.locator(".banana-drop").count(), 6);
    for (const density of [0, 6, 100, 1.5, "5"]) {
      await send(page, { density, active: false });
      assert.equal(await page.locator(".banana-drop").count(), 6);
      assert.equal(await page.getByRole("button", { name: "Pause", exact: true }).isVisible(), true);
    }
  } finally { await page.close(); }
});
