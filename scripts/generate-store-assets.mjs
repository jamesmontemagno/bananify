import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { icon } from "./generate-icons.mjs";
import { readReleaseVersion } from "./release-version.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "store/assets");
const version = await readReleaseVersion();
const archive = join(root, "dist/downloads/bananify-store.zip");
const packagedManifest = JSON.parse(execFileSync("unzip", ["-p", archive, "manifest.json"], { encoding: "utf8" }));
assert.equal(packagedManifest.version, version, "Rebuild the store package before generating assets.");
const temporary = await mkdtemp(join(tmpdir(), "bananify-store-assets-"));
const runtimeHashes = {};
let browser;
try {
  // Read only the runtime entries needed for capture, not arbitrary ZIP paths.
  for (const name of ["artwork.js", "party.js", "toggle.js"]) {
    const bytes = execFileSync("unzip", ["-p", archive, name]);
    runtimeHashes[name] = createHash("sha256").update(bytes).digest("hex");
    await writeFile(join(temporary, name), bytes);
  }
  await mkdir(output, { recursive: true });
  for (const size of [128, 300]) await writeFile(join(output, `icon-${size}.png`), icon(size));
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("../store/source/promo.html", import.meta.url).href);
  await page.addScriptTag({ path: join(temporary, "artwork.js") });
  await page.evaluate(() => document.getElementById("monkey").append(bananaFeedArt.monkey()));
  await page.screenshot({ path: join(output, "promo-440x280.png") });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("../store/source/sample.html", import.meta.url).href);
  await page.evaluate(() => {
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const shadow = attach.call(this, options);
      if (this.localName === "banana-feed-party") window.capturePartyRoot = shadow;
      return shadow;
    };
  });
  // Execute the exact packaged runtime, as the toolbar does. No mock party or altered artwork.
  for (const name of ["artwork.js", "party.js", "toggle.js"]) await page.addScriptTag({ path: join(temporary, name) });
  await page.waitForFunction(() => bananaFeed.active);
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.capturePartyRoot.querySelector(".pause").click());
  assert.equal(await page.evaluate(() => bananaFeed.paused), true);
  await page.screenshot({ path: join(output, "screenshot-party.png") });
  await page.evaluate(() => window.capturePartyRoot.querySelector(".restore").click());
  assert.equal(await page.locator("banana-feed-party").count(), 0);
  assert.equal(await page.locator('[style*="opacity"]').count(), 0);
  await page.screenshot({ path: join(output, "screenshot-restored.png") });
  assert.deepEqual(errors, []);
  await writeFile(join(output, "capture.json"), `${JSON.stringify({
    version,
    source: "dist/downloads/bananify-store.zip",
    runtimeSHA256: runtimeHashes,
    method: "Packaged artwork.js, party.js, and toggle.js executed on store/source/sample.html; toolbar and store installation are not shown.",
    screenshots: { width: 1280, height: 800 },
    monkey: "Randomly selected by the unmodified runtime.",
  }, null, 2)}\n`);
  console.log(`Generated store assets in ${output}`);
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
}
