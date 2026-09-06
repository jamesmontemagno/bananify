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
      const stores = page.getByRole("list", { name: "Browser store availability" });
      assert.deepEqual(await stores.getByRole("listitem").allTextContents(), [
        "Chrome Web StoreComing soon", "Microsoft Edge Add-onsComing soon",
      ]);
      assert.equal(await stores.locator("a, button, [tabindex]").count(), 0);
      for (const row of await stores.getByRole("listitem").all()) {
        const bounds = await row.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
      }
      const body = await page.locator("body").innerHTML();
      await page.getByRole("button", { name: "Bananify this page" }).click();
      assert.equal(await page.evaluate(() => bananaFeed.active), true);
      const firstMonkey = await page.evaluate(() => bananaFeed.monkeyVariant);
      assert.ok(["brown", "black-and-white", "golden"].includes(firstMonkey));
      await page.evaluate(() => window.testPartyRoot.querySelector(".more").click());
      assert.notEqual(await page.evaluate(() => bananaFeed.monkeyVariant), firstMonkey);
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
      // Keep CI independent of GitHub availability and whether this tag is published yet.
      const releaseURL = "https://github.com/jamesmontemagno/bananify/releases/latest/download/bananify-extension.zip";
      await page.route(releaseURL, async (route) => {
        const archive = await page.request.get(`${baseURL}/downloads/bananify-extension.zip`);
        assert.equal(archive.status(), 200);
        await route.fulfill({
          status: 200, contentType: "application/zip",
          headers: { "content-disposition": 'attachment; filename="bananify-extension.zip"' },
          body: await archive.body(),
        });
      });
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

test("all monkey variants have distinct artwork and random selection avoids repeats", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(baseURL);
    const variants = await page.evaluate(() => {
      const random = Math.random;
      try {
        return [0, .34, .99].map((sample) => {
          Math.random = () => sample;
          const variant = bananaFeedArt.chooseMonkey();
          const svg = bananaFeedArt.monkey(variant);
          return {
            variant, name: svg.dataset.monkeyName, art: svg.outerHTML,
            different: bananaFeedArt.chooseMonkey(variant),
          };
        });
      } finally {
        Math.random = random;
      }
    });
    assert.deepEqual(variants.map(({ variant }) => variant), ["brown", "black-and-white", "golden"]);
    assert.equal(new Set(variants.map(({ art }) => art)).size, 3);
    assert.equal(variants[1].name, "Black-and-white capuchin");
    for (const variant of variants) assert.notEqual(variant.variant, variant.different);
    await page.evaluate(() => {
      document.body.replaceChildren(...bananaFeedArt.monkeyVariants.map((variant) => {
        const svg = bananaFeedArt.monkey(variant);
        svg.style.width = "280px";
        return svg;
      }));
      document.body.style.background = "#ffdc45";
    });
    await page.screenshot({ path: "test-results/monkey-variants.png" });
  } finally {
    await page.close();
  }
});

test("page disguises preserve nodes, layout, controls, and live site updates", async () => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, reducedMotion: "reduce" });
  try {
    await page.addInitScript(() => {
      const original = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) {
        const root = original.call(this, options);
        if (this.localName === "banana-feed-party") window.testPartyRoot = root;
        return root;
      };
    });
    await page.goto(baseURL);
    await page.setContent(`
      <style>body { margin: 30px; min-height: 1700px; font: 18px sans-serif; } img { display: block; } p { width: 350px; }</style>
      <p id="text">A perfectly ordinary paragraph.</p>
      <img id="image" src="${baseURL}/icons/banana-128.png" width="80" height="80" alt="Original artwork">
      <p id="faded" style="opacity: .65 !important; color: red;">Some slightly faded text.</p>
      <p id="empty-style" style="">An element with an empty style attribute.</p>
      <nav><span id="nav">Navigation stays readable</span></nav>
      <a href="#target"><span id="link">Keep this link</span></a>
      <button id="button"><span>Keep this button</span></button>
      <form><label>Note<input id="input" value="Keep my input"></label><p id="form-text">Form instructions</p></form>
      <div contenteditable="true"><p id="editable">Editable text</p></div>
      <p id="live" aria-live="polite">Live status</p>
      <p id="focusable" tabindex="0">Keyboard control</p>
      <div data-bananify-protect><p id="protected">Opted out of bananas</p></div>
    `);
    await page.locator("#image").evaluate((node) => node.decode());
    const originalRects = await page.evaluate(() => ["text", "image", "faded", "empty-style"].map((id) => document.getElementById(id).getBoundingClientRect().toJSON()));
    await page.evaluate(() => {
      window.savedText = document.getElementById("text");
      window.savedImage = document.getElementById("image");
      window.clickCount = 0;
      window.savedText.addEventListener("click", () => window.clickCount++);
      bananaFeed.toggle();
    });
    assert.deepEqual(await page.evaluate(() => ["text", "image", "faded", "empty-style"].map((id) => document.getElementById(id).style.opacity)), ["0", "0", "0", "0"]);
    assert.deepEqual(await page.evaluate(() => ["text", "image", "faded", "empty-style"].map((id) => document.getElementById(id).getBoundingClientRect().toJSON())), originalRects);
    assert.equal(await page.evaluate(() => document.getElementById("text") === window.savedText), true);
    const protectedIds = ["nav", "link", "button", "input", "form-text", "editable", "live", "focusable", "protected"];
    assert.deepEqual(await page.evaluate((ids) => ids.map((id) => document.getElementById(id).style.opacity), protectedIds), protectedIds.map(() => ""));
    await page.locator("#text").click();
    assert.equal(await page.evaluate(() => window.clickCount), 1);
    await page.locator("#input").fill("Still editable");
    await page.evaluate(() => {
      window.savedText.textContent = "The site updated this text during the party.";
      document.getElementById("faded").style.color = "blue";
      document.getElementById("empty-style").style.opacity = ".8";
      window.savedImage.remove();
    });
    await page.waitForFunction(() => !window.savedImage.style.opacity);
    await page.evaluate(() => bananaFeed.stop());
    assert.equal(await page.locator("#text").textContent(), "The site updated this text during the party.");
    assert.equal(await page.locator("#text").getAttribute("style"), null);
    assert.equal(await page.locator("#image").count(), 0);
    assert.equal(await page.locator("#input").inputValue(), "Still editable");
    assert.deepEqual(await page.locator("#faded").evaluate((node) => ({
      opacity: node.style.opacity, priority: node.style.getPropertyPriority("opacity"), color: node.style.color,
    })), { opacity: "0.65", priority: "important", color: "blue" });
    assert.equal(await page.locator("#empty-style").evaluate((node) => node.style.opacity), "0.8");
    await page.evaluate(() => bananaFeed.toggle());
    await page.evaluate(() => document.querySelector("banana-feed-party").remove());
    await page.waitForFunction(() => !bananaFeed.active);
    assert.equal(await page.locator("#text").getAttribute("style"), null);
    assert.equal(await page.locator("#faded").evaluate((node) => node.style.opacity), "0.65");
    await page.evaluate(() => {
      document.body.replaceChildren(...Array.from({ length: 24 }, (_, index) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = `Banana candidate ${index + 1}`;
        return paragraph;
      }));
      bananaFeed.toggle();
      for (let count = 0; count < 15; count++) window.testPartyRoot.querySelector(".more").click();
    });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("p")].filter((node) => node.style.opacity === "0").length), 12);
    const beforeScroll = await page.evaluate(() => window.testPartyRoot.querySelector("canvas").toDataURL());
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForFunction((previous) => window.testPartyRoot.querySelector("canvas").toDataURL() !== previous, beforeScroll);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    assert.equal(await page.evaluate(() => bananaFeed.active), false);
    assert.equal(await page.locator("p[style]").count(), 0);
  } finally {
    await page.close();
  }
});
