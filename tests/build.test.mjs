import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildSite } from "../scripts/build.mjs";
import { packageRelease } from "../scripts/package-release.mjs";
import { createHash } from "node:crypto";

test("production build publishes only the website and reproducible manual-install and store packages", async () => {
  const output = await buildSite();
  assert.deepEqual((await readdir(output)).sort(), [
    ".nojekyll", "CNAME", "LICENSE", "artwork.js", "downloads", "icons", "index.html",
    "party.js", "preview.css", "preview.js", "robots.txt", "sitemap.xml", "social-card.png",
  ].sort());
  assert.equal((await readFile(join(output, "CNAME"), "utf8")).trim(), "bananify.online");
  const html = await readFile(join(output, "index.html"), "utf8");
  assert.match(html, /<title>Bananify /);
  assert.match(html, /href="https:\/\/bananify\.online\/"/);
  assert.match(html, /href="https:\/\/github\.com\/jamesmontemagno\/bananify\/releases\/latest\/download\/bananify-extension\.zip" download/);
  assert.match(html, /Release notes &amp; previous versions/);
  assert.doesNotMatch(html, /Banana Feed|banana feed|banana-feed folder/);
  assert.match(html, /Made by.*James Montemagno.*&amp; Mooch/s);
  assert.match(html, /href="https:\/\/github\.com\/jamesmontemagno\/bananify"/);
  const structuredData = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(structuredData["@graph"][1].name, "Bananify");
  assert.equal(structuredData["@graph"][1].installUrl, "https://microsoftedge.microsoft.com/addons/detail/iidhiomigjipgnembnbcndbliniciijh");
  assert.equal(structuredData["@graph"][1].downloadUrl, "https://github.com/jamesmontemagno/bananify/releases/latest/download/bananify-extension.zip");
  const socialImage = await readFile(join(output, "social-card.png"));
  assert.equal(socialImage.readUInt32BE(16), 1200);
  assert.equal(socialImage.readUInt32BE(20), 630);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const path = match[1];
    if (path.startsWith("https:") || path.startsWith("#") || path === "./") continue;
    await readFile(join(output, path));
  }
  const extensionFiles = [
    "LICENSE", "artwork.js", "background.js", "icons/banana-128.png", "icons/banana-16.png",
    "icons/banana-32.png", "icons/banana-48.png", "manifest.json", "party.js", "toggle.js",
  ];
  const archives = [
    ["bananify-extension.zip", "bananify/"],
    ["bananify-store.zip", ""],
  ];
  assert.deepEqual((await readdir(join(output, "downloads"))).sort(), [
    "SHA256SUMS.txt", "bananify-extension.zip", "bananify-store.zip",
  ]);
  const originalArchives = new Map();
  const manualFiles = new Map();
  const sourceManifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  for (const [name, prefix] of archives) {
    const zip = join(output, "downloads", name);
    const entries = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
    assert.deepEqual(entries, extensionFiles.map((file) => `${prefix}${file}`));
    const timestamps = execFileSync("unzip", ["-Z", "-T", zip], { encoding: "utf8" });
    assert.equal([...timestamps.matchAll(/\b20000101\.000000\b/g)].length, extensionFiles.length);
    for (const file of extensionFiles) {
      const content = execFileSync("unzip", ["-p", zip, `${prefix}${file}`]);
      assert.deepEqual(content, await readFile(new URL(`../${file}`, import.meta.url)), `${name}: ${file} matches source`);
      if (prefix) manualFiles.set(file, content);
      else assert.deepEqual(content, manualFiles.get(file), `${file} is identical in both ZIPs`);
    }
    const manifest = JSON.parse(execFileSync("unzip", ["-p", zip, `${prefix}manifest.json`], { encoding: "utf8" }));
    assert.deepEqual(manifest, sourceManifest);
    assert.equal(manifest.name, "Bananify");
    assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
    originalArchives.set(name, await readFile(zip));
  }
  const expectedChecksums = archives.map(([name]) =>
    `${createHash("sha256").update(originalArchives.get(name)).digest("hex")}  ${name}\n`
  ).join("");
  assert.equal(await readFile(join(output, "downloads/SHA256SUMS.txt"), "utf8"), expectedChecksums);
  const release = await packageRelease();
  assert.deepEqual((await readdir(release)).sort(), [
    "RELEASE_NOTES.md", "SHA256SUMS.txt", "bananify-extension.zip", "bananify-store.zip",
  ]);
  for (const [name] of archives) {
    assert.deepEqual(await readFile(join(release, name)), originalArchives.get(name));
  }
  assert.equal(await readFile(join(release, "SHA256SUMS.txt"), "utf8"), expectedChecksums);
  const notes = await readFile(join(release, "RELEASE_NOTES.md"), "utf8");
  assert.match(notes, /Unpacked extensions do not update automatically/);
  assert.match(notes, /bananify-extension\.zip\*\* is for manual installation/);
  assert.match(notes, /bananify-store\.zip\*\* is for maintainers submitting manually/);
  assert.match(notes, /Chrome Web Store/);
  assert.match(notes, /Microsoft Edge Add-ons/);
  assert.match(notes, /`manifest\.json` is at its root/);
  assert.match(notes, /does not submit to either store/);
  await buildSite();
  await packageRelease();
  for (const [name] of archives) {
    assert.deepEqual(await readFile(join(output, "downloads", name)), originalArchives.get(name));
    assert.deepEqual(await readFile(join(release, name)), originalArchives.get(name));
  }
  assert.equal(await readFile(join(output, "downloads/SHA256SUMS.txt"), "utf8"), expectedChecksums);
  assert.equal(await readFile(join(release, "SHA256SUMS.txt"), "utf8"), expectedChecksums);
  assert.equal(await readFile(join(release, "RELEASE_NOTES.md"), "utf8"), notes);
});
