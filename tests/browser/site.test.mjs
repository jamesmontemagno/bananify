import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import { createPreviewServer } from "../../scripts/preview-server.mjs";

let browser;
let server;
let baseURL;
before(async () => {
  server = createPreviewServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  await mkdir("test-results", { recursive: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

for (const viewport of [{ width: 1365, height: 1000 }, { width: 375, height: 812 }]) {
  test(`published site and banana controls work at ${viewport.width}px`, async () => {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const original = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) {
        const root = original.call(this, options);
        if (this.localName === "banana-feed-party") window.testPartyRoot = root;
        return root;
      };
    });
    try {
      await page.goto(baseURL);
      assert.match(await page.title(), /^Bananify /);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const body = await page.locator("body").innerHTML();
      await page.getByRole("button", { name: "Bananify this page" }).click();
      assert.equal(await page.evaluate(() => bananaFeed.active), true);
      await page.evaluate(() => window.testPartyRoot.querySelector(".pause").click());
      assert.equal(await page.evaluate(() => bananaFeed.paused), true);
      const snapshot = await page.evaluate(() => window.testPartyRoot.querySelector("canvas").toDataURL());
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.testPartyRoot.querySelector("canvas").toDataURL()), snapshot);
      await page.evaluate(() => window.testPartyRoot.querySelector(".pause").click());
      assert.equal(await page.evaluate(() => bananaFeed.paused), false);
      await page.evaluate(() => {
        for (let count = 0; count < 20; count++) window.testPartyRoot.querySelector(".more").click();
      });
      assert.equal(await page.evaluate(() => window.testPartyRoot.querySelector(".speech").textContent), "Peak banana. No regrets.");
      const dock = await page.evaluate(() => window.testPartyRoot.querySelector(".dock").getBoundingClientRect().toJSON());
      assert.ok(dock.left >= 0 && dock.right <= viewport.width);
      await page.evaluate(() => window.testPartyRoot.querySelector(".restore").click());
      assert.equal(await page.locator("banana-feed-party").count(), 0);
      assert.equal(await page.locator("body").innerHTML(), body);
      await page.getByRole("button", { name: "Bananify this page" }).click();
      await page.screenshot({ path: `test-results/party-${viewport.width}.png`, fullPage: true });
      await page.getByLabel("A very important internet task").fill("Buy bananas");
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByText("Done! The website still works. Your note stays in this tab only.").waitFor();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => getComputedStyle(window.testPartyRoot.querySelector(".pause")).display === "none");
      const reduced = await page.evaluate(() => window.testPartyRoot.querySelector("canvas").toDataURL());
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.testPartyRoot.querySelector("canvas").toDataURL()), reduced);
      assert.equal(await page.evaluate(() => getComputedStyle(window.testPartyRoot.querySelector(".monkey-body")).animationName), "none");
      await page.evaluate(() => bananaFeed.stop());
      for (let count = 0; count < 5; count++) await page.evaluate(() => { bananaFeed.toggle(); bananaFeed.toggle(); });
      assert.equal(await page.locator("banana-feed-party").count(), 0);
      const downloadReady = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download Bananify for Chrome / Edge" }).click();
      const download = await downloadReady;
      assert.equal(await download.failure(), null);
      const bytes = await readFile(await download.path());
      assert.equal(bytes.subarray(0, 2).toString(), "PK");
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
}
