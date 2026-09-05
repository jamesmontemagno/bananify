import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildSite } from "../scripts/build.mjs";

test("production build publishes only the website and a complete extension download", async () => {
  const output = await buildSite();
  assert.deepEqual((await readdir(output)).sort(), [
    ".nojekyll", "CNAME", "artwork.js", "downloads", "icons", "index.html",
    "party.js", "preview.css", "preview.js", "robots.txt", "sitemap.xml", "social-card.png",
  ].sort());
  assert.equal((await readFile(join(output, "CNAME"), "utf8")).trim(), "bananify.online");
  const html = await readFile(join(output, "index.html"), "utf8");
  assert.match(html, /<title>Bananify /);
  assert.match(html, /href="https:\/\/bananify\.online\/"/);
  assert.match(html, /href="downloads\/bananify-extension\.zip" download/);
  assert.doesNotMatch(html, /Banana Feed|banana feed|banana-feed folder/);
  assert.match(html, /Made by.*James Montemagno.*&amp; Mooch/s);
  assert.match(html, /href="https:\/\/github\.com\/jamesmontemagno\/bananify"/);
  const structuredData = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(structuredData["@graph"][1].name, "Bananify");
  assert.equal(structuredData["@graph"][1].downloadUrl, "https://bananify.online/downloads/bananify-extension.zip");
  const socialImage = await readFile(join(output, "social-card.png"));
  assert.equal(socialImage.readUInt32BE(16), 1200);
  assert.equal(socialImage.readUInt32BE(20), 630);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const path = match[1];
    if (path.startsWith("https:") || path.startsWith("#") || path === "./") continue;
    await readFile(join(output, path));
  }
  const zip = join(output, "downloads/bananify-extension.zip");
  const entries = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
  assert.deepEqual(entries, [
    "artwork.js", "background.js", "icons/banana-128.png", "icons/banana-16.png",
    "icons/banana-32.png", "icons/banana-48.png", "manifest.json", "party.js", "toggle.js",
  ].map((file) => `bananify/${file}`));
  const manifest = JSON.parse(execFileSync("unzip", ["-p", zip, "bananify/manifest.json"], { encoding: "utf8" }));
  assert.equal(manifest.name, "Bananify");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  const first = await readFile(zip);
  await buildSite();
  assert.deepEqual(await readFile(zip), first);
});
